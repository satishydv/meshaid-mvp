import { MeshMessage, Peer, MessageType, GeoLocation } from '../types';

type MessageHandler = (msg: MeshMessage) => void;
type PeerHandler = (peers: Peer[]) => void;

type HeartbeatPacket = {
  type: 'HEARTBEAT';
  id: string;
  nickname: string;
  timestamp: number;
};

type MeshMessagePacket = {
  type: 'MESH_MESSAGE';
  payload: MeshMessage;
};

type MeshAckPacket = {
  type: 'MESH_ACK';
  messageId: string;
  fromPeerId: string;
  timestamp: number;
};

type MeshPacket = HeartbeatPacket | MeshMessagePacket | MeshAckPacket;

type PendingAck = {
  msg: MeshMessage;
  lastSentAt: number;
  attempts: number;
};

class MeshService {
  private channel: BroadcastChannel;
  private relaySocket: WebSocket | null = null;
  private reconnectRelayTimerId: number | null = null;
  private isDestroyed = false;

  private messageListeners: MessageHandler[] = [];
  private peerListeners: PeerHandler[] = [];
  private currentPeers: Map<string, Peer> = new Map();
  private pendingAcks: Map<string, PendingAck> = new Map();
  private recentlySeenMessageIds: Map<string, number> = new Map();

  private myPeerId: string;
  private myNickname: string;

  private heartbeatIntervalId: number;
  private staleCheckIntervalId: number;
  private retryIntervalId: number;
  private seenPruneIntervalId: number;
  private persistPeersTimeoutId: number | null = null;

  private readonly PEER_STORAGE_KEY = 'meshaid_peer_registry_v4';
  private readonly OUTBOX_STORAGE_KEY = 'meshaid_outbox_v2';
  private readonly MAX_RECENT_MESSAGE_IDS = 500;
  private readonly MAX_RETRY_ATTEMPTS = 4;
  private readonly RELAY_PORT = '3001';
  private readonly RELAY_PATH = '/mesh-relay';

  constructor() {
    this.channel = new BroadcastChannel('meshaid-local-fallback-v1');
    this.myPeerId = `peer-${Math.random().toString(36).slice(2, 11)}`;
    this.myNickname = '';

    this.loadPersistedPeers();
    this.loadOutbox();

    this.channel.onmessage = (event) => this.handlePacket(event.data);
    this.connectRelaySocket();

    this.heartbeatIntervalId = window.setInterval(() => this.broadcastHeartbeat(), 5000);
    this.staleCheckIntervalId = window.setInterval(() => this.checkStalePeers(), 10000);
    this.retryIntervalId = window.setInterval(() => this.retryPendingMessages(), 2500);
    this.seenPruneIntervalId = window.setInterval(() => this.pruneSeenMessageIds(), 15000);
  }

  public init(nickname: string) {
    if (this.myNickname === nickname) return;
    this.myNickname = nickname;
    this.broadcastHeartbeat();
    this.retryPendingMessages();
  }

  public onMessage(handler: MessageHandler) {
    this.messageListeners.push(handler);
    return () => {
      this.messageListeners = this.messageListeners.filter((h) => h !== handler);
    };
  }

  public onPeersChanged(handler: PeerHandler) {
    this.peerListeners.push(handler);
    handler(Array.from(this.currentPeers.values()));
    return () => {
      this.peerListeners = this.peerListeners.filter((h) => h !== handler);
    };
  }

  public sendMessage(type: MessageType, text: string, location?: GeoLocation, manualLocation?: string) {
    const msg: MeshMessage = {
      id: this.createMessageId(),
      type,
      sender: this.myNickname || 'Unknown Unit',
      senderId: this.myPeerId,
      timestamp: Date.now(),
      priority: this.getPriority(type),
      payload: { text, location, manualLocation }
    };

    this.markMessageSeen(msg.id);
    this.notifyMessage(msg);
    this.trackOutgoingMessage(msg);
    this.postPacket({ type: 'MESH_MESSAGE', payload: msg });
  }

  public getMyPeerId() {
    return this.myPeerId;
  }

  public destroy() {
    this.isDestroyed = true;
    window.clearInterval(this.heartbeatIntervalId);
    window.clearInterval(this.staleCheckIntervalId);
    window.clearInterval(this.retryIntervalId);
    window.clearInterval(this.seenPruneIntervalId);
    if (this.persistPeersTimeoutId !== null) {
      window.clearTimeout(this.persistPeersTimeoutId);
      this.persistPeersTimeoutId = null;
    }
    if (this.reconnectRelayTimerId !== null) {
      window.clearTimeout(this.reconnectRelayTimerId);
      this.reconnectRelayTimerId = null;
    }
    if (this.relaySocket) {
      this.relaySocket.close();
      this.relaySocket = null;
    }
    this.channel.close();
    this.messageListeners = [];
    this.peerListeners = [];
  }

