
import React, { useEffect, useRef, useState } from 'react';
import { ExtendedShipConfig } from '../constants.ts';
import { ShipIcon } from './ShipIcon.tsx';
import { EquippedWeapon } from '../types.ts';

interface WarpSequenceProps {
  shipConfig: ExtendedShipConfig;
  shipColors: any;
  shieldColor: string;
  onComplete: () => void;
  weaponId?: string;
  equippedWeapons?: (EquippedWeapon | null)[];
}

const WarpSequence: React.FC<WarpSequenceProps> = ({ shipConfig, shipColors, shieldColor, onComplete, weaponId, equippedWeapons }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shipScale, setShipScale] = useState(1);
  const [shipOpacity, setShipOpacity] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime = Date.now();
    
    // TIMELINE:
    // 0s - 2s: Shield Formation (Transparent -> Opaque)
    // 2s - 5s: Acceleration (Shrink to dot, Vortex formation)
    // 5s - 7s: Warp Tunnel (Spinning stars)
    // 7s - 9s: Arrival (Bubble expands/fades, ship reappears)
    
    const TOTAL_DURATION = 9000;

    const stars = Array.from({ length: 400 }).map(() => ({
        x: (Math.random() - 0.5) * window.innerWidth * 2,
        y: (Math.random() - 0.5) * window.innerHeight * 2,
        z: Math.random() * 2000,
        angle: Math.random() * Math.PI * 2,
        radius: 100 + Math.random() * 800, // For spiral
        color: Math.random() > 0.8 ? shieldColor : '#ffffff',
        size: 0.5 + Math.random() * 1.5
    }));

    const loop = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;

        if (elapsed > TOTAL_DURATION) {
            onComplete();
            return;
        }

        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        // --- ANIMATION PHASES ---
        
        // 1. SHIELD FORMATION (0-2s)
        let bubbleAlpha = 0;
        let bubbleScale = 1;
        let starMode = 'static'; // static, streak, spiral
        let warpSpeed = 0;
        
        if (elapsed < 2000) {
            bubbleAlpha = elapsed / 2000; // 0 to 1
            setShipScale(1);
            setShipOpacity(1); // Ship visible inside initially?
            // "Become opaque" implies hiding the ship eventually.
            // Let's keep ship opacity 1, but draw bubble on top.
        } 
        // 2. ACCELERATION / SHRINK (2s-5s)
        else if (elapsed < 5000) {
            const p = (elapsed - 2000) / 3000;
            bubbleAlpha = 1;
            bubbleScale = 1 - (p * 0.95); // Shrink to 5%
            setShipScale(bubbleScale);
            starMode = 'streak';
            warpSpeed = p * 50;
        }
        // 3. VORTEX (5s-7s)
        else if (elapsed < 7000) {
            bubbleAlpha = 1;
            bubbleScale = 0.05;
            setShipScale(0.05);
            starMode = 'spiral';
        }
        // 4. ARRIVAL (7s-9s)
        else {
            const p = (elapsed - 7000) / 2000;
            bubbleAlpha = 1 - p; // Fade out
            // "Melt become very transparent and convert to shields"
            // "Spaceship is small among the stars" -> Keep scale small?
            // The prompt says "The landing planet grow... spaceship is small".
            // So we keep the ship relatively small but maybe zoom in slightly from dot.
            bubbleScale = 0.05 + (p * 0.25); // Grow back to 30% size (small)
            setShipScale(bubbleScale);
            starMode = 'static';
            // Fade ship back in if it was hidden by opaque bubble
            setShipOpacity(1); 
        }

        // DRAW STARS
        ctx.save();
        ctx.translate(cx, cy);
        
        stars.forEach(s => {
            let sx = 0, sy = 0, sz = s.size;
            
            if (starMode === 'static') {
                // Simple 3D projection or static
                const scale = 1000 / (s.z || 1);
                sx = s.x; sy = s.y; // Simplified for static phase
                // Drift
                s.z -= 0.5;
                if (s.z <= 0) s.z = 2000;
                sx = (s.x / s.z) * 500;
                sy = (s.y / s.z) * 500;
            } else if (starMode === 'streak') {
                s.z -= (10 + warpSpeed * 2);
                if (s.z <= 0) s.z = 2000;
                const scale = 1000 / s.z;
                sx = s.x * scale * 0.001; // Use original x/y but scaled
                sy = s.y * scale * 0.001; 
                // Creating lines
                ctx.strokeStyle = `rgba(255,255,255, ${Math.min(1, warpSpeed/20)})`;
                ctx.lineWidth = sz * scale * 0.002;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx * 1.1, sy * 1.1);
                ctx.stroke();
                return; // Skip circle draw
            } else if (starMode === 'spiral') {
                // Vortex logic
                // Angle increases over time
                s.angle += 0.05;
                s.radius -= 2;
                if (s.radius < 10) s.radius = 800;
                
                sx = Math.cos(s.angle) * s.radius;
                sy = Math.sin(s.angle) * s.radius;
                
                // Vortex trail
                ctx.strokeStyle = s.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                const tailX = Math.cos(s.angle - 0.2) * (s.radius + 10);
                const tailY = Math.sin(s.angle - 0.2) * (s.radius + 10);
                ctx.lineTo(tailX, tailY);
                ctx.stroke();
                return;
            }

            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(0.5, (1000/s.z)), 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();

        // DRAW BUBBLE
        if (bubbleAlpha > 0) {
            const baseRadius = Math.max(0, 150 * bubbleScale);
            ctx.save();
            ctx.translate(cx, cy);
            
            // "Opaque ... do not glow" -> Matte finish
            // We use the shield color.
            ctx.fillStyle = shieldColor;
            ctx.globalAlpha = bubbleAlpha;
            
            // Draw sphere
            ctx.beginPath();
            ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Add a slight rim light or "matte" shading
            const grad = ctx.createRadialGradient(-baseRadius*0.3, -baseRadius*0.3, baseRadius*0.1, 0, 0, baseRadius);
            grad.addColorStop(0, 'rgba(255,255,255,0.3)');
            grad.addColorStop(1, 'rgba(0,0,0,0.1)');
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.restore();
        }

        animId = requestAnimationFrame(loop);
    };

    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
    animId = requestAnimationFrame(loop);

    return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize);
    };
  }, [shieldColor, onComplete]);

  return (
    <div className="fixed inset-0 z-[5000] bg-black flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      
      {/* Ship Icon - visible initially, scales with bubble */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 pointer-events-none transition-opacity duration-300"
        style={{ 
            transform: `translate(-50%, -50%) scale(${shipScale})`, 
            opacity: shipOpacity,
            zIndex: 10 
        }}
      >
         <ShipIcon 
            config={shipConfig} 
            hullColor={shipColors.hull}
            wingColor={shipColors.wings}
            cockpitColor={shipColors.cockpit}
            gunColor={shipColors.guns}
            gunBodyColor={shipColors.gun_body}
            engineColor={shipColors.engines}
            nozzleColor={shipColors.nozzles}
            showJets={true}
            className="w-full h-full"
            weaponId={weaponId}
            equippedWeapons={equippedWeapons}
         />
         
         {/* DOM Bubble Overlay */}
         <div 
            className="absolute inset-[-20%] rounded-full transition-all duration-100"
            style={{ 
                backgroundColor: shieldColor, 
                opacity: shipOpacity < 1 ? 1 : 0, 
            }}
         />
      </div>
      
      {/* Upper Canvas for Bubble - z-index 20 */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-20 pointer-events-none" />
      
      {/* Background Canvas for Stars */}
      <StarFieldCanvas shieldColor={shieldColor} phase={shipScale < 0.1 ? 'warp' : 'static'} /> 

      <div className="absolute bottom-20 left-0 right-0 text-center z-30">
          <h2 className="retro-font text-xl text-zinc-500 uppercase tracking-[0.5em] animate-pulse">
              {shipScale < 0.1 ? "WARP TRAJECTORY" : "SHIELD HARMONICS"}
          </h2>
      </div>
    </div>
  );
};

// Helper for Background Stars (Behind Ship)
const StarFieldCanvas = ({ shieldColor, phase }: { shieldColor: string, phase: string }) => {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const ctx = ref.current?.getContext('2d');
        if(!ctx) return;
        let id: number;
        const stars = Array.from({length:200}).map(() => ({
            x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight, z: Math.random()*1000
        }));
        
        const loop = () => {
            if (ref.current) {
                ctx.fillStyle = '#000';
                ctx.fillRect(0,0,ref.current.width, ref.current.height);
                const cx = ref.current.width/2;
                const cy = ref.current.height/2;
                
                ctx.fillStyle = '#fff';
                stars.forEach(s => {
                    s.z -= (phase === 'warp' ? 20 : 0.5);
                    if(s.z <= 0) { s.z = 1000; s.x = Math.random()*ref.current!.width; s.y = Math.random()*ref.current!.height; }
                    const k = 1000/s.z;
                    const x = (s.x - cx) * k + cx;
                    const y = (s.y - cy) * k + cy;
                    const sz = Math.max(0.5, k * 2);
                    
                    if (phase === 'warp') {
                        ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, k/2)})`;
                        ctx.beginPath(); ctx.moveTo(x,y); 
                        const x2 = (s.x - cx) * (k*1.1) + cx;
                        const y2 = (s.y - cy) * (k*1.1) + cy;
                        ctx.lineTo(x2, y2); ctx.stroke();
                    } else {
                        ctx.beginPath(); ctx.arc(x,y,sz,0,Math.PI*2); ctx.fill();
                    }
                });
            }
            id = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(id);
    }, [phase]);
    
    return <canvas ref={ref} className="absolute inset-0 w-full h-full z-0" width={window.innerWidth} height={window.innerHeight} />
};

export default WarpSequence;
