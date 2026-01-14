
import { ExtendedShipConfig } from '../constants';

export const getEngineCoordinates = (config: ExtendedShipConfig) => {
    const { engines, wingStyle, isAlien } = config;
    const engW = isAlien ? 10 : 10;
    const engH = isAlien ? 14 : 12;
    const locs: {x:number, y:number, w:number, h:number}[] = [];

    // Logic matches ShipIcon drawing scale (0-100 coordinate space)
    if (engines === 1) {
        if (wingStyle === 'pincer') locs.push({x:50, y:78, w:engW, h:engH});
        else locs.push({x:50, y:75, w:14, h:12});
    } else if (engines === 2) {
        if (wingStyle === 'x-wing') { locs.push({x:25, y:78, w:10, h:12}, {x:75, y:78, w:10, h:12}); }
        else if (wingStyle === 'alien-h') { locs.push({x:25, y:75, w:engW, h:engH}, {x:75, y:75, w:engW, h:engH}); }
        else if (wingStyle === 'alien-a') { locs.push({x:20, y:75, w:engW, h:engH}, {x:80, y:75, w:engW, h:engH}); }
        else if (wingStyle === 'alien-w') { locs.push({x:35, y:75, w:engW, h:engH}, {x:65, y:75, w:engW, h:engH}); }
        else if (wingStyle === 'alien-m') { locs.push({x:20, y:75, w:engW, h:engH}, {x:80, y:75, w:engW, h:engH}); }
        else { locs.push({x:25, y:70, w:12, h:12}, {x:75, y:70, w:12, h:12}); }
    } else if (engines === 3) {
        if (wingStyle === 'cylon') { locs.push({x:50, y:80, w:16, h:14}, {x:25, y:72, w:10, h:12}, {x:75, y:72, w:10, h:12}); }
        else if (wingStyle === 'pincer') { locs.push({x:20, y:70, w:12, h:12}, {x:80, y:70, w:12, h:12}, {x:42, y:75, w:16, h:15}); }
        else { locs.push({x:20, y:70, w:12, h:12}, {x:50, y:75, w:14, h:12}, {x:80, y:70, w:12, h:12}); }
    } else if (engines === 4) {
        locs.push({x:35, y:75, w:10, h:12}, {x:65, y:75, w:10, h:12}, {x:15, y:65, w:10, h:12}, {x:85, y:65, w:10, h:12});
    } else {
        locs.push({x:15, y:70, w:10, h:12}, {x:35, y:70, w:10, h:12}, {x:65, y:70, w:10, h:12}, {x:85, y:70, w:10, h:12});
    }
    return locs;
};

// Helper to calculate wing mount positions based on ship style
// Coordinates calculated to place the gun "neck" on the leading edge.
// Positions are calculated as the midpoint between the fuselage edge and the wing tip.
// Body draws down (on wing), Barrel draws up (in space).
export const getWingMounts = (config: ExtendedShipConfig) => {
    const { wingStyle } = config;
    let lx = 25, ly = 40; 

    switch (wingStyle) {
        case 'delta': 
            // Vanguard: Hull Edge ~27. Tip 10. Mid ~19.
            // Y on line (50,25)->(10,80).
            lx = 19; ly = 67; 
            break;
        case 'x-wing': 
            // Ranger: Hull Edge 30. Tip 5. Mid 17.5.
            // Y on line (50,48)->(5,10).
            lx = 18; ly = 21; 
            break;
        case 'pincer': 
            // Eclipse: Hull Edge 30. Tip 5. Mid 17.5.
            // Y on ellipse top (50,60) radii 45,25.
            lx = 18; ly = 42; 
            break;
        case 'curved': 
            // Striker (Heavy Fighter): Hull Edge 30 (finger width 20). Tip 10. Mid 20.
            // Y on line (50,45)->(10,50).
            lx = 20; ly = 49; 
            break;
        case 'cylon': 
            // Behemoth: Swept forward. Hull ~35. Tip 5. Mid 20.
            lx = 20; ly = 30; 
            break;
        case 'alien-h': 
            // Pontoon top at Y=20.
            lx = 25; ly = 20; 
            break;
        case 'alien-w': 
            // Spike (35,75)->(10,20). Mid X=22.
            lx = 22; ly = 46; 
            break;
        case 'alien-a': 
            // Arch leg. Mid X=30.
            lx = 30; ly = 30; 
            break;
        case 'alien-m': 
            // Slope (20,25)->(50,55). Mid X=35.
            lx = 35; ly = 40; 
            break;
        case 'fork': lx = 25; ly = 35; break;
        case 'diamond': lx = 20; ly = 45; break;
        case 'hammer': lx = 15; ly = 30; break;
        default: lx = 25; ly = 50; break;
    }

    return [
        { x: lx, y: ly },           // Left Wing (Slot 1)
        { x: 100 - lx, y: ly }      // Right Wing (Slot 2)
    ];
};

