
import React from 'react';
import { CargoItem } from '../types.ts';
import { WEAPONS, SHIELDS, EXPLODING_ORDNANCE, COMMODITIES, EXOTIC_WEAPONS, EXOTIC_SHIELDS } from '../constants.ts';
import { ItemSVG } from './Common.tsx';

interface MarketDialogProps {
  isOpen: boolean;
  onClose: () => void;
  marketTab: 'buy' | 'sell' | 'sales';
  setMarketTab: (tab: 'buy' | 'sell' | 'sales') => void;
  currentReserves: CargoItem[];
  currentListings: CargoItem[];
  credits: number;
  testMode: boolean;
  marketBuy: (item: any) => void;
  marketSell: (resIdx: number) => void;
  claimSale: (idx: number, cancel: boolean) => void;
  fontSize: 'small' | 'medium' | 'large';
}

export const MarketDialog: React.FC<MarketDialogProps> = ({
  isOpen, onClose, marketTab, setMarketTab, currentReserves, currentListings, credits, testMode, marketBuy, marketSell, claimSale, fontSize
}) => {
  if (!isOpen) return null;

  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');
  const btnPadding = fontSize === 'small' ? 'px-6 py-3' : (fontSize === 'large' ? 'px-8 py-5' : 'px-7 py-4');
  const iconSize = fontSize === 'small' ? 22 : (fontSize === 'large' ? 32 : 26);

  return (
    <div className="fixed inset-0 z-[9800] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
        <div className="w-full max-w-4xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[85vh] shadow-2xl">
            <header className="p-4 border-b border-zinc-800 flex justify-between bg-zinc-900/50 shrink-0">
                <div className="flex gap-2">
                    <button onClick={() => setMarketTab('buy')} className={`retro-font ${btnSize} uppercase ${btnPadding} rounded-t-lg transition-all ${marketTab === 'buy' ? 'bg-emerald-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}>BUY</button>
                    <button onClick={() => setMarketTab('sell')} className={`retro-font ${btnSize} uppercase ${btnPadding} rounded-t-lg transition-all ${marketTab === 'sell' ? 'bg-amber-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}>SELL</button>
                    <button onClick={() => setMarketTab('sales')} className={`retro-font ${btnSize} uppercase ${btnPadding} rounded-t-lg transition-all ${marketTab === 'sales' ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}>SALES</button>
                </div>
                <button onClick={onClose} className={`text-zinc-500 ${btnSize} font-black ${btnPadding.replace('py-3','py-2').replace('py-5','py-4').replace('py-4','py-3')}`}>DONE</button>
            </header>
            <div className="flex-grow overflow-y-auto p-4 custom-scrollbar bg-black/40">
                {marketTab === 'buy' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(() => {
                            let itemsToBuy = [...WEAPONS, ...SHIELDS, ...EXPLODING_ORDNANCE, ...COMMODITIES];
                            if (testMode) {
                                itemsToBuy = [...itemsToBuy, ...EXOTIC_WEAPONS, ...EXOTIC_SHIELDS];
                            }
                            return itemsToBuy.map(it => {
                                const isExotic = [...EXOTIC_WEAPONS, ...EXOTIC_SHIELDS].some(ex => ex.id === it.id);
                                return (
                                    <button key={it.id} onClick={() => marketBuy(it)} className={`flex justify-between items-center p-3 bg-zinc-900/40 border border-zinc-800 hover:border-emerald-500/40 hover:bg-zinc-800 rounded group transition-all text-left ${isExotic ? 'border-purple-500/30 bg-purple-900/10 hover:border-purple-500 hover:bg-purple-900/30' : ''}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 flex items-center justify-center bg-black border border-zinc-700 rounded ${isExotic ? 'border-purple-500 shadow-[0_0_10px_#a855f7]' : ''}`}>
                                                <ItemSVG type={(it as any).damage ? 'weapon' : ((it as any).capacity ? 'shield' : ((it as any).type || 'goods'))} color={isExotic ? '#d8b4fe' : '#10b981'} size={iconSize}/>
                                            </div>
                                            <span className={`text-[10px] font-black uppercase truncate w-24 ${isExotic ? 'text-purple-400' : 'text-white'}`}>{it.name}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className={`text-[10px] font-black tabular-nums ${isExotic ? 'text-purple-300' : 'text-emerald-400'}`}>${it.price.toLocaleString()}</span>
                                            <span className="text-[8px] text-zinc-600 uppercase font-black group-hover:text-emerald-500">BUY 1</span>
                                        </div>
                                    </button>
                                );
                            });
                        })()}
                    </div>
                ) : marketTab === 'sell' ? (
                    <div className="space-y-2">
                        {currentReserves.map((it, idx) => (
                            <div key={it.instanceId} className="flex justify-between items-center p-4 border border-zinc-800 bg-zinc-900/40 rounded hover:border-amber-500/50 transition-all">
                                <div className="flex items-center gap-4">
                                    <ItemSVG type={it.type} color="#fbbf24" size={iconSize}/>
                                    <span className="text-[11px] font-black uppercase text-white">{it.name} x{it.quantity}</span>
                                </div>
                                <button onClick={() => marketSell(idx)} className="px-4 py-2 bg-amber-600/20 border border-amber-600 text-amber-500 text-[9px] font-black uppercase rounded hover:bg-amber-600 hover:text-white transition-all">SELL 1 UNIT</button>
                            </div>
                        ))}
                        {currentReserves.length === 0 && <div className="p-10 text-center opacity-30 text-sm font-black uppercase">No Reserve Items to Sell</div>}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {currentListings.map((it, idx) => (
                            <div key={it.instanceId} className={`flex justify-between items-center p-4 border rounded transition-all ${it.status === 'sold' ? 'bg-emerald-950/30 border-emerald-500' : 'bg-zinc-900/40 border-zinc-800'}`}>
                                <div className="flex items-center gap-4">
                                    <ItemSVG type={it.type} color={it.status === 'sold' ? '#10b981' : '#f97316'} size={iconSize}/>
                                    <span className="text-[11px] font-black uppercase text-white">{it.name} {it.status === 'sold' ? '(SOLD)' : '(LISTED)'}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-black text-emerald-400 tabular-nums">${it.price?.toLocaleString()}</span>
                                    {it.status === 'sold' ? 
                                        <button onClick={() => claimSale(idx, false)} className="px-4 py-2 bg-emerald-600 text-white font-black text-[9px] rounded uppercase hover:scale-105">CLAIM</button> : 
                                        <button onClick={() => claimSale(idx, true)} className="px-4 py-2 bg-zinc-800 text-zinc-400 font-black text-[9px] rounded uppercase hover:bg-zinc-700">CANCEL</button>
                                    }
                                </div>
                            </div>
                        ))}
                        {currentListings.length === 0 && <div className="p-10 text-center opacity-30 text-sm font-black uppercase">No Active Sales</div>}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
