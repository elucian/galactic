
import React from 'react';

export const LEDMeter = ({ value, max, colorStart, label, vertical = false, reverseColor = false, warnThreshold = 0.3, critThreshold = 0.1 }: { value: number, max: number, colorStart: string, label: string, vertical?: boolean, reverseColor?: boolean, warnThreshold?: number, critThreshold?: number }) => {
    const segments = 20; 
    const pct = Math.max(0, Math.min(1, value / max));
    const filled = Math.ceil(pct * segments);

    let activeColor = colorStart;
    
    if (reverseColor) {
        // High value is critical (e.g. Overheat)
        // Map standard thresholds to upper range for reverse logic consistency if needed, 
        // though typically reverse uses high % for danger.
        // Assuming default logic for reverse was >0.9 (Crit) and >0.7 (Warn) which matches 1-crit(0.1) and 1-warn(0.3).
        // We use the passed thresholds to invert them.
        if (pct > (1 - critThreshold)) activeColor = '#ef4444'; 
        else if (pct > (1 - warnThreshold)) activeColor = '#facc15'; 
    } else {
        // Low value is critical (e.g. Health, Fuel, Charge)
        if (pct < critThreshold) activeColor = '#ef4444'; 
        else if (pct < warnThreshold) activeColor = '#facc15'; 
    }

    return (
        <div className={`flex ${vertical ? 'flex-col items-center h-40' : 'flex-row items-center w-full'} gap-1`}>
            {vertical ? (
                <>
                    <div className="flex flex-col-reverse gap-[1px] bg-black p-[2px] border border-zinc-800 rounded h-full w-5 shadow-inner">
                        {Array.from({ length: segments }).map((_, i) => {
                            const isActive = i < filled;
                            return (
                                <div
                                    key={i}
                                    className="w-full h-[5px] rounded-[1px] transition-colors duration-150"
                                    style={{
                                        backgroundColor: isActive ? activeColor : '#18181b',
                                        boxShadow: isActive ? `0 0 6px ${activeColor}` : 'none',
                                        opacity: isActive ? 1 : 0.5
                                    }}
                                />
                            );
                        })}
                    </div>
                    <div className="w-5 h-5 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded mt-1">
                        <span className="text-[10px] font-black text-white">{label}</span>
                    </div>
                </>
            ) : (
                <>
                    <div className="w-5 h-5 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded mr-1">
                        <span className="text-[10px] font-black text-white">{label}</span>
                    </div>
                    <div className="flex flex-row gap-[1px] bg-black p-[2px] border border-zinc-800 rounded w-24 sm:w-32 h-4 shadow-inner">
                        {Array.from({ length: segments }).map((_, i) => {
                            const isActive = i < filled;
                            return (
                                <div
                                    key={i}
                                    className="h-full flex-1 rounded-[1px] transition-colors duration-150"
                                    style={{
                                        backgroundColor: isActive ? activeColor : '#18181b',
                                        boxShadow: isActive ? `0 0 6px ${activeColor}` : 'none',
                                        opacity: isActive ? 1 : 0.5
                                    }}
                                />
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

export const RoundCadran = ({ value, max }: { value: number, max: number }) => {
    const percentage = Math.min(1, Math.max(0, value / max));
    let color = '#10b981'; 
    if (percentage < 0.1) color = '#ef4444'; 
    else if (percentage < 0.3) color = '#facc15'; 

    const segments = 10;
    const activeSegments = Math.ceil(percentage * segments);
    const radius = 25; 
    const center = { x: 30, y: 30 };
    const strokeWidth = 5; 
    const paths = [];

    for(let i=0; i<segments; i++) {
        const startAngle = -180 + (i * (180/segments));
        const endAngle = startAngle + (180/segments) - 4; 
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        const x1 = center.x + radius * Math.cos(startRad);
        const y1 = center.y + radius * Math.sin(startRad);
        const x2 = center.x + radius * Math.cos(endRad);
        const y2 = center.y + radius * Math.sin(endRad);
        const d = `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
        const isActive = i < activeSegments;
        
        paths.push(
            <path key={i} d={d} fill="none" stroke={isActive ? color : '#334155'} strokeWidth={strokeWidth} strokeLinecap="round" className="transition-colors duration-200" />
        );
    }

    const needleAngle = -180 + (percentage * 180);
    const needleRad = (needleAngle * Math.PI) / 180;
    const nx = center.x + (radius - 2) * Math.cos(needleRad);
    const ny = center.y + (radius - 2) * Math.sin(needleRad);

    return (
        <div className="w-16 h-10 flex justify-center items-end mb-1">
            <svg width="60" height="35" viewBox="0 0 60 35">
                {paths}
                <line x1={center.x} y1={center.y} x2={nx} y2={ny} stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
                <circle cx={center.x} cy={center.y} r="2" fill="rgba(255,255,255,0.5)" />
            </svg>
        </div>
    );
};

export const HudButton = ({ label, subLabel, onClick, onDown, onUp, colorClass, borderClass, active = false, count, maxCount }: any) => {
    return (
        <div className="flex flex-col items-center pointer-events-auto">
            {count !== undefined && <RoundCadran value={count} max={maxCount || 10} />}
            <button 
                onMouseDown={onDown} onMouseUp={onUp} onMouseLeave={onUp} onTouchStart={onDown} onTouchEnd={onUp} onClick={onClick}
                className={`flex flex-col items-center justify-center p-1 sm:p-2 min-w-[50px] sm:min-w-[60px] h-12 sm:h-14 rounded border-2 select-none transition-all active:scale-95 ${active ? 'bg-zinc-800' : 'bg-zinc-900/80'} ${borderClass}`}
            >
                <span className={`text-[8px] sm:text-[10px] font-black uppercase ${colorClass}`}>{label}</span>
                {subLabel && <span className="text-[6px] sm:text-[8px] font-mono text-zinc-500">{subLabel}</span>}
            </button>
        </div>
    );
};
