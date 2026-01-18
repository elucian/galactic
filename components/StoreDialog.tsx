
import React from 'react';
import { SHIPS, WEAPONS, EXOTIC_WEAPONS } from '../constants.ts';
import { ShipIcon } from './ShipIcon.tsx';
import { ExtendedShipConfig } from '../constants.ts';

interface StoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  inspectedShipId: string;
  setInspectedShipId: (id: string) => void;
  credits: number;
  replaceShip: (shipTypeId: string) => void;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  testMode?: boolean; 
}

export const StoreDialog: React.FC<StoreDialogProps> = ({
  isOpen, onClose, inspectedShipId, setInspectedShipId, credits, replaceShip, fontSize, testMode
}) => {
  if (!isOpen || !inspectedShipId) return null;

  const titleSize = fontSize === 'small' ? 'text-[11px]' : (fontSize === 'large' ? 'text-[16px]' : 'text-[13px]');
  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');
  const btnPadding = fontSize === 'small' ? 'px-6 py-2' : (fontSize === 'large' ? 'px-10 py-4' : 'px-8 py-3');
  const textClass = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[13px]' : 'text-[11px]');
  const largeTextClass = fontSize === 'small' ? 'text-[11px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');

  const ship = SHIPS.find(s => s.id === inspectedShipId)!;
  const canAfford = credits >= ship.price;

  // Filter Ships: Show standard ships + Alien ships ONLY if testMode is true
  const availableShips = SHIPS.filter(s => !s.isAlien || (s.isAlien && testMode));

  // Logic to determine default weapon based on ship tier (matching App.tsx logic)
  const getDefaultWeaponId = (shipConfig: ExtendedShipConfig) => {
      if (shipConfig.isAlien) return shipConfig.weaponId || 'exotic_plasma_orb';
      
      const index = SHIPS.findIndex(s => s.id === shipConfig.id);
      // Ships index 3 (Eclipse) and 4 (Behemoth) get Level 4 Photon Emitter
      if (index >= 3 && index <= 4) return 'gun_photon';
      
      // Others get Level 1 Pulse Laser
      return 'gun_pulse';
  };

  // Helper to get weapon definition color for the crystal
  const getWeaponColor = (weaponId: string) => {
      const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === weaponId);
      return def?.beamColor;
  };

  const currentDefaultWeaponId = getDefaultWeaponId(ship);
  const currentWeaponColor = getWeaponColor(currentDefaultWeaponId);

  // Construct equipped weapons for preview
  const getPreviewEquipped = () => {
      if (ship.isAlien) {
          // A-Class gets 1 main weapon
          if (ship.defaultGuns === 1) return [{id: currentDefaultWeaponId, count: 1}, null, null];
          // Others get 2 wing weapons
          return [null, {id: currentDefaultWeaponId, count: 1}, {id: currentDefaultWeaponId, count: 1}];
      }
      // Standard ships just show main gun in slot 0 for preview
      return [{id: currentDefaultWeaponId, count:1}, null, null];
  };

  const previewEquipped = getPreviewEquipped();

  return (
    <div className="fixed inset-0 z-[9900] bg-black/95 flex items-center justify-center p-4 backdrop-blur-2xl">
        <div className="w-full max-w-5xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[90vh] shadow-2xl">
            <header className="p-4 border-b border-zinc-800 flex justify-between bg-zinc-900/50 shrink-0">
                <h2 className={`retro-font text-emerald-500 ${titleSize} uppercase`}>Fleet Requisition</h2>
                <button onClick={onClose} className={`text-red-500 font-black ${btnSize}`}>DONE</button>
            </header>
            <div className="flex-grow flex overflow-hidden">
                <div className="w-1/3 border-r border-zinc-800 bg-black/40 overflow-y-auto p-2 space-y-2">
                    {availableShips.map(s => {
                        const defaultWep = getDefaultWeaponId(s);
                        const wepColor = getWeaponColor(defaultWep);
                        
                        // Mini preview logic
                        let miniEquipped = [{id: defaultWep, count:1}, null, null];
                        if (s.isAlien && s.defaultGuns === 2) miniEquipped = [null, {id: defaultWep, count:1}, {id: defaultWep, count:1}];

                        return (
                            <button key={s.id} onClick={() => setInspectedShipId(s.id)} className={`w-full p-3 flex items-center gap-3 border transition-all ${inspectedShipId === s.id ? 'bg-emerald-900/20 border-emerald-500' : 'bg-zinc-900/30 border-zinc-800'}`}>
                                <ShipIcon 
                                    config={s} 
                                    className="w-10 h-10" 
                                    equippedWeapons={miniEquipped as any} 
                                    gunColor={wepColor} // Pass weapon color to override ship default gun color
                                />
                                <div className="flex flex-col items-start">
                                    <span className={`${largeTextClass} font-black uppercase ${s.isAlien ? 'text-orange-400' : 'text-white'} truncate`}>{s.name}</span>
                                    <span className={`${textClass} text-zinc-500`}>${s.price.toLocaleString()}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="w-2/3 flex flex-col h-full bg-zinc-900/10">
                    {ship && (
                    <>
                        <div className="flex-grow flex flex-col items-center justify-center relative p-6">
                            
                            {/* SHIP PREVIEW */}
                            <ShipIcon 
                                config={ship} 
                                className="w-48 h-48 sm:w-72 sm:h-72 mb-8 drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]" 
                                showJets={false} 
                                equippedWeapons={previewEquipped as any} 
                                gunColor={currentWeaponColor}
                            />
                            
                            {/* COMPACT STATS ROW */}
                            <div className="flex flex-wrap justify-center gap-3 w-full max-w-2xl px-4">
                                <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded flex flex-col items-center min-w-[80px] shadow-lg backdrop-blur-sm">
                                    <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Hold</span>
                                    <span className="text-white font-black text-lg leading-none">{ship.maxCargo}</span>
                                </div>
                                <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded flex flex-col items-center min-w-[80px] shadow-lg backdrop-blur-sm">
                                    <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Fuel</span>
                                    <span className="text-white font-black text-lg leading-none">{ship.maxFuel}U</span>
                                </div>
                                <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded flex flex-col items-center min-w-[80px] shadow-lg backdrop-blur-sm">
                                    <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Energy</span>
                                    <span className="text-white font-black text-lg leading-none">{ship.maxEnergy}</span>
                                </div>
                                <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded flex flex-col items-center min-w-[80px] shadow-lg backdrop-blur-sm">
                                    <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Slots</span>
                                    <span className="text-emerald-400 font-black text-lg leading-none">{ship.isAlien ? (ship.defaultGuns === 1 ? '1' : '2') : '3'}</span>
                                </div>
                                <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded flex flex-col items-center min-w-[140px] shadow-lg backdrop-blur-sm">
                                    <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Primary System</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: currentWeaponColor || '#fff', color: currentWeaponColor || '#fff' }}></div>
                                        <span className="text-white font-black text-xs uppercase truncate max-w-[120px]">
                                            {[...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === currentDefaultWeaponId)?.name || 'UNKNOWN'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* PURCHASE FOOTER */}
                        <div className="mt-auto border-t border-zinc-800 p-6 bg-zinc-900/50 flex justify-between items-center shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-10">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-1">Requisition Cost</span>
                                <span className={`text-4xl font-black tabular-nums tracking-tight ${canAfford ? 'text-emerald-400' : 'text-red-500'}`}>${ship.price.toLocaleString()}</span>
                            </div>
                            <button 
                                onClick={() => replaceShip(ship.id)} 
                                disabled={!canAfford} 
                                className={`${btnPadding} bg-emerald-600 text-white font-black uppercase ${btnSize} rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-500 hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2`}
                            >
                                <span>CONFIRM PURCHASE</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                        </div>
                    </>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
