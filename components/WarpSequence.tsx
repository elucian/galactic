
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
  isCapsule?: boolean; // New prop for escape pod mode
  isFriendly?: boolean; // New prop for arrival message context
  fontSize?: 'small' | 'medium' | 'large' | 'extra-large';
}

const BATTLE_MESSAGES = [
    "PREPARE FOR BATTLE",
    "GOOD HUNTING",
    "STAY ALIVE",
    "BE BRAVE",
    "WEAPONS FREE",
    "NO MERCY",
    "ENGAGE AT WILL",
    "INTO THE ABYSS",
    "SYSTEMS HOT",
    "TARGETS LOCKED",
    "DEFEND THE SECTOR",
    "VICTORY OR DEATH"
];

// Helper to get colors based on sector string
const getWandererColors = (sector: string | null) => {
    const s = (sector || '').toUpperCase();
    if (s.includes('BETA')) return ['#ef4444', '#f97316', '#fca5a5']; // Red/Orange
    if (s.includes('GAMA')) return ['#3b82f6', '#22d3ee', '#8b5cf6']; // Blue/Cyan/Purple
    if (s.includes('DELTA')) return ['#a855f7', '#db2777', '#4c1d95']; // Purple/Pink
    return ['#ffffff', '#fef08a', '#e0f2fe']; // Default/Alpha (White/Yellow/LightBlue)
};

