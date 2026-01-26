
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

export const generatePlanetEnvironment = (planet: Planet) => {
    const rng = createSeededRandom(planet.id);
    const col = planet.color.toLowerCase();

    // 1. DETERMINE PLANET TYPE & PALETTE
    const isReddish = ['#ef4444', '#f97316', '#d97706', '#fbbf24', '#7c2d12', '#78350f', '#991b1b', '#b91c1c'].includes(col);
    const isBluish = ['#3b82f6', '#0ea5e9', '#06b6d4', '#60a5fa', '#1e3a8a', '#1e40af', '#172554'].includes(col);
    const isGreenish = ['#10b981', '#064e3b', '#15803d', '#22c55e', '#84cc16', '#065f46'].includes(col);
    const isPurple = ['#a855f7', '#d8b4fe', '#7e22ce', '#6b21a8'].includes(col);
    const isWhite = ['#ffffff', '#e2e8f0', '#cbd5e1'].includes(col);

    // Randomize Day/Night Cycle per visit (50% chance)
    const isDay = Math.random() > 0.5;
    const isOcean = isBluish && rng() > 0.3; 
    const isBarren = isReddish || ['#d97706', '#a16207', '#78350f'].includes(col); 
    const hasWindmills = (isGreenish || isWhite) && rng() > 0.4;
    const hasTrains = rng() > 0.4;

    // --- ATMOSPHERE (SKY) GENERATION ---
    let skyGradient = ['#000000', '#000000'];
    let cloudColor = 'rgba(255,255,255,0.4)';
    let sunColor = '#facc15';
    let atmosphereColor = '#000000';

    if (isReddish) {
        if (isDay) skyGradient = ['#450a0a', '#ef4444']; 
        else skyGradient = ['#1a0505', '#450a0a']; 
        cloudColor = 'rgba(254, 202, 202, 0.2)'; 
        sunColor = '#fb923c'; 
        atmosphereColor = '#7f1d1d';
    } else if (isBluish) {
        if (isDay) skyGradient = ['#1e3a8a', '#60a5fa']; 
        else skyGradient = ['#020617', '#172554']; 
        cloudColor = 'rgba(219, 234, 254, 0.4)';
        sunColor = '#ffffff'; 
        atmosphereColor = '#1e3a8a';
    } else if (isGreenish) {
        if (isDay) skyGradient = ['#0f172a', '#334155']; 
        else skyGradient = ['#020617', '#0f172a'];
        cloudColor = 'rgba(209, 250, 229, 0.2)'; 
        sunColor = '#fef08a'; 
        atmosphereColor = '#064e3b';
    } else if (isPurple) {
        if (isDay) skyGradient = ['#2e1065', '#a855f7'];
        else skyGradient = ['#0f0518', '#3b0764'];
        cloudColor = 'rgba(233, 213, 255, 0.3)';
        atmosphereColor = '#581c87';
    } else {
        if (isDay) skyGradient = ['#3f3f46', '#a1a1aa'];
        else skyGradient = ['#09090b', '#27272a'];
        atmosphereColor = '#27272a';
    }

    // Override Sun/Sky for Delta Quadrant (Black Hole System)
    if (planet.quadrant === QuadrantType.DELTA) {
        sunColor = '#a855f7'; // Purple Accretion
        if (isDay) {
            skyGradient = ['#2e1065', '#4c1d95']; // Dark purple sky
        } else {
            skyGradient = ['#020617', '#1e1b4b']; // Almost black
        }
    }

    // Barren planets have rare, toxic clouds
    if (isBarren) {
        const toxicColors = [
            'rgba(244, 114, 182, 0.3)', // Pink
            'rgba(75, 85, 99, 0.5)',    // Dark Gray
            'rgba(190, 242, 100, 0.3)'  // Lime Green
        ];
        cloudColor = toxicColors[Math.floor(rng() * toxicColors.length)];
    }

    // --- GROUND & TERRAIN COLORS ---
    let groundColor = planet.color; 
    let hillColors: string[] = [];

    // Distinct palettes for depth perception (Back to Front: Layer 0 -> 5)
    if (isGreenish) {
        // Lush: Misty Blue-Greens -> Deep Forest -> Vibrant Grass
        hillColors = [
            '#475569', // Slate-600 (Misty Mountain)
            '#334155', // Slate-700 (Dark Mountain)
            '#14532d', // Green-900 (Deep Forest)
            '#15803d', // Green-700 (Mid Hills)
            '#16a34a', // Green-600 (Near Hills)
            '#22c55e'  // Green-500 (Vibrant Foreground)
        ];
        groundColor = '#15803d';
    } else if (isReddish) {
        // Desert: Dark Brown/Red -> Vibrant Orange
        hillColors = [
            '#450a0a', // Red-950
            '#7f1d1d', // Red-900
            '#991b1b', // Red-800
            '#c2410c', // Orange-700
            '#ea580c', // Orange-600
            '#d97706'  // Amber-600
        ];
    } else if (isWhite) {
        // Ice: Dark Grey -> White
        hillColors = [
            '#64748b', // Slate-500
            '#94a3b8', // Slate-400
            '#cbd5e1', // Slate-300
            '#e2e8f0', // Slate-200
            '#f1f5f9', // Slate-100
            '#ffffff'  // White
        ];
        groundColor = '#f8fafc';
    } else if (isPurple) {
        // Alien: Dark Indigo -> Violet
        hillColors = [
            '#1e1b4b', // Indigo-950
            '#312e81', // Indigo-900
            '#4c1d95', // Violet-900
            '#6d28d9', // Violet-700
            '#7c3aed', // Violet-600
            '#a855f7'  // Purple-500
        ];
    } else if (isBluish) {
        if (isOcean) {
            hillColors = ['#020617', '#0f172a', '#172554', '#1e3a8a', '#1e40af', '#2563eb'];
        } else {
            // Rocky Blue
            hillColors = ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8'];
        }
    } else {
        // Fallback / Dark
        hillColors = ['#000000', '#18181b', '#27272a', '#3f3f46', '#52525b', '#71717a'];
    }

    // Apply atmospheric fading to distant layers (0, 1, 2)
    // We mix a bit of atmosphereColor into the back layers to simulate distance fog
    if (!isOcean) {
        hillColors[0] = mixColor(hillColors[0], atmosphereColor, 0.6);
        hillColors[1] = mixColor(hillColors[1], atmosphereColor, 0.4);
        hillColors[2] = mixColor(hillColors[2], atmosphereColor, 0.2);
    }

    // 2. STARS
    const starCount = isDay ? 60 : 250;
    const stars = Array.from({ length: starCount }).map(() => ({ 
        x: rng(), y: rng(), size: rng() * 0.8 + 0.2, alpha: isDay ? 0.4 : (rng() * 0.5 + 0.5) 
    }));

    // 2b. WANDERERS
    const wanderers = [];
    if (!isDay && rng() > 0.2) {
        const numWanderers = 1 + Math.floor(rng() * 3);
        for(let i=0; i<numWanderers; i++) {
            wanderers.push({
                x: rng(), y: rng() * 0.5, 
                size: 4 + rng() * 8,
                color: ['#ef4444', '#3b82f6', '#10b981', '#facc15'][Math.floor(rng() * 4)],
                hasRings: rng() > 0.7
            });
        }
    }

    // CLOUDS
    const clouds: any[] = [];
    const waterFactor = (isBluish || isGreenish) ? 2.5 : 1.0;
    const quantityMod = isBarren ? 0.2 : 1.0; 

    // Background Layer
    const farCount = Math.floor((isDay ? 8 : 4) * quantityMod);
    for(let i=0; i<farCount; i++) {
        clouds.push({
            x: (rng() * 3000) - 1500, y: (rng() * 1200) - 900,
            w: 40 + rng() * 30, alpha: (0.7 + rng() * 0.3), speed: 0.03 + rng() * 0.04, layer: 0, type: rng() > 0.5 ? 'fluffy' : 'streak', color: cloudColor
        });
    }
    // Mid Layer
    const midCount = Math.floor((isDay ? 10 : 5) * waterFactor * quantityMod);
    for(let i=0; i<midCount; i++) {
        clouds.push({
            x: (rng() * 3000) - 1500, y: (rng() * 1200) - 900, w: 60 + rng() * 40, alpha: (0.5 + rng() * 0.3), speed: 0.08 + rng() * 0.08, layer: 1, type: 'fluffy', color: cloudColor
        });
    }
    // Close Layer
    const closeCount = Math.floor((isDay ? 5 : 2) * waterFactor * (isOcean ? 1.5 : 1.0) * quantityMod);
    for(let i=0; i<closeCount; i++) {
        clouds.push({ x: (rng() * 3000) - 1500, y: (rng() * 1200) - 900, w: 120 + rng() * 80, alpha: 0.2 + rng() * 0.2, speed: 0.2 + rng() * 0.15, layer: 2, type: 'fluffy', color: cloudColor });
    }

    // 3. HILLS & VEGETATION
    const hills = [];
    const hillCount = isOcean ? 0 : 6; 
    const trains: any[] = [];
    
    // Vegetation Settings based on Biome
    const isLush = isGreenish || (isBluish && !isOcean && !isBarren);
    const hasAlienFlora = isPurple || (isReddish && !isBarren && rng() > 0.5);
    
    for(let i=0; i<hillCount; i++) {
        const points = [];
        const isMountain = i < 2; 
        const segments = isMountain ? 24 : 16; 
        
        const hasRoad = i === 4 && !isOcean; 
        const hasTrainTrack = i === 3 && hasTrains && !isOcean;

        for(let j=0; j<=segments; j++) {
            let minH = isMountain ? 0.4 : 0.15; 
            let maxH = isMountain ? 0.8 : 0.45;
            if (!isMountain && i >= 3 && rng() > 0.6) minH = 0.02; 
            const yVar = rng();
            const rawHeight = minH + (yVar * (maxH - minH));
            points.push({ xRatio: j/segments, heightRatio: rawHeight });
        }

        if (!isMountain) {
            for (let k = 0; k < 2; k++) { 
                for (let j = 1; j < points.length - 1; j++) {
                    points[j].heightRatio = (points[j-1].heightRatio + points[j].heightRatio + points[j+1].heightRatio) / 3;
                }
            }
        }

        const trees: any[] = [];
        const snowCaps: any[] = [];
        const pyramids: any[] = [];
        const cityBuildings: any[] = [];
        const cityLights: any[] = [];
        const windMills: any[] = [];
        
        // --- VEGETATION GENERATION ---
        let hasTrees = false;
        let treeDensity = 0;
        let treeColors = ['#166534'];
        let treeType = 'round';
        let trunkColor = '#78350f';
        const treeLine = 0.6 + (rng() * 0.1); // Tree line for mountains

        if (isLush) {
            hasTrees = true;
            treeColors = ['#14532d', '#166534', '#15803d', '#16a34a'];
            if (isMountain) {
                treeDensity = 0.3; // Sparse on mountains
                treeType = 'pine';
                treeColors = ['#064e3b', '#065f46']; // Darker pines
            } else {
                // Dense forests on hills
                treeDensity = i === 2 || i === 3 ? 0.8 : 0.4;
                treeType = rng() > 0.4 ? 'pine' : 'round';
            }
        } else if (hasAlienFlora) {
            hasTrees = true;
            treeDensity = 0.3;
            if (isPurple) {
                treeColors = ['#581c87', '#6b21a8', '#7e22ce'];
                trunkColor = '#3b0764';
            } else { // Reddish
                treeColors = ['#7f1d1d', '#991b1b', '#b91c1c'];
                trunkColor = '#450a0a';
            }
            treeType = rng() > 0.5 ? 'pine' : 'palm'; // Alien looking shapes
        }

        if (hasTrees && !isOcean && !isWhite) {
            for(let j=0; j<segments; j++) {
                const p = points[j];
                // Check Tree Line for Mountains (High elevation = no trees)
                if (isMountain && p.heightRatio > treeLine) continue;

                if (rng() < treeDensity) {
                    const clusterSize = isMountain ? 1 : (2 + Math.floor(rng() * 3));
                    for(let k=0; k<clusterSize; k++) {
                        const scale = isMountain ? 0.6 : 1.0;
                        trees.push({
                            segIdx: j, offset: rng(), 
                            w: (4 + rng() * 4) * scale, 
                            h: (10 + rng() * 20) * scale,
                            color: treeColors[Math.floor(rng() * treeColors.length)],
                            trunkColor: trunkColor,
                            type: treeType
                        });
                    }
                }
            }
        }

        if (hasWindmills && !isMountain && i === 2) {
            if (rng() < 0.6) {
                const num = 1 + Math.floor(rng() * 2);
                for(let w=0; w<num; w++) {
                    const idx = Math.floor(rng() * (segments - 2)) + 1;
                    const pt = points[idx];
                    windMills.push({ xRatio: pt.xRatio, yBase: pt.heightRatio, scale: 0.6 + rng()*0.4 });
                }
            }
        }

        if (isBarren && !isMountain && (i === 2 || i === 3)) {
            if (rng() < 0.4) { 
                const numPyramids = 1 + Math.floor(rng() * 2);
                for(let p=0; p<numPyramids; p++) {
                    const idx = Math.floor(rng() * (segments - 2)) + 1;
                    const pt = points[idx];
                    pyramids.push({
                        xRatio: pt.xRatio, yBase: pt.heightRatio, scale: 0.5 + rng() * 0.5,
                        color: i % 2 === 0 ? '#d97706' : '#b45309' 
                    });
                }
            }
        }

        if (isMountain) {
            points.forEach((p, idx) => {
                const prev = points[idx-1];
                const next = points[idx+1];
                if (prev && next && p.heightRatio > prev.heightRatio && p.heightRatio > next.heightRatio) {
                    if (p.heightRatio > 0.55) { 
                        snowCaps.push({ idx, h: p.heightRatio });
                    }
                }
            });
        }

        if ((!isBarren || isWhite) && (i === 1 || i === 2)) {
            if (rng() < 0.3) {
                const centerIdx = Math.floor(rng() * segments);
                const spread = 3;
                for(let k = centerIdx - spread; k < centerIdx + spread; k++) {
                    if (k >= 0 && k < segments && rng() > 0.4) {
                        const p = points[k];
                        cityBuildings.push({ xRatio: p.xRatio, yBase: p.heightRatio, w: 8+rng()*12, h: 10+rng()*30, color: '#1f2937' });
                        if (!isDay) {
                            const numLights = 1 + Math.floor(rng() * 3);
                            for(let l=0; l<numLights; l++) {
                                cityLights.push({ xRatio: p.xRatio + (rng()-0.5)*0.01, yBase: p.heightRatio, yOff: 5+rng()*25, color: rng()>0.7?'#fff':'#facc15', size: 1+rng() });
                            }
                        }
                    }
                }
            }
        }

        if (hasTrainTrack) {
            trains.push({
                layer: i, progress: rng(), speed: 0.0005 + (rng() * 0.0005), cars: 4 + Math.floor(rng() * 3), color: '#ef4444', dir: rng() > 0.5 ? 1 : -1
            });
        }

        let roadLevel = 0.3;
        if (hasRoad) {
            const avg = points.reduce((s, p) => s + p.heightRatio, 0) / points.length;
            roadLevel = Math.max(0.25, avg + 0.1); 
        }

        hills.push({ 
            layer: i, type: isMountain ? 'mountain' : 'hill', color: hillColors[i], points, trees, snowCaps, pyramids, cityBuildings, cityLights, windMills,
            speedFactor: 0.05 * (i + 1), parallaxFactor: 0.1 + (i * 0.15), hasRoad, hasTrainTrack, roadLevel
        });
    }

    const features: any[] = [];
    const powerLines: any[] = [];
    const boulders: any[] = [];
    const streetLights: any[] = [];
    const cars: any[] = [];
    const occupiedX: number[] = [];
    const isTooClose = (x: number, minDist: number = 80) => occupiedX.some(ox => Math.abs(ox - x) < minDist);
    const registerX = (x: number) => occupiedX.push(x);

    // Register Landing Pad Center (Range +/- 100)
    if (!isOcean) registerX(0);

    const towerSide = rng() > 0.5 ? 1 : -1; 
    const towerX = 140 * towerSide; 
    features.push({ x: towerX, type: 'tower', h: 160, w: 42, color: '#e2e8f0', yOff: 0, arms: [-130, -50] });
    registerX(towerX);

    if (isOcean) {
        const numPlatforms = 3 + Math.floor(rng() * 3);
        for(let i=0; i<numPlatforms; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const dist = 300 + (i * 250) + (rng() * 100);
            const bx = side * dist;
            if (!isTooClose(bx, 120)) {
                const contents = [];
                const numItems = 2 + Math.floor(rng() * 3);
                for(let k=0; k<numItems; k++) {
                    contents.push({ x: (rng() - 0.5) * 60, w: 10 + rng() * 10, h: 20 + rng() * 30, type: rng() > 0.5 ? 'tree' : 'home' });
                }
                features.push({ x: bx, type: 'dome_std', variant: 'bio', scale: 1.3 + rng() * 0.8, isOcto: false, contents }); 
                registerX(bx);
            }
        }
    } else {
        const plantSide = -towerSide;
        const plantX = plantSide * (220 + rng() * 60); 
        features.push({ x: plantX, type: 'power_plant', scale: 1.0, yOff: 0, isUnderground: !isGreenish && rng() > 0.3 });
        registerX(plantX);
        const poleX = plantX + (plantSide * 80);
        features.push({ x: poleX, type: 'power_pole', h: 140, isHighVoltage: true });
        registerX(poleX);
        if (rng() > 0.3) {
            const hangarX = plantX + (plantSide * 150);
            features.push({ x: hangarX, type: 'hangar', w: 60, h: 40, color: '#475569' });
            registerX(hangarX);
        }
        const towerConnectX = towerX + (plantSide > 0 ? 21 : -21); 
        const chain1 = []; chain1.push({ x: towerConnectX, yOff: 0, h: 120 });
        const dist = Math.abs(poleX - towerX); const steps = Math.floor(dist / 200); const stepSize = (poleX - towerX) / (steps + 1);
        for(let k=1; k<=steps; k++) { const ix = towerX + (k * stepSize); features.push({ x: ix, type: 'power_pole', h: 100 }); chain1.push({ x: ix, yOff: 0, h: 100 }); }
        chain1.push({ x: poleX, yOff: 0, h: 140 }); powerLines.push(chain1);
        const chain2 = []; chain2.push({ x: poleX, yOff: 0, h: 140 }); chain2.push({ x: plantX + (20 * plantSide), yOff: 0, h: 40 }); powerLines.push(chain2);
    }
    
    if (!isOcean) {
        const settlementSide = -towerSide; 
        const clusterCenter = settlementSide * (350 + rng() * 100); // Pushed further out
        const numBuildings = 3 + Math.floor(rng() * 3); 
        for(let i=0; i<numBuildings; i++) {
            const offset = (i - numBuildings/2) * (70 + rng()*30);
            const bx = clusterCenter + offset;
            if (!isTooClose(bx, 100)) { // Increased safe distance
                if (isBarren || (!isGreenish && rng() > 0.3)) {
                    const scale = 1.3 + rng() * 1.0; 
                    const domeR = 80 * scale; const safeWidth = domeR * 1.5; const contents = []; const n = 5 + Math.floor(rng() * 5); 
                    for(let k=0; k<n; k++) { contents.push({ x: (rng()-0.5) * safeWidth, w: 8 + rng() * 6, h: 15 + rng() * 20, type: rng() > 0.4 ? 'home' : 'tree' }); }
                    features.push({ x: bx, type: 'dome_std', variant: 'city', scale, isOcto: rng()>0.5, contents }); 
                    registerX(bx);
                } else {
                    const bw = 30 + rng() * 20; const bh = 40 + rng() * 80; const windowData = []; const numFloors = Math.floor((bh - 10) / 12); const numWins = Math.floor((bw - 6) / 8);
                    for(let fl=0; fl<numFloors; fl++) { for(let wi=0; wi<numWins; wi++) { if(rng() > 0.2) { windowData.push({ x: 6 + (wi * 8), y: 10 + (fl * 12), isLit: rng() > 0.3 }); } } }
                    features.push({ x: bx, type: 'building_std', w: bw, h: bh, color: isWhite ? '#cbd5e1' : '#e2e8f0', hasRedRoof: rng() > 0.5, hasBalcony: rng() > 0.5, windowData }); 
                    registerX(bx);
                }
            }
        }
    }

    if (!isOcean) {
        const numRocks = 15; 
        for(let i=0; i<numRocks; i++) { 
            const rx = (rng() - 0.5) * 2200; 
            if (Math.abs(rx) < 200 || isTooClose(rx, 30)) continue; 
            boulders.push({ x: rx, size: 5 + rng()*15, color: '#57534e' }); 
        }
    }

    if (hills[4]?.hasRoad) {
        const numCars = (isGreenish || isOcean) ? 8 : 2;
        for(let i=0; i<numCars; i++) { cars.push({ type: 'car', progress: rng(), speed: 0.0002 + (rng() * 0.0003), color: isDay ? ['#ef4444', '#3b82f6', '#10b981', '#facc15'][Math.floor(rng()*4)] : '#ffffff', dir: rng() > 0.5 ? 1 : -1 }); }
        const lightSpacing = 150; 
        for(let x = -1500; x < 1500; x+= lightSpacing) { if (Math.abs(x) > 200) { streetLights.push({ x: x + (rng() * 20), h: 40 }); } }
    }

    return {
        isDay, isOcean, isReddish, isBluish, isGreenish, isBarren,
        sunColor, skyGradient, cloudColor, hillColors,
        stars, clouds, hills, features, boulders, cars, streetLights, trains, wanderers,
        groundColor, powerLines,
        quadrant: planet.quadrant
    };
};

