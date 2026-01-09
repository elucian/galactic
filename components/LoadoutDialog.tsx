
import React from 'react';
import { ShipFitting, ShipConfig } from '../types.ts';
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
  fontSize: 'small' | 'medium' | 'large';
}

export const LoadoutDialog: React.FC<LoadoutDialogProps> = ({
  isOpen, onClose, fitting, shipConfig, loadoutTab, setLoadoutTab, activeFittingSlot, setActiveFittingSlot, unmountSlot, mountFromCargo, testMode, setGodMode, fontSize
}) => {
  if (!isOpen || !fitting) return null;

  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');
  const btnPadding = fontSize === 'small' ? 'px-6 py-3' : (fontSize === 'large' ? 'px-8 py-5' : 'px-7 py-4');
  const iconSize = fontSize === 'small' ? 30 : (fontSize === 'large' ? 44 : 36);
  const listIconSize = fontSize === 'small' ? 22 : (fontSize === 'large' ? 30 : 26);

  const isExoticItem = (id?: string) => {
      if (!id) return false;
      return [...EXOTIC_WEAPONS, ...EXOTIC_SHIELDS].some(ex => ex.id === id);
  };

  return (
    <div className="fixed inset-0 z-[9900] bg-black/95 flex items-center justify-center p-4 backdrop-blur-2xl">
       <div className="w-full max-w-3xl bg-zinc-950 border-2 border-zinc-800 rounded-xl flex flex-col h-[70vh] shadow-2xl overflow-hidden">
          <header className="p-4 border-b border-zinc-800 flex justify-between bg-zinc-900/50 shrink-0">
             <div className="flex gap-2">
                {['guns', 'defense'].map(t => (
                    <button key={t} onClick={() => { setLoadoutTab(t as any); setActiveFittingSlot(0); }} className={`${btnPadding} ${btnSize} font-black uppercase border-b-2 transition-all ${loadoutTab === t ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>{t === 'guns' ? 'WEAPON HARDPOINTS' : 'SHIELD MATRIX'}</button>
                ))}
             </div>
             <button onClick={onClose} className={`px-6 py-2 bg-zinc-900 border border-zinc-700 text-zinc-400 font-black ${btnSize} rounded hover:text-white hover:border-zinc-500`}>CLOSE</button>
          </header>
          
          <div className="flex-grow flex flex-col p-6 gap-6 overflow-hidden">
            <div className="shrink-0">
                <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    MOUNTED SYSTEMS
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {loadoutTab === 'guns' ? (
                        Array.from({ length: shipConfig?.defaultGuns || 1 }).map((_, i) => { 
                            const weapon = [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === fitting.weapons[i]?.id);
                            const isExotic = weapon ? isExoticItem(weapon.id) : false;
                            return (
                                <div key={i} onClick={() => setActiveFittingSlot(i)} className={`relative flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all h-24 ${activeFittingSlot === i ? 'border-emerald-500 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600'}`}>
                                    <div className="absolute top-2 left-3 text-[8px] font-mono text-zinc-600">SLOT 0{i+1}</div>
                                    {weapon ? (
                                        <>
                                            <div className="w-12 h-12 bg-black border border-zinc-700 rounded flex items-center justify-center shrink-0">
                                                <ItemSVG type="weapon" color={weapon.beamColor || '#fff'} size={iconSize} />
                                            </div>
                                            <div className="flex-grow overflow-hidden">
                                                <div className={`text-[10px] font-black uppercase truncate ${isExotic ? 'text-orange-400' : 'text-white'}`}>{weapon.name}</div>
                                                <div className="text-[8px] text-zinc-500 mt-1">DMG: {weapon.damage}</div>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); unmountSlot(i, 'weapon'); }}
                                                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-red-900/20 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors"
                                            >
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="w-full text-center text-[9px] text-zinc-600 font-black uppercase tracking-widest">EMPTY HARDPOINT</div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        [0, 1].map(slot => { 
                            const id = slot === 0 ? fitting.shieldId : fitting.secondShieldId;
                            const sDef = id ? (id === 'dev_god_mode' ? { name: 'DEV SHIELD', capacity: 999999, color: '#fff' } : [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === id)) : null;
                            const isExotic = sDef && 'id' in sDef ? isExoticItem(sDef.id) : false;
                            return (
                                <div key={slot} onClick={() => setActiveFittingSlot(slot)} className={`relative flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all h-24 ${activeFittingSlot === slot ? 'border-emerald-500 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600'}`}>
                                    <div className="absolute top-2 left-3 text-[8px] font-mono text-zinc-600">GENERATOR 0{slot+1}</div>
                                    {sDef ? (
                                        <>
                                            <div className="w-12 h-12 bg-black border border-zinc-700 rounded flex items-center justify-center shrink-0">
                                                <ItemSVG type="shield" color={(sDef as any).color} size={iconSize} />
                                            </div>
                                            <div className="flex-grow overflow-hidden">
                                                <div className={`text-[10px] font-black uppercase truncate ${isExotic ? 'text-orange-400' : 'text-white'}`}>{sDef.name}</div>
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

            <div className="flex-grow flex flex-col overflow-hidden bg-zinc-900/30 border border-zinc-800 rounded-lg">
                <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">AVAILABLE IN CARGO</span>
                    <span className="text-[8px] text-zinc-600 font-mono">SELECT SLOT ABOVE TO EQUIP</span>
                </div>
                <div className="flex-grow overflow-y-auto p-2 custom-scrollbar">
                    {(() => {
                        const filteredCargo = fitting.cargo.filter(it => {
                            if (loadoutTab === 'guns') {
                                return ['weapon', 'gun', 'projectile', 'laser'].includes(it.type) || WEAPONS.some(w => w.id === it.id) || EXOTIC_WEAPONS.some(w => w.id === it.id);
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
                                <div className="h-full flex flex-col items-center justify-center opacity-30">
                                    <span className="text-2xl mb-2 text-zinc-500">📦</span>
                                    <span className="text-[9px] uppercase font-black text-zinc-500">No compatible items in hold</span>
                                </div>
                            );
                        }

                        return (
                            <div className="grid grid-cols-2 gap-2">
                                {filteredCargo.map((it, idx) => {
                                    const realIdx = fitting.cargo.indexOf(it);
                                    const isVirtual = realIdx === -1 && it.id === 'dev_god_mode';
                                    const isExotic = isExoticItem(it.id);
                                    
                                    const sDef = (it.type === 'shield' || SHIELDS.some(s => s.id === it.id)) ? (it.id === 'dev_god_mode' ? { name: 'DEV SHIELD', color: '#fff' } : [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === it.id)) : null;

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
                                            <ItemSVG type={it.type || (sDef ? 'shield' : 'weapon')} color={(sDef as any)?.color ? (sDef as any).color : (isExotic ? '#fb923c' : (loadoutTab === 'guns' ? '#60a5fa' : '#34d399'))} size={listIconSize} />
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
