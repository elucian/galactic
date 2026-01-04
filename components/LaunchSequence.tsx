
// CHECKPOINT: Defender V49.0
// VERSION: V49.0 - Master Cinematic Launch
import { ExtendedShipConfig } from '../constants';
import { ShipIcon } from '../App';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Planet, Moon } from '../types';

interface LaunchSequenceProps {
  planet: Planet | Moon;
  ownedShips: Array<{
    config: ExtendedShipConfig;
    colors: any;
  }>;
  onComplete: () => void;
}

const LaunchSequence: React.FC<LaunchSequenceProps> = ({ planet, ownedShips, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [startTime] = useState(Date.now());
  const duration = 22000; // Optimal time for a cinematic arc

  const starsRef = useRef<any[]>([]);

  // Individual ship parameters for a majestic staggered launch
  const launchParams = useMemo(() => ownedShips.map((_, i) => ({
    delay: i * 3000, // 3s gap between each launch
    xStart: (i - (ownedShips.length - 1) / 2) * 250,
    towerColor: `rgba(100, 116, 139, ${0.45 + Math.random() * 0.1})`,
    id: i
  })), [ownedShips]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    
    // Buildings/Skyline silhouettes for ground site
    const buildings = Array.from({ length: 60 }).map(() => ({
      x: Math.random() * window.innerWidth,
      w: 120 + Math.random() * 250,
      h: 200 + Math.random() * 800,
      color: `rgba(12, 12, 15, ${0.9 + Math.random() * 0.1})`
    }));

    const initStars = (w: number, h: number) => {
      // Dense starfield covering the ENTIRE viewport
      starsRef.current = Array.from({ length: 2200 }).map(() => ({
        x: Math.random() * w,
        y: Math.random() * h,
        s: 0.5 + Math.random() * 3,
        v: 0.02 + Math.random() * 0.08,
        hue: Math.random() > 0.85 ? Math.random() * 360 : 215,
        twinkle: Math.random()
      }));
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars(canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    const drawBackground = (progress: number, pColor: string) => {
      // CLEAR TO DEEP SPACE BLACK
      ctx.fillStyle = '#010103';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const isInSpace = progress > 0.6;
      const isOrbiting = progress > 0.85;

      // Draw Starfield - Full Screen Coverage
      starsRef.current.forEach(s => {
        // Star drift accelerates as ship gains speed
        const driftScale = isInSpace ? (isOrbiting ? 0.2 : 2) : 1;
        const driftY = (Date.now() - startTime) * s.v * driftScale * 0.05;
        const sy = (s.y + driftY) % canvas.height;
        
        if (isInSpace) {
          ctx.fillStyle = `hsl(${s.hue}, 95%, 85%)`;
          ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.004 + s.x) * 0.4;
        } else {
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = Math.max(0, (progress - 0.1) * 2);
        }
        ctx.fillRect(s.x, sy, s.s, s.s);
      });
      ctx.globalAlpha = 1;

      // Atmospheric Diffusion
      const skyAlpha = Math.max(0, 1 - (Math.pow(progress, 1.8) / 0.75));
      if (skyAlpha > 0) {
        ctx.globalAlpha = skyAlpha;
        const atmos = ctx.createLinearGradient(0, canvas.height, 0, 0);
        atmos.addColorStop(0, '#f9731644'); // Horizon Glow
        atmos.addColorStop(0.3, '#ef444433'); // Reddish tint
        atmos.addColorStop(0.7, '#3b82f633'); // Blue Sky
        atmos.addColorStop(1, 'transparent');
        ctx.fillStyle = atmos;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Planet Tint
        ctx.fillStyle = pColor;
        ctx.globalAlpha = skyAlpha * 0.15;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Foggy Ground Layer
        const fog = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - 600);
        fog.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        fog.addColorStop(1, 'transparent');
        ctx.fillStyle = fog;
        ctx.fillRect(0, canvas.height - 600, canvas.width, 600);
        ctx.globalAlpha = 1;
      }

      // Receding Planet Horizon (Spherical curve)
      const recedeProgress = Math.pow(progress, 2.3);
      const planetY = (canvas.height * 0.9) + (recedeProgress * canvas.height * 4);
      if (planetY < canvas.height + 1500) {
        ctx.fillStyle = '#050505';
        ctx.beginPath();
        // Draw a massive circle to represent the planet receding
        ctx.arc(canvas.width / 2, planetY + 2000, 2500, 0, Math.PI * 2);
        ctx.fill();

        // Atmospheric Edge Glow
        ctx.strokeStyle = pColor;
        ctx.lineWidth = 10;
        ctx.globalAlpha = skyAlpha * 0.7;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, planetY + 2000, 2500, Math.PI * 1.25, Math.PI * 1.75);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };

    const drawLaunchTower = (tx: number, ty: number, th: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      const tw = 120;
      ctx.strokeRect(tx - tw/2, ty - th, tw, th);
      const segs = 14;
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) {
        const h = ty - (i * (th/segs));
        ctx.moveTo(tx - tw/2, h); ctx.lineTo(tx + tw/2, h);
        if (i < segs) {
          ctx.moveTo(tx - tw/2, h); ctx.lineTo(tx + tw/2, h - (th/segs));
          ctx.moveTo(tx + tw/2, h); ctx.lineTo(tx - tw/2, h - (th/segs));
        }
      }
      ctx.stroke();
    };

    const loop = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const pColor = (planet as Planet).color || '#10b981';

      drawBackground(progress, pColor);

      // Render Ground Environment
      const groundShift = Math.pow(progress, 2.5) * (canvas.height * 6);
      const groundY = (canvas.height * 0.92) + groundShift;

      if (groundY < canvas.height + 2000) {
        buildings.forEach(b => {
          ctx.fillStyle = b.color;
          ctx.fillRect(b.x, groundY - b.h, b.w, b.h);
        });

        launchParams.forEach(p => {
          const sElapsed = Math.max(0, elapsed - p.delay);
          const sProgress = Math.min(sElapsed / (duration - p.delay), 1);
          const sLift = Math.pow(sProgress, 2.5) * (canvas.height * 6);
          const currentT = (canvas.height * 0.92) + sLift;
          if (currentT < canvas.height + 1000) {
            drawLaunchTower((canvas.width / 2) + p.xStart - 180, currentT, 300, p.towerColor);
          }
        });

        // Deep Shadow below ground
        ctx.fillStyle = '#010101';
        if (groundY < canvas.height) ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
      }

      if (progress < 1) animationFrameId = requestAnimationFrame(loop);
      else onComplete();
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [onComplete, planet, startTime, duration, launchParams]);

  return (
    <div className="fixed inset-0 z-[5000] bg-[#010103] overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* CINEMATIC SHIP TRAJECTORY - SHIPS FLY AWAY AND SHRINK TO 0 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {ownedShips.map((ship, idx) => {
          const param = launchParams[idx];
          const elapsed = Date.now() - startTime;
          const sElapsed = Math.max(0, elapsed - param.delay);
          const sProgress = Math.min(sElapsed / (duration - param.delay), 1);
          
          // PHASE TRAJECTORY LOGIC
          // 1. Initial Ignition (Shaking on Pad)
          // 2. Main Ascent (Vertical Climb, Zoom Out starts)
          // 3. Pitch over (Gravity Turn, curving across screen)
          // 4. Orbital Insertion (Horizontal path, tiny dot, Fade out)

          let verticalY = window.innerHeight * 0.92;
          let horizontalX = param.xStart;
          let rotation = 0; // Degrees
          let scale = 1.8;
          let opacity = 1;

          if (sProgress > 0 && sProgress <= 0.08) {
            // Pad vibration
            const vibration = Math.sin(Date.now() * 0.6) * 3;
            verticalY += vibration;
            rotation = 0;
            scale = 1.8;
          } 
          else if (sProgress > 0.08 && sProgress <= 0.25) {
            // Powered Lift-off
            const p = (sProgress - 0.08) / 0.17;
            rotation = -(p * 90); // 0 to -90
            verticalY = (window.innerHeight * 0.92) - (Math.pow(p, 1.8) * window.innerHeight * 0.4);
            scale = 1.8 - (p * 0.3);
          }
          else if (sProgress > 0.25 && sProgress <= 0.9) {
            // Parabolic Flight (Gravity Turn)
            const p = (sProgress - 0.25) / 0.65;
            rotation = -90 + (p * 95); // -90 back to horizontal (+)
            
            // Climb high then curve away
            const curveAlt = window.innerHeight * 1.5;
            verticalY = (window.innerHeight * 0.52) - (Math.sin(p * Math.PI * 0.6) * curveAlt);
            horizontalX = param.xStart + (Math.pow(p, 1.8) * window.innerWidth * 0.9);
            
            // ZOOM OUT: Shrink from current size to near zero
            scale = 1.5 * (1 - Math.pow(p, 0.8));
            opacity = 1 - (p > 0.8 ? (p - 0.8) * 5 : 0);
          }
          else if (sProgress > 0.9) {
            // Gone into space
            scale = 0;
            opacity = 0;
          }

          // Jet FX logic
          const isThrusting = sProgress > 0.05 && sProgress < 0.88;
          const finalOpacity = sProgress >= 0.99 ? 0 : opacity;

          return (
            <div 
              key={idx} 
              style={{ 
                position: 'absolute',
                left: `calc(50% + ${horizontalX}px)`,
                top: `${verticalY}px`,
                transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
                opacity: finalOpacity,
                zIndex: 3000,
                transition: 'opacity 0.2s ease-out'
              }}
              className="w-48 h-48 flex items-center justify-center"
            >
              <ShipIcon 
                config={ship.config} 
                {...ship.colors} 
                showJets={isThrusting} 
                className="w-full h-full drop-shadow-[0_0_60px_rgba(239,68,68,0.9)]" 
              />
            </div>
          );
        })}
      </div>

      {/* CINEMATIC HUD OVERLAY */}
      <div className="absolute top-12 left-12 p-10 border-l-4 border-emerald-500 bg-black/60 backdrop-blur-3xl border-b border-emerald-500/10 rounded-br-2xl">
        <div className="retro-font text-[18px] text-emerald-400 animate-pulse uppercase tracking-[0.6em] mb-4 shadow-emerald-500/20 shadow-lg">
          { (Date.now() - startTime) / duration > 0.85 ? 'STABLE ORBIT' : 'ASCENT PHASE' }
        </div>
        <div className="flex flex-col gap-2">
          <div className="retro-font text-[9px] text-zinc-400 uppercase tracking-widest">
            Altitude: {Math.floor(Math.pow((Date.now() - startTime) / duration, 2) * 450)} km
          </div>
          <div className="retro-font text-[9px] text-zinc-500 uppercase tracking-widest">
            Status: { (Date.now() - startTime) / duration > 0.88 ? 'ENGINES COLD - DRIFT' : 'ENGINES HOT - BURN' }
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-12 right-12 text-right pointer-events-none">
         {/* FIX: Use type guard to safely access quadrant on Planet | Moon union type */}
         <div className="retro-font text-[10px] text-zinc-600 uppercase tracking-widest mb-2 border-r-2 border-emerald-500/20 pr-4">Targeting Sector: {'quadrant' in planet ? planet.quadrant : 'LOCAL'}</div>
         <div className="retro-font text-[24px] text-white uppercase tracking-[1.2em] drop-shadow-[0_0_30px_rgba(255,255,255,0.6)]">TRANSIT {planet.name}</div>
      </div>

      {/* Screen Effects */}
      <div className="absolute inset-0 pointer-events-none opacity-25 bg-gradient-to-t from-orange-500/10 via-red-500/5 to-transparent mix-blend-screen" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.5)_100%)]" />
    </div>
  );
};

export default LaunchSequence;
