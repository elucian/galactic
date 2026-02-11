
import React, { useRef, useEffect } from 'react';
import { ExtendedShipConfig, WEAPONS, EXOTIC_WEAPONS, SHIELDS, EXOTIC_SHIELDS } from '../constants.ts';
import { EquippedWeapon, ShipFitting, ShipPart, Shield, WeaponType } from '../types.ts';
import { getEngineCoordinates, getWingMounts } from '../utils/drawingUtils.ts';
import { resolveColor } from '../utils/patternUtils.ts';

// Local helper to match mixColor
const mixColorLocal = (c1: string, c2: string, weight: number) => {
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
    };
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    const w = Math.min(1, Math.max(0, weight));
    const r = Math.round(rgb1.r * (1 - w) + rgb2.r * w);
    const g = Math.round(rgb1.g * (1 - w) + rgb2.g * w);
    const b = Math.round(rgb1.b * (1 - w) + rgb2.b * w);
    return `rgb(${r},${g},${b})`;
};

// Modified: Removed 'nozzles' and 'bars' to prevent selection via click
const PART_IDS: Partial<Record<ShipPart, number>> = {
    'hull': 1, 'wings': 2, 'cockpit': 3, 'cockpit_highlight': 4,
    'guns': 5, 'secondary_guns': 6, 'gun_body': 7, 'engines': 8,
    // 'nozzles': 9, 'bars': 10 // Removed
};

const ID_TO_PART = Object.entries(PART_IDS).reduce((acc, [k, v]) => ({...acc, [v as number]: k}), {}) as Record<number, ShipPart>;

interface ShipIconProps {
  config: ExtendedShipConfig;
  className?: string;
  hullColor?: string;
  wingColor?: string;
  cockpitColor?: string;
  cockpitHighlightColor?: string;
  gunColor?: string;
  secondaryGunColor?: string;
  gunBodyColor?: string;
  engineColor?: string;
  nozzleColor?: string;
  barColor?: string;
  showJets?: boolean;
  jetType?: 'combustion' | 'ion';
  showGear?: boolean;
  equippedWeapons?: (EquippedWeapon | null)[];
  weaponId?: string; 
  activePart?: ShipPart;
  onPartSelect?: (part: ShipPart) => void;
  shield?: Shield | null;
  secondShield?: Shield | null;
  fullShields?: boolean;
  weaponFireTimes?: { [key: number]: number }; 
  weaponHeat?: { [key: number]: number }; 
  forceShieldScale?: boolean;
  isCapsule?: boolean;
}

