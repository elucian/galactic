
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
  marketSell: (itemId: string, quantity: number) => void;
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

    if (id === 'iron') return t === 'ammo' ? 'AMMO' : 'RESOURCES';
    if (t === 'ammo') return 'AMMO';
    if (['weapon', 'projectile', 'laser', 'gun'].includes(t)) return 'WEAPONRY';
    if (id.includes('gun') || id.includes('rifle') || id.includes('pistol')) return 'WEAPONRY';
    if (t === 'shield') return 'DEFENSE';
    if (['missile', 'mine'].includes(t)) return 'ORDNANCE';
    if (['fuel', 'energy', 'repair', 'robot', 'nanite', 'water'].includes(t)) return 'SUPPLIES';
    if (['iron', 'copper', 'gold', 'platinum', 'tungsten', 'lithium', 'chromium', 'titanium', 'silver'].includes(t)) return 'RESOURCES';
    if (['food', 'organic', 'meat', 'grain', 'fruit', 'spice'].includes(t)) return 'FOOD';
    if (['drug', 'medicine', 'equipment', 'part', 'luxury', 'goods'].includes(t)) return 'GOODS';

    return 'GOODS';
};

// HELPER: Stats Calculation for Display
const getItemStats = (item: any) => {
    let power = 0;
    let disruption = 0;
    const cat = getCategory(item);

    if (cat === 'AMMO') {
        const conf = AMMO_CONFIG[item.id as keyof typeof AMMO_CONFIG];
        if (conf) {
            power = conf.damageMult * 18; 
            if (item.id === 'cobalt') disruption = 70;
            else if (item.id === 'explosive') disruption = 90;
            else if (item.id === 'titanium') disruption = 20;
            else if (item.id === 'iridium') disruption = 40;
            else disruption = 5;
        }
    } else if (cat === 'WEAPONRY') {
        const w = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === item.id);
        if (w) {
            power = Math.min(100, w.damage * 1.5); 
            if (w.id.includes('emp') || w.id.includes('ion')) disruption = 90;
            else if (w.id.includes('laser')) disruption = 30;
            else disruption = 10;
        }
    } else if (cat === 'DEFENSE') {
        const s = [...SHIELDS, ...EXOTIC_SHIELDS].find(x => x.id === item.id);
        if (s) {
            power = Math.min(100, s.capacity / 30); 
            disruption = Math.min(100, s.regenRate * 3); 
        }
    } else if (cat === 'ORDNANCE') {
        if (item.id && item.id.includes('emp')) { power = 20; disruption = 100; }
        else if (item.id && item.id.includes('red')) { power = 100; disruption = 80; }
        else { power = 85; disruption = 20; }
    }

    return { power: Math.min(100, power), disruption: Math.min(100, disruption) };
};

// HELPER: Price Level
const getPriceLevel = (item: any) => {
    const baseDef = [...WEAPONS, ...SHIELDS, ...EXPLODING_ORDNANCE, ...COMMODITIES, ...EXOTIC_WEAPONS, ...EXOTIC_SHIELDS, ...AMMO_MARKET_ITEMS].find(x => x.id === item.id);
    if (!baseDef) return { label: 'UNKNOWN', color: '#9ca3af', val: 0 };
    
    const base = baseDef.price;
    const current = item.price || base;
    const ratio = current / base;

    if (ratio <= 0.6) return { label: 'BARGAIN', color: '#10b981', val: 1 };
    if (ratio <= 0.9) return { label: 'LOW', color: '#34d399', val: 2 };
    if (ratio <= 1.1) return { label: 'AVERAGE', color: '#fbbf24', val: 3 };
    if (ratio <= 1.5) return { label: 'HIGH', color: '#f87171', val: 4 };
    return { label: 'INFLATED', color: '#ef4444', val: 5 };
};

