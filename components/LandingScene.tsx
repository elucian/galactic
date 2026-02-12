
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Planet, Moon, QuadrantType, EquippedWeapon } from '../types.ts';
import { SHIPS, ExtendedShipConfig } from '../constants.ts';
import { ShipIcon } from './ShipIcon.tsx';
import { audioService } from '../services/audioService.ts';
import { LandingGear } from './LandingGear.tsx';
import { drawDome, drawPlatform, getEngineCoordinates, drawPowerPlant, drawRock, generatePlanetEnvironment, drawBuilding, drawVehicle, drawStreetLight, drawTower, drawCloud, drawResort, drawMining, getShipHullWidths, drawBird, drawLightning, drawScorpion, drawLizard, drawLargeBird } from '../utils/drawingUtils.ts';
import { SequenceStatusBar } from './SequenceStatusBar.tsx';

interface LandingSceneProps {
  planet: Planet;
  shipShape: string;
  shipConfig?: ExtendedShipConfig;
  shipColors: {
      hull?: string;
      wings?: string;
      cockpit?: string;
      cockpit_highlight?: string;
      guns?: string;
      secondary_guns?: string;
      gun_body?: string;
      engines?: string;
      nozzles?: string;
      bars?: string;
  };
  onComplete: () => void;
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

export const LandingScene: React.FC<LandingSceneProps> = ({ planet, shipShape, shipConfig: propShipConfig, shipColors, onComplete, weaponId, equippedWeapons, currentFuel, maxFuel }) => {
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
  
  // Animation State Hooks for Visuals
  const [armPos, setArmPos] = useState(0);
  const [accPos, setAccPos] = useState(0);
  
  const phaseRef = useRef<'reentry' | 'braking' | 'approach' | 'landed'>('reentry');

  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const DOM_SCALE = 1.28;

  const shipConfig = useMemo(() => {
      if (propShipConfig) return propShipConfig;
      const match = SHIPS.find((s) => s.shape === shipShape);
      return match || SHIPS[0];
  }, [shipShape, propShipConfig]);

  const engineLocs = useMemo(() => getEngineCoordinates(shipConfig), [shipConfig]);
  const hullWidths = useMemo(() => getShipHullWidths(shipConfig), [shipConfig]);
  
  const env = useMemo(() => generatePlanetEnvironment(planet as Planet), [planet]);
  const envRef = useRef(env);
  useEffect(() => { envRef.current = env; }, [env]);

  const stateRef = useRef({
    startTime: 0,
    siteOffset: 0, 
    birds: [] as any[],
    flock: [] as any[], 
    particles: [] as {x: number, y: number, vx: number, vy: number, size: number, life: number, maxLife: number, type: string, color?: string, decay?: number, grow?: number, initialAlpha?: number}[],
    shipY: -200, viewY: 2000, velocity: 25, thrustIntensity: 0, frame: 0, hasThudded: false, hasCompleted: false, 
    shake: 0, steamTimer: 0, autoCompleteTimer: 0, suspensionOffset: 0.0, suspensionVel: 0.0, internalFuel: currentFuel, reEntryHeat: 0, legExtVal: 0, isThrusting: false,
    // Animation Logic
    armPos: 0.0, 
    accPos: 0.0,
    landedFrame: -1,
    // Weather States
    rain: [] as {x: number, y: number, len: number, speed: number}[],
    lightning: { active: false, x: 0, timer: 0 },
    birdFlock: [] as {x: number, y: number, vx: number, vy: number, flap: number}[],
    largeBirds: [] as {x: number, y: number, radius: number, angle: number, speed: number, size: number}[],
    critters: [] as {x: number, y: number, type: 'scorpion'|'lizard', vx: number, frame: number, dir: number}[],
    // Night Logic
    isNightLanding: false,
    wanderers: [] as {x: number, y: number, size: number, color: string}[],
    moons: [] as {x: number, y: number, size: number, color: string, type?: string, phase?: number}[],
    comet: null as { x: number, y: number, vx: number, vy: number, tailLen: number } | null
  });

  useEffect(() => {
      audioService.stop(); 
      audioService.startReEntryWind();
      if (audioService.startLandingThruster) audioService.startLandingThruster();
      if (audioService.updateLandingThruster) audioService.updateLandingThruster(0);
      
      // Safety delay to prevent accidental skip from previous screen (e.g. holding Space to fire)
      let canSkip = false;
      const timer = setTimeout(() => { canSkip = true; }, 1500);

      const handleKeyDown = (e: KeyboardEvent) => { 
          if (e.code === 'Space') { 
              if (!canSkip) return;
              e.preventDefault(); audioService.stopReEntryWind(); audioService.stopLandingThruster(); audioService.stop(); onCompleteRef.current(); 
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => { clearTimeout(timer); audioService.stopReEntryWind(); audioService.stopLandingThruster(); window.removeEventListener('keydown', handleKeyDown); };
  }, []);

  useEffect(() => {
      if (phase === 'reentry') { audioService.startReEntryWind(); } 
      else if (phase === 'braking') { audioService.stopReEntryWind(); audioService.playLandingIgnition(); audioService.startLandingThruster(); } 
      else if (stateRef.current.hasThudded) { audioService.stopLandingThruster(); audioService.playOrbitLatch(); audioService.playLandThud(); audioService.playSteamRelease(); }
  }, [phase]);

  useEffect(() => {
      const s = stateRef.current; 
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      // --- NIGHT LANDING LOGIC ---
      if (planet.quadrant === QuadrantType.DELTA) {
          s.isNightLanding = Math.random() < 0.6;
      } else {
          s.isNightLanding = Math.random() < 0.5; // Standard 50%
      }
      
      // Initialize Celestial Bodies for Night Mode
      if (s.isNightLanding) {
          s.wanderers = [
              { x: w * 0.2 + (Math.random() * w * 0.2), y: h * 0.15, size: 3, color: '#fca5a5' }, 
              { x: w * 0.6 + (Math.random() * w * 0.3), y: h * 0.25, size: 5, color: '#93c5fd' }  
          ];
          
          let moonsToShow = 0;
          if (planet.quadrant === QuadrantType.DELTA) {
              if (planet.id === 'p10') moonsToShow = 1;      
              else if (planet.id === 'p11') moonsToShow = 1; 
              else if (planet.id === 'p12') moonsToShow = 2; 
              else moonsToShow = 1; 
          } else {
              const dataCount = planet.moons ? planet.moons.length : 0;
              const procCount = 1 + (planet.id.charCodeAt(planet.id.length - 1) % 3); 
              const totalPotential = dataCount > 0 ? dataCount : procCount;
              if (totalPotential > 0 && Math.random() < 0.9) {
                  moonsToShow = 1;
                  if (totalPotential > 1 && Math.random() < 0.5) {
                      moonsToShow = Math.min(3, totalPotential);
                  }
              }
          }

          s.moons = [];
          for (let i = 0; i < moonsToShow; i++) {
              let r = 4 + Math.random() * 6; 
              if (planet.quadrant === QuadrantType.DELTA && planet.id === 'p12') {
                  if (i === 0) r = 9; 
                  else r = 4.5;       
              }
              const type = r > 6 ? 'phaser' : 'static';
              s.moons.push({
                  x: w * (0.15 + (i * 0.25) + (Math.random() * 0.1)), 
                  y: h * (0.1 + (Math.random() * 0.2)), 
                  size: r,
                  color: '#e2e8f0', 
                  type: type,
                  phase: Math.random() 
              });
          }

          if (env.quadrant === QuadrantType.GAMA) {
              s.comet = {
                  x: w * 0.1 + (Math.random() * w * 0.8),
                  y: window.innerHeight * 0.15 + (Math.random() * window.innerHeight * 0.2),
                  vx: -0.07 - (Math.random() * 0.05), 
                  vy: 0.01 + (Math.random() * 0.01),
                  tailLen: 80 + (Math.random() * 40)
              };
          } else {
              s.comet = null;
          }
      } else {
          s.comet = null;
          s.moons = [];
      }

      s.birds = []; s.flock = [];
      // Powerline birds (Small) - Only if Day and Has Small Birds
      if (env.powerLines.length > 0 && env.hasSmallBirds && !s.isNightLanding) { 
          const numBirds = 12 + Math.floor(Math.random() * 8); 
          const chain = env.powerLines[0]; 
          const minX = Math.min(chain[0].x, chain[chain.length-1].x); 
          const maxX = Math.max(chain[0].x, chain[chain.length-1].x); 
          for(let i=0; i<numBirds; i++) { 
              const birdX = minX + (Math.random() * (maxX - minX)); 
              s.birds.push({ x: birdX, y: -100, vx: 0, vy: 0, state: 'sit', flapSpeed: 0.2 + Math.random() * 0.1, timer: Math.random() * 100 }); 
          } 
      }
      
      // Init Small Bird Flock - Only if Day and Has Small Birds
      if (env.hasSmallBirds && !s.isNightLanding) {
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

      // Init Large Birds - Only if Day and Has Large Birds
      if (env.hasLargeBirds && !s.isNightLanding) {
          const count = 1 + Math.floor(Math.random() * 2);
          for(let i=0; i<count; i++) {
              s.largeBirds.push({
                  x: Math.random() * 2000 - 1000, // Center of circle
                  y: 200 + Math.random() * 300,   // Altitude
                  radius: 100 + Math.random() * 100,
                  angle: Math.random() * Math.PI * 2,
                  speed: 0.01 + Math.random() * 0.01,
                  size: 6 + Math.random() * 4
              });
          }
      }

      // Init Critters - Only if Has Critters (Desert Day)
      if (env.hasCritters && !s.isNightLanding) {
          const count = 2 + Math.floor(Math.random() * 3);
          for(let i=0; i<count; i++) {
              s.critters.push({
                  x: (Math.random() - 0.5) * 800, // Spread out on ground
                  y: 0, // Will be adjusted relative to groundY
                  type: Math.random() > 0.6 ? 'scorpion' : 'lizard',
                  vx: (Math.random() > 0.5 ? 1 : -1) * (0.2 + Math.random() * 0.3),
                  frame: Math.random() * 100,
                  dir: Math.random() > 0.5 ? 1 : -1
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
      const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
      const fgCanvas = fgCanvasRef.current; let fgCtx: CanvasRenderingContext2D | null = null;
      const resize = () => { const dpr = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); canvas.width = rect.width * dpr; canvas.height = rect.height * dpr; ctx.scale(dpr, dpr); if (fgCanvas) { fgCanvas.width = rect.width * dpr; fgCanvas.height = rect.height * dpr; fgCtx = fgCanvas.getContext('2d'); if (fgCtx) fgCtx.scale(dpr, dpr); } };
      resize(); window.addEventListener('resize', resize);

      stateRef.current.startTime = Date.now();
      const isComplexGear = ['mechanical', 'insect', 'magnetic'].includes(shipConfig.landingGearType);
      const svgLegLength = isComplexGear ? 72 : 55; const LEG_OFFSET = svgLegLength * DOM_SCALE; const MAX_COMPRESSION_PX = (isComplexGear ? 15 : 10) * DOM_SCALE;
      const sunColor = (planet as Planet).quadrant === QuadrantType.ALFA ? '#facc15' : (planet as Planet).quadrant === QuadrantType.BETA ? '#ef4444' : (planet as Planet).quadrant === QuadrantType.GAMA ? '#3b82f6' : '#a855f7';
      const planetIdVal = (planet.id.charCodeAt(0) * 100) + planet.id.charCodeAt(1); const moonPhaseShift = (planetIdVal % 100) / 100 * Math.PI * 2;

      const loop = () => {
          const env = envRef.current; const dpr = window.devicePixelRatio || 1; const w = canvas.width / dpr; const h = canvas.height / dpr; const cx = w / 2; const s = stateRef.current;
          
          const drawCloudsByLayer = (targetLayer: number, targetCtx: CanvasRenderingContext2D) => {
              const spaceTransitionHeight = 3000;
              const spaceRatio = Math.min(1, Math.max(0, (s.viewY - 500) / spaceTransitionHeight));
              
              if (env.clouds && env.clouds.length > 0 && spaceRatio < 0.95) {
                  const stretchFactor = 1.0;
                  const wrapWidth = w + 1000;
                  const wrapOffset = 500;
                  const groundY = h - 90;

                  env.clouds.forEach((c: any) => {
                      if (c.layer !== targetLayer) return;
                      const yOff = s.viewY * (1 - (c.parallaxFactor + 0.1));
                      const drawY = -c.altitude - yOff;
                      
                      let distMoved = s.frame * c.speed * c.direction;
                      let rawX = (c.x + distMoved) % wrapWidth;
                      if (rawX < 0) rawX += wrapWidth;
                      const cloudX = rawX - wrapOffset;
                      
                      const pulse = Math.sin((s.frame * 0.01) + (c.id || 0));
                      const opacity = Math.max(0, Math.min(1, c.baseAlpha * (0.8 + 0.2 * pulse) * (1 - spaceRatio)));
                      const screenY = (groundY + s.viewY + s.shake) + drawY;

                      if (screenY > -200 && screenY < h + 200 && opacity > 0.01) {
                          drawCloud(targetCtx, cloudX, drawY, c.w, opacity, c.color, c.puffs, stretchFactor);
                      }
                  });
              }
          };

          s.frame++; const groundY = h - 90; const padHeight = 20; const padSurfaceY = groundY - padHeight; const touchY = padSurfaceY - (LEG_OFFSET - 4); let currentScale = 0.1; 
          
          if (s.viewY > 1000) { if (phaseRef.current !== 'reentry') { setPhase('reentry'); phaseRef.current = 'reentry'; } s.velocity = 20; s.viewY -= s.velocity; currentScale = 0.1 + (1.0 - (s.viewY / 2000)) * 0.3; s.shipY = h * 0.3; s.shake = (Math.random() - 0.5) * 4; s.reEntryHeat = Math.min(1, s.reEntryHeat + 0.05); s.isThrusting = false; s.thrustIntensity = 0; setStatus("RE-ENTRY INTERFACE"); audioService.updateReEntryWind(s.reEntryHeat); } 
          else if (s.viewY > 200) { if (phaseRef.current !== 'braking') { setPhase('braking'); phaseRef.current = 'braking'; } s.velocity *= 0.96; s.viewY -= s.velocity; if (s.velocity < 2) s.velocity = 2; currentScale = 0.4 + (1.0 - (s.viewY / 1000)) * 0.6; const progress = 1.0 - (s.viewY / 1000); const targetY = touchY - 300; s.shipY = (h * 0.3) + (targetY - (h * 0.3)) * progress; s.shake = (Math.random() - 0.5) * 3; s.reEntryHeat = Math.max(0, s.reEntryHeat - 0.05); s.isThrusting = true; s.thrustIntensity = Math.min(1.0, s.thrustIntensity + 0.05); setStatus("MAIN THRUSTERS ENGAGED"); audioService.updateLandingThruster(0.8 * s.thrustIntensity); if (s.viewY < 600) s.legExtVal = Math.min(1, s.legExtVal + 0.02); }
          else if (!s.hasThudded) { if (phaseRef.current !== 'approach') { setPhase('approach'); phaseRef.current = 'approach'; } s.viewY = Math.max(0, s.viewY - s.velocity); s.velocity = Math.max(0.5, s.velocity * 0.9); const dist = touchY - s.shipY; s.shipY += dist * 0.1; currentScale = 1.0; s.shake = (Math.random() - 0.5) * 1.5; s.legExtVal = Math.min(1, s.legExtVal + 0.05); s.isThrusting = true; const approachProgress = Math.max(0, s.viewY / 200); s.thrustIntensity = 0.4 + (0.6 * approachProgress); setStatus("FINAL DESCENT"); audioService.updateLandingThruster(0.5 * s.thrustIntensity); if (Math.abs(s.shipY - touchY) < 4.0 && s.viewY < 5) { s.hasThudded = true; s.landedFrame = s.frame; s.viewY = 0; s.thrustIntensity = 0; s.suspensionVel = 3.0; s.steamTimer = 120; for(let k=0; k<30; k++) { const dir = Math.random() > 0.5 ? 1 : -1; s.particles.push({ x: cx + dir * (20 + Math.random()*50), y: padSurfaceY, vx: dir * (2 + Math.random() * 8), vy: -0.5 - Math.random() * 2, size: 15 + Math.random() * 25, life: 2.5 + Math.random() * 1.0, maxLife: 3.0, type: 'dust', color: '#a1a1aa' }); } setPhase(p => p); } }
          else { 
              if (phaseRef.current !== 'landed') { setPhase('landed'); phaseRef.current = 'landed'; } 
              s.isThrusting = false; s.legExtVal = 1.0; setStatus("TOUCHDOWN CONFIRMED"); s.shake = 0; currentScale = 1.0; const k = 0.15; const d = 0.85; const force = -s.suspensionOffset * k; s.suspensionVel += force; s.suspensionVel *= d; s.suspensionOffset += s.suspensionVel; if (s.suspensionOffset < 0) { s.suspensionOffset = 0; s.suspensionVel = 0; } const compressionRatio = 1.0 - Math.min(1, Math.max(0, s.suspensionOffset / MAX_COMPRESSION_PX)); setSuspension(compressionRatio); s.shipY = touchY + s.suspensionOffset; if (s.steamTimer > 0) { s.steamTimer--; if (s.steamTimer % 8 === 0 && s.steamTimer > 60) { for(let k=0; k<3; k++) { s.particles.push({ x: cx + (Math.random()-0.5)*70, y: padSurfaceY - 5, vx: (Math.random()-0.5)*3, vy: -0.5 - Math.random()*1.5, size: 8 + Math.random()*12, life: 2.0, maxLife: 2.0, type: 'steam', color: 'rgba(255,255,255,0.15)' }); } } } 
              
              if (s.hasThudded && s.landedFrame > 0) {
                  const elapsed = s.frame - s.landedFrame;
                  if (elapsed < 60) { s.armPos = elapsed / 60; s.accPos = 0; } 
                  else if (elapsed < 120) { s.armPos = 1; s.accPos = (elapsed - 60) / 60; } 
                  else if (elapsed < 300) { s.armPos = 1; s.accPos = 1; }
                  else { if (!s.hasCompleted) { s.hasCompleted = true; onCompleteRef.current(); } }
                  s.armPos = Math.min(1, Math.max(0, s.armPos));
                  s.accPos = Math.min(1, Math.max(0, s.accPos));
                  setArmPos(s.armPos); setAccPos(s.accPos);
              }
          }

          setAltitude(Math.floor(s.viewY + (touchY - s.shipY))); setSpeed(Math.floor(s.velocity * 50)); setLegExtension(s.legExtVal); setThrustActive(s.isThrusting);

          if (fgCtx) fgCtx.clearRect(0, 0, w, h);
          
          const worldY = groundY + s.viewY + s.shake;
          
          // SKY RENDERING
          const spaceTransitionHeight = 3000; 
          const spaceRatio = Math.min(1, Math.max(0, (s.viewY - 500) / spaceTransitionHeight));
          
          // Night Override for Sky
          const effectiveIsDay = env.isDay && !s.isNightLanding;
          const effectiveIsNight = !effectiveIsDay;

          const baseSky1 = effectiveIsNight ? '#020617' : env.skyGradient[0];
          const baseSky2 = effectiveIsNight ? '#1e293b' : env.skyGradient[1];

          const sky1 = mixColor(baseSky1, '#000000', spaceRatio); 
          const sky2 = mixColor(baseSky2, '#000000', spaceRatio);
          const grad = ctx.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, sky1); grad.addColorStop(1, sky2); ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

          let starVis = 0; 
          if (effectiveIsNight) {
              starVis = 0.8 + (spaceRatio * 0.2); 
          } else {
              const baseStarOpacity = Math.min(1, Math.max(0, (s.viewY - 500) / 2000)); 
              starVis = Math.max(baseStarOpacity, spaceRatio); 
          }
          
          const sunY = h * 0.2 + (s.viewY * 0.05); const sunX = w * 0.7; let dimFactor = 0;
          
          if (env.quadrant === QuadrantType.DELTA && !s.isNightLanding) { 
              const time = Date.now();
              const cyclePos = time % 35000;
              const jetsActive = cyclePos < 10000;
              const jetFade = jetsActive ? (cyclePos < 1000 ? cyclePos/1000 : (cyclePos > 9000 ? (10000-cyclePos)/1000 : 1)) : 0;

              const slowTime = time * 0.00025; 
              const dwarfDist = 120; 
              const dwarfX = sunX + Math.cos(slowTime) * dwarfDist; 
              const dwarfY = sunY + Math.sin(slowTime * 0.5) * 40; 
              const dwarfR = 15 * 0.7; 
              const zDepth = Math.sin(slowTime); 
              const isBehind = zDepth < 0; 
              
              if (isBehind) dimFactor = Math.min(0.7, Math.abs(zDepth) * 0.9); 
              
              const eclipseFactor = isBehind ? 1.0 : 0.0;
              starVis = Math.max(starVis, eclipseFactor * 0.8);

              if (starVis > 0) { 
                  const starParallax = s.viewY * 0.02;
                  ctx.fillStyle = '#ffffff'; 
                  env.stars.forEach(star => { 
                      const sy = (star.y * h + starParallax) % h; 
                      ctx.globalAlpha = star.alpha * starVis; 
                      ctx.beginPath(); ctx.arc(star.x * w, (sy < 0 ? sy + h : sy), star.size, 0, Math.PI*2); ctx.fill(); 
                  }); 
                  ctx.globalAlpha = 1.0; 
              }

              const drawJets = () => {
                  if (jetFade <= 0) return;
                  ctx.save();
                  ctx.translate(sunX, sunY);
                  const oscillation = Math.sin(time * 0.005) * (5 * Math.PI / 180);
                  ctx.rotate(oscillation);
                  const jetH = 400; const jetW = 10;
                  const gTop = ctx.createLinearGradient(0, 0, 0, -jetH); gTop.addColorStop(0, `rgba(168, 85, 247, ${0.8*jetFade})`); gTop.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gTop; ctx.fillRect(-jetW/2, -jetH, jetW, jetH);
                  const gBot = ctx.createLinearGradient(0, 0, 0, jetH); gBot.addColorStop(0, `rgba(168, 85, 247, ${0.8*jetFade})`); gBot.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gBot; ctx.fillRect(-jetW/2, 0, jetW, jetH);
                  ctx.fillStyle = `rgba(255,255,255, ${0.9*jetFade})`; ctx.fillRect(-2, -jetH*0.8, 4, jetH*1.6);
                  ctx.restore();
              };

              const drawDwarf = () => { ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(dwarfX, dwarfY, dwarfR, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; }; 
              const drawBlackHole = () => { const bhRadius = 40; const bhGrad = ctx.createRadialGradient(sunX, sunY, bhRadius*0.8, sunX, sunY, bhRadius*2.5); bhGrad.addColorStop(0, '#000000'); bhGrad.addColorStop(0.4, '#4c1d95'); bhGrad.addColorStop(0.6, '#a855f7'); bhGrad.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = bhGrad; ctx.beginPath(); ctx.arc(sunX, sunY, bhRadius*2.5, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#000000'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(sunX, sunY, bhRadius, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; }; 
              
              if (isBehind) { drawDwarf(); drawJets(); drawBlackHole(); } else { drawJets(); drawBlackHole(); drawDwarf(); } 
          } 
          else { 
              if (starVis > 0 || (effectiveIsDay && spaceRatio < 0.2)) { 
                  const starParallax = s.viewY * 0.02;
                  ctx.fillStyle = '#ffffff'; 
                  env.stars.forEach(star => { 
                      const sy = (star.y * h + starParallax) % h; 
                      let individualVis = starVis;
                      if (effectiveIsDay && starVis < 0.2) {
                          if (star.size > 0.7 || star.alpha > 0.8) {
                              individualVis = 0.3; 
                          }
                      }
                      if (individualVis > 0) {
                          ctx.globalAlpha = star.alpha * individualVis; 
                          ctx.beginPath(); ctx.arc(star.x * w, (sy < 0 ? sy + h : sy), star.size, 0, Math.PI*2); ctx.fill(); 
                      }
                  }); 
                  ctx.globalAlpha = 1.0; 
              }

              if (s.isNightLanding || spaceRatio > 0.5) {
                  s.wanderers.forEach(wnd => {
                      const parallaxY = s.viewY * 0.04; 
                      ctx.fillStyle = wnd.color;
                      ctx.beginPath(); 
                      ctx.arc(wnd.x, wnd.y + parallaxY, wnd.size, 0, Math.PI*2); 
                      ctx.fill();
                  });

                  s.moons.forEach(mn => {
                      const parallaxY = s.viewY * 0.08;
                      const my = mn.y + parallaxY;
                      ctx.fillStyle = '#475569'; 
                      ctx.beginPath(); 
                      ctx.arc(mn.x, my, mn.size, 0, Math.PI*2); 
                      ctx.fill();

                      if (mn.type === 'phaser') {
                          const time = Date.now();
                          const isDelta = env.quadrant === QuadrantType.DELTA;
                          const speedFactor = isDelta ? 0.0002 : 0.000002;
                          const phaseOffset = time * speedFactor;
                          let p = ((mn.phase || 0) + phaseOffset) % 1; 
                          if (p < 0) p += 1; 

                          const r = mn.size;
                          const brightColor = mn.color;
                          const darkColor = '#475569'; 

                          ctx.fillStyle = brightColor;
                          if (p <= 0.5) {
                              ctx.beginPath(); ctx.arc(mn.x, my, r, -Math.PI/2, Math.PI/2); ctx.fill(); 
                              const width = r * Math.cos(p * 2 * Math.PI); 
                              ctx.beginPath(); 
                              ctx.ellipse(mn.x, my, Math.abs(width), r, 0, 0, Math.PI*2);
                              if (p < 0.25) ctx.fillStyle = darkColor;
                              else ctx.fillStyle = brightColor;
                              ctx.fill();
                          } else {
                              ctx.beginPath(); ctx.arc(mn.x, my, r, Math.PI/2, -Math.PI/2); ctx.fill(); 
                              const width = r * Math.cos(p * 2 * Math.PI); 
                              ctx.beginPath();
                              ctx.ellipse(mn.x, my, Math.abs(width), r, 0, 0, Math.PI*2);
                              if (p < 0.75) ctx.fillStyle = brightColor;
                              else ctx.fillStyle = darkColor; 
                              ctx.fill();
                          }
                      } else {
                          ctx.fillStyle = mn.color;
                          ctx.beginPath(); 
                          ctx.arc(mn.x, my, mn.size, 0, Math.PI*2); 
                          ctx.fill();
                      }
                  });
              }

              if (effectiveIsDay) { 
                  const sunR = 40; 
                  const sGrad = ctx.createRadialGradient(sunX, sunY, sunR*0.2, sunX, sunY, sunR*2.5); 
                  sGrad.addColorStop(0, sunColor); 
                  sGrad.addColorStop(1, 'rgba(0,0,0,0)'); 
                  ctx.fillStyle = sGrad; 
                  ctx.beginPath(); ctx.arc(sunX, sunY, sunR*2.5, 0, Math.PI*2); ctx.fill(); 
                  ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.8; 
                  ctx.beginPath(); ctx.arc(sunX, sunY, sunR*0.8, 0, Math.PI*2); ctx.fill(); 
                  ctx.globalAlpha = 1.0; 
              } 
              
              if (s.comet) {
                  s.comet.x += s.comet.vx;
                  s.comet.y += s.comet.vy;
                  ctx.save();
                  const parallaxY = s.viewY * 0.02;
                  ctx.translate(s.comet.x, s.comet.y + parallaxY);
                  ctx.rotate(-0.1); 
                  const tailGrad = ctx.createLinearGradient(0, 0, s.comet.tailLen, 0);
                  tailGrad.addColorStop(0, 'rgba(253, 224, 71, 0.5)'); 
                  tailGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
                  ctx.fillStyle = tailGrad;
                  ctx.shadowColor = '#facc15'; ctx.shadowBlur = 15; 
                  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s.comet.tailLen * 0.3, -4, s.comet.tailLen, 0); ctx.quadraticCurveTo(s.comet.tailLen * 0.3, 4, 0, 0); ctx.fill();
                  ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI*2); ctx.fill();
                  ctx.restore();
              }
          }

          if (env.wanderers && env.wanderers.length > 0 && starVis > 0.3) { env.wanderers.forEach(wd => { const wx = (wd.x * w + s.startTime * 0.005) % (w + 100) - 50; const wy = wd.y * h; ctx.fillStyle = wd.color || '#e5e7eb'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 2; ctx.globalAlpha = starVis; ctx.beginPath(); ctx.arc(wx, wy, Math.min(2.5, wd.size), 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1.0; }); }

          // BACKGROUND LARGE BIRDS (Gliding High)
          if (env.hasLargeBirds && s.viewY < 4000) {
              const bgCtx = ctx;
              s.largeBirds.forEach(bird => {
                  bird.angle += bird.speed;
                  const bx = bird.x + Math.cos(bird.angle) * bird.radius + cx;
                  const by = bird.y + Math.sin(bird.angle * 0.3) * 50 + worldY - 1500; // Offset higher up
                  
                  if (bx > -50 && bx < w + 50 && by > -50 && by < h + 50) {
                      const bank = Math.sin(bird.angle) * 0.3;
                      drawLargeBird(bgCtx, bx, by, bird.size, bank);
                  }
              });
          }

          ctx.save(); ctx.translate(cx, worldY); 
          const drawHillItem = (hill: any, i: number) => {
              const pFactor = hill.parallaxFactor; const yOff = (s.viewY * (1 - pFactor)); ctx.fillStyle = hill.color; ctx.beginPath(); ctx.moveTo(-w, h); 
              const pathPoints: {x:number, y:number}[] = [];
              hill.points.forEach((p: any, idx: number) => { const px = (p.xRatio * 3000) - 1500; const py = -(p.heightRatio * 300) - yOff; if (idx === 0) ctx.lineTo(px, 1000); ctx.lineTo(px, py); if (hill.hasRoad || hill.hasTrainTrack) pathPoints.push({x: px, y: py}); });
              ctx.lineTo(1500, 1000); ctx.fill();

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

              if (hill.roadBuildingsBack) { hill.roadBuildingsBack.forEach((b: any) => { const bx = (b.xRatio * 3000) - 1500; const by = -(b.yBase * 300) - yOff + b.yOffset; if (b.type === 'dome_std') { drawDome(ctx, bx, by, b, !!env.isOcean); } else if (b.type === 'hangar') { drawBuilding(ctx, { x: bx, y: by, type: 'hangar', w: b.w, h: b.h }, effectiveIsDay, false); } else { drawBuilding(ctx, { x: bx, y: by, type: 'building_std', w: b.w, h: b.h, color: b.color, windowData: b.windowData, hasRedRoof: b.hasRedRoof, windowW: b.windowW, windowH: b.windowH, acUnits: b.acUnits, drawFoundation: b.drawFoundation }, effectiveIsDay, false); } }); }

              if (hill.hasRoad && pathPoints.length > 0) {
                  ctx.beginPath(); pathPoints.forEach((p, idx) => { if(idx===0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.strokeStyle = '#333'; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
                  if (env.cars && env.cars.length > 0) {
                      env.cars.forEach(car => {
                          car.progress += car.speed * (car.dir || 1); if (car.progress > 1) car.progress -= 1; if (car.progress < 0) car.progress += 1;
                          const trackLen = pathPoints.length - 1; const exactIdx = car.progress * trackLen; const idx = Math.floor(exactIdx); const sub = exactIdx - idx; const p1 = pathPoints[idx]; const p2 = pathPoints[Math.min(idx + 1, trackLen)];
                          if (p1 && p2) {
                              const vx = p1.x + (p2.x - p1.x) * sub; const vy = p1.y + (p2.y - p1.y) * sub; const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                              drawVehicle(ctx, vx, vy - 4, angle, 'car', car.color, effectiveIsDay, car.dir);
                          }
                      });
                  }
                  if (env.streetLights) { env.streetLights.forEach(sl => { const ratio = (sl.x + 1500) / 3000; if (ratio >= 0 && ratio <= 1) { const idx = Math.floor(ratio * (pathPoints.length - 1)); const p = pathPoints[idx]; if (p) drawStreetLight(ctx, p.x, p.y, sl.h, effectiveIsDay); } }); }
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
                                      drawVehicle(ctx, tx, ty - 6, ta, k===0 ? 'train_engine' : 'train_carriage', train.color, effectiveIsDay, train.dir);
                                  }
                              }
                          }
                      });
                  }
              }

              if (hill.roadBuildingsFront) { hill.roadBuildingsFront.forEach((b: any) => { const bx = (b.xRatio * 3000) - 1500; const by = -(b.yBase * 300) - yOff + b.yOffset; if (b.type === 'dome_std') { drawDome(ctx, bx, by, b, !!env.isOcean); } else if (b.type === 'hangar') { drawBuilding(ctx, { x: bx, y: by, type: 'hangar', w: b.w, h: b.h }, effectiveIsDay, false); } else { drawBuilding(ctx, { x: bx, y: by, type: 'building_std', w: b.w, h: b.h, color: b.color, windowData: b.windowData, hasRedRoof: b.hasRedRoof, windowW: b.windowW, windowH: b.windowH, acUnits: b.acUnits, hasBalcony: b.hasBalcony }, effectiveIsDay, false); } }); }

              if (hill.trees) {
                  hill.trees.forEach((t: any, tIdx: number) => {
                      const p1 = hill.points[t.segIdx]; const p2 = hill.points[t.segIdx+1];
                      if (p1 && p2) {
                          const x1 = p1.xRatio * 3000 - 1500; const y1 = - (p1.heightRatio * 300) - yOff; const x2 = p2.xRatio * 3000 - 1500; const y2 = - (p2.heightRatio * 300) - yOff; const tx = x1 + (x2 - x1) * t.offset; let ty = y1 + (y2 - y1) * t.offset;
                          if (hill.hasRoad) { const side = tIdx % 2 === 0 ? 1 : -1; ty += side * 25; }
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
                              const lightSeed = (t.segIdx * 1000) + Math.floor(t.offset * 100);
                              drawResort(ctx, tx, drawY, t.scale, effectiveIsDay, foundationH, lightSeed); 
                          }
                          else if (t.type === 'windmill') { drawBuilding(ctx, { x: tx, y: ty, type: 'windmill', scale: t.scale, windmillType: t.windmillType }, effectiveIsDay, false); }
                          else if (t.type === 'mining') { drawMining(ctx, tx, ty, t.scale); }
                          else { drawBuilding(ctx, { x: tx, y: ty, type: t.type, w: t.w, h: t.h, color: t.color, trunkColor: '#78350f' }, effectiveIsDay, false); }
                      }
                  });
              }
              if (hill.cityBuildings) { hill.cityBuildings.forEach((b: any) => { const bx = (b.xRatio * 3000) - 1500; const by = -(b.yBase * 300) - yOff; drawBuilding(ctx, { x: bx, y: by, type: 'building_std', w: b.w, h: b.h }, effectiveIsDay, false); }); }
          };

          if (s.lightning.active) {
              const opacity = Math.min(1, s.lightning.timer / 10);
              ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
              ctx.fillRect(0, 0, w, h);
          }

          drawCloudsByLayer(0, ctx);
          
          if (s.lightning.active && s.lightning.timer > 5 && s.lightning.x) {
              const ly = 200; 
              drawLightning(ctx, cx + s.lightning.x, ly, 600);
          }

          if (env.hills[0]) drawHillItem(env.hills[0], 0); 
          if (env.hills[1]) drawHillItem(env.hills[1], 1);
          
          drawCloudsByLayer(1, ctx);
          
          for (let i = 2; i < env.hills.length; i++) { drawHillItem(env.hills[i], i); }

          ctx.fillStyle = env.groundColor; ctx.fillRect(-w, 0, w*2, h*2); drawPlatform(ctx, 0, 0, env.isOcean);
          
          // Draw Rocks from environment (Consistent)
          if (env.rocks && env.rocks.length > 0 && s.viewY < 800) {
              env.rocks.forEach(r => {
                  const shiftY = s.viewY * r.parallax;
                  const rockScreenY = groundY + shiftY + s.shake;
                  if (rockScreenY > -50 && rockScreenY < h + 50) {
                      drawRock(ctx, r.x, rockScreenY - worldY, r.size, r.color, r.type, r.critter);
                  }
              });
          }

          env.features.forEach(f => {
              if (f.isForeground) return;
              const fy = f.yOff || 0; 
              if (f.type === 'power_plant' && !f.isUnderground) { if (Math.random() > 0.8) { s.particles.push({ x: f.x + 40, y: fy - 80, vx: (Math.random()-0.5)*1, vy: -1 - Math.random()*1, life: 1.0, maxLife: 1.0, size: 5 + Math.random()*5, color: 'rgba(255,255,255,0.1)', type: 'steam' }); } }
              if (f.type === 'tower') drawTower(ctx, f.x, fy, f, effectiveIsDay, env.isOcean, s.armPos, s.accPos, [hullWidths.top, hullWidths.bottom]);
              else if (f.type === 'dome_std') drawDome(ctx, f.x, fy, f, !!env.isOcean);
              else if (f.type === 'building_std' || f.type === 'power_pole' || f.type === 'hangar') drawBuilding(ctx, { ...f, y: fy }, effectiveIsDay, env.isOcean);
              else if (f.type === 'power_plant') drawPowerPlant(ctx, f.x, fy, f.scale, f.isUnderground);
          });
          if (env.powerLines) { env.powerLines.forEach((chain: any[]) => { ctx.strokeStyle = '#18181b'; ctx.lineWidth = 1; for (let k=0; k<chain.length-1; k++) { const p1 = chain[k]; const p2 = chain[k+1]; const y1 = -p1.h + (p1.yOff || 0); const y2 = -p2.h + (p2.yOff || 0); for(let wIdx=0; wIdx<3; wIdx++) { const sag = 15 + (wIdx * 5); const midX = (p1.x + p2.x) / 2; const midY = Math.max(y1, y2) + sag; ctx.beginPath(); ctx.moveTo(p1.x, y1 + (wIdx * 4)); ctx.quadraticCurveTo(midX, midY + (wIdx * 4), p2.x, y2 + (wIdx * 4)); ctx.stroke(); } } }); }
          
          // GROUND CRITTERS
          if (env.hasCritters && s.viewY < 500) {
              s.critters.forEach(c => {
                  if (Math.random() < 0.02) c.vx = (Math.random() > 0.5 ? 1 : -1) * (0.2 + Math.random() * 0.3);
                  if (Math.random() < 0.05) c.vx = 0; 
                  
                  c.x += c.vx;
                  if (c.x < -800) c.vx = Math.abs(c.vx) + 0.1;
                  if (c.x > 800) c.vx = -Math.abs(c.vx) - 0.1;
                  
                  if (Math.abs(c.vx) > 0.01) {
                      c.frame += 0.2;
                      c.dir = c.vx > 0 ? 1 : -1;
                  }
                  
                  // Ground Y is relative to 0 at pad surface
                  if (c.type === 'scorpion') drawScorpion(ctx, c.x, 0, 1.0, c.frame);
                  else drawLizard(ctx, c.x, 0, 1.0, c.frame, c.dir);
              });
          }

          ctx.restore();

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
                  if (drop.y > 1000) { drop.y = -1200; drop.x = (Math.random() - 0.5) * 2000; }
                  const visualY = ((drop.y + s.viewY) % 2200) - 1100 + (h/2);
                  const visualX = drop.x + (w/2);
                  if (visualY > -100 && visualY < h + 100) { rainCtx.moveTo(visualX, visualY); rainCtx.lineTo(visualX, visualY + drop.len); }
              });
              rainCtx.stroke();
          }

          // SMALL BIRDS FLOCK
          if (env.hasSmallBirds && s.viewY < 1500) {
              const birdCtx = fgCtx || ctx;
              s.birdFlock.forEach(b => {
                  b.x += b.vx; b.y += b.vy;
                  if (b.x > 1000) b.vx = -Math.abs(b.vx); if (b.x < -1000) b.vx = Math.abs(b.vx);
                  if (b.y < 200) b.vy = Math.abs(b.vy); if (b.y > 800) b.vy = -Math.abs(b.vy);
                  b.flap += 0.2;
                  const birdY = b.y + worldY; 
                  const birdX = b.x + cx;
                  if (birdY > -50 && birdY < h + 50) { drawBird(birdCtx, birdX, birdY, 3, Math.sin(b.flap)); }
              });
          }

          if (s.reEntryHeat > 0 && shipDOMRef.current) {
               const shipScreenY = s.shipY + s.shake; 
               const shipW = 100 * currentScale;
               const arcY = shipScreenY + (60 * currentScale); 
               
               ctx.save();
               ctx.shadowBlur = 20 * s.reEntryHeat;
               ctx.shadowColor = '#f97316';
               
               const layers = [ { c: '#ffffff', w: 2 }, { c: '#fef08a', w: 6 }, { c: '#f97316', w: 12 }, { c: '#ef4444', w: 20 }, { c: '#a855f7', w: 30 } ];
               
               layers.forEach((l, i) => {
                   ctx.beginPath();
                   ctx.strokeStyle = l.c;
                   ctx.lineWidth = l.w * s.reEntryHeat * 0.8;
                   ctx.globalAlpha = (1.0 - (i * 0.15)) * s.reEntryHeat;
                   ctx.arc(cx, arcY - 10, (shipW/2) + (i*2), 0, Math.PI, false);
                   ctx.stroke();
               });

               ctx.restore();

               if (s.reEntryHeat > 0.2) {
                   const count = Math.floor(s.reEntryHeat * 3);
                   for(let i=0; i<count; i++) {
                       const px = cx + (Math.random() - 0.5) * shipW;
                       const py = arcY + (Math.random() * 10);
                       const pSize = 2 + Math.random() * 4;
                       const pLife = 0.5 + Math.random() * 0.5;
                       const pColor = Math.random() > 0.5 ? '#f97316' : '#ef4444';
                       s.particles.push({ x: px, y: py, vx: (Math.random()-0.5)*2, vy: -4 - Math.random() * 4, life: pLife, maxLife: pLife, size: pSize, color: pColor, type: 'plasma' });
                   }
               }
          }

          if (dimFactor > 0) { ctx.fillStyle = `rgba(0,0,0,${dimFactor})`; ctx.fillRect(0, 0, w, h); }

          if (fgCtx) {
             fgCtx.save(); fgCtx.translate(cx, worldY);
             env.features.forEach(f => {
                  if (f.isForeground) {
                      const fy = f.yOff || 0;
                      if (f.type === 'dome_std') drawDome(fgCtx, f.x, fy, f, !!env.isOcean);
                      else if (f.type === 'building_std') drawBuilding(fgCtx, { ...f, y: fy }, effectiveIsDay, env.isOcean);
                  }
             });
             fgCtx.restore();

             drawCloudsByLayer(2, fgCtx);
          } else {
             drawCloudsByLayer(2, ctx);
          }

          if (s.isThrusting) {
              const spawnCount = 5; 
              for(let i=0; i<spawnCount; i++) {
                  const eng = engineLocs[Math.floor(Math.random() * engineLocs.length)]; const nozzleRelX = (eng.x - 50) * DOM_SCALE; const nozzleRelY = (eng.y + eng.h + 6 - 50) * DOM_SCALE; let pType = 'fire'; let pColor = Math.random() > 0.5 ? '#ef4444' : '#facc15'; s.particles.push({ x: cx + nozzleRelX + (Math.random()-0.5)*3, y: s.shipY + s.shake + nozzleRelY, vx: (Math.random()-0.5) * 2, vy: (6 + Math.random() * 6), life: 0.5, maxLife: 0.5, size: 4 + Math.random() * 4, type: pType, color: pColor, decay: 0.05, grow: 0.5 });
              }
          }

          s.particles.forEach(p => { if (p.type === 'plasma') { p.x += p.vx; p.y += p.vy; p.life -= p.decay || 0.02; p.size *= 0.96; } else { p.x += p.vx; p.y += p.vy; p.life -= p.decay || 0.01; if (p.grow) p.size += p.grow; const currentGroundY = worldY; if (p.y > currentGroundY && p.vy > 0 && p.type !== 'steam') { p.y = currentGroundY; p.vy = 0; p.vx = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 10); p.grow = 2.0; p.decay = 0.1; } } if (p.life > 0) { ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color || '#fff'; if (p.type === 'fire' || p.type === 'ion' || p.type === 'plasma') { ctx.globalCompositeOperation = 'screen'; ctx.shadowColor = p.color || '#f00'; ctx.shadowBlur = p.type === 'plasma' ? 20 : 10; } ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); ctx.restore(); } });
          s.particles = s.particles.filter(p => p.life > 0);

          if (shipDOMRef.current) { const shipScreenY = s.shipY + s.shake; shipDOMRef.current.style.transform = `translate(-50%, -50%) translate(${cx}px, ${shipScreenY}px) scale(${currentScale})`; }
          
          requestAnimationFrame(loop);
      };

      const animId = requestAnimationFrame(loop);
      return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId); audioService.stopLandingThruster(); };
  }, [shipConfig, engineLocs, hullWidths]);

  return (
    <div className="fixed inset-0 z-[5000] bg-black overflow-hidden font-mono select-none absolute w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 z-0 w-full h-full" />
      <canvas ref={fgCanvasRef} className="absolute inset-0 z-30 pointer-events-none w-full h-full" />
      
      {/* Title Overlay */}
      <div className="absolute top-6 right-6 z-40 text-right pointer-events-none flex flex-col items-end">
          <h1 className="retro-font text-lg md:text-xl text-emerald-500 uppercase tracking-widest drop-shadow-md leading-none">
              {planet.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
              <div className="h-[1px] w-8 bg-zinc-700"></div>
              <span className="text-[10px] md:text-xs text-zinc-500 font-mono tracking-[0.2em] uppercase">
                  APPROACH VECTOR
              </span>
          </div>
      </div>

      <SequenceStatusBar altitude={altitude} velocity={speed} fuel={visualFuel} maxFuel={maxFuel} status={status} onSkip={() => { audioService.stopReEntryWind(); audioService.stopLandingThruster(); audioService.stop(); onCompleteRef.current(); }} phase={phase} />
      <div ref={shipDOMRef} className="absolute left-0 top-0 w-32 h-32 will-change-transform z-20">
        <div className="absolute inset-0 z-0 overflow-visible">
             <svg className="absolute w-full h-full" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
                <g transform={`translate(50, 50)`}> {['left', 'right'].map((side) => ( <LandingGear key={side} type={shipConfig.landingGearType} extension={legExtension} compression={suspension} side={side as any} /> ))} </g>
             </svg>
        </div>
        <ShipIcon 
            config={shipConfig} 
            className="w-full h-full drop-shadow-2xl relative z-10" 
            showJets={thrustActive} 
            jetType="combustion" 
            showGear={false} 
            hullColor={shipColors.hull}
            wingColor={shipColors.wings}
            cockpitColor={shipColors.cockpit}
            cockpitHighlightColor={shipColors.cockpit_highlight}
            gunColor={shipColors.guns}
            secondaryGunColor={shipColors.secondary_guns}
            gunBodyColor={shipColors.gun_body}
            engineColor={shipColors.engines}
            nozzleColor={shipColors.nozzles}
            barColor={shipColors.bars}
            weaponId={weaponId} 
            equippedWeapons={equippedWeapons} 
        />
      </div>
    </div>
  );
};
