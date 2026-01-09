
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Planet, Moon, QuadrantType } from '../types.ts';
import { ExtendedShipConfig } from '../constants.ts';
import { ShipIcon } from './ShipIcon.tsx';
import { audioService } from '../services/audioService.ts';

interface LaunchSequenceProps {
  planet: Planet | Moon;
  shipConfig: ExtendedShipConfig;
  shipColors: any;
  onComplete: () => void;
  testMode?: boolean;
}

type Biome = 'metropolis' | 'village' | 'outpost' | 'barren' | 'forest' | 'desert' | 'ocean' | 'ice' | 'industrial';
type TimeOfDay = 'day' | 'night';
type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'smog';
type Season = 'summer' | 'autumn' | 'winter';

interface Environment {
  biome: Biome;
  timeOfDay: TimeOfDay;
  weather: Weather;
  season: Season;
  skyColors: string[];
  groundColor: string;
  cloudColor: string;
  windSpeed: number;
  towerOffsetX: number;
  featureSide: 'left' | 'right';
  hasWater: boolean;
  sunType: 'standard' | 'white_dwarf' | 'red_giant' | 'blue_neutron';
  hasRainbow: boolean;
  rainbowConfig?: {
      x: number;
      type: 'full' | 'left' | 'right';
      intensity: number;
      radiusScale: number;
  };
}

// Deterministic random for static features like windows
const pseudoRandom = (seed: number, x: number, y: number) => {
    const n = Math.sin(seed * 12.9898 + x * 78.233 + y * 37.719) * 43758.5453;
    return n - Math.floor(n);
};