  private connectRelaySocket() {
    if (this.isDestroyed) return;
    const url = this.getRelaySocketUrl();

    try {
      const socket = new WebSocket(url);
      this.relaySocket = socket;

      socket.onopen = () => {
        if (this.reconnectRelayTimerId !== null) {
          window.clearTimeout(this.reconnectRelayTimerId);
          this.reconnectRelayTimerId = null;
        }
        this.broadcastHeartbeat();
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data));
          this.handlePacket(parsed);
        } catch {
          // Ignore malformed packets from relay.
        }
      };

      socket.onclose = () => {
        this.relaySocket = null;
        this.scheduleRelayReconnect();
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch {
      this.scheduleRelayReconnect();
    }
  }

  private scheduleRelayReconnect() {
    if (this.isDestroyed || this.reconnectRelayTimerId !== null) return;
    this.reconnectRelayTimerId = window.setTimeout(() => {
      this.reconnectRelayTimerId = null;
      this.connectRelaySocket();
    }, 2000);
  }

  private getRelaySocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    return `${protocol}//${host}:${this.RELAY_PORT}${this.RELAY_PATH}`;
  }

  private handlePacket(raw: unknown) {
    if (!raw || typeof raw !== 'object') return;
    const data = raw as Partial<MeshPacket>;

    if (data.type === 'HEARTBEAT') {
      this.handlePeerHeartbeat(data as HeartbeatPacket);
      return;
    }

    if (data.type === 'MESH_MESSAGE') {
      this.handleIncomingMessage((data as MeshMessagePacket).payload);
      return;
    }

    if (data.type === 'MESH_ACK') {
      this.handleAck(data as MeshAckPacket);
    }
  }

  private handleIncomingMessage(msg?: MeshMessage) {
    if (!msg || !msg.id) return;
    if (this.hasSeenMessage(msg.id)) return;

    this.markMessageSeen(msg.id);
    this.notifyMessage(msg);

    if (msg.senderId !== this.myPeerId) {
      const ack: MeshAckPacket = {
        type: 'MESH_ACK',
        messageId: msg.id,
        fromPeerId: this.myPeerId,
        timestamp: Date.now()
      };
      this.postPacket(ack);
    }
  }

  private handleAck(packet: MeshAckPacket) {
    if (!packet.messageId) return;
    if (this.pendingAcks.delete(packet.messageId)) {
      this.persistOutbox();
    }
  }

  private postPacket(packet: MeshPacket) {
    // Local same-device tabs fallback
    this.channel.postMessage(packet);

    // Cross-device relay over LAN/WAN
    if (this.relaySocket?.readyState === WebSocket.OPEN) {
      this.relaySocket.send(JSON.stringify(packet));
    }
  }

  private trackOutgoingMessage(msg: MeshMessage) {
    this.pendingAcks.set(msg.id, {
      msg,
      lastSentAt: Date.now(),
      attempts: 1
    });
    this.persistOutbox();
  }

  private retryPendingMessages() {
    if (this.pendingAcks.size === 0) return;

    const hasOnlinePeers = Array.from(this.currentPeers.values()).some((p) => p.status === 'online');
    if (!hasOnlinePeers) return;

    const now = Date.now();
    let changed = false;

    for (const [messageId, pending] of this.pendingAcks.entries()) {
      if (now - pending.lastSentAt < 3000) continue;

      if (pending.attempts >= this.MAX_RETRY_ATTEMPTS) {
        this.pendingAcks.delete(messageId);
        changed = true;
        continue;
      }

      this.postPacket({ type: 'MESH_MESSAGE', payload: pending.msg });
      pending.lastSentAt = now;
      pending.attempts += 1;
      changed = true;
    }

    if (changed) {
      this.persistOutbox();
    }
  }

  private notifyMessage(msg: MeshMessage) {
    this.messageListeners.forEach((handler) => handler(msg));
  }

  private broadcastHeartbeat() {
    const packet: HeartbeatPacket = {
      type: 'HEARTBEAT',
      id: this.myPeerId,
      nickname: this.myNickname || 'Unknown Unit',
      timestamp: Date.now()
    };
    this.postPacket(packet);
  }

  private handlePeerHeartbeat(data: HeartbeatPacket) {
    if (!data.id || data.id === this.myPeerId) return;

    const existing = this.currentPeers.get(data.id);
    const peer: Peer = {
      id: data.id,
      nickname: data.nickname || 'Unknown Unit',
      lastSeen: data.timestamp,
      status: 'online'
    };

    const needsUINotify =
      !existing ||
      existing.status !== 'online' ||
      existing.nickname !== peer.nickname ||
      Math.abs(existing.lastSeen - peer.lastSeen) > 1000;

    this.currentPeers.set(peer.id, peer);
    if (needsUINotify) {
      this.notifyPeers();
    }
    this.schedulePersistPeers();
  }

  private checkStalePeers() {
    const now = Date.now();
    let changed = false;

    for (const [, peer] of this.currentPeers.entries()) {
      if (peer.status === 'online' && now - peer.lastSeen > 15000) {
        peer.status = 'offline';
        changed = true;
      }
    }

    if (changed) {
      this.notifyPeers();
      this.schedulePersistPeers();
    }
  }

  private notifyPeers() {
    const peersArray = Array.from(this.currentPeers.values());
    this.peerListeners.forEach((handler) => handler(peersArray));
  }

  private markMessageSeen(messageId: string) {
    this.recentlySeenMessageIds.set(messageId, Date.now());
    if (this.recentlySeenMessageIds.size > this.MAX_RECENT_MESSAGE_IDS) {
      this.pruneSeenMessageIds();
    }
  }

  private hasSeenMessage(messageId: string) {
    return this.recentlySeenMessageIds.has(messageId);
  }

  private pruneSeenMessageIds() {
    const entries = Array.from(this.recentlySeenMessageIds.entries()).sort((a, b) => b[1] - a[1]);
    if (entries.length <= this.MAX_RECENT_MESSAGE_IDS) return;

    const keep = new Set(entries.slice(0, this.MAX_RECENT_MESSAGE_IDS).map(([id]) => id));
    for (const id of this.recentlySeenMessageIds.keys()) {
      if (!keep.has(id)) {
        this.recentlySeenMessageIds.delete(id);
      }
    }
  }

  private loadPersistedPeers() {
    try {
      const stored = localStorage.getItem(this.PEER_STORAGE_KEY);
      if (!stored) return;
      const peersArray: Peer[] = JSON.parse(stored);
      peersArray.forEach((peer) => {
        this.currentPeers.set(peer.id, { ...peer, status: 'offline' });
      });
    } catch (error) {
      console.error('MeshAid: Failed to load peers', error);
    }
  }

  private schedulePersistPeers() {
    if (this.persistPeersTimeoutId !== null) return;
    this.persistPeersTimeoutId = window.setTimeout(() => {
      this.persistPeers();
      this.persistPeersTimeoutId = null;
    }, 500);
  }

  private persistPeers() {
    try {
      const peersArray = Array.from(this.currentPeers.values());
      localStorage.setItem(this.PEER_STORAGE_KEY, JSON.stringify(peersArray));
    } catch (error) {
      console.error('MeshAid: Failed to persist peers', error);
    }
  }

  private loadOutbox() {
    try {
      const stored = localStorage.getItem(this.OUTBOX_STORAGE_KEY);
      if (!stored) return;
      const pending: PendingAck[] = JSON.parse(stored);
      pending.forEach((item) => {
        if (!item?.msg?.id) return;
        this.pendingAcks.set(item.msg.id, item);
        this.markMessageSeen(item.msg.id);
      });
    } catch (error) {
      console.error('MeshAid: Failed to load outbox', error);
    }
  }

  private persistOutbox() {
    try {
      const pending = Array.from(this.pendingAcks.values());
      localStorage.setItem(this.OUTBOX_STORAGE_KEY, JSON.stringify(pending));
    } catch (error) {
      console.error('MeshAid: Failed to persist outbox', error);
    }
  }

  private getPriority(type: MessageType): number {
    switch (type) {
      case MessageType.SOS:
        return 5;
      case MessageType.MEDICAL:
        return 4;
      case MessageType.RESOURCE:
        return 3;
      case MessageType.ALERT:
        return 2;
      default:
        return 1;
    }
  }

  private createMessageId() {
    try {
      if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
      ) {
        return crypto.randomUUID();
      }
    } catch {
      // Fall back to non-crypto id generation below.
    }
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export const meshService = new MeshService();
