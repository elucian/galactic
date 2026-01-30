
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Planet, Moon, QuadrantType, EquippedWeapon } from '../types.ts';
import { ExtendedShipConfig } from '../constants.ts';
import { ShipIcon } from './ShipIcon.tsx';
import { audioService } from '../services/audioService.ts';
import { LandingGear } from './LandingGear.tsx';
import { getEngineCoordinates, generatePlanetEnvironment, drawCloud, drawVehicle, drawStreetLight, drawPlatform, drawTower, drawDome, drawBuilding, drawPowerPlant, drawBoulder, drawResort, drawMining, getShipHullWidths, drawBird, drawLightning } from '../utils/drawingUtils.ts';
import { SequenceStatusBar } from './SequenceStatusBar.tsx';

interface LaunchSequenceProps {
  planet: Planet;
  shipConfig: ExtendedShipConfig;
  shipColors: any;
  onComplete: () => void;
  testMode?: boolean;
  weaponId?: string;
  equippedWeapons?: (EquippedWeapon | null)[];
  currentFuel: number;
  maxFuel: number;
}

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

const LaunchSequence: React.FC<LaunchSequenceProps> = ({ planet, shipConfig, shipColors, onComplete, testMode, weaponId, equippedWeapons, currentFuel, maxFuel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement>(null); // Foreground Canvas for overlaying ship
  const shipDOMRef = useRef<HTMLDivElement>(null);
  
  const [phase, setPhase] = useState<'countdown' | 'ignition' | 'lift' | 'atmosphere' | 'orbit'>('countdown');
  const phaseRef = useRef(phase); 

  const [statusText, setStatusText] = useState("SYSTEM CHECK");
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const [altitude, setAltitude] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const [visualFuel, setVisualFuel] = useState(currentFuel);
  const [legExtension, setLegExtension] = useState(1); 
  const [suspension, setSuspension] = useState(0.8); 
  const [thrustActive, setThrustActive] = useState(false);
  const [activeJetType, setActiveJetType] = useState<'combustion' | 'ion'>('combustion');

  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const DOM_SCALE = 1.28;
  const engineLocs = useMemo(() => getEngineCoordinates(shipConfig), [shipConfig]);
  const hullWidths = useMemo(() => getShipHullWidths(shipConfig), [shipConfig]);
  const env = useMemo(() => generatePlanetEnvironment(planet as Planet), [planet]);
  const envRef = useRef(env);
  useEffect(() => { envRef.current = env; }, [env]);

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
    birds: [] as any[], 
    starScrollY: 0,
    celestialX: 0.7,
    celestialY: -0.2, 
    sunTargetY: 0.15,
    armPos: 1.0,
    accPos: 1.0,
    suspension: 0.8,
    legExtension: 1.0,
    countdownFrame: -1,
    // Weather States
    rain: [] as {x: number, y: number, len: number, speed: number}[],
    lightning: { active: false, x: 0, timer: 0 },
    birdFlock: [] as {x: number, y: number, vx: number, vy: number, flap: number}[]
  });

  useEffect(() => { phaseRef.current = phase; }, [phase]);

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
      s.birds = [];
      if (env.powerLines && env.powerLines.length > 0) {
          const numBirds = 12 + Math.floor(Math.random() * 8); 
          const chain = env.powerLines[0]; 
          if (chain && chain.length > 0) {
              const minX = Math.min(chain[0].x, chain[chain.length-1].x);
              const maxX = Math.max(chain[0].x, chain[chain.length-1].x);
              for(let i=0; i<numBirds; i++) {
                  const birdX = minX + (Math.random() * (maxX - minX));
                  s.birds.push({ x: birdX, y: -100, vx: 0, vy: 0, state: 'sit', visible: true, flapSpeed: 0.2 + Math.random() * 0.1, timer: Math.random() * 100 });
              }
          }
      }
      
      // Init Birds Flock
      if (env.hasBirds) {
          const count = 5 + Math.floor(Math.random() * 5);
          for(let i=0; i<count; i++) {
              s.birdFlock.push({
                  x: Math.random() * 2000 - 1000,
                  y: 500 + Math.random() * 300,
                  vx: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 2),
                  vy: (Math.random() - 0.5) * 0.5,
                  flap: Math.random() * 10
              });
          }
      }
      
      // Init Rain
      if (env.weather?.isRainy) {
          const count = 200;
          for(let i=0; i<count; i++) {
              s.rain.push({
                  x: Math.random() * 2000 - 1000,
                  y: Math.random() * 2000 - 1000,
                  len: 10 + Math.random() * 20,
                  speed: 15 + Math.random() * 5
              });
          }
      }

  }, [env, planet]);

  useEffect(() => {
      audioService.stop();
      const handleKeyDown = (e: KeyboardEvent) => { 
          if (e.code === 'Space') { 
              e.preventDefault(); 
              audioService.stopLaunchSequence();
              audioService.stop();
              onCompleteRef.current(); 
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
      let timeouts: any[] = [];
      
      // Delay initial countdown to let scene settle
      timeouts.push(setTimeout(() => {
          setCountdown(8); audioService.playCountdownBeep(false);
          // MARK THE START FRAME FOR ANIMATION SYNC
          stateRef.current.countdownFrame = stateRef.current.frameCount; 
          
          for(let i=7; i>=0; i--) {
               timeouts.push(setTimeout(() => {
                   setCountdown(i); 
                   if (i === 0) {
                       setPhase('ignition'); setStatusText("IGNITION"); audioService.playCountdownBeep(true);
                       
                       timeouts.push(setTimeout(() => {
                          audioService.playLaunchBang(); audioService.playLaunchSequence(); 
                          timeouts.push(setTimeout(() => {
                              setPhase('lift'); setStatusText("LIFT OFF");
                              timeouts.push(setTimeout(() => {
                                  setPhase('atmosphere'); setStatusText("MAX Q");
                                  timeouts.push(setTimeout(() => {
                                      setPhase('orbit'); setStatusText("ORBIT INSERTION"); audioService.stopLaunchSequence(); audioService.playOrbitLatch();
                                      timeouts.push(setTimeout(() => { onCompleteRef.current(); }, 4000));
                                  }, 5000));
                              }, 4000)); 
                          }, 2000));
                      }, 300));

                   } else {
                       audioService.playCountdownBeep(false);
                   }
               }, (8-i) * 1000));
          }

      }, 2000));

      return () => { 
          timeouts.forEach(t => clearTimeout(t));
          audioService.stopLaunchSequence();
      };
  }, []);

  useEffect(() => {
      const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
      const fgCanvas = fgCanvasRef.current; let fgCtx: CanvasRenderingContext2D | null = null;
      
      const resize = () => {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();
          
          canvas.width = rect.width * dpr; canvas.height = rect.height * dpr; ctx.scale(dpr, dpr);
          if (fgCanvas) { 
              fgCanvas.width = rect.width * dpr; 
              fgCanvas.height = rect.height * dpr; 
              fgCtx = fgCanvas.getContext('2d'); 
              if (fgCtx) fgCtx.scale(dpr, dpr); 
          }
      };
      resize();
      window.addEventListener('resize', resize);

      const s = stateRef.current;
      let raf: number;
      const planetIdVal = (planet.id.charCodeAt(0) * 100) + planet.id.charCodeAt(1);
      const moonPhaseShift = (planetIdVal % 100) / 100 * Math.PI * 2;

      const loop = () => {
          const env = envRef.current;
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
          const pixelLegHeight = (isComplexGear ? 72 : 60) * DOM_SCALE;
          const uncompressedShipY = padSurfaceY - (pixelLegHeight - 4);
          const compressionPixels = 15 * DOM_SCALE;
          const isSpace = s.viewY > 3000;
          const dynamicJetType = (isSpace || currentPhase === 'orbit') ? 'ion' : 'combustion';
          setActiveJetType(dynamicJetType);

          if (currentPhase === 'countdown') { 
              s.suspension = 0.8; s.legExtension = 1; s.shipY = uncompressedShipY + (1 - s.suspension) * compressionPixels; setThrustActive(false); 
              
              if (s.countdownFrame > 0) {
                  const elapsed = s.frameCount - s.countdownFrame;
                  if (elapsed < 120) { s.accPos = Math.max(0, 1.0 - (elapsed / 120)); s.armPos = 1.0; } 
                  else if (elapsed < 240) { s.accPos = 0.0; const armProgress = (elapsed - 120) / 120; s.armPos = Math.max(0, 1.0 - armProgress); } 
                  else { s.accPos = 0.0; s.armPos = 0.0; }
              } else { s.accPos = 1.0; s.armPos = 1.0; }
          }
          else if (currentPhase === 'ignition') { 
              s.suspension = Math.min(1, s.suspension + 0.01); s.legExtension = 1; const targetY = uncompressedShipY + (1 - s.suspension) * compressionPixels; s.shipY = targetY + (Math.random() - 0.5) * 2; s.shake = (Math.random() - 0.5) * 4; if (s.internalFuel > s.targetFuel) s.internalFuel -= 0.001; setThrustActive(true); 
              s.accPos = 0.0; s.armPos = 0.0;
          }
          else if (currentPhase === 'lift') { 
              s.accPos = 0.0; s.armPos = 0.0;
              const targetScreenY = h * 0.4; if (s.shipY > targetScreenY) { s.shipVy += 0.05; s.shipY -= s.shipVy; } else { s.shipY = targetScreenY; s.worldSpeed += 0.15; s.viewY += s.worldSpeed; } const liftHeight = uncompressedShipY - s.shipY; if (liftHeight > 20) { s.legExtension = Math.max(0, s.legExtension - 0.02); } s.suspension = 1.0; s.shake = (Math.random() - 0.5) * 6; if (s.internalFuel > s.targetFuel) s.internalFuel -= 0.003; 
          }
          else if (currentPhase === 'atmosphere') { s.worldSpeed += 0.5; s.viewY += s.worldSpeed; s.shake = (Math.random() - 0.5) * 8; s.legExtension = 0; }
          else if (currentPhase === 'orbit') { s.orbitFrameCount++; s.worldSpeed += 1.0; s.viewY += s.worldSpeed; s.shipY -= 0.5; s.shake = (Math.random() - 0.5) * 2; setThrustActive(true); if (s.internalFuel > s.targetFuel) s.internalFuel = s.targetFuel; }

          setAltitude(Math.floor(s.viewY + (uncompressedShipY - s.shipY)));
          setVelocity(Math.floor(s.worldSpeed * 100 + s.shipVy * 50));
          setVisualFuel(s.internalFuel);
          setLegExtension(s.legExtension);
          setSuspension(s.suspension);

          if (fgCtx) fgCtx.clearRect(0, 0, w, h);

          // DRAWING BACKGROUND LAYERS
          const spaceTransitionHeight = 15000;
          const spaceRatio = Math.min(1, s.viewY / spaceTransitionHeight); 
          const sky1 = mixColor(env.skyGradient[0], '#000000', spaceRatio);
          const sky2 = mixColor(env.skyGradient[1], '#000000', spaceRatio);
          const grad = ctx.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, sky1); grad.addColorStop(1, sky2); ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

          const baseStarVis = (!env.isDay ? 0.8 : 0); const starVis = Math.max(baseStarVis, Math.min(1, baseStarVis + (spaceRatio * 1.5)));
          if (starVis > 0) { ctx.fillStyle = '#fff'; s.starScrollY += 0.002; env.stars.forEach(st => { ctx.globalAlpha = st.alpha * starVis; const sy = (st.y * h + s.viewY * 0.05) % h; ctx.beginPath(); ctx.arc(st.x * w, sy, st.size, 0, Math.PI*2); ctx.fill(); }); ctx.globalAlpha = 1; }

          const celParallax = s.viewY * 0.006; const celX = s.celestialX * w; const celY = (s.celestialY * h) + celParallax; const celScale = 1 + (spaceRatio * 0.2); let dimFactor = 0;
          if (env.quadrant === QuadrantType.DELTA) {
              const time = Date.now(); const slowTime = time * 0.00025; const dwarfDist = 120 * celScale; const dwarfX = celX + Math.cos(slowTime) * dwarfDist; const dwarfY = celY + Math.sin(slowTime * 0.5) * 40; const dwarfR = 15 * celScale * 0.7; const zDepth = Math.sin(slowTime); const isBehind = zDepth < 0; if (isBehind) dimFactor = Math.min(0.7, Math.abs(zDepth) * 0.9);
              const drawDwarf = () => { ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(dwarfX, dwarfY, dwarfR, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; };
              const drawBlackHole = () => { const bhRadius = 40 * celScale; const bhGrad = ctx.createRadialGradient(celX, celY, bhRadius*0.8, celX, celY, bhRadius*2.5); bhGrad.addColorStop(0, '#000000'); bhGrad.addColorStop(0.4, '#4c1d95'); bhGrad.addColorStop(0.6, '#a855f7'); bhGrad.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = bhGrad; ctx.beginPath(); ctx.arc(celX, celY, bhRadius*2.5, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#000000'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(celX, celY, bhRadius, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; };
              if (isBehind) { drawDwarf(); drawBlackHole(); } else { drawBlackHole(); drawDwarf(); }
          } else {
              if (s.celestialY > -100 && env.isDay) { const sunR = 30 * celScale; const sGrad = ctx.createRadialGradient(celX, celY, sunR*0.2, celX, celY, sunR*2.5); sGrad.addColorStop(0, env.sunColor); sGrad.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sGrad; ctx.beginPath(); ctx.arc(celX, celY, sunR*2.5, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(celX, celY, sunR*0.7, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1; }
              if (!env.isDay && s.celestialY > -100) { const moonR = 25 * celScale; ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(celX, celY, moonR, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.beginPath(); ctx.arc(celX - (Math.cos(moonPhaseShift)*12*celScale), celY, moonR, 0, Math.PI*2); ctx.fill(); }
          }

          if (env.wanderers && env.wanderers.length > 0 && starVis > 0.3) { 
              env.wanderers.forEach(wd => { const wx = (wd.x * w + s.startTime * 0.005) % (w + 100) - 50; const wy = (wd.y * h + s.viewY * 0.1) % (h + 100) - 50; ctx.fillStyle = wd.color || '#e5e7eb'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 2; ctx.globalAlpha = starVis; ctx.beginPath(); ctx.arc(wx, wy, Math.min(2.5, wd.size), 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1.0; });
          }

          // UPDATED: Draw Clouds with Wrapping & Stretching
          const drawCloudsByLayer = (targetLayer: number, targetCtx: CanvasRenderingContext2D) => { 
              if (env.clouds && env.clouds.length > 0 && spaceRatio < 0.95) { 
                  // Stretch disabled for ascent
                  const stretchFactor = 1.0;
                  
                  // Strict fade out for space boundary
                  const spaceStart = 8000;
                  const spaceEnd = 12000;
                  let altitudeVisibility = 1.0;
                  
                  if (s.viewY > spaceStart) {
                      altitudeVisibility = 1.0 - Math.min(1, (s.viewY - spaceStart) / (spaceEnd - spaceStart));
                  }
                  
                  if (altitudeVisibility <= 0) return; // Don't draw if fully in space
                  
                  const wrapWidth = w + 1000;
                  const wrapOffset = 500;
                  const verticalSpan = 5000; // Cloud layer thickness for wrapping

                  env.clouds.forEach((c: any) => { 
                      if (c.layer !== targetLayer) return; 
                      
                      const loopH = h + 800; // Height to loop over
                      const progress = (c.altitude + s.viewY * (1 + c.parallaxFactor)) % loopH;
                      const drawY = -s.viewY + progress - 400; // Centered around view
                      
                      // Horizontal Wrapping
                      let distMoved = s.frameCount * c.speed * c.direction;
                      let rawX = (c.x + distMoved) % wrapWidth;
                      if (rawX < 0) rawX += wrapWidth;
                      const cloudX = rawX - wrapOffset;
                      
                      const pulse = Math.sin((s.frameCount * 0.01) + (c.id || 0));
                      // Combine pulse opacity with altitude visibility
                      const opacity = Math.max(0, Math.min(1, c.baseAlpha * (0.8 + 0.2 * pulse))) * altitudeVisibility;

                      if (drawY > -s.viewY - 2000 && drawY < -s.viewY + 2000 && opacity > 0.01) { // Culling check
                          // Draw
                          drawCloud(targetCtx, cloudX, drawY, c.w, opacity, c.color, c.puffs, stretchFactor); 
                      }
                  }); 
              } 
          };

          const worldY = groundY + s.viewY + s.shake;
          if (worldY < h + 30000) { // Extended render distance for loop 
              
              // Draw Function for Terrain & Features
              const drawHillItem = (hill: any, i: number) => {
                  const pFactor = hill.parallaxFactor; const yOff = (s.viewY * (1 - pFactor)); ctx.fillStyle = hill.color; ctx.beginPath(); ctx.moveTo(-w, h); 
                  const pathPoints: {x:number, y:number}[] = [];
                  hill.points.forEach((p: any, idx: number) => { const px = (p.xRatio * 3000) - 1500; const py = -(p.heightRatio * 300) - yOff; if (idx === 0) ctx.lineTo(px, 1000); ctx.lineTo(px, py); if (hill.hasRoad || hill.hasTrainTrack) pathPoints.push({x: px, y: py}); });
                  ctx.lineTo(1500, 1000); ctx.fill();

                  // SNOW CAPS
                  if (hill.snowCaps && hill.snowCaps.length > 0) {
                      ctx.fillStyle = '#ffffff';
                      hill.snowCaps.forEach((cap: any) => {
                          const idx = cap.idx;
                          if (idx > 0 && idx < hill.points.length - 1) {
                              const pPrev = hill.points[idx - 1]; const pCurr = hill.points[idx]; const pNext = hill.points[idx + 1];
                              const x1 = (pPrev.xRatio * 3000) - 1500; const y1 = -(pPrev.heightRatio * 300) - yOff;
                              const x2 = (pCurr.xRatio * 3000) - 1500; const y2 = -(pCurr.heightRatio * 300) - yOff;
                              const x3 = (pNext.xRatio * 3000) - 1500; const y3 = -(pNext.heightRatio * 300) - yOff;
                              ctx.beginPath(); ctx.moveTo(x1 + (x2 - x1) * 0.7, y1 + (y2 - y1) * 0.7); ctx.lineTo(x2, y2); ctx.lineTo(x2 + (x3 - x2) * 0.3, y2 + (y3 - y2) * 0.3); ctx.fill();
                          }
                      });
                  }

                  if (hill.roadBuildingsBack) { hill.roadBuildingsBack.forEach((b: any) => { const bx = (b.xRatio * 3000) - 1500; const by = -(b.yBase * 300) - yOff + b.yOffset; if (b.type === 'dome_std') { drawDome(ctx, bx, by, b, !!env.isOcean); } else if (b.type === 'hangar') { drawBuilding(ctx, { x: bx, y: by, type: 'hangar', w: b.w, h: b.h }, env.isDay, false); } else { drawBuilding(ctx, { x: bx, y: by, type: 'building_std', w: b.w, h: b.h, color: b.color, windowData: b.windowData, hasRedRoof: b.hasRedRoof, windowW: b.windowW, windowH: b.windowH, acUnits: b.acUnits, drawFoundation: b.drawFoundation }, env.isDay, false); } }); }

                  if (hill.hasRoad && pathPoints.length > 0) {
                      ctx.beginPath(); pathPoints.forEach((p, idx) => { if(idx===0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.strokeStyle = '#333'; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
                      if (env.cars && env.cars.length > 0) {
                          env.cars.forEach(car => {
                              car.progress += car.speed * (car.dir || 1); if (car.progress > 1) car.progress -= 1; if (car.progress < 0) car.progress += 1;
                              const trackLen = pathPoints.length - 1; const exactIdx = car.progress * trackLen; const idx = Math.floor(exactIdx); const sub = exactIdx - idx; const p1 = pathPoints[idx]; const p2 = pathPoints[Math.min(idx + 1, trackLen)];
                              if (p1 && p2) {
                                  const vx = p1.x + (p2.x - p1.x) * sub; const vy = p1.y + (p2.y - p1.y) * sub; const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                                  drawVehicle(ctx, vx, vy - 4, angle, 'car', car.color, env.isDay, car.dir);
                              }
                          });
                      }
                      if (env.streetLights) { env.streetLights.forEach(sl => { const ratio = (sl.x + 1500) / 3000; if (ratio >= 0 && ratio <= 1) { const idx = Math.floor(ratio * (pathPoints.length - 1)); const p = pathPoints[idx]; if (p) drawStreetLight(ctx, p.x, p.y, sl.h, env.isDay); } }); }
                  }

                  if (hill.hasTrainTrack && pathPoints.length > 0) {
                      const trainsOnLayer = env.trains.filter((t: any) => t.layer === i);
                      if (trainsOnLayer.length > 0) {
                          trainsOnLayer.forEach((train: any) => {
                              train.progress += train.speed * (train.dir || 1); if (train.progress > 1) train.progress -= 1; if (train.progress < 0) train.progress += 1;
                              const trackLen = pathPoints.length - 1;
                              for(let k=0; k<train.cars; k++) {
                                  const tProg = train.progress - (k * 0.015);
                                  if (tProg >= 0 && tProg <= 1) {
                                      const tIdx = Math.floor(tProg * trackLen); const tSub = (tProg * trackLen) - tIdx; 
                                      const tp1 = pathPoints[tIdx]; const tp2 = pathPoints[Math.min(tIdx + 1, trackLen)];
                                      if (tp1 && tp2) {
                                          const tx = tp1.x + (tp2.x - tp1.x) * tSub; const ty = tp1.y + (tp2.y - tp1.y) * tSub; const ta = Math.atan2(tp2.y - tp1.y, tp2.x - tp1.x);
                                          drawVehicle(ctx, tx, ty - 6, ta, k===0 ? 'train_engine' : 'train_carriage', train.color, env.isDay, train.dir);
                                      }
                                  }
                              }
                          });
                      }
                  }

                  if (hill.roadBuildingsFront) { hill.roadBuildingsFront.forEach((b: any) => { const bx = (b.xRatio * 3000) - 1500; const by = -(b.yBase * 300) - yOff + b.yOffset; if (b.type === 'dome_std') { drawDome(ctx, bx, by, b, !!env.isOcean); } else if (b.type === 'hangar') { drawBuilding(ctx, { x: bx, y: by, type: 'hangar', w: b.w, h: b.h }, env.isDay, false); } else { drawBuilding(ctx, { x: bx, y: by, type: 'building_std', w: b.w, h: b.h, color: b.color, windowData: b.windowData, hasRedRoof: b.hasRedRoof, windowW: b.windowW, windowH: b.windowH, acUnits: b.acUnits }, env.isDay, false); } }); }

                  if (hill.trees) {
                      hill.trees.forEach((t: any, tIdx: number) => {
                          const p1 = hill.points[t.segIdx]; const p2 = hill.points[t.segIdx+1];
                          if (p1 && p2) {
                              const x1 = p1.xRatio * 3000 - 1500; const y1 = - (p1.heightRatio * 300) - yOff; const x2 = p2.xRatio * 3000 - 1500; const y2 = - (p2.heightRatio * 300) - yOff; const tx = x1 + (x2 - x1) * t.offset; let ty = y1 + (y2 - y1) * t.offset;
                              
                              if (t.type === 'resort') {
                                  const halfWidth = 30 * t.scale * 0.8; 
                                  const slope = (y2 - y1) / (x2 - x1);
                                  const drop = Math.abs(slope * halfWidth);
                                  
                                  let drawY = ty;
                                  let foundationH = 0;
                                  
                                  if (drop > 8) {
                                      const adjustment = drop - 8;
                                      drawY = ty + adjustment;
                                      foundationH = 8;
                                  } else {
                                      foundationH = drop;
                                  }
                                  
                                  drawResort(ctx, tx, drawY, t.scale, env.isDay, foundationH); 
                              }
                              else if (t.type === 'windmill') { drawBuilding(ctx, { x: tx, y: ty, type: 'windmill', scale: t.scale, windmillType: t.windmillType }, env.isDay, false); }
                              else if (t.type === 'mining') { drawMining(ctx, tx, ty, t.scale); }
                              else { drawBuilding(ctx, { x: tx, y: ty, type: t.type, w: t.w, h: t.h, color: t.color, trunkColor: '#78350f' }, env.isDay, false); }
                          }
                      });
                  }
              };

              // PREPARE CONTEXTS
              
              // --- RENDER BACKGROUND PASS ---
              ctx.save(); ctx.translate(cx, worldY);
              
              // LIGHTNING FLASH
              if (s.lightning.active) {
                  const opacity = Math.min(1, s.lightning.timer / 10);
                  ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
                  ctx.fillRect(-w, -h*2, w*2, h*4);
              }

              // LAYER 0 (DISTANT) - BEHIND HILLS
              drawCloudsByLayer(0, ctx);
              
              if (s.lightning.active && s.lightning.timer > 5 && s.lightning.x) {
                  const ly = -1200; 
                  drawLightning(ctx, s.lightning.x, ly, 600);
              }

              if (env.hills[0]) drawHillItem(env.hills[0], 0); if (env.hills[1]) drawHillItem(env.hills[1], 1);
              
              // LAYER 1 (MID) - BETWEEN HILLS
              drawCloudsByLayer(1, ctx);
              
              for (let i = 2; i < env.hills.length; i++) { drawHillItem(env.hills[i], i); }

              ctx.fillStyle = env.groundColor; ctx.fillRect(-w, 0, w*2, h*2); drawPlatform(ctx, 0, 0, env.isOcean);
              
              // DRAW FEATURES (Not Foreground)
              env.features.forEach(f => {
                  if (f.isForeground) return; 
                  const fy = f.yOff || 0; 
                  if (f.type === 'tower') {
                      drawTower(ctx, f.x, fy, f, env.isDay, env.isOcean, s.armPos, s.accPos, [hullWidths.top, hullWidths.bottom]); 
                  }
                  else if (f.type === 'dome_std') drawDome(ctx, f.x, fy, f, !!env.isOcean);
                  else if (f.type === 'building_std') drawBuilding(ctx, { ...f, y: fy }, env.isDay, env.isOcean);
                  else if (f.type === 'power_pole' || f.type === 'hangar') drawBuilding(ctx, { ...f, y: fy }, env.isDay, env.isOcean);
                  else if (f.type === 'power_plant') drawPowerPlant(ctx, f.x, fy, f.scale, f.isUnderground);
              });
              ctx.restore();

              // --- RENDER FOREGROUND PASS (If Foreground Context Exists) ---
              if (fgCtx) {
                  fgCtx.save(); fgCtx.translate(cx, worldY);
                  env.features.forEach(f => {
                      if (f.isForeground) {
                          const fy = f.yOff || 0;
                          if (f.type === 'dome_std') drawDome(fgCtx, f.x, fy, f, !!env.isOcean);
                          else if (f.type === 'building_std') drawBuilding(fgCtx, { ...f, y: fy }, env.isDay, env.isOcean);
                      }
                  });
                  fgCtx.restore();
              }
          }

          if (env.weather?.isStormy) {
              if (s.lightning.active) {
                  s.lightning.timer--;
                  if (s.lightning.timer <= 0) s.lightning.active = false;
              } else if (Math.random() < 0.01) {
                  s.lightning.active = true;
                  s.lightning.timer = 15;
                  s.lightning.x = (Math.random() - 0.5) * 2000;
              }
          }

          if (env.weather?.isRainy) {
              const rainCtx = fgCtx || ctx;
              rainCtx.strokeStyle = 'rgba(174, 194, 224, 0.5)';
              rainCtx.lineWidth = 1;
              rainCtx.beginPath();
              
              s.rain.forEach(drop => {
                  drop.y += drop.speed;
                  if (drop.y > 1000) {
                      drop.y = -1200;
                      drop.x = (Math.random() - 0.5) * 2000;
                  }
                  const visualY = ((drop.y + s.viewY) % 2200) - 1100 + (h/2);
                  const visualX = drop.x + (w/2);
                  if (visualY > -100 && visualY < h + 100) {
                      rainCtx.moveTo(visualX, visualY);
                      rainCtx.lineTo(visualX, visualY + drop.len);
                  }
              });
              rainCtx.stroke();
          }

          if (env.hasBirds && s.viewY < 1500) { 
              const birdCtx = fgCtx || ctx;
              s.birdFlock.forEach(b => {
                  b.x += b.vx; b.y += b.vy;
                  if (b.x > 1000) b.vx = -Math.abs(b.vx);
                  if (b.x < -1000) b.vx = Math.abs(b.vx);
                  if (b.y < 200) b.vy = Math.abs(b.vy);
                  if (b.y > 800) b.vy = -Math.abs(b.vy);
                  b.flap += 0.2;
                  const birdY = b.y + worldY; 
                  const birdX = b.x + cx;
                  if (birdY > -50 && birdY < h + 50) {
                      drawBird(birdCtx, birdX, birdY, 3, Math.sin(b.flap));
                  }
              });
          }

          if (dimFactor > 0) { ctx.fillStyle = `rgba(0,0,0,${dimFactor})`; ctx.fillRect(0, 0, w, h); }

          if (currentPhase === 'ignition' || currentPhase === 'lift' || currentPhase === 'atmosphere' || currentPhase === 'orbit') {
              const spawnCount = currentPhase === 'ignition' ? 12 : 5; 
              const isIon = dynamicJetType === 'ion';
              
              for(let i=0; i<spawnCount; i++) {
                  const eng = engineLocs[Math.floor(Math.random() * engineLocs.length)]; const nozzleRelX = (eng.x - 50) * DOM_SCALE; const nozzleRelY = (eng.y + eng.h + 6 - 50) * DOM_SCALE;
                  let pType = 'fire'; let pColor = '#ef4444'; let pSize = 4 + Math.random() * 4; let pLife = 0.8;
                  let vxVal = (Math.random()-0.5) * 2;
                  let vyVal = 6 + Math.random() * 6;

                  if (currentPhase === 'ignition') { 
                      if (Math.random() > 0.4) { pType = 'smoke'; pColor = 'rgba(180, 180, 180, 0.4)'; pSize = 6 + Math.random() * 8; pLife = 1.2; } 
                      else { pType = 'fire'; pColor = Math.random() > 0.5 ? '#facc15' : '#f97316'; } 
                      if (s.shipY > (groundY - padHeight - 60)) {
                          vxVal = (Math.random() > 0.5 ? 1 : -1) * (12 + Math.random() * 15);
                          vyVal = (Math.random() - 0.5) * 4; 
                      }
                  } 
                  else { 
                      if (isIon) { pType = 'ion'; pColor = Math.random() > 0.5 ? '#3b82f6' : '#22d3ee'; pLife = 0.6; } 
                      else { pType = 'fire'; pColor = Math.random() > 0.5 ? '#ef4444' : '#facc15'; } 
                      if (currentPhase === 'orbit') vyVal = 8 + Math.random() * 4;
                  }
                  
                  s.particles.push({ x: cx + nozzleRelX + (Math.random()-0.5)*3, y: s.shipY + s.shake + nozzleRelY, vx: vxVal, vy: vyVal, life: pLife, maxLife: pLife, size: pSize, type: pType, color: pColor, decay: 0.02, grow: 0.4 });
              }
          }

          s.particles.forEach(p => { if (p.type === 'steam') { p.x += p.vx; p.y += p.vy; p.size += 0.5; p.life -= 0.01; } else { p.x += p.vx; p.y += p.vy; p.life -= p.decay || 0.02; p.size += p.grow || 0; const currentGroundY = worldY; if (p.y > currentGroundY && p.vy > 0) { p.y = currentGroundY; p.vy = 0; p.vx = (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 15); p.grow = 2.0; p.decay = 0.05; } } if (p.life > 0) { ctx.globalAlpha = p.life; ctx.fillStyle = p.color || '#fff'; if (p.type === 'fire' || p.type === 'ion') ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; } });
          s.particles = s.particles.filter(p => p.life > 0);

          if (fgCtx) {
             drawCloudsByLayer(2, fgCtx);
          } else {
             drawCloudsByLayer(2, ctx);
          }

          if (shipDOMRef.current) { const shipScreenY = s.shipY + s.shake; const shrinkRate = 1.0 / 240; const smoothScale = currentPhase === 'orbit' ? Math.max(0.0, 1.0 - (s.orbitFrameCount * shrinkRate)) : 1.0; shipDOMRef.current.style.transform = `translate(-50%, -50%) translate(${cx}px, ${shipScreenY}px) scale(${smoothScale})`; shipDOMRef.current.style.opacity = smoothScale < 0.2 ? `${smoothScale * 5}` : '1'; }
          raf = requestAnimationFrame(loop);
      };

      raf = requestAnimationFrame(loop);
      return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf); audioService.stopLaunchSequence(); };
  }, [env, shipConfig, engineLocs, hullWidths]);

  return (
    <div className="fixed inset-0 z-[5000] bg-black overflow-hidden font-mono select-none absolute w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0" />
      <SequenceStatusBar altitude={altitude} velocity={velocity} fuel={visualFuel} maxFuel={maxFuel} status={statusText} onSkip={() => { audioService.stopLaunchSequence(); audioService.stop(); onCompleteRef.current(); }} phase={phase} />
      {countdown !== null && countdown > 0 && ( <div className="absolute top-[25%] left-0 right-0 flex flex-col items-center justify-center z-40 pointer-events-none"> <div className="text-sm md:text-xl text-emerald-500 font-black tracking-[0.5em] mb-1 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">T-MINUS</div> <div className="text-8xl md:text-[10rem] font-black text-white drop-shadow-[0_0_20px_rgba(0,0,0,1)] animate-pulse">{countdown}</div> </div> )}
      <div ref={shipDOMRef} className="absolute left-0 top-0 w-32 h-32 will-change-transform z-20">
        <div className="absolute inset-0 z-0 overflow-visible">
             <svg className="absolute w-full h-full" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
                <g transform={`translate(50, 50)`}> {['left', 'right'].map((side) => ( <LandingGear key={side} type={shipConfig.landingGearType} extension={legExtension} compression={suspension} side={side as any} /> ))} </g>
             </svg>
        </div>
        <ShipIcon config={shipConfig} className="w-full h-full drop-shadow-2xl relative z-10" showJets={thrustActive} jetType={activeJetType} showGear={false} hullColor={shipColors.hull} wingColor={shipColors.wings} cockpitColor={shipColors.cockpit} gunColor={shipColors.guns} secondaryGunColor={shipColors.secondary_guns} gunBodyColor={shipColors.gun_body} engineColor={shipColors.engines} nozzleColor={shipColors.nozzles} weaponId={weaponId} equippedWeapons={equippedWeapons} />
      </div>
      <canvas ref={fgCanvasRef} className="absolute inset-0 z-30 pointer-events-none w-full h-full" />
    </div>
  );
};

export default LaunchSequence;
