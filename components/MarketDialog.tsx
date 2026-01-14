
import React, { useState } from 'react';
import { CargoItem } from '../types.ts';
import { WEAPONS, SHIELDS, EXPLODING_ORDNANCE, COMMODITIES, EXOTIC_WEAPONS, EXOTIC_SHIELDS, AMMO_MARKET_ITEMS, AMMO_CONFIG } from '../constants.ts';
import { ItemSVG } from './Common.tsx';

interface MarketDialogProps {
  isOpen: boolean;
  onClose: () => void;
  marketTab: 'buy' | 'sell';
  setMarketTab: (tab: 'buy' | 'sell') => void;
  currentReserves: CargoItem[];
  credits: number;
  testMode: boolean;
  marketBuy: (item: any) => void;
  marketSell: (resIdx: number) => void;
  fontSize: 'small' | 'medium' | 'large';
}

const getCategory = (item: any) => {
    // Check type or infer from properties if type is generic 'goods'
    const t = (item.type || '').toLowerCase();
    
    // Combined AMMO into ORDNANCE
    if (t === 'ammo') return 'ORDNANCE';
    
    // Combined WEAPONRY and DEFENSE into EQUIPMENT
    if (['weapon', 'gun', 'projectile', 'laser'].includes(t) || item.damage) return 'EQUIPMENT';
    if (['shield'].includes(t) || item.capacity) return 'EQUIPMENT';
    
    if (['missile', 'mine'].includes(t)) return 'ORDNANCE';
    if (['fuel', 'energy', 'repair', 'robot'].includes(t)) return 'SUPPLIES';
    return 'RESOURCES';
};

const CATEGORY_ORDER = ['EQUIPMENT', 'ORDNANCE', 'SUPPLIES', 'RESOURCES'];

