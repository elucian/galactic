
import React, { useState } from 'react';
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
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
}

const STANDARD_COLORS = [
    '#ffffff', '#94a3b8', '#475569', '#0f172a',
    '#ef4444', '#991b1b', '#f97316', '#facc15',
    '#84cc16', '#10b981', '#065f46', '#06b6d4',
    '#3b82f6', '#1e40af', '#8b5cf6', '#d946ef'
];

const PARTS_LIST: { id: ShipPart, label: string }[] = [
    { id: 'hull', label: 'Fuselage' },
    { id: 'wings', label: 'Wings' },
    { id: 'cockpit', label: 'Cockpit Glass' },
    { id: 'cockpit_highlight', label: 'Glass Glint' },
    { id: 'guns', label: 'Main Weapons' },
    { id: 'secondary_guns', label: 'Wing Weapons' },
    { id: 'gun_body', label: 'Weapon Mounts' },
    { id: 'engines', label: 'Engine Body' },
    { id: 'nozzles', label: 'Thruster Nozzles' },
    { id: 'bars', label: 'Detail Bars' }
];

const hexToRgb = (hex: string) => {
  if (hex && hex.startsWith('pat|')) return { r: 128, g: 128, b: 128 }; 
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
  const [showWeapons, setShowWeapons] = useState(true);
  
  const currentColor = (() => {
      if (activePart === 'hull') return gameState.shipColors[selectedShipInstanceId];
      if (activePart === 'wings') return gameState.shipWingColors[selectedShipInstanceId];
      if (activePart === 'cockpit') return gameState.shipCockpitColors[selectedShipInstanceId];
      if (activePart === 'cockpit_highlight') return gameState.shipCockpitHighlightColors[selectedShipInstanceId];
      if (activePart === 'guns') return gameState.shipGunColors[selectedShipInstanceId];
      if (activePart === 'secondary_guns') return gameState.shipSecondaryGunColors[selectedShipInstanceId];
      if (activePart === 'gun_body') return gameState.shipGunBodyColors[selectedShipInstanceId];
      if (activePart === 'engines') return gameState.shipEngineColors[selectedShipInstanceId];
      if (activePart === 'nozzles') return gameState.shipNozzleColors[selectedShipInstanceId];
      if (activePart === 'bars') return gameState.shipBarColors[selectedShipInstanceId];
      return '#fff';
  })();

  const handleColorPick = (color: string) => {
      setPartColor(color);
      setSelectedCustomIndex(null); 
  };

  const currentFitting = gameState.shipFittings[selectedShipInstanceId];

  if (!isOpen || !selectedShipInstanceId || !selectedShipConfig) return null;

  const titleSize = fontSize === 'small' ? 'text-[11px]' : (fontSize === 'large' ? 'text-[16px]' : 'text-[13px]');
  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');

  const rgb = hexToRgb(currentColor || '#000000');

  const handleSliderChange = (channel: 'r' | 'g' | 'b', value: number) => {
      const newRgb = { ...rgb, [channel]: value };
      const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
      if (selectedCustomIndex !== null) {
          updateCustomColor(selectedCustomIndex, hex);
          handleColorPick(hex);
      } else {
          handleColorPick(hex);
      }
  };

  return (
    <div className="fixed inset-0 z-[9950] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
        <div className="w-full max-w-6xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[90vh] shadow-2xl">
            <header className="p-3 border-b border-zinc-800 flex justify-between bg-zinc-900/50 shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className={`retro-font text-emerald-500 ${titleSize} uppercase`}>Paint System</h2>
                    <div className="h-6 w-[1px] bg-zinc-800"></div>
                    <button onClick={() => setShowWeapons(!showWeapons)} className={`text-[9px] font-black uppercase px-3 py-1 rounded border transition-colors ${showWeapons ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>{showWeapons ? "Weapons: Visible" : "Weapons: Hidden"}</button>
                </div>
                <button onClick={onClose} className={`text-red-500 uppercase font-black ${btnSize}`}>DONE</button>
            </header>
            <div className="flex-grow flex flex-col sm:flex-row overflow-hidden">
                <div className="flex-1 p-2 sm:p-4 flex flex-col items-center justify-center bg-black/40 border-r border-zinc-900 relative min-h-[30vh]">
                    <div className="relative w-full h-full max-h-[80vh] aspect-square flex items-center justify-center">
                        <ShipIcon 
                            config={selectedShipConfig} 
                            className="w-full h-full object-contain cursor-pointer" 
                            activePart={activePart} 
                            onPartSelect={setActivePart} 
                            hullColor={gameState.shipColors[selectedShipInstanceId]} 
                            wingColor={gameState.shipWingColors[selectedShipInstanceId]} 
                            cockpitColor={gameState.shipCockpitColors[selectedShipInstanceId]}
                            cockpitHighlightColor={gameState.shipCockpitHighlightColors[selectedShipInstanceId]} 
                            gunColor={gameState.shipGunColors[selectedShipInstanceId]} 
                            secondaryGunColor={gameState.shipSecondaryGunColors[selectedShipInstanceId]}
                            gunBodyColor={gameState.shipGunBodyColors[selectedShipInstanceId]} 
                            engineColor={gameState.shipEngineColors[selectedShipInstanceId]} 
                            nozzleColor={gameState.shipNozzleColors[selectedShipInstanceId]} 
                            barColor={gameState.shipBarColors[selectedShipInstanceId]}
                            showJets={false} 
                            equippedWeapons={showWeapons ? currentFitting?.weapons : [null, null, null]}
                        />
                    </div>
                </div>
                
                <div className="w-full sm:w-[360px] p-4 flex flex-col gap-3 bg-zinc-900/20 overflow-y-auto custom-scrollbar shrink-0">
                    <div className="space-y-2 shrink-0 border-b border-zinc-800 pb-2">
                        <div className="text-[10px] font-black uppercase text-zinc-400 text-center mb-2">
                            Select Component
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {PARTS_LIST.map(part => (
                                <button
                                    key={part.id}
                                    onClick={() => setActivePart(part.id)}
                                    className={`px-2 py-2 text-[9px] font-black uppercase rounded border transition-all ${activePart === part.id ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    {part.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1 shrink-0 pt-2">
                        <span className="text-[9px] font-black text-zinc-500 uppercase">Standard Colors</span>
                        <div className="grid grid-cols-8 gap-1">
                            {STANDARD_COLORS.map(c => ( 
                                <button 
                                    key={c} 
                                    onClick={() => handleColorPick(c)} 
                                    className={`w-full aspect-square rounded-sm border transition-transform hover:scale-105 ${currentColor === c && selectedCustomIndex === null ? 'border-white scale-110 shadow-lg z-10' : 'border-black/20 hover:border-zinc-500'}`} 
                                    style={{ backgroundColor: c }} 
                                /> 
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1 shrink-0 pt-1">
                        <span className="text-[9px] font-black text-zinc-500 uppercase">Custom Mixes</span>
                        <div className="grid grid-cols-8 gap-1">
                            {gameState.customColors.map((c, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => { setSelectedCustomIndex(i); handleColorPick(c); }} 
                                    className={`w-full aspect-square rounded-sm border transition-transform hover:scale-105 relative overflow-hidden ${selectedCustomIndex === i ? 'border-emerald-500 scale-110 shadow-[0_0_10px_#10b981]' : (currentColor === c ? 'border-white' : 'border-black/20 hover:border-zinc-500')}`}
                                >
                                    <div className="absolute inset-0" style={{ backgroundColor: c.startsWith('pat|') ? '#444' : c }} />
                                    {c.startsWith('pat|') && <div className="absolute inset-0 flex items-center justify-center text-[6px] text-white">PAT</div>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-zinc-800 bg-zinc-900/50 p-3 rounded mt-auto shrink-0">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black text-emerald-500 uppercase">{selectedCustomIndex !== null ? `Editing Custom Slot ${selectedCustomIndex + 1}` : 'Quick Mix'}</span>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full shadow-sm border border-white/20" style={{ backgroundColor: `rgb(${rgb.r},${rgb.g},${rgb.b})` }} />
                                <span className="text-[9px] font-mono text-zinc-400">{rgbToHex(rgb.r, rgb.g, rgb.b)}</span>
                            </div>
                        </div>
                        {(['r', 'g', 'b'] as const).map(channel => (
                            <div key={channel} className="flex items-center gap-2">
                                <span className={`text-[8px] font-black uppercase w-3 ${channel === 'r' ? 'text-red-500' : (channel === 'g' ? 'text-green-500' : 'text-blue-500')}`}>{channel}</span>
                                <input type="range" min="0" max="255" step="1" value={rgb[channel]} onChange={(e) => handleSliderChange(channel, parseInt(e.target.value))} className={`flex-grow h-1.5 rounded-lg appearance-none cursor-pointer bg-zinc-800 ${channel === 'r' ? '[&::-webkit-slider-thumb]:bg-red-500' : (channel === 'g' ? '[&::-webkit-slider-thumb]:bg-green-500' : '[&::-webkit-slider-thumb]:bg-blue-500')} [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-110 transition-all`} />
                                <span className="text-[8px] font-mono text-zinc-500 w-5 text-right">{rgb[channel]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