const LaunchSequence: React.FC<LaunchSequenceProps> = ({ planet, shipConfig, shipColors, onComplete, testMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shipDOMRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'countdown' | 'ignition' | 'lift' | 'atmosphere' | 'orbit'>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [statusText, setStatusText] = useState("SYSTEM CHECK");
  
  // Telemetry State
  const [altitude, setAltitude] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const [thrust, setThrust] = useState(0);
  const [legExtension, setLegExtension] = useState(1); // 1 = extended, 0 = retracted

  // Animation Refs
  const scrollYRef = useRef(0);
  const shipShakeRef = useRef(0);
  const shipAltitudeRef = useRef(0); 
  const shipRotationRef = useRef(0); // In radians
  
  const particlesRef = useRef<Array<{
    x: number, y: number, vx: number, vy: number, 
    life: number, maxLife: number, size: number, 
    type: 'smoke' | 'fire' | 'plasma_core' | 'plasma_edge' | 'plasma_aura' | 'spark' | 'rain' | 'snow' | 'contrail', 
    color?: string,
    rotation?: number
  }>>([]);
  const armOffsetRef = useRef(0);
  
  // Features State
  const featuresRef = useRef<Array<{
    x: number, y: number, type: string, w?: number, h?: number, 
    vx: number, vy: number, speed: number, scale: number, 
    color: string, offset: number, state?: string, subtype?: string,
    seed: number, 
    contents?: { x: number, h: number, w: number, type: 'tree'|'building', color: string }[]
  }>>([]);

  // Cloud Layers
  const cloudLayersRef = useRef<{
    foreground: Array<{x: number, y: number, w: number, h: number, opacity: number}>,
    background: Array<{x: number, y: number, w: number, h: number, opacity: number}>
  }>({ foreground: [], background: [] });

  // Stars
  const starsRef = useRef<Array<{
    x: number, y: number, size: number, color: string, alpha: number, blinkOffset: number
  }>>([]);

  // Generate Environment
  const environment = useMemo<Environment>(() => {
      const p = planet as Planet;
      const seedStr = testMode ? Math.random().toString() : p.id;
      const seed = seedStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const rand = (offset: number) => {
          const x = Math.sin(seed + offset) * 10000;
          return x - Math.floor(x);
      };

      // Determine Biome based on visual characteristics first
      const isPopulatedColor = ['#10b981', '#064e3b', '#60a5fa', '#1e40af', '#3b82f6', '#15803d', '#a3e635'].includes(p.color);
      let biome: Biome = 'barren';

      if (p.quadrant === QuadrantType.DELTA) {
          biome = 'industrial'; 
      } else if (isPopulatedColor) {
          // Green/Blue planets get complex biomes
          if (p.color.includes('green') || p.color.includes('#a3e635')) biome = rand(1) > 0.5 ? 'forest' : 'village';
          else if (p.color.includes('blue')) biome = 'ocean';
          
          // Difficulty override for density
          if (p.difficulty <= 5) biome = 'metropolis';
          else if (p.difficulty <= 8 && biome !== 'ocean') biome = 'village';
      } else {
          // Non-populated colors get barren/harsh biomes
          if (p.color === '#ffffff' || p.color === '#e2e8f0') biome = 'ice';
          else if (['#ef4444', '#991b1b', '#f97316'].includes(p.color)) biome = 'desert';
          else if (['#1c1917', '#292524', '#44403c'].includes(p.color)) biome = 'industrial';
          else biome = 'barren';
      }

      const timeOfDay: TimeOfDay = rand(2) > 0.5 ? 'day' : 'night';
      
      // Season Logic
      let season: Season = 'summer';
      const sR = rand(8);
      if (sR > 0.6) season = 'autumn';
      if (sR > 0.8 || biome === 'ice') season = 'winter';

      let weather: Weather = 'clear';
      const wR = rand(3);
      if (wR > 0.7) weather = 'cloudy';
      if (wR > 0.9) weather = season === 'winter' ? 'snow' : 'rain';
      if (season === 'winter' && rand(9) > 0.5) weather = 'snow';
      if (biome === 'industrial') weather = 'smog';

      // Sun Type
      let sunType: Environment['sunType'] = 'standard';
      if (p.quadrant === QuadrantType.DELTA) sunType = 'white_dwarf';
      else if (p.quadrant === QuadrantType.BETA) sunType = 'red_giant';
      else if (p.quadrant === QuadrantType.GAMA) sunType = 'blue_neutron';

      // SKY COLORS
      let skyColors = ['#38bdf8', '#0ea5e9']; // Default Blue
      let groundColor = p.color || '#1e293b';
      let cloudColor = 'rgba(255,255,255,0.8)';

      if (biome === 'industrial' || biome === 'barren') {
          groundColor = '#1c1917'; 
          skyColors = ['#57534e', '#292524']; 
          cloudColor = 'rgba(120, 113, 108, 0.5)';
      }
      else if (biome === 'desert') {
          groundColor = '#9a3412'; 
          skyColors = ['#fdba74', '#c2410c']; 
      }
      else if (season === 'winter' || biome === 'ice') {
          groundColor = '#e2e8f0'; 
          if (biome === 'forest') groundColor = '#cbd5e1';
      }

      if (timeOfDay === 'night') {
          skyColors = ['#020617', '#1e293b']; 
          cloudColor = 'rgba(100,116,139,0.3)';
          if (season === 'winter') groundColor = '#475569';
          if (biome === 'industrial') skyColors = ['#0f172a', '#000000'];
      } else {
          if (sunType === 'red_giant') {
              skyColors = ['#fecaca', '#b91c1c']; 
              cloudColor = 'rgba(254, 202, 202, 0.5)';
          } else if (sunType === 'blue_neutron') {
              skyColors = ['#bfdbfe', '#1e3a8a'];
              cloudColor = 'rgba(191, 219, 254, 0.5)';
          } else if (sunType === 'white_dwarf') {
              skyColors = ['#e2e8f0', '#475569']; 
              cloudColor = 'rgba(226, 232, 240, 0.4)';
          } else {
              if (p.color.includes('green')) skyColors = ['#bbf7d0', '#15803d'];
              else if (p.color === '#ffffff') { skyColors = ['#f1f5f9', '#94a3b8']; weather = 'cloudy'; }
          }
      }
      
      if (weather === 'rain' || weather === 'snow') {
          skyColors[0] = '#334155'; 
          cloudColor = 'rgba(71, 85, 105, 0.8)';
      }

      // Rainbow Logic - STRICT HABITABLE ONLY
      const hasRainbow = isPopulatedColor &&
                         (season === 'summer' || season === 'autumn') && 
                         (weather === 'cloudy' || weather === 'clear') && 
                         rand(12) > 0.6; 
      
      let rainbowConfig: Environment['rainbowConfig'] = undefined;
      if (hasRainbow) {
          const typeRoll = rand(13);
          const type = typeRoll < 0.33 ? 'left' : (typeRoll < 0.66 ? 'right' : 'full');
          rainbowConfig = { x: 0.5, type, intensity: 0.2 + rand(16) * 0.3, radiusScale: 0.8 };
      }

      const isSimpleDeparture = ['barren', 'industrial', 'desert', 'ice'].includes(biome);

      return {
          biome,
          timeOfDay,
          weather,
          season,
          skyColors,
          groundColor,
          cloudColor,
          windSpeed: 0.5 + rand(4) * 2,
          // Tower offset for complex departures
          towerOffsetX: isSimpleDeparture ? 0 : (rand(5) - 0.5) * 200,
          featureSide: rand(6) > 0.5 ? 'left' : 'right',
          hasWater: (biome !== 'barren' && biome !== 'industrial' && biome !== 'desert' && biome !== 'ice') && rand(7) > 0.6 && season !== 'winter',
          sunType,
          hasRainbow,
          rainbowConfig
      };
  }, [planet, testMode]);

  const isSimpleDeparture = useMemo(() => ['barren', 'industrial', 'desert', 'ice'].includes(environment.biome), [environment]);

  // Init Environment Features
  useEffect(() => {
      const feats = [];
      const width = window.innerWidth;
      
      // Birds: STRICTLY NO BIRDS for simple departure biomes
      if (!isSimpleDeparture && environment.season !== 'winter') {
          for(let i=0; i<15; i++) {
              feats.push({ 
                  x: Math.random() * width, y: Math.random() * 400, type: 'bird', 
                  vx: (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random()), vy: 0, speed: 1, scale: 0.5 + Math.random()*0.5, 
                  color: environment.timeOfDay === 'night' ? '#cbd5e1' : '#000', offset: Math.random() * Math.PI, seed: Math.random()
              });
          }
      }

      const sideMultiplier = environment.featureSide === 'left' ? 0.2 : 0.8;
      const zoneX = width * sideMultiplier;
      
      // Feature Generation
      if (isSimpleDeparture) {
          // BARREN / INDUSTRIAL PROPS
          if (Math.random() > 0.3) { 
              const domeW = 150 + Math.random() * 100;
              const domeH = 100 + Math.random() * 50;
              const domeX = zoneX + (Math.random() - 0.5) * 400;
              const contents = [];
              const numItems = 3 + Math.floor(Math.random() * 3);
              const radius = domeW / 2;
              for(let k=0; k<numItems; k++) {
                  const tx = (Math.random() - 0.5) * (radius * 1.5); 
                  contents.push({ x: tx, w: 20 + Math.random()*20, h: 30 + Math.random()*20, type: 'building', color: '#374151' });
              }
              feats.push({ x: domeX, y: 0, w: domeW, h: domeH, type: 'dome', vx: 0, vy: 0, speed: 0, scale: 1, color: 'rgba(255,255,255,0.1)', offset: 0, seed: Math.random(), contents });
          }
          // Scattered Industrial Junk / Rocks
          for (let i = 0; i < 8; i++) {
              const bX = Math.random() * width;
              if (Math.abs(bX - (width/2)) < 150) continue; 
              const rand = Math.random();
              if (rand < 0.2) feats.push({ x: bX, y: 0, type: 'crane', w: 40, h: 120, vx: 0, vy: 0, speed: 0, scale: 1, color: '#facc15', offset: 0, seed: Math.random() });
              else if (rand < 0.4) feats.push({ x: bX, y: 0, type: 'container', w: 40, h: 30, vx: 0, vy: 0, speed: 0, scale: 1, color: Math.random()>0.5 ? '#b91c1c' : '#1e40af', offset: 0, seed: Math.random() });
              else if (rand < 0.7) feats.push({ x: bX, y: 0, type: 'rock', w: 30 + Math.random()*30, h: 20 + Math.random()*20, vx: 0, vy: 0, speed: 0, scale: 1, color: environment.groundColor, offset: 0, seed: Math.random() });
              else feats.push({ x: bX, y: 0, type: Math.random()>0.5?'tank':'chimney', w: 30, h: 60, vx: 0, vy: 0, speed: 0, scale: 1, color: '#334155', offset: 0, seed: Math.random() });
          }
      } else {
          // POPULATED BIOMES (Trees, Buildings)
          if (environment.biome === 'metropolis') {
              for (let i = 0; i < 12; i++) {
                  const bX = zoneX + (Math.random() - 0.5) * 500;
                  feats.push({ x: bX, y: 0, w: 40+Math.random()*60, h: 100+Math.random()*300, type: 'skyscraper', vx: 0, vy: 0, speed: 0, scale: 1, color: '#1e293b', offset: 0, seed: Math.random() });
              }
          } else if (['village', 'outpost'].includes(environment.biome)) {
              for (let i = 0; i < 10; i++) {
                  const bX = zoneX + (Math.random() - 0.5) * 600;
                  if (Math.abs(bX - (width/2)) < 100) continue; // Clear landing zone
                  feats.push({ x: bX, y: 0, type: 'building', vx: 0, vy: 0, speed: 0, scale: 0.6 + Math.random(), color: '#374151', offset: 0, subtype: Math.random() > 0.85 ? 'church' : 'house', seed: Math.random() });
              }
          }
          if (['forest', 'ocean', 'village', 'outpost'].includes(environment.biome)) {
              for (let i = 0; i < 30; i++) {
                  let tColor = '#064e3b';
                  if (environment.season === 'autumn') tColor = Math.random() > 0.5 ? '#d97706' : '#b45309'; 
                  feats.push({ x: Math.random() * width, y: 0, type: 'tree', vx: 0, vy: 0, speed: 0, scale: 0.5 + Math.random(), color: tColor, offset: i, seed: Math.random() });
              }
          }
      }

      featuresRef.current = feats;

      // Realistic Fog Layers
      const bgClouds = []; for(let i=0; i<15; i++) bgClouds.push({ x: Math.random() * width, y: -500 + Math.random() * 800, w: 300 + Math.random() * 400, h: 100 + Math.random() * 150, opacity: 0.2 + Math.random() * 0.2 });
      const fgClouds = []; for(let i=0; i<30; i++) fgClouds.push({ x: Math.random() * width, y: -2500 + (Math.random() - 0.5) * 1000, w: 400 + Math.random() * 500, h: 120 + Math.random() * 200, opacity: 0.4 + Math.random() * 0.3 });
      cloudLayersRef.current = { foreground: fgClouds, background: bgClouds };

      const starColors = ['#ffffff', '#bfdbfe', '#fef08a', '#e2e8f0', '#93c5fd'];
      const starList = []; for (let i=0; i<200; i++) starList.push({ x: Math.random(), y: Math.random(), size: Math.random() * 2 + 0.5, color: starColors[Math.floor(Math.random() * starColors.length)], alpha: Math.random() * 0.8 + 0.2, blinkOffset: Math.random() * Math.PI * 2 });
      starsRef.current = starList;

  }, [environment]);

  const engineConfig = useMemo(() => {
      const count = shipConfig.engines;
      const iconScale = 100 / 120; 
      const ySingle = 56 * iconScale; 
      const yMulti = 49 * iconScale;

      if (count === 1) return [{x: 0, y: ySingle}];
      if (count === 2) return [-25, 25].map(x => ({x: x * iconScale, y: yMulti}));
      if (count === 3) return [-25, 0, 25].map(x => ({x: x * iconScale, y: yMulti}));
      if (count >= 4) return [-35, -12, 12, 35].map(x => ({x: x * iconScale, y: yMulti}));
      return [{x: 0, y: ySingle}];
  }, [shipConfig]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime = Date.now();

    const drawSky = (width: number, height: number, scroll: number, elapsed: number) => {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, environment.skyColors[1]); grad.addColorStop(1, environment.skyColors[0]);
        ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);

        // Rainbow
        if (environment.hasRainbow && environment.rainbowConfig && scrollYRef.current < 2500) {
            const opacity = Math.max(0, 1 - scrollYRef.current / 2000) * environment.rainbowConfig.intensity;
            if (opacity > 0.05) {
                const { x, type, radiusScale } = environment.rainbowConfig;
                const cx = width * x; const cy = height * 0.75 + scrollYRef.current * 0.2; const radius = Math.min(width, height) * radiusScale;
                ctx.save(); ctx.globalAlpha = opacity;
                const colors = ['rgba(255,0,0,0.6)', 'rgba(255,127,0,0.6)', 'rgba(255,255,0,0.6)', 'rgba(0,255,0,0.6)', 'rgba(0,0,255,0.6)', 'rgba(75,0,130,0.6)', 'rgba(148,0,211,0.6)'];
                let sA = Math.PI * 1.05; let eA = Math.PI * 1.95; if (type === 'left') { eA = Math.PI * 1.55; } else if (type === 'right') { sA = Math.PI * 1.45; }
                colors.forEach((c, i) => { ctx.beginPath(); ctx.arc(cx, cy, radius - i * 5, sA, eA); ctx.strokeStyle = c; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke(); }); ctx.restore();
            }
        }

        if (scrollYRef.current > 1000) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (scrollYRef.current - 1000) / 4000)})`; ctx.fillRect(0,0,width,height); }

        if (phase === 'atmosphere' || phase === 'orbit') {
            const auroraAlpha = Math.min(0.8, Math.max(0, (scrollYRef.current - 2500) / 4000));
            if (auroraAlpha > 0) {
                ctx.save(); ctx.globalAlpha = auroraAlpha; ctx.globalCompositeOperation = 'screen';
                const t = elapsed * 0.0002;
                const cX1 = width * 0.3 + Math.sin(t) * 200; const cY1 = height * 0.4 + Math.cos(t * 0.7) * 100; const r1 = width * 0.8;
                const grad1 = ctx.createRadialGradient(cX1, cY1, 0, cX1, cY1, r1); grad1.addColorStop(0, 'rgba(52, 211, 153, 0.2)'); grad1.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad1; ctx.fillRect(0, 0, width, height);
                ctx.restore();
            }
        }

        if (environment.timeOfDay === 'night') {
            const planetData = planet as Planet;
            if (planetData.moons && planetData.moons.length > 0) {
                planetData.moons.forEach((moon, i) => {
                    const mx = width * (0.15 + (i * 0.25)); const my = height * 0.2 + (i * 50) + scroll * 0.05; const size = 30 + (i * 10);
                    if (my < height + 100) { ctx.fillStyle = moon.color || '#e2e8f0'; ctx.shadowColor = moon.color || '#e2e8f0'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(mx, my, size, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath(); ctx.arc(mx - size*0.3, my - size*0.2, size*0.2, 0, Math.PI*2); ctx.fill(); }
                });
            }
        }

        if ((environment.timeOfDay === 'day' || environment.sunType !== 'standard') && phase !== 'atmosphere' && phase !== 'orbit') {
            const celestialBaseY = height * 0.25; let cx = width * 0.8; let cy = celestialBaseY; let scale = 0.6; cy += scroll * 0.05; 
            ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
            if (environment.sunType === 'white_dwarf') { ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 40; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 80; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill(); }
            else { const sunGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 60); sunGrad.addColorStop(0, '#fef08a'); sunGrad.addColorStop(1, 'rgba(253, 224, 71, 0)'); ctx.fillStyle = sunGrad; ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI*2); ctx.fill(); }
            ctx.restore();
        }

        const showStars = environment.timeOfDay === 'night' || scroll > 2000;
        if (showStars) {
            let fade = 1; if (environment.timeOfDay === 'day') fade = Math.min(1, Math.max(0, (scroll - 1000) / 2000));
            if (fade > 0) { ctx.globalAlpha = fade; starsRef.current.forEach(star => { const blink = Math.sin(elapsed * 0.005 + star.blinkOffset) * 0.3 + 0.7; ctx.fillStyle = star.color; ctx.globalAlpha = fade * star.alpha * blink; const sy = (star.y * height + scroll * 0.1) % height; const sx = star.x * width; ctx.beginPath(); ctx.arc(sx, sy, star.size, 0, Math.PI*2); ctx.fill(); }); ctx.globalAlpha = 1; }
        }
    };

    const drawClouds = (width: number, height: number, scroll: number) => {
        const layers = cloudLayersRef.current; ctx.fillStyle = environment.cloudColor;
        layers.background.forEach(c => { const cy = c.y + scroll * 0.2; if (cy > -500 && cy < height + 500) { ctx.globalAlpha = c.opacity * 0.6; ctx.beginPath(); ctx.ellipse(c.x, cy, c.w/2, c.h/2, 0, 0, Math.PI*2); ctx.fill(); } });
        layers.foreground.forEach(c => { const cy = c.y + scroll * 0.6; if (cy > -500 && cy < height + 500) { ctx.globalAlpha = c.opacity; ctx.beginPath(); ctx.ellipse(c.x, cy, c.w/2, c.h/2, 0, 0, Math.PI*2); ctx.fill(); } });
        ctx.globalAlpha = 1.0;
    };

    const drawLandingPad = (cx: number, groundY: number) => {
        const padW = 160; 
        const padHeight = 20;
        const pY = groundY - padHeight; 
        
        // Legs
        ctx.fillStyle = '#334155'; 
        ctx.fillRect(cx - 60, groundY - 10, 20, 10); 
        ctx.fillRect(cx + 40, groundY - 10, 20, 10);
        
        // Surface
        const padGrad = ctx.createLinearGradient(cx - padW/2, pY, cx + padW/2, pY); 
        padGrad.addColorStop(0, '#1e293b'); 
        padGrad.addColorStop(0.5, '#334155'); 
        padGrad.addColorStop(1, '#1e293b'); 
        ctx.fillStyle = padGrad; 
        ctx.fillRect(cx - padW/2, pY, padW, padHeight);
        
        // Lights
        ctx.fillStyle = '#facc15'; 
        for(let i=10; i<padW; i+=20) ctx.fillRect(cx - padW/2 + i, pY + 2, 10, 4);
    };

    const drawLaunchPlatform = (cx: number, groundY: number) => {
        // Platform
        const pWidth = 200; 
        const pHeight = 20; 
        const pY = groundY - 40; 
        
        // Heavy Concrete Base
        ctx.fillStyle = '#1e293b'; 
        ctx.fillRect(cx - pWidth/2 + 20, groundY - 20, pWidth - 40, 20);
        
        // Surface
        const grad = ctx.createLinearGradient(cx - pWidth/2, pY, cx + pWidth/2, pY);
        grad.addColorStop(0, '#334155'); grad.addColorStop(0.2, '#64748b'); grad.addColorStop(0.5, '#94a3b8'); grad.addColorStop(0.8, '#64748b'); grad.addColorStop(1, '#334155');
        ctx.fillStyle = grad; 
        ctx.fillRect(cx - pWidth/2, pY, pWidth, pHeight);
        
        // Railings
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - pWidth/2, pY); ctx.lineTo(cx - pWidth/2, pY - 10); ctx.lineTo(cx + pWidth/2, pY - 10); ctx.lineTo(cx + pWidth/2, pY);
        ctx.stroke();
    };

    const drawCountdownBillboard = (x: number, y: number, elapsed: number, width: number) => {
        const bbW = 120; const bbH = 60;
        // Stand
        ctx.fillStyle = '#334155'; ctx.fillRect(x + bbW/2 - 5, y, 10, 40);
        // Board
        ctx.fillStyle = '#000'; ctx.fillRect(x, y - bbH, bbW, bbH);
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.strokeRect(x, y - bbH, bbW, bbH);
        
        // Text
        ctx.fillStyle = phase === 'countdown' ? '#ef4444' : '#10b981';
        ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
        if (phase === 'countdown') {
            ctx.fillText(`T-MINUS`, x + bbW/2, y - bbH/2 - 10);
            ctx.fillText(`00:0${countdown}`, x + bbW/2, y - bbH/2 + 15);
        } else {
            const time = Math.floor((elapsed - 3000)/1000);
            ctx.fillText(`T+ ${time}`, x + bbW/2, y - bbH/2 + 5);
        }
    };

    const drawEnvironment = (width: number, height: number, scroll: number, elapsed: number) => {
        if (scroll > 2000) return; 
        const groundY = height - 100 + scroll;

        if (environment.hasWater) {
            ctx.fillStyle = environment.timeOfDay === 'night' ? '#1e3a8a' : '#38bdf8'; ctx.fillRect(0, groundY + 10, width, height); 
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; for(let i=0; i<20; i++) { const wx = (elapsed * 0.05 + i * 100) % width; const wy = groundY + 20 + Math.sin(elapsed*0.002 + i)*10; ctx.fillRect(wx, wy, 40, 2); }
        } else {
            ctx.fillStyle = environment.groundColor; ctx.fillRect(0, groundY, width, height);
        }

        ctx.fillStyle = environment.groundColor; ctx.filter = 'brightness(0.8)'; ctx.beginPath(); ctx.moveTo(0, groundY);
        for(let x=0; x<=width; x+=40) { const roughness = environment.biome === 'industrial' || isSimpleDeparture ? 80 : 50; ctx.lineTo(x, groundY - 30 - Math.sin(x*0.01)*roughness); }
        ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.fill(); ctx.filter = 'none';

        featuresRef.current.forEach(f => {
            if (f.type === 'bird') {
                if (isSimpleDeparture) return;
                f.x += f.vx + environment.windSpeed * 0.5; f.y += f.vy + scroll * 0.7; 
                if (f.y < groundY + 200 && f.y > -50) { ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); const wy = Math.sin(elapsed * 0.015 + f.offset) * 5; ctx.moveTo(f.x - 5, f.y + wy); ctx.lineTo(f.x, f.y); ctx.lineTo(f.x + 5, f.y + wy); ctx.stroke(); }
                return;
            }
            const objY = groundY;
            
            if (f.type === 'dome') {
                const domeH = f.h; const radius = f.w / 2; ctx.save();
                ctx.save(); ctx.beginPath(); ctx.ellipse(f.x, objY, radius - 5, domeH - 5, 0, Math.PI, 0); ctx.clip();
                if (f.contents) { f.contents.forEach(item => { const ix = f.x + item.x; const iy = objY; if (item.type === 'tree') { ctx.fillStyle = item.color; ctx.beginPath(); ctx.moveTo(ix - 5, iy - item.h); ctx.lineTo(ix + 5, iy); ctx.lineTo(ix - 5, iy); ctx.fill(); ctx.beginPath(); ctx.arc(ix, iy - item.h + 5, 10, 0, Math.PI*2); ctx.fill(); } else { ctx.fillStyle = item.color; ctx.fillRect(ix - item.w/2, iy - item.h, item.w, item.h); } }); }
                ctx.restore();
                const glassGrad = ctx.createLinearGradient(f.x, objY - domeH, f.x, objY); glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)'); glassGrad.addColorStop(0.5, 'rgba(200, 230, 255, 0.1)'); glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)'); ctx.fillStyle = glassGrad; ctx.beginPath(); ctx.ellipse(f.x, objY, radius, domeH, 0, Math.PI, 0); ctx.fill();
                ctx.save(); ctx.beginPath(); ctx.ellipse(f.x, objY, radius, domeH, 0, Math.PI, 0); ctx.clip(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; ctx.lineWidth = 1; const hexSize = 25; for(let x = f.x - radius; x < f.x + radius; x+=hexSize) { ctx.beginPath(); ctx.moveTo(x, objY); ctx.lineTo(x + hexSize/2, objY - domeH); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, objY); ctx.lineTo(x - hexSize/2, objY - domeH); ctx.stroke(); } for(let y = objY; y > objY - domeH; y-=hexSize) { ctx.beginPath(); ctx.moveTo(f.x - radius, y); ctx.lineTo(f.x + radius, y); ctx.stroke(); } ctx.restore();
                ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(f.x, objY, radius, domeH, 0, Math.PI, 0); ctx.stroke(); ctx.restore();
            }
            else if (f.type === 'rock') {
                ctx.fillStyle = '#44403c'; ctx.beginPath(); ctx.moveTo(f.x, objY); ctx.lineTo(f.x - f.w/2, objY); ctx.lineTo(f.x - f.w/4, objY - f.h); ctx.lineTo(f.x + f.w/4, objY - f.h * 0.8); ctx.lineTo(f.x + f.w/2, objY); ctx.fill();
            }
            else if (f.type === 'crane') {
                ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x, objY); ctx.lineTo(f.x, objY - f.h); ctx.lineTo(f.x + 40, objY - f.h + 20); ctx.stroke();
            }
            else if (f.type === 'container') {
                ctx.fillStyle = f.color; ctx.fillRect(f.x - f.w/2, objY - f.h, f.w, f.h);
                ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(f.x - f.w/2 + 2, objY - f.h + 2, f.w - 4, f.h - 4);
            }
            else if (f.type === 'tank') {
                const w = f.w || 40; const h = f.h || 30;
                ctx.fillStyle = '#44403c'; ctx.beginPath(); ctx.roundRect(f.x, objY - h, w, h, 5); ctx.fill(); ctx.fillStyle = '#57534e'; ctx.fillRect(f.x + 5, objY - h + 5, w - 10, 5);
            }
            else if (f.type === 'chimney') {
                const w = f.w || 20; const h = f.h || 100;
                ctx.fillStyle = '#292524'; ctx.fillRect(f.x, objY - h, w, h); ctx.fillStyle = '#1c1917'; ctx.fillRect(f.x - 2, objY - h, w + 4, 5);
            }
            else if (f.type === 'skyscraper') {
                const w = f.w || 50; const h = f.h || 200;
                ctx.fillStyle = '#111827'; ctx.fillRect(f.x, objY - h, w, h); ctx.fillStyle = environment.timeOfDay === 'night' ? 'rgba(253, 224, 71, 0.8)' : 'rgba(148, 163, 184, 0.5)'; for(let r=0; r<h/15; r++) for(let c=0; c<w/10; c++) if (pseudoRandom(f.seed, c, r) > 0.6) ctx.fillRect(f.x + 2 + c*10, objY - h + 5 + r*15, 6, 8);
            } else if (f.type === 'building') {
                const h = 40 * f.scale; const w = 30 * f.scale;
                ctx.fillStyle = f.color; ctx.fillRect(f.x, objY - h, w, h); 
                // Roof for houses (Village style)
                if (f.subtype === 'house' || f.subtype === 'church') {
                    ctx.beginPath(); ctx.moveTo(f.x, objY - h); ctx.lineTo(f.x + w/2, objY - h - 15*f.scale); ctx.lineTo(f.x + w, objY - h); ctx.fill();
                }
                if (f.subtype === 'church') { ctx.fillRect(f.x + w/2 - 2, objY - h - 30, 4, 30); ctx.fillStyle = '#fff'; ctx.fillRect(f.x + w/2 - 4, objY - h - 25, 8, 2); }
                ctx.fillStyle = '#facc15'; if (pseudoRandom(f.seed, 1, 1) > 0.3) ctx.fillRect(f.x + 5, objY - h + 10, 5, 5);
            } else if (f.type === 'tree') {
                ctx.fillStyle = '#3f2c20'; ctx.fillRect(f.x, objY - 40 * f.scale, 6 * f.scale, 40 * f.scale); ctx.fillStyle = f.color; 
                const sway = Math.sin(elapsed * 0.003 + f.offset) * 5 * environment.windSpeed;
                if (environment.season === 'winter') {
                    ctx.strokeStyle = f.color; ctx.lineWidth = 2 * f.scale; ctx.beginPath(); ctx.moveTo(f.x + 3*f.scale, objY - 30*f.scale); ctx.lineTo(f.x + 3*f.scale + sway, objY - 80*f.scale); ctx.moveTo(f.x + 3*f.scale, objY - 50*f.scale); ctx.lineTo(f.x - 10*f.scale + sway, objY - 65*f.scale); ctx.moveTo(f.x + 3*f.scale, objY - 45*f.scale); ctx.lineTo(f.x + 15*f.scale + sway, objY - 60*f.scale); ctx.stroke();
                } else {
                    ctx.beginPath(); ctx.arc(f.x + 3*f.scale + sway, objY - 60*f.scale, 20*f.scale, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(f.x - 10*f.scale + sway, objY - 50*f.scale, 15*f.scale, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(f.x + 15*f.scale + sway, objY - 50*f.scale, 15*f.scale, 0, Math.PI*2); ctx.fill();
                }
            }
        });

        const towerX = (width/2) + environment.towerOffsetX;
        
        if (!isSimpleDeparture) {
            drawLaunchPlatform(towerX, groundY);
            // Tower Structure - Wide Sturdy Gantry
            const towerBaseY = groundY + 20;
            const tX = towerX - 160;
            const tW = 60;
            const tH = 300;
            
            // Main vertical Truss
            ctx.fillStyle = '#334155'; ctx.fillRect(tX, towerBaseY - tH, tW, tH);
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 4; ctx.beginPath();
            ctx.moveTo(tX, towerBaseY); ctx.lineTo(tX, towerBaseY - tH);
            ctx.moveTo(tX + tW, towerBaseY); ctx.lineTo(tX + tW, towerBaseY - tH);
            // Crossbeams
            for(let i=0; i<tH; i+=30) {
                ctx.moveTo(tX, towerBaseY - i); ctx.lineTo(tX + tW, towerBaseY - i - 30);
                ctx.moveTo(tX + tW, towerBaseY - i); ctx.lineTo(tX, towerBaseY - i - 30);
            }
            ctx.stroke();
            
            // Top Arm
            const armY = towerBaseY - 250;
            const armLen = 140 - armOffsetRef.current;
            if (armLen > 0) {
                ctx.fillStyle = '#475569'; ctx.fillRect(tX + tW, armY, armLen, 15);
                // Umbilical
                if (phase === 'countdown') {
                    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4;
                    ctx.beginPath(); ctx.moveTo(tX + tW + armLen, armY + 7);
                    ctx.quadraticCurveTo(tX + tW + armLen + 40, armY + 20, towerX, armY + 50);
                    ctx.stroke();
                }
            }

            drawCountdownBillboard(towerX - 280, groundY + 20, elapsed, width);
        } else {
            drawLandingPad(width/2, groundY);
        }
    };

    const drawShipJets = (width: number, height: number, visualY: number, visualScale: number, tiltAngle: number) => {
        const cx = (width/2) + environment.towerOffsetX;
        
        engineConfig.forEach(config => {
            const cos = Math.cos(tiltAngle); const sin = Math.sin(tiltAngle);
            const rx = (config.x * cos - config.y * sin) * visualScale;
            const ry = (config.x * sin + config.y * cos) * visualScale;
            const nx = cx + rx; 
            const ny = visualY + ry;

            // Draw Glow
            if (thrust > 0) {
                const intensity = thrust / 100;
                const jetLen = (50 + Math.random() * 30) * visualScale * intensity;
                const jetW = (10 * visualScale);
                
                ctx.save();
                ctx.translate(nx, ny);
                ctx.rotate(tiltAngle);
                
                const grad = ctx.createLinearGradient(0, 0, 0, jetLen);
                grad.addColorStop(0, '#fff');
                grad.addColorStop(0.2, '#facc15');
                grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
                
                ctx.fillStyle = grad;
                ctx.globalCompositeOperation = 'screen';
                ctx.beginPath();
                ctx.moveTo(-jetW/2, 0);
                ctx.quadraticCurveTo(0, jetLen, jetW/2, 0);
                ctx.fill();
                ctx.restore();
            }
        });
    };

    const drawParticles = (width: number, height: number) => {
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            p.life -= 0.02;
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.life <= 0) {
                particlesRef.current.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = p.life;
            if (p.type === 'smoke') {
                ctx.fillStyle = p.color || 'rgba(100,100,100,0.5)';
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            } else if (p.type === 'fire') {
                ctx.fillStyle = p.color || '#ef4444';
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            } else if (p.type === 'contrail') {
                ctx.fillStyle = p.color || '#fff';
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            } else if (p.type === 'shooting_star') {
                // Not used in launch usually but good to have
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx*2, p.y - p.vy*2); ctx.stroke();
            }
            ctx.globalAlpha = 1.0;
        }
    };

    const loop = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const width = canvas.width;
        const height = canvas.height;

        // Simple Departure Overrides: Skip countdown, shorten phases
        if (isSimpleDeparture) {
            if (phase === 'countdown') {
                setPhase('ignition'); 
                setStatusText("ENGINES HOT");
                audioService.playLaunchSequence();
            }
            // Adjusted timings for simple departure
            if (phase === 'ignition' && elapsed > 1500) { setPhase('lift'); setStatusText("ASCENT"); }
            if (phase === 'lift' && elapsed > 4500) { setPhase('atmosphere'); setStatusText("MAX THRUST"); }
            if (phase === 'atmosphere' && elapsed > 7500) { setPhase('orbit'); setStatusText("ORBITING"); }
            if (phase === 'orbit' && elapsed > 9500) { onComplete(); return; }
        } else {
            // Normal Tower Launch Sequence
            if (phase === 'countdown' && elapsed > 3000) { setPhase('ignition'); setStatusText("IGNITION SEQUENCE"); audioService.playLaunchSequence(); }
            if (phase === 'ignition' && elapsed > 5000) { setPhase('lift'); setStatusText("LIFTOFF"); }
            if (phase === 'lift' && elapsed > 9000) { setPhase('atmosphere'); setStatusText("MAX Q"); }
            if (phase === 'atmosphere' && elapsed > 13000) { setPhase('orbit'); setStatusText("ORBITAL INSERTION"); }
            if (phase === 'orbit' && elapsed > 17000) { onComplete(); return; }
        }

        const groundLevel = height - 100;
        
        // Calculate Dynamic Scale (Start BIG, Shrink to normal)
        const scaleFactor = Math.min(1, shipAltitudeRef.current / 12000); 
        let visualScale = 1.5 - (scaleFactor * 0.9); // Start 1.5, end 0.6
        if (visualScale < 0.6) visualScale = 0.6;

        // Position Logic: Barren planets start from ground, Developed start from platform
        const platformY = isSimpleDeparture ? groundLevel : groundLevel - 40; 
        
        let visualY = 0;
        
        if (phase === 'countdown' || phase === 'ignition') {
            const feetOffset = 50 * visualScale; 
            visualY = platformY - feetOffset;
        } else {
            const speed = phase === 'lift' ? 10 : (phase === 'atmosphere' ? 25 : 45);
            shipAltitudeRef.current += speed;
            scrollYRef.current = shipAltitudeRef.current * 0.5; 
            
            const targetY = height * 0.3; 
            const feetOffset = 50 * visualScale;
            const startY = platformY - feetOffset;
            
            const flightProgress = Math.min(1, shipAltitudeRef.current / 3000); 
            visualY = startY - (startY - targetY) * flightProgress;
        }
        
        let tiltAngle = 0;

        if (phase === 'ignition') {
            armOffsetRef.current += 3; 
            shipShakeRef.current = (Math.random() - 0.5) * 1.5; 
            setThrust(Math.min(100, thrust + 2)); 
            
            const cx = (width/2) + environment.towerOffsetX; 
            engineConfig.forEach(config => {
                const nx = cx + config.x * visualScale;
                const ny = visualY + config.y * visualScale; 
                // Tightly constrained fire particles - strictly from nozzle
                for(let k=0; k<8; k++) {
                    particlesRef.current.push({ 
                        x: nx + (Math.random()-0.5)*4, // Very narrow spread
                        y: ny, 
                        vx: (Math.random()-0.5)*2, // Minimal lateral spread
                        vy: 5 + Math.random()*15, 
                        life: 0.8 + Math.random()*0.4, 
                        maxLife: 1.2, 
                        size: (20 + Math.random()*10) * visualScale, 
                        type: 'fire' 
                    });
                }
                if (Math.random() > 0.5) {
                    particlesRef.current.push({ x: nx, y: ny + 20, vx: (Math.random()-0.5)*3, vy: 5+Math.random()*4, life: 1.2, maxLife: 1.2, size: 20 + Math.random()*10, type: 'smoke' });
                }
            });

        } else if (phase !== 'countdown') {
            shipShakeRef.current = (Math.random() - 0.5) * 0.8;
            
            if (phase === 'atmosphere') {
                const atmProg = Math.max(0, (elapsed - (isSimpleDeparture ? 4500 : 9000)) / 4000); 
                tiltAngle = atmProg * 0.2; 
            } else if (phase === 'orbit') {
                const orbProg = Math.max(0, (elapsed - (isSimpleDeparture ? 7500 : 13000)) / 4000);
                tiltAngle = 0.2 + (orbProg * 1.3); 
            }
            
            if (shipAltitudeRef.current > 300) { 
                setLegExtension(prev => Math.max(0, prev - 0.02)); 
            } else {
                setLegExtension(1);
            }
            
            shipRotationRef.current = tiltAngle;

            setAltitude(Math.floor(shipAltitudeRef.current / 10));
            // Recalculate velocity for display
            const speed = phase === 'lift' ? 10 : (phase === 'atmosphere' ? 25 : 45);
            setVelocity(Math.floor(speed * 30));
            setThrust(100);

            const cx = (width/2) + environment.towerOffsetX; 
            const cos = Math.cos(tiltAngle); const sin = Math.sin(tiltAngle);
            const isSpace = phase === 'atmosphere' || phase === 'orbit';

            engineConfig.forEach(config => {
                const lx = config.x; 
                const ly = config.y; 
                const rx = (lx * cos - ly * sin) * visualScale;
                const ry = (lx * sin + ly * cos) * visualScale;
                const nx = cx + rx; const ny = visualY + ry;
                const exVx = -Math.sin(tiltAngle) * (speed + 5);
                const exVy = Math.cos(tiltAngle) * (speed + 5);

                if (isSpace) {
                    if (Math.random() > 0.3) {
                        const jetLen = 80 * visualScale;
                        const tipX = nx - Math.sin(tiltAngle) * jetLen;
                        const tipY = ny + Math.cos(tiltAngle) * jetLen;
                        particlesRef.current.push({ x: tipX + (Math.random()-0.5)*5, y: tipY, vx: exVx * 0.1 + (Math.random()-0.5), vy: exVy * 0.1 + 5, life: 2.0, maxLife: 2.0, size: (8 + Math.random()*4)*visualScale, type: 'contrail', color: 'rgba(200, 200, 255, 0.3)' });
                    }
                } else if (phase === 'lift') {
                    if (Math.random() > 0.2) particlesRef.current.push({ x: nx, y: ny + 10, vx: (Math.random()-0.5)*2, vy: 10, life: 1.5, maxLife: 1.5, size: (25 + Math.random()*15)*visualScale, type: 'smoke' });
                    if (Math.random() > 0.1) particlesRef.current.push({ x: nx, y: ny, vx: (Math.random()-0.5)*2, vy: 15, life: 0.5, maxLife: 0.5, size: (15 + Math.random()*10)*visualScale, type: 'fire', rotation: tiltAngle });
                }
            });
        }

        if (shipDOMRef.current) {
            const xOffset = environment.towerOffsetX;
            shipDOMRef.current.style.transform = `
                translate(calc(-50% + ${xOffset}px), -50%) 
                translate(0, ${visualY}px) 
                translate(${shipShakeRef.current}px, 0) 
                rotate(${tiltAngle}rad) 
                scale(${visualScale})
            `;
        }

        ctx.clearRect(0,0,width,height);
        drawSky(width, height, scrollYRef.current, elapsed);
        drawClouds(width, height, scrollYRef.current);
        drawEnvironment(width, height, scrollYRef.current, elapsed);
        
        drawShipJets(width, height, visualY, visualScale, tiltAngle); 
        drawParticles(width, height);

        animId = requestAnimationFrame(loop);
    };

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    resize();
    animId = requestAnimationFrame(loop);

    const timer = setInterval(() => {
        setCountdown(prev => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize);
        clearInterval(timer);
    };
  }, [phase, onComplete, environment, engineConfig, isSimpleDeparture]);

  const handleSkip = (e: React.MouseEvent) => {
      e.stopPropagation();
      audioService.stopLaunchSequence();
      onComplete();
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black overflow-hidden font-mono">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* SHIP OVERLAY */}
      <div 
        ref={shipDOMRef}
        className="absolute left-1/2 top-0 pointer-events-none"
        style={{ width: '100px', height: '100px', transform: 'translate(-50%, -50%)' }} 
      >
          <div className="relative w-full h-full">
            {/* RETRACTABLE LEGS - TALL TELESCOPIC DESIGN */}
            <div className="absolute inset-0 z-0 overflow-visible"> 
                 <svg className="absolute w-full h-full" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
                    {/* 
                       Legs slide vertically.
                       Deployed (1): y=0 offset.
                       Retracted (0): y=-40 offset (tucks up).
                       Base Y adjusted to be taller (start at 60, extend to 100).
                    */}
                    <g transform={`translate(0, ${-45 * (1 - legExtension)})`}>
                        {/* Left Leg */}
                        <g transform="translate(25, 60)">
                            {/* Main Piston Housing (Upper) */}
                            <rect x="-4" y="-10" width="8" height="25" fill="#334155" />
                            {/* Sliding Piston (Lower) - extends down */}
                            <rect x="-2.5" y="10" width="5" height="30" fill="#94a3b8" />
                            {/* Footpad */}
                            <path d="M-8,40 L8,40 L10,44 L-10,44 Z" fill="#475569" />
                        </g>

                        {/* Right Leg */}
                        <g transform="translate(75, 60)">
                            {/* Main Piston Housing */}
                            <rect x="-4" y="-10" width="8" height="25" fill="#334155" />
                            {/* Sliding Piston */}
                            <rect x="-2.5" y="10" width="5" height="30" fill="#94a3b8" />
                            {/* Footpad */}
                            <path d="M-8,40 L8,40 L10,44 L-10,44 Z" fill="#475569" />
                        </g>
                    </g>
                 </svg>
            </div>

            <ShipIcon 
                config={shipConfig} 
                className="w-full h-full drop-shadow-2xl z-10 relative" 
                hullColor={shipColors.hull}
                wingColor={shipColors.wings}
                cockpitColor={shipColors.cockpit}
                gunColor={shipColors.guns}
                gunBodyColor={shipColors.gun_body}
                engineColor={shipColors.engines}
                nozzleColor={shipColors.nozzles}
                showJets={false} 
            />
          </div>
      </div>

      {/* FLIGHT COMPUTER UI */}
      <div className="absolute top-12 left-4 p-4 bg-zinc-900/40 border-2 border-zinc-700/50 rounded-lg text-emerald-500 shadow-lg backdrop-blur-md w-64 pointer-events-auto md:top-24">
          <div className="border-b border-zinc-700/50 pb-1 mb-2 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">FLIGHT COMPUTER</span>
              <button onClick={handleSkip} className="text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded border border-zinc-600 transition-colors uppercase font-black">SKIP</button>
          </div>
          
          <div className="grid grid-cols-2 gap-y-2 text-[10px]">
              <div className="text-zinc-400 uppercase">STATUS</div>
              <div className={`text-right font-black uppercase ${phase === 'countdown' ? 'text-yellow-400' : 'text-emerald-400'}`}>{phase}</div>
              
              {!isSimpleDeparture && (
                  <>
                    <div className="text-zinc-400 uppercase">T-MINUS</div>
                    <div className="text-right font-mono text-white">00:0{countdown}</div>
                  </>
              )}
              
              <div className="text-zinc-400 uppercase">ALTITUDE</div>
              <div className="text-right font-mono text-white">{altitude} KM</div>
              
              <div className="text-zinc-400 uppercase">VELOCITY</div>
              <div className="text-right font-mono text-white">{velocity} KPH</div>
              
              <div className="col-span-2 mt-2">
                  <div className="flex justify-between mb-1 text-[8px] text-zinc-400"><span>THRUST</span><span>{thrust}%</span></div>
                  <div className="w-full h-1 bg-zinc-800/50 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 transition-all duration-200" style={{ width: `${thrust}%` }} />
                  </div>
              </div>
          </div>
      </div>

      {/* BOTTOM STATUS BAR */}
      <div className="absolute bottom-16 left-0 right-0 h-12 bg-black/40 backdrop-blur-sm border-y border-white/10 flex items-center justify-center z-20">
          <div className="retro-font text-emerald-400 text-lg md:text-2xl tracking-[0.3em] uppercase animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
              {statusText}
          </div>
      </div>

      {/* Cinematic Bars */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-black z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-black z-10 flex items-center justify-center">
          <span className="text-zinc-500 text-xs font-mono uppercase tracking-widest">
              LAUNCH TRAJECTORY: {planet.name} ORBIT // BIOME: {environment.biome.toUpperCase()}
          </span>
      </div>
    </div>
  );
};

export default LaunchSequence;
