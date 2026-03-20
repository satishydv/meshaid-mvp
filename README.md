# 🌐 MeshAid: Tactical Offline Emergency Network

🚨 A decentralized mesh network communication platform designed for emergency response and disaster resilience. MeshAid enables communities to maintain critical communications and coordinate response efforts when traditional infrastructure fails.

## Overview

MeshAid is a React-based web application that facilitates peer-to-peer messaging over mesh networks, allowing users to communicate, coordinate resources, and share critical information during emergencies without relying on centralized infrastructure.

### ⭐ Key Features

- 🔗 **Decentralized Messaging**: Direct peer-to-peer communication without servers
- 📢 **Priority-based Communication**: Multiple message types for different scenarios
  - 🆘 **SOS**: Critical distress signals
  - 🏥 **MEDICAL**: Healthcare and injury reports
  - 📦 **RESOURCE**: Resource availability and needs
  - ⚠️ **ALERT**: Emergency notifications
  - ℹ️ **INFO**: Information sharing
- 📍 **Geolocation Tracking**: GPS support with manual location input
- 🔍 **Peer Discovery**: Automatic node detection and management
- 📊 **Tactical Dashboard**: Real-time infrastructure monitoring
  - ⚡ Power grid status
  - 💧 Water supply levels
  - 📡 Communication relay health
  - 🏨 Medical logistics availability
- 🏥 **Nearby Facilities Mapping**: Emergency services, shelters, supply locations
- 🚫 **Offline Operation**: Works completely offline, no internet required
- 🕵️ **Anonymous Participation**: Random tactical nicknames for privacy

## 🛠️ Technical Stack

- ⚛️ **Framework**: React 19
- 📘 **Language**: TypeScript
- ⚡ **Build Tool**: Vite
- 📦 **Node.js Runtime**: Compatible with modern Node versions

## 🚀 Getting Started

### 📋 Prerequisites

- Node.js 16+
- npm or yarn

### 📥 Installation

```bash
# Clone the repository
git clone <repository-url>
cd meshaid

# Install dependencies
npm install
```

### 💻 Development

```bash
# Start development server
npm run dev

# The app will be available at http://localhost:5173
```

### 📦 Build for Production

```bash
# Create optimized build
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
meshaid/
├── App.tsx                 # Main application component
├── types.ts               # TypeScript type definitions
├── constants.tsx          # Configuration and mock data
├── services/
│   └── meshService.ts     # Mesh network logic and peer management
├── components/
│   ├── MessageItem.tsx    # Individual message display
│   └── TacticalButton.tsx # Custom UI button component
├── index.tsx              # React entry point
├── vite.config.ts         # Vite configuration
└── tsconfig.json          # TypeScript configuration
```

## 📝 Usage

### 💬 Sending Messages

1. **Select Message Type**: Choose the appropriate message category (SOS, MEDICAL, RESOURCE, ALERT, INFO)
2. **Enter Content**: Type your message in the input field
3. **Add Location** (Optional): Include your GPS location or manually enter location details
4. **Send**: Messages are automatically broadcast to all connected peers

### 📊 Dashboard Features

- **Sector Vitals**: Monitor critical infrastructure health metrics
- **Nearby Facilities**: View emergency services, shelters, and supply points in your area
- **Tactical Logs**: Track network synchronization and routing information
- **Peer Management**: See connected nodes and network status

## 📬 Message Types

| Type | Use Case | Priority |
|------|----------|----------|
| 🆘 SOS | Life-threatening emergencies | Critical |
| 🏥 MEDICAL | Injuries, medical needs, healthcare coordination | High |
| 📦 RESOURCE | Supply requests, availability, logistics | Medium |
| ⚠️ ALERT | Emergency notifications, warnings | High |
| ℹ️ INFO | General information sharing | Low |

## 🏗️ Architecture

### 🔌 Mesh Service

The `meshService` handles:
- Peer discovery and connection management
- Message routing and relay
- Geographic-aware peer grouping
- Message persistence and history

### 📨 Message Flow

Messages are propagated through the mesh network with:
- Automatic routing to connected peers
- Priority-based delivery
- Geographic awareness for local-first communication
- Timestamp and sender verification

## 🔐 Privacy & Security

- **Decentralized**: No central authority controls the network
- **Anonymous**: Users are identified by random tactical nicknames
- **Encryption-ready**: Infrastructure supports AES-256 rotation
- **Location Optional**: Geolocation sharing is optional and user-controlled

## 🔧 Development Notes

### ➕ Adding New Message Types

1. Add to `MessageType` enum in `types.ts`
2. Configure priority in `MESSAGE_CONFIG` in `constants.tsx`
3. Update `TacticalButton` component for UI representation

### 🔍 Extending Peer Discovery

Modify the peer discovery logic in `services/meshService.ts` to support additional network protocols or discovery mechanisms.

## 🗺️ Future Roadmap

- [ ] WebRTC peer-to-peer connections
- [ ] File sharing over mesh
- [ ] Advanced threat detection
- [ ] Multi-language support
- [ ] Mobile application
- [ ] Integration with emergency response systems

## 🤝 Contributing

Contributions are welcome! Please ensure:
- TypeScript strict mode compliance
- Proper type annotations
- Documented public APIs
- Test coverage for new features

## ⚖️ License

[Specify your license here]

## 💬 Support

For issues, feature requests, or questions, please open an issue in the repository.

---

**Note**: MeshAid is designed for emergency preparedness and resilience. While functional offline, network performance depends on available mesh infrastructure and peer connectivity.