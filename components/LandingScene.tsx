
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
                    <span className="text-[10px] font-black text-white tabular-nums">{value >= 1000 ? (value/1000).toFixed(1)+'k' : Math.floor(value)}</span>
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
  const [legExtension, setLegExtension] = useState(0); 
  const [suspension, setSuspension] = useState(1); 
  
  const stateRef = useRef({
    startTime: 0,
    starScrollY: 0,
    stars: [] as {x: number, y: number, size: number, alpha: number}[],
    isDay: false, 
    skyGradient: ['#000000', '#000000'],
    environmentDetails: {
        features: [] as { x: number, type: string, h: number, w: number, color: string, windowPattern?: number, scale?: number, variant?: string }[],
        skyObjects: [] as { x: number, y: number, size: number, color: string, type: string, phaseOffset?: number, orbitAngle?: number, orbitSpeed?: number, orbitRadiusX?: number, orbitRadiusY?: number, centerX?: number, centerY?: number, z?: number }[],
        groundColor: '#0f172a',
        terrainType: 'flat'
    },
    particles: [] as {x: number, y: number, vx: number, vy: number, size: number, life: number, maxLife: number, type: string}[],
    shipY: -150,
    shipVy: 0,
    targetY: 0,
    hasThudded: false,
    hasAmbienceStarted: false
  });

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

  const shipConfig = useMemo(() => {
      const match = SHIPS.find((s) => s.shape === shipShape);
      return match || SHIPS[0];
  }, [shipShape]);

  // ENGINE OFFSETS - Updated to use shared util for precision
  const engineOffsets = useMemo(() => {
      const locs = getEngineCoordinates(shipConfig);
      // Map locs (0-100) to offsets from center (50,50)
      return locs.map(l => ({ x: (l.x - 50), y: (l.y + l.h - 50) + 5 })); 
  }, [shipConfig]);

  useEffect(() => {
      const p = planet as Planet;
      const isHabitable = ['#10b981', '#064e3b', '#60a5fa', '#3b82f6'].includes(p.color);
      const isDay = isHabitable && Math.random() > 0.6;
      stateRef.current.isDay = isDay;

      let sunColor = '#facc15'; 
      if (p.quadrant === QuadrantType.BETA) sunColor = '#ef4444';
      if (p.quadrant === QuadrantType.GAMA) sunColor = '#3b82f6';
      if (p.quadrant === QuadrantType.DELTA) sunColor = '#ffffff';

      if (isDay) {
          if (p.quadrant === QuadrantType.BETA) stateRef.current.skyGradient = ['#fecaca', '#b91c1c'];
          else if (p.quadrant === QuadrantType.GAMA) stateRef.current.skyGradient = ['#bfdbfe', '#1e3a8a'];
          else stateRef.current.skyGradient = ['#38bdf8', '#bae6fd'];
      } else if (p.quadrant === QuadrantType.DELTA) {
          stateRef.current.skyGradient = ['#0f172a', '#000000'];
      } else {
          stateRef.current.skyGradient = ['#0f172a', '#020617'];
      }

      const starCount = isDay ? 20 : 150;
      stateRef.current.stars = Array.from({ length: starCount }).map(() => ({ x: Math.random(), y: Math.random(), size: Math.random() * 0.8 + 0.4, alpha: isDay ? 0 : (Math.random() * 0.5 + 0.3) }));

      const skyObjects = [];
      if (isDay) skyObjects.push({ x: 0.8, y: 0.2, size: 60, color: sunColor, type: 'sun', z: 5 });

      if (p.quadrant === QuadrantType.DELTA && !isDay) {
          const bhX = 0.8; const bhY = 0.25;
          skyObjects.push({ x: bhX, y: bhY, size: 50, color: '#000000', type: 'black_hole', z: 10 });
          skyObjects.push({ x: 0, y: 0, size: 6, color: '#ffffff', type: 'white_dwarf', orbitAngle: Math.random() * Math.PI * 2, orbitSpeed: 0.003, orbitRadiusX: 0.35, orbitRadiusY: 0.08, centerX: bhX, centerY: bhY, z: 0 });
      } else if (p.quadrant === QuadrantType.GAMA && !isDay) {
          skyObjects.push({ x: 0.1 + Math.random() * 0.8, y: 0.05 + Math.random() * 0.2, size: 4 + Math.random() * 3, color: '#ffffff', type: 'comet', z: 5 });
      }

      const existingMoons = p.moons || [];
      let moonCount = existingMoons.length;
      if (moonCount === 0 && Math.random() > 0.25 && !isDay) moonCount = 1 + (Math.random() > 0.7 ? 1 : 0);
      const visibleCount = Math.min(moonCount, 3);
      for(let i=0; i<visibleCount; i++) {
          let size = 35 + Math.random() * 25;
          if (i === 1) size *= 0.6; if (i === 2) size *= 0.4;
          let xBase = 0.15 + (i * 0.25);
          if (p.quadrant === QuadrantType.DELTA) xBase = 0.05 + (i * 0.2);
          const mColor = (existingMoons[i] && existingMoons[i].color) || (Math.random() > 0.5 ? '#e2e8f0' : '#94a3b8');
          skyObjects.push({ x: xBase + (Math.random() * 0.05), y: 0.15 + Math.random() * 0.15, size: size, color: mColor, type: 'moon', phaseOffset: (Math.random() * 1.6) - 0.8, z: 20 });
      }
      stateRef.current.environmentDetails.skyObjects = skyObjects;

      const features = [];
      const pColor = p.color || '#94a3b8';
      let biomeType = 'barren'; let groundColor = '#0f172a'; let terrainType = 'flat';

      if (['#10b981', '#064e3b', '#15803d', '#a3e635', '#60a5fa', '#3b82f6'].includes(pColor)) { biomeType = 'nature'; groundColor = pColor.includes('blue') ? '#1e3a8a' : '#064e3b'; terrainType = 'flat'; }
      else if (['#334155', '#64748b', '#475569', '#1e293b'].includes(pColor)) { biomeType = 'urban'; groundColor = '#1e293b'; terrainType = 'flat'; }
      else {
          biomeType = 'barren';
          if (['#ef4444', '#991b1b', '#f97316'].includes(pColor)) { groundColor = '#451a03'; terrainType = 'dunes'; } else { groundColor = '#1c1917'; terrainType = 'mountains'; biomeType = 'industrial'; }
      }
      stateRef.current.environmentDetails.groundColor = groundColor;
      stateRef.current.environmentDetails.terrainType = terrainType;

      // Add Standard Domes randomly
      if (Math.random() > 0.3) features.push({ x: 200, type: 'dome_std', variant: 'radar', scale: 1.0, w:0, h:0, color: '' });
      if (Math.random() > 0.3) features.push({ x: -250, type: 'dome_std', variant: 'hab', scale: 1.2, w:0, h:0, color: '' });
      if (biomeType === 'nature' && Math.random() > 0.5) features.push({ x: 450, type: 'dome_std', variant: 'bio', scale: 0.8, w:0, h:0, color: '' });

      if (biomeType === 'nature' || biomeType === 'urban') {
          const count = 8 + Math.floor(Math.random() * 5);
          for(let i=0; i<count; i++) {
              let xPos = (Math.random() - 0.5) * 800; 
              if (Math.abs(xPos) < 100) xPos = (xPos > 0 ? 100 : -100) + xPos; 
              // Clear Landing Area
              if (Math.abs(xPos) < 600) continue;

              if (biomeType === 'nature') features.push({ x: xPos, type: 'tree', w: 15 + Math.random() * 15, h: 40 + Math.random() * 60, color: Math.random() > 0.5 ? '#065f46' : '#166534' });
              else features.push({ x: xPos, type: 'building', w: 30 + Math.random() * 40, h: 50 + Math.random() * 100, color: '#334155', windowPattern: Math.random() });
          }
      } else {
          const count = 6 + Math.floor(Math.random() * 6);
          for(let i=0; i<count; i++) {
              let xPos = (Math.random() - 0.5) * 900; 
              // Clear Landing Area
              if (Math.abs(xPos) < 600) continue;
              
              const rand = Math.random();
              if (rand < 0.25) features.push({ x: xPos, type: 'crane', w: 40, h: 100 + Math.random() * 50, color: '#facc15' });
              else if (rand < 0.5) features.push({ x: xPos, type: 'container', w: 30, h: 20 + Math.random() * 40, color: Math.random() > 0.5 ? '#dc2626' : '#2563eb' });
              else if (rand < 0.7) features.push({ x: xPos, type: 'junk', w: 30 + Math.random() * 30, h: 15 + Math.random() * 15, color: '#57534e' });
              else { const subType = Math.random() > 0.5 ? 'chimney' : 'tank'; features.push({ x: xPos, type: subType, w: subType === 'tank' ? 40 + Math.random()*30 : 15 + Math.random()*15, h: subType === 'tank' ? 30 + Math.random()*30 : 80 + Math.random()*100, color: '#292524' }); }
          }
      }
      stateRef.current.environmentDetails.features = features.sort((a,b) => a.x - b.x) as any;
      audioService.startLandingThruster();
      return () => { audioService.stopLandingThruster(); };
  }, [planet]);

  useEffect(() => {
      const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
      const dpr = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr; ctx.scale(dpr, dpr);
      let animId: number; stateRef.current.startTime = Date.now();
      const DESCENT_DURATION = 5000; const APPROACH_DURATION = 3000; const TOUCHDOWN_TIME = 8000; const p = planet as Planet; const TOTAL_DURATION = p.quadrant === QuadrantType.DELTA ? 45000 : TOUCHDOWN_TIME + 4000;
      
      const isComplexGear = ['mechanical', 'insect', 'magnetic'].includes(shipConfig.landingGearType);
      
      // Use FULL EXTENDED LENGTH for touchdown calculation to ensure feet hit first
      // Mechanical max extended: 72
      // Simple/Telescopic max extended: ~60 (55 + foot)
      const LEG_OFFSET_FROM_CENTER = isComplexGear ? 72 : 60; 
      
      const MAX_COMPRESSION = 8; 
      const allowShootingStars = (p.quadrant === QuadrantType.ALFA || p.quadrant === QuadrantType.BETA) && !stateRef.current.isDay;

      const loop = () => {
          const now = Date.now(); const elapsed = now - stateRef.current.startTime; const s = stateRef.current;
          const w = rect.width; const h = rect.height; const centerX = w / 2;
          const groundY = h - 80; 
          const padHeight = 20; 
          // Surface is ABOVE groundY by padHeight
          const padSurfaceY = groundY - padHeight;
          
          // TouchY is where ship center must be for feet to touch padSurfaceY
          const touchY = padSurfaceY - LEG_OFFSET_FROM_CENTER;
          
          let currentScale = 1.0; let viewOffset = 0; let thrustIntensity = 0; let legExt = 0; let susp = 1.0; 

          if (elapsed < DESCENT_DURATION) {
              const t = elapsed / DESCENT_DURATION; const ease = 1 - Math.pow(1 - t, 3); const startY = -150; const hoverY = h * 0.3; 
              s.shipY = startY + (hoverY - startY) * ease; currentScale = 0.4 + (ease * 0.6); viewOffset = (1 - ease) * h * 0.5; thrustIntensity = 1.0;
              if (t > 0.5) legExt = Math.min(1, (t - 0.5) * 2.0); 
              setAltitude(Math.floor(5000 * (1 - t))); setSpeed(Math.floor(1200 * (1 - t))); setStatus("DEPLOYING LANDING GEAR");
          } else if (elapsed < TOUCHDOWN_TIME) {
              const t = (elapsed - DESCENT_DURATION) / APPROACH_DURATION; const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
              const startY = h * 0.3; const preLandY = touchY - 80; // Hover closer before drop
              s.shipY = startY + (preLandY - startY) * ease; currentScale = 1.0; thrustIntensity = 0.8 + (Math.sin(elapsed * 0.02) * 0.1); 
              legExt = 1.0; setAltitude(Math.floor(200 * (1 - t))); setSpeed(Math.floor(100 * (1 - t))); setStatus("FINAL DESCENT VECTOR");
          } else {
              legExt = 1.0; currentScale = 1.0;
              if (s.shipVy === 0 && elapsed - TOUCHDOWN_TIME < 100) s.shipVy = 2.0;
              s.shipVy += 0.1; s.shipY += s.shipVy;
              
              if (s.shipY >= touchY) {
                  if (!s.hasThudded) {
                      s.hasThudded = true; audioService.playLandThud();
                      for(let k=0; k<12; k++) { const dir = Math.random() > 0.5 ? 1 : -1; s.particles.push({ x: centerX + dir * (30 + Math.random()*20), y: padSurfaceY, vx: dir * (5 + Math.random() * 10), vy: -1 - Math.random() * 3, size: 10 + Math.random() * 20, life: 1.0, maxLife: 1.0, type: 'dust' }); }
                  }
                  const penetration = s.shipY - touchY; 
                  const k = 0.2; const damping = 0.6; const force = -penetration * k;
                  s.shipVy += force; s.shipVy *= damping; 
                  susp = Math.max(0, 1.0 - (penetration / MAX_COMPRESSION));
                  const maxDepth = MAX_COMPRESSION; if (penetration > maxDepth) { s.shipY = touchY + maxDepth; s.shipVy = 0; susp = 0; }
                  thrustIntensity = 0; 
                  if (Math.abs(s.shipVy) > 0.1) setStatus("CONTACT - STABILIZING"); else if (elapsed < TOUCHDOWN_TIME + 2000) setStatus("ENGINE SHUTDOWN"); else setStatus("SYSTEM STANDBY");
              } else { thrustIntensity = 0.4; susp = 1.0; setStatus("CONTACT IMMINENT"); }
              if (Math.abs(s.shipVy) < 0.05 && elapsed > TOUCHDOWN_TIME + 1500 && !s.hasAmbienceStarted) { s.hasAmbienceStarted = true; setSpeed(0); setAltitude(0); }
              if (elapsed > TOTAL_DURATION) { onComplete(); return; }
          }

          setLegExtension(legExt); setSuspension(susp); audioService.updateLandingThruster(thrustIntensity);
          const renderGroundY = groundY + viewOffset; const renderShipY = s.shipY;

          s.environmentDetails.skyObjects.forEach(obj => { if (obj.type === 'white_dwarf' && obj.centerX !== undefined && obj.orbitAngle !== undefined && obj.orbitSpeed !== undefined) { obj.orbitAngle += obj.orbitSpeed; const cx = obj.centerX * w; const cy = (obj.centerY || 0.25) * h; const rx = (obj.orbitRadiusX || 0.3) * w; const ry = (obj.orbitRadiusY || 0.1) * h; obj.x = (cx + Math.cos(obj.orbitAngle) * rx) / w; obj.y = (cy + Math.sin(obj.orbitAngle) * ry) / h; obj.z = Math.sin(obj.orbitAngle) < 0 ? 5 : 20; } });
          s.environmentDetails.skyObjects.sort((a,b) => (a.z || 0) - (b.z || 0));

          const grad = ctx.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, s.skyGradient[0]); grad.addColorStop(1, s.skyGradient[1]); ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
          if (elapsed < TOUCHDOWN_TIME) s.starScrollY += 0.05;
          if (!s.isDay) { ctx.fillStyle = '#ffffff'; s.stars.forEach(star => { const sy = (star.y * h - s.starScrollY * star.size * 100) % h; ctx.globalAlpha = star.alpha; ctx.beginPath(); ctx.arc(star.x * w, (sy < 0 ? sy + h : sy), star.size, 0, Math.PI*2); ctx.fill(); }); ctx.globalAlpha = 1.0; }

          const skyOffset = viewOffset * 0.1;
          s.environmentDetails.skyObjects.forEach(obj => { const mx = obj.x * w; const my = (obj.y * h) - skyOffset; if (obj.type === 'sun') { ctx.save(); const shine = ctx.createRadialGradient(mx, my, obj.size * 0.5, mx, my, obj.size * 2); shine.addColorStop(0, obj.color); shine.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = shine; ctx.beginPath(); ctx.arc(mx, my, obj.size * 2, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.shadowColor = obj.color; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(mx, my, obj.size * 0.8, 0, Math.PI*2); ctx.fill(); ctx.restore(); } else if (obj.type === 'moon') { ctx.save(); ctx.fillStyle = s.isDay ? 'rgba(255,255,255,0.5)' : 'rgba(20, 20, 30, 0.9)'; ctx.beginPath(); ctx.arc(mx, my, obj.size, 0, Math.PI*2); ctx.fill(); const phase = obj.phaseOffset || 0; ctx.fillStyle = s.isDay ? 'rgba(255,255,255,0.8)' : obj.color; ctx.beginPath(); ctx.arc(mx, my, obj.size, -Math.PI/2, Math.PI/2); ctx.bezierCurveTo(mx + (obj.size * phase * 1.5), my + obj.size, mx + (obj.size * phase * 1.5), my - obj.size, mx, my - obj.size); ctx.fill(); ctx.restore(); } });
          if (allowShootingStars && Math.random() < 0.02) s.particles.push({ x: Math.random() * w, y: Math.random() * (h * 0.4), vx: -15 - Math.random() * 10, vy: 2 + Math.random() * 2, size: 2, life: 0.4, maxLife: 0.4, type: 'shooting_star' });

          if (renderGroundY < h + 200) {
              const horizonGrad = ctx.createLinearGradient(0, renderGroundY - 150, 0, renderGroundY); horizonGrad.addColorStop(0, 'transparent'); horizonGrad.addColorStop(1, s.isDay ? 'rgba(255,255,255,0.4)' : 'rgba(16, 185, 129, 0.08)'); ctx.fillStyle = horizonGrad; ctx.fillRect(0, renderGroundY - 150, w, 150);
              s.environmentDetails.features.forEach(f => { 
                  if (f.type === 'dome_std') {
                      drawDome(ctx, centerX + f.x, renderGroundY, f.scale || 1, f.variant as any);
                  } else {
                      // Legacy feature drawing
                      const fx = centerX + f.x; const fy = renderGroundY;
                      if (f.type === 'tree') { ctx.fillStyle = '#3f2c20'; ctx.fillRect(fx - f.w*0.15, fy - f.h*0.3, f.w*0.3, f.h*0.3); ctx.fillStyle = f.color; ctx.beginPath(); ctx.moveTo(fx - f.w/2, fy - f.h*0.2); ctx.lineTo(fx, fy - f.h); ctx.lineTo(fx + f.w/2, fy - f.h*0.2); ctx.fill(); } 
                      else if (f.type === 'building') { ctx.fillStyle = f.color; ctx.fillRect(fx - f.w/2, fy - f.h, f.w, f.h); ctx.fillStyle = (f.windowPattern || 0) > 0.5 ? '#fef08a' : '#e2e8f0'; for(let r=0; r<f.h-10; r+=12) for(let c=0; c<f.w-8; c+=10) if (Math.sin(r*c + (f.windowPattern||0)) > 0) ctx.fillRect(fx - f.w/2 + 4 + c, fy - f.h + 4 + r, 4, 6); }
                      else if (f.type === 'crane') { ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - f.h); ctx.lineTo(fx + 20, fy - f.h + 20); ctx.stroke(); }
                      else { ctx.fillStyle = f.color; ctx.fillRect(fx - f.w/2, fy - f.h, f.w, f.h); }
                  }
              });
              ctx.fillStyle = s.environmentDetails.groundColor; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, renderGroundY); const segments = 20; const segW = w / segments; for(let i=0; i<=segments; i++) { let x = i * segW; let yOffset = 0; if (x > centerX - 100 && x < centerX + 100) yOffset = 0; else { if (s.environmentDetails.terrainType === 'mountains') yOffset = -Math.abs(Math.sin(i * 132.1)) * 60; else if (s.environmentDetails.terrainType === 'dunes') yOffset = Math.sin(i * 0.5) * 20; else yOffset = Math.random() * 5; } ctx.lineTo(x, renderGroundY + yOffset); } ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
              ctx.fillStyle = s.isDay ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'; ctx.fillRect(0, renderGroundY, w, 4);
              
              // Reuse Platform (at renderGroundY)
              drawPlatform(ctx, centerX, renderGroundY);

              const distToGround = Math.max(0, renderGroundY - 20 - (renderShipY + 100)); if (distToGround < 200) { const shadowAlpha = 1 - (distToGround / 200); const shadowScale = Math.max(0, 1 - (distToGround / 300)); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.globalAlpha = shadowAlpha; ctx.beginPath(); ctx.ellipse(centerX, renderGroundY - 20 + 2, 60 * shadowScale, 15 * shadowScale, 0, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0; }
          }

          if (thrustIntensity > 0.01) { 
              const flicker = 0.9 + Math.random() * 0.2; 
              const rot = s.shipVy * 0.02;
              const cos = Math.cos(rot);
              const sin = Math.sin(rot);

              engineOffsets.forEach(offset => { 
                  const lx = offset.x * currentScale;
                  const ly = offset.y * currentScale;
                  const rx = lx * cos - ly * sin;
                  const ry = lx * sin + ly * cos;
                  const jetX = centerX + rx; 
                  const jetY = renderShipY + ry; 
                  const jetW = (8.5 * currentScale) * thrustIntensity; 
                  const jetL = (120 + Math.random() * 40) * currentScale * thrustIntensity * flicker; 
                  
                  ctx.save();
                  ctx.translate(jetX, jetY);
                  ctx.rotate(rot); 
                  const grad = ctx.createLinearGradient(0, 0, 0, jetL); 
                  grad.addColorStop(0, '#ffffff'); 
                  grad.addColorStop(0.05, '#fef08a'); 
                  grad.addColorStop(0.15, '#ef4444'); 
                  grad.addColorStop(0.5, '#991b1b');  
                  grad.addColorStop(1, 'rgba(153, 27, 27, 0)'); 
                  ctx.fillStyle = grad; 
                  ctx.globalCompositeOperation = 'screen'; 
                  ctx.beginPath(); ctx.moveTo(-jetW/2, 0); ctx.quadraticCurveTo(0, jetL, jetW/2, 0); ctx.fill(); 
                  ctx.restore();
                  
                  ctx.globalCompositeOperation = 'source-over'; 
                  if (Math.random() > 0.2) s.particles.push({ x: jetX, y: jetY + jetL * 0.8, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, size: (5 + Math.random() * 6) * currentScale, life: 0.8, maxLife: 0.8, type: 'smoke' }); 
              }); 
          }
          if (thrustIntensity > 0.5 && renderShipY > renderGroundY - 150) { for(let k=0; k<2; k++) { const offset = (Math.random() - 0.5) * 100; const side = offset > 0 ? 1 : -1; s.particles.push({ x: centerX + offset, y: renderGroundY - 2, vx: side * (5 + Math.random() * 15), vy: -0.5 - Math.random() * 2, size: 20 + Math.random() * 20, life: 1.0, maxLife: 1.0, type: 'dust' }); } }
          for (let i = s.particles.length - 1; i >= 0; i--) { 
              const p = s.particles[i]; 
              p.x += p.vx; p.y += p.vy; 
              if (p.type === 'dust') { 
                  p.life -= 0.002; p.vx *= 0.96; p.size *= 1.002; 
                  const alpha = Math.min(0.2, p.life * 0.2); 
                  ctx.globalAlpha = Math.max(0, alpha); 
                  ctx.fillStyle = s.isDay ? '#cbd5e1' : '#94a3b8'; 
                  ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI*2); ctx.fill(); 
              } else if (p.type === 'smoke') { 
                  p.life -= 0.02; p.vx *= 0.98; p.vy -= 0.05; p.size += 0.2; 
                  ctx.globalAlpha = p.life * 0.4; 
                  ctx.fillStyle = '#64748b'; 
                  ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI*2); ctx.fill(); 
              } else if (p.type === 'shooting_star') {
                  p.life -= 0.01;
              }
              if (p.life <= 0) s.particles.splice(i, 1); 
          } 
          ctx.globalAlpha = 1.0;

          if (shipDOMRef.current) {
              const rot = s.shipVy * 0.02;
              shipDOMRef.current.style.transform = `translate(-50%, -50%) translate(${centerX}px, ${renderShipY}px) scale(${currentScale}) rotate(${rot}rad)`;
          }
          animId = requestAnimationFrame(loop);
      };
      resize(); window.addEventListener('resize', resize); animId = requestAnimationFrame(loop);
      return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); audioService.stopLandingThruster(); };
  }, [planet, shipConfig, engineOffsets, onComplete]);

  const resize = () => { if (canvasRef.current) { const rect = canvasRef.current.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; canvasRef.current.width = rect.width * dpr; canvasRef.current.height = rect.height * dpr; const ctx = canvasRef.current.getContext('2d'); if (ctx) ctx.scale(dpr, dpr); } };

  return (
    <div className="fixed inset-0 z-[5000] bg-black overflow-hidden font-mono select-none">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div ref={shipDOMRef} className="absolute left-0 top-0 will-change-transform" style={{ width: '100px', height: '100px' }}>
          <div className="absolute inset-0 z-0 overflow-visible"> 
                 <svg className="absolute w-full h-full" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
                    <g transform={`translate(50, 50)`}>
                        {['left', 'right'].map((side) => {
                            // Map local state to LandingGear props
                            return (
                                <LandingGear 
                                    key={side}
                                    type={shipConfig.landingGearType}
                                    extension={legExtension}
                                    compression={suspension}
                                    side={side as any}
                                />
                            );
                        })}
                    </g>
                 </svg>
          </div>
          <ShipIcon config={shipConfig} className="w-full h-full drop-shadow-2xl z-10 relative" showJets={false} showGear={false} weaponId={weaponId} equippedWeapons={equippedWeapons} />
      </div>
      
      {/* NEW HUD DASHBOARD */}
      <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-50 pointer-events-none">
          <div className="flex gap-4">
              <Gauge value={altitude} max={30000} label="ALTITUDE" unit="METERS" color="#3b82f6" />
              <Gauge value={speed} max={1500} label="DESCENT" unit="KM/H" color="#facc15" />
              <Gauge value={currentFuel} max={maxFuel} label="FUEL" unit="UNITS" color="#ef4444" />
          </div>
          
          <div className="flex flex-col items-end gap-2">
              <span className={`text-[10px] font-black uppercase tracking-widest ${status.includes('CONTACT') ? 'text-white' : 'text-emerald-400'} animate-pulse`}>STATUS: {status}</span>
              <button 
                  onClick={() => onComplete()} 
                  className="pointer-events-auto bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-white text-[10px] font-black uppercase px-6 py-3 rounded backdrop-blur-sm transition-all flex items-center gap-2"
              >
                  SKIP SEQUENCE <span className="text-[8px] text-zinc-500">space</span>
              </button>
          </div>
      </div>

      <div className="absolute top-0 left-0 right-0 h-12 bg-black z-20" />
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-black z-20 flex items-center justify-center"><span className="text-[9px] text-zinc-600 uppercase tracking-[0.3em] font-black">{planet.name.toUpperCase()} // SECTOR {(planet as Planet).quadrant} // {stateRef.current.isDay ? 'DAY CYCLE' : 'NIGHT CYCLE'}</span></div>
    </div>
  );
};

export default LandingScene;
