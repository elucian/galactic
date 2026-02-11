
import { ExtendedShipConfig, WEAPONS, EXOTIC_WEAPONS, SHIELDS, EXOTIC_SHIELDS } from '../../constants';
import { ShipPart, Shield, EquippedWeapon, WeaponType } from '../../types';
import { getEngineCoordinates, getWingMounts } from '../../utils/drawingUtils';
import { resolveColor } from '../../utils/patternUtils';
import { mixColor } from './utils';

export const drawRetro = (ctx: CanvasRenderingContext2D, x: number, y: number, angleDeg: number, usingWater: boolean) => {
    drawJet(ctx, x, y, angleDeg, 0.8, usingWater, 30);
};

export const drawJet = (ctx: CanvasRenderingContext2D, x: number, y: number, angleDeg: number, intensity: number, usingWater: boolean, lengthScale: number = 60) => {
    ctx.save();
    ctx.translate(x, y);
    const rad = (angleDeg * Math.PI) / 180;
    ctx.rotate(rad);
    
    const flicker = 0.9 + Math.random() * 0.2; 
    const len = lengthScale * intensity * flicker;
    
    const nozzleRadius = 2.1 * (0.8 + 0.2 * intensity);
    const fatWidth = 10 * (0.8 + 0.5 * intensity);
    const fatY = len * 0.35;
    
    ctx.beginPath(); 
    ctx.moveTo(-nozzleRadius, 0);
    ctx.bezierCurveTo(-fatWidth, fatY * 0.8, -fatWidth * 0.5, len * 0.8, 0, len);
    ctx.bezierCurveTo(fatWidth * 0.5, len * 0.8, fatWidth, fatY * 0.8, nozzleRadius, 0);
    ctx.quadraticCurveTo(0, -nozzleRadius, -nozzleRadius, 0);
    ctx.closePath();
    
    const grad = ctx.createLinearGradient(0, 0, 0, len);
    if (usingWater) {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)'); 
        grad.addColorStop(0.3, 'rgba(96, 165, 250, 0.9)'); 
        grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
    } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)'); 
        grad.addColorStop(0.2, 'rgba(250, 204, 21, 0.9)');
        grad.addColorStop(0.6, 'rgba(239, 68, 68, 0.8)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    }
    
    ctx.fillStyle = grad;
    ctx.globalAlpha = Math.min(1, 0.85 + (0.15 * intensity)); 
    ctx.shadowBlur = 15 * intensity;
    ctx.shadowColor = usingWater ? '#3b82f6' : '#f97316';
    ctx.fill();
    ctx.shadowBlur = 0;
    
    if (intensity > 0.4) {
        const coreLen = len * 0.6;
        const coreW = fatWidth * 0.5;
        const coreFatY = coreLen * 0.35;
        
        ctx.beginPath();
        ctx.moveTo(-nozzleRadius * 0.5, 0);
        ctx.bezierCurveTo(-coreW, coreFatY * 0.8, -coreW * 0.5, coreLen * 0.8, 0, coreLen);
        ctx.bezierCurveTo(coreW * 0.5, coreLen * 0.8, coreW, coreFatY * 0.8, nozzleRadius * 0.5, 0);
        ctx.quadraticCurveTo(0, -nozzleRadius * 0.5, -nozzleRadius * 0.5, 0);
        
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.7;
        ctx.fill();
    }

    ctx.restore();
};