export const getEngineCoordinates = (config: ExtendedShipConfig) => {
    const { engines, wingStyle, isAlien } = config;
    const engW = isAlien ? 10 : 10;
    const engH = isAlien ? 14 : 12;
    const locs: {x:number, y:number, w:number, h:number}[] = [];

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

export const getWingMounts = (config: ExtendedShipConfig) => {
    const { wingStyle } = config;
    let lx = 25, ly = 40; 

    switch (wingStyle) {
        case 'delta': lx = 19; ly = 67; break;
        case 'x-wing': lx = 18; ly = 21; break;
        case 'pincer': lx = 18; ly = 42; break;
        case 'curved': lx = 20; ly = 49; break;
        case 'cylon': lx = 20; ly = 30; break;
        case 'alien-h': lx = 25; ly = 20; break;
        case 'alien-w': lx = 10; ly = 20; break;
        case 'alien-a': lx = 30; ly = 30; break;
        case 'alien-m': lx = 20; ly = 25; break;
        case 'fork': lx = 25; ly = 35; break;
        case 'diamond': lx = 20; ly = 45; break;
        case 'hammer': lx = 15; ly = 30; break;
        default: lx = 25; ly = 50; break;
    }

    return [
        { x: lx, y: ly },           
        { x: 100 - lx, y: ly }      
    ];
};

export const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, alpha: number, color: string = '#ffffff') => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    const r = w / 3;
    ctx.arc(x, y, r, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(x + r, y - r * 0.6, r * 1.2, Math.PI * 1, Math.PI * 2);
    ctx.arc(x + r * 2, y, r, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
};

export const drawDome = (ctx: CanvasRenderingContext2D, x: number, y: number, f: any, isOcean: boolean) => {
    const r = 80 * f.scale; 
    ctx.save();
    ctx.translate(x, y);

    if (isOcean) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-r*0.8, 0, 15, 60);
        ctx.fillRect(r*0.8 - 15, 0, 15, 60);
        ctx.fillStyle = '#334155';
        ctx.fillRect(-r - 5, 0, (r * 2) + 10, 10);
    } else {
        ctx.fillStyle = '#475569';
        ctx.fillRect(-r - 5, 0, (r * 2) + 10, 6);
    }

    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r - 2, Math.PI, 0); ctx.clip();
    const bgGrad = ctx.createLinearGradient(0, -r, 0, 0);
    bgGrad.addColorStop(0, 'rgba(2, 6, 23, 0.4)'); 
    bgGrad.addColorStop(1, 'rgba(30, 41, 59, 0.6)'); 
    ctx.fillStyle = bgGrad;
    ctx.fill();

    if (f.contents) {
        f.contents.forEach((c: any) => {
            if (c.type === 'tree') {
                drawBuilding(ctx, { x: c.x, y: 0, type: 'tree', w: c.w, h: c.h, color: '#10b981', trunkColor: '#78350f' }, true, false);
            } else if (c.type === 'home') {
                ctx.fillStyle = '#475569';
                ctx.fillRect(c.x - c.w/2, -c.h, c.w, c.h);
                ctx.fillStyle = '#facc15';
                ctx.fillRect(c.x - c.w/4, -c.h + 4, c.w/2, 4);
                ctx.fillStyle = '#334155';
                ctx.beginPath();
                ctx.moveTo(c.x - c.w/2 - 2, -c.h);
                ctx.lineTo(c.x + c.w/2 + 2, -c.h);
                ctx.lineTo(c.x, -c.h - 6);
                ctx.fill();
            }
        });
    }
    ctx.restore();

    const isOcto = f.isOcto;
    if (isOcto) {
        ctx.beginPath();
        const segments = 6;
        for(let i=0; i<=segments; i++) {
            const angle = Math.PI + (i / segments) * Math.PI;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if(i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const glass = ctx.createLinearGradient(0, -r, 0, 0);
        glass.addColorStop(0, 'rgba(200,240,255,0.2)');
        glass.addColorStop(0.5, 'rgba(200,240,255,0.05)');
        glass.addColorStop(1, 'rgba(200,240,255,0.02)');
        ctx.fillStyle = glass;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    } else {
        const glass = ctx.createRadialGradient(-r*0.3, -r*0.5, 5, 0, 0, r);
        glass.addColorStop(0, 'rgba(255,255,255,0.3)');
        glass.addColorStop(0.2, 'rgba(224,242,254,0.05)');
        glass.addColorStop(1, 'rgba(224,242,254,0.1)');
        ctx.fillStyle = glass;
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, r - 5, Math.PI * 1.2, Math.PI * 1.4); ctx.stroke();
    }
    ctx.restore();
};

