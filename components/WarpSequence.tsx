
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
  isCapsule?: boolean;
  isFriendly?: boolean;
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

  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
      setBattleMsg(BATTLE_MESSAGES[Math.floor(Math.random() * BATTLE_MESSAGES.length)]);
  }, []);

  const destParts = useMemo(() => {
      const parts = destination.split(' // ');
      return {
          name: parts[0] || "UNKNOWN",
          sector: parts[1] || null
      };
  }, [destination]);

  // Calculate dynamic timing based on sector distance
  const timingConfig = useMemo(() => {
      const sec = destParts.sector?.toUpperCase() || '';
      let warpFrames = 60; // Default 1s (Alfa/Home)

      if (sec.includes('DELTA')) warpFrames = 180; // 3s
      else if (sec.includes('GAMA')) warpFrames = 120;  // 2s
      else if (sec.includes('BETA')) warpFrames = 60;   // 1s
      
      const initDuration = 60;
      const accelDuration = 120;
      const decelDuration = 120;
      const coastDuration = 40;
      const finishDuration = 140;

      return {
          tAccel: initDuration,
          tWarp: initDuration + accelDuration,
          tDecel: initDuration + accelDuration + warpFrames,
          tCoast: initDuration + accelDuration + warpFrames + decelDuration,
          tFinish: initDuration + accelDuration + warpFrames + decelDuration + coastDuration,
          tEnd: initDuration + accelDuration + warpFrames + decelDuration + coastDuration + finishDuration
      };
  }, [destParts.sector]);

  // ANIMATION STATE
  const animRef = useRef({
      frame: 0,
      phase: 'init' as 'init' | 'accel' | 'warp' | 'decel' | 'coast' | 'finish',
      currentScale: 0.6, 
      warpFactor: 0, 
      stars: [] as {
          angle: number;
          dist: number; 
          size: number;
          color: string;
          speedVar: number; 
      }[],
      bubbleOpacity: 0.0,
      bubbleBlur: 0.0,
  });

  const statusSizeClass = useMemo(() => {
      switch(fontSize) {
          case 'small': return 'text-xs tracking-[0.2em]';
          case 'large': return 'text-xl tracking-[0.3em]';
          case 'extra-large': return 'text-2xl tracking-[0.3em]';
          default: return 'text-base tracking-[0.25em]';
      }
  }, [fontSize]);

  const arrivalTitleSize = useMemo(() => {
      switch(fontSize) {
          case 'small': return 'text-xl md:text-2xl';
          case 'large': return 'text-4xl md:text-6xl';
          case 'extra-large': return 'text-5xl md:text-7xl';
          default: return 'text-3xl md:text-5xl';
      }
  }, [fontSize]);

  const arrivalSubSize = useMemo(() => {
      switch(fontSize) {
          case 'small': return 'text-[10px] md:text-xs';
          case 'large': return 'text-sm md:text-lg';
          case 'extra-large': return 'text-base md:text-xl';
          default: return 'text-xs md:text-sm';
      }
  }, [fontSize]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'Escape') {
              audioService.stopWarpHum(false); // Stop immediately
              onCompleteRef.current();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // INIT STARS ONCE
  useEffect(() => {
      const COLORS = ['#ffffff', '#60a5fa', '#facc15', '#f97316']; 
      const w = window.innerWidth;
      const h = window.innerHeight;
      const screenRadius = Math.hypot(w, h) / 2 + 50; 
      const STAR_COUNT = 2000; 

      animRef.current.stars = Array.from({length: STAR_COUNT}).map(() => {
          const r = Math.random() * screenRadius;
          return {
              angle: Math.random() * Math.PI * 2,
              dist: r,
              color: COLORS[Math.floor(Math.random() * COLORS.length)],
              size: 0.5 + Math.random() * 2.0, 
              speedVar: 0.2 + Math.random() * 1.8 
          };
      });
  }, []);

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: false }); 
      if (!ctx) return;

      // FORCE AUDIO START ON MOUNT/UPDATE
      // This ensures if the component re-renders (and cleans up), audio restarts immediately.
      audioService.playWarpHum();

      let rAF: number;
      const { tAccel, tWarp, tDecel, tCoast, tFinish, tEnd } = timingConfig;

      const loop = () => {
          const w = canvas.width = window.innerWidth;
          const h = canvas.height = window.innerHeight;
          const cx = w / 2;
          const cy = h / 2;
          const maxRadius = Math.hypot(w/2, h/2) + 50;

          const s = animRef.current;
          s.frame++;

          // 2. State Machine
          if (s.phase === 'init') {
              setStatusText("ALIGNING VECTOR");
              s.currentScale = 0.6; 
              s.warpFactor = 0.0005; 
              
              if (s.frame > tAccel) {
                  s.phase = 'accel';
              }
          }
          else if (s.phase === 'accel') {
              setStatusText("WARP DRIVE ENGAGED");
              const duration = tWarp - tAccel;
              const progress = (s.frame - tAccel) / duration;
              const ease = progress * progress * progress; 
              
              s.warpFactor = 0.0005 + (0.12 * ease); 
              s.currentScale = 0.6 - (0.5 * ease); 
              
              s.bubbleOpacity = Math.min(0.8, progress * 1.5);
              s.bubbleBlur = Math.min(4, progress * 4);

              if (s.frame > tWarp) s.phase = 'warp';
          }
          else if (s.phase === 'warp') {
              setStatusText("TRANSIT IN PROGRESS");
              s.warpFactor = 0.12; 
              s.currentScale = 0.1;
              if (s.frame > tDecel) s.phase = 'decel'; 
          }
          else if (s.phase === 'decel') {
              setStatusText("EXITING HYPERSPACE");
              const duration = tCoast - tDecel;
              const progress = (s.frame - tDecel) / duration;
              const easeOut = 1 - Math.pow(1 - progress, 3);
              
              s.warpFactor = 0.12 * (1 - easeOut); 
              if (s.warpFactor < 0.0005) s.warpFactor = 0.0005; 

              s.currentScale = 0.1 + (0.4 * easeOut);

              s.bubbleOpacity = Math.max(0, 0.8 - progress);
              s.bubbleBlur = Math.max(0, 4 - (progress * 4));

              if (s.frame > tCoast) {
                  s.phase = 'coast';
                  // Trigger gradual spindown with steam hiss
                  audioService.stopWarpHum(true);
                  audioService.playSfx('buy');
              }
          }
          else if (s.phase === 'coast') {
              setStatusText(null);
              s.warpFactor = 0; 
              s.currentScale = 0.5;
              if (s.frame > tFinish) {
                  setTextVisible(true);
                  s.phase = 'finish';
              }
          }
          else if (s.phase === 'finish') {
              s.warpFactor = 0;
              if (s.frame > tEnd) {
                  onCompleteRef.current();
              }
          }

          // 3. Draw
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, w, h);
          ctx.translate(cx, cy);

          // 4. Update & Render Stars
          s.stars.forEach(star => {
              const move = (star.dist + 50) * s.warpFactor * star.speedVar;
              star.dist += move;

              if (star.dist > maxRadius) {
                  star.dist = Math.random() * 60; 
                  star.angle = Math.random() * Math.PI * 2; 
                  star.speedVar = 0.2 + Math.random() * 1.8;
              }

              const x = Math.cos(star.angle) * star.dist;
              const y = Math.sin(star.angle) * star.dist;

              if (x > -w && x < w && y > -h && y < h) {
                  const alpha = Math.min(1, Math.max(0, (star.dist - 40) / 80));
                  
                  if (alpha > 0.01) {
                      ctx.globalAlpha = alpha;
                      ctx.fillStyle = star.color;

                      const isWarping = s.warpFactor > 0.01;

                      if (isWarping) {
                          const maxStreak = 120;
                          const tailLen = Math.min(maxStreak, move * 1.2); 
                          
                          const tailX = Math.cos(star.angle) * (star.dist - tailLen);
                          const tailY = Math.sin(star.angle) * (star.dist - tailLen);
                          
                          ctx.lineWidth = star.size;
                          ctx.strokeStyle = star.color;
                          ctx.lineCap = 'round';
                          ctx.beginPath();
                          ctx.moveTo(x, y);
                          ctx.lineTo(tailX, tailY);
                          ctx.stroke();
                      } else {
                          ctx.beginPath();
                          ctx.arc(x, y, star.size / 2, 0, Math.PI * 2);
                          ctx.fill();
                      }
                  }
              }
          });
          
          ctx.globalAlpha = 1;
          ctx.setTransform(1, 0, 0, 1, 0, 0);

          if (containerRef.current) containerRef.current.style.transform = `scale(${s.currentScale})`;
          if (bubbleRef.current) {
              bubbleRef.current.style.opacity = s.bubbleOpacity.toString();
              const blurVal = `blur(${s.bubbleBlur}px)`;
              bubbleRef.current.style.backdropFilter = blurVal;
              (bubbleRef.current.style as any).webkitBackdropFilter = blurVal;
          }

          rAF = requestAnimationFrame(loop);
      };

      rAF = requestAnimationFrame(loop);
      
      // CLEANUP: Force immediate stop if unmounted (prevents hiss from bleeding if skipped)
      return () => {
          cancelAnimationFrame(rAF);
          audioService.stopWarpHum(false);
      };
  }, [destParts, timingConfig]);

  return (
    <div className="fixed inset-0 z-[5000] bg-black overflow-hidden flex items-center justify-center select-none font-mono">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0" />
      <div 
        ref={containerRef}
        className="relative z-20 w-64 h-64 flex items-center justify-center will-change-transform origin-center"
        style={{ transform: 'scale(0.6)' }}
      >
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
         <div 
            ref={bubbleRef}
            className="absolute -inset-10 rounded-full z-30 pointer-events-none will-change-transform"
            style={{
                background: isCapsule 
                    ? 'radial-gradient(circle at 30% 30%, rgba(255,200,200,0.8) 0%, rgba(255,100,100,0.4) 40%, rgba(239,68,68,0.6) 85%, rgba(255,200,200,0.8) 100%)'
                    : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, rgba(200,240,255,0.4) 40%, rgba(34,211,238,0.6) 85%, rgba(255,255,255,0.8) 100%)',
                boxShadow: isCapsule 
                    ? '0 0 30px rgba(239,68,68,0.5), inset 0 0 20px rgba(255,200,200,0.5)' 
                    : '0 0 30px rgba(34,211,238,0.5), inset 0 0 20px rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.6)',
                opacity: 0, 
            }}
         />
      </div>
      {statusText && (
          <div className="absolute bottom-[20%] left-0 right-0 text-center z-40 animate-pulse">
              <h2 className={`retro-font ${statusSizeClass} ${isCapsule ? 'text-red-400' : 'text-cyan-400'} uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]`}>
                  {statusText}
              </h2>
              <p className="text-[10px] font-mono text-white/50 mt-2 tracking-wide">PRESS ESC TO SKIP</p>
          </div>
      )}
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
