
import React, { useState } from 'react';
import { PLANETS } from '../constants.ts';
import { PlanetStatusData, QuadrantType } from '../types.ts';

interface SystemProps {
  scale: number;
  selectedPlanetId?: string;
  onPlanetSelect?: (id: string) => void;
  className?: string;
  planetRegistry?: Record<string, PlanetStatusData>;
}

const BaseSystem = ({ quadrant, scale, selectedPlanetId, sunColor, sunGradient, sunShadow, children, onPlanetSelect, planetRegistry }: SystemProps & { quadrant: QuadrantType, sunColor: string, sunGradient: string, sunShadow: string, children?: React.ReactNode }) => {
  const planets = PLANETS.filter(p => p.quadrant === quadrant);
  const [hoveredPlanetId, setHoveredPlanetId] = useState<string | null>(null);
  
  // Calculate centering offset based on selected planet to zoom towards IT
  let translateX = 0;
  let translateY = 0;
  
  if (scale > 2 && selectedPlanetId) {
      const pIndex = planets.findIndex(p => p.id === selectedPlanetId);
      if (pIndex !== -1) {
          // Approximate orbit logic. Slower angle calculation to match refined visual speed.
          const angle = (Date.now() * 0.00005 * (1 / (pIndex + 1))) + (pIndex * 2);
          const dist = 300 + (pIndex * 120);
          const pX = Math.cos(angle) * dist;
          const pY = Math.sin(angle) * dist;
          
          // Invert to bring planet to center
          translateX = -pX;
          translateY = -pY + 150; 
      }
  }

  return (
    <div className={`relative w-[1200px] h-[1200px] flex items-center justify-center transition-transform duration-700 ease-in-out`} 
         style={{ transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)` }}>
      
      {/* Sun */}
      <div 
        className="absolute z-10 w-48 h-48 rounded-full pointer-events-none"
        style={{ 
            background: sunGradient, 
            boxShadow: sunShadow,
            top: '15%', 
            left: '50%',
            transform: 'translate(-50%, -50%)'
        }}
      />
      
      {/* Orbits Container */}
      <div className="absolute top-[15%] left-[50%] w-0 h-0">
          {planets.map((p, i) => {
            // Slower Orbit Speed: 0.00005 factor
            const angle = (Date.now() * 0.00005 * (1 / (i + 1))) + (i * 2); 
            const dist = 300 + (i * 120); 
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;
            const isSelected = selectedPlanetId === p.id;
            const isHovered = hoveredPlanetId === p.id;

            // Generate procedural moons if none exist in data (visual decoration)
            const moonCount = p.moons.length > 0 ? p.moons.length : (i % 2 === 0 ? 1 : 2);
            const moons = Array.from({ length: moonCount });

            return (
              <div 
                key={p.id} 
                className="absolute z-20 cursor-pointer group" 
                style={{ transform: `translate(${x}px, ${y}px)` }}
                onClick={(e) => { e.stopPropagation(); onPlanetSelect?.(p.id); }}
                onMouseEnter={() => setHoveredPlanetId(p.id)}
                onMouseLeave={() => setHoveredPlanetId(null)}
              >
                 <div className="absolute -inset-12 border border-white/10 rounded-full pointer-events-none" />
                 <div 
                   className={`w-12 h-12 rounded-full shadow-lg transition-all duration-300 relative ${isSelected ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'}`}
                   style={{ backgroundColor: p.color, boxShadow: `inset -6px -6px 15px rgba(0,0,0,0.8), 0 0 30px ${p.color}44` }}
                 />
                 
                 {/* Moons - Ensure they move with planet (relative) and have own local orbit */}
                 {moons.map((_, mi) => {
                     const mDist = 25 + (mi * 12);
                     const mSpeed = 0.002 * (mi + 1);
                     const mAngle = (Date.now() * mSpeed) + (mi * Math.PI);
                     const mx = Math.cos(mAngle) * mDist;
                     const my = Math.sin(mAngle) * mDist;
                     return (
                         <div key={mi} className="absolute w-2 h-2 bg-zinc-400 rounded-full shadow-sm pointer-events-none"
                              style={{ transform: `translate(${mx}px, ${my}px)` }} />
                     );
                 })}

                 {/* Label - Hide if selected (as per request), show on hover or default if not selected */}
                 {/* "Show destination selected without label" -> Hide label if isSelected is true. */}
                 {/* "If I select another planet with mouse show name and status" -> Show label on Hover? */}
                 {!isSelected && isHovered && (
                     <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/80 border border-zinc-700 px-2 py-1 rounded text-center z-30 pointer-events-none min-w-[80px]">
                         <div className="text-[9px] font-black text-white whitespace-nowrap tracking-widest uppercase">{p.name}</div>
                         <div className="text-[7px] text-zinc-400 font-mono uppercase">{planetRegistry?.[p.id]?.status || 'UNKNOWN'}</div>
                     </div>
                 )}
              </div>
            );
          })}
      </div>
      {children}
    </div>
  );
};

export const AlfaSystem = (props: SystemProps) => (
  <BaseSystem {...props} quadrant={QuadrantType.ALFA} sunColor="#facc15" sunGradient="radial-gradient(circle, #fef08a 10%, #eab308 100%)" sunShadow="0 0 100px #facc15" />
);

export const BetaSystem = (props: SystemProps) => (
  <BaseSystem {...props} quadrant={QuadrantType.BETA} sunColor="#ef4444" sunGradient="radial-gradient(circle, #fca5a5 10%, #dc2626 100%)" sunShadow="0 0 100px #ef4444" />
);

export const GamaSystem = (props: SystemProps) => (
  <BaseSystem {...props} quadrant={QuadrantType.GAMA} sunColor="#3b82f6" sunGradient="radial-gradient(circle, #93c5fd 10%, #2563eb 100%)" sunShadow="0 0 100px #3b82f6" />
);

export const DeltaSystem = (props: SystemProps) => (
  <BaseSystem {...props} quadrant={QuadrantType.DELTA} sunColor="#000000" sunGradient="radial-gradient(circle, #000000 60%, #451a03 100%)" sunShadow="0 0 60px #ffffff, inset 0 0 50px #000">
     <div className="absolute top-[15%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[3px] bg-white blur-md rotate-45 opacity-60" />
        <div className="absolute w-[800px] h-[1px] bg-purple-500 blur-sm rotate-45 opacity-80" />
     </div>
  </BaseSystem>
);