export const MarketDialog: React.FC<MarketDialogProps> = ({
  isOpen, onClose, marketTab, setMarketTab, currentReserves, credits, testMode, marketBuy, marketSell, fontSize
}) => {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  if (!isOpen) return null;

  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');
  const btnPadding = fontSize === 'small' ? 'px-6 py-3' : (fontSize === 'large' ? 'px-8 py-5' : 'px-7 py-4');
  const iconSize = fontSize === 'small' ? 22 : (fontSize === 'large' ? 32 : 26);

  const isExoticItem = (id?: string) => {
      if (!id) return false;
      return [...EXOTIC_WEAPONS, ...EXOTIC_SHIELDS].some(ex => ex.id === id);
  };

  const toggleFilter = (cat: string) => {
      setActiveFilters(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const getFilteredCategories = () => {
      if (activeFilters.length === 0) return CATEGORY_ORDER;
      return CATEGORY_ORDER.filter(c => activeFilters.includes(c));
  };

  const renderBuyGrid = () => {
      // Prepare Items: Inject types for Ordnance
      let itemsToBuy: any[] = [
          ...AMMO_MARKET_ITEMS, 
          ...WEAPONS, 
          ...SHIELDS, 
          ...EXPLODING_ORDNANCE.map(o => ({ ...o, type: o.id.includes('mine') ? 'mine' : 'missile' })), 
          ...COMMODITIES
      ];
      
      // Inject Supplies if missing from constants but supported by logic
      if (!itemsToBuy.some(i => i.type === 'repair')) {
          itemsToBuy.push({ id: 'pack_repair', name: 'Nanite Pack', price: 500, type: 'repair' });
      }
      if (!itemsToBuy.some(i => i.type === 'fuel')) {
          itemsToBuy.push({ id: 'can_fuel', name: 'Fuel Cell', price: 200, type: 'fuel' });
      }
      if (!itemsToBuy.some(i => i.type === 'energy')) {
          itemsToBuy.push({ id: 'batt_cell', name: 'Energy Cell', price: 300, type: 'energy' });
      }

      if (testMode) {
          itemsToBuy = [...itemsToBuy, ...EXOTIC_WEAPONS, ...EXOTIC_SHIELDS];
      }

      const grouped: Record<string, any[]> = {};
      itemsToBuy.forEach(it => {
          const cat = getCategory(it);
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(it);
      });

      const catsToShow = getFilteredCategories();

      return (
          <div className="space-y-6">
              {catsToShow.map(cat => {
                  const groupItems = grouped[cat];
                  if (!groupItems || groupItems.length === 0) return null;
                  return (
                      <div key={cat}>
                          <div className="flex items-center gap-2 mb-2 border-b border-zinc-800/50 pb-1">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{cat}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {groupItems.map(it => {
                                  const isExotic = isExoticItem(it.id);
                                  const isAmmo = it.type === 'ammo';
                                  const isOrdnance = cat === 'ORDNANCE';
                                  const isBulkItem = ['missile', 'mine', 'repair'].includes(it.type);
                                  
                                  // Bulk Pricing for 10 units
                                  const buyQty = isBulkItem ? 10 : 1;
                                  const displayPrice = it.price * buyQty;
                                  const buyLabel = isBulkItem ? "BUY 10" : "BUY 1";
                                  
                                  const buyAction = () => marketBuy({ ...it, price: displayPrice, _buyAmount: buyQty });
                                  
                                  let color = '#10b981'; // Default Green
                                  if (isExotic) color = '#fb923c'; // Exotic Orange
                                  else if (isAmmo) color = (AMMO_CONFIG[it.id as keyof typeof AMMO_CONFIG]?.color || '#facc15');
                                  else if (isOrdnance) {
                                      if (it.id.includes('missile')) color = '#ef4444'; // Red
                                      else if (it.id.includes('emp')) color = '#3b82f6'; // Blue (EMP Mine)
                                      else color = '#fbbf24'; // Yellow (Standard Mine)
                                  } else {
                                      // Check for Standard Weapon
                                      const wDef = WEAPONS.find(w => w.id === it.id);
                                      if (wDef) {
                                           if (wDef.type === 'LASER') color = wDef.beamColor || '#3b82f6';
                                           else if (wDef.type === 'PROJECTILE') color = '#9ca3af'; // Gray
                                      }
                                  }

                                  return (
                                      <button key={it.id} onClick={buyAction} className={`flex justify-between items-center p-3 bg-zinc-900/40 border border-zinc-800 hover:border-emerald-500/40 hover:bg-zinc-800 rounded group transition-all text-left ${isExotic ? 'border-orange-500/30 bg-orange-900/10 hover:border-orange-500 hover:bg-orange-900/30' : ''} ${isAmmo ? 'hover:border-yellow-500/40 hover:bg-yellow-900/10' : ''}`}>
                                          <div className="flex items-center gap-3">
                                              <div className={`w-8 h-8 flex items-center justify-center bg-black border border-zinc-700 rounded ${isExotic ? 'border-orange-500 shadow-[0_0_10px_#f97316]' : (isAmmo ? 'border-yellow-600' : '')}`}>
                                                  <ItemSVG 
                                                    type={(it as any).damage ? 'weapon' : ((it as any).capacity ? 'shield' : ((it as any).type || 'goods'))} 
                                                    color={color} 
                                                    size={iconSize}
                                                  />
                                              </div>
                                              <span className={`text-[10px] font-black uppercase truncate w-24 ${isExotic ? 'text-orange-400' : (isAmmo ? 'text-yellow-400' : 'text-emerald-400')}`}>{it.name}</span>
                                          </div>
                                          <div className="flex flex-col items-end">
                                              <span className={`text-[10px] font-black tabular-nums ${isExotic ? 'text-orange-300' : (isAmmo ? 'text-yellow-300' : 'text-emerald-400')}`}>${displayPrice.toLocaleString()}</span>
                                              <span className="text-[8px] text-zinc-600 uppercase font-black group-hover:text-emerald-500">{buyLabel}</span>
                                          </div>
                                      </button>
                                  );
                              })}
                          </div>
                      </div>
                  );
              })}
          </div>
      );
  };

  const renderSellList = () => {
      if (currentReserves.length === 0) return <div className="p-10 text-center opacity-30 text-sm font-black uppercase">No Reserve Items to Sell</div>;

      const grouped: Record<string, { item: CargoItem, idx: number }[]> = {};
      currentReserves.forEach((item, idx) => {
          const cat = getCategory(item);
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push({ item, idx });
      });

      const catsToShow = getFilteredCategories();

      return (
          <div className="space-y-6">
              {catsToShow.map(cat => {
                  const groupItems = grouped[cat];
                  if (!groupItems || groupItems.length === 0) return null;
                  return (
                      <div key={cat}>
                          <div className="flex items-center gap-2 mb-2 border-b border-zinc-800/50 pb-1">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{cat}</span>
                          </div>
                          <div className="space-y-2">
                              {groupItems.map(({ item, idx }) => {
                                  const isExotic = isExoticItem(item.id);
                                  const isAmmo = item.type === 'ammo';
                                  const isOrdnance = cat === 'ORDNANCE';
                                  
                                  let color = isExotic ? '#fb923c' : '#fbbf24';
                                  if (isAmmo) color = AMMO_CONFIG[item.id as keyof typeof AMMO_CONFIG]?.color || '#fbbf24';
                                  else if (isOrdnance) {
                                      if (item.id?.includes('missile')) color = '#ef4444'; 
                                      else if (item.id?.includes('emp')) color = '#3b82f6';
                                      else color = '#fbbf24'; 
                                  } else {
                                      // Check for Standard Weapon
                                      const wDef = WEAPONS.find(w => w.id === item.id);
                                      if (wDef) {
                                           if (wDef.type === 'LASER') color = wDef.beamColor || '#3b82f6';
                                           else if (wDef.type === 'PROJECTILE') color = '#9ca3af'; 
                                      }
                                  }

                                  return (
                                      <div key={item.instanceId} className="flex justify-between items-center p-3 border border-zinc-800 bg-zinc-900/40 rounded hover:border-amber-500/50 transition-all">
                                          <div className="flex items-center gap-4">
                                              <ItemSVG type={item.type} color={color} size={iconSize}/>
                                              <span className={`text-[11px] font-black uppercase ${isExotic ? 'text-orange-400' : 'text-emerald-400'}`}>{item.name} x{item.quantity}</span>
                                          </div>
                                          <button onClick={() => marketSell(idx)} className="px-4 py-2 bg-amber-600/20 border border-amber-600 text-amber-500 text-[9px] font-black uppercase rounded hover:bg-amber-600 hover:text-white transition-all">SELL 1 UNIT</button>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[9800] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
        <div className="w-full max-w-4xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[85vh] shadow-2xl">
            <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 shrink-0 gap-4">
                <div className="flex gap-2">
                    <button onClick={() => setMarketTab('buy')} className={`retro-font ${btnSize} uppercase ${btnPadding} rounded-t-lg transition-all ${marketTab === 'buy' ? 'bg-emerald-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}>BUY</button>
                    <button onClick={() => setMarketTab('sell')} className={`retro-font ${btnSize} uppercase ${btnPadding} rounded-t-lg transition-all ${marketTab === 'sell' ? 'bg-amber-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}>SELL</button>
                </div>
                
                {/* FILTER BUTTONS */}
                <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800/50">
                    {[
                        { label: 'EQUIPMENT', cat: 'EQUIPMENT' },
                        { label: 'ORDNANCE', cat: 'ORDNANCE' },
                        { label: 'SUPPLIES', cat: 'SUPPLIES' },
                        { label: 'RESOURCES', cat: 'RESOURCES' }
                    ].map(f => {
                        const isActive = activeFilters.includes(f.cat);
                        return (
                            <button 
                                key={f.cat}
                                onClick={() => toggleFilter(f.cat)}
                                className={`
                                    ${btnSize} font-black uppercase px-3 py-1 rounded transition-all border
                                    ${isActive 
                                        ? 'bg-zinc-700 text-white border-zinc-600 shadow-inner' 
                                        : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-400 hover:bg-zinc-800/50'}
                                `}
                            >
                                {f.label}
                            </button>
                        )
                    })}
                </div>

                <button onClick={onClose} className={`text-zinc-500 ${btnSize} font-black ${btnPadding.replace('py-3','py-2').replace('py-5','py-4').replace('py-4','py-3')}`}>DONE</button>
            </header>
            <div className="flex-grow overflow-y-auto p-4 custom-scrollbar bg-black/40">
                {marketTab === 'buy' ? renderBuyGrid() : renderSellList()}
            </div>
        </div>
    </div>
  );
};
