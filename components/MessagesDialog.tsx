
import React, { useState } from 'react';
import { GameMessage, LeaderboardEntry } from '../types.ts';

interface MessagesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messages: GameMessage[];
  leaderboard: LeaderboardEntry[];
  fontSize: 'small' | 'medium' | 'large';
}

export const MessagesDialog: React.FC<MessagesDialogProps> = ({ isOpen, onClose, messages, leaderboard, fontSize }) => {
  const [activeTab, setActiveTab] = useState<'system' | 'combat' | 'top20'>('system');

  if (!isOpen) return null;

  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');
  const titleSize = fontSize === 'small' ? 'text-[11px]' : (fontSize === 'large' ? 'text-[16px]' : 'text-[13px]');
  const avatarSizeClass = fontSize === 'small' ? 'w-8 h-8 text-lg' : (fontSize === 'large' ? 'w-14 h-14 text-2xl' : 'w-10 h-10 text-xl');
  const btnPadding = fontSize === 'small' ? 'px-3 py-1' : (fontSize === 'large' ? 'px-5 py-3' : (fs => 'px-4 py-2'));

  const filteredMessages = messages.filter(msg => {
      if (activeTab === 'system') return !msg.category || msg.category === 'system';
      if (activeTab === 'combat') return msg.category === 'combat';
      return false;
  });

  const renderLeaderboard = () => {
      return (
          <div className="space-y-2">
              <div className="flex justify-between items-center px-4 py-2 border-b border-zinc-800 text-zinc-500 uppercase font-black text-[9px] tracking-widest">
                  <span>Pilot</span>
                  <span>Score</span>
              </div>
              {leaderboard.slice(0, 20).map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-zinc-900/40 border border-zinc-800 rounded hover:border-zinc-600 transition-colors">
                      <div className="flex items-center gap-3">
                          <div className="font-black text-zinc-600 text-lg w-6 text-center">{idx + 1}</div>
                          <div className="w-8 h-8 bg-zinc-950 border border-zinc-700 rounded flex items-center justify-center text-lg shadow-inner">
                              {entry.avatar}
                          </div>
                          <div className="flex flex-col">
                              <span className={`font-black uppercase text-white ${fontSize === 'large' ? 'text-[13px]' : 'text-[11px]'}`}>{entry.name}</span>
                              <span className="text-[8px] text-zinc-500">{new Date(entry.date).toLocaleDateString()}</span>
                          </div>
                      </div>
                      <div className="text-emerald-400 font-mono font-bold">{entry.score.toLocaleString()}</div>
                  </div>
              ))}
              {leaderboard.length === 0 && (
                  <div className="p-8 text-center text-zinc-600 uppercase font-black">No Data Available</div>
              )}
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[9500] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
        <div className="w-full max-w-2xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[80vh] shadow-2xl">
            <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 shrink-0">
                <span className={`retro-font ${titleSize} text-emerald-400 uppercase`}>Incoming Signals</span>
                <button onClick={onClose} className={`text-zinc-500 ${btnSize} uppercase font-black hover:text-white`}>DONE</button>
            </header>
            
            {/* TABS */}
            <div className="flex border-b border-zinc-800 shrink-0">
                <button 
                    onClick={() => setActiveTab('system')}
                    className={`flex-1 py-3 text-center font-black uppercase ${btnSize} transition-colors ${activeTab === 'system' ? 'bg-emerald-900/20 text-emerald-400 border-b-2 border-emerald-500' : 'bg-zinc-900/20 text-zinc-500 hover:text-zinc-300'}`}
                >
                    System
                </button>
                <button 
                    onClick={() => setActiveTab('combat')}
                    className={`flex-1 py-3 text-center font-black uppercase ${btnSize} transition-colors ${activeTab === 'combat' ? 'bg-emerald-900/20 text-emerald-400 border-b-2 border-emerald-500' : 'bg-zinc-900/20 text-zinc-500 hover:text-zinc-300'}`}
                >
                    Combat Logs
                </button>
                <button 
                    onClick={() => setActiveTab('top20')}
                    className={`flex-1 py-3 text-center font-black uppercase ${btnSize} transition-colors ${activeTab === 'top20' ? 'bg-emerald-900/20 text-emerald-400 border-b-2 border-emerald-500' : 'bg-zinc-900/20 text-zinc-500 hover:text-zinc-300'}`}
                >
                    Top 20 Aces
                </button>
            </div>

            <div className="flex-grow overflow-y-auto p-4 custom-scrollbar bg-black/40">
                {activeTab === 'top20' ? (
                    renderLeaderboard()
                ) : (
                    <div className="space-y-3">
                        {filteredMessages.length === 0 ? (
                            <div className="p-8 text-center text-zinc-600 uppercase font-black opacity-50">No signals intercepted</div>
                        ) : (
                            filteredMessages.map(msg => (
                                <div key={msg.id} className={`flex gap-4 p-3 border rounded-lg ${msg.category === 'combat' ? 'bg-red-900/10 border-red-900/30' : 'bg-zinc-900/40 border-zinc-800'}`}>
                                    <div className={`${avatarSizeClass} flex items-center justify-center bg-zinc-950 border border-zinc-700 rounded shadow-sm shrink-0`}>{msg.pilotAvatar}</div>
                                    <div className="flex-grow space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className={`font-black uppercase ${msg.category === 'combat' ? 'text-red-400' : 'text-emerald-500'} ${fontSize === 'large' ? 'text-[13px]' : (fontSize === 'medium' ? 'text-[11px]' : 'text-[10px]')}`}>{msg.pilotName}</span>
                                            <span className="text-[7px] text-zinc-600 font-mono">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <p className={`text-zinc-300 uppercase leading-snug ${fontSize === 'large' ? 'text-[15px]' : (fontSize === 'medium' ? 'text-[13px]' : 'text-[11px]')}`}>{msg.text}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
