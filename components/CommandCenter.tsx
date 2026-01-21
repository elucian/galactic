
import React, { useRef, useState, useEffect } from 'react';
import { GameState, ShipFitting, Shield } from '../types.ts';
import { SHIPS, SHIELDS, EXOTIC_SHIELDS, MAX_FLEET_SIZE } from '../constants.ts';
import { ShipIcon } from './ShipIcon.tsx';

interface CommandCenterProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  dockedPlanetName: string;
  onLaunch: () => void;
  onRepair: () => void;
  onRefuel: () => void;
  setScreen: (screen: 'intro' | 'hangar' | 'map' | 'launch' | 'game' | 'landing') => void;
  setIsOptionsOpen: (v: boolean) => void;
  setIsStoreOpen: (v: boolean) => void;
  setIsLoadoutOpen: (v: boolean) => void;
  setIsPaintOpen: (v: boolean) => void;
  setIsMessagesOpen: (v: boolean) => void;
  setIsMarketOpen: (v: boolean) => void;
  setIsCargoOpen: (v: boolean) => void;
  activeSlotIndex: number;
  setActiveSlotIndex: (i: number) => void;
  systemMessage: { text: string, type: 'neutral' | 'success' | 'error' | 'warning' };
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  gameState,
  setGameState,
  dockedPlanetName,
  onLaunch,
  onRepair,
  onRefuel,
  setScreen,
  setIsOptionsOpen,
  setIsStoreOpen,
  setIsLoadoutOpen,
  setIsPaintOpen,
  setIsMessagesOpen,
  setIsMarketOpen,
  setIsCargoOpen,
  activeSlotIndex,
  setActiveSlotIndex,
  systemMessage
}) => {
  const [startIndex, setStartIndex] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(3);
  const touchStart = useRef<number | null>(null);
  
  const fs = gameState.settings.fontSize || 'medium';
  
  // Dynamic Sizing Logic
  const titleSize = fs === 'small' ? 'text-[11px]' : (fs === 'large' ? 'text-[16px]' : (fs === 'extra-large' ? 'text-[18px]' : 'text-[13px]'));
  const btnSize = fs === 'small' ? 'text-[10px]' : (fs === 'large' ? 'text-[14px]' : (fs === 'extra-large' ? 'text-[16px]' : 'text-[12px]'));
  const lblSize = fs === 'small' ? 'text-[8px]' : (fs === 'large' ? 'text-[12px]' : (fs === 'extra-large' ? 'text-[14px]' : 'text-[10px]'));
  
  // Fleet Card Specific Sizes
  const cardTitleSize = fs === 'small' ? 'text-[9px]' : (fs === 'large' ? 'text-[13px]' : (fs === 'extra-large' ? 'text-[15px]' : 'text-[11px]'));
  const cardStatLabel = fs === 'small' ? 'text-[6px]' : (fs === 'large' ? 'text-[9px]' : (fs === 'extra-large' ? 'text-[10px]' : 'text-[7px]'));
  const cardBtnText = fs === 'small' ? 'text-[7px]' : (fs === 'large' ? 'text-[10px]' : (fs === 'extra-large' ? 'text-[12px]' : 'text-[8px]'));

  // Avatar Size - Adjusted for larger options
  const pilotIconSize = fs === 'small' ? 'w-10 h-10 text-xl' : (fs === 'large' ? 'w-16 h-16 text-3xl' : (fs === 'extra-large' ? 'w-20 h-20 text-5xl' : 'w-12 h-12 text-2xl'));
  
  // Footer Icon Size
  const footerIconClass = fs === 'small' ? 'w-10 h-10' : (fs === 'large' ? 'w-14 h-14' : (fs === 'extra-large' ? 'w-16 h-16' : 'w-12 h-12'));
  const footerIconText = fs === 'small' ? 'text-lg' : (fs === 'large' ? 'text-3xl' : (fs === 'extra-large' ? 'text-4xl' : 'text-2xl'));
  const footerSvgSize = fs === 'small' ? 'w-5 h-5' : (fs === 'large' ? 'w-8 h-8' : (fs === 'extra-large' ? 'w-10 h-10' : 'w-6 h-6'));
  
  // Footer Button Padding - Reduced horizontal padding by 50%
  const btnPad = fs === 'small' ? 'px-3 py-2' : (fs === 'large' ? 'px-4 py-4' : (fs === 'extra-large' ? 'px-5 py-5' : 'px-3.5 py-3'));

  const allShipsCompromised = gameState.ownedShips.every(ship => {
      const fitting = gameState.shipFittings[ship.instanceId];
      return (fitting?.health || 0) <= 0;
  });

  const selectedShipDestroyed = gameState.shipFittings[gameState.selectedShipInstanceId || '']?.health <= 0;

  useEffect(() => {
    const updateLayout = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isLandscape = w > h;
      
      if (w >= 1024 || (w >= 768 && isLandscape)) {
        setItemsPerPage(3);
      } else if (w >= 768) {
        setItemsPerPage(2);
      } else {
        setItemsPerPage(1);
      }
    };
    
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  const maxIndex = Math.max(0, gameState.ownedShips.length - itemsPerPage);
  
  useEffect(() => {
      if (startIndex > maxIndex) setStartIndex(maxIndex);
  }, [itemsPerPage, maxIndex, startIndex]);

  const goNext = () => {
      if (startIndex < maxIndex) {
          const nextIndex = startIndex + 1;
          setStartIndex(nextIndex);
          // Auto-select the first visible ship in the new view
          setActiveSlotIndex(nextIndex);
      }
  };
  
  const goPrev = () => {
      if (startIndex > 0) {
          const prevIndex = startIndex - 1;
          setStartIndex(prevIndex);
          // Auto-select the first visible ship in the new view
          setActiveSlotIndex(prevIndex);
      }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      touchStart.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (touchStart.current === null) return;
      const endX = e.changedTouches[0].clientX;
      const diff = endX - touchStart.current;
      
      if (Math.abs(diff) > 50) { 
          if (diff > 0) goPrev(); 
          else goNext(); 
      }
      touchStart.current = null;
  };

  const visibleShips = gameState.ownedShips.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="flex-grow flex flex-col p-2 md:p-4 z-10 overflow-hidden relative w-full h-full bg-black">
      {/* HEADER TITLE */}
      <div className="w-full text-center py-1 shrink-0 hidden md:block"><h1 className={`retro-font ${fs === 'small' ? 'text-[12px]' : (fs === 'large' ? 'text-[18px]' : (fs === 'extra-large' ? 'text-[22px]' : 'text-[15px]'))} text-emerald-500 uppercase tracking-[0.3em] opacity-80`}>COMMAND CENTER</h1></div>
      
      {/* HEADER */}
      <div className="w-full h-14 bg-black border-y border-zinc-800 flex items-center justify-between px-3 md:px-4 shrink-0 shadow-sm relative">
        <div className="flex flex-col gap-1 min-w-[80px]">
          <div className="flex items-center gap-2">
             <button onClick={() => setIsOptionsOpen(true)} className={`${pilotIconSize} flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded hover:border-emerald-500 transition-colors`}>{gameState.pilotAvatar}</button>
             <div className="flex flex-col">
                <span className={`${lblSize} font-black uppercase text-zinc-500`}>PILOT</span>
                <span className={`${titleSize} font-black text-white uppercase truncate max-w-[100px]`}>{gameState.pilotName}</span>
             </div>
          </div>
        </div>
        <div className="flex flex-col items-center">
            <span className={`${lblSize} uppercase font-black text-zinc-500`}>Sector Base</span>
            <span className={`${titleSize} font-black text-emerald-400 uppercase tracking-widest text-center truncate max-w-[100px] md:max-w-none`}>{dockedPlanetName}</span>
        </div>
        <div className="flex flex-col items-end min-w-[80px]">
            <span className={`${lblSize} uppercase font-black text-zinc-500`}>Available</span>
            <span className={`${titleSize} font-black text-emerald-400 tabular-nums`}>${Math.floor(gameState.credits).toLocaleString()}</span>
        </div>
      </div>

      {/* EXTERNAL NAVIGATION BUTTONS (DESKTOP ONLY) */}
      {itemsPerPage >= 3 && (
          <div className="w-full flex justify-between items-center px-1 py-1 h-8 shrink-0 relative z-20">
              <button 
                onClick={goPrev} 
                disabled={startIndex === 0}
                className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors ${startIndex === 0 ? 'opacity-30 cursor-not-allowed text-zinc-600' : 'text-emerald-500 hover:text-emerald-400 animate-pulse'}`}
              >
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                 PREV UNIT
              </button>
              
              <button 
                onClick={goNext} 
                disabled={startIndex >= maxIndex}
                className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors ${startIndex >= maxIndex ? 'opacity-30 cursor-not-allowed text-zinc-600' : 'text-emerald-500 hover:text-emerald-400 animate-pulse'}`}
              >
                 NEXT UNIT
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
          </div>
      )}

      {/* FLEET CAROUSEL */}
      <div 
        className="flex-grow flex w-full overflow-hidden mt-1 mb-2 p-1 relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {visibleShips.map((inst, visualIdx) => {
          const trueIdx = startIndex + visualIdx;
          const f = gameState.shipFittings[inst.instanceId];
          const config = SHIPS.find(s => s.id === inst.shipTypeId);
          if (!config || !f) return null;
          const isSelected = gameState.selectedShipInstanceId === inst.instanceId;
          const isDestroyed = f.health <= 0;
          
          const s1 = f.shieldId ? (f.shieldId === 'dev_god_mode' ? { id: 'dev_god_mode', name: 'DEV', color: '#ffffff', visualType: 'full', capacity: 9999, regenRate: 100, energyCost: 0 } as Shield : [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === f.shieldId) || null) : null;
          const s2 = f.secondShieldId ? (f.secondShieldId === 'dev_god_mode' ? { id: 'dev_god_mode', name: 'DEV', color: '#ffffff', visualType: 'full', capacity: 9999, regenRate: 100, energyCost: 0 } as Shield : [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === f.secondShieldId) || null) : null;

          // INTERNAL NAVIGATION LOGIC (Mobile/Tablet)
          const showPrev = itemsPerPage < 3 && ((itemsPerPage === 1) || (itemsPerPage === 2 && visualIdx === 0));
          const showNext = itemsPerPage < 3 && ((itemsPerPage === 1) || (itemsPerPage === 2 && visualIdx === 1));

          return (
            <div 
                key={inst.instanceId} 
                style={{ width: `${100/itemsPerPage}%` }}
                className="h-full px-1.5 transition-all duration-300"
            >
                <div 
                    onClick={() => { setActiveSlotIndex(trueIdx); }} 
                    className={`flex flex-col items-center rounded-xl transition-all cursor-pointer relative h-full border-2 p-2 w-full overflow-hidden
                    ${isSelected 
                        ? 'border-emerald-500 bg-zinc-900 shadow-[0_0_20px_rgba(16,185,129,0.1)] z-10' 
                        : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600 hover:bg-zinc-900'}`}
                >
                  
                  {/* CARD HEADER: Buttons & Title Vertically Aligned */}
                  <div className="relative w-full h-12 flex items-center justify-center shrink-0 border-b border-zinc-800/50 mb-2">
                      {/* EMBEDDED NAV PREV */}
                      {showPrev && startIndex > 0 && (
                          <button 
                              onClick={(e) => { e.stopPropagation(); goPrev(); }}
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-zinc-800/80 border border-zinc-600 text-emerald-500 rounded hover:bg-zinc-700 active:scale-95 transition-all shadow-lg z-30"
                          >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                  <path d="M15 19l-7-7 7-7v14z" />
                              </svg>
                          </button>
                      )}

                      {/* SHIP NAME CENTERED */}
                      <span className={`retro-font ${cardTitleSize} ${isDestroyed ? 'text-red-500 line-through' : 'text-emerald-500'} uppercase truncate text-center px-10 w-full`}>
                          {isDestroyed ? "RESCUE POD" : config.name}
                      </span>

                      {/* EMBEDDED NAV NEXT */}
                      {showNext && startIndex < maxIndex && (
                          <button 
                              onClick={(e) => { e.stopPropagation(); goNext(); }}
                              className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-zinc-800/80 border border-zinc-600 text-emerald-500 rounded hover:bg-zinc-700 active:scale-95 transition-all shadow-lg z-30"
                          >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                  <path d="M9 5l7 7-7 7V5z" />
                              </svg>
                          </button>
                      )}
                  </div>
                  
                  {/* MAXIMIZED SHIP DISPLAY */}
                  <div className="flex-grow w-full flex items-center justify-center relative min-h-0">
                    {/* Added padding p-6 to make ship icon smaller and allow room for shields */}
                    <div className="h-full aspect-square flex items-center justify-center relative p-6">
                        <ShipIcon 
                            config={config as any} 
                            hullColor={gameState.shipColors[inst.instanceId]} 
                            wingColor={gameState.shipWingColors[inst.instanceId]} 
                            cockpitColor={gameState.shipCockpitColors[inst.instanceId]} 
                            gunColor={gameState.shipGunColors[inst.instanceId]} 
                            secondaryGunColor={gameState.shipSecondaryGunColors[inst.instanceId]}
                            gunBodyColor={gameState.shipGunBodyColors[inst.instanceId]} 
                            engineColor={gameState.shipEngineColors[inst.instanceId]} 
                            nozzleColor={gameState.shipNozzleColors[inst.instanceId]} 
                            className="w-full h-full object-contain" 
                            shield={s1}
                            secondShield={s2}
                            fullShields={true}
                            equippedWeapons={f.weapons}
                            forceShieldScale={true}
                            isCapsule={isDestroyed}
                        />
                        
                        {/* MOBILE STATUS MESSAGE OVERLAY */}
                        {isSelected && (
                            <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none w-full px-8 flex justify-center sm:hidden">
                                 <div className={`text-[8px] font-black uppercase tracking-widest text-center leading-tight whitespace-pre-wrap bg-black/60 backdrop-blur-sm px-2 py-1 rounded border border-zinc-800/50 shadow-sm ${
                                      systemMessage.type === 'error' ? 'text-red-500' : 
                                      systemMessage.type === 'success' ? 'text-blue-400' :
                                      systemMessage.type === 'warning' ? 'text-amber-500' :
                                      'text-emerald-500'
                                  }`}>
                                    {systemMessage.text}
                                 </div>
                            </div>
                        )}

                        {/* OVERLAY UNIT NUMBER - Positioned over bottom of ship/shield area */}
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
                            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded border ${isDestroyed ? 'text-red-500 border-red-500/30' : 'text-zinc-500 border-zinc-800/30'}`}>
                                {isDestroyed ? "STATUS: KIA" : `UNIT 0${trueIdx + 1}`}
                            </span>
                        </div>
                    </div>
                  </div>

                  {/* COMPACT STATS FOOTER */}
                  <div className="w-full mt-auto space-y-1 shrink-0 bg-black/30 p-2 rounded-lg border border-zinc-800/30 relative z-20">
                    <div className="space-y-0.5">
                        <div className={`flex justify-between ${cardStatLabel} uppercase font-black text-zinc-400`}><span>Integrity</span><span>{Math.floor(f.health)}%</span></div>
                        <div className="h-1.5 bg-black rounded-full overflow-hidden border border-zinc-700"><div className={`h-full transition-all duration-500 ${f.health < 30 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} style={{ width: `${f.health}%` }} /></div>
                    </div>
                    <div className="space-y-0.5">
                        <div className={`flex justify-between ${cardStatLabel} uppercase font-black text-zinc-400`}><span>Fuel</span><span>{f.fuel.toFixed(1)}/{config.maxFuel}</span></div>
                        <div className="h-1.5 bg-black rounded-full overflow-hidden border border-zinc-700"><div className={`h-full transition-all duration-500 ${f.fuel < (config.maxFuel*0.2) ? 'bg-red-500 animate-pulse' : 'bg-indigo-500'}`} style={{ width: `${(f.fuel/config.maxFuel)*100}%` }} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 pt-1">
                        <button onClick={(e) => { e.stopPropagation(); setActiveSlotIndex(trueIdx); setIsStoreOpen(true); }} className={`py-2 bg-zinc-900 ${cardBtnText} uppercase font-black rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors`}>REPLACE</button>
                        <button disabled={isDestroyed} onClick={(e) => { e.stopPropagation(); setActiveSlotIndex(trueIdx); setIsLoadoutOpen(true); }} className={`py-2 bg-zinc-900 ${cardBtnText} uppercase font-black rounded border border-zinc-700 hover:bg-zinc-800 ${isDestroyed ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-400 hover:text-white'} transition-colors`}>EQUIP</button>
                        <button disabled={isDestroyed} onClick={(e) => { e.stopPropagation(); setActiveSlotIndex(trueIdx); setIsPaintOpen(true); }} className={`py-2 bg-zinc-900 ${cardBtnText} uppercase font-black rounded border border-zinc-700 hover:bg-zinc-800 ${isDestroyed ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-400 hover:text-white'} transition-colors`}>PAINT</button>
                    </div>
                  </div>
                </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className="flex flex-col gap-2 shrink-0 mb-1">
        <footer className="bg-black p-2 rounded-xl border border-zinc-800 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMessagesOpen(true)} className={`flex flex-col items-center justify-center ${footerIconClass} md:w-12 md:h-12 bg-zinc-900 border border-zinc-800 rounded hover:border-emerald-500 relative`}><span className={footerIconText}>📡</span>{gameState.messages.length > 0 && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-zinc-950" />}</button>
            <button onClick={() => { setIsMarketOpen(true); }} className={`flex flex-col items-center justify-center ${footerIconClass} md:w-12 md:h-12 bg-zinc-900 border border-zinc-800 rounded hover:border-amber-500`}><span className={footerIconText}>💎</span></button>
            <div className="w-[1px] h-8 bg-zinc-800 mx-1 hidden xs:block"/>
            <button onClick={() => setIsCargoOpen(true)} className={`flex flex-col items-center justify-center ${footerIconClass} md:w-12 md:h-12 bg-emerald-950/30 border border-emerald-500/40 rounded hover:bg-emerald-900/50`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={footerSvgSize}>
                    <rect x="9" y="4" width="6" height="6" fill="#fbbf24" stroke="none" />
                    <rect x="5" y="12" width="6" height="6" fill="#10b981" stroke="none" />
                    <rect x="13" y="12" width="6" height="6" fill="#3b82f6" stroke="none" />
                </svg>
            </button>
          </div>
          
          {/* Status Text - No Flashing, Balanced Wrap */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 hidden sm:flex opacity-80 min-w-[200px]">
              <span className={`${btnSize} font-black uppercase tracking-[0.2em] transition-colors duration-200 text-center leading-tight whitespace-pre-wrap ${
                  systemMessage.type === 'error' ? 'text-red-500' : 
                  systemMessage.type === 'success' ? 'text-blue-400' :
                  systemMessage.type === 'warning' ? 'text-amber-500' :
                  'text-emerald-600'
              }`} style={{ textWrap: 'balance' } as any}>{systemMessage.text}</span>
              <div className="w-full max-w-[120px] h-[1px] bg-zinc-900 mt-1 overflow-hidden">
                  <div className={`h-full w-1/2 mx-auto ${
                      systemMessage.type === 'error' ? 'bg-red-500' : 
                      systemMessage.type === 'success' ? 'bg-blue-500' :
                      systemMessage.type === 'warning' ? 'bg-amber-500' :
                      'bg-emerald-900/50'
                  }`} />
              </div>
          </div>

          <div className="flex gap-2 items-center">
            <button disabled={selectedShipDestroyed} onClick={onRepair} className={`${btnPad} md:py-3 bg-zinc-900 border border-zinc-700 ${btnSize} uppercase font-black rounded hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed`}>REPAIR</button>
            <button disabled={selectedShipDestroyed} onClick={onRefuel} className={`${btnPad} md:py-3 bg-zinc-900 border border-zinc-700 ${btnSize} uppercase font-black rounded hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed`}>REFUEL</button>
            <div className="w-[1px] h-8 bg-zinc-800 mx-1 hidden md:block landscape:block"/>
            {allShipsCompromised ? (
                <button onClick={() => setScreen('intro')} className={`hidden md:block landscape:block ${btnPad} md:py-3 bg-red-600 border-2 border-red-500 text-white ${btnSize} font-black uppercase rounded shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:bg-red-500 transition-all hover:scale-105 active:scale-95 animate-pulse`}>ABORT</button>
            ) : (
                <button onClick={onLaunch} className={`hidden md:block landscape:block ${btnPad} md:py-3 bg-emerald-600 border-2 border-emerald-500 text-white ${btnSize} font-black uppercase rounded shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:bg-emerald-500 transition-all hover:scale-105 active:scale-95`}>LAUNCH</button>
            )}
          </div>
        </footer>
        {allShipsCompromised ? (
            <button onClick={() => setScreen('intro')} className="md:hidden landscape:hidden w-full py-4 bg-red-600 border-b-4 border-red-800 text-white text-xs md:text-sm font-black uppercase tracking-[0.4em] rounded-xl shadow-[0_10px_30px_rgba(220,38,38,0.3)] transition-all hover:scale-[1.01] active:scale-95 active:border-b-0 hover:bg-red-500 flex items-center justify-center gap-4 animate-pulse">⚠️ ABORT MISSION ⚠️</button>
        ) : (
            <button onClick={onLaunch} className="md:hidden landscape:hidden w-full py-4 bg-emerald-600 border-b-4 border-emerald-800 text-white text-xs md:text-sm font-black uppercase tracking-[0.4em] rounded-xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.01] active:scale-95 active:border-b-0 hover:bg-emerald-500 flex items-center justify-center gap-4"><span className="animate-pulse">▶</span> LAUNCH TO ORBIT <span className="animate-pulse">◀</span></button>
        )}
      </div>
    </div>
  );
};