export const drawPowerPlant = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1.0, isUnderground: boolean = false) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (isUnderground) {
        ctx.fillStyle = '#27272a';
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.lineTo(-30, -20);
        ctx.lineTo(30, -20);
        ctx.lineTo(40, 0);
        ctx.fill();
        ctx.fillStyle = '#ef4444'; 
        ctx.fillRect(-10, -20, 20, 5);
        ctx.fillStyle = '#52525b';
        ctx.fillRect(-25, -30, 10, 10);
        ctx.fillStyle = '#18181b';
        ctx.beginPath(); ctx.arc(-20, -30, 5, 0, Math.PI*2); ctx.fill();
    } else {
        ctx.fillStyle = '#3f3f46';
        ctx.fillRect(-60, -30, 30, 30); 
        ctx.fillStyle = '#52525b'; 
        for(let i=0; i<3; i++) ctx.fillRect(-58 + (i*8), -30, 4, 30);
        ctx.beginPath();
        ctx.arc(-10, 0, 20, Math.PI, 0);
        ctx.fillStyle = '#94a3b8'; 
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.stroke();
        const tx = 40;
        ctx.fillStyle = '#cbd5e1'; 
        ctx.beginPath();
        ctx.moveTo(tx - 15, 0);
        ctx.quadraticCurveTo(tx - 5, -40, tx - 20, -80); 
        ctx.lineTo(tx + 20, -80); 
        ctx.quadraticCurveTo(tx + 5, -40, tx + 15, 0); 
        ctx.fill();
        ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(tx - 20, -80); ctx.lineTo(tx + 20, -80); ctx.stroke();
    }
    ctx.restore();
};

