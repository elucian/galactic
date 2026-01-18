import React, { useEffect } from 'react';
import { ShipFitting, ShipConfig, AmmoType } from '../types.ts';
import { WEAPONS, SHIELDS, EXOTIC_WEAPONS, EXOTIC_SHIELDS } from '../constants.ts';
import { ItemSVG } from './Common.tsx';

interface LoadoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fitting: ShipFitting;
  shipConfig: ShipConfig | null;
  loadoutTab: 'guns' | 'defense';
  setLoadoutTab: (t: 'guns' | 'defense') => void;
  activeFittingSlot: number;
  setActiveFittingSlot: (i: number) => void;
  unmountSlot: (slotIdx: number, type: 'weapon' | 'shield') => void;
  mountFromCargo: (cargoIdx: number, slotIdx: number, type: 'weapon' | 'shield') => void;
  testMode: boolean;
  setGodMode: (slotIdx: number) => void;
  buyAmmo: (type: AmmoType) => void;
  selectAmmo: (type: AmmoType) => void;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
}

export const LoadoutDialog: React.FC<LoadoutDialogProps> = ({
  isOpen, onClose, fitting, shipConfig, loadoutTab, setLoadoutTab, activeFittingSlot, setActiveFittingSlot, unmountSlot, mountFromCargo, testMode, setGodMode, fontSize
}) => {
  // Determine available slots based on ship type
  const availableSlots = (() => {
      if ((shipConfig as any)?.isAlien) {
          if (shipConfig?.defaultGuns === 1) return [0]; // Main only
          if (shipConfig?.defaultGuns === 2) return [1, 2]; // Wings only
      }
      return [0, 1, 2];
  })();

  // Ensure active slot is valid when opening or switching tabs
  useEffect(() => {
      if (isOpen && !availableSlots.includes(activeFittingSlot)) {
          setActiveFittingSlot(availableSlots[0]);
      }
  }, [isOpen, loadoutTab, availableSlots, activeFittingSlot, setActiveFittingSlot]);

  if (!isOpen || !fitting) return null;

  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');
  const btnPadding = fontSize === 'small' ? 'px-6 py-3' : (fontSize === 'large' ? 'px-8 py-5' : 'px-7 py-4');
  const iconSize = fontSize === 'small' ? 30 : (fontSize === 'large' ? 44 : 36);
  const listIconSize = fontSize === 'small' ? 22 : (fontSize === 'large' ? 30 : 26);

  const isExoticItem = (id?: string) => {
      if (!id) return false;
      return [...EXOTIC_WEAPONS, ...EXOTIC_SHIELDS].some(ex => ex.id === id);
  };

  const isAlien = (shipConfig as any)?.isAlien;

  return (
    <div className="fixed inset-0 z-[9900] bg-black/95 flex items-center justify-center p-4 backdrop-blur-2xl">
       <div className="w-full max-w-4xl bg-zinc-950 border-2 border-zinc-800 rounded-xl flex flex-col h-[85vh] shadow-2xl overflow-hidden">
          <header className="p-4 border-b border-zinc-800 flex justify-between bg-zinc-900/50 shrink-0">
             <div className="flex gap-2">
                {['guns', 'defense'].map(t => (
                    <button key={t} onClick={() => { setLoadoutTab(t as any); setActiveFittingSlot(availableSlots[0]); }} className={`${btnPadding} ${btnSize} font-black uppercase border-b-2 transition-all ${loadoutTab === t ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>{t === 'guns' ? 'WEAPON SYSTEMS' : 'SHIELD MATRIX'}</button>
                ))}
             </div>
             <button onClick={onClose} className={`px-6 py-2 bg-zinc-900 border border-zinc-700 text-zinc-400 font-black ${btnSize} rounded hover:text-white hover:border-zinc-500`}>CLOSE</button>
          </header>
          
          <div className="flex-grow flex overflow-hidden">
            {/* LEFT COLUMN: FITTINGS */}
            <div className="w-1/2 flex flex-col p-6 gap-6 border-r border-zinc-800 overflow-y-auto">
                <div className="shrink-0">
                    <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        MOUNTED SYSTEMS
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        {loadoutTab === 'guns' ? (
                            availableSlots.map((slotIdx) => { 
                                const weapon = [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === fitting.weapons[slotIdx]?.id);
                                const isExoticWeapon = weapon ? isExoticItem(weapon.id) : false;
                                let label = 'UNKNOWN MOUNT';
                                if (slotIdx === 0) label = isAlien ? 'PRIMARY EMITTER' : 'MAIN MOUNT (ENERGY)';
                                else if (slotIdx === 1) label = isAlien ? 'LEFT EMITTER' : 'LEFT WING (AMMO)';
                                else if (slotIdx === 2) label = isAlien ? 'RIGHT EMITTER' : 'RIGHT WING (AMMO)';

                                return (
                                    <div key={slotIdx} onClick={() => setActiveFittingSlot(slotIdx)} className={`relative flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all h-24 ${activeFittingSlot === slotIdx ? 'border-emerald-500 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600'}`}>
                                        <div className="absolute top-2 left-3 text-[8px] font-mono text-zinc-600">
                                            {label}
                                        </div>
                                        {weapon ? (
                                            <>
                                                <div className="w-12 h-12 bg-black border border-zinc-700 rounded flex items-center justify-center shrink-0">
                                                    <ItemSVG type="weapon" color={weapon.beamColor || '#fff'} size={iconSize} />
                                                </div>
                                                <div className="flex-grow overflow-hidden">
                                                    <div className={`text-[10px] font-black uppercase truncate ${isExoticWeapon ? 'text-orange-400' : 'text-white'}`}>{weapon.name}</div>
                                                    <div className="text-[8px] text-zinc-500 mt-1">DMG: {weapon.damage} {weapon.isAmmoBased ? '(AMMO)' : '(ENERGY)'}</div>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); unmountSlot(slotIdx, 'weapon'); }}
                                                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-red-900/20 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors"
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            </>
                                        ) : (
                                            <div className="w-full text-center text-[9px] text-zinc-600 font-black uppercase tracking-widest">EMPTY MOUNT</div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            [0, 1].map(slot => { 
                                const id = slot === 0 ? fitting.shieldId : fitting.secondShieldId;
                                const sDef = id ? (id === 'dev_god_mode' ? { name: 'DEV SHIELD', capacity: 999999, color: '#fff' } : [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === id)) : null;
                                const isExoticShield = sDef && 'id' in sDef ? isExoticItem(sDef.id) : false;
                                return (
                                    <div key={slot} onClick={() => setActiveFittingSlot(slot)} className={`relative flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all h-24 ${activeFittingSlot === slot ? 'border-emerald-500 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600'}`}>
                                        <div className="absolute top-2 left-3 text-[8px] font-mono text-zinc-600">GENERATOR 0{slot+1}</div>
                                        {sDef ? (
                                            <>
                                                <div className="w-12 h-12 bg-black border border-zinc-700 rounded flex items-center justify-center shrink-0">
                                                    <ItemSVG type="shield" color={(sDef as any).color} size={iconSize} />
                                                </div>
                                                <div className="flex-grow overflow-hidden">
                                                    <div className={`text-[10px] font-black uppercase truncate ${isExoticShield ? 'text-orange-400' : 'text-white'}`}>{sDef.name}</div>
                                                    <div className="text-[8px] text-zinc-500 mt-1">CAP: {sDef.capacity}</div>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); unmountSlot(slot, 'shield'); }}
                                                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-red-900/20 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors"
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            </>
                                        ) : (
                                            <div className="w-full text-center text-[9px] text-zinc-600 font-black uppercase tracking-widest">NO SHIELD CORE</div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: CARGO */}
            <div className="w-1/2 flex flex-col overflow-hidden bg-zinc-900/30">
                <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">AVAILABLE IN CARGO</span>
                    <span className="text-[8px] text-zinc-600 font-mono">SELECT SLOT LEFT TO EQUIP</span>
                </div>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {(() => {
                        const filteredCargo = fitting.cargo.filter(it => {
                            if (loadoutTab === 'guns') {
                                // Filter by Type first
                                if (!['weapon', 'gun', 'projectile', 'laser'].includes(it.type)) {
                                    // Check if ID matches a weapon definition
                                    if (!WEAPONS.some(w => w.id === it.id) && !EXOTIC_WEAPONS.some(w => w.id === it.id)) return false;
                                }
                                
                                const weaponDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === it.id);
                                if (!weaponDef) return false;

                                if (isAlien) {
                                    // ALIEN SHIP RULES:
                                    // Can use ANY slot for Energy/Exotic.
                                    // Cannot use Ammo weapons.
                                    return !weaponDef.isAmmoBased;
                                } else {
                                    // STANDARD SHIP RULES:
                                    // Slot 0 = Main Gun (Energy/Exotic only, NO AMMO)
                                    if (activeFittingSlot === 0) {
                                        return !weaponDef.isAmmoBased;
                                    }
                                    // Slot 1 & 2 = Auxiliary (Standard only, AMMO BASED)
                                    else {
                                        return weaponDef.isAmmoBased;
                                    }
                                }
                            }
                            if (loadoutTab === 'defense') {
                                return ['shield'].includes(it.type) || SHIELDS.some(s => s.id === it.id) || EXOTIC_SHIELDS.some(s => s.id === it.id);
                            }
                            return false;
                        });
                        
                        if (loadoutTab === 'defense' && testMode) {
                            const godId = 'dev_god_mode';
                            if (!fitting.shieldId?.includes(godId) && !fitting.secondShieldId?.includes(godId) && !filteredCargo.some(c => c.id === godId)) {
                                filteredCargo.unshift({
                                    instanceId: 'dev_god_mode_virtual',
                                    type: 'shield',
                                    id: godId,
                                    name: 'DEV: GOD MODE',
                                    weight: 0,
                                    quantity: 1
                                });
                            }
                        }

                        if (filteredCargo.length === 0) {
                            return (
                                <div className="h-full flex flex-col items-center justify-center opacity-30 text-center p-8">
                                    <span className="text-2xl mb-2 text-zinc-500">📦</span>
                                    <span className="text-[9px] uppercase font-black text-zinc-500">
                                        {loadoutTab === 'guns' 
                                            ? (isAlien ? "No Energy/Exotic Weapons Available" : (activeFittingSlot === 0 ? "No Energy/Exotic Weapons Available" : "No Standard Ammo Weapons Available")) 
                                            : "No compatible shields"}
                                    </span>
                                </div>
                            );
                        }

                        return (
                            <div className="grid grid-cols-1 gap-2">
                                {filteredCargo.map((it, idx) => {
                                    const realIdx = fitting.cargo.indexOf(it);
                                    const isVirtual = realIdx === -1 && it.id === 'dev_god_mode';
                                    const isExotic = isExoticItem(it.id);
                                    
                                    const sDef = (it.type === 'shield' || SHIELDS.some(s => s.id === it.id)) ? (it.id === 'dev_god_mode' ? { name: 'DEV SHIELD', color: '#fff' } : [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === it.id)) : null;
                                    
                                    // Coloring logic for the icon in list
                                    let iconColor = (sDef as any)?.color ? (sDef as any).color : (isExotic ? '#fb923c' : (loadoutTab === 'guns' ? '#60a5fa' : '#34d399'));
                                    if (loadoutTab === 'guns' && !isExotic) {
                                        const wDef = [...WEAPONS].find(w => w.id === it.id);
                                        if (wDef?.type === 'PROJECTILE') iconColor = '#9ca3af'; // Gray
                                        else if (wDef?.type === 'LASER') iconColor = wDef.beamColor || '#3b82f6'; // Beam Color
                                    }

                                    return (
                                        <button 
                                            key={it.instanceId} 
                                            onClick={() => {
                                                if (isVirtual) {
                                                    setGodMode(activeFittingSlot);
                                                } else {
                                                    mountFromCargo(realIdx, activeFittingSlot, loadoutTab === 'guns' ? 'weapon' : 'shield');
                                                }
                                            }} 
                                            className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 hover:border-emerald-500 hover:bg-emerald-950/10 rounded transition-all text-left group"
                                        >
                                            <ItemSVG type={it.type || (sDef ? 'shield' : 'weapon')} color={iconColor} size={listIconSize} />
                                            <div className="flex-grow">
                                                <div className={`text-[9px] font-black uppercase truncate ${isExotic ? 'text-orange-400 group-hover:text-orange-300' : 'text-emerald-400 group-hover:text-white'}`}>{it.name}</div>
                                                <div className="text-[8px] text-zinc-600">QTY: {it.quantity}</div>
                                            </div>
                                            <div className="text-[10px] text-zinc-600 group-hover:text-emerald-400">➜</div>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            </div>
          </div>
       </div>
    </div>
  );
};