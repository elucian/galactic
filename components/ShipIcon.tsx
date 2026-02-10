
import React, { useEffect, useRef } from 'react';
import { ExtendedShipConfig, WEAPONS, EXOTIC_WEAPONS, SHIELDS, EXOTIC_SHIELDS } from '../constants.ts';
import { ShipPart, Shield, EquippedWeapon, WeaponType } from '../types.ts';
import { getEngineCoordinates, getWingMounts } from '../utils/drawingUtils.ts';
import { resolveColor } from '../utils/patternUtils.ts';

interface ShipIconProps {
  config: ExtendedShipConfig;
  className?: string;
  hullColor?: string;
  wingColor?: string;
  cockpitColor?: string;
  cockpitHighlightColor?: string; // Added prop
  gunColor?: string;
  secondaryGunColor?: string;
  gunBodyColor?: string;
  engineColor?: string;
  nozzleColor?: string;
  barColor?: string;
  activePart?: ShipPart;
  onPartSelect?: (part: ShipPart) => void;
  showJets?: boolean;
  jetType?: 'combustion' | 'ion'; 
  showGear?: boolean;
  shield?: Shield | null;
  secondShield?: Shield | null;
  fullShields?: boolean;
  weaponId?: string;
  equippedWeapons?: (EquippedWeapon | null)[];
  weaponFireTimes?: { [key: number]: number }; 
  weaponHeat?: { [key: number]: number }; 
  forceShieldScale?: boolean; 
  isCapsule?: boolean; 
}