export const drawTower = (ctx: CanvasRenderingContext2D, x: number, y: number, f: any, isDay: boolean, isOcean: boolean, armRetract: number) => {
    const th = 160; const tw = 42; const tx = x;
    const strokeColor = '#1e293b'; 
    
    ctx.lineWidth = 3;
    ctx.strokeStyle = strokeColor;
    
    ctx.beginPath(); 
    ctx.moveTo(tx, y); ctx.lineTo(tx, y-th); ctx.moveTo(tx+tw, y); ctx.lineTo(tx+tw, y-th); 
    for(let k=0; k<th; k+=40) { 
        ctx.moveTo(tx, y-k); ctx.lineTo(tx+tw, y-k-40); 
        ctx.moveTo(tx+tw, y-k); ctx.lineTo(tx, y-k-40); 
        ctx.moveTo(tx, y-k); ctx.lineTo(tx+tw, y-k); 
    }
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(226, 232, 240, 0.3)';
    ctx.fillRect(tx, y-th, tw, th);
    
    ctx.fillStyle = '#cbd5e1'; 
    ctx.fillRect(tx-10, y-10, tw+20, 10); 
    ctx.strokeRect(tx-10, y-10, tw+20, 10);
    ctx.fillRect(tx-5, y-th-10, tw+10, 10); 
    ctx.strokeRect(tx-5, y-th-10, tw+10, 10);
    
    const blink = Math.floor(Date.now() / 300) % 2 === 0; 
    const lightX = tx + tw/2; const lightY = y - th - 15; 
    ctx.fillStyle = blink ? '#ffadad' : '#dc2626'; 
    ctx.beginPath(); ctx.arc(lightX, lightY, 4, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#991b1b'; ctx.stroke();

    if (f.arms) {
        f.arms.forEach((armYOffset: number) => {
            const armY = y + armYOffset;
            const armLen = 140; 
            const armHeight = 16;
            
            const dir = x > 0 ? -1 : 1;
            const slideAmount = 100 * armRetract; 
            const shift = slideAmount * dir * -1; 
            
            const startX = (dir === 1 ? tx - 20 : tx + tw + 20) + shift;
            const endX = startX + (armLen * dir);
            
            ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, armY - armHeight/2); ctx.lineTo(endX, armY - armHeight/2);
            ctx.moveTo(startX, armY + armHeight/2); ctx.lineTo(endX, armY + armHeight/2);
            
            const sections = 7;
            const secLen = armLen / sections;
            for(let i=0; i<sections; i++) {
                const sx = startX + (i * secLen * dir);
                const ex = startX + ((i+1) * secLen * dir);
                ctx.moveTo(sx, armY - armHeight/2); ctx.lineTo(ex, armY + armHeight/2);
                ctx.moveTo(sx, armY + armHeight/2); ctx.lineTo(ex, armY - armHeight/2);
            }
            ctx.stroke();
            
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(endX - (dir===1?0:4), armY - armHeight/2 - 2, 4, armHeight + 4);
        });
    }
};

