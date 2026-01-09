
import React from 'react';
import { CargoItem, ShipFitting, ShipConfig } from '../types.ts';
import { ItemSVG } from './Common.tsx';

interface CargoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fitting: ShipFitting;
  shipConfig: ShipConfig | null | undefined;
  reserves: CargoItem[];
  selectedCargoIdx: number | null;
  selectedReserveIdx: number | null;
  setSelectedCargoIdx: (idx: number | null) => void;
  setSelectedReserveIdx: (idx: number | null) => void;
  onMoveItems: (direction: 'to_reserve' | 'to_ship', all: boolean) => void;
  onMoveAll: (direction: 'to_reserve' | 'to_ship') => void;
  fontSize: 'small' | 'medium' | 'large';
}

// Button Component for Toolbar
const ToolButton = ({ onClick, disabled, icon, vertical = false, sizeClass }: { onClick: () => void, disabled: boolean, icon: React.ReactNode, vertical?: boolean, sizeClass: string }) => (
  <button 
    onClick={onClick} 
    disabled={disabled} 
    className={`
      flex items-center justify-center rounded transition-all duration-200 border-b-2 active:border-b-0 active:translate-y-[2px]
      ${vertical ? `w-full ${sizeClass}` : `${sizeClass}`}
      ${disabled 
        ? 'bg-zinc-900 border-zinc-800 text-zinc-700 cursor-not-allowed' 
        : 'bg-gradient-to-b from-zinc-300 to-zinc-400 border-zinc-500 text-zinc-900 shadow-md hover:from-white hover:to-zinc-300'
      }
    `}
  >
    {icon}
  </button>
);

