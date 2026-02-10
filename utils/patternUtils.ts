
// Animal Skin Pattern Generator
// Supports high-resolution drawing with granular detail

export const createAnimalPattern = (ctx: CanvasRenderingContext2D, type: string, c1: string, c2: string, sizeInPixels: number = 4) => {
    // 512px canvas for texture
    const size = 512; 
    
    // Pixel sizing logic
    // sizeInPixels is the requested visual size of the feature (2px to 10px)
    // Canvas is 512x512 but mapped to the ship icon which is approx 300x300 but displayed smaller.
    // To make it look like 'pixel size' on the ship, we need to scale relative to the texture size.
    // Assuming texture maps roughly 1:1 to ship surface area for tiling.
    
    // For simplicity, we treat sizeInPixels as the radius or thickness on the 512 texture directly, scaled up slightly for visibility.
    // Effectively multiplying by 4 to make them visible on the downscaled texture map.
    const s = Math.max(1, sizeInPixels * 4); 

    const pCanvas = document.createElement('canvas');
    pCanvas.width = size;
    pCanvas.height = size;
    const pCtx = pCanvas.getContext('2d');
    if (!pCtx) return c1;

    // Fill Base Color
    pCtx.fillStyle = c1;
    pCtx.fillRect(0, 0, size, size);
    
    pCtx.fillStyle = c2;
    
    if (type === 'spots') {
        // Rocks / Spots: Rounded irregular shapes
        const count = (size * size) / (s * s * 6);
        for(let i=0; i<count; i++) {
            const bx = Math.random() * size;
            const by = Math.random() * size;
            const r = s * (0.8 + Math.random() * 0.4);
            pCtx.beginPath();
            pCtx.arc(bx, by, r, 0, Math.PI*2);
            pCtx.fill();
        }
    }
    else if (type === 'forest') {
        // Forest: Overlapping organic blobs
        const count = (size * size) / (s * s * 3);
        for(let i=0; i<count; i++) {
            const bx = Math.random() * size;
            const by = Math.random() * size;
            const br = s * (1.0 + Math.random() * 0.8);
            pCtx.beginPath();
            pCtx.ellipse(bx, by, br, br * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
            pCtx.fill();
        }
    }
    else if (type === 'stars') {
        // Stars: Small scattered dots
        const count = (size * size) / (s * s * 20);
        for(let i=0; i<count; i++) {
            const sx = Math.random() * size;
            const sy = Math.random() * size;
            const sr = s * 0.3 + (Math.random() * s * 0.2); 
            pCtx.beginPath();
            pCtx.arc(sx, sy, sr, 0, Math.PI*2);
            pCtx.fill();
        }
    }
    else if (type === 'stripes') {
        // Horizontal Stripes
        const stripeH = s; 
        const gap = s;
        for (let y = 0; y < size; y += (stripeH + gap)) {
            pCtx.fillRect(0, y, size, stripeH);
        }
    }
    else if (type === 'chess') {
        // Checkerboard / Chessboard
        const sq = s * 2; 
        for (let y = 0; y < size; y += sq) {
            for (let x = 0; x < size; x += sq) {
                if (((x/sq) + (y/sq)) % 2 === 0) {
                    pCtx.fillRect(x, y, sq, sq);
                }
            }
        }
    }
    // 'blank' does nothing, just returns base color c1

    const pattern = ctx.createPattern(pCanvas, 'repeat');
    return pattern || c1;
};

export const resolveColor = (ctx: CanvasRenderingContext2D, colorStr?: string) => {
    if (!colorStr) return '#94a3b8';
    
    if (colorStr.startsWith('pat|')) {
        const parts = colorStr.split('|');
        const type = parts[1];
        const c1 = parts[2];
        const c2 = parts[3];
        const size = parts[4] ? parseInt(parts[4]) : 4; // Default 4px
        return createAnimalPattern(ctx, type, c1, c2, size);
    }
    return colorStr;
};
