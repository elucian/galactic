
import { GameEngineState, Loot } from './types';
import { Asteroid } from './Asteroid';
import { Enemy } from './Enemy';
import { drawShip, drawRetro } from './renderers';
import { mixColor, getAlienColors, OCTO_COLORS } from './utils';
import { QuadrantType } from '../../types';

export const renderGame = (
    ctx: CanvasRenderingContext2D, 
    state: GameEngineState, 
    width: number, 
    height: number, 
    activeShip: any,
    quadrant: QuadrantType,
    globalScale: number = 1.0
) => {
    const s = state;
    
    // Background Shake
    const shakeX = (Math.random() - 0.5) * s.shakeX; 
    const shakeY = (Math.random() - 0.5) * s.shakeY;
    
    ctx.save(); 
    ctx.translate(shakeX, shakeY);
    ctx.fillStyle = '#000'; ctx.fillRect(-shakeX, -shakeY, width, height); 
    
    // Speed factor for stars
    let worldSpeedFactor = 1.0;
    if (s.currentThrottle > 0.1) worldSpeedFactor = 1.0 + (s.currentThrottle * 0.5); 
    if (s.currentThrottle < -0.1) worldSpeedFactor = 1.0 + (s.currentThrottle * 0.5); 

    // Stars
    ctx.fillStyle = '#fff'; 
    s.stars.forEach(st => { 
        st.y += st.s * 0.5 * worldSpeedFactor; 
        if(st.y > height) st.y = 0; 
        ctx.globalAlpha = Math.random() * 0.5 + 0.3; 
        ctx.beginPath(); ctx.arc(st.x, st.y, st.s, 0, Math.PI*2); ctx.fill(); 
    }); 
    ctx.globalAlpha = 1;

    // Entity Sorting (Z-index)
    const entities = [
        ...s.asteroids.map(a => ({type: 'ast', z: a.z, obj: a})), 
        ...s.enemies.map(e => ({type: 'enemy', z: e.z, obj: e})), 
        ...s.loot.map(l => ({type: 'loot', z: l.z, obj: l})), 
        {type: 'player', z: 0, obj: null}
    ].sort((a,b) => a.z - b.z);
    
    const lightVec = { x: 0.8, y: -0.8, z: 0.8 }; 
    const len = Math.hypot(lightVec.x, lightVec.y, lightVec.z); 
    lightVec.x /= len; lightVec.y /= len; lightVec.z /= len;
    
    entities.forEach(item => {
        const scale = 1 + (item.z / 1000);
        
        if (item.type === 'ast') {
            const a = item.obj as Asteroid;
            ctx.save(); ctx.translate(a.x, a.y); ctx.scale(scale, scale); 
            const cosX = Math.cos(a.ax), sinX = Math.sin(a.ax); const cosY = Math.cos(a.ay), sinY = Math.sin(a.ay); ctx.rotate(a.az); 
            a.faces.forEach(f => { let nx = f.normal.x; let ny = f.normal.y; let nz = f.normal.z; let ty = ny*cosX - nz*sinX; let tz = ny*sinX + nz*cosX; ny = ty; nz = tz; let tx = nx*cosY + nz*sinY; tz = -nx*sinY + nz*cosY; nx = tx; nz = tz; const cosZ = Math.cos(a.az), sinZ = Math.sin(a.az); tx = nx*cosZ - ny*sinZ; ty = nx*sinZ + ny*cosZ; nx = tx; ny = ty; if (nz <= 0) return; const dot = Math.max(0, nx*lightVec.x + ny*lightVec.y + nz*lightVec.z); const lightIntensity = 0.2 + (0.8 * dot); ctx.fillStyle = mixColor('#000000', a.color, lightIntensity); ctx.strokeStyle = mixColor('#000000', a.color, lightIntensity * 1.2); ctx.lineWidth = 1; ctx.beginPath(); f.indices.forEach((idx, i) => { const v = a.vertices[idx]; let vx = v.x; let vy = v.y; let vz = v.z; let rvy = vy*cosX - vz*sinX; let rvz = vy*sinX + vz*cosX; vy = rvy; vz = rvz; let rvx = vx*cosY + vz*sinY; rvz = -vx*sinY + vz*cosY; vx = rvx; vz = rvz; if (i===0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy); }); ctx.closePath(); ctx.fill(); ctx.stroke(); }); ctx.restore();
        } else if (item.type === 'player') {
            ctx.translate(s.px, s.py); 
            
            const visualMovement = { ...s.movement };
            
            // In Boss phase, player's main jets are forced off UNLESS they are actively thrusting up
            const playerForceMainJetsOff = s.phase === 'boss' && !s.movement.up;

            drawShip(ctx, { 
                config: activeShip.config, 
                fitting: activeShip.fitting, 
                color: activeShip.color, 
                wingColor: activeShip.wingColor, 
                cockpitColor: activeShip.cockpitColor, 
                gunColor: activeShip.gunColor, 
                secondaryGunColor: activeShip.secondaryGunColor, 
                gunBodyColor: activeShip.gunBodyColor, 
                engineColor: activeShip.engineColor, 
                nozzleColor: activeShip.nozzleColor, 
                equippedWeapons: activeShip.fitting.weapons,
                weaponFireTimes: s.weaponFireTimes,
                weaponHeat: s.weaponHeat
            }, true, visualMovement, s.usingWater, s.rescueMode, playerForceMainJetsOff, globalScale);
            
            if (s.shieldsEnabled && (s.sh1 > 0 || s.sh2 > 0) && !s.rescueMode) { 
                const shieldScale = globalScale;
                if (s.sh1 > 0) { ctx.save(); ctx.scale(shieldScale, shieldScale); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3; ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 10; ctx.globalAlpha = Math.min(1, s.sh1 / 250) * 0.6; ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } 
                if (s.sh2 > 0) { ctx.save(); ctx.scale(shieldScale, shieldScale); ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 3; ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 10; ctx.globalAlpha = Math.min(1, s.sh2 / 500) * 0.6; ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } 
            }
        } else if (item.type === 'enemy') {
            const e = item.obj as Enemy; 
            ctx.translate(e.x, e.y); 
            ctx.scale(scale, scale); 
            ctx.rotate(Math.PI); 
            const alienCols = getAlienColors(quadrant); 
            
            let enemyMovement = { up: false, down: false, left: false, right: false };
            let forceEnemyJetsOff = false;

            // Use the Enemy's own thrust state to determine visual jets
            if (e.isThrusting) {
                enemyMovement.up = true;
                forceEnemyJetsOff = false;
            } else {
                forceEnemyJetsOff = true;
            }

            // Visual flair for strafing (Inverted for rotation)
            if (e.vx < -0.5) enemyMovement.right = true; 
            if (e.vx > 0.5) enemyMovement.left = true;

            drawShip(ctx, { 
                config: e.config, 
                fitting: null, 
                color: e.type==='boss'?'#a855f7':alienCols.hull, 
                wingColor: e.type==='boss'?'#d8b4fe':alienCols.wing, 
                gunColor: '#ef4444', 
                equippedWeapons: e.equippedWeapons 
            }, false, enemyMovement, false, false, forceEnemyJetsOff, globalScale);

            if (e.shieldLayers.length > 0) { 
                const shieldScale = globalScale;
                e.shieldLayers.forEach((layer, idx) => { 
                    if (layer.current <= 0) return; 
                    const radius = (48 + (idx * 8)) * shieldScale; const opacity = Math.min(1, layer.current / layer.max); ctx.strokeStyle = layer.color; ctx.lineWidth = 3; ctx.shadowColor = layer.color; ctx.shadowBlur = 10; ctx.globalAlpha = opacity; ctx.beginPath();
                    if (layer.type === 'full') { if (layer.wobble > 0.01) { const steps = 40; const wobbleFreq = 8; const wobbleAmp = 5 * layer.wobble; const timeOffset = s.frame * 0.5; for(let i=0; i<=steps; i++) { const angle = (i / steps) * Math.PI * 2; const rOff = Math.sin(angle * wobbleFreq + timeOffset) * wobbleAmp; const r = radius + rOff; const x = Math.cos(angle) * r; const y = Math.sin(angle) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); } else { ctx.arc(0, 0, radius, 0, Math.PI * 2); } } else if (layer.type === 'front') { const arcRad = (140 * Math.PI) / 180; const start = (-Math.PI / 2) - (arcRad / 2) + layer.rotation; const end = (-Math.PI / 2) + (arcRad / 2) + layer.rotation; ctx.arc(0, 0, radius, start, end); } else if (layer.type === 'tri') { const segSize = Math.PI / 2; const gapSize = Math.PI / 6; for (let k = 0; k < 3; k++) { const start = layer.rotation + (k * (segSize + gapSize)); const end = start + segSize; ctx.moveTo(Math.cos(start) * radius, Math.sin(start) * radius); ctx.arc(0, 0, radius, start, end); } } else if (layer.type === 'hex') { const segSize = Math.PI / 4; const gapSize = Math.PI / 12; for (let k = 0; k < 6; k++) { const start = layer.rotation + (k * (segSize + gapSize)); const end = start + segSize; ctx.moveTo(Math.cos(start) * radius, Math.sin(start) * radius); ctx.arc(0, 0, radius, start, end); } }
                    ctx.stroke(); if (layer.type === 'full') { ctx.fillStyle = layer.color; ctx.globalAlpha = opacity * 0.1; ctx.fill(); } ctx.shadowBlur = 0; ctx.globalAlpha = 1; 
                }); 
            }
        } else if (item.type === 'loot') {
            const l = item.obj as Loot; ctx.translate(l.x, l.y); ctx.scale(scale, scale); if (l.isBeingPulled) { ctx.strokeStyle = 'rgba(192, 210, 255, 0.8)'; ctx.lineWidth = 2; ctx.shadowColor = '#fff'; ctx.shadowBlur = 5; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; ctx.save(); const dx = s.px - l.x; const dy = s.py - l.y; const dist = Math.hypot(dx, dy); const angle = Math.atan2(dy, dx); ctx.rotate(angle); const spacing = 15; const count = Math.ceil(dist / spacing); const speed = 4; const offset = (s.frame * speed) % spacing; ctx.lineWidth = 2; for (let i = 0; i <= count; i++) { const d = i * spacing + offset; if (d > 0 && d < dist) { const alpha = Math.min(1, Math.sin((d/dist)*Math.PI)) * 0.6; ctx.strokeStyle = `rgba(135, 206, 250, ${alpha})`; ctx.beginPath(); ctx.moveTo(d, -7); ctx.quadraticCurveTo(d - 5, 0, d, 7); ctx.stroke(); } } ctx.restore(); } ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#facc15'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.rect(-8, -8, 16, 16); ctx.fill(); ctx.shadowBlur = 0; if (l.type === 'water') { ctx.fillStyle = '#3b82f6'; ctx.fillRect(-8,-8,16,16); } else if (l.type === 'energy') { ctx.fillStyle = '#22d3ee'; ctx.fillRect(-8,-8,16,16); } ctx.font = "900 10px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = (l.type === 'water' || l.type === 'energy') ? '#000' : '#000'; if (l.type === 'water') ctx.fillStyle = '#fff'; let letter = "?"; if (l.type === 'fuel') letter = "F"; else if (l.type === 'water') letter = "W"; else if (l.type === 'energy') letter = "E"; else if (l.type === 'repair' || l.type === 'nanite') letter = "+"; else if (l.type === 'missile') letter = "M"; else if (l.type === 'mine') letter = "X"; else if (l.type === 'ammo') letter = "A"; else if (l.type === 'weapon') letter = "G"; else if (l.type === 'shield') letter = "S"; ctx.fillText(letter, 0, 1);
        }
        ctx.setTransform(1, 0, 0, 1, shakeX, shakeY); 
    });

    s.bullets.forEach(b => { 
        const scale = 1 + (b.z || 0) / 1000; ctx.save(); ctx.translate(b.x, b.y); ctx.scale(scale, scale);
        if (b.type === 'missile' || b.type === 'missile_emp' || b.type === 'missile_enemy') { ctx.scale(1.2, 1.2); const angle = Math.atan2(b.vy, b.vx) + Math.PI/2; ctx.rotate(angle); ctx.fillStyle = b.finsColor || '#ef4444'; ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-6, 2); ctx.lineTo(-3, 0); ctx.lineTo(-3, 8); ctx.fill(); ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(6, 2); ctx.lineTo(3, 0); ctx.lineTo(3, 8); ctx.fill(); ctx.fillStyle = '#94a3b8'; ctx.fillRect(-3, -6, 6, 14); ctx.fillStyle = b.headColor || '#ef4444'; ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(0, -10); ctx.lineTo(3, -6); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(-2, 8); ctx.lineTo(0, 12 + Math.random()*4); ctx.lineTo(2, 8); ctx.fill(); } 
        else if (b.type === 'mine' || b.type === 'mine_emp' || b.type === 'mine_red' || b.type === 'mine_enemy') { const radius = b.width / 2; ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5 + Math.sin(s.frame * 0.5) * 0.5; ctx.beginPath(); ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = b.color; ctx.lineWidth = 2; const spikeCount = 8; const spikeLen = radius + 4; for (let i = 0; i < spikeCount; i++) { const a = (Math.PI * 2 / spikeCount) * i + (s.frame * 0.05); const sx = Math.cos(a) * radius; const sy = Math.sin(a) * radius; const ex = Math.cos(a) * spikeLen; const ey = Math.sin(a) * spikeLen; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); } }
        else if (b.type === 'octo_shell') { ctx.save(); ctx.fillStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = b.glowIntensity || 20; ctx.beginPath(); ctx.arc(0, 0, b.width/2, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(0, 0, b.width/4, 0, Math.PI*2); ctx.fill(); if (!b.isOvercharge) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(0, 0, b.width*0.8, 0, Math.PI*2); ctx.fill(); } ctx.restore(); } 
        else if (b.weaponId === 'exotic_octo_burst') { ctx.save(); ctx.fillStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = b.glowIntensity || 20; ctx.beginPath(); ctx.arc(0, 0, b.width/2, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(0, 0, b.width/4, 0, Math.PI*2); ctx.fill(); ctx.restore(); } 
        else if (b.weaponId === 'exotic_gravity_wave') { ctx.strokeStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 15; ctx.lineCap = 'round'; const count = 5; const spacing = 6; for(let i=0; i<count; i++) { const arcW = b.width * (1 - i * 0.15); const yOff = i * spacing; ctx.globalAlpha = Math.max(0, 0.8 - (i * 0.15)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, yOff, arcW/2, Math.PI * (7/6), Math.PI * (11/6)); ctx.stroke(); } ctx.globalAlpha = 1; ctx.shadowBlur = 0; } 
        else if (b.weaponId === 'exotic_star_shatter') { ctx.fillStyle = b.isOvercharge ? '#ffffff' : '#fbbf24'; ctx.shadowColor = b.isOvercharge ? '#facc15' : '#f97316'; const blurScale = b.width / 4; ctx.shadowBlur = b.isOvercharge ? Math.min(100, 20 + blurScale) : 10; const rot = s.frame * 0.15 + (b.x * 0.01); ctx.rotate(rot); ctx.beginPath(); const baseSpikes = 6; const maxSpikes = 64; const ratio = (b.width - (b.initialWidth || 4)) / ((b.initialWidth || 4) * 2); const spikes = Math.floor(Math.min(maxSpikes, Math.max(baseSpikes, baseSpikes + (ratio * (maxSpikes - baseSpikes))))); const outer = b.width; const inner = b.width * 0.4; for(let i=0; i<spikes; i++) { const angleStep = Math.PI / spikes; const angle = i * 2 * Math.PI / spikes; let x = Math.cos(angle) * outer; let y = -Math.sin(angle) * outer; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); x = Math.cos(angle + angleStep) * inner; y = -Math.sin(angle + angleStep) * inner; ctx.lineTo(x, y); } ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; } 
        else if (b.weaponId === 'exotic_flamer') { ctx.globalAlpha = b.opacity !== undefined ? b.opacity : 1.0; ctx.fillStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = b.isOvercharge ? 30 : b.width; ctx.beginPath(); ctx.arc(0, 0, b.width/2, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.globalAlpha = (b.opacity !== undefined ? b.opacity : 1.0) * 0.6; ctx.beginPath(); ctx.arc(0, 0, b.width/4, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0; ctx.shadowBlur = 0; }
        else if (b.weaponId === 'exotic_rainbow_spread') { const radius = b.width / 2; const maxRad = b.isOvercharge ? 300 : 100; const opacity = Math.max(0.1, 1.0 - (radius / maxRad)); ctx.globalAlpha = opacity; if (b.isOvercharge) { ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 30; const colors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7']; colors.forEach((c, i) => { const r = radius - (i * 3); if (r > 0) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke(); } }); ctx.shadowBlur = 0; } else { const rot = Math.atan2(b.vy, b.vx); ctx.rotate(rot); ctx.shadowColor = b.color; ctx.shadowBlur = 10; ctx.globalAlpha = opacity * 0.7; ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, radius, -Math.PI/2, Math.PI/2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, radius * 0.7, -Math.PI/2, Math.PI/2); ctx.stroke(); ctx.shadowBlur = 0; } ctx.globalAlpha = 1; } 
        else if (b.weaponId === 'exotic_electric') { ctx.strokeStyle = '#00ffff'; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = b.isOvercharge ? 30 : 10; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -b.height/2); let ly = -b.height/2; while(ly < b.height/2) { ly += 5; ctx.lineTo((Math.random()-0.5)*b.width, ly); } ctx.stroke(); ctx.shadowBlur = 0; } 
        else if (b.weaponId === 'exotic_wave') { ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.shadowColor = b.color; ctx.shadowBlur = b.isOvercharge ? 30 : 5; ctx.beginPath(); ctx.arc(0, 0, b.width, 0, Math.PI*2); ctx.stroke(); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(0, 0, b.width * 0.6, 0, Math.PI*2); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0; } 
        else if (b.weaponId === 'exotic_plasma_orb') { const grad = ctx.createRadialGradient(0,0, b.width*0.2, 0,0, b.width); grad.addColorStop(0, '#fff'); grad.addColorStop(0.5, b.color); grad.addColorStop(1, 'transparent'); ctx.fillStyle = grad; ctx.shadowColor = b.color; ctx.shadowBlur = b.isOvercharge ? 30 : 0; ctx.beginPath(); ctx.arc(0,0, b.width, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; } 
        else if (b.type === 'laser') { if (Math.abs(b.vx) > 0.1) { const angle = Math.atan2(b.vy, b.vx) + Math.PI/2; ctx.rotate(angle); } ctx.fillStyle = b.color; if (b.isOvercharge) { ctx.lineCap = 'round'; ctx.lineWidth = b.width; ctx.strokeStyle = b.color; ctx.shadowBlur = b.glowIntensity || 10; ctx.shadowColor = b.color; ctx.beginPath(); ctx.moveTo(0, -b.height/2); ctx.lineTo(0, b.height/2); ctx.stroke(); ctx.lineWidth = b.width/2; ctx.strokeStyle = '#fff'; ctx.shadowBlur = 0; ctx.stroke(); } else { ctx.fillRect(-b.width/2, -b.height/2, b.width, b.height); } } 
        else if (b.type === 'firework_shell') { const trailLen = 20; const trailGrad = ctx.createLinearGradient(0,0,0, trailLen); trailGrad.addColorStop(0, '#ffffff'); trailGrad.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = trailGrad; ctx.fillRect(-1, 0, 2, trailLen); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0,0, 2, 0, Math.PI*2); ctx.fill(); } 
        else { const angle = Math.atan2(b.vy, b.vx) - Math.PI/2; ctx.rotate(angle); const trailLen = 30 + Math.random() * 10; const trailWidth = b.width; const trailGrad = ctx.createLinearGradient(0, 0, 0, -trailLen); trailGrad.addColorStop(0, 'rgba(200, 200, 200, 0.8)'); trailGrad.addColorStop(0.5, 'rgba(150, 150, 150, 0.4)'); trailGrad.addColorStop(1, 'rgba(100, 100, 100, 0)'); ctx.fillStyle = trailGrad; ctx.beginPath(); ctx.moveTo(-trailWidth/2, 0); ctx.lineTo(trailWidth/2, 0); ctx.lineTo(0, -trailLen); ctx.fill(); const headGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, b.width/2); headGrad.addColorStop(0, '#e2e8f0'); headGrad.addColorStop(1, '#78350f'); ctx.fillStyle = headGrad; ctx.beginPath(); ctx.arc(0, 0, b.width/2, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-b.width/4, -b.width/4, b.width/6, 0, Math.PI*2); ctx.fill(); } ctx.restore(); 
    });
    
    s.particles.forEach(p => { ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.translate(p.x, p.y); ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
    
    ctx.restore();
}
