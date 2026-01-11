
import React, { useRef } from 'react';
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
  setActiveSlotIndex
}) => {
  const touchStart = useRef<number | null>(null);
  
  const fs = gameState.settings.fontSize || 'medium';
  // SCALE UP STRATEGY: Small (+10% from base), Medium (+20%), Large (+40%)
  // Titles: SM 11px / MD 13px / LG 16px
  const titleSize = fs === 'small' ? 'text-[11px]' : (fs === 'large' ? 'text-[16px]' : 'text-[13px]');
  // Buttons: SM 10px / MD 12px / LG 14px
  const btnSize = fs === 'small' ? 'text-[10px]' : (fs === 'large' ? 'text-[14px]' : 'text-[12px]');
  // Labels: SM 8px / MD 10px / LG 12px
  const lblSize = fs === 'small' ? 'text-[8px]' : (fs === 'large' ? 'text-[12px]' : 'text-[10px]');
  // Avatar Size (Container + Icon Text)
  const pilotIconSize = fs === 'small' ? 'w-10 h-10 text-xl' : (fs === 'large' ? 'w-16 h-16 text-4xl' : 'w-12 h-12 text-2xl');
  // Footer Icon Size
  const footerIconClass = fs === 'small' ? 'w-10 h-10' : (fs === 'large' ? 'w-14 h-14' : 'w-12 h-12');
  const footerIconText = fs === 'small' ? 'text-lg' : (fs === 'large' ? 'text-3xl' : 'text-2xl');
  const footerSvgSize = fs === 'small' ? 'w-5 h-5' : (fs === 'large' ? 'w-8 h-8' : 'w-6 h-6');
  // Footer Button Padding
  const btnPad = fs === 'small' ? 'px-6 py-2' : (fs === 'large' ? 'px-8 py-4' : 'px-7 py-3');

  return (
    <div className="flex-grow flex flex-col p-4 md:p-6 z-10 overflow-hidden relative w-full h-full">
      {/* HEADER TITLE - Hidden on mobile portrait */}
      <div className="w-full text-center py-2 shrink-0 hidden md:block"><h1 className={`retro-font ${fs === 'small' ? 'text-[12px]' : (fs === 'large' ? 'text-[18px]' : 'text-[15px]')} text-emerald-500 uppercase tracking-[0.3em] opacity-80`}>COMMAND CENTER</h1></div>
      
      {/* HEADER */}
      <div className="w-full h-16 bg-zinc-950/60 border-y border-zinc-800/50 flex items-center justify-between px-4 md:px-6 shrink-0 backdrop-blur-sm">
        <div className="flex flex-col gap-1 min-w-[80px]">
          <div className="flex items-center gap-2">
             <button onClick={() => setIsOptionsOpen(true)} className={`${pilotIconSize} flex items-center justify-center bg-zinc-900 border border-zinc-700 rounded hover:border-emerald-500 transition-colors`}>{gameState.pilotAvatar}</button>
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

      {/* FLEET CAROUSEL - Show all panels always */}
      <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden mt-4 mb-4 relative touch-pan-y" 
           onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }} 
           onTouchEnd={(e) => { 
             if (touchStart.current === null) return; 
             const diff = touchStart.current - e.changedTouches[0].clientX; 
             if (Math.abs(diff) > 50) { 
               // Swipe logic still retained for selection state, though all visible
               const dir = diff > 0 ? 1 : -1;
               let ni = activeSlotIndex + dir; 
               if (ni >= 0 && ni < MAX_FLEET_SIZE) { 
                 setActiveSlotIndex(ni); 
                 setGameState(p => ({ ...p, selectedShipInstanceId: p.ownedShips[ni]?.instanceId || p.selectedShipInstanceId })); 
               } 
             } 
             touchStart.current = null; 
           }}>
        {gameState.ownedShips.map((inst, idx) => {
          const f = gameState.shipFittings[inst.instanceId];
          const config = SHIPS.find(s => s.id === inst.shipTypeId);
          if (!config || !f) return null;
          const isSelected = gameState.selectedShipInstanceId === inst.instanceId;
          
          // Resolve shields for visualization
          const s1 = f.shieldId ? (f.shieldId === 'dev_god_mode' ? { id: 'dev_god_mode', name: 'DEV', color: '#ffffff', visualType: 'full', capacity: 9999, regenRate: 100, energyCost: 0 } as Shield : [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === f.shieldId) || null) : null;
          const s2 = f.secondShieldId ? (f.secondShieldId === 'dev_god_mode' ? { id: 'dev_god_mode', name: 'DEV', color: '#ffffff', visualType: 'full', capacity: 9999, regenRate: 100, energyCost: 0 } as Shield : [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === f.secondShieldId) || null) : null;

          return (
            <div key={idx} onClick={() => { setGameState(p => ({ ...p, selectedShipInstanceId: inst.instanceId })); setActiveSlotIndex(idx); }} 
                 className={`flex-1 border-2 p-4 flex flex-col items-center rounded-xl transition-all cursor-pointer relative h-full
                 ${isSelected 
                    ? 'border-emerald-500 bg-emerald-950/20 shadow-lg z-10' 
                    : 'border-emerald-900/30 bg-zinc-950/40 opacity-70 hover:opacity-100'}`}>
              <div className="w-full flex justify-between items-center mb-2 shrink-0">
                  <span className={`retro-font ${fs === 'small' ? 'text-[10px]' : (fs === 'large' ? 'text-[14px]' : 'text-[12px]')} text-emerald-500 uppercase`}>{config.name}</span>
                  <span className={`${lblSize} uppercase text-zinc-500`}>UNIT 0{idx + 1}</span>
              </div>
              
              {/* RESPONSIVE SHIP DISPLAY - FLUID HEIGHT */}
              <div className="flex-grow w-full flex items-center justify-center relative p-1 min-h-0">
                <div className="w-full h-full flex items-center justify-center">
                    <ShipIcon 
                        config={config as any} 
                        hullColor={gameState.shipColors[inst.instanceId]} 
                        wingColor={gameState.shipWingColors[inst.instanceId]} 
                        cockpitColor={gameState.shipCockpitColors[inst.instanceId]} 
                        gunColor={gameState.shipGunColors[inst.instanceId]} 
                        gunBodyColor={gameState.shipGunBodyColors[inst.instanceId]} 
                        engineColor={gameState.shipEngineColors[inst.instanceId]} 
                        nozzleColor={gameState.shipNozzleColors[inst.instanceId]} 
                        className="w-full h-full" 
                        shield={s1}
                        secondShield={s2}
                        fullShields={true}
                    />
                </div>
              </div>

              <div className="w-full mt-auto space-y-3 shrink-0">
                <div className="space-y-1">
                    <div className={`flex justify-between ${lblSize} uppercase font-black`}><span>Integrity</span><span>{Math.floor(f.health)}%</span></div>
                    <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${f.health < 30 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} style={{ width: `${f.health}%` }} /></div>
                </div>
                <div className="space-y-1">
                    <div className={`flex justify-between ${lblSize} uppercase font-black`}><span>Fuel Level</span><span>{f.fuel.toFixed(1)} / {config.maxFuel}</span></div>
                    <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${f.fuel < (config.maxFuel*0.2) ? 'bg-red-500 animate-pulse' : 'bg-indigo-500'}`} style={{ width: `${(f.fuel/config.maxFuel)*100}%` }} /></div>
                </div>
                <div className="grid grid-cols-3 gap-1 pt-2">
                    <button onClick={(e) => { e.stopPropagation(); setIsStoreOpen(true); }} className={`py-2 bg-zinc-900 ${btnSize} uppercase font-black rounded border border-zinc-800 hover:bg-zinc-800`}>REPLACE</button>
                    <button onClick={(e) => { e.stopPropagation(); setIsLoadoutOpen(true); }} className={`py-2 bg-zinc-900 ${btnSize} uppercase font-black rounded border border-zinc-800 hover:bg-zinc-800`}>EQUIP</button>
                    <button onClick={(e) => { e.stopPropagation(); setIsPaintOpen(true); }} className={`py-2 bg-zinc-900 ${btnSize} uppercase font-black rounded border border-zinc-800 hover:bg-zinc-800`}>PAINT</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className="flex flex-col gap-3 shrink-0 mb-2">
        <footer className="bg-zinc-950/90 p-2 md:p-3 rounded-xl border border-zinc-800 flex justify-between items-center backdrop-blur-md">
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
          <div className="flex gap-2 items-center">
            <button onClick={onRepair} className={`${btnPad} md:py-3 bg-zinc-900 border border-zinc-700 ${btnSize} uppercase font-black rounded hover:bg-zinc-800`}>REPAIR</button>
            <button onClick={onRefuel} className={`${btnPad} md:py-3 bg-zinc-900 border border-zinc-700 ${btnSize} uppercase font-black rounded hover:bg-zinc-800`}>REFUEL</button>
            <div className="w-[1px] h-8 bg-zinc-800 mx-1 hidden md:block landscape:block"/>
            <button onClick={onLaunch} className={`hidden md:block landscape:block ${btnPad} md:py-3 bg-emerald-600 border-2 border-emerald-500 text-white ${btnSize} font-black uppercase rounded shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:bg-emerald-500 transition-all hover:scale-105 active:scale-95`}>LAUNCH</button>
          </div>
        </footer>
        <button onClick={onLaunch} className="md:hidden landscape:hidden w-full py-5 bg-emerald-600 border-b-4 border-emerald-800 text-white text-xs md:text-sm font-black uppercase tracking-[0.4em] rounded-xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.01] active:scale-95 active:border-b-0 hover:bg-emerald-500 flex items-center justify-center gap-4"><span className="animate-pulse">▶</span> LAUNCH TO ORBIT <span className="animate-pulse">◀</span></button>
      </div>
    </div>
  );
};
