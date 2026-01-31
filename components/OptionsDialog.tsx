
import React, { useState } from 'react';
import { GameState } from '../types.ts';
import { audioService } from '../services/audioService.ts';

// 8 Distinct Avatars with unique Emojis
const AVATAR_LIST = [
  // 1. COMMANDER (Blond Male)
  { 
    id: 'cmdr', label: 'Cmdr. Riker', icon: '👱🏻‍♂️', 
    insignia: 'commander'
  },
  // 2. LIEUTENANT (Asian Female)
  { 
    id: 'lt', label: 'Lt. Chen', icon: '👩🏻', 
    insignia: 'lieutenant'
  },
  // 3. SERGEANT (Black Male)
  { 
    id: 'sgt', label: 'Sgt. Jax', icon: '👨🏾', 
    insignia: 'sergeant'
  },
  // 4. SPECIALIST (Blond Female)
  { 
    id: 'spec', label: 'Spec. Ray', icon: '👩🏼', 
    insignia: 'specialist'
  },
  // 5. CAPTAIN (Latino Male)
  { 
    id: 'cpt', label: 'Cpt. Miller', icon: '👨🏽', 
    insignia: 'captain'
  },
  // 6. PILOT (Black Female)
  { 
    id: 'pilot', label: 'Ace Zoe', icon: '👩🏾', 
    insignia: 'wings'
  },
  // 7. VETERAN (Bearded Male)
  { 
    id: 'vet', label: 'Vet. Kane', icon: '🧔🏻', 
    insignia: 'medic'
  },
  // 8. ALIEN (Extraterrestrial)
  { 
    id: 'alien', label: 'Amb. Xel', icon: '👽', 
    insignia: 'gear'
  }
];

interface OptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  onResetGame: (pilotName: string, pilotAvatar: string) => void;
}