export const ShipIcon: React.FC<ShipIconProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Core Drawing Function (Shared for Render and Hit Detection)
  const renderGeometry = (ctx: CanvasRenderingContext2D, isHitMode: boolean) => {
      const { config, hullColor, wingColor, cockpitColor, gunColor, secondaryGunColor, gunBodyColor, engineColor, nozzleColor, activePart, weaponFireTimes, weaponHeat } = props;
      
      const shouldScaleDown = !!props.shield || !!props.secondShield || props.forceShieldScale;
      const scale = shouldScaleDown ? 1.7 : 3;
      const translate = shouldScaleDown ? 65 : 0; 

      ctx.save();
      ctx.translate(translate, translate);
      ctx.scale(scale, scale);

      // --- CAPSULE MODE ---
      if (props.isCapsule) {
          ctx.save();
          ctx.translate(50, 50);
          
          ctx.fillStyle = isHitMode ? `rgb(${PART_IDS['hull']},0,0)` : resolveColor(ctx, hullColor || '#e2e8f0'); 
          ctx.beginPath(); ctx.ellipse(0, 5, 18, 24, 0, 0, Math.PI * 2); ctx.fill();
          if (!isHitMode) { ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5; ctx.stroke(); }
          
          ctx.fillStyle = isHitMode ? `rgb(${PART_IDS['cockpit']},0,0)` : resolveColor(ctx, cockpitColor || '#0ea5e9');
          ctx.beginPath(); ctx.ellipse(0, -2, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
          
          if (!isHitMode) {
              ctx.fillStyle = 'rgba(255,255,255,0.7)';
              ctx.beginPath(); ctx.ellipse(-4, -6, 3, 5, -0.3, 0, Math.PI * 2); ctx.fill();
          }
          
          ctx.fillStyle = isHitMode ? `rgb(${PART_IDS['engines']},0,0)` : resolveColor(ctx, engineColor || '#334155'); 
          ctx.fillRect(-6, 26, 12, 6);
          ctx.restore();
          ctx.restore(); // End Capsule
          return;
      }

      const { wingStyle, hullShapeType } = config;
      const engineLocs = getEngineCoordinates(config);

      // Helper to draw parts
      const drawPart = (part: ShipPart, colorStr: string | undefined, drawFn: () => void) => {
          ctx.save();
          if (isHitMode) {
              const pid = PART_IDS[part];
              if (pid) {
                  ctx.fillStyle = `rgb(${pid},0,0)`;
                  ctx.strokeStyle = `rgb(${pid},0,0)`;
                  drawFn();
              }
              // If ID not found, don't draw in hit mode (non-selectable)
          } else {
              ctx.fillStyle = resolveColor(ctx, colorStr);
              if (colorStr?.startsWith('pat|')) {
                   const parts = colorStr.split('|');
                   ctx.strokeStyle = parts[3] || '#fff'; 
                   ctx.lineWidth = 1.5; 
              } else {
                   ctx.strokeStyle = ctx.fillStyle;
              }

              if (activePart === part) {
                  ctx.shadowColor = '#fff';
                  ctx.shadowBlur = 15;
                  ctx.strokeStyle = '#fff';
                  ctx.lineWidth = 1.5;
              }
              drawFn();
              
              if (colorStr?.startsWith('pat|') || activePart === part) {
                  ctx.stroke();
              }
          }
          ctx.restore();
      };

      // 1. Wings
      drawPart('wings', wingColor || config.defaultColor, () => {
          ctx.beginPath();
          if (config.isAlien) {
              ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
              if (wingStyle === 'alien-h') { ctx.moveTo(25, 20); ctx.lineTo(25, 75); ctx.moveTo(75, 20); ctx.lineTo(75, 75); ctx.moveTo(25, 48); ctx.lineTo(75, 48); ctx.stroke(); } 
              else if (wingStyle === 'alien-w') { ctx.moveTo(10, 20); ctx.lineTo(35, 75); ctx.lineTo(50, 45); ctx.lineTo(65, 75); ctx.lineTo(90, 20); ctx.stroke(); } 
              else if (wingStyle === 'alien-a') { ctx.moveTo(20, 75); ctx.bezierCurveTo(20, 10, 80, 10, 80, 75); ctx.moveTo(28, 55); ctx.lineTo(72, 55); ctx.stroke(); } 
              else if (wingStyle === 'alien-m') { ctx.moveTo(20, 75); ctx.lineTo(20, 25); ctx.lineTo(50, 55); ctx.lineTo(80, 25); ctx.lineTo(80, 75); ctx.stroke(); }
          } else {
              if (wingStyle === 'delta') { ctx.moveTo(50, 25); ctx.lineTo(10, 80); ctx.lineTo(50, 70); ctx.lineTo(90, 80); ctx.fill(); } 
              else if (wingStyle === 'x-wing') { ctx.beginPath(); ctx.moveTo(50, 48); ctx.quadraticCurveTo(20, 48, 5, 10); ctx.lineTo(25, 10); ctx.quadraticCurveTo(30, 40, 50, 38); ctx.fill(); ctx.beginPath(); ctx.moveTo(50, 48); ctx.quadraticCurveTo(80, 48, 95, 10); ctx.lineTo(75, 10); ctx.quadraticCurveTo(70, 40, 50, 38); ctx.fill(); ctx.beginPath(); ctx.moveTo(50, 48); ctx.lineTo(5, 90); ctx.lineTo(25, 90); ctx.lineTo(50, 55); ctx.fill(); ctx.beginPath(); ctx.moveTo(50, 48); ctx.lineTo(95, 90); ctx.lineTo(75, 90); ctx.lineTo(50, 55); ctx.fill(); } 
              else if (wingStyle === 'pincer') { ctx.ellipse(50, 60, 45, 25, 0, 0, Math.PI * 2); ctx.moveTo(85, 60); ctx.ellipse(50, 60, 30, 15, 0, 0, Math.PI * 2, true); ctx.fill(); } 
              else if (wingStyle === 'curved') { ctx.moveTo(50, 45); ctx.lineTo(10, 50); ctx.arc(10, 56, 6, -Math.PI/2, Math.PI/2, true); ctx.lineTo(50, 65); ctx.moveTo(50, 45); ctx.lineTo(90, 50); ctx.arc(90, 56, 6, -Math.PI/2, Math.PI/2, false); ctx.lineTo(50, 65); ctx.fill(); } 
              else if (wingStyle === 'cylon') { ctx.moveTo(45, 80); ctx.bezierCurveTo(10, 80, 5, 60, 5, 10); ctx.arcTo(15, 10, 20, 40, 6); ctx.quadraticCurveTo(25, 40, 45, 50); ctx.lineTo(45, 80); ctx.moveTo(55, 80); ctx.bezierCurveTo(90, 80, 95, 60, 95, 10); ctx.arcTo(85, 10, 80, 40, 6); ctx.quadraticCurveTo(75, 40, 55, 50); ctx.lineTo(55, 80); ctx.fill(); } 
              else { ctx.moveTo(50, 30); ctx.lineTo(10, 70); ctx.lineTo(50, 60); ctx.lineTo(90, 70); ctx.fill(); }
          }
      });

      // 2. Engines
      engineLocs.forEach(eng => { 
          const drawX = eng.x - (eng.w+2)/2;
          drawPart('engines', config.isAlien ? '#172554' : (engineColor || '#334155'), () => {
              ctx.beginPath();
              if (config.isAlien) ctx.ellipse(eng.x, eng.y + (eng.h+2)/2, (eng.w+2)/2, (eng.h+2)/2, 0, 0, Math.PI * 2);
              else ctx.rect(drawX, eng.y, eng.w+2, eng.h+2);
              ctx.fill();
          });
          // ALLOW CUSTOM NOZZLE COLOR
          const nColor = nozzleColor || (config.isAlien ? '#9ca3af' : '#94a3b8');
          drawPart('nozzles', nColor, () => {
              const nH = config.isAlien ? 6 : 5; const flare = config.isAlien ? 4 : 3; const inset = config.isAlien ? 1 : 0;
              ctx.beginPath();
              if (config.isAlien) { const ns = eng.y + eng.h; ctx.moveTo(drawX + inset, ns); ctx.lineTo(drawX + eng.w+2 - inset, ns); ctx.lineTo(drawX + eng.w+2 + flare, ns + nH); ctx.lineTo(drawX - flare, ns + nH); } 
              else { ctx.moveTo(drawX + inset, eng.y + eng.h+2); ctx.lineTo(drawX + eng.w+2 - inset, eng.y + eng.h+2); ctx.lineTo(drawX + eng.w+2 + flare, eng.y + eng.h+2 + nH); ctx.lineTo(drawX - flare, eng.y + eng.h+2 + nH); }
              ctx.fill();
          });
      });

      // 3. Hull
      drawPart('hull', hullColor || config.defaultColor, () => {
          ctx.beginPath();
          if (wingStyle === 'x-wing') { 
              ctx.ellipse(50, 50, 18, 45, 0, 0, Math.PI * 2); 
              ctx.fill(); 
              if(!isHitMode) { 
                  ctx.fillStyle = '#64748b'; 
                  ctx.fillRect(36, 40, 4, 20); 
                  ctx.fillRect(60, 40, 4, 20); 
              }
              // IMPORTANT: Clear path so the final fill doesn't overwrite with grey
              ctx.beginPath(); 
          }
          else if (hullShapeType === 'none') { }
          else if (hullShapeType === 'triangle') { ctx.moveTo(50, 5); ctx.quadraticCurveTo(80, 80, 50, 90); ctx.quadraticCurveTo(20, 80, 50, 5); }
          else if (hullShapeType === 'block') { ctx.moveTo(40, 10); ctx.lineTo(60, 10); ctx.quadraticCurveTo(70, 10, 75, 30); ctx.lineTo(60, 75); ctx.quadraticCurveTo(50, 80, 40, 75); ctx.lineTo(25, 30); ctx.quadraticCurveTo(30, 10, 40, 10); }
          else if (hullShapeType === 'rounded') { if (ctx.roundRect) ctx.roundRect(30, 10, 40, 80, 20); else { ctx.moveTo(50, 10); ctx.arc(50, 30, 20, Math.PI, 0); ctx.lineTo(70, 70); ctx.arc(50, 70, 20, 0, Math.PI); ctx.lineTo(30, 30); } }
          else if (hullShapeType === 'saucer') ctx.ellipse(50, 50, 30, 30, 0, 0, Math.PI * 2);
          else if (hullShapeType === 'finger') ctx.ellipse(50, 50, 20, 40, 0, 0, Math.PI * 2);
          else if (hullShapeType === 'needle') { ctx.moveTo(50, 0); ctx.quadraticCurveTo(70, 50, 50, 95); ctx.quadraticCurveTo(30, 50, 50, 0); }
          else ctx.ellipse(50, 50, 20, 45, 0, 0, Math.PI * 2);
          ctx.fill();
      });

      // 4. Cockpit
      drawPart('cockpit', cockpitColor || '#0ea5e9', () => {
          ctx.beginPath();
          if (config.isAlien) { const cy = wingStyle === 'alien-a' ? 65 : 45; ctx.ellipse(50, cy, 8, 20, 0, 0, Math.PI * 2); } 
          else if (wingStyle === 'x-wing') { ctx.ellipse(50, 55, 8, 12, 0, 0, Math.PI * 2); } 
          else { ctx.ellipse(50, 40, 8, 12, 0, 0, Math.PI * 2); }
          ctx.fill();
      });
      drawPart('cockpit_highlight', props.cockpitHighlightColor || 'rgba(255,255,255,0.5)', () => {
          ctx.beginPath(); 
          if (wingStyle === 'x-wing') { ctx.ellipse(48, 52, 3, 5, -0.2, 0, Math.PI * 2); } 
          else { const cy = (config.isAlien && wingStyle === 'alien-a') ? 65 : (config.isAlien ? 45 : 38); ctx.ellipse(48, cy - 2, 3, 5, -0.2, 0, Math.PI * 2); }
          ctx.fill();
      });

      // 5. Weapons
      const drawWeapon = (x: number, y: number, id: string | undefined, type: 'primary' | 'secondary', slotIndex: number) => {
          if (!id) return;
          ctx.save(); ctx.translate(x, y);
          
          let recoilY = 0;
          let isFiring = false;
          if (!isHitMode && weaponFireTimes && weaponFireTimes[slotIndex]) {
              const timeSinceFire = Date.now() - weaponFireTimes[slotIndex];
              if (timeSinceFire < 150) { recoilY = Math.sin((timeSinceFire / 150) * Math.PI) * 4; }
              if (timeSinceFire < 200) isFiring = true;
          }

          let heatColor = null;
          if (!isHitMode && weaponHeat && weaponHeat[slotIndex] > 0) {
              const heat = weaponHeat[slotIndex];
              if (heat > 80) heatColor = '#ef4444'; else if (heat > 60) heatColor = '#f97316'; else if (heat > 30) heatColor = '#b45309';
          }

          const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === id);
          const isExotic = id.includes('exotic');
          const isAlien = config.isAlien;
          const bodyCol = (gunBodyColor && gunBodyColor !== '#334155') ? gunBodyColor : '#451a03';
          const crystalCol = type === 'secondary' ? (secondaryGunColor || '#38bdf8') : (gunColor || config.noseGunColor || '#ef4444');
          const wScale = isAlien && isExotic ? 1.4 : (isExotic ? 1.0 : 1.45); 
          ctx.scale(wScale, wScale);

          if (def && def.type === WeaponType.PROJECTILE && !isExotic) {
              // --- 1. MOUNTING PLATE ---
              if (!isHitMode) { ctx.fillStyle = '#18181b'; ctx.fillRect(-3, -4, 6, 8); }

              // --- 2. GUN BODY ---
              drawPart('gun_body', bodyCol, () => { if (id.includes('vulcan')) ctx.fillRect(-3.5, 0, 7, 12); else ctx.fillRect(-3.5, 0, 7, 10); });

              // --- 3. BARRELS ---
              // Wrapped in drawPart to allow painting and selection highlight
              drawPart(type === 'secondary' ? 'secondary_guns' : 'guns', crystalCol, () => {
                  ctx.save();
                  ctx.translate(0, recoilY);
                  
                  if (isHitMode) {
                      // Hit detection only (color set by drawPart in hit mode already, but we need rect)
                      // Actually drawPart logic in hitMode sets color then calls fn.
                      // So we just draw shape.
                      ctx.fillRect(-3, -16, 6, 16);
                  } else {
                      // Visual Drawing
                      // Use resolveColor to get the pattern or color
                      // We prefer heatColor if active, otherwise the paint color (crystalCol)
                      
                      const baseFill = heatColor || resolveColor(ctx, crystalCol);
                      
                      const isRotary = ['gun_vulcan', 'gun_hyper', 'gun_shredder'].includes(id);
                      const isHeavySingle = ['gun_plasma', 'gun_rail_titan', 'gun_doomsday'].includes(id);
                      const isVentedFunnel = ['gun_heavy', 'gun_repeater'].includes(id);

                      if (isRotary) {
                          // Rotary has its own multi-color logic, we overlay/mix
                          // For simplicity, we use specific grays but maybe tint them if painted?
                          // Let's stick to standard look but respect selection border.
                          const baseColors = ['#3f3f46', '#71717a', '#d4d4d8'];
                          const barrelColors = (slotIndex === 2) ? [...baseColors].reverse() : baseColors;
                          const rotDir = (slotIndex === 2) ? -1 : 1;
                          const tick = Math.floor(Date.now() / 40);
                          const offset = isFiring ? ((tick * rotDir) % 3 + 3) % 3 : 0;

                          ctx.fillStyle = barrelColors[(0 + offset) % 3]; ctx.fillRect(-2.5, -16, 1.5, 16); 
                          ctx.fillStyle = barrelColors[(1 + offset) % 3]; ctx.fillRect(-0.75, -16, 1.5, 16); 
                          ctx.fillStyle = barrelColors[(2 + offset) % 3]; ctx.fillRect(1, -16, 1.5, 16);
                          ctx.fillStyle = '#3f3f46'; ctx.fillRect(-3, -18, 6, 2); 
                      } else if (isHeavySingle) {
                          ctx.fillStyle = (heatColor || '#374151'); // Darker base
                          const bW = 3; const bH = 10; ctx.fillRect(-bW/2, -bH, bW, bH);
                          const mW = 6; const mH = 11; const mY = -bH - mH + 2; 
                          ctx.fillStyle = (heatColor || '#4b5563'); 
                          ctx.fillRect(-mW/2, mY, mW, mH);
                          
                          if (id === 'gun_doomsday' && isFiring) { ctx.fillStyle = (Math.random() > 0.5 ? '#ef4444' : '#facc15'); } else { ctx.fillStyle = '#09090b'; }
                          
                          const holeSize = 1.2;
                          for(let i=0; i<3; i++) {
                              const hy = mY + 2 + (i * 3);
                              ctx.fillRect(-2 - (holeSize/2), hy, holeSize, holeSize); 
                              ctx.fillRect(0 - (holeSize/2), hy, holeSize, holeSize);
                              ctx.fillRect(2 - (holeSize/2), hy, holeSize, holeSize); 
                          }
                      } else if (isVentedFunnel) {
                          const bW = 4; const bH = 12; ctx.fillStyle = (heatColor || '#4b5563'); ctx.fillRect(-bW/2, -bH, bW, bH);
                          const fH = 6; const fTop = 7; ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.moveTo(-bW/2, -bH); ctx.lineTo(-fTop/2, -bH - fH); ctx.lineTo(fTop/2, -bH - fH); ctx.lineTo(bW/2, -bH); ctx.fill();
                          ctx.fillStyle = '#000'; for(let i=0; i<3; i++) { const vy = -bH + 3 + (i*3); ctx.beginPath(); ctx.arc(0, vy, 1.2, 0, Math.PI*2); ctx.fill(); }
                      } else {
                          // Default barrel gets painted color
                          ctx.fillStyle = baseFill;
                          ctx.fillRect(-1.5, -16, 3, 16); ctx.fillStyle = '#27272a'; ctx.fillRect(-2, -16, 4, 2);
                      }
                  }
                  ctx.restore(); // End Recoil
              });
          } else {
              // --- ENERGY WEAPONS ---
              const activeBodyCol = isAlien ? '#374151' : bodyCol;
              drawPart('gun_body', activeBodyCol, () => { ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(-4, -4, 8, 12, 3); else ctx.rect(-4, -4, 8, 12); ctx.fill(); });
              
              let activeCrystalCol = resolveColor(ctx, crystalCol);
              if (!isHitMode && isFiring) {
                  activeCrystalCol = mixColorLocal(activeCrystalCol as string, '#ffffff', 0.5);
              }

              drawPart(type === 'secondary' ? 'secondary_guns' : 'guns', activeCrystalCol as string, () => { 
                  if (id?.includes('plasma') || isExotic) { ctx.beginPath(); ctx.arc(0, -8, 3, 0, Math.PI*2); ctx.fill(); } 
                  else { ctx.fillRect(-2.5, -12, 5, 12); } 
              });
              
              if (!isHitMode) ctx.shadowBlur = 0;
          }
          ctx.restore();
      };

      const weapons = props.equippedWeapons || (props.weaponId ? [{id: props.weaponId, count:1}, null, null] : [null, null, null]);
      const mainId = weapons[0]?.id;
      if (mainId) {
          if (config.wingStyle === 'alien-h') { drawWeapon(25, 20, mainId, 'primary', 0); drawWeapon(75, 20, mainId, 'primary', 0); } 
          else if (config.wingStyle === 'alien-w') { drawWeapon(10, 20, mainId, 'primary', 0); drawWeapon(90, 20, mainId, 'primary', 0); } 
          else if (config.wingStyle === 'alien-m') { drawWeapon(20, 25, mainId, 'primary', 0); drawWeapon(80, 25, mainId, 'primary', 0); } 
          else if (config.wingStyle === 'alien-a') { drawWeapon(50, 22, mainId, 'primary', 0); } 
          else if (config.wingStyle === 'x-wing') { drawWeapon(50, 20, mainId, 'primary', 0); } 
          else { drawWeapon(50, 10, mainId, 'primary', 0); }
      }
      if (weapons[1]) { const mounts = getWingMounts(config); drawWeapon(mounts[0].x, mounts[0].y, weapons[1]?.id, 'secondary', 1); }
      if (weapons[2]) { const mounts = getWingMounts(config); drawWeapon(mounts[1].x, mounts[1].y, weapons[2]?.id, 'secondary', 2); }

      // Shields (Visual Only, Non-Hit)
      if (!isHitMode && props.fullShields && (props.shield || props.secondShield)) {
          const drawShieldRing = (sDef: Shield, r: number) => {
              if (!sDef) return; ctx.save(); ctx.beginPath(); ctx.arc(50, 50, r, 0, Math.PI * 2); ctx.strokeStyle = sDef.color || '#3b82f6'; ctx.lineWidth = 1.5; ctx.shadowColor = sDef.color || '#3b82f6'; ctx.shadowBlur = 8; ctx.globalAlpha = 0.8; ctx.stroke(); ctx.fillStyle = sDef.color || '#3b82f6'; ctx.globalAlpha = 0.1; ctx.fill(); ctx.restore();
          };
          if (props.shield) drawShieldRing(props.shield, 65);
          if (props.secondShield) drawShieldRing(props.secondShield, 75);
      }
      
      ctx.restore();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!props.onPartSelect) return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const clickX = Math.floor(x * scaleX);
      const clickY = Math.floor(y * scaleY);

      const hitCanvas = document.createElement('canvas');
      hitCanvas.width = canvas.width;
      hitCanvas.height = canvas.height;
      const hCtx = hitCanvas.getContext('2d', { willReadFrequently: true });
      
      if (hCtx) {
          hCtx.fillStyle = '#000000'; // Void
          hCtx.fillRect(0, 0, hitCanvas.width, hitCanvas.height);
          renderGeometry(hCtx, true); // Render Hit IDs
          
          const p = hCtx.getImageData(clickX, clickY, 1, 1).data;
          // ID is stored in Red channel (1-10)
          const partId = p[0];
          
          if (partId > 0 && ID_TO_PART[partId]) {
              props.onPartSelect(ID_TO_PART[partId]);
          } else {
              // Fallback to hull if clicking generally near center or just keep current selection
              // props.onPartSelect('hull'); 
          }
      }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use higher resolution for crisp rendering
    canvas.width = 300; 
    canvas.height = 300;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderGeometry(ctx, false); // Render Visuals

  }, [
      props.config, props.hullColor, props.wingColor, props.cockpitColor, props.cockpitHighlightColor,
      props.gunColor, props.secondaryGunColor, props.gunBodyColor, 
      props.engineColor, props.nozzleColor, props.barColor, props.showJets, props.jetType, 
      props.equippedWeapons, props.weaponId, props.isCapsule, props.shield, 
      props.secondShield, props.fullShields, props.weaponFireTimes, props.weaponHeat, props.activePart
  ]);

  return (
    <canvas 
        ref={canvasRef} 
        className={props.className} 
        onClick={handleCanvasClick}
    />
  );
};
