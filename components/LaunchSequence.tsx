
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
    seed: number, // Added seed for static randomization
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

      let biome: Biome = 'barren';
      
      // QUADRANT OVERRIDES
      if (p.quadrant === QuadrantType.DELTA) {
          biome = 'industrial'; // Delta is purely industrial/mining
      } else {
          // Normal biome logic for other sectors
          if (p.difficulty <= 5) biome = 'metropolis';
          else if (p.difficulty <= 8) biome = 'village';
          else if (p.difficulty <= 10) biome = 'outpost';
      }

      // COLOR OVERRIDES
      if (p.color === '#10b981' || p.color === '#064e3b') biome = rand(1) > 0.5 ? 'forest' : 'village'; 
      if (p.color === '#60a5fa' || p.color === '#1e40af') biome = 'ocean'; 
      if (p.color === '#ffffff') biome = 'ice';
      if ((p.color === '#ef4444' || p.color === '#991b1b') && p.quadrant !== QuadrantType.DELTA) biome = 'desert';

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

      // Sun Type - QUADRANT STRICT
      let sunType: Environment['sunType'] = 'standard';
      if (p.quadrant === QuadrantType.DELTA) sunType = 'white_dwarf';
      else if (p.quadrant === QuadrantType.BETA) sunType = 'red_giant';
      else if (p.quadrant === QuadrantType.GAMA) sunType = 'blue_neutron';

      // SKY COLORS based on Planet Color & Time & Sun Type
      let skyColors = ['#38bdf8', '#0ea5e9']; // Default Blue
      let groundColor = p.color || '#1e293b';
      let cloudColor = 'rgba(255,255,255,0.8)';

      if (biome === 'industrial') {
          groundColor = '#1c1917'; // Dark stone
          skyColors = ['#57534e', '#292524']; // Smoggy grey/brown
          cloudColor = 'rgba(120, 113, 108, 0.5)';
      }
      else if (biome === 'desert') {
          groundColor = '#9a3412'; // Red/Orange sand
          skyColors = ['#fdba74', '#c2410c']; // Orange sky
      }
      else if (season === 'winter') {
          groundColor = '#e2e8f0'; // Snow ground
          if (biome === 'forest') groundColor = '#cbd5e1';
      }

      if (timeOfDay === 'night') {
          skyColors = ['#020617', '#1e293b']; 
          cloudColor = 'rgba(100,116,139,0.3)';
          if (season === 'winter') groundColor = '#475569';
          if (biome === 'industrial') skyColors = ['#0f172a', '#000000'];
      } else {
          // Adjust Day Sky based on Sun Type
          if (sunType === 'red_giant') {
              skyColors = ['#fecaca', '#b91c1c']; 
              cloudColor = 'rgba(254, 202, 202, 0.5)';
          } else if (sunType === 'blue_neutron') {
              skyColors = ['#bfdbfe', '#1e3a8a'];
              cloudColor = 'rgba(191, 219, 254, 0.5)';
          } else if (sunType === 'white_dwarf') {
              skyColors = ['#e2e8f0', '#475569']; // Stark white/grey
              cloudColor = 'rgba(226, 232, 240, 0.4)';
          } else {
              // Standard Sun
              if (p.color.includes('green')) skyColors = ['#bbf7d0', '#15803d'];
              else if (p.color === '#ffffff') { skyColors = ['#f1f5f9', '#94a3b8']; weather = 'cloudy'; }
          }
      }
      
      if (weather === 'rain' || weather === 'snow') {
          skyColors[0] = '#334155'; 
          cloudColor = 'rgba(71, 85, 105, 0.8)';
      }

      // Rainbow Logic - STRICT HABITABLE ONLY
      const isHabitableColor = ['#10b981', '#064e3b', '#60a5fa', '#1e40af', '#3b82f6'].includes(p.color);
      const hasRainbow = isHabitableColor &&
                         (season === 'summer' || season === 'autumn') && 
                         (weather === 'cloudy' || weather === 'clear') && 
                         rand(12) > 0.6; 
      
      let rainbowConfig: Environment['rainbowConfig'] = undefined;
      if (hasRainbow) {
          const typeRoll = rand(13);
          const type = typeRoll < 0.33 ? 'left' : (typeRoll < 0.66 ? 'right' : 'full');
          let x = 0.5;
          let radiusScale = 0.8;
          if (type === 'left') { x = 0.1 + rand(14) * 0.4; radiusScale = 1.0 + rand(15) * 0.5; } 
          else if (type === 'right') { x = 0.5 + rand(14) * 0.4; radiusScale = 1.0 + rand(15) * 0.5; } 
          else { x = 0.5 + (rand(14) - 0.5) * 0.6; }
          rainbowConfig = { x, type, intensity: 0.2 + rand(16) * 0.3, radiusScale };
      }

      return {
          biome,
          timeOfDay,
          weather,
          season,
          skyColors,
          groundColor,
          cloudColor,
          windSpeed: 0.5 + rand(4) * 2,
          towerOffsetX: (rand(5) - 0.5) * 300,
          featureSide: rand(6) > 0.5 ? 'left' : 'right',
          hasWater: (biome !== 'barren' && biome !== 'industrial' && biome !== 'desert') && rand(7) > 0.6 && season !== 'winter',
          sunType,
          hasRainbow,
          rainbowConfig
      };
  }, [planet, testMode]);

  const isSimpleDeparture = useMemo(() => environment.biome === 'barren', [environment]);

  // Init Environment Features
  useEffect(() => {
      const feats = [];
      const width = window.innerWidth;
      
      // Birds (No birds in winter or industrial/barren/ice)
      if (!['ice', 'barren', 'industrial'].includes(environment.biome) && environment.season !== 'winter') {
          for(let i=0; i<15; i++) {
              feats.push({ 
                  x: Math.random() * width, 
                  y: Math.random() * 400, 
                  type: 'bird', 
                  vx: (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random()), 
                  vy: 0, 
                  speed: 1, 
                  scale: 0.5 + Math.random()*0.5, 
                  color: environment.timeOfDay === 'night' ? '#cbd5e1' : '#000', 
                  offset: Math.random() * Math.PI,
                  seed: Math.random()
              });
          }
      }

      // Generate Buildings / Trees / Industrial Props
      const sideMultiplier = environment.featureSide === 'left' ? 0.2 : 0.8;
      const zoneX = width * sideMultiplier;
      
      if (environment.biome === 'industrial' || environment.biome === 'desert') {
          
          // ADD DOMES
          if (Math.random() > 0.4) {
              const domeW = 150 + Math.random() * 100;
              const domeH = 100 + Math.random() * 50;
              const domeX = zoneX + (Math.random() - 0.5) * 400;
              const contents = [];
              const numItems = 5 + Math.floor(Math.random() * 3);
              const radius = domeW / 2;
              
              for(let k=0; k<numItems; k++) {
                  const tx = (Math.random() - 0.5) * (radius * 1.5); 
                  const type = Math.random() > 0.6 ? 'building' : 'tree';
                  contents.push({
                      x: tx,
                      w: type === 'building' ? 20 + Math.random()*20 : 10 + Math.random()*10,
                      h: type === 'building' ? 30 + Math.random()*20 : 20 + Math.random()*40,
                      type,
                      color: type === 'building' ? '#374151' : '#064e3b'
                  });
              }

              feats.push({
                  x: domeX, y: 0, w: domeW, h: domeH,
                  type: 'dome', vx: 0, vy: 0, speed: 0, scale: 1,
                  color: 'rgba(255,255,255,0.1)', offset: 0, seed: Math.random(),
                  contents
              });
          }

          // TANKS AND CHIMNEYS
          for (let i = 0; i < 8; i++) {
              const bX = zoneX + (Math.random() - 0.5) * 600;
              const type = Math.random() > 0.6 ? 'chimney' : 'tank';
              const w = type === 'tank' ? 60 + Math.random()*40 : 20 + Math.random()*20;
              const h = type === 'tank' ? 40 + Math.random()*40 : 150 + Math.random()*150;
              
              feats.push({
                  x: bX, y: 0, w, h,
                  type: type, vx: 0, vy: 0, speed: 0, scale: 1,
                  color: '#262626', offset: 0, seed: Math.random()
              });
          }
      } else if (environment.biome === 'metropolis') {
          for (let i = 0; i < 12; i++) {
              const bX = zoneX + (Math.random() - 0.5) * 500;
              const h = 100 + Math.random() * 300;
              const w = 40 + Math.random() * 60;
              feats.push({
                  x: bX, y: 0, w, h,
                  type: 'skyscraper', vx: 0, vy: 0, speed: 0, scale: 1,
                  color: '#1e293b', offset: 0, seed: Math.random()
              });
          }
      } else if (['village', 'outpost'].includes(environment.biome)) {
          for (let i = 0; i < 8; i++) {
              const bX = zoneX + (Math.random() - 0.5) * 400;
              const isChurch = Math.random() > 0.85;
              feats.push({
                  x: bX, y: 0,
                  type: 'building', vx: 0, vy: 0, speed: 0, scale: 0.6 + Math.random(),
                  color: '#374151', offset: 0, subtype: isChurch ? 'church' : 'house', seed: Math.random()
              });
          }
      } else if (['forest', 'ice'].includes(environment.biome)) {
          for (let i = 0; i < 30; i++) {
              let tColor = '#064e3b';
              if (environment.season === 'autumn') tColor = Math.random() > 0.5 ? '#d97706' : '#b45309'; 
              if (environment.season === 'winter') tColor = '#78716c'; 
              if (environment.biome === 'ice') tColor = '#bae6fd';

              feats.push({
                  x: Math.random() * width, y: 0,
                  type: 'tree', vx: 0, vy: 0, speed: 0, scale: 0.5 + Math.random(),
                  color: tColor, offset: i, seed: Math.random()
              });
          }
      }

      featuresRef.current = feats;

      // Realistic Fog Layers
      const bgClouds = [];
      for(let i=0; i<15; i++) {
          bgClouds.push({
              x: Math.random() * width,
              y: -500 + Math.random() * 800, 
              w: 300 + Math.random() * 400,
              h: 100 + Math.random() * 150,
              opacity: 0.2 + Math.random() * 0.2
          });
      }
      
      const fgClouds = [];
      for(let i=0; i<30; i++) {
          fgClouds.push({
              x: Math.random() * width,
              y: -2500 + (Math.random() - 0.5) * 1000, 
              w: 400 + Math.random() * 500,
              h: 120 + Math.random() * 200,
              opacity: 0.4 + Math.random() * 0.3
          });
      }
      
      cloudLayersRef.current = { foreground: fgClouds, background: bgClouds };

      const starColors = ['#ffffff', '#bfdbfe', '#fef08a', '#e2e8f0', '#93c5fd'];
      const starList = [];
      for (let i=0; i<200; i++) {
          starList.push({
              x: Math.random(),
              y: Math.random(),
              size: Math.random() * 2 + 0.5,
              color: starColors[Math.floor(Math.random() * starColors.length)],
              alpha: Math.random() * 0.8 + 0.2,
              blinkOffset: Math.random() * Math.PI * 2
          });
      }
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
        let c1 = environment.skyColors[0];
        let c2 = environment.skyColors[1];
        
        grad.addColorStop(0, c2);
        grad.addColorStop(1, c1);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Rainbow rendering in sky
        if (environment.hasRainbow && environment.rainbowConfig && scrollYRef.current < 2500) {
            const opacity = Math.max(0, 1 - scrollYRef.current / 2000) * environment.rainbowConfig.intensity;
            if (opacity > 0.05) {
                const { x, type, radiusScale } = environment.rainbowConfig;
                const cx = width * x;
                const cy = height * 0.75 + scrollYRef.current * 0.2; // Parallax
                const radius = Math.min(width, height) * radiusScale;
                
                ctx.save();
                ctx.globalAlpha = opacity;
                const colors = [
                    'rgba(255,0,0,0.6)', 
                    'rgba(255,127,0,0.6)', 
                    'rgba(255,255,0,0.6)', 
                    'rgba(0,255,0,0.6)', 
                    'rgba(0,0,255,0.6)', 
                    'rgba(75,0,130,0.6)', 
                    'rgba(148,0,211,0.6)'
                ];
                
                let sA = Math.PI * 1.05;
                let eA = Math.PI * 1.95;
                if (type === 'left') { eA = Math.PI * 1.55; }
                else if (type === 'right') { sA = Math.PI * 1.45; }

                colors.forEach((c, i) => {
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius - i * 5, sA, eA);
                    ctx.strokeStyle = c;
                    ctx.lineWidth = 6;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                });
                ctx.restore();
            }
        }

        if (scrollYRef.current > 1000) {
            ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (scrollYRef.current - 1000) / 4000)})`;
            ctx.fillRect(0,0,width,height);
        }

        if (phase === 'atmosphere' || phase === 'orbit') {
            const auroraAlpha = Math.min(0.8, Math.max(0, (scrollYRef.current - 2500) / 4000));
            if (auroraAlpha > 0) {
                ctx.save();
                ctx.globalAlpha = auroraAlpha;
                ctx.globalCompositeOperation = 'screen';
                
                const t = elapsed * 0.0002;
                
                const cX1 = width * 0.3 + Math.sin(t) * 200;
                const cY1 = height * 0.4 + Math.cos(t * 0.7) * 100;
                const r1 = width * 0.8;
                
                const grad1 = ctx.createRadialGradient(cX1, cY1, 0, cX1, cY1, r1);
                grad1.addColorStop(0, 'rgba(52, 211, 153, 0.2)'); 
                grad1.addColorStop(1, 'rgba(0,0,0,0)');
                
                ctx.fillStyle = grad1;
                ctx.fillRect(0, 0, width, height);

                const cX2 = width * 0.7 + Math.sin(t * 1.3) * 200;
                const cY2 = height * 0.6 + Math.cos(t * 0.5) * 100;
                const r2 = width * 0.9;
                
                const grad2 = ctx.createRadialGradient(cX2, cY2, 0, cX2, cY2, r2);
                grad2.addColorStop(0, 'rgba(167, 139, 250, 0.2)');
                grad2.addColorStop(1, 'rgba(0,0,0,0)');
                
                ctx.fillStyle = grad2;
                ctx.fillRect(0, 0, width, height);

                ctx.restore();
            }
        }

        const planetData = planet as Planet;
        
        if (environment.timeOfDay === 'night') {
            if (planetData.moons && planetData.moons.length > 0) {
                planetData.moons.forEach((moon, i) => {
                    const mx = width * (0.15 + (i * 0.25)); // SYNCED with LandingScene position logic
                    const my = height * 0.2 + (i * 50) + scroll * 0.05;
                    const size = 30 + (i * 10);
                    if (my < height + 100) {
                        ctx.fillStyle = moon.color || '#e2e8f0';
                        ctx.shadowColor = moon.color || '#e2e8f0'; ctx.shadowBlur = 15;
                        ctx.beginPath(); ctx.arc(mx, my, size, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
                        ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath(); ctx.arc(mx - size*0.3, my - size*0.2, size*0.2, 0, Math.PI*2); ctx.fill();
                    }
                });
            }
        }

        // Draw Sun if visible (Day or special types) - Only during lift/ground phases
        if ((environment.timeOfDay === 'day' || environment.sunType !== 'standard') && phase !== 'atmosphere' && phase !== 'orbit') {
            const celestialBaseY = height * 0.25;
            let cx = width * 0.8;
            let cy = celestialBaseY;
            let scale = 0.6; 

            cy += scroll * 0.05; 

            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            
            if (environment.sunType === 'white_dwarf') {
                // Bright White Star / Singularity Look
                ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 40;
                ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
                ctx.shadowBlur = 80; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill();
            } else if (environment.sunType === 'red_giant') {
                // Deep Red Giant
                ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#b91c1c'; ctx.shadowBlur = 60;
                ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI*2); ctx.fill();
            } else if (environment.sunType === 'blue_neutron') {
                // Blue Neutron Star
                const sunGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 60);
                sunGrad.addColorStop(0, '#60a5fa'); sunGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');
                ctx.fillStyle = sunGrad; ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 40;
                ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI*2); ctx.fill();
            } else {
                // Standard Yellow Star
                const sunGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 60);
                sunGrad.addColorStop(0, '#fef08a'); sunGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
                ctx.fillStyle = sunGrad; ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
        }

        const showStars = environment.timeOfDay === 'night' || scroll > 2000;
        if (showStars) {
            let fade = 1;
            if (environment.timeOfDay === 'day') {
                fade = Math.min(1, Math.max(0, (scroll - 1000) / 2000));
            }
            
            if (fade > 0) {
                ctx.globalAlpha = fade;
                starsRef.current.forEach(star => {
                    const blink = Math.sin(elapsed * 0.005 + star.blinkOffset) * 0.3 + 0.7;
                    ctx.fillStyle = star.color;
                    ctx.globalAlpha = fade * star.alpha * blink;
                    const sy = (star.y * height + scroll * 0.1) % height;
                    const sx = star.x * width;
                    ctx.beginPath(); ctx.arc(sx, sy, star.size, 0, Math.PI*2); ctx.fill();
                });
                ctx.globalAlpha = 1;
            }
        }
    };

    const drawClouds = (width: number, height: number, scroll: number) => {
        const layers = cloudLayersRef.current;
        ctx.fillStyle = environment.cloudColor;
        
        // Background Layers
        layers.background.forEach(c => {
            const cy = c.y + scroll * 0.2;
            if (cy > -500 && cy < height + 500) {
                ctx.globalAlpha = c.opacity * 0.6;
                ctx.beginPath();
                ctx.ellipse(c.x, cy, c.w/2, c.h/2, 0, 0, Math.PI*2);
                ctx.fill();
            }
        });

        // Foreground Layers
        layers.foreground.forEach(c => {
            const cy = c.y + scroll * 0.6;
            if (cy > -500 && cy < height + 500) {
                ctx.globalAlpha = c.opacity;
                ctx.beginPath();
                ctx.ellipse(c.x, cy, c.w/2, c.h/2, 0, 0, Math.PI*2);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1.0;
    };

    const drawCountdownBillboard = (x: number, y: number, elapsed: number, width: number) => {
        const boardW = 200;
        const boardH = 100;
        const legH = 150;
        
        const centerX = width / 2;
        const perspX = (x - centerX) * 0.1;

        ctx.save();
        ctx.translate(x + perspX, y + 50); 
        
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-boardW/2 + 20, 0); ctx.lineTo(-boardW/2 + 20, -legH);
        ctx.moveTo(-boardW/2 + 40, 0); ctx.lineTo(-boardW/2 + 40, -legH);
        ctx.moveTo(boardW/2 - 40, 0); ctx.lineTo(boardW/2 - 40, -legH);
        ctx.moveTo(boardW/2 - 20, 0); ctx.lineTo(boardW/2 - 20, -legH);
        for(let i=0; i<legH; i+=20) {
            ctx.moveTo(-boardW/2 + 20, -i); ctx.lineTo(-boardW/2 + 40, -i-20);
            ctx.moveTo(boardW/2 - 40, -i); ctx.lineTo(boardW/2 - 20, -i-20);
        }
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-boardW/2, -legH - boardH, boardW, boardH);
        
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 8;
        ctx.strokeRect(-boardW/2, -legH - boardH, boardW, boardH);
        
        ctx.fillStyle = '#000';
        ctx.fillRect(-boardW/2 + 10, -legH - boardH + 10, boardW - 20, boardH - 20);
        
        if (phase === 'countdown' || phase === 'ignition') {
             const blink = Math.floor(elapsed / 500) % 2 === 0;
             ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
             ctx.font = 'bold 60px monospace';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.shadowColor = '#ef4444';
             ctx.shadowBlur = 10;
             
             const timeLeft = Math.max(0, Math.ceil((3000 - elapsed) / 1000));
             const text = phase === 'countdown' ? `${timeLeft}` : 'GO';
             ctx.fillText(text, 0, -legH - boardH/2);
             ctx.shadowBlur = 0;
        } else {
             ctx.fillStyle = '#10b981';
             ctx.font = 'bold 30px monospace';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.shadowColor = '#10b981';
             ctx.shadowBlur = 10;
             const t = Math.floor((Date.now() - startTime) / 100);
             ctx.fillText(`+${t}`, 0, -legH - boardH/2);
             ctx.shadowBlur = 0;
        }
        
        ctx.restore();
    };

    const drawLaunchPlatform = (cx: number, groundY: number, scroll: number) => {
        // Platform Specs
        const pWidth = 180; 
        const pHeight = 20; 
        const legW = 10;
        const pY = groundY - 40; 

        // Draw Legs (Gray Wireframe)
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cx - pWidth/2 + 10, pY, legW, 40); 
        ctx.fillRect(cx + pWidth/2 - 20, pY, legW, 40);

        // Cross Bracing (Wireframe)
        ctx.strokeStyle = '#64748b'; 
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Left Leg X-Brace
        ctx.moveTo(cx - pWidth/2 + 10, pY); ctx.lineTo(cx - pWidth/2 + 20, pY + 40);
        ctx.moveTo(cx - pWidth/2 + 20, pY); ctx.lineTo(cx - pWidth/2 + 10, pY + 40);
        // Right Leg X-Brace
        ctx.moveTo(cx + pWidth/2 - 20, pY); ctx.lineTo(cx + pWidth/2 - 10, pY + 40);
        ctx.moveTo(cx + pWidth/2 - 10, pY); ctx.lineTo(cx + pWidth/2 - 20, pY + 40);
        ctx.stroke();

        // Solid Metallic Surface (Dark Gray Gradient)
        const grad = ctx.createLinearGradient(cx - pWidth/2, pY, cx + pWidth/2, pY);
        grad.addColorStop(0, '#334155');
        grad.addColorStop(0.2, '#64748b');
        grad.addColorStop(0.5, '#94a3b8'); // Metallic shine
        grad.addColorStop(0.8, '#64748b');
        grad.addColorStop(1, '#334155');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - pWidth/2, pY, pWidth, pHeight);

        // Rim/Edge
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - pWidth/2, pY, pWidth, pHeight);

        // Front Support Beam
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cx - pWidth/2, pY + pHeight, pWidth, 5);
        
        // Hazard Markings
        ctx.fillStyle = '#facc15';
        for(let i=0; i<pWidth; i+=20) {
            ctx.fillRect(cx - pWidth/2 + i, pY + pHeight + 2, 10, 3);
        }
    };

    const drawEnvironment = (width: number, height: number, scroll: number, elapsed: number) => {
        if (scroll > 2000) return; 
        const groundY = height - 100 + scroll;

        if (environment.hasWater) {
            ctx.fillStyle = environment.timeOfDay === 'night' ? '#1e3a8a' : '#38bdf8';
            ctx.fillRect(0, groundY + 10, width, height); 
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            for(let i=0; i<20; i++) {
                const wx = (elapsed * 0.05 + i * 100) % width;
                const wy = groundY + 20 + Math.sin(elapsed*0.002 + i)*10;
                ctx.fillRect(wx, wy, 40, 2);
            }
        } else {
            ctx.fillStyle = environment.groundColor;
            ctx.fillRect(0, groundY, width, height);
        }

        ctx.fillStyle = environment.groundColor;
        ctx.filter = 'brightness(0.8)';
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        for(let x=0; x<=width; x+=40) {
            const roughness = environment.biome === 'industrial' || isSimpleDeparture ? 80 : 50;
            ctx.lineTo(x, groundY - 30 - Math.sin(x*0.01)*roughness);
        }
        ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.fill();
        ctx.filter = 'none';

        featuresRef.current.forEach(f => {
            if (f.type === 'bird') {
                if ((phase === 'ignition' || phase === 'lift') && f.state === 'idle') {
                    f.state = 'fleeing';
                    f.vx = (f.x < width/2 ? -1 : 1) * (4 + Math.random()*2);
                    f.vy = -2 - Math.random()*2;
                }
                f.x += f.vx + environment.windSpeed * 0.5;
                f.y += f.vy + scroll * 0.7; 
                if (f.y < groundY + 200 && f.y > -50) {
                    ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath();
                    const wy = Math.sin(elapsed * 0.015 + f.offset) * 5;
                    ctx.moveTo(f.x - 5, f.y + wy); ctx.lineTo(f.x, f.y); ctx.lineTo(f.x + 5, f.y + wy);
                    ctx.stroke();
                }
                return;
            }

            const objY = groundY;
            
            // INDUSTRIAL STRUCTURES
            if (f.type === 'dome') {
                const domeH = f.h;
                const radius = f.w / 2;
                ctx.save();
                ctx.save(); ctx.beginPath(); ctx.ellipse(f.x, objY, radius - 5, domeH - 5, 0, Math.PI, 0); ctx.clip();
                if (f.contents) { f.contents.forEach(item => { const ix = f.x + item.x; const iy = objY; if (item.type === 'tree') { ctx.fillStyle = item.color; ctx.beginPath(); ctx.moveTo(ix - 5, iy - item.h); ctx.lineTo(ix + 5, iy); ctx.lineTo(ix - 5, iy); ctx.fill(); ctx.beginPath(); ctx.arc(ix, iy - item.h + 5, 10, 0, Math.PI*2); ctx.fill(); } else { ctx.fillStyle = item.color; ctx.fillRect(ix - item.w/2, iy - item.h, item.w, item.h); ctx.fillStyle = '#facc15'; if (pseudoRandom(f.seed, ix, iy) > 0.3) { ctx.fillRect(ix - 2, iy - item.h + 5, 4, 4); } } }); }
                ctx.restore();
                const glassGrad = ctx.createLinearGradient(f.x, objY - domeH, f.x, objY); glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)'); glassGrad.addColorStop(0.5, 'rgba(200, 230, 255, 0.1)'); glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)'); ctx.fillStyle = glassGrad; ctx.beginPath(); ctx.ellipse(f.x, objY, radius, domeH, 0, Math.PI, 0); ctx.fill();
                ctx.save(); ctx.beginPath(); ctx.ellipse(f.x, objY, radius, domeH, 0, Math.PI, 0); ctx.clip(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; ctx.lineWidth = 1; const hexSize = 25; for(let x = f.x - radius; x < f.x + radius; x+=hexSize) { ctx.beginPath(); ctx.moveTo(x, objY); ctx.lineTo(x + hexSize/2, objY - domeH); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, objY); ctx.lineTo(x - hexSize/2, objY - domeH); ctx.stroke(); } for(let y = objY; y > objY - domeH; y-=hexSize) { ctx.beginPath(); ctx.moveTo(f.x - radius, y); ctx.lineTo(f.x + radius, y); ctx.stroke(); } ctx.restore();
                ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(f.x, objY, radius, domeH, 0, Math.PI, 0); ctx.stroke(); ctx.restore();
            }
            else if (f.type === 'tank') {
                const w = f.w || 40; const h = f.h || 30;
                ctx.fillStyle = '#44403c'; ctx.beginPath(); ctx.roundRect(f.x, objY - h, w, h, 5); ctx.fill();
                ctx.fillStyle = '#57534e'; ctx.fillRect(f.x + 5, objY - h + 5, w - 10, 5);
                if (f.seed > 0.5) { ctx.fillStyle = 'rgba(124, 45, 18, 0.3)'; ctx.fillRect(f.x, objY - 10, w, 10); }
            }
            else if (f.type === 'chimney') {
                const w = f.w || 20; const h = f.h || 100;
                ctx.fillStyle = '#292524'; ctx.fillRect(f.x, objY - h, w, h);
                ctx.fillStyle = '#1c1917'; ctx.fillRect(f.x - 2, objY - h, w + 4, 5);
            }
            else if (f.type === 'skyscraper') {
                const w = f.w || 50; const h = f.h || 200;
                ctx.fillStyle = '#111827'; ctx.fillRect(f.x, objY - h, w, h);
                ctx.fillStyle = environment.timeOfDay === 'night' ? 'rgba(253, 224, 71, 0.8)' : 'rgba(148, 163, 184, 0.5)';
                for(let r=0; r<h/15; r++) for(let c=0; c<w/10; c++) if (pseudoRandom(f.seed, c, r) > 0.6) ctx.fillRect(f.x + 2 + c*10, objY - h + 5 + r*15, 6, 8);
            } else if (f.type === 'building') {
                const h = 40 * f.scale; const w = 30 * f.scale;
                ctx.fillStyle = f.color; ctx.fillRect(f.x, objY - h, w, h);
                ctx.beginPath(); ctx.moveTo(f.x - 2, objY - h); ctx.lineTo(f.x + w/2, objY - h - 15*f.scale); ctx.lineTo(f.x + w + 2, objY - h); ctx.fill();
                if (f.subtype === 'church') { ctx.fillRect(f.x + w/2 - 2, objY - h - 30, 4, 30); ctx.fillStyle = '#fff'; ctx.fillRect(f.x + w/2 - 4, objY - h - 25, 8, 2); }
                ctx.fillStyle = '#facc15'; if (pseudoRandom(f.seed, 1, 1) > 0.3) ctx.fillRect(f.x + 5, objY - h + 10, 5, 5);
            } else if (f.type === 'tree') {
                ctx.fillStyle = '#3f2c20'; ctx.fillRect(f.x, objY - 40 * f.scale, 6 * f.scale, 40 * f.scale);
                ctx.fillStyle = f.color; 
                const sway = Math.sin(elapsed * 0.003 + f.offset) * 5 * environment.windSpeed;
                if (environment.season === 'winter') {
                    ctx.strokeStyle = f.color; ctx.lineWidth = 2 * f.scale; ctx.beginPath();
                    ctx.moveTo(f.x + 3*f.scale, objY - 30*f.scale); ctx.lineTo(f.x + 3*f.scale + sway, objY - 80*f.scale);
                    ctx.moveTo(f.x + 3*f.scale, objY - 50*f.scale); ctx.lineTo(f.x - 10*f.scale + sway, objY - 65*f.scale);
                    ctx.moveTo(f.x + 3*f.scale, objY - 45*f.scale); ctx.lineTo(f.x + 15*f.scale + sway, objY - 60*f.scale); ctx.stroke();
                } else {
                    ctx.beginPath(); ctx.arc(f.x + 3*f.scale + sway, objY - 60*f.scale, 20*f.scale, 0, Math.PI*2); ctx.fill();
                    ctx.beginPath(); ctx.arc(f.x - 10*f.scale + sway, objY - 50*f.scale, 15*f.scale, 0, Math.PI*2); ctx.fill();
                    ctx.beginPath(); ctx.arc(f.x + 15*f.scale + sway, objY - 50*f.scale, 15*f.scale, 0, Math.PI*2); ctx.fill();
                }
            }
        });

        const towerX = (width/2) + environment.towerOffsetX;
        
        if (!isSimpleDeparture) {
            drawLaunchPlatform(towerX, groundY, scroll);
            // Tower Structure
            ctx.fillStyle = '#334155'; ctx.fillRect(towerX - 140, groundY + 20, 280, 20); // Foundation lowered
            drawCountdownBillboard(towerX - 250, groundY + 20, elapsed, width);
        } else {
            // Simple Departure: scorch marks or just ground
            // Add scorch mark
            ctx.save();
            ctx.translate(width / 2, groundY);
            ctx.scale(1, 0.2);
            const scorchGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 80);
            scorchGrad.addColorStop(0, 'rgba(0,0,0,0.8)');
            scorchGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = scorchGrad;
            ctx.beginPath();
            ctx.arc(0, 0, 80, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
    };

    const drawParticles = (width: number, height: number) => {
        // Rain altitude check: clear out in higher atmosphere (2200px)
        if (environment.weather === 'rain' && scrollYRef.current < 2200) {
            ctx.strokeStyle = 'rgba(200,200,255,0.3)'; ctx.lineWidth = 1; ctx.beginPath();
            for(let i=0; i<15; i++) { particlesRef.current.push({ x: Math.random() * width, y: -20, vx: environment.windSpeed * 2, vy: 15 + Math.random()*10, life: 1, maxLife: 1, size: 10 + Math.random()*15, type: 'rain' }); }
        }
        if (environment.weather === 'snow' && scrollYRef.current < 1500) { // STOP SNOW AT ALTITUDE
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            for(let i=0; i<5; i++) { 
                particlesRef.current.push({ 
                    x: Math.random() * width, 
                    y: -20, 
                    vx: (Math.random()-0.5)*2 + environment.windSpeed * 4, // Blown by wind
                    vy: 1 + Math.random()*2, 
                    life: 1, maxLife: 1, 
                    size: 1.5 + Math.random()*2, // Smaller
                    type: 'snow' 
                }); 
            }
        }
        
        ctx.globalCompositeOperation = 'lighter'; 

        for(let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i]; 
            p.x += p.vx; 
            p.y += p.vy; 
            p.life -= 0.02;
            
            if (p.type === 'smoke') { 
                const altitudeFactor = Math.max(0, 1 - (p.y / height)); 
                p.vx += (environment.windSpeed * 0.05 * altitudeFactor); 
            }
            
            if (p.type === 'fire') { 
                p.size *= 0.96; 
                ctx.globalAlpha = Math.min(1, p.life * 1.5); 
                // Enhanced Red/Yellow Fire
                const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
                gradient.addColorStop(0, 'rgba(255, 255, 100, 1)'); 
                gradient.addColorStop(0.3, 'rgba(255, 150, 0, 0.8)'); 
                gradient.addColorStop(1, 'rgba(200, 0, 0, 0)'); 
                
                ctx.fillStyle = gradient;
                
                ctx.save();
                ctx.translate(p.x, p.y);
                if (p.rotation) ctx.rotate(p.rotation);
                ctx.scale(1, 4); 
                ctx.beginPath(); 
                ctx.arc(0, 0, p.size, 0, Math.PI*2); 
                ctx.fill();
                ctx.restore();
            } 
            else if (p.type === 'smoke' || p.type === 'contrail') { 
                ctx.globalCompositeOperation = 'source-over'; 
                p.size += (p.type === 'contrail' ? 0.3 : 0.5); 
                
                const altRatio = Math.min(1, Math.max(0, (2000 - p.y) / 2000));
                const cVal = Math.floor(50 + altRatio * 200);
                const color = p.color || `rgb(${cVal},${cVal},${cVal})`;
                
                ctx.globalAlpha = p.life * (p.type === 'contrail' ? 0.4 : 0.3); 
                ctx.fillStyle = color; 
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
                ctx.globalCompositeOperation = 'lighter'; 
            } 
            else if (p.type === 'rain') { 
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = 'rgba(200,200,255,0.4)'; 
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx, p.y - p.size); ctx.stroke();
                ctx.globalCompositeOperation = 'lighter';
            }
            else if (p.type === 'snow') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
                ctx.globalCompositeOperation = 'lighter';
            }
            if (p.life <= 0 || p.y > height + 100) particlesRef.current.splice(i, 1);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over'; 
    };

    const drawShipJets = (width: number, height: number, visualY: number, visualScale: number, tiltAngle: number) => {
        const isLaunch = phase === 'ignition' || phase === 'lift';
        const isSpace = phase === 'atmosphere' || phase === 'orbit';
        if (!isLaunch && !isSpace) return;
        
        const cx = (width/2) + environment.towerOffsetX;
        const cos = Math.cos(tiltAngle); const sin = Math.sin(tiltAngle);
        
        engineConfig.forEach(config => {
            const lx = config.x; 
            const ly = config.y; 
            
            const rx = (lx * cos - ly * sin) * visualScale;
            const ry = (lx * sin + ly * cos) * visualScale;
            const nx = cx + rx; 
            const ny = visualY + ry;

            ctx.save();
            ctx.translate(nx, ny);
            ctx.rotate(tiltAngle); 
            ctx.scale(visualScale, visualScale);

            if (isLaunch) {
                // RICH RED LONG JET
                const jetLen = 120 + Math.random() * 40;
                const grad = ctx.createLinearGradient(0, 0, 0, jetLen);
                grad.addColorStop(0, '#fff'); // White hot core
                grad.addColorStop(0.1, '#facc15'); // Yellow
                grad.addColorStop(0.4, '#ef4444'); // Red
                grad.addColorStop(1, 'rgba(100, 0, 0, 0)'); // Smoke fade
                
                ctx.fillStyle = grad;
                ctx.globalCompositeOperation = 'lighter';
                
                // Matches scaled nozzle width (~16px)
                ctx.beginPath();
                ctx.ellipse(0, 0, 8, 2.5, 0, 0, Math.PI * 2); 
                ctx.fill();
                
                ctx.beginPath();
                ctx.moveTo(-8, 0); 
                ctx.quadraticCurveTo(0, -5, 8, 0); 
                ctx.lineTo(0, jetLen);
                ctx.fill();
            } else {
                // BLUE TURBO JET (SPACE)
                const jetLen = 80 + Math.random() * 20;
                const grad = ctx.createLinearGradient(0, 0, 0, jetLen);
                grad.addColorStop(0, '#fff');
                grad.addColorStop(0.2, '#00f2ff');
                grad.addColorStop(1, 'rgba(0, 242, 255, 0)');
                
                ctx.fillStyle = grad;
                ctx.globalCompositeOperation = 'lighter';
                
                ctx.beginPath();
                ctx.ellipse(0, 0, 6, 2, 0, 0, Math.PI * 2); // Rounded top
                ctx.fill();
                
                ctx.beginPath();
                ctx.moveTo(-6, 0);
                ctx.quadraticCurveTo(0, -4, 6, 0); // Rounded top cone
                ctx.lineTo(0, jetLen);
                ctx.fill();
            }
            
            ctx.restore();
        });
        ctx.globalCompositeOperation = 'source-over';
    };

    const drawTower = (width: number, height: number, scroll: number, retract: number) => {
        if (scroll > 2000) return;
        const groundY = height - 100 + scroll;
        const cx = (width / 2) + environment.towerOffsetX; 
        const towerX = cx - 130; 
        const towerTop = groundY - 220; 

        // Draw Main Tower Structure
        ctx.strokeStyle = '#64748b'; ctx.lineWidth = 4; ctx.beginPath();
        ctx.moveTo(towerX - 25, groundY); ctx.lineTo(towerX - 25, towerTop);
        ctx.moveTo(towerX + 25, groundY); ctx.lineTo(towerX + 25, towerTop);
        for(let y = groundY; y > towerTop; y -= 40) { ctx.moveTo(towerX - 25, y); ctx.lineTo(towerX + 25, y - 40); ctx.moveTo(towerX + 25, y); ctx.lineTo(towerX - 25, y - 40); }
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.fillRect(towerX - 35, towerTop, 70, 8); 
        
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(towerX - 25, towerTop); ctx.lineTo(towerX - 30, towerTop - 25);
        ctx.moveTo(towerX + 25, towerTop); ctx.lineTo(towerX + 30, towerTop - 15);
        ctx.moveTo(towerX, towerTop); ctx.lineTo(towerX, towerTop - 65);
        ctx.stroke();

        if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(towerX, towerTop - 65, 3, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
        }

        const shipCenterY = groundY - 107.5;
        const upperY = shipCenterY - 15;
        const lowerY = shipCenterY + 30;

        const drawDiscreteClamp = (y: number, isLower: boolean) => {
            const gap = (cx - 75) - (towerX + 25);
            const targetX = isLower ? (cx - 45) : (cx - 30);
            const reach = targetX - (towerX + 25);
            const currentReach = Math.max(10, reach - retract);

            ctx.fillStyle = '#334155'; // Darker, discrete
            ctx.fillRect(towerX + 25, y - 2, currentReach, 4); // Thinner line
            
            // Claw at end
            ctx.fillStyle = '#475569';
            ctx.fillRect(towerX + 25 + currentReach, y - 6, 6, 12);
        };

        drawDiscreteClamp(upperY, false);
        drawDiscreteClamp(lowerY, true);
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
            // Adjust visualY to account for visualScale offset. 
            // At scale 1.0, center is 50px up. 
            // Simple departure needs legs to touch ground. 
            // Ship center 50, legs bottom 100.
            // If scale 1.5, bottom is 75px down from center.
            // groundLevel is Y. Ship Center Y needs to be (groundLevel - 75).
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
                const ny = visualY + config.y * visualScale; // Match nozzle offset
                // Massive Red Fire Jet - Burst Visible
                for(let k=0; k<8; k++) {
                    particlesRef.current.push({ 
                        x: nx + (Math.random()-0.5)*15 * visualScale, 
                        y: ny, 
                        vx: (Math.random()-0.5)*10, 
                        vy: 5 + Math.random()*15, // Downward burst
                        life: 0.8 + Math.random()*0.4, 
                        maxLife: 1.2, 
                        size: (20 + Math.random()*30) * visualScale, 
                        type: 'fire'
                    });
                }
                // Smoke
                if (Math.random() > 0.5) {
                    particlesRef.current.push({ x: nx + (Math.random()-0.5)*15, y: ny + 20, vx: (Math.random()-0.5)*8, vy: 5+Math.random()*4, life: 1.2, maxLife: 1.2, size: 20 + Math.random()*20, type: 'smoke' });
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
                const ly = config.y; // Nozzle Tip
                const rx = (lx * cos - ly * sin) * visualScale;
                const ry = (lx * sin + ly * cos) * visualScale;
                const nx = cx + rx; const ny = visualY + ry;
                const exVx = -Math.sin(tiltAngle) * (speed + 5);
                const exVy = Math.cos(tiltAngle) * (speed + 5);

                if (isSpace) {
                    // Contrail Smoke - Attached to jet
                    if (Math.random() > 0.3) {
                        const jetLen = 80 * visualScale;
                        // Spawn at end of jet
                        const tipX = nx - Math.sin(tiltAngle) * jetLen;
                        const tipY = ny + Math.cos(tiltAngle) * jetLen;
                        
                        particlesRef.current.push({ 
                            x: tipX + (Math.random()-0.5)*5, 
                            y: tipY, 
                            vx: exVx * 0.1 + (Math.random()-0.5), 
                            vy: exVy * 0.1 + 5, // Drifts away
                            life: 2.0, maxLife: 2.0, 
                            size: (8 + Math.random()*4)*visualScale, 
                            type: 'contrail',
                            color: 'rgba(200, 200, 255, 0.3)'
                        });
                    }
                } else if (phase === 'lift') {
                    // Launch Smoke Trail
                    if (Math.random() > 0.2) { 
                        particlesRef.current.push({ 
                            x: nx, y: ny + 10, 
                            vx: (Math.random()-0.5)*5, 
                            vy: 10, 
                            life: 1.5, maxLife: 1.5, 
                            size: (25 + Math.random()*15)*visualScale, 
                            type: 'smoke' 
                        });
                    }
                    // Fire particles at nozzle
                    if (Math.random() > 0.1) {
                        particlesRef.current.push({
                            x: nx, y: ny,
                            vx: (Math.random()-0.5)*5,
                            vy: 15,
                            life: 0.5, maxLife: 0.5,
                            size: (15 + Math.random()*10)*visualScale,
                            type: 'fire',
                            rotation: tiltAngle
                        });
                    }
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
        if (!isSimpleDeparture) {
            drawTower(width, height, scrollYRef.current, armOffsetRef.current);
        }
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
            {/* RETRACTABLE LEGS */}
            <div className="absolute inset-0 z-0 overflow-visible"> 
                 <svg className="absolute w-full h-full" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
                    <g transform={`translate(25, 50) rotate(${(1 - legExtension) * 90})`}>
                        <path d="M0,0 L-15,25" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
                        <g transform={`translate(-15, 25) rotate(${(1 - legExtension) * -60})`}>
                             <path d="M0,0 L5,25" stroke="#94a3b8" strokeWidth="3" />
                             <path d="M0,25 L15,25 L18,29 L-5,29 Z" fill="#475569" />
                        </g>
                        <circle cx="-15" cy="25" r="3" fill="#64748b" />
                    </g>

                    <g transform={`translate(75, 50) rotate(${-(1 - legExtension) * 90})`}>
                        <path d="M0,0 L15,25" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
                        <g transform={`translate(15, 25) rotate(${(1 - legExtension) * 60})`}>
                             <path d="M0,0 L-5,25" stroke="#94a3b8" strokeWidth="3" />
                             <path d="M0,25 L-15,25 L-18,29 L5,29 Z" fill="#475569" />
                        </g>
                        <circle cx="15" cy="25" r="3" fill="#64748b" />
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

      {/* FLIGHT COMPUTER UI - Semi Transparent */}
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