export const MarketDialog: React.FC<MarketDialogProps> = ({
  isOpen, onClose, marketTab, setMarketTab, currentReserves, credits, testMode, marketBuy, marketSell, fontSize, currentPlanet, marketListings = [], shipFitting, shipConfig
}) => {
  const [activeFilters, setActiveFilters] = useState<string[]>(CATEGORY_ORDER);
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);
  const [transactionQty, setTransactionQty] = useState(1);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<string[]>(CATEGORY_ORDER);
  const filterRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const lastClickRef = useRef<{ idx: number, time: number }>({ idx: -1, time: 0 });

  useEffect(() => {
      setSelectedItemIdx(null);
      setTransactionQty(1);
      setShowMobileDetails(false);
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

  const handleItemClick = (idx: number) => {
      const now = Date.now();
      const last = lastClickRef.current;
      
      // Double tap detection (within 400ms on same item)
      if (last.idx === idx && (now - last.time) < 400) {
          setSelectedItemIdx(idx);
          setShowMobileDetails(true);
      } else {
          setSelectedItemIdx(idx);
      }
      lastClickRef.current = { idx, time: now };
  };

  const handleScroll = (direction: 'up' | 'down') => {
      if (listContainerRef.current) {
          const h = listContainerRef.current.clientHeight;
          const scrollAmount = h * 0.8;
          listContainerRef.current.scrollBy({ 
              top: direction === 'up' ? -scrollAmount : scrollAmount, 
              behavior: 'smooth' 
          });
      }
  };

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
          let typeKey = item.type;
          if (item.id === 'iron' && item.type !== 'ammo') typeKey = 'resource_iron';

          const key = `${item.id}_${typeKey}_${item.price}`;
          
          if (!mergedMap.has(key)) {
              mergedMap.set(key, { ...item, quantity: 0, stacks: [] });
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
          
          // Primary Sort: Category Order
          if (idxA !== idxB) return idxA - idxB;
          
          // Secondary Sort: Price Descending
          const priceA = a.price || 0;
          const priceB = b.price || 0;
          if (priceB !== priceA) return priceB - priceA;
          
          // Tertiary Sort: Name
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
          // Ammo logic handled via cargo space
          
          const currentLoad = shipFitting.cargo.reduce((acc, c) => acc + c.quantity, 0);
          const freeCargo = Math.max(0, shipConfig.maxCargo - currentLoad);
          
          if (isOmega) {
              const slotFree = Math.max(0, 5 - (shipFitting.redMineCount || 0));
              spaceLimit = slotFree + freeCargo;
          }
          else if (isMissile) {
              const slotFree = Math.max(0, 10 - shipFitting.rocketCount);
              spaceLimit = slotFree + freeCargo;
          }
          else if (isMine) {
              const slotFree = Math.max(0, 10 - shipFitting.mineCount);
              spaceLimit = slotFree + freeCargo;
          }
          else {
              spaceLimit = freeCargo;
          }
      }

      return Math.max(0, Math.min(afford, spaceLimit, selectedItem.quantity));
  }, [selectedItem, marketTab, credits, shipFitting, shipConfig]);

  const cargoImpact = useMemo(() => {
      if (!selectedItem || marketTab === 'sell') return 0;
      if (!shipFitting) return transactionQty;

      const t = selectedItem.type;
      const id = selectedItem.id;
      const isOmega = id === 'ord_mine_red';
      const isMissile = t === 'missile';
      const isMine = t === 'mine';
      
      if (isOmega) {
          const slotFree = Math.max(0, 5 - (shipFitting.redMineCount || 0));
          return Math.max(0, transactionQty - slotFree);
      }
      if (isMissile) {
          const slotFree = Math.max(0, 10 - shipFitting.rocketCount);
          return Math.max(0, transactionQty - slotFree);
      }
      if (isMine) {
          const slotFree = Math.max(0, 10 - shipFitting.mineCount);
          return Math.max(0, transactionQty - slotFree);
      }
      
      return transactionQty; 
  }, [selectedItem, transactionQty, marketTab, shipFitting]);

  useEffect(() => {
      if (maxTransaction > 0) setTransactionQty(1);
      else setTransactionQty(0);
  }, [selectedItemIdx, maxTransaction]);

  const handleTransaction = () => {
      if (!selectedItem || transactionQty <= 0) return;
      if (marketTab === 'buy') marketBuy(selectedItem, transactionQty, selectedItem.instanceId);
      else marketSell(selectedItem.id, transactionQty);
      setSelectedItemIdx(null);
      setShowMobileDetails(false);
  };

  const toggleFilterMenu = () => {
      if (isFilterOpen) setIsFilterOpen(false);
      else { setPendingFilters(activeFilters); setIsFilterOpen(true); }
  };

  const handleFilterApply = () => {
      setActiveFilters(pendingFilters.length > 0 ? pendingFilters : CATEGORY_ORDER);
      setIsFilterOpen(false);
  };

  if (!isOpen) return null;

  // Dynamic Size Classes
  const titleSize = fontSize === 'small' ? 'text-[11px]' : (fontSize === 'large' ? 'text-[16px]' : 'text-[13px]');
  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');
  const iconSize = fontSize === 'small' ? 22 : (fontSize === 'large' ? 32 : 26);
  // Large Icon for Panel
  const largeIconSize = fontSize === 'small' ? 64 : (fontSize === 'large' ? 96 : 80);
  const descSize = fontSize === 'small' ? 'text-[9px]' : (fontSize === 'large' ? 'text-[13px]' : 'text-[11px]');
  const statLabelSize = fontSize === 'small' ? 'text-[7px]' : (fontSize === 'large' ? 'text-[10px]' : 'text-[8px]');

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

  const itemStats = selectedItem ? getItemStats(selectedItem) : { power: 0, disruption: 0 };
  const showStats = selectedItem && (itemStats.power > 0 || itemStats.disruption > 0);
  const priceLevel = selectedItem ? getPriceLevel(selectedItem) : { label: '---', color: '#fff', val: 0 };
  const totalPrice = selectedItem ? (selectedItem.price || 0) * transactionQty : 0;

  return (
    <div className="fixed inset-0 z-[9800] bg-black/95 flex items-center justify-center p-0 sm:p-4 backdrop-blur-2xl">
       <div className="w-full max-w-6xl bg-zinc-950 border-0 sm:border-2 border-zinc-800 rounded-none sm:rounded-xl flex flex-col h-full sm:h-[85vh] shadow-2xl overflow-hidden relative">
          
          {/* HEADER */}
          <header className="flex flex-col shrink-0 z-50 bg-zinc-900/80 border-b border-zinc-800">
             <div className="flex justify-between items-center p-3 md:p-4 border-b border-zinc-800/50">
                <h2 className={`retro-font text-emerald-500 ${titleSize} uppercase`}>Galactic Exchange</h2>
                <div className="flex flex-col items-end">
                     <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">Available Funds</span>
                     <span className={`text-emerald-500 font-black tabular-nums ${fontSize === 'large' ? 'text-2xl' : 'text-xl'}`}>${credits.toLocaleString()}</span>
                </div>
             </div>
             <div className="flex justify-between items-center p-2 md:px-4 md:py-2 bg-zinc-950/50">
                 <div className="flex items-center gap-2 relative" ref={filterRef}>
                    <div className="flex gap-1 bg-zinc-900 rounded p-1">
                        {['buy', 'sell'].map(t => (
                            <button key={t} onClick={() => setMarketTab(t as any)} className={`px-4 py-1.5 text-[10px] md:${btnSize} font-black uppercase rounded transition-all ${marketTab === t ? (t === 'buy' ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white') : 'text-zinc-500 hover:text-white'}`}>{t}</button>
                        ))}
                    </div>
                    <button onClick={toggleFilterMenu} className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded border transition-all ${isFilterOpen ? 'bg-zinc-800 border-white text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'}`} title="Filter">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                    </button>
                    {isFilterOpen && (
                        <div className="absolute top-full left-0 mt-2 bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl z-[100] p-4 w-64 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-zinc-800">
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
          
          <div className="flex-grow flex flex-col md:flex-row overflow-hidden relative">
                {/* LEFT PANEL: LISTING */}
                <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col border-b-2 md:border-b-0 md:border-r-2 border-zinc-800 bg-zinc-900/20 relative">
                    <div ref={listContainerRef} className="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1 pb-16">
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
                                            onClick={() => handleItemClick(idx)}
                                            className={`flex justify-between items-center p-3 rounded cursor-pointer border transition-all ${isSelected ? 'bg-white/5 border-white shadow-lg z-10' : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-800'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="block">
                                                    <ItemSVG type={item.type || 'goods'} color={color} size={iconSize} />
                                                </div>
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

                    {/* SCROLL CONTROLS (Mobile Only) */}
                    <div className="absolute bottom-4 right-4 flex flex-col gap-2 md:hidden z-30">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleScroll('up'); }}
                            className="w-10 h-10 bg-zinc-800/90 border border-zinc-600 rounded flex items-center justify-center text-zinc-300 shadow-lg active:scale-95"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleScroll('down'); }}
                            className="w-10 h-10 bg-zinc-800/90 border border-zinc-600 rounded flex items-center justify-center text-zinc-300 shadow-lg active:scale-95"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                    </div>
                </div>

                {/* RIGHT PANEL: DETAILS & TRANSACTION */}
                <div className={`
                    w-full md:w-1/2 lg:w-3/5 flex flex-col bg-zinc-950 border-t-4 border-zinc-900 md:border-t-0
                    ${showMobileDetails ? 'fixed inset-0 z-[100] border-0' : 'hidden md:flex relative'}
                `}>
                    {/* Close Button for Mobile Modal */}
                    {showMobileDetails && (
                        <button 
                            onClick={() => setShowMobileDetails(false)}
                            className="absolute top-4 right-4 z-50 w-10 h-10 bg-zinc-900/80 border border-zinc-600 rounded-full text-white flex items-center justify-center shadow-xl active:scale-95 md:hidden"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    )}

                    {selectedItem ? (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300 relative">
                            {/* Background Decoration */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.05)_0%,_transparent_50%)] pointer-events-none" />

                            {/* SCROLLABLE INFO AREA */}
                            <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
                                
                                {/* HEADER: RESPONSIVE LAYOUT */}
                                <div className="mb-6">
                                    {/* MOBILE LAYOUT: Name, Category, Icon centered stack */}
                                    <div className="flex flex-col items-center md:hidden">
                                        <h2 className="text-2xl font-black uppercase text-white tracking-tight leading-none mb-2 text-center">
                                            {selectedItem.name}
                                        </h2>
                                        <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest bg-emerald-950/30 px-3 py-1 rounded border border-emerald-900/50 mb-6">
                                            {getCategory(selectedItem)} CLASS
                                        </span>
                                        <div className="bg-zinc-900/50 p-6 rounded-full border border-zinc-800 shadow-[0_0_25px_rgba(0,0,0,0.5)] mb-2">
                                            <ItemSVG type={selectedItem.type || 'goods'} color={getItemColor(selectedItem)} size={96} />
                                        </div>
                                    </div>

                                    {/* DESKTOP LAYOUT: Icon Left, Name Right */}
                                    <div className="hidden md:flex items-start gap-6">
                                        <div className="shrink-0 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 shadow-lg flex items-center justify-center">
                                            <ItemSVG type={selectedItem.type || 'goods'} color={getItemColor(selectedItem)} size={largeIconSize} />
                                        </div>
                                        <div className="flex flex-col pt-1">
                                            <h2 className={`${fontSize === 'small' ? 'text-xl' : 'text-3xl'} font-black uppercase text-white tracking-tight leading-none mb-3`}>{selectedItem.name}</h2>
                                            <span className="text-xs font-mono text-emerald-500 uppercase tracking-widest bg-emerald-950/30 px-3 py-1 rounded border border-emerald-900/50 w-fit">{getCategory(selectedItem)} CLASS</span>
                                        </div>
                                    </div>
                                </div>

                                {/* DESCRIPTION */}
                                <div className="mb-6 bg-zinc-900/30 p-4 rounded-lg border border-zinc-800/50 relative">
                                     <div className="absolute top-0 left-0 w-1 h-full bg-zinc-700 rounded-l-lg" />
                                     <p className={`${descSize} text-zinc-400 font-mono leading-relaxed italic pl-2`}>
                                        "{selectedItem.description || "Standard issue galactic commodity. Used in various industrial and survival applications."}"
                                    </p>
                                </div>

                                {/* ATTRIBUTES & TRENDS */}
                                <div className="grid grid-cols-1 gap-4">
                                     {/* Stats (If Weapon/Shield) */}
                                     {showStats && (
                                         <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-zinc-900/50 rounded border border-zinc-800 p-2 flex flex-col gap-1">
                                                <div className="flex justify-between items-end">
                                                    <span className={`${statLabelSize} font-black uppercase text-zinc-500 tracking-widest`}>{getCategory(selectedItem) === 'DEFENSE' ? 'PROTECTION' : 'POWER'}</span>
                                                    <span className={`${statLabelSize} font-mono text-zinc-400`}>{Math.round(itemStats.power)}%</span>
                                                </div>
                                                <div className="w-full h-1 bg-black rounded-full overflow-hidden">
                                                    <div className="h-full bg-red-500" style={{ width: `${itemStats.power}%` }} />
                                                </div>
                                            </div>
                                            <div className="bg-zinc-900/50 rounded border border-zinc-800 p-2 flex flex-col gap-1">
                                                <div className="flex justify-between items-end">
                                                    <span className={`${statLabelSize} font-black uppercase text-zinc-500 tracking-widest`}>{getCategory(selectedItem) === 'DEFENSE' ? 'REGEN' : 'DISRUPTION'}</span>
                                                    <span className={`${statLabelSize} font-mono text-zinc-400`}>{Math.round(itemStats.disruption)}%</span>
                                                </div>
                                                <div className="w-full h-1 bg-black rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500" style={{ width: `${itemStats.disruption}%` }} />
                                                </div>
                                            </div>
                                         </div>
                                     )}

                                     {/* Price Level Bar */}
                                     <div className="bg-zinc-900/50 rounded border border-zinc-800 p-3">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`${statLabelSize} font-black uppercase text-zinc-500 tracking-widest`}>Market Trend</span>
                                            <span className={`${statLabelSize} font-bold uppercase`} style={{ color: priceLevel.color }}>{priceLevel.label}</span>
                                        </div>
                                        <div className="flex gap-[2px] h-1.5">
                                            {[1,2,3,4,5].map(i => {
                                                const active = i <= priceLevel.val;
                                                return <div key={i} className="flex-1 rounded-[1px]" style={{ backgroundColor: active ? priceLevel.color : '#18181b' }} />;
                                            })}
                                        </div>
                                     </div>
                                </div>
                            </div>

                            {/* COMPACT TRANSACTION FOOTER */}
                            <div className="bg-zinc-950 border-t border-zinc-800 p-4 shrink-0 shadow-[0_-4px_30px_rgba(0,0,0,0.5)] z-20 relative">
                                <div className="flex gap-6 items-end">
                                    
                                    {/* LEFT: SLIDER & VOLUME */}
                                    <div className="flex-1 flex flex-col gap-3">
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Quantity</span>
                                            <span className="text-xl font-mono font-black text-white leading-none">{transactionQty}</span>
                                        </div>
                                        
                                        <input 
                                            type="range" 
                                            min={maxTransaction > 0 ? 1 : 0} 
                                            max={maxTransaction || 1} 
                                            value={transactionQty}
                                            onChange={(e) => setTransactionQty(parseInt(e.target.value))}
                                            disabled={!maxTransaction}
                                            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-110 transition-all disabled:opacity-50"
                                        />
                                        
                                        <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 uppercase">
                                            <span>Cargo Impact</span>
                                            <span className={cargoImpact > 0 ? "text-amber-400" : "text-zinc-600"}>+{cargoImpact} Units</span>
                                        </div>
                                    </div>

                                    {/* DIVIDER */}
                                    <div className="w-[1px] h-12 bg-zinc-800 self-center hidden sm:block"></div>

                                    {/* RIGHT: PRICE & ACTION */}
                                    <div className="flex flex-col items-end gap-2 min-w-[140px]">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Total Cost</span>
                                            <span className={`text-2xl font-black tabular-nums leading-none ${credits >= totalPrice ? 'text-emerald-400' : 'text-red-500'}`}>
                                                ${totalPrice.toLocaleString()}
                                            </span>
                                        </div>
                                        
                                        <button 
                                            onClick={handleTransaction}
                                            disabled={!maxTransaction || transactionQty === 0 || (marketTab === 'buy' && credits < totalPrice)}
                                            className={`w-full py-2 font-black uppercase tracking-widest rounded shadow-lg transition-all active:scale-[0.98] text-xs flex items-center justify-center gap-2
                                            ${marketTab === 'buy' 
                                                ? (maxTransaction > 0 && credits >= totalPrice ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed') 
                                                : 'bg-amber-600 hover:bg-amber-500 text-white'}`}
                                        >
                                            {marketTab === 'buy' ? 'ACQUIRE' : 'SELL'}
                                        </button>
                                    </div>

                                </div>
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
