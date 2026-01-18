
import React, { useEffect, useRef } from 'react';

export const StoryScene = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Comet State
  const cometRef = useRef({
    x: -100,
    y: 100,
    vx: 0,
    vy: 0,
    active: false,
    trail: [] as {x: number, y: number, life: number, size: number}[]
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    // Enhanced Stars
    const starColors = ['#ffffff', '#ffffff', '#ffffff', '#facc15', '#fb923c', '#ef4444', '#60a5fa'];
    
    const stars = Array.from({ length: 450 }).map(() => {
        const isWanderer = Math.random() < 0.1;
        return {
            x: Math.random(),
            y: Math.random(),
            // Wanderers are significantly larger (2.0 - 4.0), others are smaller (0.2 - 1.0)
            size: isWanderer ? (Math.random() * 2.0 + 2.0) : (Math.random() * 0.8 + 0.2),
            baseAlpha: Math.random() * 0.6 + 0.2,
            color: starColors[Math.floor(Math.random() * starColors.length)],
            // Shimmer properties
            twinkleSpeed: Math.random() * 0.08 + 0.02,
            twinklePhase: Math.random() * Math.PI * 2,
            // Wanderer properties
            vx: isWanderer ? (Math.random() - 0.5) * 0.0002 : 0, 
            vy: isWanderer ? (Math.random() - 0.5) * 0.0002 : 0
        };
    });

    let time = 0;
    let animId: number;

    const resetComet = (w: number, h: number) => {
        const c = cometRef.current;
        c.x = -100;
        c.y = h * 0.3 + (Math.random() * h * 0.1); 
        c.vx = 1.5 + Math.random() * 1.0; 
        c.vy = -0.5 + Math.random() * 0.2; 
        c.active = true;
        c.trail = [];
    };

    const loop = () => {
      const w = canvas.width;
      const h = canvas.height;
      
      time += 1;

      // Clear
      ctx.fillStyle = '#050505'; 
      ctx.fillRect(0, 0, w, h);

      // --- STARS ---
      stars.forEach(s => {
        // Movement (Wanderers)
        if (s.vx !== 0 || s.vy !== 0) {
            s.x += s.vx;
            s.y += s.vy;
            // Wrap around screen
            if (s.x < 0) s.x += 1;
            if (s.x > 1) s.x -= 1;
            if (s.y < 0) s.y += 1;
            if (s.y > 1) s.y -= 1;
        }

        ctx.fillStyle = s.color;
        
        // Shimmer Calculation
        const val = Math.sin((time * s.twinkleSpeed) + s.twinklePhase);
        // Map sine (-1 to 1) to opacity multiplier (0.5 to 1.2)
        const shimmer = 0.85 + (val * 0.35); 
        
        ctx.globalAlpha = Math.min(1, Math.max(0, s.baseAlpha * shimmer)); 
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // --- PARABOLIC COMET ---
      const c = cometRef.current;
      
      if (!c.active || c.x > w + 200 || c.y > h + 200) {
          if (Math.random() < 0.005) resetComet(w, h);
      }

      if (c.active) {
          c.x += c.vx;
          c.y += c.vy;
          c.vy += 0.002; 

          if (time % 2 === 0) { 
              for (let i = 0; i < 2; i++) {
                  c.trail.push({
                      x: c.x,
                      y: c.y,
                      life: 1.0,
                      size: 2 + Math.random() * 2
                  });
              }
          }

          for (let i = c.trail.length - 1; i >= 0; i--) {
              const p = c.trail[i];
              p.life -= 0.005; 
              
              p.x -= c.vx * 0.05;
              p.y -= c.vy * 0.05;
              
              if (p.life <= 0) {
                  c.trail.splice(i, 1);
              } else {
                  ctx.beginPath();
                  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                  const colorMix = Math.floor(p.life * 255);
                  ctx.fillStyle = `rgba(${255 - colorMix}, ${255}, ${255}, ${p.life * 0.4})`;
                  ctx.fill();
              }
          }

          ctx.shadowBlur = 15;
          ctx.shadowColor = '#a5f3fc';
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize);
    };
  }, []);

  return (
      <div className="w-full h-full absolute inset-0 bg-black overflow-hidden pointer-events-none z-0">
          <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
  );
};
