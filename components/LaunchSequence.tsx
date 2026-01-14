
// --- LOCKED: LAUNCH SEQUENCE MODULE ---
// DO NOT REFACTOR OR MODIFY WITHOUT EXPLICIT USER REQUEST
// Visuals, physics, and layout are finalized.

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Planet, Moon, QuadrantType, EquippedWeapon } from '../types.ts';
import { ExtendedShipConfig } from '../constants.ts';
import { ShipIcon } from './ShipIcon.tsx';
import { audioService } from '../services/audioService.ts';
import { LandingGear } from './LandingGear.tsx';
import { drawDome, drawPlatform, getEngineCoordinates } from '../utils/drawingUtils.ts';

interface LaunchSequenceProps {
  planet: Planet | Moon;
  shipConfig: ExtendedShipConfig;
  shipColors: any;
  onComplete: () => void;
  testMode?: boolean;
  weaponId?: string;
  equippedWeapons?: (EquippedWeapon | null)[];
  currentFuel: number;
  maxFuel: number;
}

const Gauge = ({ value, max, label, unit, color = "#10b981" }: { value: number, max: number, label: string, unit: string, color?: string }) => {
    const percent = Math.min(1, Math.max(0, value / max));
    const r = 22;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - percent * circumference;
    
    return (
        <div className="flex flex-col items-center gap-2 bg-zinc-950/80 p-3 rounded-lg border border-zinc-800 backdrop-blur-sm shadow-xl min-w-[80px]">
            <div className="relative w-14 h-14">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 60 60">
                    <circle cx="30" cy="30" r={r} fill="none" stroke="#334155" strokeWidth="5" />
                    <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5" 
                            strokeDasharray={circumference} strokeDashoffset={offset} 
                            strokeLinecap="round" className="transition-all duration-300 ease-out" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-[10px] font-black text-white tabular-nums">{value >= 1000 ? (value/1000).toFixed(1)+'k' : Math.floor(value)}</span>
                    <span className="text-[6px] text-zinc-400 font-mono uppercase">{unit}</span>
                </div>
            </div>
            <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">{label}</span>
        </div>
    );
};