const WarpSequence: React.FC<WarpSequenceProps> = ({ 
    shipConfig, 
    shipColors, 
    onComplete, 
    weaponId, 
    equippedWeapons,
    destination = "UNKNOWN SECTOR",
    isCapsule = false,
    isFriendly = false,
    fontSize = 'medium'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [textVisible, setTextVisible] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [battleMsg, setBattleMsg] = useState("");

  // Select random message on mount
  useEffect(() => {
      setBattleMsg(BATTLE_MESSAGES[Math.floor(Math.random() * BATTLE_MESSAGES.length)]);
  }, []);

  // Parse Destination String (Format: "NAME // SECTOR")
  const destParts = useMemo(() => {
      const parts = destination.split(' // ');
      return {
          name: parts[0] || "UNKNOWN",
          sector: parts[1] || null
      };
  }, [destination]);

  // Animation State Logic - using ref to avoid re-renders during loop
  const animRef = useRef({
      frame: 0,
      phase: 'drift' as 'drift' | 'power_on' | 'shrink' | 'warp' | 'expand' | 'cooldown' | 'finish',
      lastPhase: 'drift', // Track phase changes for text updates
      
      // Visual Props
      containerScale: 1.0, 
      
      // Bubble Props
      bubbleOpacity: 0.0,
      bubbleBlur: 0.0,
      
      // Rotation Props
      rotationAngle: 0.0,
      rotationSpeed: 0.0005, // Initial drift speed

      // Wanderers State (Mutable)
      wanderers: Array.from({length: 3}).map(() => ({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          size: Math.random() * 1.5 + 1.0,
          color: '#ffffff', // Initial color (will be updated or start generic)
      })),
      wandererOpacity: 1.0,
      hasRecolored: false,
  });

  // Calculate font size class based on prop
  const statusSizeClass = useMemo(() => {
      switch(fontSize) {
          case 'small': return 'text-xs tracking-[0.2em]';
          case 'large': return 'text-xl tracking-[0.3em]';
          case 'extra-large': return 'text-2xl tracking-[0.3em]';
          default: return 'text-base tracking-[0.25em]'; // medium
      }
  }, [fontSize]);

  const arrivalTitleSize = useMemo(() => {
      switch(fontSize) {
          case 'small': return 'text-xl md:text-2xl';
          case 'large': return 'text-4xl md:text-6xl';
          case 'extra-large': return 'text-5xl md:text-7xl';
          default: return 'text-3xl md:text-5xl'; // medium
      }
  }, [fontSize]);

  const arrivalSubSize = useMemo(() => {
      switch(fontSize) {
          case 'small': return 'text-[10px] md:text-xs';
          case 'large': return 'text-sm md:text-lg';
          case 'extra-large': return 'text-base md:text-xl';
          default: return 'text-xs md:text-sm'; // medium
      }
  }, [fontSize]);

  // 1. ROTATING STARFIELD (Background)
  // Crisp, small, shimmering
  const stars = useMemo(() => {
      const diag = Math.hypot(window.innerWidth, window.innerHeight) * 1.5;
      const starColors = ['#ffffff', '#e0f2fe', '#bae6fd', '#fcd34d', '#fbbf24'];
      return Array.from({ length: 800 }).map(() => ({
          x: (Math.random() - 0.5) * diag,
          y: (Math.random() - 0.5) * diag,
          size: Math.random() * 1.2 + 0.3, // Smaller crisp stars
          color: starColors[Math.floor(Math.random() * starColors.length)],
          baseAlpha: Math.random() * 0.7 + 0.3,
          twinkleOffset: Math.random() * 100,
          twinkleSpeed: 0.05 + Math.random() * 0.05
      }));
  }, []);

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

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
          
          // Check for phase transitions to update status text
          if (s.phase !== s.lastPhase) {
              if (s.phase === 'power_on') setStatusText("HYPERDRIVE ACTIVE");
              if (s.phase === 'shrink') setStatusText("WARP TRAVEL"); // Stars spin here
              if (s.phase === 'expand') setStatusText(null); // Disappear
              s.lastPhase = s.phase;
          }

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
              
              // Fade out wanderers
              s.wandererOpacity = Math.max(0, s.wandererOpacity - 0.05);

              if (s.frame > 330) {
                  s.phase = 'warp';
              }
          }
          
          // 4. WARP (5.5s - 7.5s)
          else if (s.phase === 'warp') {
              s.containerScale = 0.04;
              s.wandererOpacity = 0; // Ensure hidden
              
              // Max Rotation Speed Cap increased for dizziness effect
              s.rotationSpeed = Math.min(0.8, s.rotationSpeed * 1.02);
              
              if (s.frame > 450) {
                  s.phase = 'expand';
                  // (Stop Charging audio removed here)
                  audioService.playSfx('buy');
              }
          }
          
          // 5. EXPAND (7.5s - 9.0s)
          else if (s.phase === 'expand') {
              // Ship Expand
              s.containerScale += (1.0 - s.containerScale) * 0.1;
              
              // Rotation Decelerate
              s.rotationSpeed *= 0.9;
              
              // Recolor & Respawn Wanderers if not done
              if (!s.hasRecolored) {
                  const newColors = getWandererColors(destParts.sector);
                  s.wanderers.forEach(wnd => {
                      // Reset position randomly to ensure they appear fresh
                      wnd.x = Math.random() * w;
                      wnd.y = Math.random() * h;
                      // Pick new color
                      wnd.color = newColors[Math.floor(Math.random() * newColors.length)];
                  });
                  s.hasRecolored = true;
              }

              // Fade In Wanderers
              s.wandererOpacity = Math.min(1.0, s.wandererOpacity + 0.05);
              
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

          // 1. Draw Rotating Starfield
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(s.rotationAngle);
          
          stars.forEach(st => {
              // Shimmer Logic
              const shimmer = Math.sin((s.frame * st.twinkleSpeed) + st.twinkleOffset);
              const alpha = Math.max(0.1, st.baseAlpha * (0.8 + shimmer * 0.2)); // Fluctuate alpha slightly

              ctx.fillStyle = st.color;
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              
              if (s.rotationSpeed > 0.1) {
                  const dist = Math.hypot(st.x, st.y);
                  const angle = Math.atan2(st.y, st.x);
                  const streakLen = Math.min(30, dist * s.rotationSpeed * 0.5);
                  ctx.ellipse(st.x, st.y, streakLen, st.size, angle + Math.PI/2, 0, Math.PI*2);
              } else {
                  // Crisp circle
                  ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2);
              }
              ctx.fill();
          });
          ctx.restore();

          // 2. Draw Independent Wanderers (Static Frame of Reference)
          // These move linearly across the screen, creating depth/parallax against the rotation
          if (s.wandererOpacity > 0) {
              ctx.save();
              ctx.globalAlpha = s.wandererOpacity * 0.9;
              s.wanderers.forEach(wnd => {
                  // Update position
                  wnd.x += wnd.vx;
                  wnd.y += wnd.vy;
                  
                  // Wrap
                  if (wnd.x < 0) wnd.x = w;
                  if (wnd.x > w) wnd.x = 0;
                  if (wnd.y < 0) wnd.y = h;
                  if (wnd.y > h) wnd.y = 0;

                  // Draw
                  ctx.fillStyle = wnd.color;
                  ctx.shadowColor = wnd.color;
                  ctx.shadowBlur = 4; // Slight glow for wanderers
                  ctx.beginPath();
                  ctx.arc(wnd.x, wnd.y, wnd.size, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.shadowBlur = 0;
              });
              ctx.restore();
          }

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
          // (Stop Charging audio removed in cleanup)
          audioService.stopLaunchSequence();
      };
  }, [onComplete, stars, destParts]); // Updated dependencies

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
                jetType="ion"
                className="w-full h-full drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                weaponId={weaponId}
                equippedWeapons={equippedWeapons}
                isCapsule={isCapsule}
             />
         </div>

         {/* THE BUBBLE (Layer 2) */}
         <div 
            ref={bubbleRef}
            className="absolute -inset-10 rounded-full z-30 pointer-events-none will-change-transform"
            style={{
                background: isCapsule 
                    ? 'radial-gradient(circle at 30% 30%, rgba(255,200,200,0.8) 0%, rgba(255,100,100,0.4) 40%, rgba(239,68,68,0.6) 85%, rgba(255,200,200,0.8) 100%)' // Reddish bubble for capsule
                    : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, rgba(200,240,255,0.4) 40%, rgba(34,211,238,0.6) 85%, rgba(255,255,255,0.8) 100%)',
                boxShadow: isCapsule 
                    ? '0 0 30px rgba(239,68,68,0.5), inset 0 0 20px rgba(255,200,200,0.5)' 
                    : '0 0 30px rgba(34,211,238,0.5), inset 0 0 20px rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.6)',
                opacity: 0, 
            }}
         />
      </div>

      {/* 3. Status Text (Hyperdrive / Warp) */}
      {statusText && (
          <div className="absolute bottom-[20%] left-0 right-0 text-center z-40 animate-pulse">
              <h2 className={`retro-font ${statusSizeClass} ${isCapsule ? 'text-red-400' : 'text-cyan-400'} uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]`}>
                  {statusText}
              </h2>
          </div>
      )}

      {/* 4. Arrival Text - Positioned comfortably below the ship area */}
      {textVisible && (
          <div className="absolute top-[65%] left-0 right-0 text-center z-40 animate-in slide-in-from-bottom-8 fade-in duration-1000">
              <h1 className={`retro-font ${arrivalTitleSize} uppercase tracking-widest drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] ${isCapsule ? 'text-red-500' : 'text-cyan-400'}`}>
                  {isCapsule ? "RESCUE SIGNAL" : destParts.name}
              </h1>
              <div className="mt-4 inline-block px-6 py-2 bg-black/60 border border-zinc-700 rounded backdrop-blur-sm">
                  <p className={`${isCapsule ? 'text-red-400' : 'text-cyan-500'} ${arrivalSubSize} font-mono uppercase tracking-[0.3em] animate-pulse`}>
                      {isCapsule 
                        ? "MEDICAL TEAMS ALERTED..." 
                        : (isFriendly ? (destParts.sector ? `WELCOME TO ${destParts.sector} SECTOR` : "DOCKING SEQUENCE") : battleMsg)
                      }
                  </p>
              </div>
          </div>
      )}

    </div>
  );
};

export default WarpSequence;
