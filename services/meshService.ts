
import { MeshMessage, Peer, MessageType, GeoLocation } from '../types';

/**
 * meshService manages the simulated P2P network using the BroadcastChannel API.
 * This allows multiple tabs of the app to act as peers on the same "mesh".
 */

type MessageHandler = (msg: MeshMessage) => void;
type PeerHandler = (peers: Peer[]) => void;

class MeshService {
  private channel: BroadcastChannel;
  private messageListeners: MessageHandler[] = [];
  private peerListeners: PeerHandler[] = [];
  private currentPeers: Map<string, Peer> = new Map();
  private myPeerId: string;
  private myNickname: string;
  private readonly STORAGE_KEY = 'meshaid_peer_registry_v2';

  constructor() {
    this.channel = new BroadcastChannel('meshaid-p2p-v1');
    this.myPeerId = `peer-${Math.random().toString(36).substr(2, 9)}`;
    this.myNickname = ''; // Will be set on init
    
    // Load persisted peers from local storage on startup
    this.loadPersistedPeers();

    this.channel.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'HEARTBEAT') {
        this.handlePeerHeartbeat(data);
      } else if (data.type === 'MESH_MESSAGE') {
        this.notifyMessage(data.payload);
      }
    };

    // Broadcast presence every 5 seconds
    setInterval(() => this.broadcastHeartbeat(), 5000);
    // Periodically check for peers that have gone silent
    setInterval(() => this.checkStalePeers(), 10000);
  }

  /**
   * Loads the peer registry from LocalStorage.
   * All historical peers are initially marked as 'offline'.
   */
  private loadPersistedPeers() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const peersArray: Peer[] = JSON.parse(stored);
        peersArray.forEach(p => {
          // Re-instantiate in memory as offline, keeping their last known details
          this.currentPeers.set(p.id, { 
            ...p, 
            status: 'offline' 
          });
        });
      }
    } catch (e) {
      console.error('MeshAid: Failed to load peer registry', e);
    }
  }

  /**
   * Persists the current in-memory peer map to LocalStorage.
   */
  private persistPeers() {
    const peersArray = Array.from(this.currentPeers.values());
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(peersArray));
  }

  public init(nickname: string) {
    this.myNickname = nickname;
    this.broadcastHeartbeat();
  }

  public onMessage(handler: MessageHandler) {
    this.messageListeners.push(handler);
  }

  public onPeersChanged(handler: PeerHandler) {
    this.peerListeners.push(handler);
    // Provide immediate list of persisted peers
    handler(Array.from(this.currentPeers.values()));
  }

  public sendMessage(type: MessageType, text: string, location?: GeoLocation, manualLocation?: string) {
    const msg: MeshMessage = {
      id: crypto.randomUUID(),
      type,
      sender: this.myNickname,
      senderId: this.myPeerId,
      timestamp: Date.now(),
      priority: this.getPriority(type),
      payload: { text, location, manualLocation }
    };

    this.channel.postMessage({ type: 'MESH_MESSAGE', payload: msg });
    this.notifyMessage(msg); // Also notify local instance
  }

  private notifyMessage(msg: MeshMessage) {
    this.messageListeners.forEach(h => h(msg));
  }

  private broadcastHeartbeat() {
    this.channel.postMessage({
      type: 'HEARTBEAT',
      id: this.myPeerId,
      nickname: this.myNickname,
      timestamp: Date.now()
    });
  }

  /**
   * Handles incoming heartbeat signals from other peers.
   * Updates lastSeen and sets status to 'online'.
   */
  private handlePeerHeartbeat(data: any) {
    if (data.id === this.myPeerId) return;

    const existing = this.currentPeers.get(data.id);
    const peer: Peer = {
      id: data.id,
      nickname: data.nickname || 'Unknown Unit',
      lastSeen: data.timestamp, // Explicitly update lastSeen from the heartbeat
      status: 'online'
    };
    
    // Notify UI if status/nickname changed
    const needsUINotify = !existing || existing.status !== 'online' || existing.nickname !== peer.nickname;
    
    this.currentPeers.set(peer.id, peer);
    
    if (needsUINotify) {
      this.notifyPeers();
    }

    // Always persist to keep 'lastSeen' timestamp up to date in localStorage
    this.persistPeers();
  }

  /**
   * Transitions 'online' peers to 'offline' if they haven't sent a heartbeat recently.
   */
  private checkStalePeers() {
    const now = Date.now();
    let changed = false;
    for (const [id, peer] of this.currentPeers.entries()) {
      if (peer.status === 'online' && now - peer.lastSeen > 15000) {
        peer.status = 'offline';
        changed = true;
      }
    }
    
    if (changed) {
      this.notifyPeers();
      this.persistPeers();
    }
  }

  private notifyPeers() {
    const peersArray = Array.from(this.currentPeers.values());
    this.peerListeners.forEach(h => h(peersArray));
  }

  private getPriority(type: MessageType): number {
    switch(type) {
      case MessageType.SOS: return 5;
      case MessageType.MEDICAL: return 4;
      case MessageType.RESOURCE: return 3;
      case MessageType.ALERT: return 2;
      default: return 1;
    }
  }

  public getMyPeerId() { return this.myPeerId; }
}

export const meshService = new MeshService();