const LaunchSequence: React.FC<LaunchSequenceProps> = ({ planet, shipConfig, shipColors, onComplete, testMode, weaponId, equippedWeapons, currentFuel, maxFuel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shipDOMRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'countdown' | 'ignition' | 'lift' | 'atmosphere' | 'orbit'>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [statusText, setStatusText] = useState("SYSTEM CHECK");
  
  // Phase Ref to avoid stale closures in animation loop
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Determine Jet Type based on Phase
  const jetType = (phase === 'atmosphere' || phase === 'orbit') ? 'ion' : 'combustion';

  // Animation State
  const [altitude, setAltitude] = useState(0);
  const [velocity, setVelocity] = useState(0);
  
  // Engine locations for particles
  const engineLocs = useMemo(() => getEngineCoordinates(shipConfig), [shipConfig]);

  // Mutable state for loop to avoid React render lag
  const stateRef = useRef({
    viewY: 0,
    velocity: 0,
    altitude: 0,
    shake: 0,
    armRetract: 0,
    particles: [] as any[],
    cloudsLow: [] as any[],
    cloudsHigh: [] as any[],
    features: [] as any[],
    birds: [] as any[], // Birds array
    stars: [] as any[],
    startTime: 0,
    frameCount: 0,
    // Visual Tracking
    shipY: 0, // Pixel position of ship center
    shipScale: 1.0,
    shipOpacity: 1.0,
    groundY: 0,
    // Landing Gear Physics
    legExtension: 1.0, // 1 = fully deployed
    suspension: 0.0,   // 0 = fully compressed (sitting on pad), 1 = uncompressed (in air)
    windSpeed: 1.5 // Horizontal wind speed for smoke
  });

  // Skip Handler
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => { 
          if (e.code === 'Space') {
              e.preventDefault();
              onComplete();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onComplete]);

  // Setup Environment
  const environment = useMemo(() => {
      const p = planet as Planet;
      const seed = p.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const rand = (offset: number) => { const x = Math.sin(seed + offset) * 10000; return x - Math.floor(x); };

      const isIce = ['#ffffff', '#e2e8f0', '#cbd5e1'].includes(p.color);
      const isHabitable = ['#10b981', '#064e3b', '#15803d', '#3b82f6', '#60a5fa', '#0ea5e9', '#0d9488'].includes(p.color);
      const isWinter = isIce || (rand(1) > 0.7 && !isHabitable && !['#ef4444', '#b91c1c', '#f97316'].includes(p.color));
      
      const timeOfDay = rand(2) > 0.5 ? 'day' : 'night';
      
      let skyColorTop = '#0f172a';
      let skyColorBot = '#1e293b';
      
      if (timeOfDay === 'day') {
          if (p.quadrant === QuadrantType.BETA) { skyColorTop = '#fca5a5'; skyColorBot = '#fecaca'; }
          else if (p.quadrant === QuadrantType.DELTA) { skyColorTop = '#020617'; skyColorBot = '#1e1b4b'; }
          else { skyColorTop = '#0ea5e9'; skyColorBot = '#bae6fd'; }
      }

      return {
          isWinter,
          isHabitable,
          timeOfDay,
          skyColorTop,
          skyColorBot,
          groundColor: isWinter ? '#e2e8f0' : (p.color || '#3f3f46'),
          starDensity: timeOfDay === 'night' ? 150 : 20
      };
  }, [planet]);

  // Initialization
  useEffect(() => {
      const s = stateRef.current;
      s.startTime = Date.now();
      
      // Stars
      s.stars = Array.from({length: environment.starDensity}).map(() => ({
          x: Math.random(), y: Math.random(), size: Math.random()*2, alpha: Math.random()
      }));

      // Clouds - TWO LAYERS
      const cloudCountLow = environment.timeOfDay === 'day' ? 8 : 4;
      const cloudCountHigh = environment.timeOfDay === 'day' ? 6 : 3;

      s.cloudsLow = Array.from({length: cloudCountLow}).map(() => ({
          x: (Math.random() - 0.5) * 3000,
          y: -Math.random() * 1500 - 300, 
          w: 200 + Math.random() * 300,
          h: 60 + Math.random() * 60,
          speed: 1.0,
          shape: Array.from({length: 6}).map(() => ({ 
              ox: (Math.random()-0.5)*100, oy: (Math.random()-0.5)*40, r: 40 + Math.random()*40
          }))
      }));

      s.cloudsHigh = Array.from({length: cloudCountHigh}).map(() => ({
          x: (Math.random() - 0.5) * 4000,
          y: -Math.random() * 4000 - 2000, 
          w: 300 + Math.random() * 400,
          h: 80 + Math.random() * 80,
          speed: 0.5, 
          shape: Array.from({length: 7}).map(() => ({ 
              ox: (Math.random()-0.5)*120, oy: (Math.random()-0.5)*30, r: 50 + Math.random()*50
          }))
      }));

      // --- BIRDS ---
      s.birds = [];
      if (environment.isHabitable) {
          s.birds = Array.from({length: 15}).map(() => ({
              x: (Math.random() - 0.5) * 2000,
              y: -Math.random() * 600 - 100, 
              vx: 1 + Math.random() * 2,
              vy: (Math.random() - 0.5) * 0.5,
              wingSpan: 4 + Math.random() * 4,
              flapSpeed: 0.15 + Math.random() * 0.1,
              flapOffset: Math.random() * Math.PI
          }));
      }

      // --- FEATURES (Decor) ---
      const features = [];
      // 1. Launch Tower (Always present, Left of ship)
      features.push({ type: 'tower', x: -110, y: 0 }); 

      // 2. Standard Domes
      // Use the utility variants
      features.push({ type: 'dome_std', variant: 'radar', x: 250, y: 0, scale: 1.2 });
      features.push({ type: 'dome_std', variant: 'hab', x: -400, y: 0, scale: 1.5 });
      if (environment.isHabitable) {
          features.push({ type: 'dome_std', variant: 'bio', x: 500, y: 0, scale: 1.0 });
      }

      // Additional procedural debris
      const objectCount = 10;
      for(let i=0; i<objectCount; i++) {
          let x = (Math.random() - 0.5) * 2000;
          // Clear wider area around platform for clean view
          if (Math.abs(x) < 600) continue; 
          
          features.push({ 
              type: Math.random() > 0.5 ? 'rock' : 'spire', 
              x, 
              scale: 0.5 + Math.random(),
              color: '#57534e'
          });
      }

      s.features = features.sort((a,b) => (a.x*a.x) - (b.x*b.x));

  }, [environment, planet]);

  // Game Loop
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let raf: number;
      const s = stateRef.current;

      const loop = () => {
          const w = canvas.width = window.innerWidth;
          const h = canvas.height = window.innerHeight;
          const cx = w / 2;
          const cy = h / 2;
          s.frameCount++;
          
          const currentPhase = phaseRef.current;

          // --- 1. CALCULATE POSITIONS ---
          const groundY = h * 0.85;
          s.groundY = groundY;
          
          const platformSurfaceY = groundY - 20;

          // Calculate Precise Leg Height in SVG units (100x100)
          // 1.28 scale factor for DOM element (128px)
          const domScale = 1.28;
          // Gear Logic: 
          // Complex (Mech/Insect/Mag): Max 72, compressed -15 = 57.
          // Simple (Tele/Skid): Max 55, compressed -10 = 45.
          const isComplexGear = ['mechanical', 'insect', 'magnetic'].includes(shipConfig.landingGearType);
          const svgLegHeight = isComplexGear ? 57 : 45;
          const pixelLegHeight = svgLegHeight * domScale;

          // Ship Y (Center) should place feet on platformSurfaceY
          // Feet Y = ShipY + pixelLegHeight
          // ShipY = platformSurfaceY - pixelLegHeight
          const startingY = platformSurfaceY - pixelLegHeight;

          let targetY = startingY; 
          
          if (currentPhase === 'lift') {
              // --- SLOW TAKEOFF CURVE ---
              if (s.velocity < 2) {
                  s.velocity += 0.02; 
              } else {
                  s.velocity *= 1.02; // Exponential gain
              }
              
              s.altitude += s.velocity;
              targetY = startingY - s.altitude; 
              
              if (targetY < h * 0.4) {
                  const diff = (h * 0.4) - targetY;
                  targetY = h * 0.4;
                  s.viewY += diff;
              }
              
              // --- LANDING GEAR PHYSICS (REVERSE OF LANDING) ---
              // 1. Uncompress (Suspension 0 -> 1) as weight leaves ground
              if (s.altitude > 0 && s.altitude < 20) {
                  s.suspension = Math.min(1, s.suspension + 0.05);
              }
              
              // 2. Retract (Extension 1 -> 0)
              // "start retraction immediatly when the spaceship is above the spacetower."
              // Tower is roughly 260px tall.
              if (s.altitude > 260) {
                  // Retract slowly but visibly
                  s.legExtension = Math.max(0, s.legExtension - 0.006); 
              }

          } else if (currentPhase === 'atmosphere') {
              targetY = h * 0.3;
              s.viewY += (15 + s.velocity); 
              if (s.velocity < 50) s.velocity *= 1.01;
              s.shipScale = Math.max(0.4, s.shipScale - 0.002);
              s.altitude += 50;
              s.legExtension = 0; // Ensure retracted
          } else if (currentPhase === 'orbit') {
              targetY = h * 0.2;
              s.viewY += 40;
              s.shipScale = Math.max(0.1, s.shipScale - 0.005);
              s.altitude += 100;
          }

          if (currentPhase === 'countdown' || currentPhase === 'ignition') {
              s.shipY = startingY;
              // Sitting on pad -> Compressed suspension
              s.suspension = 0;
              s.legExtension = 1;
          } else {
              s.shipY += (targetY - s.shipY) * 0.1;
          }

          // Shake calculation
          if (currentPhase === 'ignition') s.shake = (Math.random() - 0.5) * 3;
          else if (currentPhase === 'lift') s.shake = (Math.random() - 0.5) * 6;
          else s.shake = 0;
          
          // Arm Retract Logic (Tower Arm)
          if (s.altitude > 100) {
              s.armRetract = Math.min(1, s.armRetract + 0.03); 
          } else {
              s.armRetract = 0; // Stay connected
          }

          if (s.frameCount % 10 === 0) {
              setAltitude(Math.floor(s.altitude));
              setVelocity(Math.floor(currentPhase === 'lift' ? s.velocity * 100 : (currentPhase === 'atmosphere' ? 2000 : 0)));
          }

          // --- 2. DRAWING ---

          // Sky
          const spaceRatio = Math.min(1, s.altitude / 8000);
          const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
          if (spaceRatio < 1) {
              skyGrad.addColorStop(0, environment.skyColorTop);
              skyGrad.addColorStop(1, environment.skyColorBot);
          } else {
              skyGrad.addColorStop(0, '#000'); skyGrad.addColorStop(1, '#000');
          }
          ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h);
          ctx.globalAlpha = 1 - spaceRatio;
          ctx.fillStyle = skyGrad; ctx.fillRect(0,0,w,h);
          ctx.globalAlpha = 1;

          // Stars
          const starVis = Math.max(0, Math.min(1, (environment.timeOfDay === 'night' ? 0.8 : 0) + (spaceRatio * 1.5)));
          if (starVis > 0) {
              ctx.fillStyle = '#fff';
              s.stars.forEach(st => {
                  ctx.globalAlpha = st.alpha * starVis;
                  const sy = (st.y * h + s.viewY * 0.05) % h; 
                  ctx.beginPath(); ctx.arc(st.x * w, sy, st.size, 0, Math.PI*2); ctx.fill();
              });
              ctx.globalAlpha = 1;
          }

          // CLOUDS (HIGH LAYER)
          s.cloudsHigh.forEach(c => {
              const speed = 0.5;
              const cy = c.y + (s.viewY * speed) + h*0.2;
              if (cy > -400 && cy < h + 400) {
                  ctx.fillStyle = environment.timeOfDay === 'day' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.05)';
                  c.shape.forEach((p: any) => {
                      ctx.beginPath(); ctx.arc(cx + c.x + p.ox, cy + p.oy, p.r, 0, Math.PI*2); ctx.fill();
                  });
              }
          });

          // Ground & World
          const worldY = groundY + s.viewY + s.shake;
          const worldSurfaceY = platformSurfaceY + s.viewY + s.shake;

          if (worldY > -800) {
              ctx.save();
              ctx.translate(cx, worldY);

              // Terrain
              ctx.fillStyle = environment.groundColor;
              ctx.fillRect(-w/2, 0, w, h);
              
              // Horizon
              const hGrad = ctx.createLinearGradient(0, -150, 0, 0);
              hGrad.addColorStop(0, 'rgba(0,0,0,0)');
              hGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
              ctx.fillStyle = hGrad;
              ctx.fillRect(-w/2, -150, w, 150);

              // Birds
              if (s.birds && s.birds.length > 0) {
                 const birdYBase = -300; 
                 ctx.strokeStyle = environment.timeOfDay === 'day' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
                 ctx.lineWidth = 1.5;
                 ctx.beginPath();
                 s.birds.forEach(b => {
                     b.x += b.vx; 
                     if (b.x > w/2 + 500) b.x = -w/2 - 500; 
                     const by = birdYBase + b.y; 
                     const bx = b.x;
                     const wingY = Math.sin(s.frameCount * b.flapSpeed + b.flapOffset) * 5;
                     ctx.moveTo(bx - b.wingSpan, by + wingY);
                     ctx.lineTo(bx, by);
                     ctx.lineTo(bx + b.wingSpan, by + wingY);
                 });
                 ctx.stroke();
              }

              // Reuse Platform
              drawPlatform(ctx, 0, 0); // At local center (0,0 is groundY)

              // Objects
              s.features.forEach(f => {
                  if (f.type === 'tower') {
                      const tx = f.x, ty = f.y;
                      const th = 260, tw = 50;
                      
                      // Lattice Tower Structure
                      ctx.strokeStyle = '#475569'; 
                      ctx.lineWidth = 3;
                      ctx.beginPath(); 
                      ctx.moveTo(tx, ty); ctx.lineTo(tx, ty-th); 
                      ctx.moveTo(tx+tw, ty); ctx.lineTo(tx+tw, ty-th);
                      // Cross bracing
                      for(let y=0; y<th; y+=30) { 
                          ctx.moveTo(tx, ty-y); ctx.lineTo(tx+tw, ty-y-30); 
                          ctx.moveTo(tx+tw, ty-y); ctx.lineTo(tx, ty-y-30); 
                          ctx.moveTo(tx, ty-y); ctx.lineTo(tx+tw, ty-y); 
                      }
                      ctx.stroke();
                      
                      // Base & Top Platform
                      ctx.fillStyle = '#334155'; ctx.fillRect(tx-10, ty-th, tw+20, 15);
                      ctx.fillRect(tx-5, ty-5, tw+10, 10); 

                      // Tower Top Light
                      const blink = Math.floor(Date.now() / 300) % 2 === 0;
                      const lightX = tx + tw/2;
                      const lightY = ty - th - 8;
                      if (blink) {
                          const grad = ctx.createRadialGradient(lightX, lightY, 2, lightX, lightY, 20);
                          grad.addColorStop(0, 'rgba(239, 68, 68, 1)');
                          grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
                          ctx.fillStyle = grad;
                          ctx.beginPath(); ctx.arc(lightX, lightY, 20, 0, Math.PI*2); ctx.fill();
                      }
                      ctx.fillStyle = blink ? '#ffadad' : '#7f1d1d';
                      ctx.beginPath(); ctx.arc(lightX, lightY, 5, 0, Math.PI*2); ctx.fill();

                      // Retractable Arm System
                      const armY = ty - 130;
                      const armStartX = tx + tw;
                      
                      // Arm logic: Wait for ship to clear before retracting
                      const maxArmLen = 40; 
                      const armLen = maxArmLen * (1 - s.armRetract);
                      
                      // Arm Housing on Tower
                      ctx.fillStyle = '#475569';
                      ctx.fillRect(tx + tw, armY - 12, 10, 24);
                      
                      // The Telescopic Arm
                      if (armLen > 0) {
                          ctx.fillStyle = '#94a3b8';
                          ctx.fillRect(armStartX, armY - 4, armLen, 8);
                          ctx.fillStyle = '#facc15';
                          ctx.fillRect(armStartX + armLen - 6, armY - 10, 6, 20);
                          ctx.fillStyle = blink ? '#fbbf24' : '#78350f';
                          ctx.beginPath(); ctx.arc(armStartX + armLen - 3, armY - 12, 2, 0, Math.PI*2); ctx.fill();
                          ctx.beginPath(); ctx.arc(armStartX + armLen - 3, armY + 12, 2, 0, Math.PI*2); ctx.fill();
                      }

                  } else if (f.type === 'dome_std') {
                      drawDome(ctx, f.x, f.y, f.scale, f.variant);
                  } else if (f.type === 'building') {
                      ctx.save(); ctx.translate(f.x, f.y);
                      ctx.fillStyle = f.color;
                      ctx.fillRect(-f.w/2, -f.h, f.w, f.h);
                      ctx.fillStyle = environment.timeOfDay === 'night' ? '#fbbf24' : '#1e293b'; 
                      for(let by = -f.h + 5; by < -5; by += 12) {
                          for(let bx = -f.w/2 + 5; bx < f.w/2 - 5; bx += 8) {
                              if (Math.random() > 0.4) ctx.fillRect(bx, by, 4, 6);
                          }
                      }
                      ctx.restore();
                  } else if (f.type === 'tree_real') {
                      const scale = f.scale;
                      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(scale, scale);
                      ctx.fillStyle = '#451a03'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-2, -40); ctx.lineTo(2, -40); ctx.lineTo(4, 0); ctx.fill();
                      ctx.fillStyle = f.color;
                      const drawLeaf = (lx: number, ly: number, size: number) => { ctx.beginPath(); ctx.arc(lx, ly, size, 0, Math.PI*2); ctx.fill(); };
                      drawLeaf(0, -55, 12); drawLeaf(-15, -40, 10); drawLeaf(15, -45, 10);
                      ctx.restore();
                  } else if (f.type === 'spire') {
                      ctx.save(); ctx.translate(f.x, f.y);
                      ctx.fillStyle = '#57534e';
                      ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(0, -80 * f.scale); ctx.lineTo(5, 0); ctx.fill();
                      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, -80 * f.scale, 2, 0, Math.PI*2); ctx.fill();
                      ctx.restore();
                  } else {
                      ctx.fillStyle = f.color || '#57534e'; ctx.beginPath(); ctx.arc(f.x, 0, 12*f.scale, Math.PI, 0); ctx.fill();
                  }
              });
              ctx.restore();
          }

          // CLOUDS (LOW LAYER)
          s.cloudsLow.forEach(c => {
              const speed = 1.0;
              const cy = c.y + (s.viewY * speed) + h*0.2;
              if (cy > -300 && cy < h + 300) {
                  ctx.fillStyle = environment.timeOfDay === 'day' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)';
                  c.shape.forEach((p: any) => {
                      ctx.beginPath(); ctx.arc(cx + c.x + p.ox, cy + p.oy, p.r, 0, Math.PI*2); ctx.fill();
                  });
              }
          });

          // --- PARTICLE SYSTEM ---
          if (currentPhase !== 'countdown') {
              const shipScale = s.shipScale;
              // Nozzle offset Y from center (approx 50) + Scale factor
              // The engine locations are in 0-100 coords relative to ship center at (50,50)
              // But s.shipY is the center of the ship DIV.
              // SVG coord system: 0-100.
              // To get pixel offset from s.shipY: (eng.y - 50) * domScale * shipScale
              const domScale = 1.28; // From earlier calculation
              
              if (currentPhase === 'ignition' || currentPhase === 'lift' || currentPhase === 'atmosphere') {
                  const smokeCount = currentPhase === 'ignition' ? 4 : 8;
                  const spawnChance = currentPhase === 'atmosphere' ? 0.8 : 1.0;
                  
                  // Calculate dynamic gap for smoke trail
                  // As velocity increases, smoke spawns further behind the nozzle
                  // This reveals the "clean" jet flame drawn by ShipIcon
                  const velocityFactor = currentPhase === 'lift' ? s.velocity : (currentPhase === 'atmosphere' ? 5 : 0);
                  const smokeLag = velocityFactor * 15 * shipScale;

                  if (Math.random() < spawnChance) {
                      for(let i=0; i<smokeCount; i++) {
                          // Pick a random engine to emit from
                          const eng = engineLocs[Math.floor(Math.random() * engineLocs.length)];
                          // Calculate nozzle position relative to ship center
                          const nozzleRelX = (eng.x - 50) * domScale * shipScale;
                          // Engine Y + Height + Nozzle Height (~6)
                          const nozzleRelY = (eng.y + eng.h + 6 - 50) * domScale * shipScale;
                          
                          // Apply lag
                          const spawnY = s.shipY + nozzleRelY + smokeLag;
                          
                          s.particles.push({
                              x: cx + nozzleRelX + (Math.random()-0.5) * 2 * shipScale,
                              y: spawnY,
                              vx: (Math.random()-0.5) * 4 * shipScale,
                              vy: (4 + Math.random() * 8) * shipScale, 
                              life: 1.0,
                              decay: 0.003 + Math.random() * 0.002, 
                              size: (10 + Math.random()*15) * shipScale,
                              grow: 0.5 + Math.random() * 0.5,
                              type: 'smoke',
                              color: '#ffffff',
                              // Initial opacity is lower if close to nozzle (simulating transparency)
                              initialAlpha: Math.min(0.8, 0.2 + (smokeLag / 50)) 
                          });
                      }
                  }
              }

              if (currentPhase === 'lift' || currentPhase === 'atmosphere') {
                  const fireCount = 10;
                  const isIon = currentPhase === 'atmosphere';
                  
                  // Fire particles (exhaust core)
                  for(let i=0; i<fireCount; i++) {
                      const eng = engineLocs[Math.floor(Math.random() * engineLocs.length)];
                      const nozzleRelX = (eng.x - 50) * domScale * shipScale;
                      const nozzleRelY = (eng.y + eng.h + 6 - 50) * domScale * shipScale;
                      
                      // Fire spawns directly at nozzle or slightly below
                      const spawnY = s.shipY + nozzleRelY + (Math.random() * 10 * shipScale);

                      s.particles.push({
                          x: cx + nozzleRelX + (Math.random()-0.5) * 2 * shipScale,
                          y: spawnY,
                          vx: (Math.random()-0.5) * 2,
                          vy: (10 + Math.random() * 10) * shipScale, 
                          life: 0.5 + Math.random() * 0.3,
                          decay: 0.05 + Math.random() * 0.05,
                          size: (5 + Math.random() * 5) * shipScale,
                          grow: -0.1, // Shrink
                          type: 'fire',
                          color: Math.random() > 0.5 ? (isIon ? '#3b82f6' : '#facc15') : (isIon ? '#60a5fa' : '#ef4444'),
                          initialAlpha: 1.0
                      });
                  }
              }
          }

          for(let i=s.particles.length-1; i>=0; i--) {
              const p = s.particles[i];
              if (p.type === 'smoke') {
                  p.x += s.windSpeed; 
                  p.x += (Math.random() - 0.5) * 2; 
              }
              p.x += p.vx; p.y += p.vy; p.life -= p.decay; p.size += p.grow;
              
              // --- PHYSICS DEFFLECTION ---
              // If particle hits the platform surface, spread out violently
              if (p.y >= worldSurfaceY && p.vy > 0) {
                  p.y = worldSurfaceY;
                  p.vy = 0;
                  // Deflect sideways randomly - increased spread for "fire burning platform" look
                  p.vx = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 15);
                  p.life -= 0.05; // Burn out faster on contact
              }

              if (p.life <= 0 || p.size <= 0) { s.particles.splice(i, 1); continue; }

              if (p.type === 'smoke') {
                  // Alpha fade in/out curve
                  let alpha = p.initialAlpha;
                  if (p.life > 0.8) {
                      alpha = p.initialAlpha * ((1.0 - p.life) / 0.2); 
                  } else {
                      alpha = Math.min(0.4, p.life * 0.4); 
                  }
                  
                  ctx.fillStyle = `rgba(224, 242, 254, ${Math.max(0, alpha)})`;
                  ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI*2); ctx.fill();
              } else if (p.type === 'fire') {
                  ctx.globalCompositeOperation = 'lighter'; 
                  ctx.globalAlpha = p.life;
                  ctx.fillStyle = p.color;
                  ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI*2); ctx.fill();
                  ctx.globalCompositeOperation = 'source-over'; 
                  ctx.globalAlpha = 1;
              }
          }

          if (shipDOMRef.current) {
              shipDOMRef.current.style.transform = `translate(-50%, -50%) translate(${cx}px, ${s.shipY + s.shake}px) scale(${s.shipScale})`;
          }

          raf = requestAnimationFrame(loop);
      };
      
      loop();
      
      const timer = setTimeout(() => {
          setPhase('ignition'); setStatusText("IGNITION"); setCountdown(0); audioService.playLaunchSequence();
          setTimeout(() => {
              setPhase('lift'); setStatusText("LIFTOFF");
              setTimeout(() => {
                  setPhase('atmosphere'); setStatusText("MAX Q");
                  setTimeout(() => {
                      setPhase('orbit'); setStatusText("ORBIT INSERTION");
                      setTimeout(onComplete, 3000);
                  }, 4000);
              }, 4000); 
          }, 2000);
      }, 3000);

      return () => {
          cancelAnimationFrame(raf);
          clearTimeout(timer);
          audioService.stopLaunchSequence();
      };
  }, [environment]);

  return (
    <div className="fixed inset-0 z-[5000] bg-black overflow-hidden font-mono select-none">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* HUD DASHBOARD - Moved to Top */}
      <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-50 pointer-events-none">
          <div className="flex gap-4">
              <Gauge value={altitude} max={8000} label="DISTANCE" unit="METERS" color="#3b82f6" />
              <Gauge value={velocity} max={2500} label="SPEED" unit="KM/H" color="#facc15" />
              <Gauge value={currentFuel} max={maxFuel} label="FUEL" unit="UNITS" color="#ef4444" />
          </div>
          
          <div className="flex flex-col items-end gap-2">
              <span className={`text-[10px] font-black uppercase tracking-widest ${phase === 'ignition' ? 'text-orange-500 animate-pulse' : 'text-emerald-400'}`}>STATUS: {statusText}</span>
              <button 
                  onClick={() => onComplete()} 
                  className="pointer-events-auto bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-white text-[10px] font-black uppercase px-6 py-3 rounded backdrop-blur-sm transition-all flex items-center gap-2"
              >
                  SKIP SEQUENCE <span className="text-[8px] text-zinc-500">space</span>
              </button>
          </div>
      </div>

      {countdown > 0 && (
          <div className="absolute bottom-12 left-12 z-50">
              <div className="text-xl text-emerald-500 font-black tracking-widest mb-1">T-MINUS</div>
              <div className="text-8xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] animate-pulse">{countdown}</div>
          </div>
      )}

      {/* Manual DOM Positioning controlled by JS loop */}
      <div 
          ref={shipDOMRef}
          className="absolute left-0 top-0 w-32 h-32 will-change-transform z-20"
      >
        <div className="absolute inset-0 z-0 overflow-visible">
             <svg className="absolute w-full h-full" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
                <g transform={`translate(50, 50)`}>
                    {['left', 'right'].map((side) => {
                        const extension = stateRef.current.legExtension;
                        const compression = stateRef.current.suspension;
                        return (
                            <LandingGear 
                                key={side}
                                type={shipConfig.landingGearType}
                                extension={extension}
                                compression={compression}
                                side={side as any}
                            />
                        );
                    })}
                </g>
             </svg>
        </div>

        <ShipIcon 
            config={shipConfig} 
            className="w-full h-full drop-shadow-2xl relative z-10" 
            showJets={phase !== 'countdown'} 
            jetType={jetType}
            showGear={false} 
            hullColor={shipColors.hull}
            wingColor={shipColors.wings}
            cockpitColor={shipColors.cockpit}
            gunColor={shipColors.guns}
            secondaryGunColor={shipColors.secondary_guns}
            gunBodyColor={shipColors.gun_body}
            engineColor={shipColors.engines}
            nozzleColor={shipColors.nozzles}
            weaponId={weaponId} 
            equippedWeapons={equippedWeapons}
        />
      </div>
    </div>
  );
};

export default LaunchSequence;
