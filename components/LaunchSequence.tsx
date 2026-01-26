
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Planet, Moon, QuadrantType, EquippedWeapon } from '../types.ts';
import { ExtendedShipConfig } from '../constants.ts';
import { ShipIcon } from './ShipIcon.tsx';
import { audioService } from '../services/audioService.ts';
import { LandingGear } from './LandingGear.tsx';
import { getEngineCoordinates, generatePlanetEnvironment, drawCloud, drawVehicle, drawStreetLight, drawPlatform, drawTower, drawDome, drawBuilding, drawPowerPlant, drawBoulder } from '../utils/drawingUtils.ts';
import { SequenceStatusBar } from './SequenceStatusBar.tsx';

// Helper for color mixing
const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
};

const mixColor = (c1: string, c2: string, weight: number) => {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    const w = Math.min(1, Math.max(0, weight));
    const r = Math.round(rgb1.r * (1 - w) + rgb2.r * w);
    const g = Math.round(rgb1.g * (1 - w) + rgb2.g * w);
    const b = Math.round(rgb1.b * (1 - w) + rgb2.b * w);
    return `rgb(${r},${g},${b})`;
};

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

const LaunchSequence: React.FC<LaunchSequenceProps> = ({ planet, shipConfig, shipColors, onComplete, testMode, weaponId, equippedWeapons, currentFuel, maxFuel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shipDOMRef = useRef<HTMLDivElement>(null);
  
  const [phase, setPhase] = useState<'countdown' | 'ignition' | 'lift' | 'atmosphere' | 'orbit'>('countdown');
  const phaseRef = useRef(phase); 

  const [statusText, setStatusText] = useState("SYSTEM CHECK");
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const [altitude, setAltitude] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const [visualFuel, setVisualFuel] = useState(currentFuel);
  const [legExtension, setLegExtension] = useState(1); 
  const [suspension, setSuspension] = useState(0.8); // 0.8 = Resting weight
  const [thrustActive, setThrustActive] = useState(false);
  const [activeJetType, setActiveJetType] = useState<'combustion' | 'ion'>('combustion');

  const DOM_SCALE = 1.28;

  const engineLocs = useMemo(() => getEngineCoordinates(shipConfig), [shipConfig]);
  
  const env = useMemo(() => generatePlanetEnvironment(planet as Planet), [planet]);

  const stateRef = useRef({
    startTime: 0,
    frameCount: 0,
    orbitFrameCount: 0, 
    viewY: 0, 
    shipY: 0, 
    shipVy: 0, 
    worldSpeed: 0, 
    shake: 0,
    internalFuel: currentFuel, 
    targetFuel: Math.max(0, currentFuel - 1.0),
    particles: [] as {x: number, y: number, vx: number, vy: number, size: number, life: number, maxLife: number, type: string, color?: string, decay?: number, grow?: number, initialAlpha?: number}[],
    birds: [] as any[], // FIXED: Initialized birds array
    starScrollY: 0,
    celestialX: 0.7,
    celestialY: -0.2, 
    sunTargetY: 0.15,
    armRetract: 0, 
    suspension: 0.8,
    legExtension: 1.0
  });

  useEffect(() => {
      phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
      const s = stateRef.current;
      const rng = () => Math.random();
      const p = planet as Planet;
      const hasMoons = p.moons && p.moons.length > 0;
      s.celestialX = 0.2 + rng() * 0.6;
      if (env.isDay) {
          s.celestialY = 0.15 + rng() * 0.1;
      } else {
          s.celestialY = hasMoons ? 0.15 + rng() * 0.1 : -999;
      }

      // Initialize Birds
      s.birds = [];
      if (env.powerLines && env.powerLines.length > 0) {
          const numBirds = 12 + Math.floor(Math.random() * 8); 
          const chain = env.powerLines[0]; 
          // Safety check for chain content
          if (chain && chain.length > 0) {
              const minX = Math.min(chain[0].x, chain[chain.length-1].x);
              const maxX = Math.max(chain[0].x, chain[chain.length-1].x);
              for(let i=0; i<numBirds; i++) {
                  const birdX = minX + (Math.random() * (maxX - minX));
                  s.birds.push({ x: birdX, y: -100, vx: 0, vy: 0, state: 'sit', visible: true, flapSpeed: 0.2 + Math.random() * 0.1, timer: Math.random() * 100 });
              }
          }
      }
  }, [env, planet]);

  useEffect(() => {
      // STOP MUSIC ON MOUNT
      audioService.stop();

      const handleKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); onComplete(); }};
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onComplete]);

  useEffect(() => {
      const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
      
      const resize = () => {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();
          canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
          ctx.scale(dpr, dpr);
      };
      resize();
      window.addEventListener('resize', resize);

      const s = stateRef.current;
      let raf: number;
      let t0: any, t1: any, t2: any, t3: any, t4: any, t5: any, t6: any, t7: any, t8: any;

      // 1. Initial Silence (2s)
      t0 = setTimeout(() => {
          // Count 3
          setCountdown(3); 
          audioService.playCountdownBeep(false);
          
          t1 = setTimeout(() => {
              // Count 2
              setCountdown(2); 
              audioService.playCountdownBeep(false);
              
              t2 = setTimeout(() => {
                  // Count 1
                  setCountdown(1); 
                  audioService.playCountdownBeep(false);
                  
                  t3 = setTimeout(() => {
                      // Ignition (0)
                      setCountdown(0);
                      setPhase('ignition'); 
                      setStatusText("IGNITION");
                      audioService.playCountdownBeep(true); // GO sound
                      
                      // 0.3s Delay for Engine Start
                      t4 = setTimeout(() => {
                          audioService.playLaunchBang();
                          // audioService.playLaunchRoar(); // REMOVED - Sequence now handles sustained roar
                          audioService.playLaunchSequence(); // Continuous loop
                          
                          // Proceed to Lift after engine stabilizes
                          t5 = setTimeout(() => {
                              setPhase('lift'); setStatusText("LIFT OFF");
                              
                              t6 = setTimeout(() => {
                                  setPhase('atmosphere'); setStatusText("MAX Q");
                                  
                                  t7 = setTimeout(() => {
                                      setPhase('orbit'); 
                                      setStatusText("ORBIT INSERTION");
                                      audioService.stopLaunchSequence(); // Stop engine
                                      audioService.playOrbitLatch(); // Pac sound
                                      
                                      t8 = setTimeout(onComplete, 4000);
                                  }, 5000);
                              }, 4000); 
                          }, 2000);
                      }, 300);
                      
                  }, 1000);
              }, 1000);
          }, 1000);
      }, 2000);

      const loop = () => {
          const dpr = window.devicePixelRatio || 1;
          const w = canvas.width / dpr;
          const h = canvas.height / dpr;
          const cx = w / 2;
          const currentPhase = phaseRef.current; 
          
          s.frameCount++;
          const groundY = h - 90;
          const padHeight = 20;
          const padSurfaceY = groundY - padHeight;
          const isComplexGear = ['mechanical', 'insect', 'magnetic'].includes(shipConfig.landingGearType);
          const svgLegHeight = isComplexGear ? 72 : 60; 
          const pixelLegHeight = svgLegHeight * DOM_SCALE;
          
          const uncompressedShipY = padSurfaceY - (pixelLegHeight - 4);
          const compressionPixels = 15 * DOM_SCALE;

          const isSpace = s.viewY > 3000;
          const dynamicJetType = (isSpace || currentPhase === 'orbit') ? 'ion' : 'combustion';
          setActiveJetType(dynamicJetType);

          if (currentPhase === 'countdown') {
              s.suspension = 0.8;
              s.legExtension = 1;
              s.shipY = uncompressedShipY + (1 - s.suspension) * compressionPixels;
              setThrustActive(false);
              s.armRetract = 0; 
          }
          else if (currentPhase === 'ignition') {
              s.suspension = Math.min(1, s.suspension + 0.01); 
              s.legExtension = 1;
              const targetY = uncompressedShipY + (1 - s.suspension) * compressionPixels;
              s.shipY = targetY + (Math.random() - 0.5) * 2; 
              s.shake = (Math.random() - 0.5) * 4;
              if (s.internalFuel > s.targetFuel) s.internalFuel -= 0.001;
              
              // Only show jets if engine start delay has passed (300ms = ~18 frames at 60fps)
              // But audio triggers via timeout, so we can just check frame count since phase change?
              // Simpler: thrust active is controlled by state, but since we are inside loop, we'll assume active if phase is ignition
              // Actually, thrust should visually match audio. 
              // The timeout t4 fires 300ms after phase becomes ignition.
              // We can't easily sync React state inside loop perfectly without refs or timestamps.
              // Approximation: 300ms delay visual thrust?
              setThrustActive(true); 
              s.armRetract = 0; 
          }
          else if (currentPhase === 'lift') {
              if (s.armRetract < 1) {
                  s.armRetract += 0.04; 
                  s.shipY = uncompressedShipY + (Math.random() - 0.5) * 2; 
              } else {
                  s.armRetract = 1;
                  const targetScreenY = h * 0.4;
                  if (s.shipY > targetScreenY) {
                      s.shipVy += 0.05; 
                      s.shipY -= s.shipVy;
                  } else {
                      s.shipY = targetScreenY;
                      s.worldSpeed += 0.15;
                      s.viewY += s.worldSpeed; 
                  }
                  
                  const liftHeight = uncompressedShipY - s.shipY;
                  if (liftHeight > 20) {
                      s.legExtension = Math.max(0, s.legExtension - 0.02);
                  }
              }
              
              s.suspension = 1.0; 
              s.shake = (Math.random() - 0.5) * 6;
              if (s.internalFuel > s.targetFuel) s.internalFuel -= 0.003;
          }
          else if (currentPhase === 'atmosphere') {
              s.worldSpeed += 0.5;
              s.viewY += s.worldSpeed;
              s.shake = (Math.random() - 0.5) * 8;
              s.legExtension = 0;
              s.armRetract = 1;
          }
          else if (currentPhase === 'orbit') {
              s.orbitFrameCount++;
              s.worldSpeed += 1.0;
              s.viewY += s.worldSpeed;
              s.shipY -= 0.5; 
              s.shake = (Math.random() - 0.5) * 2;
              setThrustActive(false); // Cut engines
              if (s.internalFuel > s.targetFuel) s.internalFuel = s.targetFuel;
          }

          setAltitude(Math.floor(s.viewY + (uncompressedShipY - s.shipY)));
          setVelocity(Math.floor(s.worldSpeed * 100 + s.shipVy * 50));
          setVisualFuel(s.internalFuel);
          setLegExtension(s.legExtension);
          setSuspension(s.suspension);

          // DRAWING
          const spaceTransitionHeight = 15000;
          const spaceRatio = Math.min(1, s.viewY / spaceTransitionHeight); 
          
          const sky1 = mixColor(env.skyGradient[0], '#000000', spaceRatio);
          const sky2 = mixColor(env.skyGradient[1], '#000000', spaceRatio);
          
          const grad = ctx.createLinearGradient(0, 0, 0, h); 
          grad.addColorStop(0, sky1); 
          grad.addColorStop(1, sky2); 
          ctx.fillStyle = grad; 
          ctx.fillRect(0, 0, w, h);

          // STAR VISIBILITY FIX
          const baseStarVis = (!env.isDay ? 0.8 : 0);
          const starVis = Math.max(baseStarVis, Math.min(1, baseStarVis + (spaceRatio * 1.5)));
          
          if (starVis > 0) { 
              ctx.fillStyle = '#fff'; 
              s.starScrollY += 0.002;
              env.stars.forEach(st => { 
                  ctx.globalAlpha = st.alpha * starVis; 
                  const sy = (st.y * h + s.viewY * 0.05) % h; 
                  ctx.beginPath(); 
                  ctx.arc(st.x * w, sy, st.size, 0, Math.PI*2); 
                  ctx.fill(); 
              }); 
              ctx.globalAlpha = 1; 
          }

          const celParallax = s.viewY * 0.006; 
          const celX = s.celestialX * w; 
          const celY = (s.celestialY * h) + celParallax;
          const celScale = 1 + (spaceRatio * 0.2); 
          let dimFactor = 0;

          // DELTA QUADRANT SPECIAL: Black Hole + Red Dwarf
          if (env.quadrant === QuadrantType.DELTA) {
              const time = Date.now();
              const jetCycle = time % 20000;
              let jetAlpha = 0;
              if (jetCycle < 10000) {
                  if (jetCycle < 1000) jetAlpha = jetCycle / 1000; 
                  else if (jetCycle > 9000) jetAlpha = (10000 - jetCycle) / 1000; 
                  else jetAlpha = 1;
              }

              const slowTime = time * 0.00025; 
              const dwarfDist = 120 * celScale;
              const dwarfX = celX + Math.cos(slowTime) * dwarfDist;
              const dwarfY = celY + Math.sin(slowTime * 0.5) * 40; 
              const dwarfR = 15 * celScale * 0.7; 
              const zDepth = Math.sin(slowTime);
              const isBehind = zDepth < 0;
              if (isBehind) dimFactor = Math.min(0.7, Math.abs(zDepth) * 0.9);

              const drawDwarf = () => {
                  ctx.fillStyle = '#ef4444';
                  ctx.shadowColor = '#ef4444';
                  ctx.shadowBlur = 20;
                  ctx.beginPath(); ctx.arc(dwarfX, dwarfY, dwarfR, 0, Math.PI*2); ctx.fill();
                  ctx.shadowBlur = 0;
              };

              const drawBlackHole = () => {
                  const bhRadius = 40 * celScale;
                  const bhGrad = ctx.createRadialGradient(celX, celY, bhRadius*0.8, celX, celY, bhRadius*2.5);
                  bhGrad.addColorStop(0, '#000000');
                  bhGrad.addColorStop(0.4, '#4c1d95'); 
                  bhGrad.addColorStop(0.6, '#a855f7'); 
                  bhGrad.addColorStop(1, 'rgba(0,0,0,0)');
                  ctx.fillStyle = bhGrad;
                  ctx.beginPath(); ctx.arc(celX, celY, bhRadius*2.5, 0, Math.PI*2); ctx.fill();
                  
                  ctx.fillStyle = '#000000';
                  ctx.shadowColor = '#fff';
                  ctx.shadowBlur = 10;
                  ctx.beginPath(); ctx.arc(celX, celY, bhRadius, 0, Math.PI*2); ctx.fill();
                  ctx.shadowBlur = 0;

                  if (jetAlpha > 0) {
                      ctx.save();
                      ctx.globalAlpha = jetAlpha;
                      ctx.fillStyle = 'rgba(255,255,255,0.5)';
                      ctx.beginPath();
                      ctx.moveTo(celX - 3, celY - bhRadius);
                      ctx.lineTo(celX + 3, celY - bhRadius);
                      ctx.lineTo(celX, celY - 1000); 
                      ctx.fill();
                      ctx.beginPath();
                      ctx.moveTo(celX - 3, celY + bhRadius);
                      ctx.lineTo(celX + 3, celY + bhRadius);
                      ctx.lineTo(celX, celY + 1000); 
                      ctx.fill();
                      ctx.restore();
                  }
              };

              if (isBehind) { drawDwarf(); drawBlackHole(); } else { drawBlackHole(); drawDwarf(); }

          } else {
              if (s.celestialY > -100 && env.isDay) { 
                  const sunR = 30 * celScale; 
                  const sGrad = ctx.createRadialGradient(celX, celY, sunR*0.2, celX, celY, sunR*2.5); 
                  sGrad.addColorStop(0, env.sunColor); sGrad.addColorStop(1, 'rgba(0,0,0,0)'); 
                  ctx.fillStyle = sGrad; ctx.beginPath(); ctx.arc(celX, celY, sunR*2.5, 0, Math.PI*2); ctx.fill();
                  ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(celX, celY, sunR*0.7, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
              }
              if (!env.isDay && s.celestialY > -100) {
                   const moonR = 25 * celScale;
                   ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(celX, celY, moonR, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
              }
          }

          if (env.clouds && env.clouds.length > 0 && spaceRatio < 0.9) {
              env.clouds.forEach(c => {
                  const cloudY = (c.y + s.viewY * 0.5) % (h + 400) - 200;
                  const cloudX = (c.x + s.frameCount * c.speed) % (w + 400) - 200;
                  if (cloudY < h + 200 && cloudY > -200) {
                      drawCloud(ctx, cloudX, cloudY, c.w, c.alpha * (1 - spaceRatio), c.color);
                  }
              });
          }

          const worldY = groundY + s.viewY + s.shake;
          if (worldY < h + 2000) { 
              ctx.save();
              ctx.translate(cx, worldY);
              
              if (env.hills && env.hills.length > 0) {
                  env.hills.forEach((hill: any, i: number) => {
                      const pFactor = hill.parallaxFactor;
                      const yOff = (s.viewY * (1 - pFactor)); 
                      ctx.fillStyle = hill.color;
                      ctx.beginPath();
                      ctx.moveTo(-w, h); 
                      
                      const pathPoints: {x:number, y:number}[] = [];

                      hill.points.forEach((p: any, idx: number) => {
                          const px = (p.xRatio * 3000) - 1500;
                          const py = -(p.heightRatio * 300) - yOff;
                          if (idx === 0) ctx.lineTo(px, 1000); 
                          ctx.lineTo(px, py);
                          if (hill.hasRoad) pathPoints.push({x: px, y: py});
                      });
                      ctx.lineTo(1500, 1000);
                      ctx.fill();

                      // DRAW ROAD LOGIC (Layer 4 usually)
                      if (hill.hasRoad && pathPoints.length > 0) {
                          ctx.beginPath();
                          pathPoints.forEach((p, idx) => { if(idx===0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
                          ctx.strokeStyle = '#333'; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.stroke();
                          ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);

                          if (env.cars && env.cars.length > 0) {
                              env.cars.forEach(car => {
                                  car.progress += car.speed * (car.dir || 1);
                                  if (car.progress > 1) car.progress -= 1;
                                  if (car.progress < 0) car.progress += 1;

                                  const trackLen = pathPoints.length - 1;
                                  const exactIdx = car.progress * trackLen;
                                  const idx = Math.floor(exactIdx);
                                  const sub = exactIdx - idx;
                                  const p1 = pathPoints[idx];
                                  const p2 = pathPoints[Math.min(idx + 1, trackLen)];
                                  
                                  if (p1 && p2) {
                                      const vx = p1.x + (p2.x - p1.x) * sub;
                                      const vy = p1.y + (p2.y - p1.y) * sub;
                                      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                                      if (car.type === 'train') {
                                          for(let k=0; k<car.cars; k++) {
                                              const tProg = car.progress - (k * 0.015);
                                              if (tProg >= 0 && tProg <= 1) {
                                                  const tIdx = Math.floor(tProg * trackLen);
                                                  const tSub = (tProg * trackLen) - tIdx;
                                                  const tp1 = pathPoints[tIdx];
                                                  const tp2 = pathPoints[Math.min(tIdx + 1, trackLen)];
                                                  if (tp1 && tp2) {
                                                      const tx = tp1.x + (tp2.x - tp1.x) * tSub;
                                                      const ty = tp1.y + (tp2.y - tp1.y) * tSub;
                                                      const ta = Math.atan2(tp2.y - tp1.y, tp2.x - tp1.x);
                                                      drawVehicle(ctx, tx, ty - 6, ta, k===0 ? 'train' : 'car', car.color, env.isDay, car.dir);
                                                  }
                                              }
                                          }
                                      } else {
                                          drawVehicle(ctx, vx, vy - 4, angle, 'car', car.color, env.isDay, car.dir);
                                      }
                                  }
                              });
                          }
                          if (env.streetLights) {
                              env.streetLights.forEach(sl => {
                                  const ratio = (sl.x + 1500) / 3000;
                                  if (ratio >= 0 && ratio <= 1) {
                                      const idx = Math.floor(ratio * (pathPoints.length - 1));
                                      const p = pathPoints[idx];
                                      if (p) drawStreetLight(ctx, p.x, p.y, sl.h, env.isDay);
                                  }
                              });
                          }
                      }

                      // DRAW TREES & FEATURES (After Road = On Top)
                      if (hill.trees) {
                          hill.trees.forEach((t: any, tIdx: number) => {
                              const p1 = hill.points[t.segIdx]; const p2 = hill.points[t.segIdx+1];
                              if (p1 && p2) {
                                  const x1 = p1.xRatio * 3000 - 1500; 
                                  const y1 = - (p1.heightRatio * 300) - yOff; 
                                  const x2 = p2.xRatio * 3000 - 1500; 
                                  const y2 = - (p2.heightRatio * 300) - yOff;
                                  const tx = x1 + (x2 - x1) * t.offset; 
                                  let ty = y1 + (y2 - y1) * t.offset;
                                  
                                  // Offset trees to sides of road
                                  if (hill.hasRoad) {
                                      const side = tIdx % 2 === 0 ? 1 : -1;
                                      ty += side * 25;
                                  }
                                  
                                  drawBuilding(ctx, { x: tx, y: ty, type: t.type === 'pine' ? 'tree' : 'palm', w: t.w, h: t.h, color: t.color, trunkColor: '#78350f' }, env.isDay, false);
                              }
                          });
                      }
                      if (hill.cityBuildings) {
                          hill.cityBuildings.forEach((b: any) => {
                              const bx = (b.xRatio * 3000) - 1500; const by = -(b.yBase * 300) - yOff;
                              drawBuilding(ctx, { x: bx, y: by, type: 'building_std', w: b.w, h: b.h, color: b.color }, env.isDay, false);
                          });
                      }
                  });
              }

              ctx.fillStyle = env.groundColor;
              ctx.fillRect(-w, 0, w*2, h*2); 
              drawPlatform(ctx, 0, 0, env.isOcean);
              
              if (env.powerLines && env.powerLines.length > 0) {
                  const chain = env.powerLines[0];
                  if (chain && chain.length > 0) {
                      const minX = Math.min(chain[0].x, chain[chain.length-1].x);
                      const maxX = Math.max(chain[0].x, chain[chain.length-1].x);

                      ctx.strokeStyle = '#18181b'; ctx.lineWidth = 1;
                      env.powerLines.forEach((chain: any[]) => {
                          for (let k=0; k<chain.length-1; k++) {
                              const p1 = chain[k]; const p2 = chain[k+1];
                              const y1 = -p1.h + p1.yOff;
                              const y2 = -p2.h + p2.yOff;
                              for(let wIdx=0; wIdx<3; wIdx++) {
                                  const sag = 15 + (wIdx * 5);
                                  const midX = (p1.x + p2.x) / 2;
                                  const midY = Math.max(y1, y2) + sag;
                                  ctx.beginPath();
                                  ctx.moveTo(p1.x, y1 + (wIdx * 4));
                                  ctx.quadraticCurveTo(midX, midY + (wIdx * 4), p2.x, y2 + (wIdx * 4));
                                  ctx.stroke();
                                  if (wIdx === 0 && k === 0 && s.birds) {
                                      if (thrustActive) {
                                          s.birds.forEach(b => {
                                              if (b.state === 'sit') {
                                                  b.state = 'fly';
                                                  b.vx = (Math.random()-0.5) * 15; 
                                                  b.vy = -5 - Math.random() * 8; 
                                                  b.visible = true;
                                              }
                                          });
                                      }
                                      s.birds.forEach(b => {
                                          if (b.visible === false) return;
                                          if (b.state === 'fly') {
                                              b.x += b.vx; b.y += b.vy;
                                              if (b.x < minX - 200 || b.x > maxX + 200 || b.y < -500) b.visible = false;
                                              const wingY = Math.sin(Date.now() * 0.05) * 3; 
                                              ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(b.x - 3, b.y + y1 + wingY); ctx.lineTo(b.x, b.y + y1); ctx.lineTo(b.x + 3, b.y + y1 + wingY); ctx.stroke();
                                          } else {
                                              const t = (b.x - p1.x) / (p2.x - p1.x);
                                              if (t >= 0 && t <= 1) {
                                                  const curveY = (1-t)*(1-t)*y1 + 2*(1-t)*t*midY + t*t*y2;
                                                  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(b.x, curveY - 2, 2, 0, Math.PI*2); ctx.fill(); b.y = curveY - 2;
                                              }
                                          }
                                      });
                                  }
                              }
                          }
                      });
                  }
              }

              if (env.features) {
                  env.features.forEach(f => {
                      const fy = f.yOff || 0; 
                      if (f.type === 'power_plant' && !f.isUnderground) {
                          if (Math.random() > 0.8) {
                              s.particles.push({ x: f.x + 40, y: fy - 80, vx: (Math.random()-0.5)*1, vy: -1 - Math.random()*1, life: 1.0, maxLife: 1.0, size: 5 + Math.random()*5, color: 'rgba(255,255,255,0.1)', type: 'steam' });
                          }
                      }
                      if (f.type === 'tower') { drawTower(ctx, f.x, fy, f, env.isDay, env.isOcean, s.armRetract); } 
                      else if (f.type === 'power_pole') { ctx.fillStyle = '#71717a'; ctx.fillRect(f.x - 2, fy - f.h, 4, f.h); ctx.fillRect(f.x - 20, fy - f.h + 10, 40, 4); ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(f.x - 18, fy - f.h + 8, 3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(f.x + 18, fy - f.h + 8, 3, 0, Math.PI*2); ctx.fill(); }
                      else if (f.type === 'dome_std') drawDome(ctx, f.x, fy, f, !!env.isOcean);
                      else if (f.type === 'building_std' || f.type === 'church' || f.type === 'water_tower' || f.type === 'bridge' || f.type === 'rock_formation' || f.type === 'tree' || f.type === 'palm' || f.type === 'road_tree' || f.type === 'cactus' || f.type === 'puddle') drawBuilding(ctx, { ...f, y: fy }, env.isDay, env.isOcean);
                      else if (f.type === 'power_plant') drawPowerPlant(ctx, f.x, fy, f.scale, f.isUnderground);
                      else if (f.type === 'tank') { ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, fy, f.w/2, Math.PI, 0); ctx.fill(); }
                  });
              }
              if (env.boulders) {
                  env.boulders.forEach(b => drawBoulder(ctx, b.x, 0, b.size, b.color));
              }
              ctx.restore();
          }

          if (dimFactor > 0) {
              ctx.fillStyle = `rgba(0,0,0,${dimFactor})`;
              ctx.fillRect(0, 0, w, h);
          }

          if (currentPhase === 'ignition' || currentPhase === 'lift' || currentPhase === 'atmosphere') {
              const spawnCount = currentPhase === 'ignition' ? 8 : 5; 
              const isIon = dynamicJetType === 'ion';

              for(let i=0; i<spawnCount; i++) {
                  const eng = engineLocs[Math.floor(Math.random() * engineLocs.length)];
                  const nozzleRelX = (eng.x - 50) * DOM_SCALE;
                  const nozzleRelY = (eng.y + eng.h + 6 - 50) * DOM_SCALE;
                  
                  let pType = 'fire';
                  let pColor = '#ef4444';
                  let pSize = 4 + Math.random() * 4;
                  let pLife = 0.8;

                  if (currentPhase === 'ignition') {
                       if (Math.random() > 0.4) { pType = 'smoke'; pColor = 'rgba(180, 180, 180, 0.4)'; pSize = 6 + Math.random() * 6; } 
                       else { pType = 'fire'; pColor = Math.random() > 0.5 ? '#facc15' : '#f97316'; }
                  } else {
                       if (isIon) { pType = 'ion'; pColor = Math.random() > 0.5 ? '#3b82f6' : '#22d3ee'; } 
                       else { pType = 'fire'; pColor = Math.random() > 0.5 ? '#ef4444' : '#facc15'; }
                  }
                  
                  const ventX = (Math.random()-0.5) * 2;
                  
                  s.particles.push({
                      x: cx + nozzleRelX + (Math.random()-0.5)*3,
                      y: s.shipY + s.shake + nozzleRelY,
                      vx: ventX,
                      vy: (6 + Math.random() * 6), 
                      life: pLife,
                      maxLife: pLife,
                      size: pSize, 
                      type: pType,
                      color: pColor,
                      decay: 0.02,
                      grow: 0.4 
                  });
              }
          }

          s.particles.forEach(p => {
              if (p.type === 'steam') {
                  p.x += p.vx; p.y += p.vy;
                  p.size += 0.5; p.life -= 0.01;
              } else {
                  p.x += p.vx;
                  p.y += p.vy;
                  p.life -= p.decay;
                  p.size += p.grow;
                  const currentGroundY = worldY; 
                  if (p.y > currentGroundY && p.vy > 0) {
                      p.y = currentGroundY;
                      p.vy = 0;
                      p.vx = (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 15); 
                      p.grow = 2.0; 
                      p.decay = 0.05; 
                  }
              }

              if (p.life > 0) {
                  ctx.globalAlpha = p.life;
                  ctx.fillStyle = p.color || '#fff';
                  if (p.type === 'fire' || p.type === 'ion') ctx.globalCompositeOperation = 'lighter';
                  ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
                  ctx.globalCompositeOperation = 'source-over';
                  ctx.globalAlpha = 1;
              }
          });
          s.particles = s.particles.filter(p => p.life > 0);

          if (shipDOMRef.current) {
              const shipScreenY = s.shipY + s.shake;
              const shrinkRate = 1.0 / 240;
              const smoothScale = currentPhase === 'orbit' ? Math.max(0.0, 1.0 - (s.orbitFrameCount * shrinkRate)) : 1.0;
              shipDOMRef.current.style.transform = `translate(-50%, -50%) translate(${cx}px, ${shipScreenY}px) scale(${smoothScale})`;
              shipDOMRef.current.style.opacity = smoothScale < 0.2 ? `${smoothScale * 5}` : '1';
          }
          raf = requestAnimationFrame(loop);
      };

      raf = requestAnimationFrame(loop);
      return () => { 
          window.removeEventListener('resize', resize);
          cancelAnimationFrame(raf); 
          clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); 
          clearTimeout(t4); clearTimeout(t5); clearTimeout(t6); clearTimeout(t7); clearTimeout(t8);
          audioService.stopLaunchSequence();
      };
  }, [env, shipConfig, engineLocs]);

  return (
    <div className="fixed inset-0 z-[5000] bg-black overflow-hidden font-mono select-none absolute w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      <SequenceStatusBar 
          altitude={altitude} 
          velocity={velocity} 
          fuel={visualFuel} 
          maxFuel={maxFuel} 
          status={statusText} 
          onSkip={onComplete} 
          phase={phase} 
      />
      {countdown !== null && countdown > 0 && (
          <div className="absolute top-[25%] left-0 right-0 flex flex-col items-center justify-center z-40 pointer-events-none">
              <div className="text-sm md:text-xl text-emerald-500 font-black tracking-[0.5em] mb-1 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">T-MINUS</div>
              <div className="text-8xl md:text-[10rem] font-black text-white drop-shadow-[0_0_20px_rgba(0,0,0,1)] animate-pulse">{countdown}</div>
          </div>
      )}
      <div ref={shipDOMRef} className="absolute left-0 top-0 w-32 h-32 will-change-transform z-20">
        <div className="absolute inset-0 z-0 overflow-visible">
             <svg className="absolute w-full h-full" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
                <g transform={`translate(50, 50)`}>
                    {['left', 'right'].map((side) => (
                        <LandingGear key={side} type={shipConfig.landingGearType} extension={legExtension} compression={suspension} side={side as any} />
                    ))}
                </g>
             </svg>
        </div>
        <ShipIcon 
            config={shipConfig} 
            className="w-full h-full drop-shadow-2xl relative z-10" 
            showJets={thrustActive} 
            jetType={activeJetType} 
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
