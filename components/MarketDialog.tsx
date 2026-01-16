
import React, { useState, useMemo, useEffect } from 'react';
import { CargoItem } from '../types.ts';
import { WEAPONS, SHIELDS, EXPLODING_ORDNANCE, COMMODITIES, AMMO_MARKET_ITEMS, EXOTIC_WEAPONS, EXOTIC_SHIELDS, AMMO_CONFIG } from '../constants.ts';
import { ItemSVG } from './Common.tsx';

interface MarketDialogProps {
  isOpen: boolean;
  onClose: () => void;
  marketTab: 'buy' | 'sell';
  setMarketTab: (t: 'buy' | 'sell') => void;
  currentReserves: CargoItem[];
  credits: number;
  testMode: boolean;
  marketBuy: (item: any) => void;
  marketSell: (resIdx: number) => void;
  fontSize: 'small' | 'medium' | 'large';
}

const CATEGORY_ORDER = ['WEAPONRY', 'DEFENSE', 'ORDNANCE', 'SUPPLIES', 'RESOURCES', 'AMMO'];

// Helper to categorize items
const getCategory = (item: any) => {
    const t = item.type?.toLowerCase() || '';
    if (t === 'ammo') return 'AMMO';
    if (['weapon', 'gun', 'projectile', 'laser'].includes(t)) return 'WEAPONRY';
    if (['shield'].includes(t)) return 'DEFENSE';
    if (['missile', 'mine'].includes(t)) return 'ORDNANCE';
    if (['fuel', 'energy', 'repair', 'robot'].includes(t)) return 'SUPPLIES';
    return 'RESOURCES';
};

