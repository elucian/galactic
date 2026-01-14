
import React, { useEffect, useRef } from 'react';

export const StoryScene = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State for orbital anomalies (angles)
  const sunOrbitRef = useRef({ angle: Math.PI });
  const cometOrbitRef = useRef({ angle: Math.PI * 0.8 }); 
  const cometPrecessionRef = useRef({ angle: -Math.PI / 4 }); // Start with initial tilt
  
  // Physics based tail history
  // Each node: x, y, velocity x, velocity y, life (0-1)
  const tailRef = useRef<Array<{x: number, y: number, vx: number, vy: number, life: number}>>([]);

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

    // Static Stars
    const stars = Array.from({ length: 250 }).map(() => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.5 + 0.3,
      twinkleSpeed: Math.random() * 0.05 + 0.01
    }));

    // Local Planets orbiting the Sun - SIZES REDUCED
    const planets = [
      { r: 25, speed: 0.1, size: 1.0, angle: Math.random() * 6.28, color: '#94a3b8' },
      { r: 40, speed: 0.07, size: 1.5, angle: Math.random() * 6.28, color: '#38bdf8' }, 
      { r: 60, speed: 0.04, size: 1.2, angle: Math.random() * 6.28, color: '#f87171' },
      { r: 85, speed: 0.02, size: 2.0, angle: Math.random() * 6.28, color: '#fbbf24' },
    ];

    let time = 0;
    let animId: number;

    // GLOBAL SPEED CONTROL: 89% Slower means ~11% speed
    const SPEED_FACTOR = 0.11; 

    const loop = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      
      time += 1 * SPEED_FACTOR;

      // Clear with deep space black
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      // --- STARS ---
      stars.forEach(s => {
        ctx.fillStyle = '#ffffff';
        const twinkle = Math.abs(Math.sin(time * s.twinkleSpeed));
        ctx.globalAlpha = s.alpha * (0.5 + twinkle * 0.5); 
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // --- BLACK HOLE (Focal Point) ---
      const holeRadius = 25;
      
      // Accretion Disk / Hawking Radiation Glow
      const glowGrad = ctx.createRadialGradient(cx, cy, holeRadius, cx, cy, holeRadius * 12);
      glowGrad.addColorStop(0, '#000000');
      glowGrad.addColorStop(0.1, 'rgba(139, 92, 246, 0.8)'); // Violet core
      glowGrad.addColorStop(0.25, 'rgba(59, 130, 246, 0.3)'); // Blue spread
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.fillStyle = glowGrad;
      ctx.beginPath(); ctx.arc(cx, cy, holeRadius * 12, 0, Math.PI * 2); ctx.fill();

      // Event Horizon
      ctx.fillStyle = '#000000';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#8b5cf6';
      ctx.beginPath(); ctx.arc(cx, cy, holeRadius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      
      // Photon Ring
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, holeRadius + 2, 0, Math.PI*2); ctx.stroke();


      // --- SUN ORBIT (Fat Ellipse, Black Hole at Focus) ---
      const sunA = Math.min(w, h) * 0.4; // Semi-major axis
      const sunE = 0.3; // Low eccentricity (fat)
      
      // Keplerian Motion Approximation: d(angle) ~ 1/r^2
      const sunTheta = sunOrbitRef.current.angle;
      const sunR = (sunA * (1 - sunE*sunE)) / (1 + sunE * Math.cos(sunTheta));
      
      // Update angle (slower when far, faster when close)
      // Scaled by SPEED_FACTOR
      const sunSpeedBase = 1200 * SPEED_FACTOR; 
      sunOrbitRef.current.angle += sunSpeedBase / (sunR * sunR); 

      // Polar to Cartesian relative to Focus (0,0)
      const sunLocalX = sunR * Math.cos(sunTheta);
      const sunLocalY = sunR * Math.sin(sunTheta);

      // Fixed Sun Orbit Tilt
      const sunTilt = 0.2; 
      const sunX = cx + (sunLocalX * Math.cos(sunTilt) - sunLocalY * Math.sin(sunTilt));
      const sunY = cy + (sunLocalX * Math.sin(sunTilt) + sunLocalY * Math.cos(sunTilt));

      // Draw Sun - MUCH SMALLER
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#fbbf24'; // Amber
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 6, 0, Math.PI * 2); // Radius reduced from 14 to 6
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw Sun's Planets - SMALLER
      planets.forEach(p => {
        p.angle += p.speed * SPEED_FACTOR;
        const px = sunX + Math.cos(p.angle) * p.r;
        const py = sunY + Math.sin(p.angle) * p.r;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI*2); ctx.fill();
      });


      // --- COMET ORBIT (Elongated Ellipse, Black Hole at Focus) ---
      // Apsidal Precession: The orbit itself rotates around the focus
      cometPrecessionRef.current.angle += 0.003 * SPEED_FACTOR;

      const cometA = Math.min(w, h) * 0.8; // Large orbit
      const cometE = 0.85; // High eccentricity (elongated)
      
      const cometTheta = cometOrbitRef.current.angle;
      const cometR = (cometA * (1 - cometE*cometE)) / (1 + cometE * Math.cos(cometTheta));
      
      // Keplerian speed
      const cometSpeedBase = 5000 * SPEED_FACTOR; 
      cometOrbitRef.current.angle += cometSpeedBase / (cometR * cometR);

      // Local ellipse coordinates
      const cLocalX = cometR * Math.cos(cometTheta);
      const cLocalY = cometR * Math.sin(cometTheta);

      // Apply Precession Rotation (Orbit rotating around BH)
      const precAngle = cometPrecessionRef.current.angle;
      const cRotX = cLocalX * Math.cos(precAngle) - cLocalY * Math.sin(precAngle);
      const cRotY = cLocalX * Math.sin(precAngle) + cLocalY * Math.cos(precAngle);

      // Translate to screen center
      const cometX = cx + cRotX;
      const cometY = cy + cRotY;

      // --- DYNAMIC TAIL SIMULATION ---
      // Add current position to tail
      tailRef.current.unshift({ x: cometX, y: cometY, vx: 0, vy: 0, life: 1.0 });
      if (tailRef.current.length > 80) tailRef.current.pop();

      // Physics Parameters
      const windForce = 0.5 * SPEED_FACTOR; // Solar wind strength
      const gravityForce = 2.0 * SPEED_FACTOR; // Black hole gravity strength
      
      if (tailRef.current.length > 1) {
          for (let i = 1; i < tailRef.current.length; i++) {
              const p = tailRef.current[i];
              
              // 1. Solar Wind: Repulsion from Sun
              const dxSun = p.x - sunX;
              const dySun = p.y - sunY;
              const distSun = Math.sqrt(dxSun * dxSun + dySun * dySun);
              const dirSunX = dxSun / distSun;
              const dirSunY = dySun / distSun;
              
              // 2. BH Gravity: Attraction to Black Hole
              const dxBH = cx - p.x;
              const dyBH = cy - p.y;
              const distBH = Math.sqrt(dxBH * dxBH + dyBH * dyBH);
              const dirBHX = dxBH / distBH;
              const dirBHY = dyBH / distBH; 

              // Gravity gets stronger when closer to BH, Wind constant-ish
              const gStr = gravityForce * (500 / (distBH + 100)); 
              
              p.vx += (dirSunX * windForce) + (dirBHX * gStr);
              p.vy += (dirSunY * windForce) + (dirBHY * gStr);
              
              p.x += p.vx;
              p.y += p.vy;
              p.life -= 0.005 * SPEED_FACTOR;

              // --- DRAW GAS PARTICLE (Fuzzy Tail) ---
              // Overlapping low-opacity circles create a gaseous effect
              if (p.life > 0) {
                  const age = 1 - p.life;
                  const size = 2 + (age * 12); // Expands as it dissipates
                  const opacity = p.life * 0.12; // Low opacity for soft overlap
                  
                  ctx.beginPath();
                  ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                  ctx.fillStyle = `rgba(165, 243, 252, ${opacity})`;
                  ctx.fill();
              }
          }
      }

      // Comet Head
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#a5f3fc';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(cometX, cometY, 3, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize);
    };
  }, []);

  return (
      <div className="w-full h-full absolute inset-0 bg-black overflow-hidden pointer-events-none">
          <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
  );
};
