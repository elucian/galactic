
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ExtendedShipConfig } from '../constants.ts';
import { ShipIcon } from './ShipIcon.tsx';
import { EquippedWeapon } from '../types.ts';
import { audioService } from '../services/audioService.ts';

interface WarpSequenceProps {
  shipConfig: ExtendedShipConfig;
  shipColors: any;
  shieldColor: string;
  onComplete: () => void;
  weaponId?: string;
  equippedWeapons?: (EquippedWeapon | null)[];
  destination?: string;
}

const WarpSequence: React.FC<WarpSequenceProps> = ({ 
    shipConfig, 
    shipColors, 
    onComplete, 
    weaponId, 
    equippedWeapons,
    destination = "UNKNOWN SECTOR"
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [textVisible, setTextVisible] = useState(false);

  // Animation State Logic - using ref to avoid re-renders during loop
  const animRef = useRef({
      frame: 0,
      phase: 'drift' as 'drift' | 'power_on' | 'shrink' | 'warp' | 'expand' | 'cooldown' | 'finish',
      
      // Visual Props
      containerScale: 1.0, 
      
      // Bubble Props
      bubbleOpacity: 0.0,
      bubbleBlur: 0.0,
      
      // Rotation Props
      rotationAngle: 0.0,
      rotationSpeed: 0.0005, // Initial drift speed
  });

  // Generate stars once - large field to cover rotation corners
  const stars = useMemo(() => {
      const diag = Math.hypot(window.innerWidth, window.innerHeight) * 1.5;
      const starColors = ['#ffffff', '#e0f2fe', '#bae6fd', '#fcd34d', '#fbbf24'];
      return Array.from({ length: 800 }).map(() => ({
          x: (Math.random() - 0.5) * diag,
          y: (Math.random() - 0.5) * diag,
          size: Math.random() * 2.0 + 0.5,
          color: starColors[Math.floor(Math.random() * starColors.length)],
          alpha: 0.3 + Math.random() * 0.7
      }));
  }, []);

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      audioService.startCharging();

      let rAF: number;

      const loop = () => {
          // Fullscreen canvas
          const w = canvas.width = window.innerWidth;
          const h = canvas.height = window.innerHeight;
          const cx = w / 2;
          const cy = h / 2;
          
          const s = animRef.current;
          s.frame++;

          // --- STATE MACHINE (10s = ~600 frames) ---
          
          // 1. DRIFT (0s - 1.5s)
          if (s.phase === 'drift') {
              s.rotationSpeed = 0.0005; // Gentle drift
              if (s.frame > 90) s.phase = 'power_on';
          }
          
          // 2. POWER ON (1.5s - 3.5s)
          else if (s.phase === 'power_on') {
              // Bubble ON
              s.bubbleOpacity = Math.min(0.85, s.bubbleOpacity + 0.015);
              s.bubbleBlur = Math.min(8, s.bubbleBlur + 0.15);
              
              // Slight rotation ramp up
              s.rotationSpeed += 0.0001; 

              if (s.frame > 210) {
                  s.phase = 'shrink';
                  audioService.playLaunchSequence();
              }
          }
          
          // 3. SHRINK (3.5s - 5.5s)
          else if (s.phase === 'shrink') {
              // Ship Shrink
              s.containerScale *= 0.94;
              // Min scale 0.04 * 256px = ~10px visible size
              if (s.containerScale < 0.04) s.containerScale = 0.04;

              // Rotation Accelerate Exponentially
              s.rotationSpeed *= 1.05;
              
              if (s.frame > 330) {
                  s.phase = 'warp';
              }
          }
          
          // 4. WARP (5.5s - 7.5s)
          else if (s.phase === 'warp') {
              s.containerScale = 0.04;
              
              // Max Rotation Speed Cap increased for dizziness effect
              s.rotationSpeed = Math.min(0.8, s.rotationSpeed * 1.02);
              
              if (s.frame > 450) {
                  s.phase = 'expand';
                  audioService.stopCharging();
                  audioService.playSfx('buy');
              }
          }
          
          // 5. EXPAND (7.5s - 9.0s)
          else if (s.phase === 'expand') {
              // Ship Expand
              s.containerScale += (1.0 - s.containerScale) * 0.1;
              
              // Rotation Decelerate
              s.rotationSpeed *= 0.9;
              
              if (s.containerScale > 0.98) {
                  s.containerScale = 1.0;
                  s.phase = 'cooldown';
              }
          }
          
          // 6. COOLDOWN (9.0s - 10s)
          else if (s.phase === 'cooldown') {
              s.bubbleOpacity = Math.max(0, s.bubbleOpacity - 0.05);
              s.bubbleBlur = Math.max(0, s.bubbleBlur - 0.5);
              s.rotationSpeed = Math.max(0.0005, s.rotationSpeed * 0.9); // Back to drift
              
              if (s.bubbleOpacity <= 0) {
                  s.phase = 'finish';
                  setTextVisible(true);
              }
          }
          
          // 7. FINISH
          else if (s.phase === 'finish') {
              if (s.frame > 660) {
                  onComplete();
              }
          }

          // --- UPDATE PHYSICS ---
          s.rotationAngle += s.rotationSpeed;

          // --- DRAW ---
          // Clear background
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, w, h);

          // Draw Stars with Global Rotation
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(s.rotationAngle);
          
          // Optimization: Stars are pre-calculated relative to (0,0)
          stars.forEach(st => {
              ctx.fillStyle = st.color;
              ctx.globalAlpha = st.alpha;
              ctx.beginPath();
              // Stretch stars slightly at high speeds for a radial blur effect
              if (s.rotationSpeed > 0.1) {
                  const dist = Math.hypot(st.x, st.y);
                  const angle = Math.atan2(st.y, st.x);
                  // Arc length approximation for streak
                  const streakLen = Math.min(30, dist * s.rotationSpeed * 0.5);
                  ctx.ellipse(st.x, st.y, streakLen, st.size, angle + Math.PI/2, 0, Math.PI*2);
              } else {
                  ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2);
              }
              ctx.fill();
          });
          
          ctx.restore();

          // --- DOM UPDATES ---
          if (containerRef.current) {
              containerRef.current.style.transform = `scale(${s.containerScale})`;
          }
          if (bubbleRef.current) {
              bubbleRef.current.style.opacity = s.bubbleOpacity.toString();
              const blurVal = `blur(${s.bubbleBlur}px)`;
              bubbleRef.current.style.backdropFilter = blurVal;
              (bubbleRef.current.style as any).webkitBackdropFilter = blurVal;
          }

          rAF = requestAnimationFrame(loop);
      };

      rAF = requestAnimationFrame(loop);
      return () => {
          cancelAnimationFrame(rAF);
          audioService.stopCharging();
          audioService.stopLaunchSequence();
      };
  }, [onComplete, stars]);

  return (
    <div className="fixed inset-0 z-[5000] bg-black overflow-hidden flex items-center justify-center select-none font-mono">
      
      {/* 1. Canvas (Rotates internally, DOM stays fixed) */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0" />
      
      {/* 2. Main Container (Ship + Bubble) - SCALES */}
      <div 
        ref={containerRef}
        className="relative z-20 w-64 h-64 flex items-center justify-center will-change-transform origin-center"
      >
         {/* THE SHIP (Layer 1) */}
         <div className="absolute inset-0 z-10 flex items-center justify-center">
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
                className="w-full h-full drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                weaponId={weaponId}
                equippedWeapons={equippedWeapons}
             />
         </div>

         {/* THE BUBBLE (Layer 2) */}
         <div 
            ref={bubbleRef}
            className="absolute -inset-10 rounded-full z-30 pointer-events-none will-change-transform"
            style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, rgba(200,240,255,0.4) 40%, rgba(34,211,238,0.6) 85%, rgba(255,255,255,0.8) 100%)',
                boxShadow: '0 0 30px rgba(34,211,238,0.5), inset 0 0 20px rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.6)',
                opacity: 0, 
            }}
         />
      </div>

      {/* 3. Arrival Text - Positioned comfortably below the ship area */}
      {textVisible && (
          <div className="absolute top-[65%] left-0 right-0 text-center z-40 animate-in slide-in-from-bottom-8 fade-in duration-1000">
              <h1 className="retro-font text-3xl md:text-5xl text-cyan-400 uppercase tracking-widest drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]">
                  {destination.includes('HOME') ? "DOCKING SEQ" : "ARRIVAL"}
              </h1>
              <div className="mt-4 inline-block px-6 py-2 bg-black/60 border border-cyan-500/30 rounded backdrop-blur-sm">
                  <p className="text-white font-mono text-sm md:text-lg uppercase tracking-[0.3em]">
                      {destination}
                  </p>
                  <p className="text-cyan-500 text-[10px] mt-2 animate-pulse">ENGAGING COMBAT SYSTEMS...</p>
              </div>
          </div>
      )}

    </div>
  );
};

export default WarpSequence;