export const ShipIcon: React.FC<ShipIconProps> = ({
  config,
  className,
  hullColor,
  wingColor,
  cockpitColor,
  cockpitHighlightColor,
  gunColor,
  secondaryGunColor,
  gunBodyColor,
  engineColor,
  nozzleColor,
  barColor,
  activePart,
  onPartSelect,
  showJets = false,
  jetType = 'ion', 
  showGear = false,
  shield,
  secondShield,
  fullShields = false,
  weaponId,
  equippedWeapons,
  weaponFireTimes,
  weaponHeat,
  forceShieldScale = false,
  isCapsule = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const shouldScaleDown = !!shield || !!secondShield || forceShieldScale;

  const handleClick = (e: React.MouseEvent) => {
    if (!onPartSelect || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    let x, y;
    if (shouldScaleDown) {
        x = (nx * 300 - 65) / 1.7;
        y = (ny * 300 - 65) / 1.7;
    } else {
        x = nx * 100;
        y = ny * 100;
    }

    const dist = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x1 - x2, y1 - y2);

    const mainGuns: {x:number, y:number}[] = [];
    if (config.wingStyle === 'alien-h') { mainGuns.push({x:25, y:20}, {x:75, y:20}); }
    else if (config.wingStyle === 'alien-w') { mainGuns.push({x:10, y:20}, {x:90, y:20}); }
    else if (config.wingStyle === 'alien-m') { mainGuns.push({x:20, y:25}, {x:80, y:25}); }
    else if (config.wingStyle === 'alien-a') { mainGuns.push({x:50, y:22}); }
    else if (config.wingStyle === 'x-wing') { mainGuns.push({x:50, y:20}); }
    else { mainGuns.push({x:50, y:10}); }

    for (const p of mainGuns) {
        if (dist(x, y, p.x, p.y) < 15) { 
            if (y < p.y - 2) return onPartSelect('guns');
            return onPartSelect('gun_body');
        }
    }

    if (equippedWeapons) {
        const mounts = getWingMounts(config);
        if (equippedWeapons[1]) {
             if (dist(x, y, mounts[0].x, mounts[0].y) < 15) {
                if (y < mounts[0].y - 2) return onPartSelect('secondary_guns');
                return onPartSelect('gun_body');
             }
        }
        if (equippedWeapons[2]) {
             if (dist(x, y, mounts[1].x, mounts[1].y) < 15) {
                if (y < mounts[1].y - 2) return onPartSelect('secondary_guns');
                return onPartSelect('gun_body');
             }
        }
    }

    const engLocs = getEngineCoordinates(config);
    for (const eng of engLocs) {
        const dx = Math.abs(x - eng.x);
        const dy = y - eng.y;
        if (dx < (eng.w/2 + 8) && dy > -5 && dy < (eng.h + 10)) {
            if (dy > eng.h - 2) return onPartSelect('nozzles'); 
            return onPartSelect('engines');
        }
    }

    if (Math.abs(x - 50) > 20 && y > 30 && y < 80) return onPartSelect('wings');
    
    // Updated Cockpit Detection: Center is Highlight, Edge is Glass
    if (Math.abs(x - 50) < 15 && y > 20 && y < 60) {
        const cy = config.isAlien ? (config.wingStyle === 'alien-a' ? 65 : 45) : (config.wingStyle === 'x-wing' ? 55 : 40);
        // Inner region -> Highlight
        if (Math.abs(x - 50) < 5 && Math.abs(y - cy) < 6) return onPartSelect('cockpit_highlight');
        return onPartSelect('cockpit');
    }
    
    if (Math.abs(x - 50) < 20 && y > 10 && y < 90) return onPartSelect('hull');
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 300;
    canvas.height = 300;
    
    const scale = shouldScaleDown ? 1.7 : 3;
    const translate = shouldScaleDown ? 65 : 0; 

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.translate(translate, translate);
    ctx.scale(scale, scale);

    if (isCapsule) {
        ctx.save();
        ctx.translate(50, 50);
        ctx.fillStyle = hullColor || '#e2e8f0'; 
        ctx.beginPath();
        ctx.ellipse(0, 5, 18, 24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = cockpitColor || '#0ea5e9';
        ctx.beginPath();
        ctx.ellipse(0, -2, 10, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(-4, -6, 3, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = engineColor || '#334155';
        ctx.fillRect(-6, 26, 12, 6);
        if (showJets) {
             ctx.fillStyle = '#f97316';
             ctx.beginPath(); ctx.moveTo(-4, 32); ctx.lineTo(0, 45); ctx.lineTo(4, 32); ctx.fill();
        }
        ctx.restore();
        ctx.restore();
        return;
    }

    const { wingStyle, hullShapeType } = config;
    const engineLocs = getEngineCoordinates(config);

    const drawPart = (part: ShipPart, colorStr: string | undefined, drawFn: () => void) => {
        ctx.save();
        
        // Resolve pattern or simple color
        ctx.fillStyle = resolveColor(ctx, colorStr);
        
        // If it's a pattern, use white stroke if active, or just fill. 
        // If simple color, stroke matches fill.
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
        
        // Stroke logic for patterns or active selection
        if (colorStr?.startsWith('pat|') || activePart === part) {
            ctx.stroke();
        }
        
        ctx.restore();
    };

    if (config.isAlien) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        const ovalY = wingStyle === 'alien-a' ? 55 : 45;
        ctx.ellipse(50, ovalY, 12, 35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawPart('wings', wingColor || config.defaultColor, () => {
        if (wingStyle === 'cylon') ctx.filter = 'brightness(0.7)';
        ctx.beginPath();
        if (config.isAlien) {
            ctx.lineWidth = 14; 
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
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
        ctx.filter = 'none';
    });

    if (showJets) {
        ctx.save();
        engineLocs.forEach(eng => {
            const isAlien = config.isAlien;
            const nozzleH = isAlien ? 6 : 5;
            const jetY = eng.y + eng.h + nozzleH;
            const jetW = eng.w * 0.8;
            const jetX = eng.x - (jetW / 2);
            const length = jetType === 'combustion' ? 60 : 160; 
            ctx.beginPath();
            ctx.moveTo(jetX, jetY); ctx.lineTo(jetX + jetW/2, jetY + length); ctx.lineTo(jetX + jetW, jetY);
            const grad = ctx.createLinearGradient(jetX, jetY, jetX, jetY + length);
            if (jetType === 'combustion') {
                ctx.shadowBlur = 0; grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.2, '#facc15'); grad.addColorStop(0.6, '#ef4444'); grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
            } else {
                ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 20; grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.1, '#93c5fd'); grad.addColorStop(0.4, '#3b82f6'); grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
            }
            ctx.fillStyle = grad; ctx.globalAlpha = 0.9; ctx.fill();
        });
        ctx.restore();
    }

    const drawEngineRect = (x: number, y: number, w: number, h: number) => {
        const isAlien = config.isAlien;
        const eColor = isAlien ? '#172554' : (engineColor || '#334155');
        const nColor = isAlien ? '#9ca3af' : (nozzleColor || '#475569');
        const padW = 2; const padH = 2; const ew = w + padW; const eh = h + padH; const drawX = x - ew/2;
        
        drawPart('engines', eColor, () => {
            ctx.beginPath();
            if (isAlien) { ctx.ellipse(x, y + eh/2, ew/2, eh/2, 0, 0, Math.PI * 2); }
            else { const r = 3; if (ctx.roundRect) ctx.roundRect(drawX, y, ew, eh, r); else ctx.rect(drawX, y, ew, eh); }
            ctx.fill();
        });

        drawPart('nozzles', nColor, () => {
            const nozzleH = isAlien ? 6 : 5; const flare = isAlien ? 4 : 3; const inset = isAlien ? 1 : 0;
            ctx.beginPath();
            if (isAlien) {
                const nozzleStart = y + eh - 2;
                ctx.moveTo(drawX + inset, nozzleStart); ctx.lineTo(drawX + ew - inset, nozzleStart); ctx.lineTo(drawX + ew + flare, nozzleStart + nozzleH); ctx.lineTo(drawX - flare, nozzleStart + nozzleH); 
            } else {
                ctx.moveTo(drawX + inset, y + eh); ctx.lineTo(drawX + ew - inset, y + eh); ctx.lineTo(drawX + ew + flare, y + eh + nozzleH); ctx.lineTo(drawX - flare, y + eh + nozzleH); 
            }
            ctx.fill();
        });
    };

    engineLocs.forEach(eng => { drawEngineRect(eng.x, eng.y, eng.w, eng.h); });

    drawPart('hull', hullColor || config.defaultColor, () => {
        ctx.beginPath();
        if (wingStyle === 'x-wing') { ctx.ellipse(50, 50, 18, 45, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#64748b'; ctx.fillRect(36, 40, 4, 20); ctx.fillRect(60, 40, 4, 20); }
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

    // --- COCKPIT BASE ---
    drawPart('cockpit', cockpitColor || '#0ea5e9', () => {
        ctx.beginPath();
        if (config.isAlien) { const cy = wingStyle === 'alien-a' ? 65 : 45; ctx.ellipse(50, cy, 8, 20, 0, 0, Math.PI * 2); } 
        else if (wingStyle === 'x-wing') { ctx.ellipse(50, 55, 8, 12, 0, 0, Math.PI * 2); } 
        else { ctx.ellipse(50, 40, 8, 12, 0, 0, Math.PI * 2); }
        ctx.fill();
    });

    // --- COCKPIT HIGHLIGHT (GLINT) ---
    drawPart('cockpit_highlight', cockpitHighlightColor || 'rgba(255,255,255,0.5)', () => {
        ctx.beginPath(); 
        if (wingStyle === 'x-wing') { ctx.ellipse(48, 52, 3, 5, -0.2, 0, Math.PI * 2); } 
        else { const cy = (config.isAlien && wingStyle === 'alien-a') ? 65 : (config.isAlien ? 45 : 38); ctx.ellipse(48, cy - 2, 3, 5, -0.2, 0, Math.PI * 2); }
        ctx.fill();
    });

    if (config.isAlien) {
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.lineCap = 'round'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8;
        const cy = wingStyle === 'alien-a' ? 65 : 45; const gap = 8;
        ctx.beginPath(); ctx.ellipse(50, cy, 8 + gap, 20 + gap, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        ctx.restore();
    }

    const drawWeapon = (x: number, y: number, id: string | undefined, type: 'primary' | 'secondary', slotIndex: number) => {
        if (!id) return;
        ctx.save(); ctx.translate(x, y);
        
        let isFiring = false; let showMuzzleFlash = false;
        if (weaponFireTimes && weaponFireTimes[slotIndex]) {
            const timeSinceFire = Date.now() - weaponFireTimes[slotIndex];
            if (timeSinceFire < 150) { const recoilY = Math.sin((timeSinceFire / 150) * Math.PI) * 4; ctx.translate(0, recoilY); }
            if (timeSinceFire < 200) isFiring = true;
            if (timeSinceFire < 50) showMuzzleFlash = true; 
        }

        let heatColor = null;
        if (weaponHeat && weaponHeat[slotIndex] > 0) {
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
            drawPart('gun_body', bodyCol, () => { if (id.includes('vulcan')) ctx.fillRect(-4.25, 0, 8.5, 12); else ctx.fillRect(-4.25, 0, 8.5, 10); });
            ctx.fillStyle = resolveColor(ctx, heatColor || '#52525b');
            const isRotary = (def.barrelCount || 1) > 1;
            if (isRotary) {
                ctx.fillRect(-3, -24, 2, 24); ctx.fillRect(-1, -24, 2, 24); ctx.fillRect(1, -24, 2, 24);
                ctx.fillStyle = '#18181b'; ctx.fillRect(-3.5, -25, 7, 2);
                if (showMuzzleFlash) { /* ... flash ... */ }
            } else {
                ctx.fillRect(-1.5, -16, 3, 16); ctx.fillStyle = '#27272a'; ctx.fillRect(-2, -16, 4, 2);
            }
        } else {
            if (isAlien && isExotic) {
                drawPart('gun_body', '#334155', () => { ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(-4, -4, 8, 12, 3); else ctx.rect(-4, -4, 8, 12); ctx.fill(); });
                drawPart(type === 'secondary' ? 'secondary_guns' : 'guns', crystalCol, () => { ctx.fillRect(-2.5, -10, 5, 8); });
            } else {
                drawPart('gun_body', bodyCol, () => { ctx.fillRect(-4.25, 0, 8.5, 10); });
                drawPart(type === 'secondary' ? 'secondary_guns' : 'guns', crystalCol, () => { if (id?.includes('plasma')) { ctx.beginPath(); ctx.arc(0, -8, 3, 0, Math.PI*2); ctx.fill(); } else { ctx.fillRect(-2.5, -12, 5, 12); } });
            }
        }
        ctx.restore();
    };

    const mainId = equippedWeapons ? (equippedWeapons[0]?.id) : (config.weaponId || 'gun_bolt');
    const drawMain = !equippedWeapons || equippedWeapons[0];
    const drawLeft = equippedWeapons && equippedWeapons[1];
    const drawRight = equippedWeapons && equippedWeapons[2];

    if (mainId && drawMain) {
        if (config.wingStyle === 'alien-h') { drawWeapon(25, 20, mainId, 'primary', 0); drawWeapon(75, 20, mainId, 'primary', 0); } 
        else if (config.wingStyle === 'alien-w') { drawWeapon(10, 20, mainId, 'primary', 0); drawWeapon(90, 20, mainId, 'primary', 0); } 
        else if (config.wingStyle === 'alien-m') { drawWeapon(20, 25, mainId, 'primary', 0); drawWeapon(80, 25, mainId, 'primary', 0); } 
        else if (config.wingStyle === 'alien-a') { drawWeapon(50, 22, mainId, 'primary', 0); } 
        else if (config.wingStyle === 'x-wing') { drawWeapon(50, 20, mainId, 'primary', 0); } 
        else { drawWeapon(50, 10, mainId, 'primary', 0); }
    }

    if (equippedWeapons) {
        const mounts = getWingMounts(config);
        if (drawLeft) drawWeapon(mounts[0].x, mounts[0].y, equippedWeapons[1]?.id, 'secondary', 1); 
        if (drawRight) drawWeapon(mounts[1].x, mounts[1].y, equippedWeapons[2]?.id, 'secondary', 2); 
    }

    if (fullShields && (shield || secondShield)) {
        const drawShieldRing = (sDef: Shield, r: number) => {
            if (!sDef) return; ctx.save(); ctx.beginPath(); ctx.arc(50, 50, r, 0, Math.PI * 2); ctx.strokeStyle = sDef.color || '#3b82f6'; ctx.lineWidth = 1.5; ctx.shadowColor = sDef.color || '#3b82f6'; ctx.shadowBlur = 8; ctx.globalAlpha = 0.8; ctx.stroke(); ctx.fillStyle = sDef.color || '#3b82f6'; ctx.globalAlpha = 0.1; ctx.fill(); ctx.beginPath(); ctx.arc(50, 50, r, -Math.PI*0.3, -Math.PI*0.1); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.shadowBlur = 0; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.restore();
        };
        if (shield) drawShieldRing(shield, 65);
        if (secondShield) drawShieldRing(secondShield, 75);
    }
    
    ctx.restore();
  };

  useEffect(() => {
      let animationId: number;
      const render = () => { draw(); if (weaponFireTimes || weaponHeat) { animationId = requestAnimationFrame(render); } };
      render(); return () => { if (animationId) cancelAnimationFrame(animationId); };
  }, [config, hullColor, wingColor, cockpitColor, cockpitHighlightColor, gunColor, secondaryGunColor, gunBodyColor, engineColor, nozzleColor, barColor, activePart, showJets, jetType, showGear, shield, secondShield, fullShields, weaponId, equippedWeapons, weaponFireTimes, weaponHeat, forceShieldScale, isCapsule]);

  return ( <canvas ref={canvasRef} className={className} onClick={handleClick} /> );
};
