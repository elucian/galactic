import React, { useState, useEffect, useMemo } from 'react';
import { Planet, QuadrantType, MissionType } from '../types.ts';
import { PLANETS } from '../constants.ts';
import { getMissionBriefing } from '../services/geminiService.ts';

interface SectorMapProps {
  currentQuadrant: QuadrantType;
  onLaunch: (planet: Planet) => void;
  onBack: () => void;
}

const SectorMap: React.FC<SectorMapProps> = ({ currentQuadrant, onLaunch, onBack }) => {
  const [activeQuadrant, setActiveQuadrant] = useState<QuadrantType>(currentQuadrant);
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [briefing, setBriefing] = useState<string>("");
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);

  // Filter planets for the current sector
  const sectorPlanets = useMemo(() => PLANETS.filter(p => p.quadrant === activeQuadrant), [activeQuadrant]);
  const selectedPlanet = useMemo(() => PLANETS.find(p => p.id === selectedPlanetId), [selectedPlanetId]);

  // Generate visual-only properties for the view (orbits, moons)
  const planetVisuals = useMemo(() => {
    return sectorPlanets.map((p, i) => ({
      ...p,
      // Distribute orbits evenly for visual clarity
      visualDistance: 160 + (i * 100), 
      orbitSpeed: 0.002 / (i + 1), // Inner planets faster
      orbitOffset: (i * 2.5) + Math.random(),
      // Procedural visual moons
      visualMoons: Array.from({ length: Math.floor(Math.random() * 3) + (i === 1 ? 1 : 0) }).map((_, mi) => ({
        dist: 25 + (mi * 10),
        speed: 0.02 + (Math.random() * 0.02),
        offset: Math.random() * Math.PI * 2,
        size: 5 + Math.random() * 4 // Increased size for visibility (was 3+rnd)
      }))
    }));
  }, [sectorPlanets]);

  // Generate background stars with twinkle properties
  const stars = useMemo(() => {
    return Array.from({ length: 100 }).map((_, i) => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.7 + 0.3,
      animDelay: Math.random() * 5,
      animDuration: 2 + Math.random() * 3
    }));
  }, [activeQuadrant]);

  // Animation Loop
  useEffect(() => {
    let animId: number;
    const animate = () => {
      setTime(prev => prev + 1); 
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Fetch Briefing
  useEffect(() => {
    if (selectedPlanet) {
      setIsLoadingBriefing(true);
      setBriefing("");
      getMissionBriefing(selectedPlanet.name, MissionType.ATTACK, selectedPlanet.difficulty)
        .then(text => {
          setBriefing(text);
          setIsLoadingBriefing(false);
        })
        .catch(() => {
          setBriefing("Unable to establish secure uplink.");
          setIsLoadingBriefing(false);
        });
    }
  }, [selectedPlanetId]);

  const getSunVisuals = (q: QuadrantType) => {
    switch (q) {
      case QuadrantType.ALFA: return { 
        color: '#facc15', 
        shadow: '0 0 80px #facc15', 
        gradient: 'radial-gradient(circle, #fef08a 20%, #eab308 100%)', 
        label: 'YELLOW DWARF' 
      };
      case QuadrantType.BETA: return { 
        color: '#ef4444', 
        shadow: '0 0 80px #ef4444', 
        gradient: 'radial-gradient(circle, #fca5a5 20%, #dc2626 100%)', 
        label: 'RED GIANT' 
      };
      case QuadrantType.GAMA: return { 
        color: '#3b82f6', 
        shadow: '0 0 80px #3b82f6', 
        gradient: 'radial-gradient(circle, #93c5fd 20%, #2563eb 100%)', 
        label: 'BLUE NEUTRON' 
      };
      case QuadrantType.DELTA: return { 
        color: '#451a03', 
        shadow: '0 0 40px #ffffff, inset 0 0 50px #000', 
        gradient: 'radial-gradient(circle, #000000 60%, #451a03 100%)', 
        border: '2px solid rgba(255,255,255,0.9)',
        isBlackHole: true,
        label: 'SINGULARITY'
      };
    }
  };

  const sunStyle = getSunVisuals(activeQuadrant);

  return (
    <div className="w-full h-full bg-black flex overflow-hidden font-sans select-none">
      
      {/* LEFT VIEWPORT: Solar System */}
      <div className="flex-grow relative bg-black overflow-hidden flex items-center justify-center">
        
        {/* Background Stars */}
        <div className="absolute inset-0 pointer-events-none">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)]" />
           {stars.map((s, i) => (
             <div key={i} className="absolute rounded-full bg-white animate-pulse" 
                  style={{ 
                    left: `${s.left}%`, 
                    top: `${s.top}%`, 
                    width: s.size, 
                    height: s.size, 
                    opacity: s.opacity,
                    animationDuration: `${s.animDuration}s`,
                    animationDelay: `${s.animDelay}s`
                  }} />
           ))}
        </div>

        {/* Sector Selection Panel (Top Center) - Bordered Cards Design */}
        <div className="absolute top-6 z-30 flex gap-4">
           {[QuadrantType.ALFA, QuadrantType.BETA, QuadrantType.GAMA, QuadrantType.DELTA].map(q => {
             const style = getSunVisuals(q);
             const isActive = activeQuadrant === q;
             return (
               <button 
                 key={q}
                 onClick={() => { setActiveQuadrant(q); setSelectedPlanetId(null); }}
                 className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all duration-300 bg-zinc-950/80 backdrop-blur-md ${isActive ? 'border-white scale-105 shadow-lg' : 'border-zinc-700 opacity-70 hover:opacity-100 hover:border-zinc-500'}`}
               >
                 {/* Sun Icon Container - Fixed Size for Uniformity */}
                 <div className="relative w-10 h-10 rounded-full shadow-inner overflow-hidden flex-shrink-0">
                    <div className="absolute inset-0" style={{ background: style.gradient }} />
                    {style.isBlackHole && (
                        <div className="absolute inset-0 border-[1px] border-white/60 rounded-full scale-[0.7] animate-[spin_3s_linear_infinite]" />
                    )}
                 </div>
                 {/* Label */}
                 <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-zinc-500'}`}>{q}</span>
               </button>
             )
           })}
        </div>

        {/* Solar System Container */}
        {/* We use a fixed container size that scales with CSS transform to ensure orbits remain circular regardless of screen aspect ratio */}
        <div className="relative w-[1000px] h-[1000px] flex items-center justify-center transform scale-[0.5] md:scale-[0.65] lg:scale-[0.8] xl:scale-100 transition-transform duration-700">
           
           {/* Central Sun */}
           <div 
             className="absolute z-10 w-32 h-32 rounded-full transition-all duration-1000"
             style={{ 
               background: sunStyle.gradient, 
               boxShadow: sunStyle.shadow,
               border: sunStyle.border || 'none'
             }}
           >
             {sunStyle.isBlackHole && (
               <>
                 {/* Energy Jets for Black Hole */}
                 <div className="absolute top-1/2 left-1/2 w-[600px] h-[2px] bg-white blur-sm -translate-x-1/2 -translate-y-1/2 rotate-45 opacity-60" />
                 <div className="absolute top-1/2 left-1/2 w-[600px] h-[4px] bg-purple-500 blur-md -translate-x-1/2 -translate-y-1/2 rotate-45 opacity-40" />
                 
                 <div className="absolute top-1/2 left-1/2 w-[600px] h-[2px] bg-white blur-sm -translate-x-1/2 -translate-y-1/2 -rotate-45 opacity-60" />
                 <div className="absolute top-1/2 left-1/2 w-[600px] h-[4px] bg-purple-500 blur-md -translate-x-1/2 -translate-y-1/2 -rotate-45 opacity-40" />
                 
                 <div className="absolute inset-[-10px] border-2 border-white/30 rounded-full animate-[spin_2s_linear_infinite]" />
               </>
             )}
           </div>

           {/* Planets & Orbits */}
           {planetVisuals.map((p) => {
             const angle = (time * p.orbitSpeed) + p.orbitOffset;
             const x = Math.cos(angle) * p.visualDistance;
             const y = Math.sin(angle) * p.visualDistance;
             const isSelected = selectedPlanetId === p.id;

             return (
               <React.Fragment key={p.id}>
                 {/* Orbit Ring */}
                 <div 
                   className="absolute rounded-full border border-zinc-800/60 pointer-events-none"
                   style={{ width: p.visualDistance * 2, height: p.visualDistance * 2 }} 
                 />
                 
                 {/* Planet Body Group */}
                 <div 
                    className="absolute z-20 cursor-pointer group"
                    style={{ transform: `translate(${x}px, ${y}px)` }}
                    onClick={() => setSelectedPlanetId(p.id)}
                 >
                    <div 
                      className={`w-10 h-10 rounded-full shadow-lg transition-all duration-300 relative ${isSelected ? 'ring-2 ring-offset-4 ring-offset-black ring-white scale-125' : 'group-hover:scale-110'}`}
                      style={{ backgroundColor: p.color, boxShadow: `inset -4px -4px 10px rgba(0,0,0,0.8), 0 0 20px ${p.color}44` }}
                    >
                      {/* Planet selection ring animation */}
                      {isSelected && (
                        <div className="absolute -inset-6 border border-dashed border-emerald-500/60 rounded-full animate-[spin_8s_linear_infinite]" />
                      )}
                    </div>

                    {/* Moons */}
                    {p.visualMoons.map((m, mi) => {
                      const mAngle = (time * m.speed) + m.offset;
                      const mx = Math.cos(mAngle) * m.dist;
                      const my = Math.sin(mAngle) * m.dist;
                      return (
                        <div 
                          key={mi}
                          className="absolute bg-zinc-400 rounded-full pointer-events-none shadow-sm"
                          style={{ 
                            width: m.size, height: m.size,
                            transform: `translate(${mx}px, ${my}px)`
                          }}
                        />
                      )
                    })}
                 </div>
               </React.Fragment>
             );
           })}
        </div>

        {/* Sector Label */}
        <div className="absolute bottom-8 left-8 pointer-events-none">
           <h1 className="retro-font text-5xl text-zinc-900 font-black uppercase tracking-tighter drop-shadow-[0_2px_0_rgba(255,255,255,0.1)]">{activeQuadrant}</h1>
           <div className="text-zinc-600 font-mono text-sm uppercase tracking-[0.5em] ml-1 mt-2">Sector Control</div>
        </div>
      </div>

      {/* RIGHT PANEL: Fixed Property Panel */}
      <div className="w-80 h-full bg-zinc-950 border-l border-zinc-800 flex flex-col shrink-0 z-40 shadow-2xl relative">
        {/* Subtle grid background */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:20px_20px]" />
        
        {/* Panel Header */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur flex justify-between items-center shrink-0 z-10">
          <h2 className="retro-font text-emerald-500 text-xs uppercase tracking-wide">Target Intel</h2>
          <button onClick={onBack} className="text-zinc-500 hover:text-white text-[10px] uppercase font-black tracking-widest border border-zinc-700 px-3 py-1 rounded hover:bg-zinc-800 transition-colors">BACK</button>
        </div>

        {selectedPlanet ? (
          <div className="flex-grow flex flex-col overflow-y-auto custom-scrollbar p-6 gap-6 z-10">
             {/* Planet Preview */}
             <div className="w-full aspect-square bg-black rounded-lg border-2 border-zinc-700 relative flex items-center justify-center overflow-hidden shadow-[inset_0_0_30px_rgba(0,0,0,1)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#000_100%)] z-10" />
                <div className="w-32 h-32 rounded-full shadow-[inset_-12px_-12px_25px_rgba(0,0,0,0.9)] relative" style={{ backgroundColor: selectedPlanet.color }}>
                   {selectedPlanet.hasRings && <div className="absolute inset-0 border-[6px] border-white/10 rounded-full scale-[1.5] -rotate-12" />}
                   <div className="absolute inset-0 rounded-full shadow-[0_0_40px_currentColor]" style={{ color: selectedPlanet.color }} />
                </div>
                
                <div className="absolute top-2 right-2 z-20">
                   <span className="text-[9px] font-black text-white bg-red-600 px-2 py-0.5 rounded shadow-lg">CLASS {selectedPlanet.difficulty}</span>
                </div>
             </div>

             <div className="space-y-4">
                <div className="border-b border-zinc-800 pb-4">
                   <h3 className="text-2xl font-black text-white uppercase leading-none">{selectedPlanet.name}</h3>
                   <div className="flex items-center gap-2 mt-2">
                      <div className={`w-2 h-2 rounded-full ${selectedPlanet.status === 'friendly' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                      <span className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase">{selectedPlanet.status} STATUS</span>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                   <div className="bg-zinc-900/50 p-2 rounded border border-zinc-800">
                      <div className="text-[8px] text-zinc-500 uppercase font-black">Distance</div>
                      <div className="text-white font-mono text-xs">{selectedPlanet.orbitRadius} AU</div>
                   </div>
                   <div className="bg-zinc-900/50 p-2 rounded border border-zinc-800">
                      <div className="text-[8px] text-zinc-500 uppercase font-black">Gravity</div>
                      <div className="text-blue-400 font-mono text-xs">{selectedPlanet.size.toFixed(1)} G</div>
                   </div>
                </div>

                <div className="space-y-2 bg-zinc-900/30 p-3 rounded border border-zinc-800/50">
                   <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Command Briefing</span>
                      {isLoadingBriefing && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />}
                   </div>
                   <p className="text-[10px] leading-relaxed uppercase text-zinc-400 font-mono border-l-2 border-emerald-500/30 pl-2">
                      {isLoadingBriefing ? "DECRYPTING SECURE CHANNEL..." : (briefing || selectedPlanet.description)}
                   </p>
                </div>
             </div>

             <div className="mt-auto pt-4">
                <button onClick={() => onLaunch(selectedPlanet)} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] text-xs rounded shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden">
                   <span className="relative z-10 group-hover:animate-pulse">INITIATE LAUNCH</span>
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]" />
                </button>
             </div>
          </div>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center z-10">
             <div className="w-24 h-24 rounded-full border-4 border-dashed border-zinc-800 flex items-center justify-center mb-6 animate-[spin_20s_linear_infinite]">
                <div className="w-2 h-2 bg-zinc-700 rounded-full" />
             </div>
             <h3 className="retro-font text-zinc-500 text-sm uppercase mb-3">No Target Selected</h3>
             <p className="text-[10px] text-zinc-600 uppercase font-mono leading-relaxed">
                Scan the {activeQuadrant} sector map and select a planetary body to view mission parameters.
             </p>
             
             <div className="mt-12 w-full bg-zinc-900/50 p-4 rounded border border-zinc-800">
                <div className="text-[9px] text-zinc-500 uppercase font-black mb-1 text-left">Primary Star Class</div>
                <div className="text-xl font-black uppercase tracking-widest text-left" style={{ color: sunStyle.color }}>{sunStyle.label}</div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SectorMap;