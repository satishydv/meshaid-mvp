
import React from 'react';
import { MeshMessage, MessageType } from '../types';
import { MESSAGE_CONFIG } from '../constants';

interface MessageItemProps {
  message: MeshMessage;
  isNew?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, isNew }) => {
  const config = MESSAGE_CONFIG[message.type];
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isSOS = message.type === MessageType.SOS;
  const locationText = message.payload.manualLocation;
  const hasGps = !!message.payload.location;

  return (
    <div className={`relative mb-5 sm:mb-6 md:mb-8 transition-all duration-500 ${isNew ? 'animate-slide-up' : ''} group`}>
      {/* Dynamic Background Glow based on message type */}
      <div 
        className="absolute -inset-1 opacity-10 blur-2xl transition-all group-hover:opacity-20 pointer-events-none"
        style={{ backgroundColor: config.color }}
      ></div>

      <div className={`glass-panel p-4 sm:p-5 md:p-6 lg:p-7 rounded-xl sm:rounded-2xl border-l-[4px] sm:border-l-[5px] md:border-l-[6px] shadow-2xl relative overflow-hidden ${isSOS ? 'animate-pulse-sos border-[#ff2e2e]' : 'border-white/10'}`}
           style={{ borderLeftColor: !isSOS ? config.color : undefined }}>
        
        {/* Type Icon Backdrop */}
        <div className="absolute top-0 right-0 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 opacity-[0.03] -mr-6 sm:-mr-7 md:-mr-8 -mt-6 sm:-mt-7 md:-mt-8 pointer-events-none scale-150 rotate-12">
           <svg className="w-full h-full fill-current" viewBox="0 0 24 24" style={{ color: config.color }}>{config.icon}</svg>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0 mb-4 sm:mb-5 md:mb-6 relative z-10">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap">
            <div 
              className="flex items-center gap-2 sm:gap-3 mono font-black text-[10px] sm:text-[11px] md:text-[12px] uppercase px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 rounded-full border-2 transition-transform hover:scale-105 shrink-0" 
              style={{ backgroundColor: `${config.color}15`, color: config.color, borderColor: `${config.color}40` }}
            >
              <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 fill-current" viewBox="0 0 24 24">
                {config.icon}
              </svg>
              {config.label}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/30 uppercase tracking-wider sm:tracking-widest font-black">Transmission_Origin</span>
              <span className="mono text-xs sm:text-sm font-black text-white tracking-tight truncate">{message.sender}</span>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end shrink-0">
            <span className="mono text-[8px] sm:text-[9px] md:text-[10px] text-white/30 uppercase tracking-wider sm:tracking-widest font-black">Local_Time</span>
            <span className="mono text-[10px] sm:text-xs font-black text-white/60">{timeStr}</span>
          </div>
        </div>

        <div className="text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed text-white font-medium mb-4 sm:mb-5 md:mb-6 relative z-10 tracking-tight">
          {message.payload.text}
        </div>

        {/* Tactical Location Display */}
        {(locationText || hasGps) && (
          <div className="flex items-center gap-2 sm:gap-3 pt-4 sm:pt-5 md:pt-6 border-t border-white/5 relative z-10">
            <div className="px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 bg-white/[0.04] border border-white/10 rounded-xl sm:rounded-2xl flex items-center gap-3 sm:gap-4 group/loc transition-all hover:bg-white/[0.1] hover:border-white/30 min-w-0 flex-1">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 shadow-inner shrink-0">
                <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 fill-white/60 group-hover/loc:fill-[#00f5a0] transition-colors" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                   <span className="mono text-[8px] sm:text-[9px] text-white/40 uppercase font-black tracking-[0.2em] sm:tracking-[0.3em] leading-none">Spatial_Anchor</span>
                   {hasGps && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#00f5a0] shadow-[0_0_10px_#00f5a0] animate-pulse shrink-0"></div>}
                </div>
                <span className="mono text-xs sm:text-sm text-white font-black uppercase tracking-wider sm:tracking-wider mt-0.5 sm:mt-1 truncate">
                  {locationText || "GPS SIGNAL_ATTACHED"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Futuristic Corner Brackets */}
      <div className="absolute top-0 right-0 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
        <div className="absolute top-0 right-0 w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 border-t-2 border-r-2 border-white/20 group-hover:border-white/60"></div>
      </div>
      <div className="absolute bottom-0 left-0 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 border-b-2 border-l-2 border-white/20 group-hover:border-white/60"></div>
      </div>
    </div>
  );
};
