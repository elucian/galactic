
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CargoItem, Planet, ShipFitting, ShipConfig } from '../types.ts';
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
  marketBuy: (item: any, quantity: number, listingId?: string) => void;
  marketSell: (resIdx: number) => void;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  currentPlanet: Planet;
  marketListings?: CargoItem[]; 
  shipFitting?: ShipFitting;
  shipConfig?: ShipConfig | null;
}

const CATEGORY_ORDER = ['WEAPONRY', 'DEFENSE', 'ORDNANCE', 'SUPPLIES', 'RESOURCES', 'FOOD', 'GOODS', 'AMMO'];

const getCategory = (item: any) => {
    if (!item) return 'GOODS';
    const t = item.type?.toLowerCase() || '';
    const id = item.id?.toLowerCase() || '';

    // STRICT FIX: Iron Ingot vs Ammo
    if (id === 'iron') {
        return t === 'ammo' ? 'AMMO' : 'RESOURCES';
    }

    // AMMO
    if (t === 'ammo') return 'AMMO';
    
    // WEAPONRY
    if (['weapon', 'projectile', 'laser', 'gun'].includes(t)) return 'WEAPONRY';
    if (id.includes('gun') || id.includes('rifle') || id.includes('pistol')) return 'WEAPONRY';

    // DEFENSE
    if (t === 'shield') return 'DEFENSE';
    
    // ORDNANCE
    if (['missile', 'mine'].includes(t)) return 'ORDNANCE';
    
    // SUPPLIES (Water is here)
    if (['fuel', 'energy', 'repair', 'robot', 'nanite', 'water'].includes(t)) return 'SUPPLIES';
    
    // RESOURCES
    if (['iron', 'copper', 'gold', 'platinum', 'tungsten', 'lithium', 'chromium', 'titanium', 'silver'].includes(t)) return 'RESOURCES';
    
    // FOOD
    if (['food', 'organic', 'meat', 'grain', 'fruit', 'spice'].includes(t)) return 'FOOD';
    
    // GOODS
    if (['drug', 'medicine', 'equipment', 'part', 'luxury', 'goods'].includes(t)) return 'GOODS';

    return 'GOODS';
};

