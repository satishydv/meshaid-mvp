
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { meshService } from './services/meshService';
import { MeshMessage, MessageType, Peer, GeoLocation, MessageChannel } from './types';
import { MESSAGE_CONFIG, MOCK_NICKNAMES, DUMMY_MESSAGES } from './constants';
import { MessageItem } from './components/MessageItem';

type SectorVital = {
  label: string;
  status: string;
  value: number;
  color: string;
};

type Facility = {
  name: string;
  type: string;
  dist: string;
  status: string;
};

const SECTOR_VITALS: SectorVital[] = [
  { label: 'POWER GRID', status: 'CRITICAL', value: 14, color: '#ff2e2e' },
  { label: 'WATER RESERVOIR', status: 'LOW', value: 38, color: '#fb923c' },
  { label: 'COMM RELAY', status: 'STABLE', value: 92, color: '#00f5a0' },
  { label: 'MED LOGISTICS', status: 'OPTIMAL', value: 85, color: '#3b82f6' },
];

const NEARBY_FACILITIES: Facility[] = [
  { name: 'ST. JUDE MEDICAL CENTER', type: 'HOSPITAL', dist: '1.2km', status: 'ACTIVE' },
  { name: 'SEC 4 EMERGENCY SHELTER', type: 'SHELTER', dist: '0.5km', status: 'FULL' },
  { name: 'NORTH PLAZA SUPPLY', type: 'RESOURCES', dist: '2.8km', status: 'ACTIVE' },
];

type AppMode = 'demo' | 'live';
const MODE_STORAGE_KEY = 'meshaid_mode';
const MESSAGE_HISTORY_KEY = 'meshaid_msg_history';
const CHANNEL_STORAGE_KEY = 'meshaid_active_channel';
const FULFILLED_STORAGE_KEY = 'meshaid_fulfilled_message_ids_v1';
const ADMIN_SESSION_KEY = 'meshaid_admin_session_v1';
const LIVE_SECTOR_STORAGE_KEY = 'meshaid_live_sector_vitals_v1';
const LIVE_FACILITY_STORAGE_KEY = 'meshaid_live_facilities_v1';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin@123';

type ChannelMeta = {
  id: MessageChannel;
  label: string;
  chip: string;
};

const CHANNELS: ChannelMeta[] = [
  { id: MessageChannel.GENERAL, label: 'PUBLIC BROADCAST', chip: 'GENERAL' },
  { id: MessageChannel.MEDICAL, label: 'MEDICAL ASSIST', chip: 'MEDICAL' },
  { id: MessageChannel.LOGISTICS, label: 'RESOURCE HUB', chip: 'LOGISTICS' },
  { id: MessageChannel.EVACUATION, label: 'EVACUATION GRID', chip: 'EVAC' },
];

const formatLocationAnchor = (location: GeoLocation) => {
  const lat = location.lat.toFixed(5);
  const lng = location.lng.toFixed(5);
  if (typeof location.accuracy === 'number' && Number.isFinite(location.accuracy)) {
    return `${lat}, ${lng} (${Math.round(location.accuracy)}m)`;
  }
  return `${lat}, ${lng}`;
};

