
// --- LOCKED: OPTIONS DIALOG MODULE ---
// DO NOT MODIFY WITHOUT EXPLICIT USER REQUEST
// Layout, avatar logic, and styling are finalized.

import React, { useState } from 'react';
import { GameState } from '../types.ts';

// 8 Distinct Avatars with unique Emojis
const AVATAR_LIST = [
  // 1. COMMANDER (Blond Male) - Red Uniform
  { 
    id: 'cmdr', label: 'Cmdr. Riker', icon: '👱🏻‍♂️', 
    skinColor: '#ffdbac', shirtColor: '#b91c1c', 
    insignia: 'commander'
  },
  // 2. LIEUTENANT (Asian Female) - Blue Uniform
  { 
    id: 'lt', label: 'Lt. Chen', icon: '👩🏻', 
    skinColor: '#f1c27d', shirtColor: '#1d4ed8', 
    insignia: 'lieutenant'
  },
  // 3. SERGEANT (Black Male) - Green Uniform
  { 
    id: 'sgt', label: 'Sgt. Jax', icon: '👨🏾', 
    skinColor: '#5d4037', shirtColor: '#15803d', 
    insignia: 'sergeant'
  },
  // 4. SPECIALIST (Blond Female) - Teal Uniform
  { 
    id: 'spec', label: 'Spec. Ray', icon: '👩🏼', 
    skinColor: '#ffdbac', shirtColor: '#0f766e', 
    insignia: 'specialist'
  },
  // 5. CAPTAIN (Latino Male) - Gold Uniform
  { 
    id: 'cpt', label: 'Cpt. Miller', icon: '👨🏽', 
    skinColor: '#e0ac69', shirtColor: '#a16207', 
    insignia: 'captain'
  },
  // 6. PILOT (Black Female) - Orange Uniform
  { 
    id: 'pilot', label: 'Ace Zoe', icon: '👩🏾', 
    skinColor: '#8d5524', shirtColor: '#c2410c', 
    insignia: 'wings'
  },
  // 7. VETERAN (Bearded Male) - Grey/Tactical Uniform
  { 
    id: 'vet', label: 'Vet. Kane', icon: '🧔🏻', 
    skinColor: '#ffe0bd', shirtColor: '#3f3f46', 
    insignia: 'medic'
  },
  // 8. ALIEN (Extraterrestrial) - Purple Uniform
  { 
    id: 'alien', label: 'Amb. Xel', icon: '👽', 
    skinColor: '#86efac', shirtColor: '#7e22ce', 
    insignia: 'gear'
  }
];

interface OptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