export const MarketDialog: React.FC<MarketDialogProps> = ({
  isOpen, onClose, marketTab, setMarketTab, currentReserves, credits, testMode, marketBuy, marketSell, fontSize, currentPlanet, marketListings = [], shipFitting, shipConfig
}) => {
  const [activeFilters, setActiveFilters] = useState<string[]>(CATEGORY_ORDER);
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);
  const [transactionQty, setTransactionQty] = useState(1);
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<string[]>(CATEGORY_ORDER);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      setSelectedItemIdx(null);
      setTransactionQty(1);
  }, [marketTab, isOpen]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
              setIsFilterOpen(false);
          }
      };
      if (isFilterOpen) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  const displayItems = useMemo(() => {
      let rawItems: any[] = [];
      if (marketTab === 'buy') {
          rawItems = marketListings.map(i => ({...i, source: 'market'}));
      } else {
          rawItems = currentReserves.map((resItem, originalIndex) => {
              const baseDef = [...WEAPONS, ...SHIELDS, ...EXPLODING_ORDNANCE, ...COMMODITIES, ...EXOTIC_WEAPONS, ...EXOTIC_SHIELDS, ...AMMO_MARKET_ITEMS].find(x => x.id === resItem.id);
              const basePrice = baseDef?.price || resItem.price || 1000;
              
              let multiplier = 0.5;
              const isHabitable = ['#10b981', '#064e3b', '#60a5fa', '#3b82f6'].includes(currentPlanet.color);
              const isBarren = !isHabitable;
              const level = currentPlanet.difficulty;

              if (['food', 'water', 'medicine', 'drug'].includes(resItem.type)) {
                  if (isHabitable) multiplier = 0.3; 
                  if (isBarren) multiplier = 2.0 + (level * 0.5); 
              }
              else if (['iron','copper','gold','platinum','tungsten','lithium'].includes(resItem.type)) {
                  if (isHabitable) multiplier = 1.5; 
                  if (isBarren) multiplier = 0.4; 
              }
              else if (resItem.type === 'weapon' || resItem.type === 'shield') {
                  if (level > 8) multiplier = 1.2; 
                  else multiplier = 0.6;
              }

              const sellPrice = Math.floor(basePrice * multiplier);
              return { ...resItem, price: sellPrice, originalIndex, source: 'reserve' };
          });
      }

      // MERGE LOGIC
      const mergedMap = new Map();
      rawItems.forEach(item => {
          // Normalize type key for merging to avoid splitting "iron" (type:iron) and "iron" (type:goods)
          let typeKey = item.type;
          if (item.id === 'iron' && item.type !== 'ammo') typeKey = 'resource_iron';

          const key = `${item.id}_${typeKey}_${item.price}`;
          
          if (!mergedMap.has(key)) {
              mergedMap.set(key, {
                  ...item,
                  quantity: 0,
                  stacks: []
              });
          }
          
          const entry = mergedMap.get(key);
          entry.quantity += item.quantity;
          if (item.source === 'reserve') {
              entry.stacks.push({ index: item.originalIndex, qty: item.quantity });
          }
          if (!entry.instanceId && item.instanceId) entry.instanceId = item.instanceId;
      });

      const mergedList = Array.from(mergedMap.values());

      const filtered = mergedList.filter(item => {
          const cat = getCategory(item);
          return activeFilters.includes(cat);
      });

      return filtered.sort((a, b) => {
          const catA = getCategory(a);
          const catB = getCategory(b);
          const idxA = CATEGORY_ORDER.indexOf(catA);
          const idxB = CATEGORY_ORDER.indexOf(catB);
          if (idxA !== idxB) return idxA - idxB;
          return a.name.localeCompare(b.name);
      });
  }, [marketTab, marketListings, currentReserves, activeFilters, currentPlanet]);

  const selectedItem = selectedItemIdx !== null ? displayItems[selectedItemIdx] : null;

  const maxTransaction = useMemo(() => {
      if (!selectedItem) return 1;
      if (marketTab === 'sell') return selectedItem.quantity;
      
      const price = selectedItem.price || 9999999;
      const afford = Math.floor(credits / (price || 1));
      
      let spaceLimit = 99999;
      if (shipFitting && shipConfig) {
          const t = selectedItem.type;
          const id = selectedItem.id;
          
          const isOmega = id === 'ord_mine_red';
          const isMissile = t === 'missile';
          const isMine = t === 'mine';
          const isAmmo = t === 'ammo';
          
          if (isOmega) {
              spaceLimit = Math.max(0, 5 - (shipFitting.redMineCount || 0));
          } else if (isMissile) {
              spaceLimit = Math.max(0, 10 - shipFitting.rocketCount);
          } else if (isMine) {
              spaceLimit = Math.max(0, 10 - shipFitting.mineCount);
          } else if (isAmmo) {
              spaceLimit = 99999; 
          } else {
              const currentLoad = shipFitting.cargo.reduce((acc, c) => acc + c.quantity, 0);
              spaceLimit = Math.max(0, shipConfig.maxCargo - currentLoad);
          }
      }

      return Math.max(0, Math.min(afford, spaceLimit, selectedItem.quantity));
  }, [selectedItem, marketTab, credits, shipFitting, shipConfig]);

  const cargoImpact = useMemo(() => {
      if (!selectedItem || marketTab === 'sell') return 0;
      const t = selectedItem.type;
      const id = selectedItem.id;
      if (id === 'ord_mine_red' || t === 'missile' || t === 'mine' || t === 'ammo') return 0;
      return transactionQty; 
  }, [selectedItem, transactionQty, marketTab]);

  useEffect(() => {
      if (maxTransaction > 0) {
          setTransactionQty(1);
      } else {
          setTransactionQty(0);
      }
  }, [selectedItemIdx, maxTransaction]);

  const handleTransaction = () => {
      if (!selectedItem || transactionQty <= 0) return;
      
      if (marketTab === 'buy') {
          marketBuy(selectedItem, transactionQty, selectedItem.instanceId);
      } else {
          const sortedStacks = [...selectedItem.stacks].sort((a: any, b: any) => b.index - a.index);
          let remaining = transactionQty;
          
          for (const stack of sortedStacks) {
              if (remaining <= 0) break;
              const take = Math.min(remaining, stack.qty);
              for(let k=0; k<take; k++) {
                  marketSell(stack.index); 
              }
              remaining -= take;
          }
      }
      setSelectedItemIdx(null);
  };

  const toggleFilterMenu = () => {
      if (isFilterOpen) {
          setIsFilterOpen(false);
      } else {
          setPendingFilters(activeFilters);
          setIsFilterOpen(true);
      }
  };

  const handleFilterApply = () => {
      setActiveFilters(pendingFilters.length > 0 ? pendingFilters : CATEGORY_ORDER);
      setIsFilterOpen(false);
  };

  if (!isOpen) return null;

  const titleSize = fontSize === 'small' ? 'text-[11px]' : (fontSize === 'large' ? 'text-[16px]' : 'text-[13px]');
  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');
  const iconSize = fontSize === 'small' ? 22 : (fontSize === 'large' ? 32 : 26);
  const largeIconSize = fontSize === 'small' ? 64 : (fontSize === 'large' ? 128 : 96);

  const getItemColor = (item: any) => {
      let iconColor = marketTab === 'sell' ? "#fbbf24" : "#10b981";
      if (item.type === 'ammo') {
          const conf = AMMO_CONFIG[item.id as keyof typeof AMMO_CONFIG];
          if (conf) iconColor = conf.color;
      }
      if (item.type === 'missile') {
          if (item.id && item.id.includes('emp')) iconColor = "#3b82f6";
          else iconColor = "#ef4444";
      }
      if (item.type === 'mine') {
          if (item.id && item.id.includes('emp')) iconColor = "#3b82f6";
          else if (item.id && item.id.includes('red')) iconColor = "#ef4444";
          else iconColor = "#fbbf24";
      }
      const cat = getCategory(item);
      if (cat === 'WEAPONRY') {
          const w = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === item.id);
          if (w) iconColor = w.beamColor || '#ef4444';
      }
      if (cat === 'DEFENSE') {
          const s = [...SHIELDS, ...EXOTIC_SHIELDS].find(x => x.id === item.id);
          if (s) iconColor = (s as any).color;
      }
      if (cat === 'GOODS') iconColor = '#a855f7';
      if (cat === 'FOOD') iconColor = '#f97316';
      if (cat === 'SUPPLIES') iconColor = item.type === 'water' ? '#3b82f6' : (item.type === 'fuel' ? '#f97316' : '#22d3ee');
      if (cat === 'RESOURCES') {
          const t = item.type?.toLowerCase();
          if (t === 'chromium') iconColor = '#ef4444';
          else if (t === 'gold') iconColor = '#facc15';
          else if (t === 'iron') iconColor = '#9ca3af';
          else if (t === 'copper') iconColor = '#fb923c';
          else if (t === 'titanium') iconColor = '#22d3ee';
          else if (t === 'platinum') iconColor = '#e2e8f0';
          else if (t === 'lithium') iconColor = '#e879f9';
          else if (t === 'tungsten') iconColor = '#475569';
          else if (t === 'gun') iconColor = '#ec4899';
      }
      return iconColor;
  };

  return (
    <div className="fixed inset-0 z-[9800] bg-black/95 flex items-center justify-center p-0 sm:p-4 backdrop-blur-2xl">
       <div className="w-full max-w-6xl bg-zinc-950 border-0 sm:border-2 border-zinc-800 rounded-none sm:rounded-xl flex flex-col h-full sm:h-[85vh] shadow-2xl overflow-hidden relative">
          
          {/* HEADER (2 ROWS on ALL DEVICES) */}
          <header className="flex flex-col shrink-0 z-50 bg-zinc-900/80 border-b border-zinc-800">
             
             {/* ROW 1: Title & Funds */}
             <div className="flex justify-between items-center p-3 md:p-4 border-b border-zinc-800/50">
                <h2 className={`retro-font text-emerald-500 ${titleSize} uppercase`}>Galactic Exchange</h2>
                <div className="flex flex-col items-end">
                     <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">Available Funds</span>
                     <span className={`text-emerald-500 font-black tabular-nums ${fontSize === 'large' ? 'text-2xl' : 'text-xl'}`}>${credits.toLocaleString()}</span>
                </div>
             </div>

             {/* ROW 2: Controls */}
             <div className="flex justify-between items-center p-2 md:px-4 md:py-2 bg-zinc-950/50">
                 <div className="flex items-center gap-2 relative" ref={filterRef}>
                    <div className="flex gap-1 bg-zinc-900 rounded p-1">
                        {['buy', 'sell'].map(t => (
                            <button 
                                key={t} 
                                onClick={() => setMarketTab(t as any)} 
                                className={`px-4 py-1.5 text-[10px] md:${btnSize} font-black uppercase rounded transition-all ${marketTab === t ? (t === 'buy' ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white') : 'text-zinc-500 hover:text-white'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={toggleFilterMenu}
                        className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded border transition-all ${isFilterOpen ? 'bg-zinc-800 border-white text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'}`}
                        title="Filter Categories"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                    </button>
                    
                    {isFilterOpen && (
                        <div className="absolute top-full left-0 mt-2 bg-zinc-950 border border-zinc-700 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[100] p-4 w-64 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-zinc-800">
                            <div className="text-[10px] font-black uppercase text-zinc-500 mb-3 tracking-widest border-b border-zinc-800 pb-2">Filter Categories</div>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {CATEGORY_ORDER.map(cat => (
                                    <label key={cat} className="flex items-center gap-2 cursor-pointer hover:bg-zinc-900/50 p-1 rounded -ml-1 group">
                                        <div className={`w-3 h-3 rounded-[2px] border flex items-center justify-center transition-colors ${pendingFilters.includes(cat) ? 'bg-emerald-600 border-emerald-500' : 'border-zinc-600 bg-zinc-900 group-hover:border-zinc-400'}`}>
                                            {pendingFilters.includes(cat) && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                        </div>
                                        <span className={`text-[9px] font-bold uppercase ${pendingFilters.includes(cat) ? 'text-zinc-200' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{cat}</span>
                                        <input type="checkbox" className="hidden" checked={pendingFilters.includes(cat)} onChange={() => { if (pendingFilters.includes(cat)) setPendingFilters(p => p.filter(x => x !== cat)); else setPendingFilters(p => [...p, cat]); }} />
                                    </label>
                                ))}
                            </div>
                            <div className="flex justify-between items-center border-t border-zinc-800 pt-3">
                                <div className="flex gap-3">
                                    <button onClick={() => setPendingFilters(CATEGORY_ORDER)} className="text-[8px] font-black uppercase text-zinc-500 hover:text-white transition-colors">All</button>
                                    <button onClick={() => setPendingFilters([])} className="text-[8px] font-black uppercase text-zinc-500 hover:text-white transition-colors">Clear</button>
                                </div>
                                <button onClick={handleFilterApply} className="bg-white text-black text-[9px] font-black uppercase px-3 py-1 rounded hover:bg-emerald-400 transition-colors shadow-lg">Apply</button>
                            </div>
                        </div>
                    )}
                 </div>

                 <button onClick={onClose} className={`px-4 py-1.5 bg-zinc-900 border border-zinc-700 text-zinc-400 font-black ${btnSize} rounded hover:text-white hover:border-zinc-500 uppercase`}>CLOSE</button>
             </div>
          </header>
          
          <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                {/* LEFT PANEL: LISTING */}
                <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col border-b-2 md:border-b-0 md:border-r-2 border-zinc-800 bg-zinc-900/20">
                    <div className="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {displayItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 opacity-30 mt-10">
                                <span className="text-2xl text-zinc-600 mb-2">∅</span>
                                <span className="text-[10px] font-black uppercase text-zinc-500">No Listings Found</span>
                            </div>
                        ) : (
                            displayItems.map((item, idx) => {
                                const isSelected = selectedItemIdx === idx;
                                const color = getItemColor(item);
                                const currentCategory = getCategory(item);
                                const prevCategory = idx > 0 ? getCategory(displayItems[idx - 1]) : null;
                                const showHeader = currentCategory !== prevCategory;

                                return (
                                    <React.Fragment key={idx}>
                                        {showHeader && (
                                            <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur border-y border-zinc-800 py-1.5 px-3 text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-3 mb-1 shadow-sm">
                                                {currentCategory}
                                            </div>
                                        )}
                                        <div 
                                            onClick={() => setSelectedItemIdx(idx)}
                                            className={`flex justify-between items-center p-3 rounded cursor-pointer border transition-all ${isSelected ? 'bg-white/5 border-white shadow-lg z-10' : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-800'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <ItemSVG type={item.type || 'goods'} color={color} size={iconSize} />
                                                <div className="flex flex-col">
                                                    <span className={`font-black uppercase text-sm ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{item.name}</span>
                                                    <span className="text-[9px] text-zinc-500 uppercase font-mono">{item.quantity} UNITS</span>
                                                </div>
                                            </div>
                                            <span className={`font-mono font-bold ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`}>${item.price?.toLocaleString()}</span>
                                        </div>
                                    </React.Fragment>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: DETAILS */}
                <div className="w-full md:w-1/2 lg:w-3/5 flex flex-col bg-zinc-950 relative border-t-4 border-zinc-900 md:border-t-0">
                    {selectedItem ? (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                            
                            {/* ITEM PREVIEW HEADER */}
                            <div className="flex-grow flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.05)_0%,_transparent_70%)]" />
                                
                                {/* Large Icon - Hidden on Mobile */}
                                <div className="hidden md:block relative z-10 drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] scale-150 mb-6">
                                    <ItemSVG type={selectedItem.type || 'goods'} color={getItemColor(selectedItem)} size={largeIconSize} />
                                </div>
                                
                                <h2 className="text-xl md:text-3xl font-black uppercase text-white tracking-tight mb-1 relative z-10">{selectedItem.name}</h2>
                                <span className="text-xs font-mono text-emerald-500 uppercase tracking-widest relative z-10">{getCategory(selectedItem)} CLASS</span>
                                
                                <p className="mt-4 md:mt-6 text-center text-zinc-400 text-xs md:text-sm max-w-md uppercase font-mono leading-relaxed relative z-10">
                                    {selectedItem.description || "Standard issue galactic commodity. Used in various industrial and survival applications."}
                                </p>
                            </div>

                            {/* TRANSACTION CONTROLS */}
                            <div className="bg-zinc-900 border-t-2 border-zinc-800 p-4 md:p-6 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20">
                                <div className="flex justify-between items-end mb-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Quantity Select</span>
                                        <div className="flex items-center gap-4">
                                            <span className="text-4xl font-black text-white tabular-nums">{transactionQty}</span>
                                            <span className="text-sm text-zinc-500 font-mono">/ {maxTransaction} MAX</span>
                                        </div>
                                        {cargoImpact > 0 && marketTab === 'buy' && (
                                            <div className="text-[10px] font-mono text-zinc-400 mt-1">
                                                LOAD: <span className="text-white">+{cargoImpact}</span> UNITS
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Total Cost</span>
                                        <span className={`text-3xl font-black tabular-nums ${marketTab === 'buy' ? (credits >= (selectedItem.price || 0) * transactionQty ? 'text-emerald-400' : 'text-red-500') : 'text-amber-400'}`}>
                                            ${((selectedItem.price || 0) * transactionQty).toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                {/* SLIDER */}
                                <input 
                                    type="range" 
                                    min={maxTransaction > 0 ? 1 : 0} 
                                    max={maxTransaction || 1} 
                                    value={transactionQty}
                                    onChange={(e) => setTransactionQty(parseInt(e.target.value))}
                                    disabled={!maxTransaction}
                                    className="w-full h-3 bg-zinc-800 rounded-lg appearance-none cursor-pointer mb-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                />

                                <button 
                                    onClick={handleTransaction}
                                    disabled={!maxTransaction || transactionQty === 0 || (marketTab === 'buy' && credits < (selectedItem.price || 0) * transactionQty)}
                                    className={`w-full py-4 text-sm font-black uppercase tracking-[0.2em] rounded shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-3
                                    ${marketTab === 'buy' 
                                        ? (maxTransaction > 0 && credits >= (selectedItem.price || 0) * transactionQty ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed') 
                                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20'}`}
                                >
                                    {marketTab === 'buy' ? 'CONFIRM ACQUISITION' : 'LIQUIDATE ASSETS'}
                                </button>
                            </div>

                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 select-none">
                            <span className="text-6xl mb-4 text-zinc-500 animate-pulse">⬡</span>
                            <span className="text-sm font-black uppercase text-zinc-500 tracking-[0.3em]">Select Item for Details</span>
                        </div>
                    )}
                </div>
          </div>
       </div>
    </div>
  );
};