export const drawWindmill = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    const h = 60 * scale;
    ctx.save();
    ctx.translate(x, y);
    
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(-4 * scale, 0);
    ctx.lineTo(4 * scale, 0);
    ctx.lineTo(2 * scale, -h);
    ctx.lineTo(-2 * scale, -h);
    ctx.fill();
    
    const time = Date.now() * 0.002;
    ctx.translate(0, -h);
    ctx.rotate(time);
    
    ctx.fillStyle = '#f1f5f9';
    for(let i=0; i<3; i++) {
        ctx.beginPath();
        ctx.rect(-1 * scale, 0, 2 * scale, -40 * scale);
        ctx.fill();
        ctx.rotate((Math.PI * 2) / 3);
    }
    
    ctx.fillStyle = '#64748b';
    ctx.beginPath(); ctx.arc(0, 0, 3 * scale, 0, Math.PI*2); ctx.fill();
    ctx.restore();
};

export const drawHangar = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w/2, 0);
    ctx.lineTo(-w/2, -h*0.6);
    ctx.quadraticCurveTo(0, -h*1.2, w/2, -h*0.6);
    ctx.lineTo(w/2, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-w/3, -h*0.5, w/1.5, h*0.5);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-w/3, -h*0.5 - 2, w/1.5, 2);
    ctx.restore();
};

