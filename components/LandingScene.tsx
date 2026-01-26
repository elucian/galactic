
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Planet, Moon, QuadrantType, EquippedWeapon } from '../types.ts';
import { SHIPS, ExtendedShipConfig } from '../constants.ts';
import { ShipIcon } from './ShipIcon.tsx';
import { audioService } from '../services/audioService.ts';
import { LandingGear } from './LandingGear.tsx';
import { drawDome, drawPlatform, getEngineCoordinates, drawPowerPlant, drawBoulder, generatePlanetEnvironment, drawBuilding, drawVehicle, drawStreetLight, drawTower, drawCloud } from '../utils/drawingUtils.ts';
import { SequenceStatusBar } from './SequenceStatusBar.tsx';

// --- Local Helpers ---
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

interface LandingSceneProps {
  planet: Planet | Moon;
  shipShape?: string; 
  shipConfig?: ExtendedShipConfig | null; 
  onComplete: () => void;
  weaponId?: string;
  equippedWeapons?: (EquippedWeapon | null)[];
  currentFuel: number;
  maxFuel: number;
}

export const LandingScene: React.FC<LandingSceneProps> = ({ planet, shipShape, shipConfig: propShipConfig, onComplete, weaponId, equippedWeapons, currentFuel, maxFuel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement>(null); 
  const shipDOMRef = useRef<HTMLDivElement>(null);
  
  const [status, setStatus] = useState("ORBITAL DECAY");
  const [altitude, setAltitude] = useState(25000);
  const [speed, setSpeed] = useState(1200);
  const [visualFuel, setVisualFuel] = useState(currentFuel); 
  const [legExtension, setLegExtension] = useState(0); 
  const [suspension, setSuspension] = useState(1); 
  const [thrustActive, setThrustActive] = useState(false);
  const [phase, setPhase] = useState<'reentry' | 'braking' | 'approach' | 'landed'>('reentry');
  
  const DOM_SCALE = 1.28;

  // Resolve Ship Config: Prefer passed object, fallback to shape find
  const shipConfig = useMemo(() => {
      if (propShipConfig) return propShipConfig;
      const match = SHIPS.find((s) => s.shape === shipShape);
      return match || SHIPS[0];
  }, [shipShape, propShipConfig]);

  const engineLocs = useMemo(() => getEngineCoordinates(shipConfig), [shipConfig]);
  const env = useMemo(() => generatePlanetEnvironment(planet as Planet), [planet]);

  const stateRef = useRef({
    startTime: 0,
    siteOffset: 0, 
    starScrollY: 0,
    birds: [] as any[],
    flock: [] as any[], 
    particles: [] as {x: number, y: number, vx: number, vy: number, size: number, life: number, maxLife: number, type: string, color?: string, decay?: number, grow?: number, initialAlpha?: number}[],
    
    // Position Vars
    shipY: -200, 
    viewY: 2000, 
    
    // Physics Vars
    velocity: 25, 
    thrustIntensity: 0, 
    frame: 0,
    
    // Logic Vars
    hasThudded: false,
    hasCompleted: false, 
    armRetract: 1, 
    shake: 0,
    steamTimer: 0,
    autoCompleteTimer: 0,
    
    // Suspension Physics
    suspensionOffset: 0.0,
    suspensionVel: 0.0,
    
    internalFuel: currentFuel,
    reEntryHeat: 0, 
    
    // Internal State
    legExtVal: 0,
    isThrusting: false
  });

  useEffect(() => {
      // Initialize Audio
      audioService.stop(); // Clear any existing
      audioService.startReEntryWind();
      // Initialize landing thruster node but silent
      if (audioService.startLandingThruster) audioService.startLandingThruster();
      if (audioService.updateLandingThruster) audioService.updateLandingThruster(0);
      
      const handleKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); onComplete(); }};
      window.addEventListener('keydown', handleKeyDown);
      return () => { 
          // Stop all sounds on unmount
          audioService.stopReEntryWind();
          audioService.stopLandingThruster();
          window.removeEventListener('keydown', handleKeyDown);
      };
  }, [onComplete]);

  useEffect(() => {
      const s = stateRef.current;
      s.birds = [];
      if (env.powerLines.length > 0) {
          const numBirds = 12 + Math.floor(Math.random() * 8); 
          const chain = env.powerLines[0]; 
          const minX = Math.min(chain[0].x, chain[chain.length-1].x);
          const maxX = Math.max(chain[0].x, chain[chain.length-1].x);
          for(let i=0; i<numBirds; i++) {
              const birdX = minX + (Math.random() * (maxX - minX));
              s.birds.push({ x: birdX, y: -100, vx: 0, vy: 0, state: 'sit', flapSpeed: 0.2 + Math.random() * 0.1, timer: Math.random() * 100 });
          }
      }
      s.flock = [];
      for(let i=0; i<8; i++) {
          s.flock.push({
              x: (Math.random() - 0.5) * 2000,
              y: 500 + Math.random() * 1000,
              vx: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3),
              vy: (Math.random() - 0.5) * 0.5,
              flapSpeed: 0.1 + Math.random() * 0.1,
              timer: Math.random() * 100
          });
      }
  }, [env]); 

  useEffect(() => {
      const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
      const fgCanvas = fgCanvasRef.current; 
      let fgCtx: CanvasRenderingContext2D | null = null;
      
      const resize = () => {
          const dpr = window.devicePixelRatio || 1; 
          const rect = canvas.getBoundingClientRect();
          canvas.width = rect.width * dpr; canvas.height = rect.height * dpr; 
          ctx.scale(dpr, dpr);

          if (fgCanvas) {
              fgCanvas.width = rect.width * dpr; 
              fgCanvas.height = rect.height * dpr;
              fgCtx = fgCanvas.getContext('2d');
              if (fgCtx) fgCtx.scale(dpr, dpr);
          }
      };
      resize();
      window.addEventListener('resize', resize);

      stateRef.current.startTime = Date.now();
      
      const isComplexGear = ['mechanical', 'insect', 'magnetic'].includes(shipConfig.landingGearType);
      const svgLegLength = isComplexGear ? 72 : 55;
      const maxSvgCompression = isComplexGear ? 15 : 10;
      
      const LEG_OFFSET = svgLegLength * DOM_SCALE; 
      const MAX_COMPRESSION_PX = maxSvgCompression * DOM_SCALE;

      // Determine Sun Color based on Quadrant
      const sunColor = (planet as Planet).quadrant === QuadrantType.ALFA ? '#facc15' : 
                       (planet as Planet).quadrant === QuadrantType.BETA ? '#ef4444' : 
                       (planet as Planet).quadrant === QuadrantType.GAMA ? '#3b82f6' : '#a855f7';

      const loop = () => {
          const dpr = window.devicePixelRatio || 1;
          const w = canvas.width / dpr; 
          const h = canvas.height / dpr;
          const cx = w / 2;
          const s = stateRef.current;
          
          s.frame++;
          const groundY = h - 90; 
          const padHeight = 20; 
          const padSurfaceY = groundY - padHeight;
          const touchY = padSurfaceY - (LEG_OFFSET - 4); 
          
          let currentScale = 0.1; 
          
          // --- PHYSICS UPDATE ---
          if (s.viewY > 1000) {
              if (phase !== 'reentry') {
                  setPhase('reentry');
                  // Re-entry Phase: Only Wind
                  audioService.startReEntryWind();
                  audioService.stopLandingThruster();
              }
              s.velocity = 20; 
              s.viewY -= s.velocity;
              currentScale = 0.1 + (1.0 - (s.viewY / 2000)) * 0.3; 
              s.shipY = h * 0.3; 
              // Re-entry shake
              s.shake = (Math.random() - 0.5) * 4; 
              s.reEntryHeat = Math.min(1, s.reEntryHeat + 0.05);
              s.isThrusting = false;
              s.thrustIntensity = 0;
              setStatus("RE-ENTRY INTERFACE");
              
              audioService.updateReEntryWind(s.reEntryHeat);
          } 
          else if (s.viewY > 200) {
              if (phase !== 'braking') {
                  setPhase('braking');
                  // Braking Phase: Cut wind, Start engine
                  // Stop wind BEFORE engine to avoid clash
                  audioService.stopReEntryWind(); 
                  audioService.playLandingIgnition(); // Start with a bang
                  audioService.startLandingThruster(); // Start rumble
              }
              
              s.velocity *= 0.96; 
              s.viewY -= s.velocity;
              if (s.velocity < 2) s.velocity = 2;
              currentScale = 0.4 + (1.0 - (s.viewY / 1000)) * 0.6; 
              const progress = 1.0 - (s.viewY / 1000);
              const targetY = touchY - 300; 
              s.shipY = (h * 0.3) + (targetY - (h * 0.3)) * progress;
              
              // Engine rumble shake
              s.shake = (Math.random() - 0.5) * 3; 
              s.reEntryHeat = Math.max(0, s.reEntryHeat - 0.05); 
              
              // Always thrusting in this phase to slow down
              s.isThrusting = true;
              s.thrustIntensity = Math.min(1.0, s.thrustIntensity + 0.05);
              setStatus("MAIN THRUSTERS ENGAGED");
              
              // Volume ramp up
              audioService.updateLandingThruster(0.8 * s.thrustIntensity);

              if (s.viewY < 600) {
                  s.legExtVal = Math.min(1, s.legExtVal + 0.02);
              }
          }
          else if (!s.hasThudded) {
              setPhase('approach');
              // Final Descent
              s.viewY = Math.max(0, s.viewY - s.velocity);
              s.velocity = Math.max(0.5, s.velocity * 0.9); 
              const dist = touchY - s.shipY;
              s.shipY += dist * 0.1;
              currentScale = 1.0;
              s.shake = (Math.random() - 0.5) * 1.5;
              s.legExtVal = Math.min(1, s.legExtVal + 0.05);
              s.isThrusting = true;
              const approachProgress = Math.max(0, s.viewY / 200);
              s.thrustIntensity = 0.4 + (0.6 * approachProgress);
              setStatus("FINAL DESCENT");
              
              audioService.updateLandingThruster(0.5 * s.thrustIntensity);
              
              if (Math.abs(s.shipY - touchY) < 4.0 && s.viewY < 5) {
                  s.hasThudded = true;
                  s.viewY = 0; 
                  s.thrustIntensity = 0;
                  s.suspensionVel = 3.0; 
                  
                  // LANDING SEQUENCE AUDIO: Cut Engine -> Clank -> Hiss
                  audioService.stopLandingThruster();
                  audioService.playOrbitLatch(); // Tank/Clank
                  audioService.playLandThud();   // Thud
                  audioService.playSteamRelease(); // Steam
                  
                  s.steamTimer = 120; 
                  for(let k=0; k<30; k++) { 
                      const dir = Math.random() > 0.5 ? 1 : -1; 
                      s.particles.push({ x: cx + dir * (20 + Math.random()*50), y: padSurfaceY, vx: dir * (2 + Math.random() * 8), vy: -0.5 - Math.random() * 2, size: 15 + Math.random() * 25, life: 2.5 + Math.random() * 1.0, maxLife: 3.0, type: 'dust', color: '#a1a1aa' }); 
                  }
              }
          }
          else {
              setPhase('landed');
              s.isThrusting = false;
              s.legExtVal = 1.0;
              setStatus("TOUCHDOWN CONFIRMED");
              s.shake = 0;
              currentScale = 1.0;
              const k = 0.15; const d = 0.85; 
              const force = -s.suspensionOffset * k;
              s.suspensionVel += force;
              s.suspensionVel *= d;
              s.suspensionOffset += s.suspensionVel;
              if (s.suspensionOffset < 0) { s.suspensionOffset = 0; s.suspensionVel = 0; }
              const compressionRatio = 1.0 - Math.min(1, Math.max(0, s.suspensionOffset / MAX_COMPRESSION_PX));
              setSuspension(compressionRatio);
              s.shipY = touchY + s.suspensionOffset;
              if (s.armRetract > 0) s.armRetract = Math.max(0, s.armRetract - 0.04);
              if (s.steamTimer > 0) {
                  s.steamTimer--;
                  if (s.steamTimer % 8 === 0 && s.steamTimer > 60) { 
                      for(let k=0; k<3; k++) { s.particles.push({ x: cx + (Math.random()-0.5)*70, y: padSurfaceY - 5, vx: (Math.random()-0.5)*3, vy: -0.5 - Math.random()*1.5, size: 8 + Math.random()*12, life: 2.0, maxLife: 2.0, type: 'steam', color: 'rgba(255,255,255,0.15)' }); }
                  }
              }
              s.autoCompleteTimer++;
              // PREVENTS JAM: Ensure onComplete called only once
              if (s.autoCompleteTimer > 400 && !s.hasCompleted) { 
                  s.hasCompleted = true;
                  onComplete();
              }
          }

          setAltitude(Math.floor(s.viewY + (touchY - s.shipY)));
          setSpeed(Math.floor(s.velocity * 50));
          setLegExtension(s.legExtVal);
          setThrustActive(s.isThrusting);

          // DRAWING
          
          // 1. CLEAR
          if (fgCtx) fgCtx.clearRect(0, 0, w, h);
          
          // 2. MAIN BACKGROUND CANVAS (Transition to Black at High Altitude)
          const spaceTransitionHeight = 3000;
          const spaceRatio = Math.min(1, Math.max(0, (s.viewY - 500) / spaceTransitionHeight));
          
          // Interpolate sky colors to black for space transition
          const sky1 = mixColor(env.skyGradient[0], '#000000', spaceRatio);
          const sky2 = mixColor(env.skyGradient[1], '#000000', spaceRatio);
          
          const grad = ctx.createLinearGradient(0, 0, 0, h); 
          grad.addColorStop(0, sky1); 
          grad.addColorStop(1, sky2); 
          ctx.fillStyle = grad; 
          ctx.fillRect(0, 0, w, h);

          // ADJUSTED STAR VISIBILITY LOGIC
          let starVis = 0;
          if (env.isDay) {
              const baseStarOpacity = Math.min(1, Math.max(0, (s.viewY - 200) / 1000));
              starVis = Math.max(baseStarOpacity, spaceRatio);
          } else {
              starVis = 0.8 + (spaceRatio * 0.2);
          }

          if (starVis > 0) {
              s.starScrollY += (s.velocity * 0.05); 
              ctx.fillStyle = '#ffffff'; 
              env.stars.forEach(star => { const sy = (star.y * h - s.starScrollY * star.size * 20) % h; ctx.globalAlpha = star.alpha * starVis; ctx.beginPath(); ctx.arc(star.x * w, (sy < 0 ? sy + h : sy), star.size, 0, Math.PI*2); ctx.fill(); }); 
              ctx.globalAlpha = 1.0;
          }

          // CELESTIAL BODIES (SUN / MOON / WANDERERS) - Drawn before hills
          const sunY = h * 0.2 + (s.viewY * 0.05); 
          const sunX = w * 0.7;
          let dimFactor = 0;

          // ... (Space Object Drawing Logic Same as Before) ...
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
              const dwarfDist = 120;
              const dwarfX = sunX + Math.cos(slowTime) * dwarfDist;
              const dwarfY = sunY + Math.sin(slowTime * 0.5) * 40; 
              const dwarfR = 15 * 0.7; 
              const zDepth = Math.sin(slowTime);
              const isBehind = zDepth < 0;
              
              if (isBehind) {
                  dimFactor = Math.min(0.7, Math.abs(zDepth) * 0.9);
              }

              const drawDwarf = () => {
                  ctx.fillStyle = '#ef4444';
                  ctx.shadowColor = '#ef4444';
                  ctx.shadowBlur = 20;
                  ctx.beginPath(); ctx.arc(dwarfX, dwarfY, dwarfR, 0, Math.PI*2); ctx.fill();
                  ctx.shadowBlur = 0;
              };

              const drawBlackHole = () => {
                  const bhRadius = 40;
                  const bhGrad = ctx.createRadialGradient(sunX, sunY, bhRadius*0.8, sunX, sunY, bhRadius*2.5);
                  bhGrad.addColorStop(0, '#000000');
                  bhGrad.addColorStop(0.4, '#4c1d95'); 
                  bhGrad.addColorStop(0.6, '#a855f7'); 
                  bhGrad.addColorStop(1, 'rgba(0,0,0,0)');
                  ctx.fillStyle = bhGrad;
                  ctx.beginPath(); ctx.arc(sunX, sunY, bhRadius*2.5, 0, Math.PI*2); ctx.fill();
                  
                  ctx.fillStyle = '#000000';
                  ctx.shadowColor = '#fff';
                  ctx.shadowBlur = 10;
                  ctx.beginPath(); ctx.arc(sunX, sunY, bhRadius, 0, Math.PI*2); ctx.fill();
                  ctx.shadowBlur = 0;

                  if (jetAlpha > 0) {
                      ctx.save();
                      ctx.globalAlpha = jetAlpha;
                      ctx.fillStyle = 'rgba(255,255,255,0.5)';
                      ctx.beginPath();
                      ctx.moveTo(sunX - 3, sunY - bhRadius);
                      ctx.lineTo(sunX + 3, sunY - bhRadius);
                      ctx.lineTo(sunX, sunY - 1000); 
                      ctx.fill();
                      ctx.beginPath();
                      ctx.moveTo(sunX - 3, sunY + bhRadius);
                      ctx.lineTo(sunX + 3, sunY + bhRadius);
                      ctx.lineTo(sunX, sunY + 1000); 
                      ctx.fill();
                      ctx.restore();
                  }
              };

              if (isBehind) {
                  drawDwarf();
                  drawBlackHole();
              } else {
                  drawBlackHole();
                  drawDwarf();
              }

          } else {
              if (env.isDay) {
                  const sunR = 40;
                  const sGrad = ctx.createRadialGradient(sunX, sunY, sunR*0.2, sunX, sunY, sunR*2.5);
                  sGrad.addColorStop(0, sunColor); 
                  sGrad.addColorStop(1, 'rgba(0,0,0,0)');
                  ctx.fillStyle = sGrad;
                  ctx.beginPath(); ctx.arc(sunX, sunY, sunR*2.5, 0, Math.PI*2); ctx.fill();
                  ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.8; 
                  ctx.beginPath(); ctx.arc(sunX, sunY, sunR*0.8, 0, Math.PI*2); ctx.fill(); 
                  ctx.globalAlpha = 1.0;
              } else {
                  const moonR = 30;
                  ctx.fillStyle = '#fff';
                  ctx.shadowColor = '#fff';
                  ctx.shadowBlur = 15;
                  ctx.beginPath(); ctx.arc(sunX, sunY, moonR, 0, Math.PI*2); ctx.fill();
                  ctx.shadowBlur = 0;
                  
                  const phaseShift = (Date.now() / 10000) % Math.PI; 
                  ctx.fillStyle = 'rgba(0,0,0,0.8)';
                  ctx.beginPath(); 
                  ctx.arc(sunX - (Math.cos(phaseShift)*15), sunY, moonR, 0, Math.PI*2); 
                  ctx.fill();
              }
          }

          if (env.wanderers && env.wanderers.length > 0 && starVis > 0.3) { 
              env.wanderers.forEach(wd => {
                  const wx = (wd.x * w + s.startTime * 0.005) % (w + 100) - 50;
                  const wy = wd.y * h;
                  ctx.fillStyle = wd.color;
                  ctx.shadowColor = wd.color;
                  ctx.shadowBlur = 10;
                  ctx.globalAlpha = starVis;
                  ctx.beginPath();
                  ctx.arc(wx, wy, wd.size, 0, Math.PI*2);
                  ctx.fill();
                  ctx.shadowBlur = 0;
                  
                  if (wd.hasRings) {
                      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                      ctx.lineWidth = 2;
                      ctx.beginPath();
                      ctx.ellipse(wx, wy, wd.size * 2, wd.size * 0.5, -0.2, 0, Math.PI*2);
                      ctx.stroke();
                  }
                  ctx.globalAlpha = 1.0;
              });
          }

          if (s.viewY > 200 && s.viewY < 3000) {
              ctx.fillStyle = '#000';
              s.flock.forEach(bird => {
                  bird.x += bird.vx; bird.y -= s.velocity * 0.5; bird.timer += bird.flapSpeed;
                  const wingOffset = Math.sin(bird.timer) * 4;
                  if (bird.x > w + 50) bird.x = -50; if (bird.x < -50) bird.x = w + 50;
                  const screenY = (bird.y + s.viewY * 0.5) % (h + 500) - 250;
                  if (screenY > -50 && screenY < h + 50) { ctx.beginPath(); ctx.moveTo(bird.x - 4, screenY + wingOffset); ctx.lineTo(bird.x, screenY); ctx.lineTo(bird.x + 4, screenY + wingOffset); ctx.stroke(); }
              });
          }

          // RENDER CLOUDS (Background on ctx, Foreground on fgCtx)
          if (env.clouds && env.clouds.length > 0 && s.viewY < 15000) {
              const cloudSpaceRatio = Math.min(1, s.viewY / 15000); 
              env.clouds.forEach(c => { 
                  let pFactor = 0.6;
                  if (c.layer === 0) pFactor = 0.2;
                  if (c.layer === 2) pFactor = 1.2;

                  const cloudY = (c.y + s.viewY * pFactor) % (h + 800) - 400; 
                  const cloudX = (c.x + (Date.now() - s.startTime)*0.01 * c.speed) % (w + 800) - 400; 
                  
                  if (cloudY < h + 400 && cloudY > -400) { 
                      if (c.layer === 2) {
                          if (fgCtx) drawCloud(fgCtx, cloudX, cloudY, c.w, c.alpha * (1 - cloudSpaceRatio), c.color);
                      } else {
                          drawCloud(ctx, cloudX, cloudY, c.w, c.alpha * (1 - cloudSpaceRatio), c.color);
                      }
                  } 
              });
          }

          const worldY = groundY + s.viewY + s.shake;
          ctx.save();
          ctx.translate(cx, worldY); 

          // ... (Environment Rendering) ...
          // HILLS RENDER - Back to Front
          env.hills.forEach((hill: any, i: number) => {
              const pFactor = hill.parallaxFactor;
              const yOff = (s.viewY * pFactor * 0.1); 
              const hillW = 3000;
              const hillHeight = hill.type === 'mountain' ? 500 : 300;
              
              ctx.fillStyle = hill.color;
              ctx.beginPath();
              
              const p0 = hill.points[0];
              const px0 = p0.xRatio * hillW - 1500;
              const py0 = -(p0.heightRatio * hillHeight) - 50 + yOff;
              
              ctx.moveTo(-w, h); 
              ctx.lineTo(px0, h);
              ctx.lineTo(px0, py0);

              // TERRAIN DRAWING
              const pathPoints: {x:number, y:number}[] = [];
              
              if (hill.type === 'hill') {
                  for (let j = 0; j < hill.points.length - 1; j++) {
                      const pCurrent = hill.points[j];
                      const pNext = hill.points[j + 1];
                      const x1 = pCurrent.xRatio * hillW - 1500;
                      const y1 = -(pCurrent.heightRatio * hillHeight) - 50 + yOff;
                      const x2 = pNext.xRatio * hillW - 1500;
                      const y2 = -(pNext.heightRatio * hillHeight) - 50 + yOff;
                      const xc = (x1 + x2) / 2;
                      const yc = (y1 + y2) / 2;
                      ctx.quadraticCurveTo(x1, y1, xc, yc);
                      
                      // Collect path points for road
                      if (hill.hasRoad) {
                          if (j === 0) pathPoints.push({x: x1, y: y1});
                          pathPoints.push({x: xc, y: yc});
                          if (j === hill.points.length - 2) pathPoints.push({x: x2, y: y2});
                      }
                  }
                  const lastP = hill.points[hill.points.length - 1];
                  const lx = lastP.xRatio * hillW - 1500;
                  const ly = -(lastP.heightRatio * hillHeight) - 50 + yOff;
                  ctx.lineTo(lx, ly);
              } else {
                  for (let j = 1; j < hill.points.length - 1; j++) {
                      const pCurr = hill.points[j];
                      const pNext = hill.points[j + 1];
                      const xCurr = pCurr.xRatio * hillW - 1500;
                      const yCurr = -(pCurr.heightRatio * hillHeight) - 50 + yOff;
                      const xNextP = pNext.xRatio * hillW - 1500;
                      const yNextP = -(pNext.heightRatio * hillHeight) - 50 + yOff;
                      ctx.arcTo(xCurr, yCurr, xNextP, yNextP, 12);
                  }
                  const lastP = hill.points[hill.points.length - 1];
                  const lx = lastP.xRatio * hillW - 1500;
                  const ly = -(lastP.heightRatio * hillHeight) - 50 + yOff;
                  ctx.lineTo(lx, ly);
                  ctx.lineJoin = 'round';
                  ctx.lineWidth = 10;
              }

              ctx.lineTo(w, h);
              ctx.fill();
              ctx.lineJoin = 'miter'; 
              ctx.lineWidth = 1;

              // TRAINS
              if (hill.hasTrainTrack && env.trains.length > 0) {
                  ctx.strokeStyle = '#27272a'; ctx.lineWidth = 4; ctx.beginPath();
                  let first = true;
                  hill.points.forEach((p:any) => {
                      const px = (p.xRatio * hillW) - 1500;
                      const py = -(p.heightRatio * hillHeight) - 50 + yOff;
                      if(first) { ctx.moveTo(px, py); first=false; } else ctx.lineTo(px, py);
                  });
                  ctx.stroke();
                  env.trains.forEach(train => {
                      train.progress += train.speed * (train.dir || 1);
                      if (train.progress > 1) train.progress -= 1; 
                      if (train.progress < 0) train.progress += 1;
                      const idxF = train.progress * (hill.points.length - 1);
                      const idx = Math.floor(idxF);
                      const sub = idxF - idx;
                      const p1 = hill.points[idx];
                      const p2 = hill.points[Math.min(idx+1, hill.points.length-1)];
                      if (p1 && p2) {
                          const x1 = (p1.xRatio * hillW) - 1500;
                          const y1 = -(p1.heightRatio * hillHeight) - 50 + yOff;
                          const x2 = (p2.xRatio * hillW) - 1500;
                          const y2 = -(p2.heightRatio * hillHeight) - 50 + yOff;
                          const tx = x1 + (x2 - x1) * sub;
                          const ty = y1 + (y2 - y1) * sub;
                          const angle = Math.atan2(y2-y1, x2-x1);
                          for(let k=0; k<train.cars; k++) {
                              const carOff = k * 35; 
                              const cx = tx - (Math.cos(angle) * carOff * train.dir);
                              const cy = ty - (Math.sin(angle) * carOff * train.dir);
                              drawVehicle(ctx, cx, cy - 6, angle, k===0 ? 'train' : 'car', train.color, env.isDay, train.dir);
                          }
                      }
                  });
              }

              // ROADS - Updated to follow terrain curve
              if (hill.hasRoad && pathPoints.length > 0) {
                  ctx.beginPath();
                  pathPoints.forEach((p, idx) => { if(idx===0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
                  ctx.strokeStyle = '#333'; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.stroke();
                  ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
                  
                  if (env.cars.length > 0 && s.viewY < 1000) {
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
                              drawVehicle(ctx, vx, vy - 4, angle, 'car', car.color, env.isDay, car.dir);
                          }
                      });
                  }
                  
                  // STREET LIGHTS
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

              // HILL FEATURES (TREES) - Drawn AFTER roads to be visually on top (in front)
              if (hill.trees) {
                  hill.trees.forEach((t: any, tIdx: number) => {
                      const p1 = hill.points[t.segIdx]; const p2 = hill.points[t.segIdx+1];
                      if (p1 && p2) {
                          const x1 = p1.xRatio * hillW - 1500; 
                          const y1 = - (p1.heightRatio * 300) - 50 + yOff; 
                          const x2 = p2.xRatio * hillW - 1500; 
                          const y2 = - (p2.heightRatio * 300) - 50 + yOff;
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

          // GROUND
          ctx.fillStyle = env.groundColor;
          ctx.fillRect(-w, 0, w*2, h*2); 
          drawPlatform(ctx, 0, 0, env.isOcean);

          // FEATURES & POWER LINES
          env.features.forEach(f => {
              const fy = f.yOff || 0; 
              // Steam Emitter for Power Plant
              if (f.type === 'power_plant' && !f.isUnderground) {
                  if (Math.random() > 0.8) {
                      s.particles.push({
                          x: f.x + 40, 
                          y: fy - 80, 
                          vx: (Math.random()-0.5)*1,
                          vy: -1 - Math.random()*1,
                          life: 1.0, maxLife: 1.0,
                          size: 5 + Math.random()*5,
                          color: 'rgba(255,255,255,0.1)',
                          type: 'steam'
                      });
                  }
              }

              if (f.type === 'tower') drawTower(ctx, f.x, fy, f, env.isDay, env.isOcean, s.armRetract);
              else if (f.type === 'dome_std') drawDome(ctx, f.x, fy, f, !!env.isOcean);
              else if (f.type === 'building_std' || f.type === 'power_pole' || f.type === 'hangar') drawBuilding(ctx, { ...f, y: fy }, env.isDay, env.isOcean);
              else if (f.type === 'power_plant') drawPowerPlant(ctx, f.x, fy, f.scale, f.isUnderground);
          });

          if (env.powerLines) {
              env.powerLines.forEach((chain: any[]) => {
                  ctx.strokeStyle = '#18181b'; ctx.lineWidth = 1;
                  for (let k=0; k<chain.length-1; k++) {
                      const p1 = chain[k]; const p2 = chain[k+1];
                      const y1 = -p1.h + (p1.yOff || 0);
                      const y2 = -p2.h + (p2.yOff || 0);
                      
                      // Draw 3 wires
                      for(let wIdx=0; wIdx<3; wIdx++) {
                          const sag = 15 + (wIdx * 5);
                          const midX = (p1.x + p2.x) / 2;
                          const midY = Math.max(y1, y2) + sag;
                          ctx.beginPath();
                          ctx.moveTo(p1.x, y1 + (wIdx * 4));
                          ctx.quadraticCurveTo(midX, midY + (wIdx * 4), p2.x, y2 + (wIdx * 4));
                          ctx.stroke();
                      }
                  }
              });
          }

          ctx.restore();

          // Darken Planet on Eclipse (Delta Quadrant)
          if (dimFactor > 0) {
              ctx.fillStyle = `rgba(0,0,0,${dimFactor})`;
              ctx.fillRect(0, 0, w, h);
          }

          // RE-ENTRY VISUALS (Updated Soft Plasma)
          if ((s.viewY > 200 && s.viewY < 3000) && !s.isThrusting) {
              const shieldY = s.shipY + 20;
              const shieldScale = currentScale * 1.5;
              
              ctx.save();
              ctx.translate(cx, shieldY);
              ctx.scale(shieldScale, shieldScale);
              
              // 1. Plasma Shield (Rainbow Gradient Arc)
              const grad = ctx.createRadialGradient(0, -20, 30, 0, -10, 60);
              // Spectrum: White -> Cyan -> Green -> Yellow -> Red -> Purple
              grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); 
              grad.addColorStop(0.2, 'rgba(34, 211, 238, 0.6)'); // Cyan
              grad.addColorStop(0.4, 'rgba(34, 197, 94, 0.5)'); // Green
              grad.addColorStop(0.6, 'rgba(250, 204, 21, 0.4)'); // Yellow
              grad.addColorStop(0.8, 'rgba(239, 68, 68, 0.3)'); // Red
              grad.addColorStop(1, 'rgba(168, 85, 247, 0)'); // Purple Fade
              
              ctx.fillStyle = grad;
              ctx.globalCompositeOperation = 'screen';
              ctx.beginPath();
              // Semi-circle arc
              ctx.arc(0, -20, 60, 0, Math.PI, false);
              ctx.fill();

              // 2. Plasma Trails (Diffuse Particles)
              if (s.frame % 2 === 0) {
                  for(let t=0; t<3; t++) {
                      const xOff = (Math.random() - 0.5) * 80;
                      const size = 10 + Math.random() * 15;
                      const speed = 8 + Math.random() * 8;
                      // Randomize colors for rainbow effect
                      const colors = ['#22d3ee', '#facc15', '#ef4444', '#a855f7'];
                      const pColor = colors[Math.floor(Math.random() * colors.length)];
                      
                      s.particles.push({
                          x: cx + xOff * shieldScale, 
                          y: shieldY - 10, 
                          vx: (Math.random()-0.5) * 3, 
                          vy: -speed * 2, // Upwards relative to ship falling
                          life: 0.5 + Math.random() * 0.5, 
                          maxLife: 1.0, 
                          size: size * shieldScale,
                          type: 'plasma', 
                          color: pColor,
                          decay: 0.04
                      });
                  }
              }
              ctx.restore();
          }

          // PARTICLES RENDER
          if (s.isThrusting) {
              const spawnCount = 5; 
              for(let i=0; i<spawnCount; i++) {
                  const eng = engineLocs[Math.floor(Math.random() * engineLocs.length)];
                  const nozzleRelX = (eng.x - 50) * DOM_SCALE;
                  const nozzleRelY = (eng.y + eng.h + 6 - 50) * DOM_SCALE;
                  let pType = 'fire';
                  let pColor = Math.random() > 0.5 ? '#ef4444' : '#facc15'; 
                  
                  s.particles.push({
                      x: cx + nozzleRelX + (Math.random()-0.5)*3,
                      y: s.shipY + s.shake + nozzleRelY,
                      vx: (Math.random()-0.5) * 2,
                      vy: (6 + Math.random() * 6), 
                      life: 0.5,
                      maxLife: 0.5,
                      size: 4 + Math.random() * 4, 
                      type: pType,
                      color: pColor,
                      decay: 0.05,
                      grow: 0.5 
                  });
              }
          }

          s.particles.forEach(p => {
              if (p.type === 'plasma') {
                  p.x += p.vx;
                  p.y += p.vy; // Moves UP
                  p.life -= p.decay || 0.02;
                  p.size *= 0.96; // Shrink
              } else {
                  p.x += p.vx;
                  p.y += p.vy;
                  p.life -= p.decay || 0.01;
                  if (p.grow) p.size += p.grow;
                  
                  const currentGroundY = worldY;
                  if (p.y > currentGroundY && p.vy > 0 && p.type !== 'steam') {
                      p.y = currentGroundY;
                      p.vy = 0;
                      p.vx = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 10); // Spread
                      p.grow = 2.0;
                      p.decay = 0.1; 
                  }
              }

              if (p.life > 0) {
                  ctx.save();
                  ctx.globalAlpha = p.life;
                  ctx.fillStyle = p.color || '#fff';
                  
                  if (p.type === 'fire' || p.type === 'plasma') {
                      ctx.globalCompositeOperation = 'screen';
                      ctx.shadowColor = p.color || '#f00';
                      ctx.shadowBlur = p.type === 'plasma' ? 20 : 10;
                  }
                  
                  ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
                  ctx.restore();
              }
          });
          s.particles = s.particles.filter(p => p.life > 0);

          if (shipDOMRef.current) {
              const shipScreenY = s.shipY + s.shake;
              shipDOMRef.current.style.transform = `translate(-50%, -50%) translate(${cx}px, ${shipScreenY}px) scale(${currentScale})`;
          }
          
          requestAnimationFrame(loop);
      };

      const animId = requestAnimationFrame(loop);
      return () => { 
          window.removeEventListener('resize', resize);
          cancelAnimationFrame(animId);
          // Cleanup handled by effect above
      };
  }, [env, shipConfig, engineLocs]);

  return (
    <div className="fixed inset-0 z-[5000] bg-black overflow-hidden font-mono select-none absolute w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 z-0 w-full h-full" />
      <canvas ref={fgCanvasRef} className="absolute inset-0 z-30 pointer-events-none w-full h-full" />
      
      <SequenceStatusBar 
          altitude={altitude} 
          velocity={speed} 
          fuel={visualFuel} 
          maxFuel={maxFuel} 
          status={status} 
          onSkip={onComplete} 
          phase={phase} 
      />
      
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
            jetType="combustion" 
            showGear={false} 
            hullColor={shipConfig.defaultColor} 
            weaponId={weaponId} 
            equippedWeapons={equippedWeapons} 
        />
      </div>
    </div>
  );
};