const escapeCsvValue = (value: string | number | boolean | null | undefined) => {
  const normalized = String(value ?? '');
  if (!/[",\n]/.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '""')}"`;
};

const normalizeSectorVitals = (raw: unknown): SectorVital[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Partial<SectorVital> => !!item && typeof item === 'object')
    .map((item) => ({
      label: String(item.label ?? '').toUpperCase().trim(),
      status: String(item.status ?? '').toUpperCase().trim(),
      value: Math.max(0, Math.min(100, Number(item.value ?? 0))),
      color: String(item.color ?? '#00f5a0').trim() || '#00f5a0',
    }))
    .filter((item) => !!item.label);
};

const normalizeFacilities = (raw: unknown): Facility[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Partial<Facility> => !!item && typeof item === 'object')
    .map((item) => ({
      name: String(item.name ?? '').toUpperCase().trim(),
      type: String(item.type ?? '').toUpperCase().trim(),
      dist: String(item.dist ?? '').trim(),
      status: String(item.status ?? '').toUpperCase().trim(),
    }))
    .filter((item) => !!item.name);
};

const App: React.FC = () => {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  const isAdminRoute = normalizedPath === '/admin';
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const storedTheme = localStorage.getItem('meshaid_theme');
    return storedTheme === 'light' ? 'light' : 'dark';
  });
  const [appMode, setAppMode] = useState<AppMode>(() => {
    const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
    return storedMode === 'live' ? 'live' : 'demo';
  });
  const [messages, setMessages] = useState<MeshMessage[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [nickname, setNickname] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [inputText, setInputText] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [selectedType, setSelectedType] = useState<MessageType>(MessageType.INFO);
  const [myLocation, setMyLocation] = useState<GeoLocation | undefined>();
  const [isSending, setIsSending] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<MessageChannel>(() => {
    const stored = localStorage.getItem(CHANNEL_STORAGE_KEY) as MessageChannel | null;
    if (stored && Object.values(MessageChannel).includes(stored)) {
      return stored;
    }
    return MessageChannel.GENERAL;
  });
  const [fulfilledMessageIds, setFulfilledMessageIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(FULFILLED_STORAGE_KEY);
    if (!stored) return new Set<string>();
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) return new Set<string>();
      return new Set(parsed.filter((item): item is string => typeof item === 'string'));
    } catch {
      return new Set<string>();
    }
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
  });
  const [adminUsernameInput, setAdminUsernameInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [adminMessages, setAdminMessages] = useState<MeshMessage[]>([]);
  const [adminSectorVitals, setAdminSectorVitals] = useState<SectorVital[]>(() => {
    const stored = localStorage.getItem(LIVE_SECTOR_STORAGE_KEY);
    if (!stored) return [];
    try {
      return normalizeSectorVitals(JSON.parse(stored));
    } catch {
      return [];
    }
  });
  const [adminFacilities, setAdminFacilities] = useState<Facility[]>(() => {
    const stored = localStorage.getItem(LIVE_FACILITY_STORAGE_KEY);
    if (!stored) return [];
    try {
      return normalizeFacilities(JSON.parse(stored));
    } catch {
      return [];
    }
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const locationWatchIdRef = useRef<number | null>(null);
  const locationEditedRef = useRef(false);

  const isDummyMessage = useCallback((msg: MeshMessage) => msg.id.startsWith('dummy-'), []);
  const normalizeMessageChannel = useCallback((msg: MeshMessage): MeshMessage => {
    if (msg.channel && Object.values(MessageChannel).includes(msg.channel)) {
      return msg;
    }
    return {
      ...msg,
      channel: MessageChannel.GENERAL,
    };
  }, []);

  const loadStoredMessages = useCallback((): MeshMessage[] => {
    const storedMessages = localStorage.getItem(MESSAGE_HISTORY_KEY);
    if (!storedMessages) return [];
    try {
      const parsed = JSON.parse(storedMessages) as MeshMessage[];
      return parsed
        .map((msg) => normalizeMessageChannel(msg))
        .filter((msg) => !msg.id.startsWith('dummy-'));
    } catch (e) {
      return [];
    }
  }, [normalizeMessageChannel]);

  const getModeSeedMessages = useCallback((mode: AppMode): MeshMessage[] => {
    const storedRealMessages = loadStoredMessages();
    if (mode === 'live') {
      return storedRealMessages;
    }
    const dedupe = new Set(storedRealMessages.map((msg) => msg.id));
    const demoOnlyMessages = (DUMMY_MESSAGES as MeshMessage[])
      .map((msg) => normalizeMessageChannel(msg))
      .filter((msg) => !dedupe.has(msg.id));
    return [...demoOnlyMessages, ...storedRealMessages];
  }, [loadStoredMessages, normalizeMessageChannel]);

  useEffect(() => {
    const storedNickname = localStorage.getItem('meshaid_nick');
    if (storedNickname) {
      setNickname(storedNickname);
    } else {
      const randomNick = MOCK_NICKNAMES[Math.floor(Math.random() * MOCK_NICKNAMES.length)] + '-' + Math.floor(Math.random() * 999);
      setNickname(randomNick);
    }
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    if (!('geolocation' in navigator)) return;

    const handlePosition = (pos: GeolocationPosition) => {
      const lockedLocation: GeoLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      setMyLocation(lockedLocation);
      if (!locationEditedRef.current) {
        setManualLocation(formatLocationAnchor(lockedLocation));
      }
    };

    const handleLocationError = () => {
      console.log('Location access denied or unavailable');
    };

    navigator.geolocation.getCurrentPosition(handlePosition, handleLocationError, {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 10000,
    });

    locationWatchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleLocationError, {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 20000,
    });

    return () => {
      if (locationWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }
    };
  }, [isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute) return;
    setMessages(getModeSeedMessages(appMode));
    localStorage.setItem(MODE_STORAGE_KEY, appMode);
  }, [appMode, getModeSeedMessages, isAdminRoute]);

  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light');
    localStorage.setItem('meshaid_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(CHANNEL_STORAGE_KEY, activeChannel);
  }, [activeChannel]);

  useEffect(() => {
    localStorage.setItem(FULFILLED_STORAGE_KEY, JSON.stringify(Array.from(fulfilledMessageIds)));
  }, [fulfilledMessageIds]);

  useEffect(() => {
    localStorage.setItem(LIVE_SECTOR_STORAGE_KEY, JSON.stringify(adminSectorVitals));
  }, [adminSectorVitals]);

  useEffect(() => {
    localStorage.setItem(LIVE_FACILITY_STORAGE_KEY, JSON.stringify(adminFacilities));
  }, [adminFacilities]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === FULFILLED_STORAGE_KEY) {
        if (!event.newValue) {
          setFulfilledMessageIds(new Set<string>());
          return;
        }
        try {
          const parsed = JSON.parse(event.newValue) as unknown;
          if (!Array.isArray(parsed)) return;
          setFulfilledMessageIds(new Set(parsed.filter((item): item is string => typeof item === 'string')));
        } catch {
          // Ignore malformed storage payload.
        }
        return;
      }

      if (event.key === LIVE_SECTOR_STORAGE_KEY && event.newValue) {
        try {
          setAdminSectorVitals(normalizeSectorVitals(JSON.parse(event.newValue)));
        } catch {
          // Ignore malformed storage payload.
        }
        return;
      }

      if (event.key === LIVE_FACILITY_STORAGE_KEY && event.newValue) {
        try {
          setAdminFacilities(normalizeFacilities(JSON.parse(event.newValue)));
        } catch {
          // Ignore malformed storage payload.
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    if (isInitialized) {
      meshService.init(nickname);
      localStorage.setItem('meshaid_nick', nickname);
      
      const unsubscribeMessages = meshService.onMessage((msg) => {
        const normalizedMsg = normalizeMessageChannel(msg);
        setMessages(prev => {
          const dedupedPrev = prev.filter((existing) => existing.id !== normalizedMsg.id);
          const newMsgs = [normalizedMsg, ...dedupedPrev].slice(0, 100);
          const persistable = newMsgs.filter((item) => !isDummyMessage(item));
          localStorage.setItem(MESSAGE_HISTORY_KEY, JSON.stringify(persistable));
          return newMsgs;
        });
      });

      const unsubscribePeers = meshService.onPeersChanged((newPeers) => {
        setPeers(newPeers);
      });

      return () => {
        unsubscribeMessages();
        unsubscribePeers();
      };
    }
  }, [isAdminRoute, isInitialized, nickname, isDummyMessage, normalizeMessageChannel]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    setIsSending(true);
    setTimeout(() => {
      try {
        const locationText = manualLocation.trim() || (myLocation ? formatLocationAnchor(myLocation) : '');
        meshService.sendMessage(selectedType, inputText, myLocation, locationText, activeChannel);
        setInputText('');
        if (myLocation) {
          locationEditedRef.current = false;
          setManualLocation(formatLocationAnchor(myLocation));
        } else {
          setManualLocation('');
        }
      } catch (error) {
        console.error('Failed to send message:', error);
      } finally {
        setIsSending(false);
      }
    }, 150);
  }, [inputText, selectedType, myLocation, manualLocation, activeChannel]);

  const loadLiveMessagesSnapshot = useCallback((): MeshMessage[] => {
    const raw = localStorage.getItem(MESSAGE_HISTORY_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as MeshMessage[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((msg) => normalizeMessageChannel(msg))
        .filter((msg) => !isDummyMessage(msg))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }, [isDummyMessage, normalizeMessageChannel]);

  useEffect(() => {
    if (!isAdminRoute) return;
    const refresh = () => {
      setAdminMessages(loadLiveMessagesSnapshot());
    };
    refresh();
    const intervalId = window.setInterval(refresh, 2000);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === MESSAGE_HISTORY_KEY) {
        refresh();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', handleStorage);
    };
  }, [isAdminRoute, loadLiveMessagesSnapshot]);

  const pendingAdminMessages = useMemo(() => {
    return adminMessages.filter((msg) => !fulfilledMessageIds.has(msg.id));
  }, [adminMessages, fulfilledMessageIds]);

  const markMessageFulfilled = useCallback((messageId: string) => {
    setFulfilledMessageIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
  }, []);

  const exportLiveMessagesCsv = useCallback(() => {
    const headers = [
      'id',
      'timestamp',
      'channel',
      'type',
      'sender',
      'text',
      'spatial_anchor',
      'gps_lat',
      'gps_lng',
      'status',
    ];
    const rows = adminMessages.map((msg) => [
      msg.id,
      new Date(msg.timestamp).toISOString(),
      msg.channel,
      msg.type,
      msg.sender,
      msg.payload.text,
      msg.payload.manualLocation ?? '',
      msg.payload.location?.lat ?? '',
      msg.payload.location?.lng ?? '',
      fulfilledMessageIds.has(msg.id) ? 'fulfilled' : 'pending',
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvValue(cell)).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meshaid-live-messages-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [adminMessages, fulfilledMessageIds]);

  const visibleMessages = useMemo(() => {
    const channelMessages = messages.filter((message) => message.channel === activeChannel);
    if (appMode !== 'live') return channelMessages;
    return channelMessages.filter((message) => !fulfilledMessageIds.has(message.id));
  }, [messages, activeChannel, appMode, fulfilledMessageIds]);

  const sortedMessages = useMemo(() => {
    return [...visibleMessages].sort((a, b) => {
      if (a.type === MessageType.SOS && b.type !== MessageType.SOS) return -1;
      if (a.type !== MessageType.SOS && b.type === MessageType.SOS) return 1;
      return b.timestamp - a.timestamp;
    });
  }, [visibleMessages]);

  const activeSOSCount = useMemo(
    () => messages.filter(m => m.type === MessageType.SOS).length,
    [messages]
  );
  const onlinePeersCount = useMemo(
    () => peers.filter(p => p.status === 'online').length,
    [peers]
  );
  const channelStats = useMemo(() => {
    return CHANNELS.map((channel) => {
      const channelMessages = messages.filter((message) => message.channel === channel.id);
      const criticalCount = channelMessages.filter(
        (message) => message.type === MessageType.SOS || message.type === MessageType.ALERT
      ).length;
      return {
        ...channel,
        total: channelMessages.length,
        critical: criticalCount,
      };
    });
  }, [messages]);
  const effectiveSectorVitals = useMemo(() => {
    if (appMode === 'live' && adminSectorVitals.length > 0) {
      return adminSectorVitals;
    }
    return SECTOR_VITALS;
  }, [appMode, adminSectorVitals]);

  const effectiveFacilities = useMemo(() => {
    if (appMode === 'live' && adminFacilities.length > 0) {
      return adminFacilities;
    }
    return NEARBY_FACILITIES;
  }, [appMode, adminFacilities]);

  const hasLiveIntelPanels = appMode === 'live' && (adminSectorVitals.length > 0 || adminFacilities.length > 0);
  const currentConfig = MESSAGE_CONFIG[selectedType];
  const isLightTheme = theme === 'light';

  const updateSectorVital = useCallback((index: number, patch: Partial<SectorVital>) => {
    setAdminSectorVitals((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }, []);

  const updateFacility = useCallback((index: number, patch: Partial<Facility>) => {
    setAdminFacilities((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }, []);
  const handleAdminLogin = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (adminUsernameInput === ADMIN_USERNAME && adminPasswordInput === ADMIN_PASSWORD) {
        setIsAdminAuthenticated(true);
        sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
        setAdminAuthError('');
        setAdminPasswordInput('');
        return;
      }
      setAdminAuthError('Invalid credentials');
    },
    [adminPasswordInput, adminUsernameInput]
  );
  const handleAdminLogout = useCallback(() => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }, []);

  if (isAdminRoute) {
    if (!isAdminAuthenticated) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-grid overflow-hidden relative app-shell">
          <div className="scan-line"></div>
          <button
            type="button"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            className="theme-toggle absolute right-4 top-4 sm:right-6 sm:top-6 z-20"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
              {theme === 'dark' ? (
                <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM1 13h3v-2H1v2zm10-9h2V1h-2v3zm7.45 1.46l1.41-1.41-1.79-1.8-1.42 1.42 1.8 1.79zM17.24 19.16l1.8 1.79 1.41-1.41-1.79-1.8-1.42 1.42zM20 11v2h3v-2h-3zM11 20h2v3h-2v-3zM4.96 19.95l1.79-1.8-1.41-1.41-1.8 1.79 1.42 1.42zM12 6a6 6 0 100 12 6 6 0 000-12z" />
              ) : (
                <path d="M12.1 2.53A9 9 0 1021.47 13 7.5 7.5 0 0112.1 2.53z" />
              )}
            </svg>
            <span className="mono text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
              {theme === 'dark' ? 'LIGHT' : 'DARK'}
            </span>
          </button>
          <form onSubmit={handleAdminLogin} className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-2xl border border-white/10">
            <h1 className="heading text-5xl sm:text-6xl text-gradient tracking-tight">ADMIN</h1>
            <p className="mono text-[10px] sm:text-xs uppercase text-white/50 tracking-[0.2em] mt-2">Live Control Console</p>
            <div className="space-y-4 mt-6">
              <input
                type="text"
                value={adminUsernameInput}
                onChange={(event) => setAdminUsernameInput(event.target.value)}
                placeholder="USERNAME"
                className="w-full bg-white/[0.05] border border-white/10 p-3 sm:p-4 rounded-xl mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00f5a0]/40 uppercase"
                autoComplete="username"
              />
              <input
                type="password"
                value={adminPasswordInput}
                onChange={(event) => setAdminPasswordInput(event.target.value)}
                placeholder="PASSWORD"
                className="w-full bg-white/[0.05] border border-white/10 p-3 sm:p-4 rounded-xl mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00f5a0]/40"
                autoComplete="current-password"
              />
              {adminAuthError && <p className="mono text-xs text-red-400 font-black uppercase">{adminAuthError}</p>}
              <button
                type="submit"
                className="w-full py-3 sm:py-4 bg-gradient-to-r from-[#00f5a0] to-[#00d9ff] text-black heading text-2xl rounded-xl hover:brightness-110 transition-all shadow-2xl shadow-[#00f5a0]/30"
              >
                ACCESS DASHBOARD
              </button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <div className="min-h-screen app-shell text-white p-4 sm:p-6 md:p-8 bg-grid">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
          <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="heading text-4xl sm:text-5xl text-gradient tracking-tight">Admin Dashboard</h1>
              <p className="mono text-[10px] sm:text-xs uppercase text-white/50 tracking-[0.2em]">Live Mode Requests Only</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                className="theme-toggle"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
                  {theme === 'dark' ? (
                    <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM1 13h3v-2H1v2zm10-9h2V1h-2v3zm7.45 1.46l1.41-1.41-1.79-1.8-1.42 1.42 1.8 1.79zM17.24 19.16l1.8 1.79 1.41-1.41-1.79-1.8-1.42 1.42zM20 11v2h3v-2h-3zM11 20h2v3h-2v-3zM4.96 19.95l1.79-1.8-1.41-1.41-1.8 1.79 1.42 1.42zM12 6a6 6 0 100 12 6 6 0 000-12z" />
                  ) : (
                    <path d="M12.1 2.53A9 9 0 1021.47 13 7.5 7.5 0 0112.1 2.53z" />
                  )}
                </svg>
                <span className="mono text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                  {theme === 'dark' ? 'LIGHT' : 'DARK'}
                </span>
              </button>
              <button
                type="button"
                onClick={exportLiveMessagesCsv}
                className="px-4 py-2 rounded-xl mono text-xs font-black uppercase tracking-wide bg-[#00f5a0] text-black hover:brightness-110 transition-all"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/';
                }}
                className="px-4 py-2 rounded-xl mono text-xs font-black uppercase tracking-wide border border-white/20 text-white/80 hover:bg-white/10 transition-all"
              >
                Back To App
              </button>
              <button
                type="button"
                onClick={handleAdminLogout}
                className="px-4 py-2 rounded-xl mono text-xs font-black uppercase tracking-wide border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-all"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="glass-card rounded-2xl p-4 border border-white/10">
              <p className="mono text-[10px] uppercase text-white/40 font-black">Pending Requests</p>
              <p className="heading text-4xl text-[#00f5a0] leading-none mt-1">{pendingAdminMessages.length}</p>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-white/10">
              <p className="mono text-[10px] uppercase text-white/40 font-black">Fulfilled</p>
              <p className="heading text-4xl text-blue-400 leading-none mt-1">
                {Math.max(adminMessages.length - pendingAdminMessages.length, 0)}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-white/10">
              <p className="mono text-[10px] uppercase text-white/40 font-black">Total Live Messages</p>
              <p className="heading text-4xl text-white leading-none mt-1">{adminMessages.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
            <div className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="mono text-[10px] sm:text-xs uppercase text-white/50 tracking-[0.2em]">Sector Telemetry (Live)</p>
                <button
                  type="button"
                  onClick={() => setAdminSectorVitals((prev) => [...prev, { label: 'NEW SECTOR', status: 'STABLE', value: 50, color: '#00f5a0' }])}
                  className="px-3 py-1.5 rounded-lg mono text-[10px] font-black uppercase bg-[#00f5a0]/20 text-[#00f5a0] border border-[#00f5a0]/40"
                >
                  Add Row
                </button>
              </div>
              <div className="space-y-2 max-h-[38vh] overflow-y-auto custom-scroll pr-1">
                {adminSectorVitals.length === 0 ? (
                  <p className="mono text-xs uppercase text-white/40 py-2">No live telemetry configured</p>
                ) : (
                  adminSectorVitals.map((item, index) => (
                    <div key={`sv-${index}`} className="grid grid-cols-12 gap-2 items-center bg-white/[0.03] border border-white/10 rounded-xl p-2">
                      <input
                        value={item.label}
                        onChange={(event) => updateSectorVital(index, { label: event.target.value.toUpperCase() })}
                        placeholder="Label"
                        className="col-span-4 bg-transparent border border-white/10 rounded-lg px-2 py-1.5 mono text-[10px] uppercase text-white"
                      />
                      <input
                        value={item.status}
                        onChange={(event) => updateSectorVital(index, { status: event.target.value.toUpperCase() })}
                        placeholder="Status"
                        className="col-span-3 bg-transparent border border-white/10 rounded-lg px-2 py-1.5 mono text-[10px] uppercase text-white"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={item.value}
                        onChange={(event) => updateSectorVital(index, { value: Math.max(0, Math.min(100, Number(event.target.value || 0))) })}
                        className="col-span-2 bg-transparent border border-white/10 rounded-lg px-2 py-1.5 mono text-[10px] uppercase text-white"
                      />
                      <input
                        type="color"
                        value={item.color}
                        onChange={(event) => updateSectorVital(index, { color: event.target.value })}
                        className="col-span-2 h-8 w-full bg-transparent border border-white/10 rounded-lg px-1"
                      />
                      <button
                        type="button"
                        onClick={() => setAdminSectorVitals((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                        className="col-span-1 rounded-lg border border-red-500/40 text-red-300 mono text-[10px] font-black uppercase py-1.5 hover:bg-red-500/10"
                      >
                        X
                      </button>
                    </div>
                  ))
                )}
              </div>
              <p className="mono text-[9px] uppercase text-white/35">Updates are auto-saved and visible in live mode sidebar.</p>
            </div>

            <div className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="mono text-[10px] sm:text-xs uppercase text-white/50 tracking-[0.2em]">Facility Manifest (Live)</p>
                <button
                  type="button"
                  onClick={() => setAdminFacilities((prev) => [...prev, { name: 'NEW FACILITY', type: 'SHELTER', dist: '0.0km', status: 'ACTIVE' }])}
                  className="px-3 py-1.5 rounded-lg mono text-[10px] font-black uppercase bg-[#00f5a0]/20 text-[#00f5a0] border border-[#00f5a0]/40"
                >
                  Add Row
                </button>
              </div>
              <div className="space-y-2 max-h-[38vh] overflow-y-auto custom-scroll pr-1">
                {adminFacilities.length === 0 ? (
                  <p className="mono text-xs uppercase text-white/40 py-2">No live facilities configured</p>
                ) : (
                  adminFacilities.map((item, index) => (
                    <div key={`fac-${index}`} className="grid grid-cols-12 gap-2 items-center bg-white/[0.03] border border-white/10 rounded-xl p-2">
                      <input
                        value={item.name}
                        onChange={(event) => updateFacility(index, { name: event.target.value.toUpperCase() })}
                        placeholder="Name"
                        className="col-span-4 bg-transparent border border-white/10 rounded-lg px-2 py-1.5 mono text-[10px] uppercase text-white"
                      />
                      <input
                        value={item.type}
                        onChange={(event) => updateFacility(index, { type: event.target.value.toUpperCase() })}
                        placeholder="Type"
                        className="col-span-2 bg-transparent border border-white/10 rounded-lg px-2 py-1.5 mono text-[10px] uppercase text-white"
                      />
                      <input
                        value={item.dist}
                        onChange={(event) => updateFacility(index, { dist: event.target.value })}
                        placeholder="Dist"
                        className="col-span-2 bg-transparent border border-white/10 rounded-lg px-2 py-1.5 mono text-[10px] uppercase text-white"
                      />
                      <input
                        value={item.status}
                        onChange={(event) => updateFacility(index, { status: event.target.value.toUpperCase() })}
                        placeholder="Status"
                        className="col-span-3 bg-transparent border border-white/10 rounded-lg px-2 py-1.5 mono text-[10px] uppercase text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setAdminFacilities((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                        className="col-span-1 rounded-lg border border-red-500/40 text-red-300 mono text-[10px] font-black uppercase py-1.5 hover:bg-red-500/10"
                      >
                        X
                      </button>
                    </div>
                  ))
                )}
              </div>
              <p className="mono text-[9px] uppercase text-white/35">Updates are auto-saved and visible in live mode sidebar.</p>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-white/10">
              <p className="mono text-[10px] sm:text-xs uppercase text-white/50 tracking-[0.2em]">Open Requests</p>
            </div>
            <div className="max-h-[62vh] overflow-y-auto custom-scroll divide-y divide-white/5">
              {pendingAdminMessages.length === 0 ? (
                <div className="p-6 sm:p-8 text-center">
                  <p className="mono text-sm uppercase text-white/40 font-black">No pending live requests</p>
                </div>
              ) : (
                pendingAdminMessages.map((message) => (
                  <div key={message.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mono text-[10px] uppercase font-black px-2 py-1 rounded bg-white/10 text-white/80">{message.type}</span>
                        <span className="mono text-[10px] uppercase font-black px-2 py-1 rounded bg-[#00f5a0]/15 text-[#00f5a0]">{message.channel}</span>
                        <span className="mono text-[10px] uppercase text-white/40">
                          {new Date(message.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="mono text-xs sm:text-sm uppercase text-white/70 mt-2">FROM: {message.sender}</p>
                      <p className="text-sm sm:text-base text-white mt-2 break-words">{message.payload.text}</p>
                      {(message.payload.manualLocation || message.payload.location) && (
                        <p className="mono text-[10px] sm:text-xs uppercase text-white/50 mt-2 tracking-wide">
                          Spatial_Anchor: {message.payload.manualLocation || 'GPS SIGNAL_ATTACHED'}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => markMessageFulfilled(message.id)}
                      className="px-4 py-2 rounded-xl mono text-xs font-black uppercase tracking-wide bg-blue-500/20 border border-blue-400/40 text-blue-300 hover:bg-blue-500/30 transition-all shrink-0"
                    >
                      Mark Fulfilled
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-grid overflow-hidden relative">
        <div className="scan-line"></div>
        <button
          type="button"
          onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          className="theme-toggle absolute right-4 top-4 sm:right-6 sm:top-6 z-20"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
            {theme === 'dark' ? (
              <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM1 13h3v-2H1v2zm10-9h2V1h-2v3zm7.45 1.46l1.41-1.41-1.79-1.8-1.42 1.42 1.8 1.79zM17.24 19.16l1.8 1.79 1.41-1.41-1.79-1.8-1.42 1.42zM20 11v2h3v-2h-3zM11 20h2v3h-2v-3zM4.96 19.95l1.79-1.8-1.41-1.41-1.8 1.79 1.42 1.42zM12 6a6 6 0 100 12 6 6 0 000-12z" />
            ) : (
              <path d="M12.1 2.53A9 9 0 1021.47 13 7.5 7.5 0 0112.1 2.53z" />
            )}
          </svg>
          <span className="mono text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
            {theme === 'dark' ? 'LIGHT' : 'DARK'}
          </span>
        </button>
        <div className="max-w-md w-full glass-panel p-6 sm:p-8 md:p-10 shadow-2xl relative overflow-hidden rounded-2xl sm:rounded-3xl border-white/10">
          <div className="absolute top-0 right-0 w-32 h-32 sm:w-64 sm:h-64 bg-gradient-to-br from-[#00f5a0] to-[#00d9ff] opacity-10 blur-3xl -mr-10 sm:-mr-20 -mt-10 sm:-mt-20"></div>
          <div className="flex flex-col items-center mb-6 sm:mb-8 md:mb-10">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[#00f5a0] to-[#00d9ff] flex items-center justify-center rounded-xl sm:rounded-2xl mb-6 sm:mb-8 shadow-2xl shadow-[#00f5a0]/30 border border-white/20">
              <svg className="w-8 h-8 sm:w-12 sm:h-12 fill-black" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
            </div>
            <h1 className="heading text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white mb-2 tracking-tighter text-gradient leading-none">MESHAID</h1>
            <p className="mono text-[10px] sm:text-[11px] md:text-[12px] text-white/50 font-bold uppercase tracking-[0.3em] sm:tracking-[0.4em]">Tactical Response Node</p>
          </div>
          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <label className="mono text-[9px] sm:text-[10px] text-white/40 uppercase block px-1 font-black">Callsign Selection</label>
              <input 
                type="text" 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 p-3 sm:p-4 md:p-5 mono text-sm sm:text-base text-white rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00f5a0]/40 transition-all placeholder-white/10 uppercase"
                placeholder="INPUT CALLSIGN..."
              />
            </div>
            <button 
              onClick={() => setIsInitialized(true)}
              className="w-full py-3 sm:py-4 md:py-5 bg-gradient-to-r from-[#00f5a0] to-[#00d9ff] text-black heading text-xl sm:text-2xl md:text-3xl rounded-xl sm:rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-2xl shadow-[#00f5a0]/30"
            >
              INITIALIZE TACTICAL LINK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col md:flex-row app-shell overflow-hidden relative">
      <div className="scan-line"></div>
      
      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 app-overlay backdrop-blur-md z-[60] md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 w-[85%] sm:w-[300px] md:w-[420px] 
        transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1)
        border-r border-white/5 flex flex-col sidebar-shell z-[70] md:z-20 shrink-0 shadow-[20px_0_60px_rgba(0,0,0,0.5)]
      `}>
        <div className="p-4 sm:p-6 md:p-8 pb-3 sm:pb-4 flex justify-between items-start">
          <div className="group">
            <h2 className="heading text-4xl sm:text-5xl md:text-6xl text-gradient leading-none tracking-tighter group-hover:brightness-125 transition-all">MESHAID</h2>
            <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-3">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#00f5a0] animate-pulse shadow-[0_0_12px_#00f5a0]"></span>
              <span className="mono text-[9px] sm:text-[10px] md:text-[11px] text-[#00f5a0] uppercase tracking-[0.15em] sm:tracking-[0.2em] font-black truncate">NODE: {nickname}</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 sm:p-3 bg-white/5 rounded-lg sm:rounded-xl border border-white/10 text-white/40">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto px-4 sm:px-5 md:px-6 space-y-5 sm:space-y-6 md:space-y-8 custom-scroll pb-8 sm:pb-10 pt-2 sm:pt-4">
          
          {/* Node Profile */}
          <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/40 uppercase font-black tracking-widest">Diagnostic_Node</span>
              <div className="h-1 flex-grow mx-2 sm:mx-4 bg-white/5 rounded-full relative overflow-hidden">
                <div className="absolute inset-0 bg-[#00f5a0]/40 w-1/3 animate-[scanner_3s_infinite]"></div>
              </div>
            </div>
            <div className="glass-panel p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-[1.5rem] md:rounded-[2rem] relative overflow-hidden border border-white/5 bg-gradient-to-br from-white/[0.04] to-transparent">
              <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-[#00f5a0]/20 to-[#00d9ff]/20 flex items-center justify-center rounded-xl sm:rounded-2xl border border-white/10 shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 fill-[#00f5a0]" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                </div>
                <div className="flex-grow min-w-0">
                  <div className="mono text-[8px] sm:text-[9px] text-white/30 uppercase font-black mb-0.5 sm:mb-1">Local_Callsign</div>
                  <div className="text-white font-black text-base sm:text-lg md:text-xl lg:text-2xl leading-none truncate w-full tracking-tighter">{nickname}</div>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Stats */}
          <section className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
            <div className="glass-card p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-[1.5rem] md:rounded-[1.8rem] bg-gradient-to-b from-blue-500/5 to-transparent">
              <div className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/30 uppercase mb-1 sm:mb-2 font-black">Network_Peers</div>
              <div className="flex items-baseline gap-1 sm:gap-2">
                <div className="text-3xl sm:text-4xl md:text-5xl heading text-blue-400 leading-none">{onlinePeersCount}</div>
                <div className="mono text-[8px] sm:text-[9px] md:text-[10px] text-blue-400/50 font-black">UP</div>
              </div>
            </div>
            <div className="glass-card p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-[1.5rem] md:rounded-[1.8rem] bg-gradient-to-b from-red-500/5 to-transparent">
              <div className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/30 uppercase mb-1 sm:mb-2 font-black">Crisis_Alerts</div>
              <div className="flex items-baseline gap-1 sm:gap-2">
                <div className={`text-3xl sm:text-4xl md:text-5xl heading leading-none ${activeSOSCount > 0 ? 'text-red-500' : 'text-white'}`}>{activeSOSCount}</div>
                <div className={`mono text-[8px] sm:text-[9px] md:text-[10px] font-black ${activeSOSCount > 0 ? 'text-red-500/50' : 'text-white/20'}`}>SOS</div>
              </div>
            </div>
          </section>

          <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/40 uppercase font-black tracking-widest">Active_Channels</span>
              <span className="mono text-[8px] sm:text-[9px] text-[#00f5a0] font-bold uppercase">Live</span>
            </div>
            <div className="space-y-2 sm:space-y-3">
              {channelStats.map((channel) => {
                const isActive = activeChannel === channel.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setActiveChannel(channel.id)}
                    className={`w-full text-left p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${
                      isActive
                        ? isLightTheme
                          ? 'bg-[#e6eefc] border-[#7aa2ff] shadow-[0_10px_24px_rgba(51,102,204,0.18)]'
                          : 'bg-[#0f1f3f] border-[#3b82f6]/50 shadow-[0_12px_30px_rgba(20,80,255,0.2)]'
                        : isLightTheme
                          ? 'bg-[#cfd8e3]/20 border-[#8a97ab]/25 hover:bg-[#cfd8e3]/35'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`mono text-[10px] sm:text-xs font-black uppercase tracking-tight ${isLightTheme ? 'text-[#1a2538]' : 'text-white'}`}>{channel.label}</span>
                      {channel.critical > 0 ? (
                        <span className="mono text-[8px] sm:text-[9px] font-black uppercase px-2 sm:px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/40">
                          {channel.critical} Critical
                        </span>
                      ) : (
                        <span className="mono text-[8px] sm:text-[9px] font-black uppercase px-2 sm:px-2.5 py-1 rounded-full bg-white/5 text-white/40 border border-white/10">
                          {channel.chip}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 sm:mt-3 flex items-center justify-between">
                      <span className={`mono text-[9px] sm:text-[10px] uppercase font-bold tracking-widest ${isLightTheme ? 'text-[#5f6d82]' : 'text-white/40'}`}>
                        Messages {channel.total}
                      </span>
                      <span className={`mono text-[10px] font-black uppercase ${
                        isActive ? 'text-[#00d78f]' : isLightTheme ? 'text-[#7a8799]' : 'text-white/30'
                      }`}>
                        {isActive ? 'Open' : 'Join'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {appMode === 'demo' ? (
            <>
              {/* Vitals Feed */}
              <section className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between px-1">
                  <span className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/40 uppercase font-black tracking-widest">Sector_Telemetry</span>
                  <span className="mono text-[8px] sm:text-[9px] text-white/20 font-bold uppercase">Grid_S04</span>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl sm:rounded-2xl md:rounded-[2.5rem] p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6 tactical-border">
                  {effectiveSectorVitals.map((vital, idx) => (
                    <div key={idx} className="space-y-2 sm:space-y-3">
                      <div className="flex justify-between items-center mono text-[9px] sm:text-[10px] md:text-[11px]">
                        <span className="text-white/70 font-black tracking-tight uppercase truncate pr-2">{vital.label}</span>
                        <span style={{ color: vital.color }} className="font-black text-[8px] sm:text-[9px] md:text-[10px] tracking-widest shrink-0">{vital.status}</span>
                      </div>
                      <div className="h-1.5 sm:h-2 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
                        <div className="h-full rounded-full transition-all duration-1000 shadow-[0_0_15px_currentColor]" style={{ width: `${vital.value}%`, backgroundColor: vital.color }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Infrastructure */}
              <section className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between px-1">
                  <span className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/40 uppercase font-black tracking-widest">Facility_Manifest</span>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {effectiveFacilities.map((fac, idx) => (
                    <div key={idx} className="group p-3 sm:p-4 bg-white/[0.02] border border-white/5 rounded-xl sm:rounded-2xl flex items-center justify-between hover:bg-white/5 transition-all cursor-default">
                      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-white/5 rounded-lg sm:rounded-xl flex items-center justify-center mono text-[10px] sm:text-xs text-white/40 font-black shrink-0">
                          {fac.type[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mono text-[8px] sm:text-[9px] text-white/20 uppercase font-black mb-0.5 sm:mb-1">{fac.type}</div>
                          <div className="mono text-[10px] sm:text-xs text-white font-black tracking-tight truncate">{fac.name}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="mono text-[9px] sm:text-[10px] text-white/40 font-bold mb-0.5 sm:mb-1">{fac.dist}</div>
                        <div className={`mono text-[8px] sm:text-[9px] font-black tracking-widest ${fac.status === 'ACTIVE' ? 'text-[#00f5a0]' : 'text-red-500'}`}>{fac.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between px-1">
                  <span className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/40 uppercase font-black tracking-widest">Live_Operations</span>
                  <span className="mono text-[8px] sm:text-[9px] text-[#00f5a0] font-bold uppercase">Realtime</span>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl sm:rounded-2xl md:rounded-[2.5rem] p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between mono text-[10px] sm:text-[11px] uppercase">
                    <span className="text-white/40 font-black">Total_Messages</span>
                    <span className="text-white font-black">{messages.length}</span>
                  </div>
                  <div className="flex items-center justify-between mono text-[10px] sm:text-[11px] uppercase">
                    <span className="text-white/40 font-black">Active_Alerts</span>
                    <span className={`font-black ${activeSOSCount > 0 ? 'text-red-500' : 'text-white'}`}>{activeSOSCount}</span>
                  </div>
                  <div className="flex items-center justify-between mono text-[10px] sm:text-[11px] uppercase">
                    <span className="text-white/40 font-black">Online_Peers</span>
                    <span className="text-blue-400 font-black">{onlinePeersCount}</span>
                  </div>
                </div>
              </section>

              {hasLiveIntelPanels && (
                <>
                  {adminSectorVitals.length > 0 && (
                    <section className="space-y-3 sm:space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <span className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/40 uppercase font-black tracking-widest">Sector_Telemetry</span>
                        <span className="mono text-[8px] sm:text-[9px] text-white/20 font-bold uppercase">Grid_S04</span>
                      </div>
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl sm:rounded-2xl md:rounded-[2.5rem] p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6 tactical-border">
                        {effectiveSectorVitals.map((vital, idx) => (
                          <div key={idx} className="space-y-2 sm:space-y-3">
                            <div className="flex justify-between items-center mono text-[9px] sm:text-[10px] md:text-[11px]">
                              <span className="text-white/70 font-black tracking-tight uppercase truncate pr-2">{vital.label}</span>
                              <span style={{ color: vital.color }} className="font-black text-[8px] sm:text-[9px] md:text-[10px] tracking-widest shrink-0">{vital.status}</span>
                            </div>
                            <div className="h-1.5 sm:h-2 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
                              <div className="h-full rounded-full transition-all duration-1000 shadow-[0_0_15px_currentColor]" style={{ width: `${vital.value}%`, backgroundColor: vital.color }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {adminFacilities.length > 0 && (
                    <section className="space-y-3 sm:space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <span className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/40 uppercase font-black tracking-widest">Facility_Manifest</span>
                      </div>
                      <div className="space-y-2 sm:space-y-3">
                        {effectiveFacilities.map((fac, idx) => (
                          <div key={idx} className="group p-3 sm:p-4 bg-white/[0.02] border border-white/5 rounded-xl sm:rounded-2xl flex items-center justify-between hover:bg-white/5 transition-all cursor-default">
                            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
                              <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-white/5 rounded-lg sm:rounded-xl flex items-center justify-center mono text-[10px] sm:text-xs text-white/40 font-black shrink-0">
                                {fac.type[0]}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mono text-[8px] sm:text-[9px] text-white/20 uppercase font-black mb-0.5 sm:mb-1">{fac.type}</div>
                                <div className="mono text-[10px] sm:text-xs text-white font-black tracking-tight truncate">{fac.name}</div>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <div className="mono text-[9px] sm:text-[10px] text-white/40 font-bold mb-0.5 sm:mb-1">{fac.dist}</div>
                              <div className={`mono text-[8px] sm:text-[9px] font-black tracking-widest ${fac.status === 'ACTIVE' ? 'text-[#00f5a0]' : 'text-red-500'}`}>{fac.status}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}

        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-grow flex flex-col relative overflow-hidden h-full">
        {/* Header - Adaptive High Performance */}
        <header className="h-16 sm:h-20 md:h-24 border-b border-white/5 flex items-center justify-between px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 header-shell shrink-0 z-40 relative">
          <div className="flex items-center gap-3 sm:gap-6 md:gap-12 min-w-0 flex-1">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 sm:p-2.5 md:p-3 text-[#00f5a0] bg-[#00f5a0]/10 rounded-xl sm:rounded-2xl border border-[#00f5a0]/30 shadow-2xl shadow-[#00f5a0]/10 transition-all hover:bg-[#00f5a0]/20 shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 fill-current" viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            </button>
            <div className="flex flex-col min-w-0">
              <span className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/30 uppercase tracking-[0.3em] sm:tracking-[0.4em] font-black mb-0.5 sm:mb-1">Network_Bandwidth</span>
              <span className="text-white font-black text-sm sm:text-base md:text-lg lg:text-xl tracking-tight uppercase flex items-center gap-2 sm:gap-3 md:gap-4">
                 <span className="truncate">SEC-04-PRI-MESH</span>
                 <span className="h-3 sm:h-4 w-px bg-white/20 shrink-0"></span>
                 <span className="mono text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px] text-[#00f5a0] font-black shrink-0 hidden sm:inline">ENCRYPTED_LINK_002</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 shrink-0">
             <button
               type="button"
               onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
               className="theme-toggle"
               aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
             >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
                  {theme === 'dark' ? (
                    <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM1 13h3v-2H1v2zm10-9h2V1h-2v3zm7.45 1.46l1.41-1.41-1.79-1.8-1.42 1.42 1.8 1.79zM17.24 19.16l1.8 1.79 1.41-1.41-1.79-1.8-1.42 1.42zM20 11v2h3v-2h-3zM11 20h2v3h-2v-3zM4.96 19.95l1.79-1.8-1.41-1.41-1.8 1.79 1.42 1.42zM12 6a6 6 0 100 12 6 6 0 000-12z" />
                  ) : (
                    <path d="M12.1 2.53A9 9 0 1021.47 13 7.5 7.5 0 0112.1 2.53z" />
                  )}
                </svg>
                <span className="mono text-[9px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-wider">
                  {theme === 'dark' ? 'LIGHT' : 'DARK'}
                </span>
             </button>
             <div className="flex flex-col items-end hidden sm:flex">
                <span className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/30 uppercase font-black tracking-widest mb-0.5 sm:mb-1">Position_Lock</span>
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                   <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full ${myLocation ? 'bg-[#00f5a0]' : 'bg-red-500'} animate-pulse shadow-[0_0_15px_currentColor]`}></div>
                   <span className="mono text-[10px] sm:text-xs md:text-sm text-white/90 font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] hidden md:inline">{myLocation ? 'GPS_LOCKED' : 'GPS_SEARCHING'}</span>
                </div>
             </div>
             <div className="hidden md:flex items-center">
               <span className={`mono text-[10px] uppercase font-black tracking-[0.2em] ${appMode === 'demo' ? 'text-amber-400/80' : 'text-[#00f5a0]'}`}>
                 {appMode === 'demo' ? 'MODE_DEMO' : 'MODE_LIVE'}
               </span>
             </div>
             <div className="relative" ref={modeMenuRef}>
               <button
                 type="button"
                 onClick={() => setIsModeMenuOpen((prev) => !prev)}
                 className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl border flex items-center justify-center transition-all group cursor-pointer shrink-0 ${
                   isLightTheme
                     ? 'bg-white/70 border-[#0811241f] hover:bg-emerald-100/70'
                     : 'bg-white/5 border-white/10 hover:bg-[#00f5a0]/10'
                 }`}
                 aria-label="Open mode menu"
                 aria-haspopup="menu"
                 aria-expanded={isModeMenuOpen}
               >
                  <svg className={`w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 transition-colors ${isLightTheme ? 'fill-[#22314b]/70 group-hover:fill-[#0f7f5e]' : 'fill-white/40 group-hover:fill-[#00f5a0]'}`} viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
               </button>
               {isModeMenuOpen && (
                 <div className={`absolute right-0 mt-2 w-44 rounded-xl p-1.5 shadow-2xl z-[80] ${
                   isLightTheme
                     ? 'bg-white/95 border border-[#0811241f]'
                     : 'bg-[#0b111a]/95 border border-white/10'
                 }`} role="menu">
                   <button
                     type="button"
                     onClick={() => {
                       setAppMode('demo');
                       setIsModeMenuOpen(false);
                     }}
                     className={`w-full text-left px-3 py-2.5 rounded-lg mono text-[11px] font-black uppercase tracking-[0.12em] transition-all ${
                       appMode === 'demo'
                         ? isLightTheme
                           ? 'bg-amber-400/25 text-amber-900'
                           : 'bg-amber-400/20 text-amber-300'
                         : isLightTheme
                           ? 'text-[#22314b]/80 hover:bg-[#0811240f] hover:text-[#081124]'
                           : 'text-white/70 hover:bg-white/10 hover:text-white'
                     }`}
                     role="menuitem"
                   >
                     Demo Mode
                   </button>
                   <button
                     type="button"
                     onClick={() => {
                       setAppMode('live');
                       setIsModeMenuOpen(false);
                     }}
                     className={`w-full text-left px-3 py-2.5 rounded-lg mono text-[11px] font-black uppercase tracking-[0.12em] transition-all ${
                       appMode === 'live'
                         ? isLightTheme
                           ? 'bg-emerald-300/35 text-emerald-900'
                           : 'bg-[#00f5a0]/20 text-[#00f5a0]'
                         : isLightTheme
                           ? 'text-[#22314b]/80 hover:bg-[#0811240f] hover:text-[#081124]'
                           : 'text-white/70 hover:bg-white/10 hover:text-white'
                     }`}
                     role="menuitem"
                   >
                     Live Mode
                   </button>
                 </div>
               )}
             </div>
          </div>
        </header>

        {/* Message Feed Container */}
        <div className="flex-grow overflow-y-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-12 lg:p-16 custom-scroll" ref={scrollRef}>
          <div className={`max-w-4xl mx-auto space-y-6 sm:space-y-8 md:space-y-10 ${isComposerOpen ? 'pb-[20rem] sm:pb-[24rem] md:pb-[28rem]' : 'pb-20 sm:pb-24'} transition-all duration-700`}>
            {sortedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 sm:py-48 md:py-64 opacity-[0.05] group">
                <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 border-[4px] sm:border-[5px] md:border-[6px] border-dashed border-white rounded-full animate-spin-slow group-hover:border-[#00f5a0] transition-colors"></div>
                <h3 className="heading text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl text-center mt-6 sm:mt-8 md:mt-12 tracking-tighter">FREQUENCY_SCAN</h3>
                <p className="mono text-[10px] sm:text-xs uppercase tracking-[0.2em] mt-3 text-white/50">
                  {activeChannel.toUpperCase()} CHANNEL
                </p>
              </div>
            ) : (
              sortedMessages.map((msg, idx) => (
                <div key={msg.id} className="slide-up message-card">
                  <MessageItem message={msg} isNew={idx === 0} />
                </div>
              ))
            )}
          </div>
        </div>

        {!isComposerOpen && (
          <button
            onClick={() => setIsComposerOpen(true)}
            className="fixed md:absolute bottom-4 sm:bottom-6 md:bottom-8 right-4 sm:right-6 md:right-8 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#00f5a0] text-black shadow-[0_15px_40px_rgba(0,245,160,0.35)] flex items-center justify-center border border-black/10 hover:brightness-105 active:scale-95 transition-all"
            aria-label="Open message composer"
            title="Open message composer"
          >
            <svg className="w-7 h-7 sm:w-8 sm:h-8 fill-current" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
            </svg>
          </button>
        )}

        {/* BROADCAST COMMAND PANEL - High Attraction Version */}
        {isComposerOpen && (
          <div className="fixed md:absolute left-0 right-0 px-3 sm:px-4 md:px-6 lg:px-12 z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] bottom-3 sm:bottom-4 md:bottom-6 lg:bottom-10">
            <div className={`max-w-5xl mx-auto glass-panel compose-panel rounded-2xl sm:rounded-3xl border-white/10 shadow-[0_60px_150px_-30px_rgba(0,0,0,1)] relative overflow-hidden flex flex-col ${isLightTheme ? 'max-h-[40vh] sm:max-h-[38vh] p-3 sm:p-4 md:p-4' : 'max-h-[50vh] sm:max-h-[45vh] p-4 sm:p-5 md:p-6'}`}>
              <div
                className={`absolute inset-0 pointer-events-none transition-all duration-1000 ${isLightTheme ? 'opacity-[0.05]' : 'opacity-[0.15]'}`}
                style={{ background: `radial-gradient(circle at 50% 120%, ${currentConfig.color}, transparent 70%)` }}
              ></div>

              {/* Menu Controls */}
              <div className="flex items-center justify-between shrink-0 mb-3 sm:mb-4 md:mb-5">
                <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-2.5 lg:gap-3 max-w-[75%] sm:max-w-[80%]">
                  {(Object.keys(MESSAGE_CONFIG) as MessageType[]).map((type) => {
                    const cfg = MESSAGE_CONFIG[type];
                    const isActive = selectedType === type;
                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 lg:px-5 py-1.5 sm:py-2 rounded-full mono text-[8px] sm:text-[9px] md:text-[10px] lg:text-[12px] font-black border-2 transition-all duration-300 transform group/type ${
                          isActive
                            ? 'bg-white text-black scale-110 shadow-[0_0_40px_rgba(255,255,255,0.3)] z-10'
                            : 'bg-white/5 text-white/30 border-white/10 hover:bg-white/10 hover:scale-105 hover:text-white'
                        }`}
                        style={isActive ? { borderColor: cfg.color, color: cfg.color } : {}}
                      >
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 fill-current group-hover/type:animate-pulse" viewBox="0 0 24 24">{cfg.icon}</svg>
                        <span className={isActive ? 'block' : 'hidden sm:block'}>{type}</span>
                      </button>
                    );
                  })}
                </div>

                <button onClick={() => setIsComposerOpen(false)} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-2.5 rounded-full mono text-[9px] sm:text-[10px] md:text-[11px] font-black uppercase transition-all shrink-0 hover:scale-105 active:scale-95 text-white/40 border border-white/10 hover:text-white hover:bg-white/5">
                  <span>CLOSE</span>
                  <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 fill-current" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
              </div>

              {/* Panel Body */}
              <div className="grid transition-all duration-500 cubic-bezier(0.16,1,0.3,1) overflow-y-auto custom-scroll grid-rows-[1fr] opacity-100 flex-grow pr-2">
                <div className="overflow-hidden">
                  <div className={`grid grid-cols-1 lg:grid-cols-[1fr_280px] ${isLightTheme ? 'gap-2.5 sm:gap-3 md:gap-4' : 'gap-3 sm:gap-4 md:gap-5'} mt-1`}>
                    <div className={isLightTheme ? 'space-y-2.5 sm:space-y-3' : 'space-y-3 sm:space-y-4'}>
                      <div className="relative group">
                        <div className="absolute -top-2 sm:-top-2.5 left-4 sm:left-6 md:left-8 px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 bg-[#06070a] border border-white/20 rounded-lg sm:rounded-xl mono text-[7px] sm:text-[8px] md:text-[9px] text-[#00f5a0] uppercase z-10 font-black shadow-2xl tracking-[0.15em] sm:tracking-[0.2em] compose-label-chip">Transmission_Input</div>
                        <textarea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                          placeholder={`Compiling ${selectedType} data for tactical broadcast...`}
                          className={`w-full bg-white/[0.04] border border-white/10 p-3 sm:p-4 md:p-5 pt-8 sm:pt-9 md:pt-10 rounded-xl sm:rounded-2xl mono text-sm sm:text-base text-white focus:outline-none focus:ring-2 sm:focus:ring-4 transition-all resize-none leading-relaxed shadow-inner font-medium placeholder-white/5 compose-field ${isLightTheme ? 'h-14 sm:h-[4.1rem] md:h-[4.5rem]' : 'h-16 sm:h-20 md:h-24'}`}
                          style={{ borderColor: inputText.trim() ? `${currentConfig.color}99` : 'rgba(255,255,255,0.1)', ringColor: `${currentConfig.color}22` }}
                        />
                      </div>
                      <div className="relative group">
                        <div className="absolute -top-2 sm:-top-2.5 left-4 sm:left-6 md:left-8 px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 bg-[#06070a] border border-white/20 rounded-lg sm:rounded-xl mono text-[7px] sm:text-[8px] md:text-[9px] text-white/40 uppercase z-10 font-black shadow-2xl tracking-[0.15em] sm:tracking-[0.2em] compose-label-chip">Spatial_Anchor</div>
                        <input
                          type="text"
                          value={manualLocation}
                          onChange={(e) => {
                            locationEditedRef.current = true;
                            setManualLocation(e.target.value);
                          }}
                          placeholder="DEFINE SECTOR / LANDMARK / GRID LOC"
                          className={`w-full bg-white/[0.04] border border-white/10 p-2.5 sm:p-3 pt-6 sm:pt-7 md:pt-8 px-4 sm:px-6 md:px-8 rounded-xl sm:rounded-2xl mono text-[10px] sm:text-xs text-white focus:outline-none focus:ring-2 sm:focus:ring-4 transition-all uppercase tracking-[0.3em] sm:tracking-[0.4em] font-black shadow-inner placeholder-white/5 compose-field ${isLightTheme ? 'h-12 sm:h-14 md:h-[3.6rem]' : ''}`}
                          style={{ borderColor: manualLocation.trim() ? `${currentConfig.color}99` : 'rgba(255,255,255,0.1)', ringColor: `${currentConfig.color}22` }}
                        />
                      </div>
                    </div>

                    <div className={isLightTheme ? 'flex flex-col gap-2.5 sm:gap-3' : 'flex flex-col gap-3 sm:gap-4'}>
                      <button
                        onClick={handleSend}
                        disabled={!inputText.trim() || isSending}
                        className={`flex-grow rounded-xl sm:rounded-2xl font-black heading hover:brightness-125 active:scale-95 disabled:opacity-20 transition-all shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative group/send overflow-hidden compose-send-btn ${isLightTheme ? 'min-h-[44px] sm:min-h-[52px] md:min-h-[58px] text-xl sm:text-2xl md:text-[2rem]' : 'min-h-[50px] sm:min-h-[60px] md:min-h-[70px] text-2xl sm:text-3xl md:text-4xl lg:text-5xl'}`}
                        style={{ backgroundColor: currentConfig.color, color: '#000', boxShadow: `0 30px 100px ${currentConfig.color}44` }}
                      >
                        <div className="absolute inset-0 bg-white/30 translate-y-full group-hover/send:translate-y-0 transition-transform duration-500"></div>
                        <span className="relative z-10 tracking-tighter">{isSending ? 'SYNC' : 'BROADCAST'}</span>
                      </button>

                      <div className={`bg-white/[0.03] border border-white/10 rounded-xl sm:rounded-2xl flex flex-col gap-2 sm:gap-3 shadow-2xl compose-sidecard ${isLightTheme ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4'}`}>
                        <div className="flex items-center justify-between">
                          <span className="mono text-[8px] sm:text-[9px] text-white/30 uppercase font-black tracking-widest">Mesh_Sync</span>
                          <span className="mono text-[8px] sm:text-[9px] text-[#00f5a0] uppercase font-black tracking-widest">
                            {activeChannel}
                          </span>
                          <div className="flex gap-0.5 sm:gap-1 h-4 sm:h-5 items-end">
                            {[1,2,3,4,5,6].map(i => <div key={i} className={`w-1 sm:w-1.5 bg-[#00f5a0] rounded-full ${i === 6 ? 'h-full' : 'h-2/3'} animate-pulse`} style={{ animationDelay: `${i*100}ms` }}></div>)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${myLocation ? 'bg-[#00f5a0]' : 'bg-red-500'} animate-pulse shadow-[0_0_15px_currentColor]`}></div>
                          <div className="flex flex-col">
                            <span className="mono text-[9px] sm:text-[10px] md:text-[11px] text-white font-black uppercase tracking-wider sm:tracking-widest leading-none">{myLocation ? 'GPS_LOCKED' : 'GPS_LOST'}</span>
                            <span className="mono text-[7px] sm:text-[8px] text-white/20 uppercase font-bold mt-0.5 sm:mt-1">Encrypted P2P Link</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-4 md:mt-5 pt-3 sm:pt-4 border-t border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] mono text-white/20 shrink-0">
                    <div className="flex flex-wrap gap-4 sm:gap-6 md:gap-8">
                      <span className="font-black flex items-center gap-1.5 sm:gap-2">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#00f5a0]/40"></span>
                        <span className="hidden sm:inline">P2P_LINK_SECURE</span>
                        <span className="sm:hidden">P2P_SECURE</span>
                      </span>
                      <span className="font-black flex items-center gap-1.5 sm:gap-2">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500/40"></span>
                        <span className="hidden sm:inline">AES_512_TACTICAL</span>
                        <span className="sm:hidden">AES_512</span>
                      </span>
                    </div>
                    <span className="italic animate-pulse tracking-wider sm:tracking-widest uppercase text-[7px] sm:text-[8px] md:text-[9px] text-[#00f5a0]/40 hidden sm:inline">Broadcasting via decentralized mesh...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