export const drawDome = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    scale: number, 
    variant: 'bio' | 'radar' | 'hab'
) => {
    const r = 60 * scale;
    
    ctx.save();
    ctx.translate(x, y);

    if (variant === 'bio') {
        // Bio-Dome: Glassy, Hex pattern, vegetation inside
        // Background/Inside
        ctx.fillStyle = '#064e3b'; // Dark Green interior
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fill();
        
        // Structures inside
        ctx.fillStyle = '#065f46';
        ctx.beginPath(); ctx.moveTo(-r*0.6, 0); ctx.lineTo(-r*0.6, -r*0.5); ctx.lineTo(-r*0.2, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(r*0.2, 0); ctx.lineTo(r*0.5, -r*0.4); ctx.lineTo(r*0.7, 0); ctx.fill();

        // Glass Shell
        const grad = ctx.createLinearGradient(0, -r, 0, 0); 
        grad.addColorStop(0, 'rgba(255,255,255,0.3)'); 
        grad.addColorStop(1, 'rgba(255,255,255,0.05)');
        ctx.fillStyle = grad; 
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fill();
        
        // Hex Pattern (Simplified)
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; 
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i=1; i<4; i++) {
            ctx.arc(0, 0, r * (i/4), Math.PI, 0);
        }
        for(let a=0; a<=Math.PI; a+=Math.PI/4) {
            ctx.moveTo(Math.cos(a)*r, -Math.sin(a)*r);
            ctx.lineTo(0,0);
        }
        ctx.stroke();
        
        // Rim
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.stroke();

    } else if (variant === 'radar') {
        // Radar Dome: Solid, Geodesic lines, Antenna on top
        ctx.fillStyle = '#cbd5e1'; // Light Grey
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fill();
        
        // Shading
        const grad = ctx.createRadialGradient(-r*0.3, -r*0.5, r*0.1, 0, 0, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.5)');
        grad.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = grad; 
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fill();

        // Lines
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, r, Math.PI, 0);
        ctx.moveTo(0, -r); ctx.lineTo(0, 0);
        ctx.moveTo(Math.cos(Math.PI/4)*r, -Math.sin(Math.PI/4)*r); ctx.lineTo(-Math.cos(Math.PI/4)*r, 0); // Diagonal approx
        ctx.stroke();

        // Antenna
        ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, -r - (20*scale)); ctx.stroke();
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, -r - (20*scale), 2*scale, 0, Math.PI*2); ctx.fill();

    } else {
        // Hab Dome: Industrial, Windows, Base
        ctx.fillStyle = '#1e293b'; 
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fill();
        
        // Reinforced Base
        ctx.fillStyle = '#334155';
        ctx.fillRect(-r, -10*scale, r*2, 10*scale);
        
        // Lit Windows
        ctx.fillStyle = '#fbbf24';
        const winSize = 4 * scale;
        ctx.fillRect(-r*0.5, -r*0.4, winSize, winSize);
        ctx.fillRect(-r*0.2, -r*0.6, winSize, winSize);
        ctx.fillRect(r*0.3, -r*0.3, winSize, winSize);
        
        // Structure Lines
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r*0.7, 0); ctx.lineTo(-r*0.7, -r*0.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r*0.7, 0); ctx.lineTo(r*0.7, -r*0.7); ctx.stroke();
    }

    ctx.restore();
};

export const drawPlatform = (ctx: CanvasRenderingContext2D, centerX: number, groundY: number) => {
    const padHeight = 20;
    const padW = 160;
    const pX = centerX - padW/2;
    const pY = groundY - padHeight;

    // Supports
    ctx.fillStyle = '#334155';
    ctx.fillRect(centerX - 60, groundY - 10, 20, 10);
    ctx.fillRect(centerX + 40, groundY - 10, 20, 10);

    // Main Pad Gradient
    const padGrad = ctx.createLinearGradient(pX, pY, pX + padW, pY);
    padGrad.addColorStop(0, '#1e293b');
    padGrad.addColorStop(0.5, '#334155');
    padGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = padGrad;
    ctx.fillRect(pX, pY, padW, padHeight);

    // Warning Stripes
    ctx.fillStyle = '#facc15';
    for(let i=10; i<padW; i+=20) {
        ctx.fillRect(pX + i, pY + 2, 10, 4);
    }
    
    // Lights on edge
    ctx.fillStyle = '#ef4444'; // Red lights
    ctx.beginPath(); ctx.arc(pX + 5, pY + padHeight/2, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(pX + padW - 5, pY + padHeight/2, 2, 0, Math.PI*2); ctx.fill();
};