export const OptionsDialog: React.FC<OptionsDialogProps> = ({ isOpen, onClose, gameState, setGameState, onResetGame }) => {
  const [activeTab, setActiveTab] = useState<'appearance' | 'options' | 'audio'>('appearance');
  const [nameFocusVal, setNameFocusVal] = useState('');

  if (!isOpen) return null;

  const fs = gameState.settings.fontSize || 'medium';
  const titleSize = fs === 'small' ? 'text-[11px]' : (fs === 'large' ? 'text-[16px]' : (fs === 'extra-large' ? 'text-[18px]' : 'text-[13px]'));
  const btnSize = fs === 'small' ? 'text-[10px]' : (fs === 'large' ? 'text-[14px]' : (fs === 'extra-large' ? 'text-[16px]' : 'text-[12px]'));
  const btnPadding = fs === 'small' ? 'px-3 py-1' : (fs === 'large' ? 'px-5 py-3' : (fs === 'extra-large' ? 'px-6 py-4' : 'px-4 py-2'));
  
  // Standardized Avatar Size (Zoom control deprecated/removed from UI)
  const currentZoom = 1.0;
  const baseBoxSize = 60; 
  const baseFontSize = 40;
  
  const boxSize = Math.floor(baseBoxSize * currentZoom);
  const emojiSize = Math.floor(baseFontSize * currentZoom);

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

  const updateSpeedMode = (mode: 'slow' | 'normal' | 'fast') => {
      setGameState(prev => ({ ...prev, settings: { ...prev.settings, speedMode: mode } }));
  };

  const updateAudioTheme = (theme: 'retro' | 'classic' | 'modern') => {
      setGameState(prev => ({ ...prev, settings: { ...prev.settings, audioTheme: theme } }));
      audioService.setTheme(theme);
  };

  const handleAvatarSelect = (avatar: typeof AVATAR_LIST[0]) => {
      const isDefaultName = AVATAR_LIST.some(a => a.label === gameState.pilotName) || gameState.pilotName === 'STRATOS';
      const newName = isDefaultName ? avatar.label : gameState.pilotName;
      
      // Full Reset Trigger with new Identity
      onResetGame(newName, avatar.icon);
  };

  const renderTabButton = (id: 'appearance' | 'options' | 'audio', label: string) => (
      <button 
          onClick={() => setActiveTab(id)} 
          className={`flex-1 py-3 text-center font-black uppercase ${btnSize} transition-colors ${activeTab === id ? 'bg-emerald-900/20 text-emerald-400 border-b-2 border-emerald-500' : 'bg-zinc-900/20 text-zinc-500 hover:text-zinc-300'}`}
      >
          {label}
      </button>
  );

  return (
    <div className="fixed inset-0 z-[9600] bg-black/95 flex items-center justify-center p-2 backdrop-blur-md" onClick={onClose}>
       <div className="w-full max-w-[96vw] bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-2xl h-[92vh]" onClick={(e) => e.stopPropagation()}>
          <header className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 shrink-0">
              <h2 className={`retro-font text-emerald-400 ${titleSize} uppercase`}>System Configuration</h2>
              <button onClick={onClose} className={`text-zinc-500 ${btnSize} font-black hover:text-white`}>DONE</button>
          </header>
          
          <div className="flex border-b border-zinc-800 shrink-0">
              {renderTabButton('appearance', 'Appearance')}
              {renderTabButton('options', 'Options')}
              {renderTabButton('audio', 'Audio')}
          </div>

          <div className="flex-grow p-4 md:p-6 overflow-hidden bg-black/40 flex flex-col relative">
             {activeTab === 'appearance' && (
                 <div className="flex flex-col gap-4 h-full animate-in fade-in slide-in-from-bottom-2 duration-200">
                    
                    {/* Top Row: Interface Size (Previously Face Distance) & Callsign */}
                    <div className="flex flex-col landscape:flex-row md:flex-row gap-4 shrink-0 items-start">
                        {/* Interface Size Control (Replacing Face Distance) */}
                        <div className="flex-1 w-full bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50 shadow-inner">
                            <div className="flex flex-col items-start w-full gap-2">
                                <span className={`font-black uppercase text-white ${titleSize}`}>INTERFACE SIZE</span>
                                <div className="flex gap-1 bg-zinc-800 p-1 rounded w-full sm:w-auto">
                                    {(['small', 'medium', 'large', 'extra-large'] as const).map(s => (
                                        <button 
                                            key={s} 
                                            onClick={() => setGameState(p => ({...p, settings: { ...p.settings, fontSize: s }}))}
                                            className={`${btnPadding} flex-1 sm:flex-none rounded font-black transition-colors flex items-center justify-center w-12 ${fs === s ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                                        >
                                            <span className={s === 'small' ? 'text-[10px]' : (s === 'medium' ? 'text-[12px]' : (s === 'large' ? 'text-[14px]' : 'text-[16px]'))}>{s === 'extra-large' ? 'XL' : s.charAt(0).toUpperCase()}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Callsign Input */}
                        <div className="flex-1 w-full bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50 shadow-inner">
                            <span className={`font-black uppercase text-zinc-300 mb-2 block ${titleSize}`}>Operational Callsign</span>
                            <input 
                                type="text" 
                                value={gameState.pilotName || ''} 
                                onFocus={(e) => setNameFocusVal(e.target.value)}
                                onChange={e => setGameState(p => ({...p, pilotName: e.target.value.toUpperCase().slice(0, 12)}))} 
                                className={`w-full bg-black border border-zinc-700 p-2 md:p-3 text-emerald-400 retro-font ${titleSize} outline-none uppercase focus:border-emerald-500 transition-colors rounded`} 
                            />
                        </div>
                    </div>

                    {/* Avatar Grid (Flowing Flex) */}
                    <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50 shadow-inner flex-grow flex flex-col min-h-0">
                        <span className={`font-black uppercase text-zinc-500 mb-2 shrink-0 ${titleSize}`}>Select Identity (RESETS PROGRESS)</span>
                        <div className="overflow-y-auto custom-scrollbar flex-grow pr-1">
                            <div className="flex flex-wrap gap-2 content-start">
                                {AVATAR_LIST.map((a) => {
                                    const isSelected = gameState.pilotAvatar === a.icon;
                                    
                                    return (
                                        <button 
                                            key={a.id} 
                                            onClick={() => handleAvatarSelect(a)} 
                                            style={{ width: `${boxSize}px`, height: `${boxSize}px` }}
                                            className={`relative group transition-all duration-200 ease-out hover:z-10 ${isSelected ? 'z-20 ring-2 ring-emerald-500 rounded-sm' : 'opacity-80 hover:opacity-100'}`}
                                        >
                                            <div className="bg-zinc-200 p-[2px] shadow-lg rounded-[2px] w-full h-full flex flex-col">
                                                <div className="bg-zinc-800 w-full h-full flex items-center justify-center overflow-hidden relative">
                                                    <div className="absolute inset-0 bg-gradient-to-b from-zinc-700 to-zinc-900" />
                                                    <span style={{ fontSize: `${emojiSize}px` }} className="relative z-10 drop-shadow-md leading-none select-none filter">{a.icon}</span>
                                                    <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-white/10 to-transparent pointer-events-none z-20" />
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                 </div>
             )}

             {activeTab === 'options' && (
                 <div className="h-full flex flex-col justify-start animate-in fade-in slide-in-from-bottom-2 duration-200">
                     <div className="space-y-6 bg-zinc-900/40 p-6 rounded-lg border border-zinc-800/50 shadow-inner">
                        <h3 className={`font-black uppercase text-zinc-600 ${titleSize} border-b border-zinc-800 pb-2`}>Gameplay Options</h3>

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

                        {/* Game Speed Mode */}
                        <div className="flex justify-between items-center">
                            <div className="flex flex-col"><span className={`font-black uppercase text-white ${titleSize}`}>Game Speed</span><span className={`text-zinc-500 uppercase ${btnSize}`}>Enemy Movement Rate</span></div>
                            <div className="flex gap-1 bg-zinc-800 p-1 rounded">
                                {(['slow', 'normal', 'fast'] as const).map(mode => (
                                    <button 
                                        key={mode} 
                                        onClick={() => updateSpeedMode(mode)}
                                        className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-colors ${gameState.settings.speedMode === mode ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>
                     </div>
                 </div>
             )}

             {activeTab === 'audio' && (
                 <div className="h-full flex flex-col justify-start animate-in fade-in slide-in-from-bottom-2 duration-200">
                     <div className="space-y-6 bg-zinc-900/40 p-6 rounded-lg border border-zinc-800/50 shadow-inner">
                        <h3 className={`font-black uppercase text-zinc-600 ${titleSize} border-b border-zinc-800 pb-2`}>Audio Levels</h3>
                        
                        {/* Music Volume */}
                        <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className={`font-black uppercase text-white ${titleSize}`}>Music</span>
                                <span className={`text-zinc-500 uppercase ${btnSize}`}>Atmospheric Tracks</span>
                            </div>
                            <div className="flex items-center gap-4 w-1/2 justify-end">
                                <input 
                                    type="range" min="0" max="1" step="0.1" 
                                    value={gameState.settings.musicVolume} 
                                    onChange={(e) => updateVolume('musicVolume', parseFloat(e.target.value))}
                                    className="w-32 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-emerald-400"
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
                            <div className="flex items-center gap-4 w-1/2 justify-end">
                                <input 
                                    type="range" min="0" max="1" step="0.1" 
                                    value={gameState.settings.sfxVolume} 
                                    onChange={(e) => updateVolume('sfxVolume', parseFloat(e.target.value))}
                                    className="w-32 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-amber-400"
                                />
                                <span className="text-[10px] font-mono text-amber-400 w-8 text-right">{Math.round(gameState.settings.sfxVolume * 100)}%</span>
                            </div>
                        </div>

                        {/* Audio Theme Selector - Horizontal Alignment */}
                        <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
                            <div className="flex flex-col">
                                <span className={`font-black uppercase text-white ${titleSize}`}>Audio Theme</span>
                            </div>
                            <div className="flex gap-1 bg-zinc-800 p-1 rounded overflow-x-auto">
                                {(['retro', 'classic', 'modern'] as const).map(theme => (
                                    <button 
                                        key={theme} 
                                        onClick={() => updateAudioTheme(theme)}
                                        className={`min-w-[60px] px-2 py-2 rounded text-[9px] font-black uppercase transition-colors ${gameState.settings.audioTheme === theme ? 'bg-emerald-600 text-white shadow-lg' : 'text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
                                    >
                                        {theme}
                                    </button>
                                ))}
                            </div>
                        </div>
                     </div>
                 </div>
             )}
          </div>
       </div>
    </div>
  );
};
