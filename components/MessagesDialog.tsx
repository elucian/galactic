
import React from 'react';
import { GameMessage } from '../types.ts';

interface MessagesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messages: GameMessage[];
  fontSize: 'small' | 'medium' | 'large';
}

export const MessagesDialog: React.FC<MessagesDialogProps> = ({ isOpen, onClose, messages, fontSize }) => {
  if (!isOpen) return null;

  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');
  const avatarSizeClass = fontSize === 'small' ? 'w-10 h-10 text-xl' : (fontSize === 'large' ? 'w-16 h-16 text-3xl' : 'w-12 h-12 text-2xl');

  return (
    <div className="fixed inset-0 z-[9500] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
        <div className="w-full max-w-2xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[80vh] shadow-2xl">
            <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 shrink-0">
                <span className={`retro-font ${btnSize} text-emerald-400 uppercase`}>Incoming Signals</span>
                <button onClick={onClose} className={`text-zinc-500 ${btnSize} uppercase font-black`}>DONE</button>
            </header>
            <div className="flex-grow overflow-y-auto p-4 custom-scrollbar space-y-3 bg-black/40">
                {messages.map(msg => (
                    <div key={msg.id} className="flex gap-4 p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg">
                        <div className={`${avatarSizeClass} flex items-center justify-center bg-zinc-950 border border-zinc-700 rounded`}>{msg.pilotAvatar}</div>
                        <div className="flex-grow space-y-1">
                            <div className="flex justify-between items-center">
                                <span className={`font-black text-emerald-500 uppercase ${fontSize === 'large' ? 'text-[13px]' : (fontSize === 'medium' ? 'text-[11px]' : 'text-[10px]')}`}>{msg.pilotName}</span>
                                <span className="text-[7px] text-zinc-600">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className={`text-zinc-300 uppercase leading-snug ${fontSize === 'large' ? 'text-[15px]' : (fontSize === 'medium' ? 'text-[13px]' : 'text-[11px]')}`}>{msg.text}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
