
import React, { useEffect, useRef, useState } from 'react';
import { ShipPart, Shield } from '../types';

export const ShipIcon = ({ 
  config, 
  className = "", 
  hullColor, 
  wingColor, 
  cockpitColor, 
  gunColor, 
  gunBodyColor, 
  engineColor, 
  nozzleColor, 
  showJets = false, 
  activePart, 
  onPartSelect,
  shield,
  secondShield,
  fullShields = false
}: { 
  config: any, 
  className?: string, 
  hullColor?: string, 
  wingColor?: string, 
  cockpitColor?: string, 
  gunColor?: string, 
  gunBodyColor?: string, 
  engineColor?: string, 
  nozzleColor?: string, 
  showJets?: boolean, 
  activePart?: ShipPart, 
  onPartSelect?: (part: ShipPart) => void,
  shield?: Shield | null,
  secondShield?: Shield | null,
  fullShields?: boolean
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{width: number, height: number} | null>(null);
  
  // Measure container size
  useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
              const { width, height } = entry.contentRect;
              if (width > 0 && height > 0) {
                  setSize({ width, height });
              }
          }
      });

      observer.observe(container);
      return () => observer.disconnect();
  }, []);

  const render = (ctx: CanvasRenderingContext2D, w: number, h: number, mode: 'draw' | 'hit', mx?: number, my?: number): ShipPart | null => {
      const dpr = window.devicePixelRatio || 1;
      
      // Reset transform for fresh frame
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      if (mode === 'draw') {
          ctx.clearRect(0, 0, w * dpr, h * dpr);
      }

      ctx.save();
      // Apply coordinate system
      ctx.scale(dpr, dpr);
      ctx.translate(w / 2, h / 2);
      
      // Scale to fit
      const refSize = fullShields ? 165 : 120; 
      const scale = Math.min(w, h) / refSize; 
      
      ctx.scale(scale, scale);
      ctx.translate(-50, -50);

      // Hit detection state
      let lastHit: ShipPart | null = null;

      const { engines: engineCount, hullShapeType, wingStyle } = config;

      // Wrapper for drawing/hitting
      const drawPart = (part: string, drawFn: () => void) => {
          ctx.save();
          
          // Selection Highlight (Draw Mode Only)
          if (mode === 'draw' && activePart === part) {
              ctx.shadowColor = '#fff';
              ctx.shadowBlur = 15;
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 2;
          }

          drawFn(); // Defines path and fills it
          
          // Hit Detection
          if (mode === 'hit') {
             if (mx !== undefined && my !== undefined && ctx.isPointInPath(mx, my)) {
                 lastHit = part as ShipPart;
             }
          } 
          
          // Stroke Selection (Draw Mode Only)
          if (mode === 'draw' && activePart === part) {
              ctx.stroke();
          }
          ctx.restore();
      };

      const drawEngine = (ex: number, ey: number) => {
        drawPart('engines', () => {
            ctx.fillStyle = engineColor || '#334155';
            ctx.beginPath(); 
            if (ctx.roundRect) ctx.roundRect(ex - 9.6, ey - 8, 19.2, 20, 3);
            else ctx.rect(ex - 9.6, ey - 8, 19.2, 20);
            ctx.fill();
        });
        drawPart('nozzles', () => {
            ctx.fillStyle = nozzleColor || '#171717'; 
            ctx.beginPath(); 
            // Scaled 0.8x Nozzle (Same as GameEngine)
            ctx.moveTo(ex-8, ey+8); 
            ctx.lineTo(ex-9.6, ey+19.2); 
            ctx.quadraticCurveTo(ex, ey+24, ex+9.6, ey+19.2); 
            ctx.lineTo(ex+8, ey+8); 
            ctx.fill();
        });
        if (showJets && mode === 'draw') {
            ctx.fillStyle = '#f97316'; ctx.globalAlpha = 0.6; ctx.beginPath(); 
            ctx.moveTo(ex-8, ey+20); ctx.lineTo(ex+8, ey+20); ctx.lineTo(ex, ey+45); ctx.fill(); ctx.globalAlpha = 1.0;
        }
      };
      
      if (engineCount === 1) {
          drawEngine(50, 82);
      } else if (engineCount === 2) {
          [25, 75].forEach(ex => drawEngine(ex, 75));
      } else if (engineCount === 3) {
          [25, 50, 75].forEach(ex => drawEngine(ex, 75));
      } else if (engineCount >= 4) {
          [20, 40, 60, 80].forEach(ex => drawEngine(ex, 75));
      }

      drawPart('wings', () => {
          ctx.fillStyle = wingColor || '#64748b'; ctx.beginPath(); 
          if (wingStyle === 'delta') { ctx.moveTo(35, 40); ctx.lineTo(4, 88); ctx.lineTo(50, 78); ctx.moveTo(65, 40); ctx.lineTo(96, 88); ctx.lineTo(50, 78); } 
          else { ctx.ellipse(50, 60, 48, 18, 0, 0, Math.PI * 2); } 
          ctx.fill();
      });

      drawPart('hull', () => {
          ctx.fillStyle = hullColor || '#94a3b8'; 
          ctx.beginPath(); 
          if (hullShapeType === 'triangle') { ctx.moveTo(50, 10); ctx.lineTo(80, 85); ctx.lineTo(20, 85); } 
          else { if (ctx.roundRect) ctx.roundRect(30, 15, 40, 75, 12); else ctx.rect(30, 15, 40, 75); } 
          ctx.fill();
      });

      const renderGun = (gx: number, gy: number) => { 
          // Scale Logic: In GameEngine sc=gameEntityScale. Here it's 1. 
          // GameEngine applies `scale(sc * 1.32, sc * 1.32)`.
          // We apply similar relative scaling here for visual consistency.
          ctx.save(); ctx.translate(gx, gy); ctx.scale(1.1, 1.1); // +10% larger gun
          drawPart('gun_body', () => {
              ctx.fillStyle = gunBodyColor || '#1c1917';
              ctx.beginPath();
              // Original: ctx.moveTo(-7.2, 9.6); ctx.lineTo(-6, -7.2); ...
              // We just scale the context, drawing logic remains proportional
              ctx.moveTo(-7.2, 9.6); ctx.lineTo(-6, -7.2); ctx.lineTo(6, -7.2); ctx.lineTo(7.2, 9.6);
              ctx.fill();
              if (mode === 'draw') {
                  ctx.fillStyle = 'rgba(255,255,255,0.15)';
                  ctx.fillRect(-4.8, 0, 9.6, 2.4); ctx.fillRect(-4.8, 4.8, 9.6, 2.4);
              }
          });
          drawPart('guns', () => {
              ctx.fillStyle = gunColor || '#60a5fa';
              const w = 10, h = 3, yBase = -7.2; 
              ctx.beginPath(); // Must wrap in beginPath for hit detection consistency
              ctx.rect(-w/2, yBase - h, w, h);
              ctx.arc(0, yBase - h, w/2, Math.PI, 0); 
              ctx.fill();
              if (mode === 'draw') {
                  ctx.fillStyle = 'rgba(255,255,255,0.7)';
                  ctx.beginPath(); ctx.arc(-2, yBase - h - 2, 1.5, 0, Math.PI*2); ctx.fill();
              }
          });
          ctx.restore(); 
      };
      if (config.defaultGuns === 1) { renderGun(50, 15); } else { renderGun(25, 45); renderGun(75, 45); }
      
      drawPart('cockpit', () => {
          ctx.fillStyle = cockpitColor || '#38bdf8'; ctx.beginPath(); ctx.ellipse(50, (hullShapeType === 'triangle' ? 58 : 38), 9, 14, 0, 0, Math.PI * 2); ctx.fill();
      });

      if (mode === 'draw') {
          const drawShield = (s: Shield, radius: number) => {
              ctx.save();
              ctx.globalAlpha = 0.6; ctx.shadowBlur = 10; ctx.shadowColor = s.color; ctx.strokeStyle = s.color; ctx.lineWidth = 3.0;
              ctx.beginPath();
              if (s.visualType === 'forward') { ctx.arc(50, 50, radius, Math.PI * 1.2, Math.PI * 1.8); } 
              else { ctx.arc(50, 50, radius, 0, Math.PI * 2); }
              ctx.stroke();
              ctx.restore();
          };

          const r1 = fullShields ? 65 : 40;
          const r2 = fullShields ? 75 : 48;
          if (shield) drawShield(shield, r1);
          if (secondShield) drawShield(secondShield, r2);
      }

      ctx.restore();
      return lastHit;
  };

  // Draw Logic
  useEffect(() => {
    if (!size || !canvasRef.current || !config) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set explicit pixel size
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    
    render(ctx, size.width, size.height, 'draw');
  }, [size, config, hullColor, wingColor, cockpitColor, gunColor, gunBodyColor, engineColor, nozzleColor, showJets, activePart, shield, secondShield, fullShields]);

  const handleClick = (e: React.MouseEvent) => {
      if (!onPartSelect || !size || !canvasRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const x = (e.clientX - rect.left) * dpr;
      const y = (e.clientY - rect.top) * dpr;
      
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
          const hit = render(ctx, size.width, size.height, 'hit', x, y);
          if (hit) {
              e.stopPropagation();
              onPartSelect(hit);
          }
      }
  };

  return (
      <div ref={containerRef} className={className} onClick={handleClick}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
  );
};
