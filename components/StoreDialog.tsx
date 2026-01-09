
import React from 'react';
import { SHIPS } from '../constants.ts';
import { ShipIcon } from './ShipIcon.tsx';

interface StoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  inspectedShipId: string;
  setInspectedShipId: (id: string) => void;
  credits: number;
  replaceShip: (shipTypeId: string) => void;
  fontSize: 'small' | 'medium' | 'large';
}

export const StoreDialog: React.FC<StoreDialogProps> = ({
  isOpen, onClose, inspectedShipId, setInspectedShipId, credits, replaceShip, fontSize
}) => {
  if (!isOpen || !inspectedShipId) return null;

  const titleSize = fontSize === 'small' ? 'text-[11px]' : (fontSize === 'large' ? 'text-[16px]' : 'text-[13px]');
  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');
  const btnPadding = fontSize === 'small' ? 'px-6 py-2' : (fontSize === 'large' ? 'px-10 py-4' : 'px-8 py-3');
  const textClass = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[13px]' : 'text-[11px]');
  const largeTextClass = fontSize === 'small' ? 'text-[11px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');

  const ship = SHIPS.find(s => s.id === inspectedShipId)!;
  const canAfford = credits >= ship.price;

  return (
    <div className="fixed inset-0 z-[9900] bg-black/95 flex items-center justify-center p-4 backdrop-blur-2xl">
        <div className="w-full max-w-5xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[90vh] shadow-2xl">
            <header className="p-4 border-b border-zinc-800 flex justify-between bg-zinc-900/50 shrink-0">
                <h2 className={`retro-font text-emerald-500 ${titleSize} uppercase`}>Fleet Requisition</h2>
                <button onClick={onClose} className={`text-red-500 font-black ${btnSize}`}>DONE</button>
            </header>
            <div className="flex-grow flex overflow-hidden">
                <div className="w-1/3 border-r border-zinc-800 bg-black/40 overflow-y-auto p-2 space-y-2">
                    {SHIPS.map(s => (
                        <button key={s.id} onClick={() => setInspectedShipId(s.id)} className={`w-full p-3 flex items-center gap-3 border transition-all ${inspectedShipId === s.id ? 'bg-emerald-900/20 border-emerald-500' : 'bg-zinc-900/30 border-zinc-800'}`}>
                            <ShipIcon config={s} className="w-10 h-10"/>
                            <div className="flex flex-col">
                                <span className={`${largeTextClass} font-black uppercase text-white truncate`}>{s.name}</span>
                                <span className={`${textClass} text-zinc-500`}>${s.price.toLocaleString()}</span>
                            </div>
                        </button>
                    ))}
                </div>
                <div className="w-2/3 p-6 flex flex-col overflow-y-auto">
                    <div className="flex-grow flex flex-col items-center justify-center py-6">
                        <ShipIcon config={ship} className="w-32 h-32 sm:w-56 sm:h-56" showJets={false} />
                        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 w-full max-w-2xl px-4">
                            <div className="flex flex-col items-center gap-2"><span className="text-[7px] text-zinc-500 font-black uppercase">Hold</span><span className={`${textClass} text-white font-black`}>{ship.maxCargo} SLOTS</span></div>
                            <div className="flex flex-col items-center gap-2"><span className="text-[7px] text-zinc-500 font-black uppercase">Fuel</span><span className={`${textClass} text-white font-black`}>{ship.maxFuel}U</span></div>
                            <div className="flex flex-col items-center gap-2"><span className="text-[7px] text-zinc-500 font-black uppercase">Core</span><span className={`${textClass} text-white font-black`}>{ship.maxEnergy}E</span></div>
                            <div className="flex flex-col items-center gap-2"><span className="text-[7px] text-zinc-500 font-black uppercase">Hardpts</span><span className={`${textClass} text-white font-black`}>{ship.defaultGuns}</span></div>
                        </div>
                        <p className={`mt-10 ${textClass} text-zinc-400 text-center uppercase`}>{ship.description}</p>
                    </div>
                    <div className="mt-auto border-t border-zinc-800 pt-6 flex justify-between items-center">
                        <div className="flex flex-col">
                            <span className="text-[8px] text-zinc-500 font-black">COST</span>
                            <span className={`text-2xl font-black ${canAfford ? 'text-emerald-400' : 'text-red-500'}`}>${ship.price.toLocaleString()}</span>
                        </div>
                        <button onClick={() => replaceShip(ship.id)} disabled={!canAfford} className={`${btnPadding} bg-emerald-600 text-white font-black uppercase ${btnSize} rounded disabled:opacity-30`}>PURCHASE</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
