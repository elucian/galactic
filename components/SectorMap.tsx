
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Planet, QuadrantType, MissionType, PlanetStatusData } from '../types.ts';
import { PLANETS } from '../constants.ts';
import { getMissionBriefing } from '../services/geminiService.ts';

interface SectorMapProps {
  currentQuadrant: QuadrantType;
  onLaunch: (planet: Planet) => void;
  onBack: () => void;
  orbitOffsets: Record<string, number>;
  universeStartTime: number;
  planetRegistry?: Record<string, PlanetStatusData>;
  testMode?: boolean;
  onTestLanding?: (planet: Planet) => void;
}

const SectorMap: React.FC<SectorMapProps> = ({ currentQuadrant, onLaunch, onBack, orbitOffsets, universeStartTime, planetRegistry, testMode, onTestLanding }) => {
  const [activeQuadrant, setActiveQuadrant] = useState<QuadrantType>(currentQuadrant);
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(null);
  const [showMissionLog, setShowMissionLog] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [briefing, setBriefing] = useState<string>("");
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);

  // Time & Animation Constants
  const elapsed = currentTime - universeStartTime;
  const SPEED_CONSTANT = 0.00005;

  // Interaction States
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoomStep, setZoomStep] = useState(3); // Default Zoom Out (Step 3)
  const [isDragging, setIsDragging] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  const dragRef = useRef({ startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });
  const isRecalculatingRef = useRef(false);

  // Calculate dynamic scale based on zoom step (Range 0.3 to 1.5)
  const currentScale = useMemo(() => 0.3 + (zoomStep * 0.12), [zoomStep]);

  // Filter planets for the current sector
  const sectorPlanets = useMemo(() => PLANETS.filter(p => p.quadrant === activeQuadrant), [activeQuadrant]);
  const selectedPlanet = useMemo(() => PLANETS.find(p => p.id === selectedPlanetId), [selectedPlanetId]);
  const isWhiteDwarf = selectedPlanetId === 'white_dwarf';

  const getPlanetStatus = (id: string) => {
      if (!planetRegistry) return 'occupied';
      return planetRegistry[id]?.status || 'occupied';
  };

  const getWins = (id: string) => {
      if (!planetRegistry) return 0;
      return planetRegistry[id]?.wins || 0;
  };

  const getSunTitle = (q: QuadrantType) => {
    switch (q) {
      case QuadrantType.ALFA: return 'YELLOW DWARF';
      case QuadrantType.BETA: return 'RED GIANT';
      case QuadrantType.GAMA: return 'BLUE NEUTRON';
      case QuadrantType.DELTA: return 'SINGULARITY';
    }
  };

  const getSunVisuals = (q: QuadrantType) => {
    switch (q) {
      case QuadrantType.ALFA: return { gradient: "radial-gradient(circle, #fef08a 10%, #eab308 100%)", shadow: "0 0 50px #facc15", color: "#facc15", isBlackHole: false };
      case QuadrantType.BETA: return { gradient: "radial-gradient(circle, #fca5a5 10%, #dc2626 100%)", shadow: "0 0 50px #ef4444", color: "#ef4444", isBlackHole: false };
      case QuadrantType.GAMA: return { gradient: "radial-gradient(circle, #93c5fd 10%, #2563eb 100%)", shadow: "0 0 50px #3b82f6", color: "#3b82f6", isBlackHole: false };
      case QuadrantType.DELTA: return { gradient: "radial-gradient(circle, #000000 60%, #451a03 100%)", shadow: "0 0 30px #ffffff, inset 0 0 25px #000", border: "1px solid rgba(255,255,255,0.2)", color: "#a855f7", isBlackHole: true };
    }
  };

  const getSectorIntel = (q: QuadrantType) => {
    switch (q) {
      case QuadrantType.ALFA: return {
        desc: "A stable G-type star system. The cradle of the Alliance.",
        opp: "Safe trade routes, abundance of standard fuel and repair resources.",
        danger: "Low. Occasional pirate raids in the asteroid belt."
      };
      case QuadrantType.BETA: return {
        desc: "A dying Red Giant system. Intense heat and radiation.",
        opp: "Rich deposits of heavy metals in the planetary crusts.",
        danger: "High. Solar flares can disrupt shields. Heat damage over time."
      };
      case QuadrantType.GAMA: return {
        desc: "Volatile Blue Neutron Star. High magnetic interference.",
        opp: "Exotic energy harvesting. Rare crystals found in debris fields.",
        danger: "Extreme. Pulsar jets and rogue comets. Xenos strongholds."
      };
      case QuadrantType.DELTA: return {
        desc: "Singularity Event Horizon. The edge of known reality.",
        opp: "Unknown artifacts. Omega-level technology salvage.",
        danger: "Critical. Reality distortion. Capital-class Leviathans detected."
      };
    }
  };

  // Generate visual-only properties for the view (orbits, moons)
  const planetVisuals = useMemo(() => {
    // Start closer to the smaller sun (150px instead of 220px)
    // ALPHA SECTOR TWEAK: First planet 30% closer (105px)
    // GAMMA SECTOR TWEAK: First planet closer (85px to reflect 15% reduction)
    let cumulativeDist = 150;
    if (activeQuadrant === QuadrantType.ALFA) cumulativeDist = 105;
    if (activeQuadrant === QuadrantType.GAMA) cumulativeDist = 85; 
    if (activeQuadrant === QuadrantType.DELTA) cumulativeDist = 110; 

    return sectorPlanets.map((p, i) => {
      const status = getPlanetStatus(p.id);
      const isInner = i < 2;
      // Increased Planet Sizes by ~30%, but first planet is 50% smaller (18px)
      let planetSizePx = isInner ? 36 : 48; 
      if (i === 0) planetSizePx = 18;

      const planetRadius = planetSizePx / 2;

      // Moon Count Logic: Use data if present, otherwise default to procedural except for specific overrides
      let moonCount = 0;
      if (p.moons && p.moons.length > 0) {
          moonCount = p.moons.length;
      } else if (p.id === 'p3' || (p.id === 'p9' && p.moons.length === 0)) {
          // Explicitly 0 for Red Planet (Vulcan Forge) and Red Planet (Neon Outpost) if emptied
          moonCount = 0; 
      } else {
          moonCount = Math.floor(Math.random() * 3) + (i > 1 ? 1 : 0);
      }

      // Generate Visual Moons
      const visualMoons = Array.from({ length: moonCount }).map((_, mi) => ({
          dist: planetRadius + 18 + (mi * 18), // Tighter moon spacing
          speed: 0.02 + (Math.random() * 0.02),
          offset: Math.random() * Math.PI * 2,
          direction: Math.random() > 0.5 ? 1 : -1,
          size: 5 + Math.random() * 4 
      }));

      // Calculate System Radius to ensure clearance
      const maxMoonDist = visualMoons.length > 0 ? visualMoons[visualMoons.length - 1].dist : 0;
      const systemRadius = Math.max(planetRadius + 10, maxMoonDist) + 20; // +Buffer

      // Set current orbit distance
      const myDist = cumulativeDist;

      // Gap calculation
      let gap = 40;
      if (activeQuadrant === QuadrantType.ALFA && i === 0) {
          // Adjust gap between p1 and p2 to achieve specific orbital reduction for p2 visually
          gap = 55;
      }
      if (activeQuadrant === QuadrantType.GAMA && i === 0) {
          gap = 35; 
      }
      if (activeQuadrant === QuadrantType.GAMA && i === 1) {
          gap = 60; // Significantly increased gap to push 3rd planet (Orange) further out
      }
      if (activeQuadrant === QuadrantType.BETA && i === 1) {
          gap = 65; // Further increase gap to push 3rd planet (Green) further out
      }
      if (activeQuadrant === QuadrantType.DELTA) {
          // Tighter formation for Delta
          if (i === 0) gap = 35; // Gap between p1 and p2
          if (i === 1) gap = 55; // Gap between p2 and p3
      }

      // Increment for next planet (Current System + Gap + Next System approximation)
      cumulativeDist += systemRadius + gap; 

      return {
        ...p,
        statusColor: status === 'friendly' ? '#10b981' : (status === 'siege' ? '#f97316' : '#ef4444'),
        actualStatus: status,
        planetSizePx,
        visualDistance: myDist, 
        orbitSpeedFactor: 1 / (i + 2), 
        orbitOffset: orbitOffsets[p.id] || 0,
        orbitDirection: Math.random() > 0.5 ? 1 : -1,
        visualMoons
      };
    });
  }, [sectorPlanets, orbitOffsets, planetRegistry, activeQuadrant]);

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
      if (!isRecalculatingRef.current) {
          setCurrentTime(Date.now()); 
      }
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
      const status = getPlanetStatus(selectedPlanet.id);
      const missionType = status === 'friendly' ? MissionType.TRAVEL : (status === 'siege' ? MissionType.DEFENSE : MissionType.ATTACK);
      
      getMissionBriefing(selectedPlanet.name, missionType, selectedPlanet.difficulty)
        .then(text => {
          setBriefing(text);
          setIsLoadingBriefing(false);
        })
        .catch(() => {
          setBriefing("Unable to establish secure uplink.");
          setIsLoadingBriefing(false);
        });
    }
  }, [selectedPlanetId, planetRegistry]);

  // Drag Handlers (Mouse & Touch)
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      setIsDragging(true);
      dragRef.current = {
          startX: clientX,
          startY: clientY,
          initialPanX: pan.x,
          initialPanY: pan.y
      };
  };

  useEffect(() => {
      const handleMove = (e: MouseEvent | TouchEvent) => {
          if (!isDragging) return;
          
          const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
          const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

          const dx = clientX - dragRef.current.startX;
          const dy = clientY - dragRef.current.startY;
          setPan({ x: dragRef.current.initialPanX + dx, y: dragRef.current.initialPanY + dy });
      };

      const handleUp = () => {
          if (!isDragging) return;
          setIsDragging(false);
          setIsRecalculating(true);
          isRecalculatingRef.current = true;
          
          // "Recalculation" pause
          setTimeout(() => {
              setIsRecalculating(false);
              isRecalculatingRef.current = false;
          }, 800);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleUp);
      
      return () => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleUp);
          window.removeEventListener('touchmove', handleMove);
          window.removeEventListener('touchend', handleUp);
      };
  }, [isDragging]);

  // Zoom Handlers
  const handleZoomIn = (e: React.MouseEvent) => { e.stopPropagation(); setZoomStep(prev => Math.min(10, prev + 1)); };
  const handleZoomOut = (e: React.MouseEvent) => { e.stopPropagation(); setZoomStep(prev => Math.max(0, prev - 1)); };
  const handleResetView = (e: React.MouseEvent) => { 
      e.stopPropagation(); 
      setZoomStep(3); // Reset to Default 3
      setPan({ x: 0, y: 0 }); 
      setIsRecalculating(true);
      isRecalculatingRef.current = true;
      setTimeout(() => { setIsRecalculating(false); isRecalculatingRef.current = false; }, 500);
  };

  const renderBlackHoleJets = () => {
      const sunStyle = getSunVisuals(activeQuadrant);
      if (!sunStyle.isBlackHole) return null;
      const cycleLength = 45000; const cyclePos = elapsed % cycleLength; const activeDuration = 10000; 
      if (cyclePos > activeDuration + 1000) return null; 
      let opacity = 0; if (cyclePos < 1000) opacity = cyclePos / 1000; else if (cyclePos < activeDuration) opacity = 1; else opacity = 1 - ((cyclePos - activeDuration) / 1000); 
      const oscillation = Math.sin(elapsed * 0.003) * 5; 
      return (
          <div className="absolute left-1/2 top-1/2 w-0 h-0 z-0" style={{ opacity }}>
             <div className="absolute bottom-0 left-1/2 w-[12px] h-[450px] origin-bottom blur-xl pointer-events-none mix-blend-screen" style={{ background: 'linear-gradient(to top, rgba(168, 85, 247, 0.8), rgba(255, 255, 255, 0))', transform: `translate(-50%, 0%) rotate(${oscillation}deg)` }} />
             <div className="absolute bottom-0 left-1/2 w-[4px] h-[400px] origin-bottom blur-sm pointer-events-none mix-blend-screen" style={{ background: 'linear-gradient(to top, #fff, transparent)', transform: `translate(-50%, 0%) rotate(${oscillation}deg)` }} />
             <div className="absolute top-0 left-1/2 w-[12px] h-[450px] origin-top blur-xl pointer-events-none mix-blend-screen" style={{ background: 'linear-gradient(to bottom, rgba(168, 85, 247, 0.8), rgba(255, 255, 255, 0))', transform: `translate(-50%, 0%) rotate(${oscillation}deg)` }} />
             <div className="absolute top-0 left-1/2 w-[4px] h-[400px] origin-top blur-sm pointer-events-none mix-blend-screen" style={{ background: 'linear-gradient(to bottom, #fff, transparent)', transform: `translate(-50%, 0%) rotate(${oscillation}deg)` }} />
          </div>
      );
  };

  const renderRedDwarf = () => {
    if (activeQuadrant !== QuadrantType.DELTA) return null;
    
    // Orbit Parameters:
    // First planet radius is 150px. 40% of that is 60px.
    // Almost circular orbit: a=60, b=58.
    
    const precessionSpeed = 0.0001; 
    const orbitSpeed = 0.00075; // 50% reduced speed
    
    const omega = elapsed * precessionSpeed; // Precession of the periapsis
    const t = elapsed * orbitSpeed; // Orbital position
    
    const a = 60; 
    const b = 58; 
    const c = Math.sqrt(a*a - b*b); 
    
    // Position relative to orbit center, shifted so one focus is at origin (0,0)
    // The center of the ellipse is at (c, 0) relative to the focus at origin
    const rawX = (Math.cos(t) * a) + c; 
    const rawY = (Math.sin(t) * b);
    
    // Apply precession rotation to the whole system
    const x = rawX * Math.cos(omega) - rawY * Math.sin(omega);
    const y = rawX * Math.sin(omega) + rawY * Math.cos(omega);
    
    // Z-Index: Behind when "away" (approx check)
    // Rotating the z-check with omega to keep layering consistent
    const isBehind = Math.sin(t + omega) < 0; 
    const zIndex = isBehind ? 5 : 25;
    
    return (
      <div 
        className="absolute w-3 h-3 bg-red-500 rounded-full shadow-[0_0_15px_#ef4444] cursor-pointer hover:scale-150 transition-transform flex items-center justify-center group"
        style={{ 
            transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
            zIndex
        }}
        onClick={(e) => { e.stopPropagation(); setSelectedPlanetId('white_dwarf'); setShowMissionLog(false); }}
      />
    );
  };

  const renderComet = () => {
    if (activeQuadrant !== QuadrantType.GAMA) return null;
    
    // Comet parameters (Gamma Sector)
    // Close wobbling orbit: 363 (perihelion +10%) to 497 (aphelion +20%)
    const b = 363; // Minor radius (closest distance to sun approx)
    const a = 497; // Major radius (20% longer)
    
    // Time scaling - 90% slower
    // Offset added (+ 3.5) to ensure start point is visible in cycle
    const t = (elapsed * 0.00003) + 3.5; 
    
    // Parametric centered ellipse
    const rawX = Math.cos(t) * a; 
    const rawY = Math.sin(t) * b;
    
    // Tilt the orbit to make it cross corners
    const tilt = -Math.PI / 4;
    const x = rawX * Math.cos(tilt) - rawY * Math.sin(tilt);
    const y = rawX * Math.sin(tilt) + rawY * Math.cos(tilt);
    
    // Calculate distance from sun (origin)
    const dist = Math.sqrt(x*x + y*y);
    
    // Tail Orientation: Points away from Sun (0,0).
    const tailAngle = Math.atan2(y, x);
    
    // Dynamic Intensity: Brightest at perihelion (363), Dimmest at aphelion (497)
    // Map dist [363...497] to [1.0...0.3]
    const intensity = Math.max(0.3, 1 - ((dist - 363) / 134)); 
    
    const tailLength = 40 + (intensity * 140); // 40 to 180
    const tailWidth = 2 + (intensity * 5); // 2 to 7
    const headSize = 3 + (intensity * 4); // 3 to 7

    return (
        <div 
            className="absolute z-0 pointer-events-none"
            style={{ 
                transform: `translate(${x}px, ${y}px) rotate(${tailAngle}rad)`, // Rotate to point tail away
                opacity: intensity
            }}
        >
            {/* Comet Head */}
            <div className="absolute rounded-full shadow-[0_0_15px_#facc15]" 
                 style={{ 
                     width: headSize, height: headSize, 
                     backgroundColor: '#fef08a', // Yellow-ish
                     transform: 'translate(-50%, -50%)',
                     zIndex: 10
                 }} 
            />
            
            {/* Comet Tail - Starts at center, extends along +X (rotated away from sun) */}
            <div 
                className="absolute top-1/2 left-0 origin-left"
                style={{
                    width: tailLength,
                    height: tailWidth,
                    background: 'linear-gradient(to right, rgba(253, 224, 71, 0.8), rgba(253, 224, 71, 0))', // Yellow fading tail
                    transform: 'translateY(-50%)',
                    zIndex: 5
                }}
            />
        </div>
    );
  };

  const sunStyle = getSunVisuals(activeQuadrant);
  const isPanelVisible = selectedPlanetId || showMissionLog;
  const sectorIntel = getSectorIntel(activeQuadrant);

  return (
    <div className={`w-full h-full bg-black flex overflow-hidden font-sans select-none ${isRecalculating ? 'cursor-wait' : ''}`}>
      
      {/* LEFT VIEWPORT: Solar System */}
      <div className="flex-grow relative bg-black overflow-hidden flex items-center justify-center">
        
        {/* Background Stars */}
        <div className="absolute inset-0 pointer-events-none">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)]" />
           {stars.map((s, i) => (
             <div key={i} className="absolute rounded-full bg-white animate-pulse" 
                  style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, opacity: s.opacity, animationDuration: `${s.animDuration}s`, animationDelay: `${s.animDelay}s` }} />
           ))}
        </div>

        {/* Sector Selection Panel (Top Center) */}
        <div className="absolute top-6 z-30 flex gap-4 pointer-events-auto">
           {[QuadrantType.ALFA, QuadrantType.BETA, QuadrantType.GAMA, QuadrantType.DELTA].map(q => {
             const style = getSunVisuals(q);
             const isActive = activeQuadrant === q;
             return (
               <button 
                 key={q}
                 onClick={() => { setActiveQuadrant(q); setSelectedPlanetId(null); setShowMissionLog(false); setPan({x:0, y:0}); setZoomStep(3); }}
                 className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all duration-300 bg-zinc-950/80 backdrop-blur-md ${isActive ? 'border-white scale-105 shadow-lg' : 'border-zinc-700 opacity-70 hover:opacity-100 hover:border-zinc-500'}`}
               >
                 <div className="relative w-10 h-10 rounded-full shadow-inner overflow-hidden flex-shrink-0">
                    <div className="absolute inset-0" style={{ background: style.gradient }} />
                    {style.isBlackHole && <div className="absolute inset-0 border-[1px] border-white/60 rounded-full scale-[0.7] animate-[spin_3s_linear_infinite]" />}
                 </div>
                 <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-zinc-500'}`}>{q}</span>
               </button>
             )
           })}
        </div>

        {/* Solar System Container Wrapper for Dragging */}
        <div 
            className="absolute inset-0 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing touch-none"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
        >
            <div 
                className="relative flex items-center justify-center"
                style={{ 
                    transform: `translate(${pan.x}px, ${pan.y}px)`, 
                    transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)' 
                }}
            >
                {/* Dynamically Scaled Container */}
                <div 
                    className="relative w-[1000px] h-[1000px] flex items-center justify-center transition-transform duration-700 origin-center"
                    style={{ transform: `scale(${currentScale})` }}
                >
                
                {/* Pulsar Jets */}
                {renderBlackHoleJets()}

                {/* Central Sun - Reduced Size */}
                <div 
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        setSelectedPlanetId(null); 
                        setShowMissionLog(true); 
                    }}
                    className="absolute z-10 w-20 h-20 rounded-full shadow-2xl transition-transform duration-200 cursor-pointer hover:scale-110 active:scale-95"
                    style={{ background: sunStyle.gradient, boxShadow: sunStyle.shadow, border: sunStyle.border || 'none' }}
                >
                    {sunStyle.isBlackHole && (
                    <>
                        <div className="absolute inset-[-5px] border-[3px] border-purple-500/30 rounded-full animate-[spin_4s_linear_infinite]" />
                        <div className="absolute inset-[-15px] border-[1px] border-white/10 rounded-full animate-[spin_7s_linear_infinite_reverse]" />
                    </>
                    )}
                </div>

                {/* Red Dwarf Decoration (Precessing Orbit) */}
                {renderRedDwarf()}

                {/* Gamma Comet (Yellow, Tail Away from Sun) */}
                {renderComet()}

                {/* Planets & Orbits */}
                {planetVisuals.map((p) => {
                    const angle = (elapsed * SPEED_CONSTANT * p.orbitSpeedFactor * (p.orbitDirection || 1)) + p.orbitOffset;
                    const x = Math.cos(angle) * p.visualDistance;
                    const y = Math.sin(angle) * p.visualDistance;
                    const isSelected = selectedPlanetId === p.id;

                    return (
                    <React.Fragment key={p.id}>
                        {/* Orbit Ring - Only show if selected to reduce clutter */}
                        {isSelected && (
                            <div className="absolute rounded-full border border-zinc-700/50 pointer-events-none transition-opacity duration-500" 
                                 style={{ width: p.visualDistance * 2, height: p.visualDistance * 2 }} />
                        )}
                        
                        {/* Planet Body Group - Centered on Coordinate */}
                        <div 
                            className="absolute z-20 cursor-pointer group flex items-center justify-center"
                            style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
                            onClick={(e) => { e.stopPropagation(); setSelectedPlanetId(p.id); setShowMissionLog(false); }}
                        >
                            {/* SMART RETICLE */}
                            {isSelected && (
                                <div className="absolute left-1/2 top-1/2 pointer-events-none z-0" style={{ transform: `translate(-50%, -50%) scale(${1/currentScale})` }}> 
                                    <div className="relative flex items-center justify-center"
                                         style={{ 
                                             width: Math.min(Math.max((p.planetSizePx * 2.2 * currentScale), 45), (128 * currentScale * 0.85)), 
                                             height: Math.min(Math.max((p.planetSizePx * 2.2 * currentScale), 45), (128 * currentScale * 0.85))
                                         }}>
                                        <div className="absolute inset-0 border border-dashed border-emerald-500/60 rounded-full animate-[spin_10s_linear_infinite]" />
                                        <div className="absolute inset-[3px] border border-emerald-400/80 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.4)]" />
                                        <div className="absolute top-0 w-[1px] h-[4px] bg-emerald-400" />
                                        <div className="absolute bottom-0 w-[1px] h-[4px] bg-emerald-400" />
                                        <div className="absolute left-0 w-[4px] h-[1px] bg-emerald-400" />
                                        <div className="absolute right-0 w-[4px] h-[1px] bg-emerald-400" />
                                    </div>
                                </div>
                            )}

                            <div className="relative flex items-center justify-center">
                                {/* Dynamic Size Planet */}
                                <div 
                                className={`rounded-full shadow-lg transition-all duration-300 relative z-10 ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}
                                style={{ 
                                    width: `${p.planetSizePx}px`, 
                                    height: `${p.planetSizePx}px`,
                                    backgroundColor: p.color, 
                                    boxShadow: `inset -4px -4px 10px rgba(0,0,0,0.8), 0 0 20px ${p.color}44` 
                                }}
                                />
                            </div>

                            {/* Moons */}
                            {p.visualMoons.map((m, mi) => {
                            const mAngle = (elapsed * 0.06 * m.speed * (m.direction || 1)) + m.offset;
                            const mx = Math.cos(mAngle) * m.dist;
                            const my = Math.sin(mAngle) * m.dist;
                            return (
                                <div key={mi} className="absolute bg-zinc-400 rounded-full pointer-events-none shadow-sm left-1/2 top-1/2" style={{ width: m.size, height: m.size, transform: `translate(-50%, -50%) translate(${mx}px, ${my}px)` }} />
                            )
                            })}
                        </div>
                    </React.Fragment>
                    );
                })}
                </div>
            </div>
        </div>

        {/* Zoom Controls (Bottom Left of Viewport) - With Home Button Above */}
        <div className="absolute bottom-8 left-8 flex flex-col gap-2 z-50 pointer-events-auto">
            <button onClick={onBack} className="w-10 h-10 bg-zinc-900 border border-zinc-700 text-zinc-400 rounded flex items-center justify-center hover:bg-zinc-800 hover:text-white hover:border-zinc-500 transition-all shadow-lg active:scale-95 mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            </button>

            <button 
                onClick={handleZoomIn}
                className="w-10 h-10 bg-zinc-900 border border-zinc-700 text-zinc-400 rounded flex items-center justify-center hover:bg-zinc-800 hover:text-white hover:border-zinc-500 transition-all shadow-lg active:scale-95"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button 
                onClick={handleResetView}
                className="w-10 h-10 bg-zinc-900 border border-zinc-700 text-emerald-500 rounded flex items-center justify-center hover:bg-zinc-800 hover:text-emerald-400 hover:border-emerald-900 transition-all shadow-lg active:scale-95"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button 
                onClick={handleZoomOut}
                className="w-10 h-10 bg-zinc-900 border border-zinc-700 text-zinc-400 rounded flex items-center justify-center hover:bg-zinc-800 hover:text-white hover:border-zinc-500 transition-all shadow-lg active:scale-95"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
        </div>

        {/* Sector Label - Moved to Top Right to clear controls */}
        <div className={`absolute top-8 right-8 pointer-events-none hidden md:block`}>
           <h1 className="retro-font text-5xl text-zinc-900 font-black uppercase tracking-tighter drop-shadow-[0_2px_0_rgba(255,255,255,0.1)] text-right">{activeQuadrant}</h1>
           <div className="text-zinc-600 font-mono text-sm uppercase tracking-[0.5em] ml-1 mt-2 text-right">Sector Control</div>
        </div>
      </div>

      {/* RIGHT PANEL: RESPONSIVE INTEL PANEL */}
      <div className={`
          transition-all duration-300 ease-in-out z-40 flex flex-col shadow-2xl overflow-hidden
          
          /* Variable Width: 1/2 on mobile, 1/4 on tablet/medium, Fixed sidebar on large desktop */
          fixed bottom-4 right-4 w-1/2 md:w-1/4 h-auto max-h-[80vh] rounded-xl border border-zinc-700/50 bg-zinc-900/60 backdrop-blur-md
          ${isPanelVisible ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0 pointer-events-none'}

          /* Desktop / Landscape: Full Height Right Sidebar (Overrides fixed bottom positioning) */
          lg:relative lg:inset-auto lg:bottom-auto lg:left-auto lg:right-auto lg:translate-y-0 lg:opacity-100 lg:pointer-events-auto
          lg:h-full lg:rounded-none lg:border-t-0 lg:border-b-0 lg:border-r-0 lg:border-l lg:border-zinc-800 lg:bg-zinc-950 lg:backdrop-blur-none
          lg:max-h-none lg:w-96 lg:translate-x-0
      `}>
        
        {selectedPlanet ? (
          <>
            {/* Panel Header */}
            <div className="p-3 lg:p-5 border-b border-zinc-800/50 lg:border-zinc-800 bg-zinc-900/40 lg:bg-zinc-950 flex justify-between items-start shrink-0 z-10 rounded-t-xl lg:rounded-none">
              <div className="flex flex-col gap-1 w-full mr-4">
                  <h2 className="text-sm lg:text-2xl font-black text-white uppercase leading-none">{selectedPlanet.name}</h2>
                  <div className="flex flex-col mt-1 gap-0.5">
                      <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full ${getPlanetStatus(selectedPlanet.id) === 'friendly' ? 'bg-emerald-500' : (getPlanetStatus(selectedPlanet.id) === 'siege' ? 'bg-orange-500 animate-pulse' : 'bg-red-500 animate-pulse')}`} />
                          <span className="text-[8px] lg:text-[10px] text-zinc-400 font-mono tracking-widest uppercase">
                              {getPlanetStatus(selectedPlanet.id)} {getPlanetStatus(selectedPlanet.id) !== 'friendly' && `(LIB ${getWins(selectedPlanet.id)}/1)`}
                          </span>
                      </div>
                      <span className="text-[8px] lg:text-[10px] text-blue-400 font-mono tracking-widest uppercase">FC: 1 UNIT</span>
                  </div>
              </div>
              <button 
                  onClick={() => setSelectedPlanetId(null)} 
                  className="text-zinc-500 hover:text-red-400 text-[10px] lg:text-xs font-black uppercase tracking-widest border border-zinc-700/50 px-2 py-1 rounded hover:bg-zinc-900 transition-colors shrink-0"
              >
                  HIDE
              </button>
            </div>

            {/* Scrollable Content Area - Visible on all screens now */}
            <div className="flex flex-grow flex-col overflow-y-auto custom-scrollbar p-3 lg:p-6 gap-3 lg:gap-6 z-10">
               
               {/* PLANET IMAGE (Reduced height) - Hidden on mobile */}
               <div className="hidden md:flex w-full h-24 lg:h-32 bg-black rounded-lg border-2 border-zinc-700 relative items-center justify-center overflow-hidden shadow-[inset_0_0_30px_rgba(0,0,0,1)] shrink-0">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#000_100%)] z-10" />
                  <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-full shadow-[inset_-12px_-12px_25px_rgba(0,0,0,0.9)] relative flex items-center justify-center" style={{ backgroundColor: selectedPlanet.color }}>
                     <div className="absolute inset-0 rounded-full shadow-[0_0_40px_currentColor] z-10" style={{ color: selectedPlanet.color }} />
                  </div>
                  <div className="absolute top-2 right-2 z-20">
                     <span className="text-[9px] font-black text-white bg-red-600 px-2 py-0.5 rounded shadow-lg">CLASS {selectedPlanet.difficulty}</span>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-2">
                   <div className="bg-zinc-900/30 p-2 rounded border border-zinc-800/50">
                      <div className="text-[8px] text-zinc-500 uppercase font-black">Distance</div>
                      <div className="text-white font-mono text-[9px] lg:text-xs">{selectedPlanet.orbitRadius} AU</div>
                   </div>
                   <div className="bg-zinc-900/30 p-2 rounded border border-zinc-800/50">
                      <div className="text-[8px] text-zinc-500 uppercase font-black">Gravity</div>
                      <div className="text-blue-400 font-mono text-[9px] lg:text-xs">{selectedPlanet.size.toFixed(1)} G</div>
                   </div>
               </div>

               <div className="space-y-2 bg-zinc-900/20 p-3 rounded border border-zinc-800/30">
                   <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Briefing</span>
                      {isLoadingBriefing && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />}
                   </div>
                   <p className="text-[10px] leading-relaxed uppercase text-zinc-400 font-mono border-l-2 border-emerald-500/30 pl-2">
                      {isLoadingBriefing ? "DECRYPTING..." : (briefing || selectedPlanet.description)}
                   </p>
               </div>
            </div>

            {/* Fixed Footer for Buttons */}
            <div className="p-3 lg:p-6 border-t border-zinc-800/50 lg:border-zinc-800 bg-zinc-900/40 lg:bg-zinc-950 shrink-0 z-20 flex flex-col gap-2 mt-auto">
                {(() => {
                    const status = getPlanetStatus(selectedPlanet.id);
                    let label = 'VISIT PLANET';
                    let btnClass = 'bg-emerald-600 border border-emerald-500 text-white hover:bg-emerald-500 hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
                    
                    if (status === 'siege') {
                        label = 'DEFEND PLANET';
                        btnClass = 'bg-orange-600 border border-orange-500 text-white hover:bg-orange-500 hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(249,115,22,0.3)] animate-pulse';
                    } else if (status === 'occupied') {
                        label = 'ATTACK PLANET';
                        btnClass = 'bg-red-700 border border-red-500 text-white hover:bg-red-600 hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(220,38,38,0.3)] animate-pulse';
                    }

                    return (
                        <button 
                            onClick={() => onLaunch(selectedPlanet)} 
                            className={`w-full py-2 lg:py-4 font-black uppercase tracking-[0.1em] text-[9px] lg:text-xs rounded shadow-lg transition-all ${btnClass}`}
                        >
                           {label}
                        </button>
                    );
                })()}
                
                {testMode && onTestLanding && (
                    <button onClick={() => onTestLanding(selectedPlanet)} className="w-full py-1.5 lg:py-3 bg-orange-600/20 border border-orange-500 text-orange-500 font-black uppercase tracking-widest text-[8px] lg:text-[10px] rounded hover:bg-orange-600 hover:text-white transition-colors">
                        TEST LANDING SEQUENCE
                    </button>
                )}
            </div>
          </>
        ) : (
          <div className="flex-grow flex flex-col justify-start p-4 z-10 relative w-full h-full">
             {/* Close button for Mobile only when opened via Sun click */}
             <button 
                onClick={() => setShowMissionLog(false)}
                className="absolute top-2 right-2 lg:hidden text-zinc-500 hover:text-white p-2"
             >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
             </button>

             {isWhiteDwarf ? (
                 <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-32 h-32 bg-black rounded-full border-2 border-red-500 flex items-center justify-center mb-6 relative overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_#ef4444_0%,_#7f1d1d_100%)] opacity-80" />
                        <div className="absolute inset-0 border-[6px] border-red-400/20 rounded-full scale-[1.2]" />
                    </div>
                    <h3 className="retro-font text-red-400 text-sm uppercase mb-2">Red Dwarf</h3>
                    <div className="bg-red-950/30 border border-red-800/50 p-3 rounded mb-4 w-full">
                        <p className="text-[10px] text-red-200 uppercase font-mono leading-relaxed">
                            A dying stellar remnant caught in the accretion well. Extreme tidal forces and radiation storms detected. Not habitable.
                        </p>
                    </div>
                    <div className="text-[9px] text-zinc-600 uppercase font-black tracking-widest bg-zinc-900/50 px-4 py-2 rounded">
                        NO LANDING SITES
                    </div>
                 </div>
             ) : (
                 <>
                    {/* Header */}
                    <div className="mb-2 mt-2 flex flex-col items-start w-full border-b border-zinc-800 pb-2">
                        <h1 className="text-xl lg:text-2xl font-black uppercase tracking-tight leading-none" style={{ color: sunStyle.color, textShadow: `0 0 10px ${sunStyle.color}44` }}>
                            {getSunTitle(activeQuadrant)}
                        </h1>
                        <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold mt-1">
                            SECTOR MISSIONS
                        </div>
                    </div>

                    {/* List */}
                    <div className="w-full flex flex-col gap-0.5 overflow-y-auto custom-scrollbar flex-grow">
                        {sectorPlanets.map(p => {
                             const status = getPlanetStatus(p.id);
                             const mType = status === 'friendly' ? MissionType.TRAVEL : (status === 'siege' ? MissionType.DEFENSE : MissionType.ATTACK);
                             
                             let missionColor = 'text-emerald-500';
                             if (mType === MissionType.ATTACK) missionColor = 'text-red-500';
                             if (mType === MissionType.DEFENSE) missionColor = 'text-orange-500';

                             return (
                                 <div 
                                    key={p.id} 
                                    onClick={() => setSelectedPlanetId(p.id)}
                                    className="flex items-center w-full py-1 px-0 hover:bg-white/5 rounded-sm cursor-pointer transition-colors group border-b border-zinc-900/50 last:border-0"
                                 >
                                    {/* Col 1: Dot */}
                                    <div className="w-3 flex items-center justify-start shrink-0">
                                        <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: p.color, color: p.color }} />
                                    </div>
                                    
                                    {/* Col 2: Name */}
                                    <div className="flex-grow text-left pl-2">
                                        <span className="text-xs font-bold text-zinc-400 group-hover:text-white uppercase tracking-wider transition-colors">{p.name}</span>
                                    </div>

                                    {/* Col 3: Mission */}
                                    <div className="shrink-0 text-right">
                                        <span className={`text-[9px] font-black font-mono uppercase tracking-widest ${missionColor}`}>
                                            {mType}
                                        </span>
                                    </div>
                                 </div>
                             );
                        })}
                    </div>

                    {/* Sector Intel - Visible on Large Screens */}
                    <div className="mt-4 pt-4 border-t border-zinc-800 hidden lg:block">
                        <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Sector Intel</div>
                        <p className="text-[11px] text-zinc-400 font-mono leading-relaxed mb-3">
                            {sectorIntel.desc}
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                            <div className="bg-emerald-950/20 border border-emerald-900/30 p-2 rounded">
                                <div className="text-[9px] text-emerald-600 font-bold uppercase mb-1">Opportunities</div>
                                <div className="text-[10px] text-emerald-400/80 font-mono leading-tight">{sectorIntel.opp}</div>
                            </div>
                            <div className="bg-red-950/20 border border-red-900/30 p-2 rounded">
                                <div className="text-[9px] text-red-600 font-bold uppercase mb-1">Danger Level</div>
                                <div className="text-[10px] text-red-400/80 font-mono leading-tight">{sectorIntel.danger}</div>
                            </div>
                        </div>
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
