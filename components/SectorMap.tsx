import React, { useState, useEffect, useMemo } from 'react';
import { Planet, QuadrantType, MissionType } from '../types.ts';
import { PLANETS } from '../constants.ts';
import { getMissionBriefing } from '../services/geminiService.ts';

interface SectorMapProps {
  currentQuadrant: QuadrantType;
  onLaunch: (planet: Planet) => void;
  onBack: () => void;
  orbitOffsets: Record<string, number>;
  universeStartTime: number;
}

const SectorMap: React.FC<SectorMapProps> = ({ currentQuadrant, onLaunch, onBack, orbitOffsets, universeStartTime }) => {
  const [activeQuadrant, setActiveQuadrant] = useState<QuadrantType>(currentQuadrant);
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [briefing, setBriefing] = useState<string>("");
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);

  // Filter planets for the current sector
  const sectorPlanets = useMemo(() => PLANETS.filter(p => p.quadrant === activeQuadrant), [activeQuadrant]);
  const selectedPlanet = useMemo(() => PLANETS.find(p => p.id === selectedPlanetId), [selectedPlanetId]);
  const isWhiteDwarf = selectedPlanetId === 'white_dwarf';

  // Generate visual-only properties for the view (orbits, moons)
  const planetVisuals = useMemo(() => {
    return sectorPlanets.map((p, i) => ({
      ...p,
      // Distribute orbits evenly for visual clarity
      visualDistance: 160 + (i * 100), 
      orbitSpeedFactor: 1 / (i + 1), 
      orbitOffset: orbitOffsets[p.id] || 0,
      orbitDirection: Math.random() > 0.5 ? 1 : -1,
      // Procedural visual moons - randomized per session as they are decoration
      visualMoons: Array.from({ length: Math.floor(Math.random() * 3) + (i === 1 ? 1 : 0) }).map((_, mi) => ({
        dist: 25 + (mi * 10),
        speed: 0.02 + (Math.random() * 0.02),
        offset: Math.random() * Math.PI * 2,
        direction: Math.random() > 0.5 ? 1 : -1,
        size: 5 + Math.random() * 4 
      }))
    }));
  }, [sectorPlanets, orbitOffsets]);

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

  // Animation Loop - Realtime
  useEffect(() => {
    let animId: number;
    const animate = () => {
      setCurrentTime(Date.now()); 
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

  const elapsed = currentTime - universeStartTime;
  // Speed Calibration: 
  // Old logic: angle += 0.001 per frame. ~60fps => ~0.06 rad/sec.
  // New logic: elapsed (ms). 1000ms = 1 sec.
  // We want 0.06 rad/sec. So constant K = 0.06 / 1000 = 0.00006.
  const SPEED_CONSTANT = 0.00006;

  const renderWhiteDwarf = () => {
    if (activeQuadrant !== QuadrantType.DELTA) return null;

    // Use consistent time base for white dwarf too
    const orbitSpeed = 0.01 * 0.06; // calibrated to approx match old speed relative to planets
    const angle = elapsed * SPEED_CONSTANT * 10; // White dwarf is fast
    
    // Moved closer by 15% (Original approx 126 -> 107)
    const a = 107; 
    const b = 30;  
    const tilt = -Math.PI / 8;

    // Current Pos
    const ux = Math.cos(angle) * a;
    const uy = Math.sin(angle) * b;
    const x = ux * Math.cos(tilt) - uy * Math.sin(tilt);
    const y = ux * Math.sin(tilt) + uy * Math.cos(tilt);

    // Depth check
    const isBehind = Math.sin(angle) < 0; 
    const zIndex = isBehind ? 5 : 30; 

    // Generate Accretion Stream (Sucked into Black Hole)
    // Points interpolated from Star -> Center with spiral distortion
    const trailPoints = [];
    const trailLength = 40; // Length of the stream
    
    for(let i = 0; i < trailLength; i++) {
        // t goes from 0 (at star) to 1 (near black hole)
        const t = i / trailLength;
        
        // Lerp towards center (0,0)
        // We stop slightly before 0,0 to simulate horizon (radius ~20)
        const distFactor = 1.0 - (t * 0.9); 
        
        // Add spiral curve (accretion spin) - curves toward horizon
        const spiralAngle = t * Math.PI * 1.2; 
        
        // Base position relative to star, moving towards 0
        let tx = x * distFactor;
        let ty = y * distFactor;
        
        // Apply spiral rotation to this point around center (0,0)
        // Rotating the vector (tx, ty) by spiralAngle
        const rotX = tx * Math.cos(spiralAngle) - ty * Math.sin(spiralAngle);
        const rotY = tx * Math.sin(spiralAngle) + ty * Math.cos(spiralAngle);
        
        // Turbulence
        const jitter = (Math.random() - 0.5) * (i * 0.2);

        trailPoints.push({
            x: rotX + jitter, 
            y: rotY + jitter,
            // Becomes more transparent as it nears the black hole
            opacity: 0.8 * (1 - t),
            size: 4 * (1 - t * 0.5), // Shrinks as it falls in
            blur: 1 + (t * 2)
        });
    }

    return (
        <>
            <div className="absolute left-1/2 top-1/2 w-0 h-0 pointer-events-none" style={{ zIndex: zIndex - 1 }}>
                {trailPoints.map((tp, i) => (
                    <div 
                        key={i}
                        className="absolute rounded-full"
                        style={{
                            transform: `translate(${tp.x}px, ${tp.y}px) translate(-50%, -50%)`,
                            width: `${tp.size}px`, 
                            height: `${tp.size}px`,
                            backgroundColor: '#a5f3fc', 
                            opacity: tp.opacity,
                            filter: `blur(${tp.blur}px)`,
                            boxShadow: `0 0 ${tp.size * 2}px rgba(165, 243, 252, 0.4)`
                        }}
                    />
                ))}
            </div>
            {/* Expanded click target for easier selection */}
            <div 
                className="absolute left-1/2 top-1/2 cursor-pointer group flex items-center justify-center"
                style={{
                    transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                    zIndex: zIndex + 1, // Ensure above everything
                    width: '40px', height: '40px' // Larger hit area
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlanetId('white_dwarf');
                }}
            >
                <div className={`w-3 h-3 bg-white rounded-full shadow-[0_0_15px_#fff] transition-all duration-300 pointer-events-none ${selectedPlanetId === 'white_dwarf' ? 'scale-150 shadow-[0_0_25px_#22d3ee]' : 'group-hover:scale-125'}`} />
            </div>
        </>
    );
  };

  const renderComet = () => {
    if (activeQuadrant !== QuadrantType.GAMA) return null;
    
    // Comet parameters - elliptical orbit
    const t = elapsed * 0.00005; // Slow orbital period
    
    // Large orbit to ensure clearing the sun with significant margin
    // Sun visual radius is approx 64px (w-32)
    // We want perhelion > 128px
    const a = 600; // Semi-major axis
    const b = 360; // Semi-minor axis (eccentricity ~0.8)
    
    // c = distance from center to focus
    // c^2 = a^2 - b^2 = 360000 - 129600 = 230400
    // c = 480
    const c = 480; 
    
    // Calculate position
    // We shift X by +c so the left focus is at (0,0) where the Sun is
    const rawX = Math.cos(t) * a + c; 
    const rawY = Math.sin(t) * b;
    
    // Precession: Rotate the entire orbit around the sun
    // "Focal point rotating around the sun like a planet"
    // Using a slow rotation speed comparable to outer planets
    const precessionSpeed = 0.000015; 
    const baseTilt = -Math.PI / 8;
    const totalRotation = baseTilt + (elapsed * precessionSpeed);
    
    const x = rawX * Math.cos(totalRotation) - rawY * Math.sin(totalRotation);
    const y = rawX * Math.sin(totalRotation) + rawY * Math.cos(totalRotation);
    
    // Ion Tail Logic: Points RADIALLY AWAY from the Sun (0,0)
    const tailAngle = Math.atan2(y, x);

    // Depth check
    const zIndex = Math.sin(t) < 0 ? 5 : 25;

    return (
      <div 
        className="absolute w-0 h-0 pointer-events-none"
        style={{ 
            zIndex,
            left: '50%', top: '50%',
            transform: `translate(${x}px, ${y}px)`
        }}
      >
         {/* Tail (Rendered first to stay behind head) */}
         <div 
            className="absolute h-[3px] origin-left bg-gradient-to-r from-cyan-200 via-cyan-500/40 to-transparent blur-[1px]"
            style={{ 
                top: '-1.5px', // Center tail vertically on the point (thickness 3px)
                left: '0px',
                width: '160px', 
                transform: `rotate(${tailAngle}rad)`, // Points away from (0,0)
            }}
         />
         
         {/* Comet Head */}
         <div className="absolute w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_15px_#22d3ee] -translate-x-1/2 -translate-y-1/2" />
      </div>
    );
  };

  const sunStyle = getSunVisuals(activeQuadrant);

  // Black Hole Pulsar Logic
  // Cycle: 45s (45000ms)
  // Active: 10s (10000ms)
  // Off: 35s (35000ms)
  const renderBlackHoleJets = () => {
      if (!sunStyle.isBlackHole) return null;
      
      const cycleLength = 45000;
      const cyclePos = elapsed % cycleLength;
      const activeDuration = 10000; 
      
      if (cyclePos > activeDuration + 1000) return null; // +1000 for fade out

      // Fade in/out logic
      let opacity = 0;
      if (cyclePos < 1000) opacity = cyclePos / 1000; // Fade in 1s
      else if (cyclePos < activeDuration) opacity = 1; // Full on
      else opacity = 1 - ((cyclePos - activeDuration) / 1000); // Fade out 1s
      
      // Oscillation: 5 degrees back and forth
      // elapsed * 0.003 approx matches time * 0.05 (if time was 60fps)
      const oscillation = Math.sin(elapsed * 0.003) * 5; 

      return (
          <div className="absolute left-1/2 top-1/2 w-0 h-0 z-0" style={{ opacity }}>
             {/* Top Jet */}
             <div 
                className="absolute bottom-0 left-1/2 w-[12px] h-[450px] origin-bottom blur-xl pointer-events-none mix-blend-screen"
                style={{
                    background: 'linear-gradient(to top, rgba(168, 85, 247, 0.8), rgba(255, 255, 255, 0))',
                    transform: `translate(-50%, 0%) rotate(${oscillation}deg)`,
                }}
             />
             <div 
                className="absolute bottom-0 left-1/2 w-[4px] h-[400px] origin-bottom blur-sm pointer-events-none mix-blend-screen"
                style={{
                    background: 'linear-gradient(to top, #fff, transparent)',
                    transform: `translate(-50%, 0%) rotate(${oscillation}deg)`,
                }}
             />

             {/* Bottom Jet */}
             <div 
                className="absolute top-0 left-1/2 w-[12px] h-[450px] origin-top blur-xl pointer-events-none mix-blend-screen"
                style={{
                    background: 'linear-gradient(to bottom, rgba(168, 85, 247, 0.8), rgba(255, 255, 255, 0))',
                    transform: `translate(-50%, 0%) rotate(${oscillation}deg)`,
                }}
             />
             <div 
                className="absolute top-0 left-1/2 w-[4px] h-[400px] origin-top blur-sm pointer-events-none mix-blend-screen"
                style={{
                    background: 'linear-gradient(to bottom, #fff, transparent)',
                    transform: `translate(-50%, 0%) rotate(${oscillation}deg)`,
                }}
             />
          </div>
      );
  };

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
           
           {/* Pulsar Jets - Rendered BEHIND the sun (Z-0) */}
           {renderBlackHoleJets()}

           {/* Central Sun - Rendered ABOVE jets (Z-10) */}
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
                 {/* Accretion Disk / Event Horizon Glow (No Crossbeams/X) */}
                 <div className="absolute inset-[-5px] border-[3px] border-purple-500/30 rounded-full animate-[spin_4s_linear_infinite]" />
                 <div className="absolute inset-[-15px] border-[1px] border-white/10 rounded-full animate-[spin_7s_linear_infinite_reverse]" />
               </>
             )}
           </div>

           {/* White Dwarf Decoration */}
           {renderWhiteDwarf()}

           {/* Gamma Comet */}
           {renderComet()}

           {/* Planets & Orbits */}
           {planetVisuals.map((p) => {
             // Continuous Orbit Logic: (Time * Speed) + Initial Offset
             // Random orbitDirection (-1 or 1) ensures planets don't all move the same way
             const angle = (elapsed * SPEED_CONSTANT * p.orbitSpeedFactor * (p.orbitDirection || 1)) + p.orbitOffset;
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
                    <div className="relative flex items-center justify-center">
                        <div 
                          className={`w-10 h-10 rounded-full shadow-lg transition-all duration-300 relative z-10 ${isSelected ? 'ring-2 ring-offset-4 ring-offset-black ring-white scale-125' : 'group-hover:scale-110'}`}
                          style={{ backgroundColor: p.color, boxShadow: `inset -4px -4px 10px rgba(0,0,0,0.8), 0 0 20px ${p.color}44` }}
                        >
                          {/* Planet selection ring animation */}
                          {isSelected && (
                            <div className="absolute -inset-6 border border-dashed border-emerald-500/60 rounded-full animate-[spin_8s_linear_infinite]" />
                          )}
                        </div>
                    </div>

                    {/* Moons - Centered Orbit Fix */}
                    {/* Position moons absolutely within the planet group, but use left/top 50% as origin */}
                    {p.visualMoons.map((m, mi) => {
                      // Moons use simplified local time as they are purely decorative and fast
                      // Added direction multiplier for randomized orbits
                      const mAngle = (elapsed * 0.06 * m.speed * (m.direction || 1)) + m.offset;
                      const mx = Math.cos(mAngle) * m.dist;
                      const my = Math.sin(mAngle) * m.dist;
                      return (
                        <div 
                          key={mi}
                          className="absolute bg-zinc-400 rounded-full pointer-events-none shadow-sm left-1/2 top-1/2"
                          style={{ 
                            width: m.size, height: m.size,
                            transform: `translate(-50%, -50%) translate(${mx}px, ${my}px)`
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
                <div className="w-32 h-32 rounded-full shadow-[inset_-12px_-12px_25px_rgba(0,0,0,0.9)] relative flex items-center justify-center" style={{ backgroundColor: selectedPlanet.color }}>
                   <div className="absolute inset-0 rounded-full shadow-[0_0_40px_currentColor] z-10" style={{ color: selectedPlanet.color }} />
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
             {isWhiteDwarf ? (
                 <>
                    <div className="w-32 h-32 bg-black rounded-full border-2 border-cyan-500 flex items-center justify-center mb-6 relative overflow-hidden shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_#fff_0%,_#000_100%)] opacity-80" />
                        <div className="absolute inset-0 border-[6px] border-cyan-400/20 rounded-full scale-[1.2]" />
                    </div>
                    <h3 className="retro-font text-cyan-400 text-sm uppercase mb-2">White Dwarf</h3>
                    <div className="bg-cyan-950/30 border border-cyan-800/50 p-3 rounded mb-4 w-full">
                        <p className="text-[10px] text-cyan-200 uppercase font-mono leading-relaxed">
                            Compact stellar remnant detected. High gravity accretion stream feeding local singularity. Not habitable.
                        </p>
                    </div>
                    <div className="text-[9px] text-zinc-600 uppercase font-black tracking-widest bg-zinc-900/50 px-4 py-2 rounded">
                        NO LANDING SITES
                    </div>
                 </>
             ) : (
                 <>
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
                 </>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SectorMap;