export const MarketDialog: React.FC<MarketDialogProps> = ({
  isOpen, onClose, marketTab, setMarketTab, currentReserves, credits, testMode, marketBuy, marketSell, fontSize
}) => {
  const [activeFilters, setActiveFilters] = useState<string[]>(CATEGORY_ORDER);
  const [pendingFilters, setPendingFilters] = useState<string[]>(CATEGORY_ORDER);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Sync pending filters with active when dropdown opens
  useEffect(() => {
      if (isDropdownOpen) {
          setPendingFilters([...activeFilters]);
      }
  }, [isDropdownOpen, activeFilters]);

  // Construct Buy List (Moved above conditional return)
  const buyItems = useMemo(() => {
      const all = [
          ...AMMO_MARKET_ITEMS,
          ...EXPLODING_ORDNANCE.map(i => ({ ...i, type: i.id.includes('missile') ? 'missile' : 'mine' })),
          ...COMMODITIES,
          ...WEAPONS.map(w => ({ ...w, type: 'weapon' })),
          ...SHIELDS.map(s => ({ ...s, type: 'shield' }))
      ];
      if (testMode) {
          all.push(...EXOTIC_WEAPONS.map(w => ({ ...w, type: 'weapon' })));
          all.push(...EXOTIC_SHIELDS.map(s => ({ ...s, type: 'shield' })));
      }
      return all;
  }, [testMode]);

  // Preserve original index for selling actions (Moved above conditional return)
  const displayItems = useMemo(() => {
      const source = marketTab === 'buy' ? buyItems : currentReserves;
      return source.map((item, originalIndex) => ({ item, originalIndex })).filter(({ item }) => {
          return activeFilters.includes(getCategory(item));
      });
  }, [marketTab, buyItems, currentReserves, activeFilters]);

  if (!isOpen) return null;

  const togglePendingFilter = (cat: string) => {
      setPendingFilters(prev => {
          if (prev.includes(cat)) return prev.filter(c => c !== cat);
          return [...prev, cat];
      });
  };

  const applyFilters = () => {
      setActiveFilters([...pendingFilters]);
      setIsDropdownOpen(false);
  };

  const resetFilters = () => {
      setPendingFilters(CATEGORY_ORDER);
  };

  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');
  const btnPadding = fontSize === 'small' ? 'px-6 py-3' : (fontSize === 'large' ? 'px-8 py-5' : 'px-7 py-4');
  const iconSize = fontSize === 'small' ? 22 : (fontSize === 'large' ? 32 : 26);

  const renderItem = (entry: { item: any, originalIndex: number }, idx: number) => {
      const { item, originalIndex } = entry;
      const cat = getCategory(item);
      const isSell = marketTab === 'sell';
      const price = isSell ? Math.floor((item.price || 1000) * 0.8) : (item.price || 1000);
      const canAfford = credits >= price;
      
      // Determine quantity for sell items (reserves)
      const quantity = isSell ? item.quantity : (item.count || 1); 

      // Icon Color
      let iconColor = isSell ? "#fbbf24" : "#10b981";
      if (item.type === 'ammo') {
          const conf = AMMO_CONFIG[item.id as keyof typeof AMMO_CONFIG];
          if (conf) iconColor = conf.color;
          else iconColor = "#fbbf24";
      }
      if (item.type === 'missile') iconColor = "#ef4444";
      if (cat === 'WEAPONRY') {
          const w = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === item.id);
          if (w) iconColor = w.beamColor || '#ef4444';
          else iconColor = "#ef4444";
      }
      if (cat === 'DEFENSE') {
          const s = [...SHIELDS, ...EXOTIC_SHIELDS].find(x => x.id === item.id);
          if (s) iconColor = (s as any).color;
          else iconColor = "#3b82f6";
      }

      return (
          <div key={idx} className="flex justify-between items-center p-3 bg-zinc-900/40 border border-zinc-800 rounded hover:border-zinc-600 transition-all group select-none">
              <div className="flex items-center gap-3">
                  <ItemSVG type={item.type || 'goods'} color={iconColor} size={iconSize} />
                  <div className="flex flex-col">
                      <span className={`font-black uppercase ${fontSize === 'large' ? 'text-[14px]' : (fontSize === 'medium' ? 'text-[12px]' : 'text-[11px]')} text-white`}>{item.name}</span>
                      <span className="text-[9px] text-zinc-500 uppercase font-mono">{cat} {isSell && `x${quantity}`}</span>
                  </div>
              </div>
              <div className="flex items-center gap-4">
                  <div className="text-right">
                      <div className={`font-black tabular-nums ${canAfford || isSell ? 'text-emerald-400' : 'text-red-500'}`}>${price.toLocaleString()}</div>
                      {!isSell && item.count && <div className="text-[8px] text-zinc-500">PACK OF {item.count}</div>}
                  </div>
                  <button 
                      onClick={() => isSell ? marketSell(originalIndex) : marketBuy(item)}
                      disabled={!isSell && !canAfford}
                      className={`px-4 py-2 rounded font-black uppercase text-[10px] border transition-all ${isSell 
                          ? 'bg-amber-600/20 border-amber-500 text-amber-500 hover:bg-amber-600 hover:text-white' 
                          : (canAfford ? 'bg-emerald-600/20 border-emerald-500 text-emerald-500 hover:bg-emerald-600 hover:text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed')}`}
                  >
                      {isSell ? 'SELL' : 'BUY'}
                  </button>
              </div>
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[9800] bg-black/95 flex items-center justify-center p-4 backdrop-blur-2xl">
       <div className="w-full max-w-5xl bg-zinc-950 border-2 border-zinc-800 rounded-xl flex flex-col h-[85vh] shadow-2xl overflow-hidden relative">
          
          <header className="p-4 border-b border-zinc-800 flex justify-between bg-zinc-900/50 shrink-0 relative z-50">
             <div className="flex gap-2 items-center">
                {/* FILTER DROPDOWN BUTTON */}
                <div className="relative group">
                    <button 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`w-10 h-10 flex items-center justify-center rounded border transition-all ${isDropdownOpen || activeFilters.length < CATEGORY_ORDER.length ? 'bg-zinc-800 border-emerald-500 text-emerald-400' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'}`}
                        title="Filter Categories"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        {activeFilters.length < CATEGORY_ORDER.length && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-950" />
                        )}
                    </button>

                    {/* DROPDOWN MENU */}
                    {isDropdownOpen && (
                        <>
                            {/* CLICK OUTSIDE LAYER */}
                            <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} style={{ cursor: 'default' }} />
                            
                            <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-950 border border-zinc-700 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
                                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Filter Categories</span>
                                    <button onClick={resetFilters} className="text-[9px] text-emerald-500 hover:text-emerald-400 font-bold uppercase">Reset</button>
                                </div>
                                <div className="space-y-1">
                                    {CATEGORY_ORDER.map(cat => (
                                        <div 
                                            key={cat}
                                            onClick={(e) => { e.stopPropagation(); togglePendingFilter(cat); }}
                                            className="flex items-center gap-3 p-2 hover:bg-zinc-800/50 rounded cursor-pointer group transition-colors select-none"
                                        >
                                            <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${pendingFilters.includes(cat) ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-zinc-600 bg-black group-hover:border-zinc-400'}`}>
                                                {pendingFilters.includes(cat) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                            </div>
                                            <span className={`text-[10px] font-black uppercase ${pendingFilters.includes(cat) ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{cat}</span>
                                        </div>
                                    ))}
                                </div>
                                <button 
                                    onClick={applyFilters}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] rounded shadow-lg transition-all active:scale-95 mt-2"
                                >
                                    Update View
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {['buy', 'sell'].map(t => (
                    <button key={t} onClick={() => setMarketTab(t as any)} className={`${btnPadding} ${btnSize} font-black uppercase border-b-2 transition-all ${marketTab === t ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>{t === 'buy' ? 'MARKET LISTINGS' : 'RESERVE SALES'}</button>
                ))}
             </div>

             <div className="flex items-center gap-4">
                 <span className="text-emerald-500 font-black text-xl tabular-nums">${credits.toLocaleString()}</span>
                 <button onClick={onClose} className={`px-6 py-2 bg-zinc-900 border border-zinc-700 text-zinc-400 font-black ${btnSize} rounded hover:text-white hover:border-zinc-500`}>CLOSE</button>
             </div>
          </header>
          
          <div className="flex-grow flex flex-col bg-black/40 p-4 overflow-y-auto custom-scrollbar">
                {displayItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                        <span className="text-4xl mb-4 text-zinc-600">∅</span>
                        <span className="text-sm font-black text-zinc-500 uppercase">No Items Found</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {displayItems.map((entry, i) => renderItem(entry, i))}
                    </div>
                )}
          </div>
       </div>
    </div>
  );
};
