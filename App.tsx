
import React, { useState, useEffect, useRef } from 'react';
import { meshService } from './services/meshService';
import { MeshMessage, MessageType, Peer, GeoLocation } from './types';
import { MESSAGE_CONFIG, MOCK_NICKNAMES, DUMMY_MESSAGES } from './constants';
import { MessageItem } from './components/MessageItem';

const App: React.FC = () => {
  const [messages, setMessages] = useState<MeshMessage[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [nickname, setNickname] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [inputText, setInputText] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [selectedType, setSelectedType] = useState<MessageType>(MessageType.INFO);
  const [myLocation, setMyLocation] = useState<GeoLocation | undefined>();
  const [isSending, setIsSending] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tactical Data for Sidebar
  const sectorVitals = [
    { label: 'POWER GRID', status: 'CRITICAL', value: 14, color: '#ff2e2e' },
    { label: 'WATER RESERVOIR', status: 'LOW', value: 38, color: '#fb923c' },
    { label: 'COMM RELAY', status: 'STABLE', value: 92, color: '#00f5a0' },
    { label: 'MED LOGISTICS', status: 'OPTIMAL', value: 85, color: '#3b82f6' },
  ];

  const nearbyFacilities = [
    { name: 'ST. JUDE MEDICAL CENTER', type: 'HOSPITAL', dist: '1.2km', status: 'ACTIVE' },
    { name: 'SEC 4 EMERGENCY SHELTER', type: 'SHELTER', dist: '0.5km', status: 'FULL' },
    { name: 'NORTH PLAZA SUPPLY', type: 'RESOURCES', dist: '2.8km', status: 'ACTIVE' },
  ];

  const tacticalLogs = [
    "SYNC: SEC-04 NODE HANDSHAKE OK",
    "GOSSIP: 14 PACKETS ROUTED VIA GHOST-1",
    "ENCR: AES-256 ROTATION COMPLETE",
    "SIGNAL: LATENCY NORMAL",
  ];

  useEffect(() => {
    const storedNickname = localStorage.getItem('meshaid_nick');
    if (storedNickname) {
      setNickname(storedNickname);
    } else {
      const randomNick = MOCK_NICKNAMES[Math.floor(Math.random() * MOCK_NICKNAMES.length)] + '-' + Math.floor(Math.random() * 999);
      setNickname(randomNick);
    }

    const storedMessages = localStorage.getItem('meshaid_msg_history');
    if (storedMessages) {
      try {
        setMessages(JSON.parse(storedMessages));
      } catch (e) { 
        setMessages(DUMMY_MESSAGES as MeshMessage[]);
      }
    } else {
      setMessages(DUMMY_MESSAGES as MeshMessage[]);
    }
  }, []);

  useEffect(() => {
    if (isInitialized) {
      meshService.init(nickname);
      localStorage.setItem('meshaid_nick', nickname);
      
      meshService.onMessage((msg) => {
        setMessages(prev => {
          const newMsgs = [msg, ...prev].slice(0, 100);
          localStorage.setItem('meshaid_msg_history', JSON.stringify(newMsgs));
          return newMsgs;
        });
      });

      meshService.onPeersChanged((newPeers) => {
        setPeers(newPeers);
      });

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => console.log("Location access denied")
        );
      }
    }
  }, [isInitialized, nickname]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    setIsSending(true);
    setTimeout(() => {
      meshService.sendMessage(selectedType, inputText, myLocation, manualLocation);
      setInputText('');
      setManualLocation('');
      setIsSending(false);
    }, 150);
  };

  const handleQuickSOS = () => {
    meshService.sendMessage(MessageType.SOS, "IMMEDIATE ASSISTANCE REQUIRED AT MY LOCATION", myLocation);
    setIsSidebarOpen(false);
  };

  const sortedMessages = [...messages].sort((a, b) => {
    if (a.type === MessageType.SOS && b.type !== MessageType.SOS) return -1;
    if (a.type !== MessageType.SOS && b.type === MessageType.SOS) return 1;
    return b.timestamp - a.timestamp;
  });

  const activeSOSCount = messages.filter(m => m.type === MessageType.SOS).length;
  const currentConfig = MESSAGE_CONFIG[selectedType];

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-grid overflow-hidden">
        <div className="scan-line"></div>
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
    <div className="h-screen flex flex-col md:flex-row bg-[#040508] overflow-hidden relative">
      <div className="scan-line"></div>
      
      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 w-[85%] sm:w-[300px] md:w-[420px] 
        transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1)
        border-r border-white/5 flex flex-col bg-[#08090d] backdrop-blur-3xl z-[70] md:z-20 shrink-0 shadow-[20px_0_60px_rgba(0,0,0,0.5)]
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
                <div className="text-3xl sm:text-4xl md:text-5xl heading text-blue-400 leading-none">{peers.filter(p => p.status === 'online').length}</div>
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

          {/* Vitals Feed */}
          <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/40 uppercase font-black tracking-widest">Sector_Telemetry</span>
              <span className="mono text-[8px] sm:text-[9px] text-white/20 font-bold uppercase">Grid_S04</span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl sm:rounded-2xl md:rounded-[2.5rem] p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6 tactical-border">
              {sectorVitals.map((vital, idx) => (
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
              {nearbyFacilities.map((fac, idx) => (
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

          {/* SOS Persistent Action */}
          <section className="pt-6 sm:pt-8 md:pt-10 sticky bottom-0 bg-gradient-to-t from-[#08090d] via-[#08090d] to-transparent pb-4 sm:pb-5 md:pb-6 mt-6 sm:mt-8 md:mt-10 z-20">
            <button onClick={handleQuickSOS} className="w-full py-4 sm:py-5 md:py-6 bg-transparent border-2 border-red-500/40 rounded-xl sm:rounded-2xl md:rounded-[2.5rem] text-red-500 heading text-2xl sm:text-3xl md:text-4xl flex items-center justify-center gap-3 sm:gap-4 md:gap-5 shadow-2xl shadow-red-500/20 group overflow-hidden active:scale-95 relative">
              <div className="absolute inset-0 bg-red-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
              <svg className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 fill-current relative z-10 group-hover:animate-bounce group-hover:fill-black transition-colors" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              <span className="relative z-10 tracking-wider sm:tracking-widest group-hover:text-black transition-colors">BROADCAST SOS</span>
            </button>
          </section>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-grow flex flex-col relative overflow-hidden h-full">
        {/* Header - Adaptive High Performance */}
        <header className="h-16 sm:h-20 md:h-24 border-b border-white/5 flex items-center justify-between px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 bg-[#08090d]/80 backdrop-blur-2xl shrink-0 z-40 relative">
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
          <div className="flex items-center gap-3 sm:gap-5 md:gap-10 shrink-0">
             <div className="flex flex-col items-end hidden sm:flex">
                <span className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/30 uppercase font-black tracking-widest mb-0.5 sm:mb-1">Position_Lock</span>
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                   <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full ${myLocation ? 'bg-[#00f5a0]' : 'bg-red-500'} animate-pulse shadow-[0_0_15px_currentColor]`}></div>
                   <span className="mono text-[10px] sm:text-xs md:text-sm text-white/90 font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] hidden md:inline">{myLocation ? 'GPS_LOCKED' : 'GPS_SEARCHING'}</span>
                </div>
             </div>
             <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#00f5a0]/10 transition-all group cursor-pointer shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 fill-white/40 group-hover:fill-[#00f5a0] transition-colors" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
             </div>
          </div>
        </header>

        {/* Message Feed Container */}
        <div className="flex-grow overflow-y-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-12 lg:p-16 custom-scroll" ref={scrollRef}>
          <div className={`max-w-4xl mx-auto space-y-6 sm:space-y-8 md:space-y-10 ${isMinimized ? 'pb-20 sm:pb-24' : 'pb-[20rem] sm:pb-[24rem] md:pb-[28rem]'} transition-all duration-700`}>
            {sortedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 sm:py-48 md:py-64 opacity-[0.05] group">
                <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 border-[4px] sm:border-[5px] md:border-[6px] border-dashed border-white rounded-full animate-spin-slow group-hover:border-[#00f5a0] transition-colors"></div>
                <h3 className="heading text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl text-center mt-6 sm:mt-8 md:mt-12 tracking-tighter">FREQUENCY_SCAN</h3>
              </div>
            ) : (
              sortedMessages.map((msg, idx) => (
                <div key={msg.id} className="slide-up">
                  <MessageItem message={msg} isNew={idx === 0} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* BROADCAST COMMAND PANEL - High Attraction Version */}
        <div className={`fixed md:absolute left-0 right-0 px-3 sm:px-4 md:px-6 lg:px-12 z-50 transition-all duration-700 ease-[cubic-bezier(0.16, 1, 0.3, 1)] ${isMinimized ? 'bottom-0 translate-y-2 sm:translate-y-3' : 'bottom-3 sm:bottom-4 md:bottom-6 lg:bottom-10'}`}>
          <div className={`max-w-5xl mx-auto glass-panel rounded-2xl sm:rounded-3xl border-white/10 shadow-[0_60px_150px_-30px_rgba(0,0,0,1)] relative overflow-hidden flex flex-col max-h-[50vh] sm:max-h-[45vh] ${isMinimized ? 'p-3 sm:p-4 rounded-b-none border-b-0' : 'p-4 sm:p-5 md:p-6'}`}>
            
            {!isMinimized && (
              <div 
                className="absolute inset-0 pointer-events-none transition-all duration-1000 opacity-[0.15]" 
                style={{ background: `radial-gradient(circle at 50% 120%, ${currentConfig.color}, transparent 70%)` }}
              ></div>
            )}

            {/* Menu Controls */}
            <div className={`flex items-center justify-between shrink-0 ${isMinimized ? '' : 'mb-3 sm:mb-4 md:mb-5'}`}>
              {!isMinimized ? (
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
              ) : (
                <div className="flex items-center gap-3 sm:gap-4 md:gap-6 px-2 sm:px-4 w-full min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 bg-white/10 rounded-full border border-white/20 shrink-0" style={{ borderColor: `${currentConfig.color}88` }}>
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" viewBox="0 0 24 24" style={{ fill: currentConfig.color }}>{currentConfig.icon}</svg>
                    <span className="mono text-[9px] sm:text-[10px] md:text-[11px] font-black text-white uppercase tracking-wider sm:tracking-widest hidden sm:inline">{selectedType}_PENDING</span>
                  </div>
                  {inputText.trim() && (
                    <span className="mono text-[10px] sm:text-xs text-white/30 truncate flex-grow italic tracking-wider">"{inputText.substring(0, 50)}..."</span>
                  )}
                </div>
              )}

              <button onClick={() => setIsMinimized(!isMinimized)} className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-2.5 rounded-full mono text-[9px] sm:text-[10px] md:text-[11px] font-black uppercase transition-all shrink-0 hover:scale-105 active:scale-95 ${isMinimized ? 'text-[#00f5a0] bg-[#00f5a0]/10 border border-[#00f5a0]/40' : 'text-white/40 border border-white/10 hover:text-white hover:bg-white/5'}`}>
                <span className="hidden sm:inline">{isMinimized ? 'EXPAND' : 'MIN'}</span>
                <span className="sm:hidden">{isMinimized ? '↑' : '↓'}</span>
                <svg className={`w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 fill-current transition-transform duration-500 ${isMinimized ? 'rotate-180' : ''}`} viewBox="0 0 24 24"><path d="M7 10l5 5 5-5H7z"/></svg>
              </button>
            </div>

            {/* Panel Body */}
            <div className={`grid transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) overflow-y-auto custom-scroll ${isMinimized ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100 flex-grow pr-2'}`}>
              <div className="overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3 sm:gap-4 md:gap-5 mt-1">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="relative group">
                      <div className="absolute -top-2 sm:-top-2.5 left-4 sm:left-6 md:left-8 px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 bg-[#06070a] border border-white/20 rounded-lg sm:rounded-xl mono text-[7px] sm:text-[8px] md:text-[9px] text-[#00f5a0] uppercase z-10 font-black shadow-2xl tracking-[0.15em] sm:tracking-[0.2em]">Transmission_Input</div>
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
                        className="w-full bg-white/[0.04] border border-white/10 p-3 sm:p-4 md:p-5 pt-8 sm:pt-9 md:pt-10 rounded-xl sm:rounded-2xl mono text-sm sm:text-base text-white focus:outline-none focus:ring-2 sm:focus:ring-4 transition-all resize-none h-16 sm:h-20 md:h-24 leading-relaxed shadow-inner font-medium placeholder-white/5"
                        style={{ borderColor: inputText.trim() ? `${currentConfig.color}99` : 'rgba(255,255,255,0.1)', ringColor: `${currentConfig.color}22` }}
                      />
                    </div>
                    <div className="relative group">
                      <div className="absolute -top-2 sm:-top-2.5 left-4 sm:left-6 md:left-8 px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 bg-[#06070a] border border-white/20 rounded-lg sm:rounded-xl mono text-[7px] sm:text-[8px] md:text-[9px] text-white/40 uppercase z-10 font-black shadow-2xl tracking-[0.15em] sm:tracking-[0.2em]">Spatial_Anchor</div>
                      <input
                        type="text"
                        value={manualLocation}
                        onChange={(e) => setManualLocation(e.target.value)}
                        placeholder="DEFINE SECTOR / LANDMARK / GRID LOC"
                        className="w-full bg-white/[0.04] border border-white/10 p-2.5 sm:p-3 pt-6 sm:pt-7 md:pt-8 px-4 sm:px-6 md:px-8 rounded-xl sm:rounded-2xl mono text-[10px] sm:text-xs text-white focus:outline-none focus:ring-2 sm:focus:ring-4 transition-all uppercase tracking-[0.3em] sm:tracking-[0.4em] font-black shadow-inner placeholder-white/5"
                        style={{ borderColor: manualLocation.trim() ? `${currentConfig.color}99` : 'rgba(255,255,255,0.1)', ringColor: `${currentConfig.color}22` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:gap-4">
                    <button 
                      onClick={handleSend}
                      disabled={!inputText.trim() || isSending}
                      className="flex-grow min-h-[50px] sm:min-h-[60px] md:min-h-[70px] rounded-xl sm:rounded-2xl font-black heading text-2xl sm:text-3xl md:text-4xl lg:text-5xl hover:brightness-125 active:scale-95 disabled:opacity-20 transition-all shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative group/send overflow-hidden"
                      style={{ backgroundColor: currentConfig.color, color: '#000', boxShadow: `0 30px 100px ${currentConfig.color}44` }}
                    >
                      <div className="absolute inset-0 bg-white/30 translate-y-full group-hover/send:translate-y-0 transition-transform duration-500"></div>
                      <span className="relative z-10 tracking-tighter">{isSending ? 'SYNC' : 'BROADCAST'}</span>
                    </button>
                    
                    <div className="bg-white/[0.03] border border-white/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col gap-2 sm:gap-3 shadow-2xl">
                      <div className="flex items-center justify-between">
                        <span className="mono text-[8px] sm:text-[9px] text-white/30 uppercase font-black tracking-widest">Mesh_Sync</span>
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
      </main>
    </div>
  );
};

export default App;
