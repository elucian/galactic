
// --- LOCKED: LANDING SEQUENCE MODULE ---
// DO NOT REFACTOR OR MODIFY WITHOUT EXPLICIT USER REQUEST
// Visuals, physics, and layout are finalized.

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Planet, Moon, QuadrantType, EquippedWeapon } from '../types.ts';
import { SHIPS } from '../constants.ts';
import { ShipIcon } from './ShipIcon.tsx';
import { audioService } from '../services/audioService.ts';
import { LandingGear } from './LandingGear.tsx';
import { drawDome, drawPlatform, getEngineCoordinates } from '../utils/drawingUtils.ts';

interface LandingSceneProps {
  planet: Planet | Moon;
  shipShape?: string;
  onComplete: () => void;
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
                    <span className="text-[10px] font-black text-white tabular-nums">{value >= 1000 ? (value/1000).toFixed(1)+'k' : (value < 10 ? value.toFixed(1) : Math.floor(value))}</span>
                    <span className="text-[6px] text-zinc-400 font-mono uppercase">{unit}</span>
                </div>
            </div>
            <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">{label}</span>
        </div>
    );
};

const LandingScene: React.FC<LandingSceneProps> = ({ planet, shipShape, onComplete, weaponId, equippedWeapons, currentFuel, maxFuel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shipDOMRef = useRef<HTMLDivElement>(null);
  
  const [status, setStatus] = useState("INITIATING DESCENT");
  const [altitude, setAltitude] = useState(25000);
  const [speed, setSpeed] = useState(1200);
  const [visualFuel, setVisualFuel] = useState(currentFuel); // Local visual fuel state
  const [legExtension, setLegExtension] = useState(0); 
  const [suspension, setSuspension] = useState(1); 
  
  // Landing Cost Constant: 0.3 units
  const LANDING_COST = 0.3;
  // Visual Scale Factor to match LaunchSequence (128px container vs 100 unit SVG)
  const DOM_SCALE = 1.28;

  const shipConfig = useMemo(() => {
      const match = SHIPS.find((s) => s.shape === shipShape);
      return match || SHIPS[0];
  }, [shipShape]);

  // ENGINE OFFSETS
  const engineOffsets = useMemo(() => {
      const locs = getEngineCoordinates(shipConfig);
      return locs.map(l => ({ x: (l.x - 50), y: (l.y + l.h - 50) + 5 })); 
  }, [shipConfig]);

  // ENVIRONMENT CONFIGURATION
  const env = useMemo(() => {
      const p = planet as Planet;
      // Determine Lush vs Barren
      // Lush: Green, Blue, Cyan, Teal
      const lushColors = ['#10b981', '#064e3b', '#60a5fa', '#3b82f6', '#0ea5e9', '#0d9488', '#22c55e', '#15803d'];
      const isLush = lushColors.includes(p.color);
      
      // Determine Day/Night (Random for variety, but consistent for this landing instance)
      const isDay = Math.random() > 0.5;

      // Determine Sun Color based on Quadrant
      let sunColor = '#facc15'; // Default Yellow
      if (p.quadrant === QuadrantType.BETA) sunColor = '#ef4444'; // Red
      if (p.quadrant === QuadrantType.GAMA) sunColor = '#3b82f6'; // Blue
      if (p.quadrant === QuadrantType.DELTA) sunColor = '#a855f7'; // Purple/Black Hole accretion

      // Sky Gradient
      let skyGradient = ['#000000', '#000000'];
      if (isDay) {
          if (p.quadrant === QuadrantType.BETA) skyGradient = ['#7f1d1d', '#fecaca'];
          else if (p.quadrant === QuadrantType.GAMA) skyGradient = ['#1e3a8a', '#bfdbfe'];
          else if (p.quadrant === QuadrantType.DELTA) {
              // Red Sky for Delta Day
              skyGradient = ['#450a0a', '#991b1b']; 
          }
          else skyGradient = ['#0369a1', '#bae6fd']; // Normal Blue Sky
      } else {
          // Night Sky - Dark with slight tint of quadrant
          if (p.quadrant === QuadrantType.BETA) skyGradient = ['#0f172a', '#450a0a'];
          else if (p.quadrant === QuadrantType.GAMA) skyGradient = ['#0f172a', '#172554'];
          else skyGradient = ['#020617', '#0f172a'];
      }

      return { isLush, isDay, sunColor, skyGradient, groundColor: p.color };
  }, [planet]);

  // ANIMATION STATE REF
  const stateRef = useRef({
    startTime: 0,
    starScrollY: 0,
    stars: [] as {x: number, y: number, size: number, alpha: number}[],
    environmentDetails: {
        features: [] as any[],
        cars: [] as any[],
        skyObjects: [] as any[],
    },
    birds: [] as any[],
    particles: [] as {x: number, y: number, vx: number, vy: number, size: number, life: number, maxLife: number, type: string}[],
    shipY: -150,
    shipVy: 0,
    targetY: 0,
    hasThudded: false,
    hasAmbienceStarted: false,
    internalFuel: currentFuel, 
    targetFuel: Math.max(0, currentFuel - LANDING_COST),
    // Dynamic Sky Objects
    redDwarfAngle: 0,
    redDwarfTrail: [] as {x: number, y: number, alpha: number}[],
    comet: null as { x: number, y: number, vx: number, vy: number, length: number } | null
  });

  // AUDIO HANDLING
  useEffect(() => {
      // Start audio immediately on mount
      audioService.startLandingThruster();
      return () => {
          // Only stop on unmount
          audioService.stopLandingThruster();
      };
  }, []); // Empty dependency array ensures it runs once on mount/unmount

  // SKIP HANDLER
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

  // INITIALIZE SCENE OBJECTS
  useEffect(() => {
      const s = stateRef.current;
      const p = planet as Planet;
      
      // 1. STARS - Reduced Size for realism
      const starCount = env.isDay ? 20 : 150;
      s.stars = Array.from({ length: starCount }).map(() => ({ 
          x: Math.random(), 
          y: Math.random(), 
          size: Math.random() * 0.8 + 0.2, // Smaller stars (0.2 to 1.0)
          alpha: env.isDay ? 0.3 : (Math.random() * 0.5 + 0.5) 
      }));

      // 2. SKY OBJECTS (Sun/Moon/Comet)
      const skyObjects = [];
      if (env.isDay) {
          if (p.quadrant === QuadrantType.DELTA) {
              // Special Black Hole object that we'll handle custom rendering for
              skyObjects.push({ 
                  x: 0.8, y: 0.2, size: 40, color: env.sunColor, type: 'black_hole', z: 5 
              });
              s.redDwarfAngle = Math.random() * Math.PI * 2;
          } else {
              // Draw Sun
              skyObjects.push({ 
                  x: 0.8, y: 0.2, size: 40, color: env.sunColor, type: 'sun', z: 5 
              });
          }
      } else {
          // Draw Moons at night
          const moons = p.moons || [];
          const moonCount = Math.max(1, moons.length > 0 ? moons.length : Math.floor(Math.random() * 2) + 1);
          for(let i=0; i<moonCount; i++) {
              skyObjects.push({ 
                  x: 0.15 + (i * 0.25) + Math.random()*0.1, 
                  y: 0.15 + Math.random() * 0.1, 
                  size: 20 + Math.random() * 15, 
                  color: '#e2e8f0', 
                  type: 'moon', 
                  phase: Math.random(),
                  z: 20 
              });
          }
          
          // Gamma Comet Logic
          if (p.quadrant === QuadrantType.GAMA && Math.random() < 0.6) {
              // Sometimes see a comet
              skyObjects.push({ type: 'comet_marker' }); // Just a marker to trigger custom render
              s.comet = {
                  x: Math.random() * 0.4,
                  y: 0.1 + Math.random() * 0.2,
                  vx: 0.00005,
                  vy: 0.00002,
                  length: 60 + Math.random() * 40
              };
          }
      }
      s.environmentDetails.skyObjects = skyObjects;

      // 3. GROUND FEATURES (Decor)
      const features = [];
      const cars = [];
      const isLush = env.isLush;
      
      // Always add some random "Safe Zone" markers far away
      features.push({ x: -500, type: 'tower_light', h: 120, w: 5, color: '#52525b' });
      features.push({ x: 500, type: 'tower_light', h: 120, w: 5, color: '#52525b' });

      if (isLush) {
          // LUSH PLANET: Trees, Buildings, Bio Domes
          // Add a Bio Dome
          if (Math.random() > 0.3) features.push({ x: 350, type: 'dome_std', variant: 'bio', scale: 0.9, w:0, h:0, color: '' });
          
          // Trees & Buildings
          const count = 12;
          for(let i=0; i<count; i++) {
              let xPos = (Math.random() - 0.5) * 1200;
              if (Math.abs(xPos) < 250) continue; // Clear landing pad area
              
              if (Math.random() > 0.4) {
                  features.push({ x: xPos, type: 'tree', w: 20 + Math.random()*20, h: 40 + Math.random()*60, color: Math.random()>0.5 ? '#065f46' : '#166534' });
              } else {
                  // City Buildings with Pre-calculated Windows to prevent flickering
                  const w = 40 + Math.random()*40;
                  const h = 60 + Math.random()*120;
                  const windowData = [];
                  
                  // Pre-generate window positions
                  for(let wy = 5; wy < h; wy += 10) {
                      for(let wx = 5; wx < w; wx += 8) {
                          if (Math.random() > 0.3) windowData.push({ x: wx, y: wy });
                      }
                  }

                  features.push({ 
                      x: xPos, 
                      type: 'building', 
                      w, 
                      h, 
                      color: '#1e293b', 
                      windowData 
                  });
              }
          }

          // Cars on ground
          const carCount = 5;
          for(let i=0; i<carCount; i++) {
              cars.push({
                  x: (Math.random() - 0.5) * 1000,
                  vx: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 2),
                  color: Math.random() > 0.5 ? '#facc15' : '#ef4444',
                  w: 20, h: 8
              });
          }

          // Birds (Daytime Only for Lush planets)
          if (env.isDay) {
              s.birds = Array.from({length: 15}).map(() => ({
                  x: (Math.random() - 0.5) * 2000,
                  y: -Math.random() * 600 - 100, 
                  vx: 1 + Math.random() * 2,
                  vy: (Math.random() - 0.5) * 0.5,
                  wingSpan: 4 + Math.random() * 4,
                  flapSpeed: 0.15 + Math.random() * 0.1,
                  flapOffset: Math.random() * Math.PI
              }));
          } else {
              s.birds = [];
          }

      } else {
          s.birds = []; // Ensure no birds on barren
          // BARREN PLANET: Industrial, Domes, Cranes
          // Add Hab/Radar Domes
          features.push({ x: -300, type: 'dome_std', variant: 'hab', scale: 1.2, w:0, h:0, color: '' });
          if (Math.random() > 0.5) features.push({ x: 400, type: 'dome_std', variant: 'radar', scale: 1.0, w:0, h:0, color: '' });

          // Industrial Decor
          const count = 10;
          for(let i=0; i<count; i++) {
              let xPos = (Math.random() - 0.5) * 1200;
              if (Math.abs(xPos) < 300) continue;

              const rand = Math.random();
              if (rand < 0.3) features.push({ x: xPos, type: 'tank', w: 40 + Math.random()*20, h: 30 + Math.random()*20, color: '#334155' });
              else if (rand < 0.6) features.push({ x: xPos, type: 'crane', w: 30, h: 100 + Math.random()*50, color: '#facc15' });
              else features.push({ x: xPos, type: 'junk', w: 20 + Math.random()*20, h: 15 + Math.random()*15, color: '#57534e' });
          }
      }

      s.environmentDetails.features = features.sort((a,b) => a.x - b.x);
      s.environmentDetails.cars = cars;

  }, [planet, env]);

  // ANIMATION LOOP
  useEffect(() => {
      const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
      const dpr = window.devicePixelRatio || 1; 
      // Force initial resize
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr; 
      ctx.scale(dpr, dpr);

      let animId: number; 
      stateRef.current.startTime = Date.now();
      
      const DESCENT_DURATION = 5000; 
      const APPROACH_DURATION = 3000; 
      const TOUCHDOWN_TIME = 8000; 
      const TOTAL_DURATION = TOUCHDOWN_TIME + 4000;
      
      const isComplexGear = ['mechanical', 'insect', 'magnetic'].includes(shipConfig.landingGearType);
      const LEG_OFFSET_FROM_CENTER = (isComplexGear ? 72 : 60) * DOM_SCALE; 
      const MAX_COMPRESSION = 8; 

      const loop = () => {
          // Re-measure canvas every frame to handle resize gracefully without flicker
          const rect = canvas.getBoundingClientRect();
          const w = rect.width; 
          const h = rect.height;
          // Ensure internal canvas buffer matches display size if it changed
          if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
              canvas.width = w * dpr;
              canvas.height = h * dpr;
              ctx.scale(dpr, dpr);
          }

          const centerX = w / 2;
          const groundY = h - 80; 
          const padHeight = 20; 
          const padSurfaceY = groundY - padHeight;
          const touchY = padSurfaceY - LEG_OFFSET_FROM_CENTER;

          const now = Date.now(); 
          const elapsed = now - stateRef.current.startTime; 
          const s = stateRef.current;

          let currentScale = 1.0; 
          let viewOffset = 0; 
          let thrustIntensity = 0; 
          let legExt = 0; 
          let susp = 1.0; 

          // --- PHYSICS & TIMELINE ---
          if (elapsed < DESCENT_DURATION) {
              const t = elapsed / DESCENT_DURATION; 
              const ease = 1 - Math.pow(1 - t, 3); 
              const startY = -200; 
              const hoverY = h * 0.3; 
              s.shipY = startY + (hoverY - startY) * ease; 
              currentScale = 0.4 + (ease * 0.6); 
              viewOffset = (1 - ease) * h * 0.5; 
              thrustIntensity = 1.0;
              if (t > 0.5) legExt = Math.min(1, (t - 0.5) * 2.0); 
              setAltitude(Math.floor(5000 * (1 - t))); 
              setSpeed(Math.floor(1200 * (1 - t))); 
              setStatus("DEPLOYING LANDING GEAR");
          } else if (elapsed < TOUCHDOWN_TIME) {
              const t = (elapsed - DESCENT_DURATION) / APPROACH_DURATION; 
              const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
              const startY = h * 0.3; 
              const preLandY = touchY - 80; 
              s.shipY = startY + (preLandY - startY) * ease; 
              currentScale = 1.0; 
              thrustIntensity = 0.8 + (Math.sin(elapsed * 0.02) * 0.1); 
              legExt = 1.0; 
              setAltitude(Math.floor(200 * (1 - t))); 
              setSpeed(Math.floor(100 * (1 - t))); 
              setStatus("FINAL DESCENT VECTOR");
          } else {
              legExt = 1.0; currentScale = 1.0;
              if (s.shipVy === 0 && elapsed - TOUCHDOWN_TIME < 100) s.shipVy = 2.0;
              s.shipVy += 0.1; 
              s.shipY += s.shipVy;
              
              if (s.shipY >= touchY) {
                  // TOUCHDOWN
                  if (!s.hasThudded) {
                      s.hasThudded = true; 
                      audioService.playLandThud();
                      // Dust impact
                      for(let k=0; k<15; k++) { 
                          const dir = Math.random() > 0.5 ? 1 : -1; 
                          s.particles.push({ 
                              x: centerX + dir * (30 + Math.random()*20), 
                              y: padSurfaceY, 
                              vx: dir * (5 + Math.random() * 10), 
                              vy: -1 - Math.random() * 3, 
                              size: 10 + Math.random() * 20, 
                              life: 1.0, maxLife: 1.0, type: 'dust' 
                          }); 
                      }
                  }
                  const penetration = s.shipY - touchY; 
                  const k = 0.2; const damping = 0.6; const force = -penetration * k;
                  s.shipVy += force; s.shipVy *= damping; 
                  susp = Math.max(0, 1.0 - (penetration / MAX_COMPRESSION));
                  const maxDepth = MAX_COMPRESSION; 
                  if (penetration > maxDepth) { s.shipY = touchY + maxDepth; s.shipVy = 0; susp = 0; }
                  thrustIntensity = 0; 
                  if (Math.abs(s.shipVy) > 0.1) setStatus("CONTACT - STABILIZING"); 
                  else if (elapsed < TOUCHDOWN_TIME + 2000) setStatus("ENGINE SHUTDOWN"); 
                  else setStatus("SYSTEM STANDBY");
              } else { 
                  thrustIntensity = 0.4; susp = 1.0; setStatus("CONTACT IMMINENT"); 
              }
              if (Math.abs(s.shipVy) < 0.05 && elapsed > TOUCHDOWN_TIME + 1500 && !s.hasAmbienceStarted) { 
                  s.hasAmbienceStarted = true; setSpeed(0); setAltitude(0); 
              }
              if (elapsed > TOTAL_DURATION) { onComplete(); return; }
          }

          // Fuel Update
          if (thrustIntensity > 0 && s.internalFuel > s.targetFuel) {
              s.internalFuel = Math.max(s.targetFuel, s.internalFuel - (0.0005 * thrustIntensity));
          }
          setLegExtension(legExt); setSuspension(susp); audioService.updateLandingThruster(thrustIntensity); setVisualFuel(s.internalFuel);

          const renderGroundY = groundY + viewOffset; 
          const renderShipY = s.shipY;

          // --- DRAWING ---
          
          // Sky
          const grad = ctx.createLinearGradient(0, 0, 0, h); 
          grad.addColorStop(0, env.skyGradient[0]); 
          grad.addColorStop(1, env.skyGradient[1]); 
          ctx.fillStyle = grad; 
          ctx.fillRect(0, 0, w, h);

          // Stars (Night only or faint day) - SLOW MOVING, SMALL
          if (elapsed < TOUCHDOWN_TIME) s.starScrollY += 0.005; // Reduced from 0.05
          ctx.fillStyle = '#ffffff'; 
          s.stars.forEach(star => { 
              const sy = (star.y * h - s.starScrollY * star.size * 50) % h; 
              ctx.globalAlpha = star.alpha; 
              ctx.beginPath(); ctx.arc(star.x * w, (sy < 0 ? sy + h : sy), star.size, 0, Math.PI*2); ctx.fill(); 
          }); 
          ctx.globalAlpha = 1.0;

          // Sky Objects (Sun/Moon/Black Hole/Comet)
          const skyOffset = viewOffset * 0.1;
          s.environmentDetails.skyObjects.forEach(obj => {
              // Custom handling for comet logic update
              if (obj.type === 'comet_marker' && s.comet) {
                  const c = s.comet;
                  c.x += c.vx; c.y += c.vy; // Slow movement
                  const cx = c.x * w; 
                  const cy = (c.y * h) - skyOffset; 
                  
                  // Draw Tail
                  const tailGrad = ctx.createLinearGradient(cx, cy, cx - c.length, cy - (c.length/2));
                  tailGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
                  tailGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                  ctx.fillStyle = tailGrad;
                  ctx.beginPath();
                  ctx.moveTo(cx, cy);
                  ctx.lineTo(cx - c.length, cy - 10);
                  ctx.lineTo(cx - c.length, cy + 10);
                  ctx.fill();

                  // Draw Head
                  ctx.fillStyle = '#fff';
                  ctx.shadowColor = '#a5f3fc'; ctx.shadowBlur = 10;
                  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();
                  ctx.shadowBlur = 0;
                  return;
              }

              const mx = obj.x * w; 
              const my = (obj.y * h) - skyOffset; 
              
              if (obj.type === 'black_hole') {
                  const scale = 1.0;
                  const celX = mx; const celY = my;
                  // Scale dimensions
                  const bhRadius = 50 * scale;
                  const bhCore = 12 * scale;
                  // Removed rings as requested

                  // 1. Draw Jets (Vertical Beams)
                  const jetW = 4 * scale;
                  const jetH = 200 * scale;
                  
                  // Top Jet
                  const jetGradTop = ctx.createLinearGradient(celX, celY, celX, celY - jetH);
                  jetGradTop.addColorStop(0, 'rgba(168, 85, 247, 0.8)');
                  jetGradTop.addColorStop(1, 'rgba(0,0,0,0)');
                  ctx.fillStyle = jetGradTop;
                  ctx.fillRect(celX - jetW/2, celY - jetH, jetW, jetH);
                  
                  // Bottom Jet
                  const jetGradBot = ctx.createLinearGradient(celX, celY, celX, celY + jetH);
                  jetGradBot.addColorStop(0, 'rgba(168, 85, 247, 0.8)');
                  jetGradBot.addColorStop(1, 'rgba(0,0,0,0)');
                  ctx.fillStyle = jetGradBot;
                  ctx.fillRect(celX - jetW/2, celY, jetW, jetH);

                  // 2. Draw Black Hole Core
                  const bhGlow = ctx.createRadialGradient(celX, celY, 10 * scale, celX, celY, bhRadius);
                  bhGlow.addColorStop(0, '#000000');
                  bhGlow.addColorStop(0.4, '#7f1d1d');
                  bhGlow.addColorStop(1, 'rgba(0,0,0,0)');
                  ctx.fillStyle = bhGlow;
                  ctx.beginPath(); ctx.arc(celX, celY, bhRadius, 0, Math.PI*2); ctx.fill();
                  
                  ctx.fillStyle = '#000';
                  ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 15 * scale;
                  ctx.beginPath(); ctx.arc(celX, celY, bhCore, 0, Math.PI*2); ctx.fill();
                  ctx.shadowBlur = 0;

                  // 4. Red Dwarf Companion (Fast Orbiting)
                  s.redDwarfAngle += 0.05; 
                  const wdRx = 100 * scale; 
                  const wdRy = 25 * scale;
                  const wdX = celX + Math.cos(s.redDwarfAngle) * wdRx;
                  const wdY = celY + Math.sin(s.redDwarfAngle) * wdRy;
                  
                  // Trail
                  s.redDwarfTrail.push({x: wdX, y: wdY, alpha: 1.0});
                  if (s.redDwarfTrail.length > 25) s.redDwarfTrail.shift();
                  
                  ctx.lineCap = 'round';
                  s.redDwarfTrail.forEach((tp, i) => {
                      const size = (1 + (i/25)*4) * scale;
                      const alpha = (i/25) * 0.7;
                      ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
                      ctx.beginPath(); ctx.arc(tp.x, tp.y, size, 0, Math.PI*2); ctx.fill();
                  });

                  // Star (Red Dwarf)
                  ctx.fillStyle = '#fca5a5';
                  ctx.shadowColor = '#dc2626'; ctx.shadowBlur = 15 * scale;
                  ctx.beginPath(); ctx.arc(wdX, wdY, 6 * scale, 0, Math.PI*2); ctx.fill();
                  ctx.shadowBlur = 0;

              } else if (obj.type === 'sun') {
                  ctx.save();
                  const shine = ctx.createRadialGradient(mx, my, obj.size * 0.5, mx, my, obj.size * 3);
                  shine.addColorStop(0, obj.color); shine.addColorStop(1, 'rgba(0,0,0,0)');
                  ctx.fillStyle = shine; ctx.beginPath(); ctx.arc(mx, my, obj.size * 3, 0, Math.PI*2); ctx.fill();
                  ctx.fillStyle = '#fff'; ctx.shadowColor = obj.color; ctx.shadowBlur = 40;
                  ctx.beginPath(); ctx.arc(mx, my, obj.size, 0, Math.PI*2); ctx.fill();
                  ctx.restore();
              } else if (obj.type === 'moon') {
                  ctx.save();
                  ctx.fillStyle = '#e2e8f0'; 
                  ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
                  ctx.beginPath(); ctx.arc(mx, my, obj.size, 0, Math.PI*2); ctx.fill();
                  ctx.shadowBlur = 0;
                  // Phase
                  ctx.fillStyle = env.skyGradient[0];
                  const pOff = (obj.phase - 0.5) * 2 * obj.size;
                  ctx.beginPath(); ctx.arc(mx + pOff, my - 2, obj.size, 0, Math.PI*2); ctx.fill();
                  ctx.restore();
              }
          });

          // Ground
          if (renderGroundY < h + 200) {
              const horizonGrad = ctx.createLinearGradient(0, renderGroundY - 150, 0, renderGroundY); 
              horizonGrad.addColorStop(0, 'transparent'); 
              horizonGrad.addColorStop(1, env.isDay ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)'); 
              ctx.fillStyle = horizonGrad; 
              ctx.fillRect(0, renderGroundY - 150, w, 150);

              // Birds (Render Behind Features)
              if (s.birds && s.birds.length > 0) {
                 const birdYBase = renderGroundY - 300; 
                 ctx.strokeStyle = env.isDay ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)';
                 ctx.lineWidth = 1.5;
                 ctx.beginPath();
                 const nowSec = Date.now() / 1000;
                 s.birds.forEach(b => {
                     b.x += b.vx; 
                     if (b.x > w/2 + 500) b.x = -w/2 - 500; 
                     const by = birdYBase + b.y; 
                     const bx = centerX + b.x;
                     const wingY = Math.sin(nowSec * 10 * b.flapSpeed + b.flapOffset) * 5;
                     ctx.moveTo(bx - b.wingSpan, by + wingY);
                     ctx.lineTo(bx, by);
                     ctx.lineTo(bx + b.wingSpan, by + wingY);
                 });
                 ctx.stroke();
              }

              // Features
              s.environmentDetails.features.forEach(f => {
                  if (f.type === 'dome_std') {
                      drawDome(ctx, centerX + f.x, renderGroundY, f.scale || 1, f.variant);
                  } else {
                      const fx = centerX + f.x; const fy = renderGroundY;
                      if (f.type === 'building') {
                          ctx.fillStyle = f.color; 
                          ctx.fillRect(fx - f.w/2, fy - f.h, f.w, f.h);
                          if (f.windowData && f.windowData.length > 0) {
                              ctx.fillStyle = env.isDay ? '#60a5fa' : '#facc15'; // Blue in Day, Yellow in Night
                              f.windowData.forEach((win: any) => {
                                  ctx.fillRect(fx - f.w/2 + win.x, fy - f.h + win.y, 4, 6);
                              });
                          }
                      } else if (f.type === 'tree') {
                          ctx.fillStyle = '#3f2c20'; ctx.fillRect(fx - 2, fy - f.h*0.3, 4, f.h*0.3);
                          ctx.fillStyle = f.color;
                          ctx.beginPath(); ctx.moveTo(fx - f.w/2, fy - f.h*0.2); ctx.lineTo(fx, fy - f.h); ctx.lineTo(fx + f.w/2, fy - f.h*0.2); ctx.fill();
                      } else if (f.type === 'tank') {
                          ctx.fillStyle = f.color;
                          ctx.beginPath(); ctx.arc(fx, fy, f.w/2, Math.PI, 0); ctx.fill();
                      } else if (f.type === 'crane') {
                          ctx.strokeStyle = f.color; ctx.lineWidth = 3;
                          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - f.h); ctx.lineTo(fx + 30, fy - f.h + 20); ctx.stroke();
                      } else if (f.type === 'tower_light') {
                          ctx.fillStyle = f.color; ctx.fillRect(fx - f.w/2, fy - f.h, f.w, f.h);
                          ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(fx, fy - f.h, 4, 0, Math.PI*2); ctx.fill();
                      }
                  }
              });

              // Cars
              s.environmentDetails.cars.forEach(car => {
                  car.x += car.vx;
                  if (Math.abs(car.x) > 600) car.vx *= -1; // Bounce
                  const cx = centerX + car.x;
                  const cy = renderGroundY;
                  ctx.fillStyle = car.color;
                  ctx.fillRect(cx - car.w/2, cy - car.h, car.w, car.h);
                  ctx.fillStyle = '#000'; // Wheels
                  ctx.fillRect(cx - car.w/2 + 2, cy - 2, 4, 2);
                  ctx.fillRect(cx + car.w/2 - 6, cy - 2, 4, 2);
                  // Headlight
                  ctx.fillStyle = '#fff';
                  const hx = car.vx > 0 ? cx + car.w/2 : cx - car.w/2;
                  ctx.fillRect(hx, cy - 6, 2, 2);
              });

              // Ground Plane
              ctx.fillStyle = env.groundColor; 
              ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, renderGroundY); 
              // Simple terrain variation
              for(let i=0; i<=20; i++) { 
                  let x = i * (w/20); 
                  let yOff = 0;
                  if (x < centerX - 100 || x > centerX + 100) yOff = Math.sin(i)*5;
                  ctx.lineTo(x, renderGroundY + yOff); 
              } 
              ctx.lineTo(w, h); ctx.fill();
              
              // Platform
              drawPlatform(ctx, centerX, renderGroundY);
              
              // Shadow
              const distToGround = Math.max(0, renderGroundY - 20 - (renderShipY + 100)); 
              if (distToGround < 200) { 
                  const shadowAlpha = 1 - (distToGround / 200); 
                  const shadowScale = Math.max(0, 1 - (distToGround / 300)); 
                  ctx.fillStyle = 'rgba(0,0,0,0.5)'; 
                  ctx.globalAlpha = shadowAlpha; 
                  ctx.beginPath(); ctx.ellipse(centerX, renderGroundY - 18, 60 * shadowScale, 15 * shadowScale, 0, 0, Math.PI*2); ctx.fill(); 
                  ctx.globalAlpha = 1.0; 
              }
          }

          // --- SHIP DOM UPDATE ---
          if (shipDOMRef.current) {
              const rot = s.shipVy * 0.02;
              shipDOMRef.current.style.transform = `translate(-50%, -50%) translate(${centerX}px, ${renderShipY}px) scale(${currentScale}) rotate(${rot}rad)`;
          }

          // Particles
          if (thrustIntensity > 0.01) {
              const rot = s.shipVy * 0.02;
              const cos = Math.cos(rot); const sin = Math.sin(rot);
              engineOffsets.forEach(offset => {
                  const lx = offset.x * currentScale * DOM_SCALE;
                  const ly = offset.y * currentScale * DOM_SCALE;
                  const rx = lx * cos - ly * sin;
                  const ry = lx * sin + ly * cos;
                  const jetX = centerX + rx; 
                  const jetY = renderShipY + ry; 
                  
                  if (Math.random() > 0.2) {
                      s.particles.push({ 
                          x: jetX, y: jetY + 10, 
                          vx: (Math.random() - 0.5) * 3, 
                          vy: 4 + Math.random() * 4, 
                          size: (5 + Math.random() * 6) * currentScale, 
                          life: 0.8, maxLife: 0.8, type: 'smoke' 
                      });
                  }
                  
                  // Draw Jet Flame directly here for performance
                  const jetL = (80 + Math.random() * 40) * currentScale * thrustIntensity;
                  const jetW = 8 * currentScale * thrustIntensity;
                  ctx.save(); ctx.translate(jetX, jetY); ctx.rotate(rot);
                  const jg = ctx.createLinearGradient(0,0,0,jetL);
                  jg.addColorStop(0, '#fff'); jg.addColorStop(0.3, '#facc15'); jg.addColorStop(1, 'transparent');
                  ctx.fillStyle = jg; ctx.beginPath(); ctx.moveTo(-jetW/2, 0); ctx.quadraticCurveTo(0, jetL, jetW/2, 0); ctx.fill();
                  ctx.restore();
              });
          }

          for (let i = s.particles.length - 1; i >= 0; i--) { 
              const p = s.particles[i]; 
              p.x += p.vx; p.y += p.vy; 
              if (p.type === 'dust') { 
                  p.life -= 0.002; p.vx *= 0.96; p.size *= 1.002; 
                  const alpha = Math.min(0.2, p.life * 0.2); 
                  ctx.globalAlpha = Math.max(0, alpha); 
                  ctx.fillStyle = env.isDay ? '#cbd5e1' : '#94a3b8'; 
                  ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI*2); ctx.fill(); 
              } else if (p.type === 'smoke') { 
                  p.life -= 0.02; p.vx *= 0.98; p.vy -= 0.05; p.size += 0.2; 
                  ctx.globalAlpha = p.life * 0.4; 
                  ctx.fillStyle = '#64748b'; 
                  ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI*2); ctx.fill(); 
              }
              if (p.life <= 0) s.particles.splice(i, 1); 
          } 
          ctx.globalAlpha = 1.0;

          animId = requestAnimationFrame(loop);
      };
      
      animId = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(animId);
  }, [shipConfig, env]);

  return (
    <div className="fixed inset-0 z-[5000] bg-black overflow-hidden font-mono select-none">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* Ship Container - ensure high Z-Index and correct centering origin */}
      <div 
          ref={shipDOMRef} 
          className="absolute left-0 top-0 will-change-transform z-30" 
          style={{ width: '128px', height: '128px' }}
      >
          <div className="absolute inset-0 z-0 overflow-visible"> 
                 <svg className="absolute w-full h-full" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
                    <g transform={`translate(50, 50)`}>
                        {['left', 'right'].map((side) => (
                            <LandingGear 
                                key={side}
                                type={shipConfig.landingGearType}
                                extension={legExtension}
                                compression={suspension}
                                side={side as any}
                            />
                        ))}
                    </g>
                 </svg>
          </div>
          <ShipIcon 
              config={shipConfig} 
              className="w-full h-full drop-shadow-2xl z-10 relative" 
              showJets={false} 
              showGear={false} 
              weaponId={weaponId} 
              equippedWeapons={equippedWeapons} 
          />
      </div>
      
      {/* HUD - Redesigned for Mobile Verticality */}
      <div className="absolute top-4 left-4 right-4 md:top-8 md:left-8 md:right-8 flex flex-row-reverse md:flex-row justify-between items-start z-50 pointer-events-none">
          
          {/* RIGHT SIDE (Mobile) / LEFT SIDE (Desktop) */}
          <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-end md:items-center">
              <Gauge value={altitude} max={30000} label="ALTITUDE" unit="METERS" color="#3b82f6" />
              <Gauge value={speed} max={1500} label="DESCENT" unit="KM/H" color="#facc15" />
              <Gauge value={visualFuel} max={maxFuel} label="FUEL" unit="UNITS" color="#ef4444" />
          </div>
          
          {/* LEFT SIDE (Mobile) / RIGHT SIDE (Desktop) */}
          <div className="flex flex-col items-start md:items-end gap-2 mt-0">
              <span className={`text-[10px] font-black uppercase tracking-widest ${status.includes('CONTACT') ? 'text-white' : 'text-emerald-400'} animate-pulse`}>STATUS: {status}</span>
              <button 
                  onClick={() => onComplete()} 
                  className="pointer-events-auto bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-white text-[10px] font-black uppercase px-4 py-3 md:px-6 md:py-3 rounded backdrop-blur-sm transition-all flex items-center gap-2 shadow-lg active:scale-95"
              >
                  SKIP SEQUENCE <span className="text-[8px] text-zinc-500 hidden sm:inline">space</span>
              </button>
          </div>
      </div>

      <div className="absolute top-0 left-0 right-0 h-12 bg-black z-20" />
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-black z-20 flex items-center justify-center">
          <span className="text-[9px] text-zinc-600 uppercase tracking-[0.3em] font-black">
              {planet.name.toUpperCase()} // SECTOR {(planet as Planet).quadrant} // {env.isDay ? 'DAY CYCLE' : 'NIGHT CYCLE'}
          </span>
      </div>
    </div>
  );
};

export default LandingScene;
