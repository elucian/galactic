
import React, { useState } from 'react';
import { ExtendedShipConfig } from './constants';
import GameEngine from './components/GameEngine';

// Export ShipIcon for LaunchSequence
export const ShipIcon: React.FC<{
  config: ExtendedShipConfig;
  showJets?: boolean;
  className?: string;
  color?: string;
}> = ({ config, showJets, className, color }) => {
  return (
    <div className={`relative ${className || ''}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full" style={{ fill: color || config.defaultColor }}>
        {/* Simple ship representation */}
        <path d="M50 5 L95 95 L50 75 L5 95 Z" />
      </svg>
      {showJets && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-1/2 bg-blue-400 blur-md opacity-80 animate-pulse" />
      )}
    </div>
  );
};

export default function App() {
  const [showManual, setShowManual] = useState(false);
  
  // Placeholder for game state management
  const [gameActive, setGameActive] = useState(false);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">
       {/* Main Game Container */}
       <div className="absolute inset-0">
          {!gameActive ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
               <h1 className="text-4xl text-emerald-500 retro-font">GALAXY DEFENDER</h1>
               <button 
                 onClick={() => setGameActive(true)}
                 className="px-6 py-2 border border-emerald-500 text-emerald-500 hover:bg-emerald-500/20"
               >
                 START MISSION
               </button>
               <button 
                 onClick={() => setShowManual(true)}
                 className="px-6 py-2 border border-emerald-500 text-emerald-500 hover:bg-emerald-500/20"
               >
                 MANUAL
               </button>
            </div>
          ) : (
             <GameEngine onGameOver={() => setGameActive(false)} />
          )}
       </div>

      {showManual && (<div className="fixed inset-0 z-[9000] bg-black/95 flex items-center justify-center p-10 backdrop-blur-md" onClick={() => setShowManual(false)}><div className="max-w-xl bg-zinc-950 border border-emerald-500/40 p-10 rounded-xl space-y-6" onClick={e => e.stopPropagation()}><h3 className="retro-font text-emerald-500 text-lg uppercase">Flight Manual</h3><div className="space-y-4 text-[12px] uppercase text-zinc-400"><p>• [WASD / ARROWS] TO MANEUVER SHIP</p><p>• [SHIFT] TO FIRE PRIMARY CANNONS</p><p>• [\ OR TAB] TO LAUNCH TRACKING MISSILES</p><p>• [ENTER OR CAPS] TO DEPLOY KINETIC SHOCK MINES</p><p>• [ESC] TO ABORT MISSION</p></div><button onClick={() => setShowManual(false)} className="w-full py-4 bg-emerald-600/20 border border-emerald-500 text-emerald-500 font-black uppercase text-[10px]">ACKNOWLEDGED</button></div></div>)}
    </div>
  );
}
