
export enum MessageType {
  SOS = 'SOS',
  MEDICAL = 'MEDICAL',
  RESOURCE = 'RESOURCE',
  INFO = 'INFO',
  ALERT = 'ALERT'
}

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface MeshMessage {
  id: string;
  type: MessageType;
  sender: string;
  senderId: string;
  timestamp: number;
  priority: number;
  payload: {
    text: string;
    location?: GeoLocation;
    manualLocation?: string;
  };
}

export interface Peer {
  id: string;
  nickname: string;
  lastSeen: number;
  status: 'online' | 'reconnecting' | 'offline';
}

export interface NetworkStats {
  peerCount: number;
  latency: number;
  bandwidthUsage: string;
}
