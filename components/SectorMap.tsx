
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
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [briefing, setBriefing] = useState<string>("");
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);

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

  // Generate visual-only properties for the view (orbits, moons)
  const planetVisuals = useMemo(() => {
    // Start closer to the smaller sun (150px instead of 220px)
    let cumulativeDist = 150; 

    return sectorPlanets.map((p, i) => {
      const status = getPlanetStatus(p.id);
      const isInner = i < 2;
      // Increased Planet Sizes by ~30%
      const planetSizePx = isInner ? 36 : 48; // Was 28 / 36
      const planetRadius = planetSizePx / 2;

      // Deterministic but varied moon counts
      const moonCount = Math.floor(Math.random() * 3) + (i > 1 ? 1 : 0);

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

      // Increment for next planet (Current System + Small Gap + Next System approximation)
      // Much more compact gap (40px instead of 120px)
      cumulativeDist += systemRadius + 40; 

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
  }, [sectorPlanets, orbitOffsets, planetRegistry]);

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
      // Prevent default to avoid scrolling on mobile, but allow if it's not the map
      // e.preventDefault(); // Moved to passive: false in effect if needed, but here simple logic works
      
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
          
          // Prevent scrolling on touch devices while panning map
          if (e.type === 'touchmove') {
             // e.preventDefault(); // Passive listener issue in React 18, handled via CSS touch-action usually
          }

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
      // Trigger recalculation effect on reset too
      setIsRecalculating(true);
      isRecalculatingRef.current = true;
      setTimeout(() => { setIsRecalculating(false); isRecalculatingRef.current = false; }, 500);
  };

  const getSunVisuals = (q: QuadrantType) => {
    // Reduced shadow spread for smaller sun (80px -> 50px)
    switch (q) {
      case QuadrantType.ALFA: return { 
        color: '#facc15', 
        shadow: '0 0 50px #facc15', 
        gradient: 'radial-gradient(circle, #fef08a 20%, #eab308 100%)', 
        label: 'YELLOW DWARF' 
      };
      case QuadrantType.BETA: return { 
        color: '#ef4444', 
        shadow: '0 0 50px #ef4444', 
        gradient: 'radial-gradient(circle, #fca5a5 20%, #dc2626 100%)', 
        label: 'RED GIANT' 
      };
      case QuadrantType.GAMA: return { 
        color: '#3b82f6', 
        shadow: '0 0 50px #3b82f6', 
        gradient: 'radial-gradient(circle, #93c5fd 20%, #2563eb 100%)', 
        label: 'BLUE NEUTRON' 
      };
      case QuadrantType.DELTA: return { 
        color: '#451a03', 
        shadow: '0 0 30px #ffffff, inset 0 0 40px #000', 
        gradient: 'radial-gradient(circle, #000000 60%, #451a03 100%)', 
        border: '2px solid rgba(255,255,255,0.9)',
        isBlackHole: true,
        label: 'SINGULARITY'
      };
    }
  };

  const elapsed = currentTime - universeStartTime;
  const SPEED_CONSTANT = 0.00006;

  const renderWhiteDwarf = () => {
    if (activeQuadrant !== QuadrantType.DELTA) return null;
    const angle = elapsed * SPEED_CONSTANT * 10; 
    const a = 107; const b = 30; const tilt = -Math.PI / 8;
    const ux = Math.cos(angle) * a; const uy = Math.sin(angle) * b;
    const x = ux * Math.cos(tilt) - uy * Math.sin(tilt);
    const y = ux * Math.sin(tilt) + uy * Math.cos(tilt);
    const isBehind = Math.sin(angle) < 0; 
    const zIndex = isBehind ? 5 : 30; 

    const trailPoints = []; const trailLength = 40; 
    for(let i = 0; i < trailLength; i++) {
        const t = i / trailLength;
        const distFactor = 1.0 - (t * 0.9); 
        const spiralAngle = t * Math.PI * 1.2; 
        let tx = x * distFactor; let ty = y * distFactor;
        const rotX = tx * Math.cos(spiralAngle) - ty * Math.sin(spiralAngle);
        const rotY = tx * Math.sin(spiralAngle) + ty * Math.cos(spiralAngle);
        const jitter = (Math.random() - 0.5) * (i * 0.2);
        trailPoints.push({ x: rotX + jitter, y: rotY + jitter, opacity: 0.8 * (1 - t), size: 4 * (1 - t * 0.5), blur: 1 + (t * 2) });
    }

    return (
        <>
            <div className="absolute left-1/2 top-1/2 w-0 h-0 pointer-events-none" style={{ zIndex: zIndex - 1 }}>
                {trailPoints.map((tp, i) => (
                    <div key={i} className="absolute rounded-full"
                        style={{ transform: `translate(${tp.x}px, ${tp.y}px) translate(-50%, -50%)`, width: `${tp.size}px`, height: `${tp.size}px`, backgroundColor: '#a5f3fc', opacity: tp.opacity, filter: `blur(${tp.blur}px)`, boxShadow: `0 0 ${tp.size * 2}px rgba(165, 243, 252, 0.4)` }} />
                ))}
            </div>
            <div className="absolute left-1/2 top-1/2 cursor-pointer group flex items-center justify-center"
                style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`, zIndex: zIndex + 1, width: '40px', height: '40px' }}
                onClick={(e) => { e.stopPropagation(); setSelectedPlanetId('white_dwarf'); }} >
                <div className={`w-3 h-3 bg-white rounded-full shadow-[0_0_15px_#fff] transition-all duration-300 pointer-events-none ${selectedPlanetId === 'white_dwarf' ? 'scale-150 shadow-[0_0_25px_#22d3ee]' : 'group-hover:scale-125'}`} />
            </div>
        </>
    );
  };

  const renderComet = () => {
    if (activeQuadrant !== QuadrantType.GAMA) return null;
    const t = elapsed * 0.00005; 
    // Increased orbit to avoid inner planets
    const a = 1000; const b = 400; const c = 600; 
    const rawX = Math.cos(t) * a + c; const rawY = Math.sin(t) * b;
    const precessionSpeed = 0.000015; 
    const baseTilt = -Math.PI / 8;
    const totalRotation = baseTilt + (elapsed * precessionSpeed);
    const x = rawX * Math.cos(totalRotation) - rawY * Math.sin(totalRotation);
    const y = rawX * Math.sin(totalRotation) + rawY * Math.cos(totalRotation);
    const tailAngle = Math.atan2(y, x);
    const zIndex = Math.sin(t) < 0 ? 5 : 25;

    return (
      <div className="absolute w-0 h-0 pointer-events-none" style={{ zIndex, left: '50%', top: '50%', transform: `translate(${x}px, ${y}px)` }}>
         <div className="absolute h-[3px] origin-left bg-gradient-to-r from-cyan-200 via-cyan-500/40 to-transparent blur-[1px]" style={{ top: '-1.5px', left: '0px', width: '160px', transform: `rotate(${tailAngle}rad)` }} />
         <div className="absolute w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_15px_#22d3ee] -translate-x-1/2 -translate-y-1/2" />
      </div>
    );
  };

  const sunStyle = getSunVisuals(activeQuadrant);

  const renderBlackHoleJets = () => {
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
                 onClick={() => { setActiveQuadrant(q); setSelectedPlanetId(null); setPan({x:0, y:0}); setZoomStep(3); }}
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
                    className="absolute z-10 w-20 h-20 rounded-full shadow-2xl transition-transform duration-200"
                    style={{ background: sunStyle.gradient, boxShadow: sunStyle.shadow, border: sunStyle.border || 'none' }}
                >
                    {sunStyle.isBlackHole && (
                    <>
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
                            onClick={(e) => { e.stopPropagation(); setSelectedPlanetId(p.id); }}
                        >
                            {/* SMART RETICLE */}
                            {isSelected && (
                                <div className="absolute left-1/2 top-1/2 pointer-events-none z-0" style={{ transform: `translate(-50%, -50%) scale(${1/currentScale})` }}> 
                                    <div className="relative flex items-center justify-center"
                                         style={{ 
                                             // Dynamic Size Logic for Selection
                                             width: Math.min(
                                                 Math.max((p.planetSizePx * 2.2 * currentScale), 45), 
                                                 (128 * currentScale * 0.85)
                                             ), 
                                             height: Math.min(
                                                 Math.max((p.planetSizePx * 2.2 * currentScale), 45), 
                                                 (128 * currentScale * 0.85)
                                             )
                                         }}>
                                        <div className="absolute inset-0 border border-dashed border-emerald-500/60 rounded-full animate-[spin_10s_linear_infinite]" />
                                        <div className="absolute inset-[3px] border border-emerald-400/80 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.4)]" />
                                        
                                        {/* Ticks */}
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
          ${selectedPlanet ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0 pointer-events-none'}

          /* Desktop / Landscape: Full Height Right Sidebar (Overrides fixed bottom positioning) */
          lg:relative lg:inset-auto lg:bottom-auto lg:left-auto lg:right-auto lg:translate-y-0
          lg:h-full lg:rounded-none lg:border-t-0 lg:border-b-0 lg:border-r-0 lg:border-l lg:border-zinc-800 lg:bg-zinc-950 lg:backdrop-blur-none
          lg:max-h-none lg:w-0
          ${selectedPlanet ? 'lg:w-96 lg:translate-x-0' : 'lg:translate-x-full lg:border-none'}
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
                <button 
                    onClick={() => onLaunch(selectedPlanet)} 
                    className={`w-full py-2 lg:py-4 font-black uppercase tracking-[0.1em] text-[9px] lg:text-xs rounded shadow-lg transition-all 
                    ${getPlanetStatus(selectedPlanet.id) === 'friendly' 
                        ? 'bg-emerald-600 border border-emerald-500 text-white hover:bg-emerald-500 hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                        : 'bg-red-700 border border-red-500 text-white hover:bg-red-600 hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(220,38,38,0.3)] animate-pulse'}`}
                >
                   {getPlanetStatus(selectedPlanet.id) === 'friendly' ? 'VISIT PLANET' : 'DEFEND PLANET'}
                </button>
                
                {testMode && onTestLanding && (
                    <button onClick={() => onTestLanding(selectedPlanet)} className="w-full py-1.5 lg:py-3 bg-orange-600/20 border border-orange-500 text-orange-500 font-black uppercase tracking-widest text-[8px] lg:text-[10px] rounded hover:bg-orange-600 hover:text-white transition-colors">
                        TEST LANDING SEQUENCE
                    </button>
                )}
            </div>
          </>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center z-10 hidden lg:flex">
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
