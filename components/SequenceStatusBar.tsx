
import React from 'react';

const GaugePanel = ({ value, max, label, unit, color = "#10b981" }: { value: number, max: number, label: string, unit: string, color?: string }) => {
    // Reduced size by ~20%
    const radius = 25; // Was 32
    const stroke = 5;  // Was 6
    const normalizedRadius = radius - stroke / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const progress = Math.min(1, Math.max(0, value / max));
    const dashOffset = circumference - progress * circumference;
    
    return (
        <div className="flex flex-col bg-zinc-900/60 border border-zinc-700/50 shadow-2xl backdrop-blur-md min-w-[85px] rounded-xl overflow-hidden">
            {/* Compact Header */}
            <div className="bg-zinc-950/50 border-b border-zinc-800/50 px-2 py-1 flex justify-between items-center">
                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{label}</span>
                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}></div>
            </div>
            
            {/* Compact Gauge Area */}
            <div className="p-2 flex flex-col items-center justify-center relative">
                <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-lg" viewBox="0 0 60 60">
                        {/* Background Track */}
                        <circle
                            cx="30"
                            cy="30"
                            r={normalizedRadius}
                            fill="transparent"
                            stroke="#18181b"
                            strokeWidth={stroke}
                        />
                        {/* Progress Arc */}
                        <circle
                            cx="30"
                            cy="30"
                            r={normalizedRadius}
                            fill="transparent"
                            stroke={color}
                            strokeWidth={stroke}
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            className="transition-all duration-300 ease-out"
                            style={{ filter: `drop-shadow(0 0 3px ${color})` }}
                        />
                    </svg>
                    {/* Value Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xs font-mono font-bold text-white tabular-nums leading-none drop-shadow-md">
                            {value >= 10000 ? (value/1000).toFixed(1)+'k' : (value < 10 ? value.toFixed(1) : Math.floor(value))}
                        </span>
                        <span className="text-[6px] text-zinc-500 font-black uppercase leading-none mt-0.5">{unit}</span>
                    </div>
                </div>
            </div>
            
            {/* Bottom Deco */}
            <div className="h-0.5 w-full bg-zinc-800/50 relative">
                <div className="absolute left-0 top-0 h-full bg-zinc-600/80 w-1/3"></div>
            </div>
        </div>
    );
};

interface SequenceStatusBarProps {
    altitude: number;
    velocity: number;
    fuel: number;
    maxFuel: number;
    status: string;
    onSkip: () => void;
    phase?: string;
}

export const SequenceStatusBar: React.FC<SequenceStatusBarProps> = ({ altitude, velocity, fuel, maxFuel, status, onSkip, phase }) => {
    return (
        <>
            {/* LEFT SIDEBAR GAUGES - MOVED TO TOP LEFT */}
            <div className="absolute left-4 top-4 flex flex-col gap-2 z-50 pointer-events-none">
                <GaugePanel value={altitude} max={30000} label="ALT" unit="M" color="#3b82f6" />
                <GaugePanel value={velocity} max={2500} label="SPD" unit="KPH" color="#facc15" />
                <GaugePanel value={fuel} max={maxFuel} label="FUEL" unit="%" color="#ef4444" />
            </div>

            {/* BOTTOM STATUS BAR */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-zinc-950/95 border-t-4 border-zinc-800 z-50 flex justify-between items-center px-6 safe-area-bottom shadow-[0_-10px_40px_rgba(0,0,0,0.8)] pointer-events-auto">
                
                {/* LEFT: STATUS TEXT */}
                <div className="flex flex-col justify-center">
                     <div className="flex items-center gap-2 mb-0.5">
                         <div className={`w-2 h-2 ${phase === 'ignition' || status.includes('TOUCHDOWN') ? 'bg-white animate-ping' : 'bg-emerald-500'} shadow-[0_0_8px_currentColor]`}></div>
                         <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">FLIGHT COMPUTER</span>
                     </div>
                     <span className={`text-xl md:text-2xl font-black uppercase tracking-[0.1em] leading-none ${phase === 'ignition' || status.includes('TOUCHDOWN') ? 'text-white animate-pulse' : 'text-emerald-400'}`} style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                        {status}
                     </span>
                </div>
                
                {/* RIGHT: SKIP BUTTON */}
                <button 
                    onClick={onSkip} 
                    className="h-10 px-6 bg-zinc-900 border border-zinc-700 hover:border-emerald-500 hover:text-emerald-400 text-zinc-400 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-3 shadow-lg group"
                >
                    SKIP SEQ
                    <span className="text-sm group-hover:translate-x-1 transition-transform">➜</span>
                </button>
            </div>
        </>
    );
};