export const drawShip = (
    ctx: CanvasRenderingContext2D, 
    shipData: any, 
    isPlayer = false, 
    movement?: { up: boolean, down: boolean, left: boolean, right: boolean }, 
    usingWater = false, 
    isRescue = false,
    forceMainJetsOff = false,
    globalScale: number = 1.0
) => { 
    const { config, color: hullColor, wingColor, cockpitColor, cockpitHighlightColor, gunColor, secondaryGunColor, gunBodyColor, engineColor, nozzleColor, fitting, equippedWeapons, weaponFireTimes, weaponHeat, isPowerMode } = shipData; 
    const scale = (isPlayer ? 0.6 : 0.5) * globalScale; 
    
    ctx.save(); 
    ctx.scale(scale, scale); 
    ctx.translate(-50, -50); 
    
    if (isRescue) {
        ctx.save();
        ctx.translate(50, 50);
        ctx.fillStyle = resolveColor(ctx, hullColor || config.defaultColor || '#e2e8f0'); 
        ctx.beginPath();
        ctx.ellipse(0, 5, 20, 28, 0, 0, Math.PI * 2); 
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = resolveColor(ctx, cockpitColor || '#0ea5e9');
        ctx.beginPath();
        ctx.ellipse(0, -2, 12, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.ellipse(-4, -6, 3, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = resolveColor(ctx, engineColor || '#334155');
        ctx.fillRect(-6, 28, 12, 6);
        
        if (movement?.up && !forceMainJetsOff) {
             drawJet(ctx, 0, 34, 0, 1.4, usingWater, 50);
        } else if (!forceMainJetsOff) {
             drawJet(ctx, 0, 34, 0, 0.7, usingWater, 40);
        }
        ctx.restore();
    } else {
        const { wingStyle, hullShapeType } = config;
        
        // 1. WINGS
        ctx.fillStyle = resolveColor(ctx, wingColor || config.defaultColor || '#64748b');
        ctx.beginPath();
        if (config.isAlien) {
            ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = ctx.fillStyle;
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

        // 2. THRUSTERS
        const engineLocs = getEngineCoordinates(config);
        const mainIntensity = movement?.up ? 1.5 : 0.8; 
        const mainLength = usingWater ? 120 : 90;
        
        if ((movement?.up || !movement?.down) && !forceMainJetsOff) {
            engineLocs.forEach(eng => {
                const isAlien = config.isAlien;
                const nozzleH = isAlien ? 6 : 5;
                const jetY = eng.y + eng.h + nozzleH;
                const jetX = eng.x;
                drawJet(ctx, jetX, jetY, 0, mainIntensity, usingWater, mainLength);
            });
        }

        if (movement?.down) {
            if (config.wingStyle === 'alien-h') { drawJet(ctx, 35, 48, 180, 1.0, usingWater, 35); drawJet(ctx, 65, 48, 180, 1.0, usingWater, 35); }
            else if (config.wingStyle === 'alien-w') { drawJet(ctx, 22, 48, 180, 1.0, usingWater, 35); drawJet(ctx, 78, 48, 180, 1.0, usingWater, 35); }
            else if (config.wingStyle === 'alien-m') { drawJet(ctx, 20, 50, 180, 1.0, usingWater, 35); drawJet(ctx, 80, 50, 180, 1.0, usingWater, 35); }
            else if (config.wingStyle === 'x-wing') { drawJet(ctx, 15, 12, 135, 1.0, usingWater, 35); drawJet(ctx, 85, 12, 225, 1.0, usingWater, 35); }
            else { drawJet(ctx, 35, 20, 135, 1.0, usingWater, 35); drawJet(ctx, 65, 20, 225, 1.0, usingWater, 35); }
        }

        if (movement?.left) { 
            let rx = 80;
            if (config.wingStyle === 'x-wing') rx = 85;
            else if (config.wingStyle === 'curved') rx = 65;
            drawJet(ctx, rx, 50, -90, 0.9, usingWater, 35); 
        }
        if (movement?.right) { 
            let lx = 20;
            if (config.wingStyle === 'x-wing') lx = 15;
            else if (config.wingStyle === 'curved') lx = 35;
            drawJet(ctx, lx, 50, 90, 0.9, usingWater, 35); 
        }

        // 3. ENGINES
        const eColor = config.isAlien ? '#172554' : (engineColor || '#334155');
        // Accept nozzleColor prop
        const nColor = nozzleColor || (config.isAlien ? '#9ca3af' : '#475569');
        engineLocs.forEach(eng => {
            const drawX = eng.x - (eng.w+2)/2; const drawY = eng.y;
            ctx.fillStyle = resolveColor(ctx, eColor);
            if (config.isAlien) { ctx.beginPath(); ctx.ellipse(eng.x, eng.y + (eng.h+2)/2, (eng.w+2)/2, (eng.h+2)/2, 0, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.fillRect(drawX, drawY, eng.w+2, eng.h+2); }
            
            ctx.fillStyle = resolveColor(ctx, nColor);
            const nH = config.isAlien ? 6 : 5; const flare = config.isAlien ? 4 : 3; const inset = config.isAlien ? 1 : 0;
            ctx.beginPath();
            if (config.isAlien) { const ns = drawY + eng.h; ctx.moveTo(drawX + inset, ns); ctx.lineTo(drawX + eng.w+2 - inset, ns); ctx.lineTo(drawX + eng.w+2 + flare, ns + nH); ctx.lineTo(drawX - flare, ns + nH); } 
            else { ctx.moveTo(drawX + inset, drawY + eng.h+2); ctx.lineTo(drawX + eng.w+2 - inset, drawY + eng.h+2); ctx.lineTo(drawX + eng.w+2 + flare, drawY + eng.h+2 + nH); ctx.lineTo(drawX - flare, drawY + eng.h+2 + nH); }
            ctx.fill();
        });

        // 4. HULL
        ctx.fillStyle = resolveColor(ctx, hullColor || config.defaultColor || '#94a3b8');
        ctx.beginPath();
        if (wingStyle === 'x-wing') { 
            ctx.ellipse(50, 50, 18, 45, 0, 0, Math.PI * 2); 
            ctx.fill(); 
            // Paint details but don't re-fill hull
            ctx.fillStyle = '#64748b'; 
            ctx.fillRect(36, 40, 4, 20); 
            ctx.fillRect(60, 40, 4, 20); 
            ctx.beginPath(); // Clear path
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

        // 5. COCKPIT
        ctx.fillStyle = resolveColor(ctx, cockpitColor || '#0ea5e9');
        ctx.beginPath();
        if (config.isAlien) { const cy = wingStyle === 'alien-a' ? 65 : 45; ctx.ellipse(50, cy, 8, 20, 0, 0, Math.PI * 2); } 
        else if (wingStyle === 'x-wing') { ctx.ellipse(50, 55, 8, 12, 0, 0, Math.PI * 2); } 
        else { ctx.ellipse(50, 40, 8, 12, 0, 0, Math.PI * 2); }
        ctx.fill();
        
        // Accept cockpitHighlightColor prop
        ctx.fillStyle = resolveColor(ctx, cockpitHighlightColor || 'rgba(255,255,255,0.5)');
        ctx.beginPath(); 
        if (wingStyle === 'x-wing') { ctx.ellipse(48, 52, 3, 5, -0.2, 0, Math.PI * 2); } 
        else { const cy = (config.isAlien && wingStyle === 'alien-a') ? 65 : (config.isAlien ? 45 : 38); ctx.ellipse(48, cy - 2, 3, 5, -0.2, 0, Math.PI * 2); }
        ctx.fill();

        // 6. WEAPONS
        const drawWeapon = (x: number, y: number, id: string | undefined, type: 'primary' | 'secondary', slotIndex: number) => {
            if (!id) return;
            ctx.save();
            ctx.translate(x, y);
            
            const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === id);
            const isExotic = id.includes('exotic');
            const isAlien = config.isAlien;
            const bodyCol = (gunBodyColor && gunBodyColor !== '#334155') ? gunBodyColor : '#451a03';
            const crystalCol = type === 'secondary' ? (secondaryGunColor || '#38bdf8') : (gunColor || config.noseGunColor || '#ef4444');
            const wScale = isAlien && isExotic ? 1.4 : (isExotic ? 1.0 : 1.45); 
            
            // Recoil & State Calculation
            let isFiring = false;
            let showMuzzleFlash = false;
            let recoilY = 0;
            
            if (weaponFireTimes && weaponFireTimes[slotIndex]) {
                const timeSinceFire = Date.now() - weaponFireTimes[slotIndex];
                if (timeSinceFire < 150) { recoilY = Math.sin((timeSinceFire / 150) * Math.PI) * 4; }
                if (timeSinceFire < 200) isFiring = true;
                if (timeSinceFire < 50) showMuzzleFlash = true;
            }

            let heatColor = null;
            if (weaponHeat && weaponHeat[slotIndex] > 0) {
                const heat = weaponHeat[slotIndex];
                if (heat > 80) heatColor = '#ef4444'; else if (heat > 60) heatColor = '#f97316'; else if (heat > 30) heatColor = '#b45309';
            }

            ctx.scale(wScale, wScale);

            if (def && def.type === WeaponType.PROJECTILE && !isExotic) {
                // --- 1. MOUNTING PLATE (STATIC) ---
                ctx.fillStyle = '#18181b';
                ctx.fillRect(-3, -4, 6, 8);

                // --- 2. GUN BODY (STATIC) ---
                ctx.fillStyle = resolveColor(ctx, bodyCol);
                if (id.includes('vulcan')) ctx.fillRect(-3.5, 0, 7, 12); else ctx.fillRect(-3.5, 0, 7, 10);
                
                // --- 3. MOVING BARRELS (With Recoil) ---
                ctx.save();
                ctx.translate(0, recoilY);
                
                ctx.fillStyle = resolveColor(ctx, heatColor || crystalCol || '#52525b');
                
                const isRotary = ['gun_vulcan', 'gun_hyper', 'gun_shredder'].includes(id);
                const isHeavySingle = ['gun_plasma', 'gun_rail_titan', 'gun_doomsday'].includes(id);
                const isVentedFunnel = ['gun_heavy', 'gun_repeater'].includes(id);

                if (isRotary) {
                    const baseColors = ['#3f3f46', '#71717a', '#d4d4d8'];
                    const barrelColors = (slotIndex === 2) ? [...baseColors].reverse() : baseColors;
                    const rotDir = (slotIndex === 2) ? -1 : 1;
                    const offset = isFiring ? ((Math.floor(Date.now() / 40) * rotDir) % 3 + 3) % 3 : 0;

                    ctx.fillStyle = barrelColors[(0 + offset) % 3]; ctx.fillRect(-2.5, -16, 1.5, 16); 
                    ctx.fillStyle = barrelColors[(1 + offset) % 3]; ctx.fillRect(-0.75, -16, 1.5, 16); 
                    ctx.fillStyle = barrelColors[(2 + offset) % 3]; ctx.fillRect(1, -16, 1.5, 16);
                    ctx.fillStyle = '#3f3f46'; ctx.fillRect(-3, -18, 6, 2); // Dark Gray Muzzle Cap
                    
                    if (showMuzzleFlash) {
                        ctx.save(); ctx.translate(0, -18);
                        const flashGrad = ctx.createRadialGradient(0, -10, 2, 0, -10, 15);
                        flashGrad.addColorStop(0, '#ffffff'); flashGrad.addColorStop(0.3, '#facc15'); flashGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
                        ctx.fillStyle = flashGrad; ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.arc(0, -5, 10, 0, Math.PI*2); ctx.fill(); ctx.restore();
                    }
                } else if (isHeavySingle) {
                    // Optimized Doomsday Geometry: Longer barrel, shorter muzzle, 3 vent rows
                    const bW = 3; const bH = 10;
                    ctx.fillStyle = '#374151'; ctx.fillRect(-bW/2, -bH, bW, bH);
                    
                    const mW = 6; const mH = 11; const mY = -bH - mH + 2; 
                    ctx.fillStyle = '#4b5563'; ctx.fillRect(-mW/2, mY, mW, mH);
                    
                    const ventColor = (id === 'gun_doomsday' && isFiring) ? (Math.random() > 0.5 ? '#ef4444' : '#facc15') : '#09090b';
                    if (id === 'gun_doomsday' && isFiring) { ctx.shadowColor = ventColor; ctx.shadowBlur = 5; }
                    ctx.fillStyle = ventColor;
                    
                    const holeSize = 1.2;
                    for(let i=0; i<3; i++) {
                        const hy = mY + 2 + (i * 3);
                        ctx.fillRect(-2 - (holeSize/2), hy, holeSize, holeSize); 
                        ctx.fillRect(0 - (holeSize/2), hy, holeSize, holeSize); 
                        ctx.fillRect(2 - (holeSize/2), hy, holeSize, holeSize); 
                    }
                    ctx.shadowBlur = 0;

                    if (showMuzzleFlash) {
                        ctx.save(); ctx.translate(0, mY);
                        const fColor = id.includes('rail') ? '#22d3ee' : '#f97316';
                        const flashGrad = ctx.createRadialGradient(0, -10, 2, 0, -10, 20);
                        flashGrad.addColorStop(0, '#ffffff'); flashGrad.addColorStop(0.4, fColor); flashGrad.addColorStop(1, 'transparent');
                        ctx.fillStyle = flashGrad; ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-6,-25); ctx.lineTo(0,-40); ctx.lineTo(6,-25); ctx.fill(); ctx.restore();
                    }
                } else if (isVentedFunnel) {
                    const bW = 4; const bH = 12;
                    ctx.fillStyle = '#4b5563'; ctx.fillRect(-bW/2, -bH, bW, bH);
                    
                    const fH = 6; const fTop = 7;
                    ctx.fillStyle = '#1f2937';
                    ctx.beginPath(); ctx.moveTo(-bW/2, -bH); ctx.lineTo(-fTop/2, -bH - fH); ctx.lineTo(fTop/2, -bH - fH); ctx.lineTo(bW/2, -bH); ctx.fill();
                    
                    ctx.fillStyle = '#000';
                    for(let i=0; i<3; i++) { const vy = -bH + 3 + (i*3); ctx.beginPath(); ctx.arc(0, vy, 1.2, 0, Math.PI*2); ctx.fill(); }

                    if (showMuzzleFlash) {
                        ctx.save(); ctx.translate(0, -bH - fH);
                        const fColor = id === 'gun_heavy' ? '#ef4444' : '#fb923c';
                        const grad = ctx.createRadialGradient(0, 0, 2, 0, -5, 15);
                        grad.addColorStop(0, '#fff'); grad.addColorStop(0.4, fColor); grad.addColorStop(1, 'transparent');
                        ctx.fillStyle = grad; ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-8,-15); ctx.lineTo(0,-25); ctx.lineTo(8,-15); ctx.fill();
                        
                        ctx.translate(0, fH); 
                        for(let i=0; i<3; i++) { const vy = 3 + (i*3); ctx.fillStyle = fColor; ctx.beginPath(); ctx.arc(0, vy, 2, 0, Math.PI*2); ctx.fill(); }
                        ctx.restore();
                    }
                } else {
                    ctx.fillRect(-1.5, -16, 3, 16); ctx.fillStyle = '#27272a'; ctx.fillRect(-2, -16, 4, 2);
                }
                
                ctx.restore(); // End Recoil Translation

            } else {
                // --- ENERGY WEAPONS ---
                const activeBodyCol = isAlien ? '#374151' : bodyCol;
                ctx.fillStyle = resolveColor(ctx, activeBodyCol); 
                ctx.fillRect(-4.25, 0, 8.5, 10);
                
                let activeCrystalCol = resolveColor(ctx, crystalCol);
                
                // Only change crystal color to lighter shade when firing (normal shots)
                if (isFiring) {
                    activeCrystalCol = mixColor(activeCrystalCol as string, '#ffffff', 0.5);
                }
                
                // Only apply glow when firing AND in Power Shot mode
                if (isFiring && isPowerMode) {
                    ctx.shadowColor = crystalCol;
                    ctx.shadowBlur = 15;
                }

                ctx.fillStyle = activeCrystalCol;
                if (id?.includes('plasma') || isExotic) { 
                    ctx.beginPath(); ctx.arc(0, -8, 3, 0, Math.PI*2); ctx.fill(); 
                } else { 
                    ctx.fillRect(-2.5, -12, 5, 12); 
                }
                ctx.shadowBlur = 0;
            }
            ctx.restore();
        };

        const mainId = equippedWeapons ? (equippedWeapons[0]?.id) : (config.weaponId || 'gun_bolt');
        if (mainId) {
            if (config.wingStyle === 'alien-h') { drawWeapon(25, 20, mainId, 'primary', 0); drawWeapon(75, 20, mainId, 'primary', 0); } 
            else if (config.wingStyle === 'alien-w') { drawWeapon(10, 20, mainId, 'primary', 0); drawWeapon(90, 20, mainId, 'primary', 0); } 
            else if (config.wingStyle === 'alien-m') { drawWeapon(20, 25, mainId, 'primary', 0); drawWeapon(80, 25, mainId, 'primary', 0); } 
            else if (config.wingStyle === 'alien-a') { drawWeapon(50, 22, mainId, 'primary', 0); } 
            else if (config.wingStyle === 'x-wing') { drawWeapon(50, 20, mainId, 'primary', 0); } 
            else { drawWeapon(50, 10, mainId, 'primary', 0); }
        }

        if (equippedWeapons) {
            const mounts = getWingMounts(config);
            if (equippedWeapons[1]) drawWeapon(mounts[0].x, mounts[0].y, equippedWeapons[1]?.id, 'secondary', 1); 
            if (equippedWeapons[2]) drawWeapon(mounts[1].x, mounts[1].y, equippedWeapons[2]?.id, 'secondary', 2); 
        }
    }
    
    ctx.restore();
};
