import React, { useEffect, useRef, useState } from 'react';
import { Planet, Moon } from '../types';

interface LandingSceneProps {
  planet: Planet | Moon;
  shipShape: string;
  onComplete: () => void;
}

const LandingScene: React.FC<LandingSceneProps> = ({ planet, shipShape, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("ENTRY SEQUENCE INITIATED");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let startTime = Date.now();
    const duration = 6000; // 6 seconds for the scene

    const buildings = Array.from({ length: 25 }).map((_, i) => ({
      x: Math.random() * canvas.width,
      w: 40 + Math.random() * 80,
      h: 60 + Math.random() * 250,
      depth: 0.5 + Math.random() * 0.5, // Parallax depth
      color: `rgba(20, 20, 25, ${0.4 + Math.random() * 0.4})`
    }));

    const particles: any[] = [];

    const drawShip = (y: number, scale: number) => {
      ctx.save();
      ctx.translate(canvas.width / 2, y);
      ctx.scale(scale, scale);
      
      // Engine Flare
      const flareSize = 20 + Math.random() * 20;
      const gradient = ctx.createRadialGradient(0, 20, 0, 0, 20, flareSize);
      gradient.addColorStop(0, '#60a5fa');
      gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.5)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 20, flareSize, 0, Math.PI * 2);
      ctx.fill();

      // Ship body
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      if (shipShape === 'arrow' || shipShape === 'stealth') {
        ctx.moveTo(0, -25); ctx.lineTo(-15, 15); ctx.lineTo(15, 15);
      } else if (shipShape === 'block') {
        ctx.rect(-15, -15, 30, 30);
      } else {
        ctx.moveTo(0, -20); ctx.lineTo(-20, 10); ctx.lineTo(0, 5); ctx.lineTo(20, 10);
      }
      ctx.fill();
      
      ctx.restore();
    };

    const loop = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Background color transitions based on planet color
      const pColor = (planet as Planet).color || '#3b82f6';
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Horizon Glow
      const glowHeight = canvas.height * (0.3 + progress * 0.4);
      const bgGradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - glowHeight);
      bgGradient.addColorStop(0, pColor + '33');
      bgGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, canvas.height - glowHeight, canvas.width, glowHeight);

      // Draw Parallax Buildings
      buildings.forEach(b => {
        const parallaxY = progress * 100 * b.depth;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, canvas.height - b.h + parallaxY, b.w, b.h);
        // Windows
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        for(let r=0; r<b.h/30; r++) {
          for(let c=0; c<b.w/20; c++) {
            if (Math.random() > 0.5) {
              ctx.fillRect(b.x + 5 + c*15, canvas.height - b.h + 10 + r*25 + parallaxY, 4, 4);
            }
          }
        }
      });

      // Landing Platform
      const platformY = canvas.height - 40;
      ctx.fillStyle = '#18181b';
      ctx.fillRect(canvas.width / 2 - 100, platformY, 200, 20);
      ctx.strokeStyle = '#10b981';
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(canvas.width / 2 - 100, platformY, 200, 20);
      ctx.setLineDash([]);

      // Ship Descent
      const startY = -100;
      const endY = platformY - 15;
      const shipY = startY + (endY - startY) * progress;
      const shipScale = 1.5 - progress * 0.5;
      
      drawShip(shipY, shipScale);

      // Status updates
      if (progress < 0.3) setStatus("ATMOSPHERIC RE-ENTRY");
      else if (progress < 0.6) setStatus("THRUSTERS COMPENSATING");
      else if (progress < 0.9) setStatus("DOCKING ALIGNMENT");
      else setStatus("TOUCHDOWN COMPLETE");

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(loop);
      } else {
        setTimeout(onComplete, 1000);
      }
    };

    // Responsive Canvas
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    animationFrameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [onComplete, planet, shipShape]);

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
         <div className="retro-font text-emerald-400 text-xs md:text-xl tracking-[0.5em] mb-4 animate-pulse uppercase">
            {status}
         </div>
         <div className="w-64 h-1 bg-zinc-900 rounded-full overflow-hidden border border-emerald-500/20">
            <div 
               className="h-full bg-emerald-500 transition-all duration-300" 
               style={{ width: `${status === "TOUCHDOWN COMPLETE" ? 100 : (status === "DOCKING ALIGNMENT" ? 75 : (status === "THRUSTERS COMPENSATING" ? 50 : 25))}%` }} 
            />
         </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 retro-font text-[10px] text-zinc-500 uppercase tracking-widest">
         Descending into {planet.name}
      </div>
      
      {/* Scanlines effect */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
    </div>
  );
};

export default LandingScene;