export const OptionsDialog: React.FC<OptionsDialogProps> = ({ isOpen, onClose, gameState, setGameState }) => {
  const [activeTab, setActiveTab] = useState<'pilot' | 'settings'>('pilot');

  if (!isOpen) return null;

  const fs = gameState.settings.fontSize || 'medium';
  const titleSize = fs === 'small' ? 'text-[11px]' : (fs === 'large' ? 'text-[16px]' : 'text-[13px]');
  const btnSize = fs === 'small' ? 'text-[10px]' : (fs === 'large' ? 'text-[14px]' : 'text-[12px]');
  const btnPadding = fs === 'small' ? 'px-3 py-1' : (fs === 'large' ? 'px-5 py-3' : 'px-4 py-2');
  
  // Camera Zoom Levels - Centered
  // Zoom now scales the head directly in the center of the frame
  const zoomScale = fs === 'small' ? 0.75 : (fs === 'large' ? 1.4 : 1.0);
  
  const avatarTextSize = 'text-5xl'; 

  const updateVolume = (key: 'musicVolume' | 'sfxVolume', value: number) => {
      setGameState(prev => ({
          ...prev,
          settings: { ...prev.settings, [key]: value }
      }));
  };

  const toggleSetting = (key: keyof typeof gameState.settings) => {
      setGameState(prev => ({
          ...prev,
          settings: { ...prev.settings, [key]: !prev.settings[key] }
      }));
  };

  const renderInsignia = (type: string) => {
      switch(type) {
          case 'commander': return <div className="flex gap-[2px]"><div className="w-1.5 h-3 bg-yellow-400 rounded-sm shadow-sm"/><div className="w-1.5 h-3 bg-yellow-400 rounded-sm shadow-sm"/><div className="w-1.5 h-3 bg-yellow-400 rounded-sm shadow-sm"/></div>;
          case 'captain': return <div className="flex gap-[2px]"><div className="w-1 h-2 bg-yellow-400"/><div className="w-1 h-2 bg-yellow-400"/><div className="w-1 h-2 bg-yellow-400"/><div className="w-1 h-2 bg-yellow-400"/></div>;
          case 'lieutenant': return <div className="flex gap-[3px]"><div className="w-2 h-1 bg-gray-300 shadow-sm"/><div className="w-2 h-1 bg-gray-300 shadow-sm"/></div>;
          case 'sergeant': return <div className="flex flex-col gap-[1px] items-center"><div className="w-3 h-1.5 border-t-2 border-l-2 border-yellow-500 rotate-45 transform origin-center"/><div className="w-3 h-1.5 border-t-2 border-l-2 border-yellow-500 rotate-45 transform origin-center"/></div>;
          case 'specialist': return <div className="w-3 h-3 bg-emerald-900 rounded-full border border-emerald-400 flex items-center justify-center"><div className="w-1 h-1 bg-emerald-400 rounded-full"/></div>;
          case 'wings': return <div className="flex items-center"><div className="w-2 h-1 bg-white skew-x-12"/><div className="w-1 h-1.5 bg-blue-400 rounded-full z-10"/><div className="w-2 h-1 bg-white -skew-x-12"/></div>;
          case 'medic': return <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center text-[8px] text-red-600 font-bold leading-none shadow-sm">✚</div>;
          case 'gear': return <div className="w-3 h-3 border-2 border-dashed border-gray-400 rounded-full animate-[spin_10s_linear_infinite]"/>;
          default: return null;
      }
  };

  const handleAvatarSelect = (avatar: typeof AVATAR_LIST[0]) => {
      setGameState(prev => {
          // If current name is one of the defaults OR the game start default 'STRATOS', switch to the new default
          const isDefaultName = AVATAR_LIST.some(a => a.label === prev.pilotName) || prev.pilotName === 'STRATOS';
          const newName = isDefaultName ? avatar.label : prev.pilotName;
          
          return {
              ...prev,
              pilotAvatar: avatar.icon,
              pilotName: newName
          };
      });
  };

  return (
    <div className="fixed inset-0 z-[9500] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md">
       <div className="w-full max-w-xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-2xl h-[80vh]">
          <header className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 shrink-0">
              <h2 className={`retro-font text-emerald-400 ${titleSize} uppercase`}>System Configuration</h2>
              <button onClick={onClose} className={`text-zinc-500 ${btnSize} font-black hover:text-white`}>DONE</button>
          </header>
          
          {/* TABS */}
          <div className="flex border-b border-zinc-800 shrink-0">
              <button 
                  onClick={() => setActiveTab('pilot')} 
                  className={`flex-1 py-3 text-center font-black uppercase ${btnSize} transition-colors ${activeTab === 'pilot' ? 'bg-emerald-900/20 text-emerald-400 border-b-2 border-emerald-500' : 'bg-zinc-900/20 text-zinc-500 hover:text-zinc-300'}`}
              >
                  Pilot ID
              </button>
              <button 
                  onClick={() => setActiveTab('settings')} 
                  className={`flex-1 py-3 text-center font-black uppercase ${btnSize} transition-colors ${activeTab === 'settings' ? 'bg-emerald-900/20 text-emerald-400 border-b-2 border-emerald-500' : 'bg-zinc-900/20 text-zinc-500 hover:text-zinc-300'}`}
              >
                  Settings
              </button>
          </div>

          <div className="flex-grow p-6 space-y-6 overflow-y-auto custom-scrollbar bg-black/40">
             {activeTab === 'pilot' && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-4 bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/50 shadow-inner">
                        <div className="flex flex-col gap-2 mb-4">
                            <span className={`font-black uppercase text-zinc-300 ${titleSize}`}>Operational Callsign</span>
                            <input type="text" value={gameState.pilotName} onChange={e => setGameState(p => ({...p, pilotName: e.target.value.toUpperCase().slice(0, 12)}))} className={`w-full bg-black border border-zinc-700 p-3 text-emerald-400 retro-font ${titleSize} outline-none uppercase focus:border-emerald-500 transition-colors`} />
                        </div>
                        
                        <div className="grid grid-cols-4 gap-3 p-2">
                            {AVATAR_LIST.map((a) => {
                                const isSelected = gameState.pilotAvatar === a.icon;
                                const transformStyle = { transform: `scale(${zoomScale})` };
                                
                                return (
                                    <button 
                                        key={a.id} 
                                        onClick={() => handleAvatarSelect(a)} 
                                        className={`relative group transition-all duration-200 ease-out hover:z-10 hover:scale-105 ${isSelected ? 'scale-110 z-20 ring-4 ring-emerald-500/50 rounded-sm' : 'opacity-80 hover:opacity-100'}`}
                                    >
                                        {/* Frame - Aspect Square */}
                                        <div className="bg-zinc-200 p-1 shadow-lg rounded-[2px] w-full aspect-square flex flex-col">
                                            {/* Image Area - Full Height (No Name Tag) */}
                                            <div className="bg-zinc-800 w-full h-full flex items-center justify-center overflow-hidden shadow-inner relative">
                                                {/* Background */}
                                                <div className="absolute inset-0 bg-gradient-to-b from-zinc-700 to-zinc-900" />
                                                
                                                {/* AVATAR CONTAINER - Centered */}
                                                <div className="absolute inset-0 flex items-center justify-center z-0 origin-center" style={transformStyle}>
                                                    
                                                    {/* 1. BODY / SHIRT */}
                                                    <div className="absolute bottom-[-15%] left-1/2 -translate-x-1/2 w-[85%] h-[50%] rounded-t-[2.5rem] shadow-lg z-10 flex flex-col items-center justify-start pt-2" style={{ backgroundColor: a.shirtColor }}>
                                                        {/* Collar V */}
                                                        <div className="w-[40%] h-[15%] bg-zinc-900/30 rounded-b-full mb-1" />
                                                        {/* Insignia on Chest */}
                                                        <div className="mt-1 opacity-90 scale-125 drop-shadow-md">
                                                            {renderInsignia(a.insignia)}
                                                        </div>
                                                    </div>

                                                    {/* 2. NECK */}
                                                    <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 w-[22%] h-[20%] z-0 rounded-t-sm" style={{ backgroundColor: a.skinColor }} />

                                                    {/* 3. HEAD */}
                                                    <span className={`${avatarTextSize} drop-shadow-xl select-none relative z-20`}>{a.icon}</span>

                                                </div>

                                                {/* Foreground Lighting */}
                                                <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-white/10 to-transparent pointer-events-none z-40" />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ZOOM CONTROL */}
                    <div className="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/50 shadow-inner flex justify-between items-center">
                        <div className="flex flex-col"><span className={`font-black uppercase text-white ${titleSize}`}>Camera Zoom</span><span className={`text-zinc-500 uppercase ${btnSize}`}>Portrait Distance</span></div>
                        <div className="flex gap-1 bg-zinc-800 p-1 rounded">
                            {(['small', 'medium', 'large'] as const).map(s => (
                                <button 
                                    key={s} 
                                    onClick={() => setGameState(p => ({...p, settings: { ...p.settings, fontSize: s }}))}
                                    className={`${btnPadding} rounded text-[10px] uppercase font-black transition-colors ${fs === s ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    {s === 'small' ? 'FAR' : (s === 'medium' ? 'MID' : 'CLOSE')}
                                </button>
                            ))}
                        </div>
                    </div>
                 </div>
             )}

             {activeTab === 'settings' && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                     
                     {/* AUDIO SETTINGS */}
                     <div className="space-y-4 bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/50 shadow-inner">
                        <h3 className={`font-black uppercase text-zinc-600 ${titleSize} border-b border-zinc-800 pb-2`}>Audio Levels</h3>
                        
                        {/* Music Volume */}
                        <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className={`font-black uppercase text-white ${titleSize}`}>Music</span>
                                <span className={`text-zinc-500 uppercase ${btnSize}`}>Atmospheric Tracks</span>
                            </div>
                            <div className="flex items-center gap-4 w-1/2">
                                <input 
                                    type="range" min="0" max="1" step="0.1" 
                                    value={gameState.settings.musicVolume} 
                                    onChange={(e) => updateVolume('musicVolume', parseFloat(e.target.value))}
                                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-emerald-400"
                                />
                                <span className="text-[10px] font-mono text-emerald-400 w-8 text-right">{Math.round(gameState.settings.musicVolume * 100)}%</span>
                            </div>
                        </div>

                        {/* SFX Volume */}
                        <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className={`font-black uppercase text-white ${titleSize}`}>FX Effects</span>
                                <span className={`text-zinc-500 uppercase ${btnSize}`}>Weapons & Systems</span>
                            </div>
                            <div className="flex items-center gap-4 w-1/2">
                                <input 
                                    type="range" min="0" max="1" step="0.1" 
                                    value={gameState.settings.sfxVolume} 
                                    onChange={(e) => updateVolume('sfxVolume', parseFloat(e.target.value))}
                                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-amber-400"
                                />
                                <span className="text-[10px] font-mono text-amber-400 w-8 text-right">{Math.round(gameState.settings.sfxVolume * 100)}%</span>
                            </div>
                        </div>
                     </div>

                     {/* SYSTEM SETTINGS */}
                     <div className="space-y-4 bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/50 shadow-inner">
                        <h3 className={`font-black uppercase text-zinc-600 ${titleSize} border-b border-zinc-800 pb-2`}>System Configuration</h3>

                        {/* Test Mode */}
                        <div className="flex justify-between items-center">
                            <div className="flex flex-col"><span className={`font-black uppercase text-orange-400 ${titleSize}`}>Test Mode</span><span className={`text-zinc-500 uppercase ${btnSize}`}>Unlock All Assets</span></div>
                            <button 
                                onClick={() => setGameState(p => { 
                                    const active = !p.settings.testMode; 
                                    const creditChange = active ? 8000000 : -8000000;
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

                        {/* Cinematics */}
                        <div className="flex justify-between items-center">
                            <div className="flex flex-col"><span className={`font-black uppercase text-white ${titleSize}`}>Cinematics</span><span className={`text-zinc-500 uppercase ${btnSize}`}>Launch Sequences</span></div>
                            <button onClick={() => toggleSetting('showTransitions')} className={`w-12 h-6 rounded-full p-1 transition-colors ${gameState.settings.showTransitions ? 'bg-emerald-600' : 'bg-zinc-700'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform ${gameState.settings.showTransitions ? 'translate-x-6' : 'translate-x-0'}`} /></button>
                        </div>
                     </div>

                 </div>
             )}
          </div>
       </div>
    </div>
  );
};
