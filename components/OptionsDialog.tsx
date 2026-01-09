
import React from 'react';
import { GameState } from '../types.ts';
import { AVATARS } from '../constants.ts';

interface OptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

export const OptionsDialog: React.FC<OptionsDialogProps> = ({ isOpen, onClose, gameState, setGameState }) => {
  if (!isOpen) return null;

  const fs = gameState.settings.fontSize || 'medium';
  // SCALE UP: Small (+10% from base), Medium (+20%), Large (+40%)
  const titleSize = fs === 'small' ? 'text-[11px]' : (fs === 'large' ? 'text-[16px]' : 'text-[13px]');
  const btnSize = fs === 'small' ? 'text-[10px]' : (fs === 'large' ? 'text-[14px]' : 'text-[12px]');
  const btnPadding = fs === 'small' ? 'px-3 py-1' : (fs === 'large' ? 'px-5 py-3' : 'px-4 py-2');
  const avatarTextSize = fs === 'small' ? 'text-2xl' : (fs === 'large' ? 'text-5xl' : 'text-3xl');

  return (
    <div className="fixed inset-0 z-[9500] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md">
       <div className="w-full max-w-xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-2xl">
          <header className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h2 className={`retro-font text-emerald-400 ${titleSize} uppercase`}>Pilot Systems</h2>
              <button onClick={onClose} className={`text-zinc-500 ${btnSize} font-black hover:text-white`}>DONE</button>
          </header>
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
             <div className="space-y-4 bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/50 shadow-inner">
                <div className="flex flex-col gap-2">
                    <span className={`font-black uppercase text-zinc-300 ${titleSize}`}>Operational Callsign</span>
                    <input type="text" defaultValue={gameState.pilotName} onBlur={e => setGameState(p => ({...p, pilotName: e.target.value.toUpperCase().slice(0, 12)}))} className={`w-full bg-black border border-zinc-700 p-3 text-emerald-400 retro-font ${titleSize} outline-none uppercase focus:border-emerald-500 transition-colors`} />
                </div>
                <div className="grid grid-cols-5 gap-2">
                    {AVATARS.map((a) => (
                        <button key={a.label} onClick={() => setGameState(p => ({...p, pilotAvatar: a.icon}))} className={`aspect-square flex items-center justify-center ${avatarTextSize} bg-black border rounded transition-all ${gameState.pilotAvatar === a.icon ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 opacity-40 hover:opacity-100 hover:border-zinc-600'}`}>{a.icon}</button>
                    ))}
                </div>
             </div>

             {/* UI SETTINGS */}
             <div className="space-y-4 bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/50 shadow-inner">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                    <div className="flex flex-col"><span className={`font-black uppercase text-white ${titleSize}`}>Interface Size</span><span className={`text-zinc-500 uppercase ${btnSize}`}>Adjust text scale</span></div>
                    <div className="flex gap-1 bg-zinc-800 p-1 rounded">
                        {(['small', 'medium', 'large'] as const).map(s => (
                            <button 
                                key={s} 
                                onClick={() => setGameState(p => ({...p, settings: { ...p.settings, fontSize: s }}))}
                                className={`${btnPadding} rounded text-[10px] uppercase font-black transition-colors ${fs === s ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                            >
                                {s.charAt(0)}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="flex justify-between items-center">
                    <div className="flex flex-col"><span className={`font-black uppercase text-white ${titleSize}`}>Cinematics</span><span className={`text-zinc-500 uppercase ${btnSize}`}>Enable launch/landing sequences</span></div>
                    <button onClick={() => setGameState(p => ({...p, settings: { ...p.settings, showTransitions: !p.settings.showTransitions }}))} className={`w-12 h-6 rounded-full p-1 transition-colors ${gameState.settings.showTransitions ? 'bg-emerald-600' : 'bg-zinc-700'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform ${gameState.settings.showTransitions ? 'translate-x-6' : 'translate-x-0'}`} /></button>
                </div>
             </div>

             <div className="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/50 shadow-inner flex flex-col gap-4">
                <div className="flex justify-between items-center pt-2">
                    <div className="flex flex-col"><span className={`font-black uppercase text-orange-400 ${titleSize}`}>Test Mode</span><span className={`text-zinc-500 uppercase ${btnSize}`}>Enable Developer Features</span></div>
                    <button 
                        onClick={() => setGameState(p => { 
                            const active = !p.settings.testMode; 
                            const creditChange = active ? 1000000 : -1000000;
                            const newCredits = Math.max(0, p.credits + creditChange);
                            return {
                                ...p, 
                                credits: newCredits, 
                                settings: { ...p.settings, testMode: active }
                            }; 
                        })} 
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${gameState.settings.testMode ? 'bg-orange-600' : 'bg-zinc-700'}`}
                    >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${gameState.settings.testMode ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};
