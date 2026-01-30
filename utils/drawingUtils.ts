
import { ExtendedShipConfig } from '../constants';
import { Planet, QuadrantType } from '../types';

// --- SEEDED RNG UTILS ---
const createSeededRandom = (seedStr: string) => {
    let seed = seedStr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
};

const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
};

const mixColor = (c1: string, c2: string, weight: number) => {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    const w = Math.min(1, Math.max(0, weight));
    const r = Math.round(rgb1.r * (1 - w) + rgb2.r * w);
    const g = Math.round(rgb1.g * (1 - w) + rgb2.g * w);
    const b = Math.round(rgb1.b * (1 - w) + rgb2.b * w);
    return `rgb(${r},${g},${b})`;
};

const hexToRgbaStr = (hex: string, alpha: number) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(255,255,255,${alpha})`;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getShipHullWidths = (config: ExtendedShipConfig) => {
    let top = 20;
    let bot = 35;
    
    switch (config.shape) {
        case 'arrow': top = 15; bot = 40; break;
        case 'block': top = 35; bot = 35; break;
        case 'stealth': top = 10; bot = 30; break;
        case 'dragonfly': top = 12; bot = 18; break;
        case 'star-t': top = 40; bot = 15; break;
        case 'saucer': top = 30; bot = 30; break;
        case 'frigate': top = 28; bot = 35; break;
        case 'wing': top = 15; bot = 40; break;
        case 'mine-layer': top = 25; bot = 35; break;
    }
    
    if (config.isAlien) {
        if (config.wingStyle === 'alien-h') { top = 25; bot = 25; }
        else if (config.wingStyle === 'alien-w') { top = 15; bot = 40; }
        else if (config.wingStyle === 'alien-a') { top = 10; bot = 30; }
        else if (config.wingStyle === 'alien-m') { top = 30; bot = 30; }
    }
    
    return { top, bottom: bot };
};

export const getEngineCoordinates = (config: ExtendedShipConfig) => {
    const engines = [];
    const baseY = 80;
    
    if (config.isAlien) {
        if (config.engines === 1) {
            engines.push({ x: 50, y: 70, w: 12, h: 8 });
        } else if (config.engines === 2) {
            engines.push({ x: 35, y: 75, w: 10, h: 8 });
            engines.push({ x: 65, y: 75, w: 10, h: 8 });
        } else {
            engines.push({ x: 30, y: 70, w: 8, h: 6 });
            engines.push({ x: 50, y: 75, w: 10, h: 8 });
            engines.push({ x: 70, y: 70, w: 8, h: 6 });
        }
    } else {
        if (config.engines === 1) {
            engines.push({ x: 50, y: baseY, w: 10, h: 10 });
        } else if (config.engines === 2) {
            if (config.wingStyle === 'x-wing') {
                engines.push({ x: 38, y: baseY, w: 8, h: 10 });
                engines.push({ x: 62, y: baseY, w: 8, h: 10 });
            } else {
                engines.push({ x: 40, y: baseY, w: 8, h: 10 });
                engines.push({ x: 60, y: baseY, w: 8, h: 10 });
            }
        } else { 
            engines.push({ x: 50, y: baseY + 5, w: 10, h: 10 });
            engines.push({ x: 35, y: baseY, w: 8, h: 10 });
            engines.push({ x: 65, y: baseY, w: 8, h: 10 });
        }
    }
    return engines;
};

export const getWingMounts = (config: ExtendedShipConfig) => {
    if (config.isAlien) {
        if (config.wingStyle === 'alien-w') return [{x: 10, y: 40}, {x: 90, y: 40}];
        if (config.wingStyle === 'alien-h') return [{x: 25, y: 48}, {x: 75, y: 48}];
        return [{x: 30, y: 50}, {x: 70, y: 50}];
    }
    
    if (config.wingStyle === 'x-wing') return [{x: 15, y: 40}, {x: 85, y: 40}];
    if (config.wingStyle === 'delta') return [{x: 20, y: 60}, {x: 80, y: 60}];
    
    return [{x: 25, y: 50}, {x: 75, y: 50}];
};

export const drawPlatform = (ctx: CanvasRenderingContext2D, x: number, y: number, isOcean: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    if (isOcean) {
        const w = 500; const h = 20; const halfW = w/2;
        ctx.fillStyle = '#334155'; ctx.fillRect(-halfW + 20, 0, 15, 200); ctx.fillRect(halfW - 35, 0, 15, 200);
        ctx.fillStyle = '#1e293b'; ctx.fillRect(-halfW, -h, w, h);
        ctx.fillStyle = '#facc15'; for(let i=-halfW; i<halfW; i+=50) ctx.fillRect(i, -h, 25, 3);
    } else {
        const w = 240; const h = 20; const halfW = w/2;
        ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.moveTo(-halfW - 10, 0); ctx.lineTo(-halfW, -h); ctx.lineTo(halfW, -h); ctx.lineTo(halfW + 10, 0); ctx.fill();
        ctx.fillStyle = '#4b5563'; ctx.fillRect(-halfW, -h, w, 4);
        ctx.fillStyle = '#facc15'; for(let i=-halfW; i<halfW; i+=30) { ctx.beginPath(); ctx.moveTo(i, -h); ctx.lineTo(i + 15, -h); ctx.lineTo(i + 5, -h + 4); ctx.lineTo(i - 10, -h + 4); ctx.fill(); }
    }
    ctx.restore();
};

export const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, alpha: number, color: string = '#ffffff', puffs: any[] = [], vStretch: number = 1.0) => {
    ctx.save();
    ctx.translate(x, y);
    
    const rgb = hexToRgb(color);
    const baseColor = `${rgb.r},${rgb.g},${rgb.b}`;

    if (puffs && puffs.length > 0) {
        for (const p of puffs) {
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            grad.addColorStop(0, `rgba(${baseColor}, ${alpha * p.a})`);
            grad.addColorStop(1, `rgba(${baseColor}, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w/2);
        grad.addColorStop(0, `rgba(${baseColor}, ${alpha})`);
        grad.addColorStop(1, `rgba(${baseColor}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, w/2, 0, Math.PI*2);
        ctx.fill();
    }
    
    ctx.restore();
};

export const drawBoulder = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-size, 0); ctx.lineTo(-size*0.6, -size*0.8); ctx.lineTo(0, -size); ctx.lineTo(size*0.7, -size*0.6); ctx.lineTo(size, 0); ctx.fill();
    ctx.restore();
};

export const drawStreetLight = (ctx: CanvasRenderingContext2D, x: number, y: number, h: number, isDay: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#52525b';
    ctx.fillRect(-1, -h, 2, h);
    ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(8, -h-2); ctx.lineTo(8, -h+2); ctx.lineTo(0, -h); ctx.fill();
    if (!isDay) {
        ctx.fillStyle = '#facc15'; ctx.shadowColor = '#facc15'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(8, -h, 3, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
};

export const drawVehicle = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, type: string, color: string, isDay: boolean, dir: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(dir, 1); 
    
    if (type === 'train_engine') {
        ctx.fillStyle = color; ctx.fillRect(-20, -14, 40, 14);
        ctx.fillStyle = '#1e293b'; ctx.fillRect(-20, -22, 16, 8);
        ctx.fillStyle = color; ctx.fillRect(-22, -24, 20, 2);
        ctx.fillStyle = '#000'; ctx.fillRect(8, -20, 6, 6);
        ctx.fillStyle = '#333'; ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(26, 0); ctx.lineTo(20, -8); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(-12, 0, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(12, 0, 5, 0, Math.PI*2); ctx.fill();
        if (!isDay) {
            ctx.fillStyle = '#facc15'; ctx.shadowColor = '#facc15'; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.moveTo(20, -8); ctx.lineTo(100, -20); ctx.lineTo(100, 10); ctx.fill(); ctx.shadowBlur = 0;
        }
        ctx.fillStyle = '#fbbf24'; ctx.fillRect(20, -10, 2, 6); 
    } else if (type === 'train_carriage') {
        ctx.fillStyle = color; ctx.fillRect(-18, -14, 36, 14);
        ctx.fillStyle = isDay ? '#1e293b' : '#facc15'; ctx.fillRect(-14, -10, 8, 5); ctx.fillRect(-2, -10, 8, 5); ctx.fillRect(10, -10, 8, 5);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-12, 0, 4, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(12, 0, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#333'; ctx.fillRect(-20, -6, 2, 4);
    } else {
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.lineTo(14, -6); ctx.lineTo(8, -11); ctx.lineTo(-8, -11); ctx.lineTo(-14, -6); ctx.fill();
        ctx.fillStyle = '#cffafe'; ctx.beginPath(); ctx.moveTo(-7, -9); ctx.lineTo(5, -9); ctx.lineTo(9, -6); ctx.lineTo(-10, -6); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-8, 0, 4, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(8, 0, 4, 0, Math.PI*2); ctx.fill();
        if (!isDay) { ctx.fillStyle = '#fef08a'; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(40, -10); ctx.lineTo(40, 5); ctx.fill(); ctx.globalAlpha = 1; }
        ctx.fillStyle = '#ef4444'; ctx.fillRect(-14, -5, 2, 3);
    }
    ctx.restore();
};

export const drawBird = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, flap: number, color: string = '#000') => {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const wingY = flap * (size * 0.6); 
    ctx.moveTo(-size, -wingY);
    ctx.quadraticCurveTo(0, size * 0.3, size, -wingY);
    ctx.stroke();
    ctx.restore();
};

export const drawLightning = (ctx: CanvasRenderingContext2D, x: number, y: number, height: number, color: string = '#fff') => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(x, y);
    let curX = x;
    let curY = y;
    const segments = 10;
    const segH = height / segments;
    
    for(let i=0; i<segments; i++) {
        curX += (Math.random() - 0.5) * 40;
        curY += segH;
        ctx.lineTo(curX, curY);
        if (Math.random() > 0.7 && i < segments - 2) {
            ctx.save();
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(curX, curY);
            ctx.lineTo(curX + (Math.random()-0.5)*30, curY + 30);
            ctx.stroke();
            ctx.restore();
        }
    }
    ctx.stroke();
    ctx.restore();
};

export const drawWindmill = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1.0, isDay: boolean, type: 'classic' | 'helical' = 'classic') => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    ctx.fillStyle = '#cbd5e1'; 
    ctx.beginPath();
    ctx.moveTo(-2, 0); ctx.lineTo(-1, -60); ctx.lineTo(1, -60); ctx.lineTo(2, 0);
    ctx.fill();
    
    const time = Date.now() * 0.002;
    ctx.translate(0, -60);
    
    if (type === 'classic') {
        ctx.fillStyle = '#475569';
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
        ctx.rotate(time);
        ctx.fillStyle = '#f1f5f9'; 
        for(let i=0; i<3; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(5, -10, 2, -40);
            ctx.quadraticCurveTo(-2, -40, 0, 0);
            ctx.fill();
            ctx.rotate((Math.PI*2)/3);
        }
    } else {
        ctx.fillStyle = '#475569';
        ctx.fillRect(-1, -20, 2, 40);
        const rotation = time * 2;
        const width = 15;
        const height = 30;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#f1f5f9';
        ctx.beginPath();
        for(let i=0; i<=height; i+=2) {
            const yPos = i - (height/2);
            const xPos = Math.sin((i * 0.2) + rotation) * width;
            if (i===0) ctx.moveTo(xPos, yPos); else ctx.lineTo(xPos, yPos);
        }
        ctx.stroke();
        ctx.beginPath();
        for(let i=0; i<=height; i+=2) {
            const yPos = i - (height/2);
            const xPos = Math.sin((i * 0.2) + rotation + Math.PI) * width;
            if (i===0) ctx.moveTo(xPos, yPos); else ctx.lineTo(xPos, yPos);
        }
        ctx.stroke();
    }
    ctx.restore();
};

export const drawBuilding = (ctx: CanvasRenderingContext2D, props: any, isDay: boolean, isOcean: boolean) => {
    const { x, y, type, w, h, color, windowData, windowW, windowH, acUnits, hasRedRoof, hasBalcony, trunkColor, drawFoundation, isHighVoltage } = props;
    
    ctx.save();
    ctx.translate(x, y);

    if (type === 'windmill') {
        drawWindmill(ctx, 0, 0, props.scale || 1.0, isDay, props.windmillType || 'classic');
    }
    else if (type && (type.startsWith('tree') || type === 'palm' || type === 'pine' || type === 'cactus')) {
        const isCactus = type === 'cactus';
        const isPalm = type === 'palm';
        const isTri = type === 'tree_tri' || type === 'pine';
        const isRound = type === 'tree_round';
        const isOval = type === 'tree_oval';
        
        if (isCactus) {
            ctx.fillStyle = '#166534';
            const stemW = Math.max(4, w * 0.5);
            if(ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-stemW/2, -h, stemW, h, stemW/2); ctx.fill(); } else { ctx.fillRect(-stemW/2, -h, stemW, h); }
            ctx.beginPath(); ctx.moveTo(-stemW/2, -h*0.4); ctx.quadraticCurveTo(-stemW*3, -h*0.4, -stemW*3, -h*0.7); ctx.lineTo(-stemW*3 + stemW, -h*0.7); ctx.quadraticCurveTo(-stemW*3 + stemW, -h*0.5, -stemW/2, -h*0.3); ctx.fill();
            ctx.beginPath(); ctx.moveTo(stemW/2, -h*0.6); ctx.quadraticCurveTo(stemW*3, -h*0.6, stemW*3, -h*0.8); ctx.lineTo(stemW*3 - stemW, -h*0.8); ctx.quadraticCurveTo(stemW*3 - stemW, -h*0.65, stemW/2, -h*0.5); ctx.fill();
        } else if (isTri) {
            ctx.fillStyle = trunkColor || '#451a03'; const trunkW = Math.max(2, w * 0.4); ctx.fillRect(-trunkW/2, 0, trunkW, -h*0.2); 
            ctx.fillStyle = color || '#166534'; const topY = -h; const bottomY = -h*0.2; const halfBase = w; const r = 3; 
            ctx.beginPath(); ctx.moveTo(0, topY + r); ctx.quadraticCurveTo(0, topY, r, topY + r*2); ctx.lineTo(halfBase - r, bottomY - r); ctx.quadraticCurveTo(halfBase, bottomY, halfBase - r*2, bottomY); ctx.lineTo(-halfBase + r*2, bottomY); ctx.quadraticCurveTo(-halfBase, bottomY, -halfBase + r, bottomY - r); ctx.lineTo(-r, topY + r*2); ctx.quadraticCurveTo(0, topY, 0, topY + r); ctx.fill();
        } else if (isPalm) {
             ctx.strokeStyle = trunkColor || '#a16207'; ctx.lineWidth = Math.max(2, w * 0.3); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(w, -h*0.5, 0, -h); ctx.stroke();
             ctx.fillStyle = color || '#15803d'; for(let i=0; i<5; i++) { ctx.beginPath(); const angle = (i * Math.PI*2/5) - Math.PI/2; const lx = Math.cos(angle) * w * 2; const ly = Math.sin(angle) * w; ctx.ellipse(0 + lx/2, -h + ly/2, w*1.5, w/2, angle, 0, Math.PI*2); ctx.fill(); }
        } else if (isOval) {
            ctx.fillStyle = trunkColor || '#451a03'; const trunkW = Math.max(2, w * 0.3); ctx.fillRect(-trunkW/2, 0, trunkW, -h*0.4);
            ctx.fillStyle = color || '#16a34a'; ctx.beginPath(); ctx.ellipse(0, -h*0.65, w, h*0.45, 0, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = trunkColor || '#451a03'; const trunkW = Math.max(2, w * 0.4); ctx.fillRect(-trunkW/2, 0, trunkW, -h*0.4);
            ctx.fillStyle = color || '#16a34a'; ctx.beginPath(); ctx.arc(0, -h*0.6, w, 0, Math.PI*2); ctx.fill();
        }
    } else if (type === 'building_std') {
        if (drawFoundation) { ctx.fillStyle = '#334155'; ctx.fillRect(-w/2 - 2, 0, w + 4, 6); }
        ctx.fillStyle = color || '#475569'; ctx.fillRect(-w/2, -h, w, h);
        if (windowData) {
            ctx.fillStyle = isDay ? '#0ea5e9' : '#facc15';
            windowData.forEach((wd: any) => { const wx = -w/2 + wd.x; const wy = -h + wd.y; if (isDay || wd.isLit) { ctx.fillRect(wx, wy, windowW || 3, windowH || 5); } else { ctx.fillStyle = '#1e293b'; ctx.fillRect(wx, wy, windowW || 3, windowH || 5); ctx.fillStyle = isDay ? '#0ea5e9' : '#facc15'; } });
        }
        if (acUnits) { ctx.fillStyle = '#94a3b8'; acUnits.forEach((ac: any) => { ctx.fillRect(-w/2 + ac.x, -h - ac.h, ac.w, ac.h); }); }
        if (hasRedRoof) { ctx.fillStyle = '#991b1b'; ctx.beginPath(); ctx.moveTo(-w/2 - 2, -h); ctx.lineTo(0, -h - 10); ctx.lineTo(w/2 + 2, -h); ctx.fill(); }
        if (hasBalcony) { ctx.fillStyle = '#334155'; ctx.fillRect(-w/2 - 2, -h/2, w + 4, 4); }
    } else if (type === 'power_pole') {
        const ph = h || 100; ctx.strokeStyle = '#52525b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -ph); const cw = isHighVoltage ? 30 : 20; ctx.moveTo(-cw/2, -ph + 10); ctx.lineTo(cw/2, -ph + 10); ctx.stroke();
    } else if (type === 'hangar') {
        const hw = w || 60; const hh = h || 30; ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.ellipse(0, 0, hw/2, hh, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.ellipse(0, 0, hw/3, hh*0.8, 0, Math.PI, 0); ctx.fill();
    }
    ctx.restore();
};

export const drawDome = (ctx: CanvasRenderingContext2D, x: number, y: number, f: any, isOcean: boolean) => {
    const scale = f.scale || 1.0;
    const r = 80; 
    const time = Date.now();
    const slowTime = Math.floor(time / 10000); 
    
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale); 

    ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.moveTo(-r - 5, 0); ctx.lineTo(r + 5, 0); ctx.lineTo(r + 10, 40); ctx.lineTo(-r - 10, 40); ctx.fill();
    ctx.fillStyle = '#475569'; ctx.fillRect(-r - 5, -5, (r * 2) + 10, 10);

    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r - 2, Math.PI, 0); ctx.clip();
    const bgGrad = ctx.createLinearGradient(0, -r, 0, 0);
    bgGrad.addColorStop(0, 'rgba(148, 163, 184, 0.2)'); bgGrad.addColorStop(1, 'rgba(30, 41, 59, 0.6)'); ctx.fillStyle = bgGrad; ctx.fill();

    if (f.contents) {
        f.contents.forEach((c: any, cIdx: number) => {
            if (c.type === 'dome_building') {
                ctx.fillStyle = c.color || '#94a3b8'; 
                const safeR = r - 8; const bLeft = c.x - c.w/2; const bRight = c.x + c.w/2; let limitY_L = -10; let limitY_R = -10;
                if (Math.abs(bLeft) < safeR) { limitY_L = -Math.sqrt(Math.pow(safeR, 2) - Math.pow(bLeft, 2)); }
                if (Math.abs(bRight) < safeR) { limitY_R = -Math.sqrt(Math.pow(safeR, 2) - Math.pow(bRight, 2)); }
                const targetH = -c.h; const yL = Math.max(targetH, limitY_L); const yR = Math.max(targetH, limitY_R);
                ctx.beginPath(); ctx.moveTo(bLeft, 0); ctx.lineTo(bRight, 0); ctx.lineTo(bRight, yR); ctx.lineTo(bLeft, yL); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#fef08a'; 
                const winRows = Math.floor(c.h / 6); const winCols = Math.floor(c.w / 5); const winW = scale > 1.2 ? 3 : 2; const winH = scale > 1.2 ? 4 : 3;
                const slope = (yR - yL) / (bRight - bLeft); const k = yL - (slope * bLeft);
                for(let i=0; i<winRows; i++) { 
                    for(let j=0; j<winCols; j++) { 
                        const wx = bLeft + 2 + (j*5); const wy = -c.h + 2 + (i*6); const cutY = (slope * wx) + k;
                        if (wy > cutY + 2) { 
                            const seed = (cIdx * 100) + (i * 10) + j + slowTime; const pseudoRand = Math.abs(Math.sin(seed * 12.9898)); 
                            if (pseudoRand > 0.4) { ctx.fillRect(wx, wy, winW, winH); } 
                        }
                    } 
                }
            } else if (c.type === 'tree') { drawBuilding(ctx, { x: c.x, y: 0, type: 'tree_round', w: c.w, h: c.h, color: '#16a34a', trunkColor: '#78350f' }, true, false); } 
            else if (c.type === 'bush') { ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.arc(c.x, 0, c.w, Math.PI, 0); ctx.fill(); if(c.flowers) { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(c.x-2, -2, 1.5, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(c.x+2, -3, 1.5, 0, Math.PI*2); ctx.fill(); } } 
            else if (c.type === 'flower') { ctx.fillStyle = cIdx % 2 === 0 ? '#ef4444' : '#facc15'; ctx.beginPath(); ctx.arc(c.x, -2, 1.5, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#166534'; ctx.fillRect(c.x-0.5, -2, 1, 2); } 
            else if (c.type === 'bird') { drawBird(ctx, c.x + Math.sin(time * 0.002 + cIdx) * 10, c.y + Math.cos(time * 0.003 + cIdx) * 3, 2, Math.sin(time*0.02 + cIdx)); } 
            else if (c.type === 'butterfly') { const bx = c.x + Math.sin(time * 0.005 + cIdx) * 15; const by = c.y - Math.abs(Math.sin(time * 0.01)) * 10; ctx.fillStyle = cIdx % 2 === 0 ? '#3b82f6' : '#d946ef'; ctx.beginPath(); ctx.arc(bx, by, 1.5, 0, Math.PI*2); ctx.fill(); }
        });
    }
    ctx.restore();

    const glass = ctx.createRadialGradient(-r*0.3, -r*0.5, 5, 0, 0, r); glass.addColorStop(0, 'rgba(255,255,255,0.4)'); glass.addColorStop(0.2, 'rgba(255,255,255,0.1)'); glass.addColorStop(1, 'rgba(255,255,255,0.0)'); ctx.fillStyle = glass; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.stroke();
    
    ctx.restore();
};

export const drawPowerPlant = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1.0, isUnderground: boolean = false) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (isUnderground) {
        ctx.fillStyle = '#27272a'; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-30, -15); ctx.lineTo(30, -15); ctx.lineTo(40, 0); ctx.fill();
        ctx.fillStyle = '#18181b'; ctx.fillRect(-15, -15, 30, 15); ctx.fillStyle = '#ef4444'; ctx.fillRect(-10, -18, 20, 3);
        ctx.fillStyle = '#475569'; ctx.fillRect(50, -30, 40, 30);
        ctx.fillStyle = '#64748b'; for(let k=0; k<3; k++) ctx.fillRect(55 + (k*10), -35, 6, 5);
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(70, -35); ctx.lineTo(70, -60); ctx.stroke();
        ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.arc(70, -40, 3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(70, -50, 3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(70, -60, 3, 0, Math.PI*2); ctx.fill();
    } else {
        ctx.fillStyle = '#3f3f46'; ctx.fillRect(-60, -30, 30, 30); 
        ctx.fillStyle = '#52525b'; for(let i=0; i<3; i++) ctx.fillRect(-58 + (i*8), -30, 4, 30);
        ctx.beginPath(); ctx.arc(-10, 0, 20, Math.PI, 0); ctx.fillStyle = '#94a3b8'; ctx.fill();
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.stroke();
        const tx = 40; ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.moveTo(tx - 15, 0); ctx.quadraticCurveTo(tx - 5, -40, tx - 20, -80); ctx.lineTo(tx + 20, -80); ctx.quadraticCurveTo(tx + 5, -40, tx + 15, 0); ctx.fill();
    }
    ctx.restore();
};

export const drawResort = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1.0, isDay: boolean, foundationHeight: number = 0, seed: number = 0) => {
    ctx.save();
    ctx.translate(x, y);
    const distScale = scale * 0.8; ctx.scale(distScale, distScale);
    
    if (foundationHeight > 0) {
        ctx.fillStyle = '#64748b'; ctx.fillRect(-32, 0, 64, foundationHeight);
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 1; ctx.beginPath();
        for(let fy = 0; fy <= foundationHeight; fy += 4) { ctx.moveTo(-32, fy); ctx.lineTo(32, fy); }
        for(let fx = -32; fx <= 32; fx += 8) { ctx.moveTo(fx, 0); ctx.lineTo(fx, foundationHeight); }
        ctx.stroke();
    }

    ctx.fillStyle = '#e2e8f0'; ctx.fillRect(-30, -40, 60, 40);
    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-45, -30, 15, 30); ctx.fillRect(30, -30, 15, 30);
    ctx.fillStyle = '#991b1b'; ctx.beginPath(); ctx.moveTo(-32, -40); ctx.lineTo(0, -55); ctx.lineTo(32, -40); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-47, -30); ctx.lineTo(-37, -38); ctx.lineTo(-28, -30); ctx.fill();
    ctx.beginPath(); ctx.moveTo(28, -30); ctx.lineTo(37, -38); ctx.lineTo(47, -30); ctx.fill();

    const pseudoRandom = (input: number) => {
        const x = Math.sin(input) * 10000;
        return x - Math.floor(x);
    };

    ctx.fillStyle = isDay ? '#38bdf8' : '#facc15';
    for(let r=0; r<4; r++) { for(let c=0; c<5; c++) { 
        const lightSeed = seed + (r * 10) + c;
        const isLit = isDay ? true : pseudoRandom(lightSeed) > 0.4; 
        ctx.fillStyle = isLit ? (isDay ? '#38bdf8' : '#facc15') : '#1e293b'; ctx.fillRect(-25 + (c*11), -35 + (r*9), 4, 5); 
    } }
    for(let r=0; r<3; r++) { 
        const lightSeedL = seed + 100 + (r * 10);
        const lightSeedR = seed + 200 + (r * 10);
        const isLitL = isDay ? true : pseudoRandom(lightSeedL) > 0.4; 
        const isLitR = isDay ? true : pseudoRandom(lightSeedR) > 0.4; 
        ctx.fillStyle = isLitL ? (isDay ? '#38bdf8' : '#facc15') : '#1e293b'; ctx.fillRect(-40, -25 + (r*9), 4, 5); 
        ctx.fillStyle = isLitR ? (isDay ? '#38bdf8' : '#facc15') : '#1e293b'; ctx.fillRect(35, -25 + (r*9), 4, 5); 
    }

    ctx.fillStyle = '#475569'; ctx.fillRect(-45, 0, 90, 5);
    const drawSimplePine = (tx: number, th: number) => { 
        ctx.fillStyle = '#166534'; ctx.beginPath(); ctx.moveTo(tx, 5 - th); ctx.quadraticCurveTo(tx+2, 5-th+2, tx + 4, 5); ctx.lineTo(tx - 4, 5); ctx.quadraticCurveTo(tx-2, 5-th+2, tx, 5 - th); ctx.fill(); 
    };
    drawSimplePine(-35, 15); drawSimplePine(-20, 12); drawSimplePine(20, 14); drawSimplePine(35, 16);
    ctx.restore();
};

export const drawMining = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1.0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const yOff = 25;
    ctx.fillStyle = '#44403c'; ctx.beginPath(); ctx.arc(0, yOff, 14, Math.PI, 0); ctx.lineTo(14, yOff + 10); ctx.lineTo(-14, yOff + 10); ctx.fill();
    ctx.fillStyle = '#09090b'; ctx.beginPath(); ctx.arc(0, yOff, 10, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#57534e'; ctx.beginPath(); ctx.moveTo(-12, yOff); ctx.lineTo(-18, yOff + 30); ctx.lineTo(18, yOff + 30); ctx.lineTo(12, yOff); ctx.fill();
    ctx.strokeStyle = '#27272a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, yOff); ctx.lineTo(-9, yOff + 30); ctx.moveTo(6, yOff); ctx.lineTo(9, yOff + 30); ctx.stroke();
    ctx.fillStyle = '#f59e0b'; ctx.fillRect(-7, yOff + 10, 14, 10); ctx.fillStyle = '#292524'; ctx.beginPath(); ctx.arc(0, yOff + 10, 5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-6, yOff + 20, 2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(6, yOff + 20, 2, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, yOff); ctx.lineTo(20, yOff - 30); ctx.lineTo(5, yOff - 15); ctx.stroke();
    ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 5; ctx.beginPath(); ctx.arc(20, yOff - 30, 2, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.restore();
};

export const drawTower = (ctx: CanvasRenderingContext2D, x: number, y: number, f: any, isDay: boolean, isOcean: boolean, armPos: number, accPos: number, hullTargets?: number[]) => {
    const th = 180; const tw = 50; const tx = x; const strokeColor = '#334155';
    ctx.lineWidth = 4; ctx.strokeStyle = strokeColor;
    ctx.beginPath(); ctx.moveTo(tx, y); ctx.lineTo(tx, y-th); ctx.moveTo(tx+tw, y); ctx.lineTo(tx+tw, y-th); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#475569';
    ctx.beginPath(); const segH = 30;
    for(let k=0; k<th; k+=segH) { ctx.moveTo(tx, y-k); ctx.lineTo(tx+tw, y-k); if (k + segH <= th) { ctx.moveTo(tx, y-k); ctx.lineTo(tx+tw, y-k-segH); ctx.moveTo(tx+tw, y-k); ctx.lineTo(tx, y-k-segH); } }
    ctx.stroke(); ctx.fillStyle = 'rgba(30, 41, 59, 0.5)'; ctx.fillRect(tx, y-th, tw, th);
    const antH = 40; ctx.strokeStyle = '#64748b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx + tw/2, y - th); ctx.lineTo(tx + tw/2, y - th - antH); ctx.stroke();
    const blink = Math.floor(Date.now() / 500) % 2 === 0; ctx.fillStyle = blink ? '#ff4d4d' : '#991b1b'; ctx.shadowColor = blink ? '#ff0000' : 'transparent'; ctx.shadowBlur = blink ? 15 : 0; ctx.beginPath(); ctx.arc(tx + tw/2, y - th - antH, 4, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
    if (f.arms) {
        f.arms.forEach((armYOffset: number, index: number) => {
            const armY = y + armYOffset; const dir = x > 0 ? -1 : 1; const towerCenterX = tx + tw/2; const rigidArmLength = 120; const startProtrusion = 20; const maxExtension = 80; const currentProtrusion = startProtrusion + (maxExtension * armPos); const tipX = towerCenterX + (dir * currentProtrusion); const baseX = tipX - (dir * rigidArmLength); const trussHeight = 14; const topY = armY - trussHeight/2; const botY = armY + trussHeight/2;
            ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(baseX, topY); ctx.lineTo(tipX, topY); ctx.moveTo(baseX, botY); ctx.lineTo(tipX, botY); const step = 15; for(let i=0; i<rigidArmLength/step; i++) { const sx = baseX + (i * step * dir); const ex = baseX + ((i+1) * step * dir); ctx.moveTo(sx, topY); ctx.lineTo(ex, botY); ctx.moveTo(sx, botY); ctx.lineTo(ex, topY); } ctx.stroke();
            ctx.fillStyle = '#334155'; const capW = 6; ctx.fillRect(tipX - (dir===1?0:capW), topY - 1, capW, trussHeight + 2);
            let targetX = 0; if (hullTargets && hullTargets.length > index) { const halfWidth = hullTargets[index]; targetX = (dir === -1) ? halfWidth : -halfWidth; } else { targetX = (dir === -1) ? 30 : -30; }
            const distToHull = Math.abs(targetX - tipX); const compressedLen = 10; const currentAccLen = compressedLen + (distToHull - compressedLen) * accPos; const accEndX = tipX + (dir * currentAccLen);
            const segCount = 8; const segW = currentAccLen / segCount;
            for(let i=0; i<segCount; i++) { const sx = tipX + (i * segW * dir); ctx.fillStyle = i % 2 === 0 ? '#1f2937' : '#0f172a'; const rx = dir === 1 ? sx : sx - segW; ctx.fillRect(rx, topY + 2, segW, trussHeight - 4); ctx.fillStyle = '#000'; const ribX = dir === 1 ? sx + segW : sx; ctx.fillRect(ribX, topY + 2, 1, trussHeight - 4); }
            ctx.strokeStyle = '#374151'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tipX, topY + 2); ctx.lineTo(accEndX, topY + 2); ctx.moveTo(tipX, botY - 2); ctx.lineTo(accEndX, botY - 2); ctx.stroke();
            if (accPos > 0.1) { ctx.fillStyle = accPos > 0.95 ? '#10b981' : '#475569'; const plateW = 4; const px = accEndX - (dir===1?0:plateW); ctx.fillRect(px, armY - 12, plateW, 24); if (accPos > 0.95) { ctx.fillStyle = 'rgba(16, 185, 129, 0.5)'; const sealW = 6; const sx = dir === 1 ? accEndX : accEndX - sealW; ctx.fillRect(sx, armY - 14, sealW, 28); } }
        });
    }
};

const generateDomeContents = (rng: () => number) => {
    const contents: any[] = [];
    const r = 70; 
    const bCount = 2 + Math.floor(rng() * 3);
    for(let i=0; i<bCount; i++) {
        contents.push({ type: 'dome_building', x: (rng() - 0.5) * r * 1.5, w: 15 + rng() * 15, h: 20 + rng() * 30, color: rng() > 0.5 ? '#cbd5e1' : '#94a3b8' });
    }
    const vCount = 3 + Math.floor(rng() * 5);
    for(let i=0; i<vCount; i++) {
        const type = rng() > 0.6 ? 'tree' : (rng() > 0.3 ? 'bush' : 'flower');
        contents.push({ type, x: (rng() - 0.5) * r * 1.8, w: 3 + rng() * 3, h: 10 + rng() * 10, flowers: rng() > 0.5 });
    }
    if (rng() > 0.3) {
        const lCount = 1 + Math.floor(rng() * 3);
        for(let i=0; i<lCount; i++) {
            contents.push({ type: rng() > 0.5 ? 'bird' : 'butterfly', x: (rng() - 0.5) * r, y: -10 - (rng() * 30) });
        }
    }
    return contents;
};

export const generatePlanetEnvironment = (planet: Planet) => {
    const rng = createSeededRandom(planet.id);
    const col = planet.color.toLowerCase();

    const isReddish = ['#ef4444', '#f97316', '#d97706', '#fbbf24', '#7c2d12', '#78350f', '#991b1b', '#b91c1c'].includes(col);
    const isBluish = ['#3b82f6', '#0ea5e9', '#06b6d4', '#60a5fa', '#1e3a8a', '#1e40af', '#172554'].includes(col);
    const isGreenish = ['#10b981', '#064e3b', '#15803d', '#22c55e', '#84cc16', '#065f46', '#a3e635'].includes(col);
    const isPurple = ['#a855f7', '#d8b4fe', '#7e22ce', '#6b21a8'].includes(col);
    const isWhite = ['#ffffff', '#e2e8f0', '#cbd5e1'].includes(col);

    const isDay = rng() > 0.5; 
    const isOcean = isBluish && rng() > 0.3; 
    const isBarren = isReddish || ['#d97706', '#a16207', '#78350f'].includes(col) || isPurple; 
    const isLush = isGreenish || (isBluish && !isOcean && !isBarren && !isWhite); 
    
    const hasTrains = rng() > 0.4;
    const hasDomes = isBarren || rng() > 0.7;
    const hasWindmills = isLush && rng() > 0.3;
    const hasHangars = (isBarren || isLush) && rng() > 0.6;

    const isRainy = isLush && rng() > 0.7; 
    const isStormy = isRainy && rng() > 0.5; 
    const hasBirds = isLush && !isRainy && rng() > 0.2; 

    let skyGradient = ['#000000', '#000000'];
    let cloudColors = ['#ffffff']; 
    let sunColor = '#facc15';
    let atmosphereColor = '#000000';

    if (isReddish) { 
        if (isDay) skyGradient = ['#7f1d1d', '#ef4444']; else skyGradient = ['#1a0505', '#450a0a']; 
        sunColor = '#fb923c'; atmosphereColor = '#7f1d1d'; 
    } else if (isBluish) { 
        if (isDay) skyGradient = ['#2563eb', '#bfdbfe']; else skyGradient = ['#020617', '#172554']; 
        sunColor = '#ffffff'; atmosphereColor = '#1e3a8a'; 
    } else if (isGreenish) { 
        if (isDay) skyGradient = ['#0ea5e9', '#e0f2fe']; else skyGradient = ['#020617', '#0f172a']; 
        sunColor = '#fef08a'; atmosphereColor = '#064e3b'; 
    } else if (isPurple) { 
        if (isDay) skyGradient = ['#2e1065', '#a855f7']; else skyGradient = ['#0f0518', '#3b0764']; 
        sunColor = '#f3e8ff'; atmosphereColor = '#581c87'; 
    } else { 
        if (isDay) skyGradient = ['#3f3f46', '#a1a1aa']; else skyGradient = ['#09090b', '#27272a']; 
        atmosphereColor = '#27272a'; 
    }

    if (isLush || isOcean || isBluish || isGreenish) { cloudColors = ['#ffffff', '#e5e7eb', '#d1d5db', '#9ca3af']; } 
    else if (isReddish || (isBarren && !isPurple)) { cloudColors = ['#fde047', '#fdba74', '#fbbf24', '#f87171']; } 
    else if (isPurple) { cloudColors = ['#f0abfc', '#86efac', '#d8b4fe', '#bef264']; } 
    else if (isWhite) { cloudColors = ['#e0f2fe', '#ffffff']; }

    if (isRainy) { skyGradient[0] = mixColor(skyGradient[0], '#1f2937', 0.6); cloudColors = ['#6b7280', '#4b5563', '#9ca3af']; sunColor = '#9ca3af'; }

    let groundColor = planet.color; 
    let hillColors: string[] = [];

    if (isGreenish) { hillColors = ['#475569', '#334155', '#14532d', '#15803d', '#16a34a', '#22c55e']; groundColor = '#15803d'; } 
    else if (isReddish) { hillColors = ['#450a0a', '#7f1d1d', '#991b1b', '#c2410c', '#ea580c', '#d97706']; } 
    else if (isWhite) { hillColors = ['#164e63', '#155e75', '#0891b2', '#06b6d4', '#22d3ee', '#67e8f9']; groundColor = '#cffafe'; } 
    else if (isPurple) { hillColors = ['#1e1b4b', '#312e81', '#4c1d95', '#6d28d9', '#7c3aed', '#a855f7']; } 
    else if (isBluish) { if (isOcean) { hillColors = ['#020617', '#0f172a', '#172554', '#1e3a8a', '#1e40af', '#2563eb']; } else { hillColors = ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8']; } } 
    else { hillColors = ['#271c19', '#451a03', '#78350f', '#92400e', '#b45309', '#d97706']; groundColor = '#78350f'; }

    if (!isOcean) { hillColors[0] = mixColor(hillColors[0], atmosphereColor, 0.6); hillColors[1] = mixColor(hillColors[1], atmosphereColor, 0.4); }

    const stars = Array.from({ length: isDay ? 60 : 250 }).map(() => ({ x: rng(), y: rng(), size: rng() * 0.8 + 0.2, alpha: isDay ? 0.4 : (rng() * 0.5 + 0.5) }));
    
    const clouds: any[] = [];
    const windDir = rng() > 0.5 ? 1 : -1;
    const layerScales = [0.5, 0.8, 1.2]; 
    const layerAlphas = [0.8, 0.6, 0.4];
    const layerParallax = [-0.1, 0.05, 0.2]; 
    const minAltitude = 0; const maxAltitude = 4000;

    for (let l = 0; l < 3; l++) {
        const scale = layerScales[l]; const parallax = layerParallax[l]; const speed = 0.02 + (l * 0.02); const count = 6 + Math.floor(rng() * 4); 
        for (let c = 0; c < count; c++) {
             const color = cloudColors[Math.floor(rng() * cloudColors.length)]; const baseAlpha = layerAlphas[l];
             const puffs = []; const baseW = 200 + rng() * 150; const puffCount = 6 + Math.floor(rng() * 6);
             for(let p=0; p<puffCount; p++) { const px = (rng() - 0.5) * baseW * scale; const py = (rng() - 0.5) * (baseW * 0.4) * scale; const pr = (30 + rng() * 40) * scale; const pa = 0.4 + rng() * 0.4; puffs.push({x: px, y: py, r: pr, a: pa}); }
             clouds.push({ x: (rng() * 4000) - 2000, altitude: minAltitude + (rng() * (maxAltitude - minAltitude)), w: baseW * scale, baseAlpha: baseAlpha, speed: speed, direction: windDir, layer: l, color: color, id: c, parallaxFactor: parallax, puffs: puffs });
        }
    }

    const hills = []; const trains: any[] = []; let domeCount = 0; const forceDome = isBarren; let domePlaced = false;
    
    for(let i=0; i<(isOcean?0:6); i++) {
        const points = []; const isMountain = i < 2; const segments = isMountain ? 24 : 16; const hasRoad = i === 4; const hasTrainTrack = i === 3 && hasTrains;
        for(let j=0; j<=segments; j++) {
            let minH = isMountain ? 0.4 : 0.15; let maxH = isMountain ? 0.8 : 0.45;
            if (!isMountain && i >= 3 && rng() > 0.6) minH = 0.02; 
            const yVar = rng(); points.push({ xRatio: j/segments, heightRatio: minH + (yVar * (maxH - minH)) });
        }
        if (!isMountain) { for (let k = 0; k < 2; k++) { for (let j = 1; j < points.length - 1; j++) { points[j].heightRatio = (points[j-1].heightRatio + points[j].heightRatio + points[j+1].heightRatio) / 3; } } }

        const trees: any[] = []; const snowCaps: any[] = []; const cityBuildings: any[] = []; const roadBuildingsBack: any[] = []; const roadBuildingsFront: any[] = []; const nearbyBuildings: any[] = [];
        
        if (isMountain && rng() < 0.7) { 
            const numFeatures = 2 + Math.floor(rng() * 2);
            for(let k=0; k<numFeatures; k++) {
                const idx = Math.floor(rng() * (segments - 2)) + 1; const p = points[idx]; const pNext = points[idx+1];
                if (p.heightRatio > 0.4) {
                    if (isLush) {
                        trees.push({ segIdx: idx, offset: 0.5, w: 0, h: 0, type: 'resort', scale: 0.7 + rng()*0.5 });
                        const treeType = 'tree_tri'; trees.push({ segIdx: idx, offset: 0.4, w: 4, h: 10, type: treeType, color: '#166534' }); trees.push({ segIdx: idx, offset: 0.6, w: 4, h: 12, type: treeType, color: '#166534' });
                    } else if (isBarren) { trees.push({ segIdx: idx, offset: 0.5, w: 0, h: 0, type: 'mining', scale: 0.8 + rng()*0.4 }); }
                }
                if (hasWindmills && !isMountain && i > 2) { const slope = Math.abs(p.heightRatio - pNext.heightRatio); if (slope > 0.05 && rng() > 0.6) { trees.push({ segIdx: idx, offset: 0.5, w: 0, h: 0, type: 'windmill', scale: 0.8 + rng()*0.4, windmillType: rng() > 0.5 ? 'classic' : 'helical' }); } }
            }
        }

        if (isLush || isBarren) {
            for(let j=0; j<segments; j++) {
                const densityChance = isLush ? 0.4 : 0.1;
                if (rng() < densityChance) {
                    const clusterSize = 2 + Math.floor(rng() * 3);
                    for(let k=0; k<clusterSize; k++) {
                        let treeType = 'tree_round'; 
                        if (isLush) { if (isMountain) treeType = 'tree_tri'; else { treeType = rng() > 0.5 ? 'tree_round' : 'tree_oval'; } if (isWhite) treeType = 'pine'; } else if (isBarren) { treeType = rng() > 0.6 ? 'cactus' : 'palm'; }
                        trees.push({ segIdx: j, offset: rng(), w: 4 + rng() * 4, h: 10 + rng() * 20, color: isLush ? '#166534' : '#15803d', trunkColor: '#78350f', type: treeType });
                    }
                }
            }
        }

        if (isMountain && (isBluish || isWhite)) { for(let j=1; j<points.length-1; j++) { if (points[j].heightRatio > 0.6) { snowCaps.push({ idx: j, h: points[j].heightRatio }); } } }

        if (hasRoad) {
            const cityStart = 0.2 + (rng() * 0.1); const density = 20; 
            for(let k=0; k<density; k++) {
                if (rng() > 0.4) {
                    const xRatio = cityStart + (k/density * 0.6) + (rng() * 0.02); const segIdx = Math.floor(xRatio * segments); const p1 = points[segIdx] || points[points.length-1]; const p2 = points[segIdx+1] || p1; const sub = (xRatio * segments) - segIdx; const yBase = p1.heightRatio + (p2.heightRatio - p1.heightRatio) * sub;
                    if (hasDomes && (domeCount < 3 && (rng() > 0.8 || (forceDome && !domePlaced && k > 15)))) { domeCount++; domePlaced = true; const domeContents = generateDomeContents(rng); roadBuildingsBack.push({ xRatio, yBase, yOffset: 2, type: 'dome_std', scale: 0.7 + rng() * 0.3, contents: domeContents }); } 
                    else if (isLush) { const w = 15 + rng() * 15; const h = 30 + rng() * 30; const winData = []; const rows = Math.floor(h/8); const cols = Math.floor(w/6); for(let r=0; r<rows; r++) { for(let c=0; c<cols; c++) { if(rng()>0.3) winData.push({x: 2 + c*5, y: 4 + r*7, isLit: rng()>0.5}); } } roadBuildingsBack.push({ xRatio, yBase, yOffset: -2, w, h, color: '#475569', type: 'building_std', drawFoundation: true, windowData: winData, windowW: 3, windowH: 5 }); } 
                    else if (hasHangars && rng() > 0.9) { roadBuildingsBack.push({ xRatio, yBase, yOffset: 0, type: 'hangar', w: 50, h: 25 }); }
                }
            }
            for(let k=0; k<15; k++) {
                if (rng() > 0.3) { 
                    const xRatio = cityStart + (k/15 * 0.6); const segIdx = Math.floor(xRatio * segments); const p1 = points[segIdx] || points[points.length-1]; const p2 = points[segIdx+1] || p1; const sub = (xRatio * segments) - segIdx; const yBase = p1.heightRatio + (p2.heightRatio - p1.heightRatio) * sub;
                    if (hasDomes && (domeCount < 3 && rng() > 0.8)) { domeCount++; const domeContents = generateDomeContents(rng); roadBuildingsFront.push({ xRatio, yBase, yOffset: 15, type: 'dome_std', scale: 1.0 + rng() * 0.4, contents: domeContents }); } 
                    else if (isLush) { const w = 30 + rng() * 20; const h = 50 + rng() * 30; const winData = []; const rows = Math.floor(h/10); const cols = Math.floor(w/8); for(let r=0; r<rows; r++) { for(let c=0; c<cols; c++) { if(rng()>0.3) winData.push({x: 4 + c*7, y: 6 + r*9, isLit: rng()>0.5}); } } roadBuildingsFront.push({ xRatio, yBase, yOffset: 15, w, h, color: '#64748b', type: 'building_std', windowData: winData, windowW: 4, windowH: 6, acUnits: rng()>0.5 ? [{x: 5, w: 8, h: 4}] : [] }); } 
                    else if (hasHangars && rng() > 0.85) { roadBuildingsFront.push({ xRatio, yBase, yOffset: 10, type: 'hangar', w: 80, h: 40 }); }
                }
            }
        }

        if (hasTrainTrack) { trains.push({ layer: i, progress: rng(), speed: 0.0005 + (rng() * 0.0005), cars: 4 + Math.floor(rng() * 3), color: '#ef4444', dir: rng() > 0.5 ? 1 : -1 }); }
        hills.push({ layer: i, type: isMountain ? 'mountain' : 'hill', color: hillColors[i], points, trees, snowCaps, roadBuildingsBack, roadBuildingsFront, nearbyBuildings, cityBuildings, hasRoad, hasTrainTrack, parallaxFactor: 0.1 + (i * 0.15) });
    }

    if (forceDome && !domePlaced) { const domeContents = generateDomeContents(rng); hills[4].nearbyBuildings.push({ xRatio: 0.5, yBase: 0.2, yOffset: 10, type: 'dome_std', scale: 1.5, contents: domeContents }); }

    const features: any[] = []; const powerLines: any[] = [];
    const towerX = (rng()>0.5?1:-1) * 180; features.push({ x: towerX, type: 'tower', h: 160, w: 42, color: '#e2e8f0', yOff: 0, arms: [-130, -50] });
    if (hasDomes && !isOcean && rng() > 0.5) { const domeX = -towerX * 0.8; const domeContents = generateDomeContents(rng); features.push({ x: domeX, yOff: 20, type: 'dome_std', scale: 2.5, contents: domeContents, isForeground: true }); }
    if (isOcean) { for(let i=0; i<3; i++) { const domeContents = generateDomeContents(rng); const isNearCenter = i === 0 || i === 1; features.push({ x: (i%2===0?1:-1)*(400 + i*250), type: 'dome_std', scale: 1.3, contents: domeContents, isForeground: isNearCenter }); } } 
    else {
        const plantX = -towerX * 1.5; features.push({ x: plantX, type: 'power_plant', scale: 1.0, isUnderground: !isGreenish });
        const poleX = plantX + (plantX>0?80:-80); features.push({ x: poleX, type: 'power_pole', h: 140, isHighVoltage: true });
        const chain = []; const dist = Math.abs(poleX - towerX); const steps = Math.floor(dist/200); for(let k=0; k<=steps; k++) { const tx = towerX + (k * (poleX-towerX)/steps); if (k > 0 && k < steps) features.push({ x: tx, type: 'power_pole', h: 100 }); chain.push({ x: tx, yOff: 0, h: k===0 || k===steps ? 120 : 100 }); } powerLines.push(chain);
    }

    const cars: any[] = []; if (hills[4]?.hasRoad) { for(let i=0; i<5; i++) cars.push({ type: 'car', progress: rng(), speed: 0.0003, color: '#ef4444', dir: rng()>0.5?1:-1 }); }
    const wanderers: {x: number, y: number, size: number, color: string}[] = []; if (!isDay && rng() > 0.5) { const wCount = 1 + Math.floor(rng() * 2); for(let i=0; i<wCount; i++) { wanderers.push({ x: rng(), y: rng() * 0.4, size: 1 + rng() * 2, color: '#94a3b8' }); } }
    const streetLights: {x: number, h: number}[] = []; if (hills[4]?.hasRoad) { for(let k=0; k<15; k++) { streetLights.push({ x: -1400 + (k * 200) + (rng() * 20), h: 25 }); } }

    return { isDay, isOcean, isReddish, isBluish, isGreenish, isBarren, isLush, sunColor, skyGradient, cloudColor: cloudColors[0], cloudColors, hillColors, stars, clouds, hills, features, cars, trains, groundColor, powerLines, quadrant: planet.quadrant, weather: { isRainy, isStormy }, hasBirds, wanderers, streetLights };
};