export const CargoDialog: React.FC<CargoDialogProps> = ({
  isOpen, onClose, fitting, shipConfig, reserves,
  selectedCargoIdx, selectedReserveIdx, setSelectedCargoIdx, setSelectedReserveIdx,
  onMoveItems, onMoveAll, fontSize
}) => {
  if (!isOpen || !fitting) return null;

  const titleSize = fontSize === 'small' ? 'text-[11px]' : (fontSize === 'large' ? 'text-[16px]' : 'text-[13px]');
  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');
  const btnPadding = fontSize === 'small' ? 'px-6 py-2' : (fontSize === 'large' ? 'px-8 py-4' : 'px-7 py-3');
  const iconSize = fontSize === 'small' ? 22 : (fontSize === 'large' ? 32 : 26);
  const toolBtnClass = fontSize === 'small' ? 'w-10 h-10' : (fontSize === 'large' ? 'w-14 h-14' : 'w-12 h-12');

  // SAFE ACCESS: Check if index is valid and item exists
  const selectedShipItem = (selectedCargoIdx !== null && fitting.cargo[selectedCargoIdx]) ? fitting.cargo[selectedCargoIdx] : undefined;
  const selectedReserveItem = (selectedReserveIdx !== null && reserves[selectedReserveIdx]) ? reserves[selectedReserveIdx] : undefined;

  // Move Single active if ANY item selected
  const canMoveToReserve = !!selectedShipItem;
  const canMoveToShip = !!selectedReserveItem;

  // Fast Move (Batch) active only if quantity > 1 (Pile)
  const canBatchToReserve = !!selectedShipItem && selectedShipItem.quantity > 1;
  const canBatchToShip = !!selectedReserveItem && selectedReserveItem.quantity > 1;

  // Move All active if list not empty
  const canMoveAllToReserve = fitting.cargo.length > 0;
  const canMoveAllToShip = reserves.length > 0;

  return (
    <div className="fixed inset-0 z-[9000] bg-black/95 flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl">
       <div className="w-full max-w-6xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[85vh] shadow-[0_0_50px_rgba(0,0,0,0.8)]">
          <header className="p-4 border-b border-zinc-800 flex justify-between bg-zinc-900/50 shrink-0">
            <h2 className={`retro-font text-emerald-500 ${titleSize} uppercase`}>Logistics Transfer</h2>
            <button onClick={onClose} className={`${btnPadding} bg-emerald-600/10 border border-emerald-500 text-emerald-500 uppercase font-black ${btnSize} rounded hover:bg-emerald-600 hover:text-white transition-colors`}>DONE</button>
          </header>
          <div className="flex-grow flex flex-col sm:flex-row overflow-hidden">
             
             {/* SHIP CARGO LEFT */}
             <div className="w-full sm:flex-1 p-4 flex flex-col gap-4 border-r border-zinc-800 bg-zinc-900/20">
                <div className="bg-zinc-900/80 p-3 rounded border border-zinc-800 flex justify-between items-center shadow-inner">
                    <span className={`uppercase font-black text-emerald-400 ${fontSize === 'large' ? 'text-[14px]' : (fontSize === 'medium' ? 'text-[12px]' : 'text-[11px]')}`}>CARGO HOLD</span>
                    <span className={`font-black text-white ${fontSize === 'large' ? 'text-[14px]' : (fontSize === 'medium' ? 'text-[12px]' : 'text-[11px]')}`}>{fitting.cargo.reduce((a,i)=>a+i.quantity,0)} / {shipConfig?.maxCargo}</span>
                </div>
                <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar pr-1">
                    {fitting.cargo.map((it, i) => (
                        <div key={it.instanceId} onClick={() => { setSelectedCargoIdx(i); setSelectedReserveIdx(null); }} 
                             className={`flex justify-between items-center p-3 border cursor-pointer rounded group transition-all select-none ${selectedCargoIdx === i ? 'bg-emerald-900/30 border-emerald-500 shadow-[inset_0_0_10px_rgba(16,185,129,0.2)]' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600'}`}>
                            <div className="flex items-center gap-3">
                                <ItemSVG type={it.type} color="#10b981" size={iconSize}/>
                                <span className={`font-black uppercase text-white truncate max-w-[120px] ${fontSize === 'large' ? 'text-[14px]' : (fontSize === 'medium' ? 'text-[12px]' : 'text-[11px]')}`}>{it.name} x{it.quantity}</span>
                            </div>
                        </div>
                    ))}
                    {fitting.cargo.length === 0 && <div className="text-center p-10 opacity-30 text-[9px] uppercase font-black text-zinc-500">Ship Empty</div>}
                </div>
             </div>

             {/* CENTRAL TOOLS */}
             <div className="w-full sm:w-20 p-3 flex flex-row sm:flex-col items-center justify-center gap-3 bg-zinc-950 border-x border-zinc-800 shrink-0">
                
                {/* To Ship Group */}
                <div className="flex flex-col gap-2 w-full items-center">
                    <ToolButton 
                        sizeClass={toolBtnClass}
                        onClick={() => onMoveItems('to_ship', true)} 
                        disabled={!canBatchToShip}
                        icon={<svg width={iconSize*0.7} height={iconSize*0.7} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>}
                    />
                    <ToolButton 
                        sizeClass={toolBtnClass}
                        onClick={() => onMoveItems('to_ship', false)} 
                        disabled={!canMoveToShip}
                        icon={<svg width={iconSize*0.7} height={iconSize*0.7} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>}
                    />
                </div>
                
                <div className="h-[1px] w-full bg-zinc-800 hidden sm:block"></div>
                
                {/* To Reserve Group */}
                <div className="flex flex-col gap-2 w-full items-center">
                    <ToolButton 
                        sizeClass={toolBtnClass}
                        onClick={() => onMoveItems('to_reserve', false)} 
                        disabled={!canMoveToReserve}
                        icon={<svg width={iconSize*0.7} height={iconSize*0.7} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>}
                    />
                    <ToolButton 
                        sizeClass={toolBtnClass}
                        onClick={() => onMoveItems('to_reserve', true)} 
                        disabled={!canBatchToReserve}
                        icon={<svg width={iconSize*0.7} height={iconSize*0.7} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>}
                    />
                </div>

                <div className="h-[1px] w-full bg-zinc-800 hidden sm:block mt-auto mb-2"></div>

                {/* Bulk Tape Tools */}
                <div className="flex flex-col gap-2 w-full items-center">
                    <ToolButton 
                        sizeClass={toolBtnClass}
                        onClick={() => onMoveAll('to_ship')} 
                        disabled={!canMoveAllToShip}
                        icon={<svg width={iconSize*0.7} height={iconSize*0.7} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="19" x2="5" y2="12"></line><line x1="19" y1="5" x2="5" y2="12"></line><line x1="19" y1="21" x2="19" y2="3"></line></svg>}
                    />
                    <ToolButton 
                        sizeClass={toolBtnClass}
                        onClick={() => onMoveAll('to_reserve')} 
                        disabled={!canMoveAllToReserve}
                        icon={<svg width={iconSize*0.7} height={iconSize*0.7} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="19" x2="19" y2="12"></line><line x1="5" y1="5" x2="19" y2="12"></line><line x1="5" y1="21" x2="5" y2="3"></line></svg>}
                    />
                </div>
             </div>

             {/* RESERVE RIGHT */}
             <div className="w-full sm:flex-1 p-4 flex flex-col gap-4 bg-zinc-900/40">
                <div className="bg-zinc-900/80 p-3 rounded border border-zinc-800 flex justify-between items-center shadow-inner">
                    <span className={`uppercase font-black text-amber-400 ${fontSize === 'large' ? 'text-[14px]' : (fontSize === 'medium' ? 'text-[12px]' : 'text-[11px]')}`}>STATION RESERVE</span>
                    <span className={`font-black text-white ${fontSize === 'large' ? 'text-[14px]' : (fontSize === 'medium' ? 'text-[12px]' : 'text-[11px]')}`}>{reserves.length} ITEMS</span>
                </div>
                <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar pr-1">
                    {reserves.map((it, i) => (
                        <div key={it.instanceId} onClick={() => { setSelectedReserveIdx(i); setSelectedCargoIdx(null); }} 
                             className={`flex justify-between items-center p-3 border cursor-pointer rounded group transition-all select-none ${selectedReserveIdx === i ? 'bg-amber-900/30 border-amber-500 shadow-[inset_0_0_10px_rgba(245,158,11,0.2)]' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600'}`}>
                            <div className="flex items-center gap-3 w-full justify-end">
                                <span className={`font-black uppercase text-white truncate max-w-[120px] text-right ${fontSize === 'large' ? 'text-[14px]' : (fontSize === 'medium' ? 'text-[12px]' : 'text-[11px]')}`}>{it.name} x{it.quantity}</span>
                                <ItemSVG type={it.type} color="#fbbf24" size={iconSize}/>
                            </div>
                        </div>
                    ))}
                    {reserves.length === 0 && <div className="text-center p-10 opacity-30 text-[9px] uppercase font-black text-zinc-500">Reserve Empty</div>}
                </div>
             </div>

          </div>
       </div>
    </div>
  );
};
