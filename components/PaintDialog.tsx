
import React, { useState, useEffect } from 'react';
import { ShipIcon } from './ShipIcon.tsx';
import { ShipPart, GameState } from '../types.ts';

interface PaintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedShipInstanceId: string;
  selectedShipConfig: any;
  activePart: ShipPart;
  setActivePart: (part: ShipPart) => void;
  gameState: GameState;
  setPartColor: (color: string) => void;
  updateCustomColor: (index: number, color: string) => void;
  fontSize: 'small' | 'medium' | 'large';
}

const STANDARD_COLORS = [
    '#ffffff', '#94a3b8', '#475569', '#0f172a',
    '#ef4444', '#991b1b', '#f97316', '#facc15',
    '#84cc16', '#10b981', '#065f46', '#06b6d4',
    '#3b82f6', '#1e40af', '#8b5cf6', '#d946ef'
];

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

export const PaintDialog: React.FC<PaintDialogProps> = ({
  isOpen, onClose, selectedShipInstanceId, selectedShipConfig, activePart, setActivePart, gameState, setPartColor, updateCustomColor, fontSize
}) => {
  const [selectedCustomIndex, setSelectedCustomIndex] = useState<number | null>(null);
  const [rgb, setRgb] = useState({ r: 0, g: 0, b: 0 });

  // Default to first slot if nothing selected
  const activeEditIndex = selectedCustomIndex ?? 0;

  useEffect(() => {
      if (gameState.customColors[activeEditIndex]) {
          setRgb(hexToRgb(gameState.customColors[activeEditIndex]));
      }
  }, [activeEditIndex, gameState.customColors]);

  const handleSliderChange = (channel: 'r' | 'g' | 'b', value: number) => {
      const newRgb = { ...rgb, [channel]: value };
      setRgb(newRgb);
      const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
      
      updateCustomColor(activeEditIndex, hex);
      
      // If user touches sliders while a standard color is active, 
      // automatically switch to the custom slot being edited so they see changes on the ship.
      if (selectedCustomIndex === null) {
          setSelectedCustomIndex(0);
          setPartColor(hex); 
      }
  };

  if (!isOpen || !selectedShipInstanceId || !selectedShipConfig) return null;

  const titleSize = fontSize === 'small' ? 'text-[11px]' : (fontSize === 'large' ? 'text-[16px]' : 'text-[13px]');
  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');

  const currentColor = (() => {
      if (activePart === 'hull') return gameState.shipColors[selectedShipInstanceId];
      if (activePart === 'wings') return gameState.shipWingColors[selectedShipInstanceId];
      if (activePart === 'cockpit') return gameState.shipCockpitColors[selectedShipInstanceId];
      if (activePart === 'guns') return gameState.shipGunColors[selectedShipInstanceId];
      if (activePart === 'gun_body') return gameState.shipGunBodyColors[selectedShipInstanceId];
      if (activePart === 'engines') return gameState.shipEngineColors[selectedShipInstanceId];
      if (activePart === 'nozzles') return gameState.shipNozzleColors[selectedShipInstanceId];
      return '#fff';
  })();

  return (
    <div className="fixed inset-0 z-[9950] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
        <div className="w-full max-w-5xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[90vh] shadow-2xl">
            <header className="p-3 border-b border-zinc-800 flex justify-between bg-zinc-900/50 shrink-0">
                <h2 className={`retro-font text-emerald-500 ${titleSize} uppercase`}>Paint System</h2>
                <button onClick={onClose} className={`text-red-500 uppercase font-black ${btnSize}`}>DONE</button>
            </header>
            <div className="flex-grow flex flex-col sm:flex-row overflow-hidden">
                {/* Ship Viewport - Flexible height */}
                <div className="flex-1 p-2 sm:p-4 flex flex-col items-center justify-center bg-black/40 border-r border-zinc-900 relative min-h-[30vh]">
                    <ShipIcon 
                        config={selectedShipConfig} 
                        className="w-full h-full cursor-pointer" 
                        activePart={activePart} 
                        onPartSelect={setActivePart} 
                        hullColor={gameState.shipColors[selectedShipInstanceId]} 
                        wingColor={gameState.shipWingColors[selectedShipInstanceId]} 
                        cockpitColor={gameState.shipCockpitColors[selectedShipInstanceId]} 
                        gunColor={gameState.shipGunColors[selectedShipInstanceId]} 
                        gunBodyColor={gameState.shipGunBodyColors[selectedShipInstanceId]} 
                        engineColor={gameState.shipEngineColors[selectedShipInstanceId]} 
                        nozzleColor={gameState.shipNozzleColors[selectedShipInstanceId]} 
                        showJets={false} 
                    />
                </div>
                
                {/* Controls - Fixed width on desktop, compact on mobile */}
                <div className="w-full sm:w-[320px] p-4 flex flex-col gap-3 bg-zinc-900/20 overflow-y-auto custom-scrollbar shrink-0">
                    
                    <div className="space-y-1 shrink-0 border-b border-zinc-800 pb-2">
                        <label className="text-[9px] font-black uppercase text-zinc-400">Target Part</label>
                        <div className="text-xl font-black text-white uppercase">{activePart.replace('_', ' ')}</div>
                    </div>

                    <div className="space-y-1 shrink-0">
                        <span className="text-[9px] font-black text-zinc-500 uppercase">Standard Protocols</span>
                        {/* Compact 8-column grid */}
                        <div className="grid grid-cols-8 gap-1">
                            {STANDARD_COLORS.map(c => (
                                <button 
                                    key={c} 
                                    onClick={() => { setPartColor(c); setSelectedCustomIndex(null); }} 
                                    className={`w-full aspect-square rounded-sm border transition-transform hover:scale-105 ${currentColor === c && selectedCustomIndex === null ? 'border-white scale-110 shadow-lg z-10' : 'border-black/20 hover:border-zinc-500'}`} 
                                    style={{ backgroundColor: c }} 
                                />
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1 shrink-0 pt-1 border-t border-zinc-800">
                        <span className="text-[9px] font-black text-zinc-500 uppercase">Custom Mixtures</span>
                        <div className="grid grid-cols-8 gap-1">
                            {gameState.customColors.map((c, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => { setPartColor(c); setSelectedCustomIndex(i); }} 
                                    className={`w-full aspect-square rounded-sm border transition-transform hover:scale-105 ${selectedCustomIndex === i ? 'border-emerald-500 scale-110 shadow-[0_0_10px_#10b981]' : (currentColor === c ? 'border-white' : 'border-black/20 hover:border-zinc-500')}`} 
                                    style={{ backgroundColor: c }} 
                                />
                            ))}
                        </div>
                    </div>

                    {/* Sliders - Always Visible & Pushed to bottom if space allows */}
                    <div className="space-y-2 pt-2 border-t border-zinc-800 bg-zinc-900/50 p-3 rounded mt-auto shrink-0">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black text-emerald-500 uppercase">Spectrum Analyzer {selectedCustomIndex === null ? '(EDITING #1)' : ''}</span>
                            <div className="w-4 h-4 rounded border border-zinc-600" style={{ backgroundColor: gameState.customColors[activeEditIndex] }} />
                        </div>
                        
                        {['r', 'g', 'b'].map(channel => {
                            const val = rgb[channel as keyof typeof rgb];
                            let trackColor = '';
                            let thumbClass = '';
                            
                            if (channel === 'r') {
                                trackColor = `linear-gradient(90deg, #000000 0%, #ef4444 100%)`;
                                thumbClass = '[&::-webkit-slider-thumb]:bg-red-500';
                            } else if (channel === 'g') {
                                trackColor = `linear-gradient(90deg, #000000 0%, #22c55e 100%)`;
                                thumbClass = '[&::-webkit-slider-thumb]:bg-green-500';
                            } else {
                                trackColor = `linear-gradient(90deg, #000000 0%, #3b82f6 100%)`;
                                thumbClass = '[&::-webkit-slider-thumb]:bg-blue-500';
                            }

                            return (
                                <div key={channel} className="flex items-center gap-2">
                                    <span className="text-[8px] font-black text-zinc-400 w-4 uppercase">{channel}</span>
                                    <input 
                                        type="range" 
                                        min="0" max="255" 
                                        value={val} 
                                        onChange={(e) => handleSliderChange(channel as any, parseInt(e.target.value))}
                                        style={{ background: trackColor }}
                                        className={`flex-grow h-1.5 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white ${thumbClass}`}
                                    />
                                    <span className="text-[8px] font-mono text-zinc-300 w-6 text-right">{val}</span>
                                </div>
                            );
                        })}
                    </div>

                </div>
            </div>
        </div>
    </div>
  );
};
