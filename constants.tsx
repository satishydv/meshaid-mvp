
import React from 'react';
import { MessageType } from './types';

export const MESSAGE_CONFIG = {
  [MessageType.SOS]: {
    label: 'SOS',
    color: '#ff2e2e',
    // Bold Exclamation Shield
    icon: <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v6h-2V7zm0 8h2v2h-2v-2z" />,
    priority: 5,
    description: 'Immediate danger to life'
  },
  [MessageType.MEDICAL]: {
    label: 'MEDICAL',
    color: '#3b82f6',
    // Medical Pulse/Heart
    icon: <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35zM11 8v3h-3v2h3v3h2v-3h3v-2h-3V8h-2z" />,
    priority: 4,
    description: 'Injuries or medical supply needs'
  },
  [MessageType.RESOURCE]: {
    label: 'RESOURCE',
    color: '#00f5a0', // Tactical Green
    // Supply Box / Cube
    icon: <path d="M21 16.5c0 .38-.21.71-.53.88l-7.97 4.44c-.31.17-.69.17-1 0L3.53 17.38c-.32-.17-.53-.5-.53-.88V7.5c0-.38.21-.71.53-.88l7.97-4.44c.31-.17.69-.17 1 0l7.97 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15z" />,
    priority: 3,
    description: 'Food, water, or shelter'
  },
  [MessageType.ALERT]: {
    label: 'ALERT',
    color: '#fb923c', // Tactical Orange
    // Megaphone / Broadcast
    icon: <path d="M20 12l-8 8-1.5-1.5L16.5 12 10.5 6 12 4.5l8 7.5zM4 11h4l2 2H4v-2zm0-4h6l2 2H4V7zm0 8h2l2 2H4v-2z" />,
    priority: 2,
    description: 'Environmental danger/evacuation'
  },
  [MessageType.INFO]: {
    label: 'INFO',
    color: '#6366f1', // Tactical Indigo
    // Terminal/Code Info
    icon: <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 14H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V8h12v2z" />,
    priority: 1,
    description: 'General information sharing'
  },
};

export const MOCK_NICKNAMES = ['Ghost-1', 'Rescue-Prime', 'Watchman', 'Sector-7', 'Alpha-Six', 'Beacon', 'Sentry', 'Outpost-Delta'];

export const DUMMY_MESSAGES = [
  {
    id: 'dummy-1',
    type: MessageType.SOS,
    sender: 'Ghost-1',
    senderId: 'peer-ghost-1',
    timestamp: Date.now() - 1000 * 60 * 5,
    priority: 5,
    payload: {
      text: "CRITICAL: Structure collapse near Sector 7 Bridge. 3 civilians trapped. Heavy lifting gear required immediately.",
      manualLocation: "SECTOR 7 BRIDGE / NORTH CROSSING",
      location: { lat: 34.0522, lng: -118.2437 }
    }
  },
  {
    id: 'dummy-2',
    type: MessageType.MEDICAL,
    sender: 'Rescue-Prime',
    senderId: 'peer-rescue-prime',
    timestamp: Date.now() - 1000 * 60 * 12,
    priority: 4,
    payload: {
      text: "Medical triage established at High School Gym. We need insulin and clean bandages.",
      manualLocation: "CENTRAL HIGH GYMNASIUM"
    }
  },
  {
    id: 'dummy-3',
    type: MessageType.ALERT,
    sender: 'Watchman',
    senderId: 'peer-watchman',
    timestamp: Date.now() - 1000 * 60 * 20,
    priority: 2,
    payload: {
      text: "ALERT: Water levels rising rapidly. Evacuate to higher ground. Flood expected in 30m.",
      manualLocation: "RIVERFRONT DISTRICT",
      location: { lat: 34.0622, lng: -118.2537 }
    }
  }
];