export const drawBuilding = (ctx: CanvasRenderingContext2D, f: any, isDay: boolean, isOcean: boolean) => {
    if (f.type === 'hangar') { drawHangar(ctx, f.x, f.y, f.w, f.h, f.color); return; }
    if (f.type === 'windmill') { drawWindmill(ctx, f.x, f.y, f.scale); return; }
    if (f.type === 'power_pole') {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.fillStyle = '#71717a'; 
        ctx.fillRect(-2, -f.h, 4, f.h);
        ctx.fillRect(-20, -f.h + 10, 40, 4);
        ctx.fillStyle = '#10b981'; 
        ctx.beginPath(); ctx.arc(-18, -f.h + 8, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(18, -f.h + 8, 3, 0, Math.PI*2); ctx.fill();
        if (f.isHighVoltage) {
             ctx.fillStyle = '#ef4444';
             ctx.beginPath(); ctx.arc(0, -f.h, 2, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
        return;
    }

    ctx.save();
    ctx.translate(f.x, f.y); 
    
    if (f.type === 'puddle') {
        ctx.fillStyle = f.color || '#3b82f6';
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.ellipse(0, 0, f.w/2, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
    else if (f.type === 'cactus') {
        ctx.fillStyle = f.color || '#166534';
        const w = 8; const h = f.h;
        ctx.fillRect(-w/2, -h, w, h); ctx.beginPath(); ctx.arc(0, -h, w/2, Math.PI, 0); ctx.fill();
        const armH = h * 0.4; const armY = -h * 0.6;
        ctx.beginPath(); ctx.moveTo(-w/2, armY); ctx.lineTo(-w*2, armY); ctx.lineTo(-w*2, armY - armH); ctx.arc(-w*2 + w/2, armY - armH, w/2, Math.PI, 0); ctx.lineTo(-w*2 + w, armY); ctx.lineTo(-w/2, armY + w); ctx.fill();
        if (f.w > 12) {
            const armY2 = -h * 0.4;
            ctx.beginPath(); ctx.moveTo(w/2, armY2); ctx.lineTo(w*2, armY2); ctx.lineTo(w*2, armY2 - armH); ctx.arc(w*2 - w/2, armY2 - armH, w/2, 0, Math.PI); ctx.lineTo(w*2 - w, armY2); ctx.lineTo(w/2, armY2 + w); ctx.fill();
        }
    }
    else if (f.type === 'church') {
        if (isOcean) { ctx.fillStyle = '#334155'; ctx.fillRect(-35, 0, 70, 15); ctx.fillStyle = '#1e293b'; ctx.fillRect(-25, 15, 10, 100); ctx.fillRect(15, 15, 10, 100); }
        ctx.fillStyle = '#e5e7eb'; ctx.fillRect(-20, -40, 40, 40);
        ctx.beginPath(); ctx.moveTo(-20, -40); ctx.lineTo(0, -80); ctx.lineTo(20, -40); ctx.fill();
        ctx.fillStyle = '#4b5563'; ctx.beginPath(); ctx.arc(0, 0, 12, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -80); ctx.lineTo(0, -95); ctx.moveTo(-6, -88); ctx.lineTo(6, -88); ctx.stroke();
        ctx.fillStyle = isDay ? '#374151' : '#facc15'; ctx.beginPath(); ctx.arc(-10, -20, 4, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(10, -20, 4, 0, Math.PI*2); ctx.fill();
    } 
    else if (f.type === 'water_tower') {
        ctx.strokeStyle = '#64748b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-10, -70); ctx.moveTo(12, 0); ctx.lineTo(10, -70); ctx.moveTo(-15, -25); ctx.lineTo(15, -25); ctx.moveTo(-12, -50); ctx.lineTo(12, -50); ctx.stroke();
        ctx.fillStyle = f.color; ctx.beginPath(); ctx.ellipse(0, -70, 25, 30, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(-25, -75, 50, 10);
    } 
    else if (f.type === 'bridge') {
        const hw = f.w/2; const h = f.h;
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-hw, 0); ctx.lineTo(hw, 0); ctx.moveTo(-hw, 0); ctx.lineTo(-hw + 20, -h); ctx.lineTo(hw - 20, -h); ctx.lineTo(hw, 0);
        for(let i=-hw+10; i<hw; i+=20) { ctx.moveTo(i, 0); ctx.lineTo(i, -h * 0.5); }
        ctx.stroke();
    }
    else if (f.type === 'rock_formation') {
        const size = f.w;
        ctx.fillStyle = '#57534e'; ctx.beginPath(); ctx.moveTo(-size/2, 0); ctx.lineTo(-size/4, -f.h); ctx.lineTo(size/4, -f.h * 0.8); ctx.lineTo(size/2, 0); ctx.fill();
        ctx.strokeStyle = '#44403c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-size/4, -f.h * 0.5); ctx.lineTo(0, -f.h * 0.2); ctx.stroke();
    }
    else if (f.type === 'tree' || f.type === 'palm' || f.type === 'road_tree' || f.type === 'pine') {
        if (f.type === 'palm') {
            ctx.fillStyle = f.trunkColor; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-1, -f.h); ctx.lineTo(1, -f.h); ctx.lineTo(2, 0); ctx.fill();
            ctx.strokeStyle = f.color; ctx.lineWidth = 3; 
            const leafLen = f.w * 1.5;
            for(let i=0; i<5; i++) {
                ctx.beginPath(); const angle = (Math.PI + (i/4)*Math.PI); const lx = Math.cos(angle) * leafLen; const ly = Math.sin(angle) * leafLen; ctx.moveTo(0, -f.h); ctx.quadraticCurveTo(lx * 0.5, -f.h - 10, lx, -f.h + 5); ctx.stroke();
            }
        } else if (f.type === 'pine') {
             // Conical Pine Tree
             ctx.fillStyle = f.trunkColor || '#451a03';
             ctx.fillRect(-2, 0, 4, -f.h*0.2); 
             
             ctx.fillStyle = f.color;
             ctx.beginPath();
             // Bottom Tier
             ctx.moveTo(-f.w, -f.h*0.2);
             ctx.lineTo(f.w, -f.h*0.2);
             ctx.lineTo(0, -f.h*0.6);
             ctx.fill();
             // Top Tier
             ctx.beginPath();
             ctx.moveTo(-f.w*0.8, -f.h*0.5);
             ctx.lineTo(f.w*0.8, -f.h*0.5);
             ctx.lineTo(0, -f.h);
             ctx.fill();
        } else {
            // Round tree
            ctx.fillStyle = f.trunkColor || '#78350f'; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-1.5, -f.h); ctx.lineTo(1.5, -f.h); ctx.lineTo(3, 0); ctx.fill();
            ctx.strokeStyle = f.trunkColor || '#78350f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -f.h * 0.6); ctx.quadraticCurveTo(-5, -f.h * 0.7, -8, -f.h * 0.8); ctx.moveTo(0, -f.h * 0.7); ctx.quadraticCurveTo(5, -f.h * 0.8, 8, -f.h * 0.9); ctx.stroke();
            ctx.fillStyle = f.color; const clusterSize = f.w;
            ctx.beginPath(); ctx.arc(0, -f.h, clusterSize, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(-6, -f.h * 0.8, clusterSize * 0.8, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(6, -f.h * 0.85, clusterSize * 0.8, 0, Math.PI*2); ctx.fill();
            if (f.color === '#22d3ee' || f.color === '#a855f7' || f.color === '#ec4899') { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(-2, -f.h - 2, clusterSize * 0.4, 0, Math.PI*2); ctx.fill(); }
        }
    }
    else {
        // STANDARD BUILDINGS (building_std)
        if (isOcean) { ctx.fillStyle = '#1e293b'; ctx.fillRect(-f.w/2 + 2, 0, 4, 30); ctx.fillRect(f.w/2 - 6, 0, 4, 30); ctx.fillStyle = '#334155'; ctx.fillRect(-f.w/2 - 5, 0, f.w + 10, 5); }
        ctx.fillStyle = f.color; ctx.fillRect(-f.w/2, -f.h, f.w, f.h);
        if (f.hasRedRoof) { ctx.fillStyle = '#991b1b'; ctx.beginPath(); ctx.moveTo(-f.w/2 - 2, -f.h); ctx.lineTo(f.w/2 + 2, -f.h); ctx.lineTo(0, -f.h - 10); ctx.fill(); }
        if (f.hasBalcony) { ctx.fillStyle = '#475569'; for(let by = -f.h + 20; by < 0; by += 20) { ctx.fillRect(-f.w/2 - 2, by, f.w + 4, 2); } }
        
        if (f.windowData) { 
            f.windowData.forEach((w: any) => { 
                if (isDay) { ctx.fillStyle = '#60a5fa'; } 
                else { ctx.fillStyle = w.isLit ? '#facc15' : '#1e293b'; }
                ctx.fillRect(-f.w/2 + w.x, -w.y, 4, 6); 
            }); 
        }
    }
    ctx.restore();
};

export const drawBoulder = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-size, 0);
    ctx.lineTo(-size * 0.7, -size * 0.8);
    ctx.lineTo(0, -size);
    ctx.lineTo(size * 0.8, -size * 0.6);
    ctx.lineTo(size, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(-size * 0.7, -size * 0.8);
    ctx.lineTo(0, -size);
    ctx.lineTo(-size * 0.2, -size * 0.4);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(size * 0.8, -size * 0.6);
    ctx.lineTo(size * 0.2, 0);
    ctx.fill();
    ctx.restore();
};

export const drawPlatform = (ctx: CanvasRenderingContext2D, centerX: number, groundY: number, isOcean: boolean = false) => {
    const padHeight = 20;
    const padW = 160;
    const pX = centerX - padW/2;
    const pY = groundY - padHeight;

    if (isOcean) {
        ctx.fillStyle = '#1e293b'; 
        const pillarW = 15;
        const pillarH = 100;
        ctx.fillRect(centerX - 60, pY + padHeight, pillarW, pillarH);
        ctx.fillRect(centerX - 7.5, pY + padHeight, pillarW, pillarH);
        ctx.fillRect(centerX + 45, pY + padHeight, pillarW, pillarH);
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(centerX - 60, pY + padHeight + 10); ctx.lineTo(centerX + 45 + pillarW, pY + padHeight + 40);
        ctx.moveTo(centerX + 45 + pillarW, pY + padHeight + 10); ctx.lineTo(centerX - 60, pY + padHeight + 40);
        ctx.stroke();
    } else {
        ctx.fillStyle = '#334155';
        ctx.fillRect(centerX - 60, groundY - 10, 20, 10);
        ctx.fillRect(centerX + 40, groundY - 10, 20, 10);
    }

    const padGrad = ctx.createLinearGradient(pX, pY, pX + padW, pY);
    padGrad.addColorStop(0, '#1e293b');
    padGrad.addColorStop(0.5, '#334155');
    padGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = padGrad;
    ctx.fillRect(pX, pY, padW, padHeight);

    ctx.fillStyle = '#facc15';
    for(let i=10; i<padW; i+=20) {
        ctx.fillRect(pX + i, pY + 2, 10, 4);
    }
    
    ctx.fillStyle = '#ef4444'; 
    ctx.beginPath(); ctx.arc(pX + 5, pY + padHeight/2, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(pX + padW - 5, pY + padHeight/2, 2, 0, Math.PI*2); ctx.fill();
};

export const drawVehicle = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, type: string, color: string, isDay: boolean, dir: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(dir, 1); 

    if (type === 'car') {
        ctx.fillStyle = color; ctx.fillRect(-8, -6, 16, 6);
        ctx.fillStyle = '#1e293b'; ctx.fillRect(-4, -9, 10, 3);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-5, 0, 3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(5, 0, 3, 0, Math.PI*2); ctx.fill();
        if (!isDay) { ctx.fillStyle = 'rgba(255, 255, 200, 0.6)'; ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(40, -10); ctx.lineTo(40, 2); ctx.fill(); }
    } else if (type === 'train') {
        const trainColor = color || '#ef4444';
        const trainLen = 30;
        const trainH = 10;
        
        ctx.fillStyle = trainColor;
        ctx.beginPath();
        ctx.moveTo(-trainLen/2, -trainH);
        ctx.lineTo(trainLen/2 - 5, -trainH);
        ctx.quadraticCurveTo(trainLen/2, -trainH, trainLen/2, -trainH/2); 
        ctx.lineTo(trainLen/2, 0);
        ctx.lineTo(-trainLen/2, 0);
        ctx.fill();
        
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-trainLen/2 + 2, -trainH + 2, trainLen - 10, 3);
        
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(-10, 0, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(10, 0, 3, 0, Math.PI*2); ctx.fill();
        
        if (!isDay) { 
            ctx.fillStyle = 'rgba(255, 255, 200, 0.5)'; 
            ctx.beginPath(); 
            ctx.moveTo(trainLen/2, -5); 
            ctx.lineTo(trainLen/2 + 60, -15); 
            ctx.lineTo(trainLen/2 + 60, 5); 
            ctx.fill(); 
        }
    }
    ctx.restore();
};

export const drawStreetLight = (ctx: CanvasRenderingContext2D, x: number, y: number, h: number, isDay: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#475569'; ctx.fillRect(-1, -h, 2, h);
    ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(8, -h - 2); ctx.lineTo(12, -h + 2); ctx.lineTo(0, -h + 1); ctx.fill();
    if (!isDay) {
        ctx.fillStyle = 'rgba(255, 255, 200, 0.15)'; ctx.beginPath(); ctx.moveTo(10, -h); ctx.lineTo(-20, 0); ctx.lineTo(40, 0); ctx.fill();
        ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(10, -h + 1, 2, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
};
