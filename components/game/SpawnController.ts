
import { GameEngineState } from './types';
import { QuadrantType } from '../../types';
import { SHIPS, BOSS_SHIPS, ExtendedShipConfig } from '../../constants';
import { Enemy } from './Enemy';
import { Asteroid } from './Asteroid';

export const SpawnController = {
    update: (state: GameEngineState, width: number, height: number, difficulty: number, quadrant: QuadrantType, setHud: any, planetId: string, speedMult: number = 1.0) => {
        
        if (state.phase === 'travel') { 
            let maxEnemies = 4; 
            if (quadrant === QuadrantType.GAMA) maxEnemies = 5;
            if (quadrant === QuadrantType.DELTA) maxEnemies = 8; // Increased buffer to keep screen busy

            const canSpawn = state.enemies.length < maxEnemies;
            
            // SPAWN DELAY LOGIC
            let spawnDelay = 1500;
            
            if (quadrant === QuadrantType.DELTA) {
                // Goal: Maintain ~6 enemies on screen.
                // Dynamic flow: If enemies are low, speed up spawn, but respect minimum spacing.
                
                if (state.enemies.length < 3) {
                     // Was 200ms, increased to 800ms to prevent overlap in p10/p11 patterns
                     spawnDelay = 800; 
                } else {
                     // Interval = (Time To Traverse Path) / 6
                     const speed = 3 * speedMult; 
                     let pathLength = height + 200; 
                     if (planetId === 'p10') pathLength = width * 1.2; 
                     else if (planetId === 'p11') pathLength = width * 1.5; // Arc length approx
                     else if (planetId === 'p12') pathLength = Math.hypot(width, height);

                     const timeOnScreenFrames = pathLength / speed;
                     const timeOnScreenMs = (timeOnScreenFrames / 60) * 1000;
                     
                     spawnDelay = timeOnScreenMs / 6;
                     // Clamp between 800ms and 2000ms
                     spawnDelay = Math.max(800, Math.min(2000, spawnDelay)); 
                }
            }

            // ENEMY SPAWNING
            if (canSpawn && Date.now() - state.lastSpawn > spawnDelay && !state.rescueMode) { 
               let spawnPool: ExtendedShipConfig[] = [];
                let isRareAlien = false;
                let shipIndexBase = 0;
                if (quadrant === QuadrantType.ALFA) shipIndexBase = 0;
                else if (quadrant === QuadrantType.BETA) shipIndexBase = 1;
                else if (quadrant === QuadrantType.GAMA) shipIndexBase = 2;
                else if (quadrant === QuadrantType.DELTA) shipIndexBase = 3;

                if (quadrant === QuadrantType.GAMA || quadrant === QuadrantType.DELTA) {
                    const alienChance = quadrant === QuadrantType.DELTA ? 0.15 : 0.05;
                    if (Math.random() < alienChance) {
                        spawnPool = SHIPS.filter(s => s.isAlien);
                        isRareAlien = true;
                    }
                }

                if (!isRareAlien) {
                    const shipA = SHIPS[shipIndexBase];
                    const shipB = SHIPS[Math.min(SHIPS.length - 1, shipIndexBase + 1)]; 
                    const progress = (difficulty - 1) % 3; 
                    const chanceB = 0.2 + (progress * 0.3); 
                    if (Math.random() < chanceB) spawnPool = [shipB]; else spawnPool = [shipA];
                }

                const selectedShip = spawnPool[Math.floor(Math.random() * spawnPool.length)] || SHIPS[0]; 
                
                let spawnBatch = 1;
                let specificPattern = '';
                let specificStartX = -999; // Sentinel
                let specificStartY = -999;

                // DELTA SECTOR SPECIFIC LOGIC
                if (quadrant === QuadrantType.DELTA) {
                    spawnBatch = 1; // Always Solo in Delta for precise control
                    state.waveCounter++; 
                    
                    if (planetId === 'p10') {
                        // Horizontal Rows: Series of 3 Left->Right, then 3 Right->Left
                        const seriesIndex = Math.floor((state.waveCounter - 1) / 3);
                        const isRightDirection = seriesIndex % 2 === 0; // Even series go Right (spawn Left)
                        
                        // 3 Levels above bottom 1/2 (height * 0.5)
                        // Area is 0 to H*0.5. Levels: 15%, 30%, 45%
                        const levelInSeries = (state.waveCounter - 1) % 3;
                        const levels = [height * 0.15, height * 0.28, height * 0.41];
                        
                        specificPattern = 'delta_h_rows';
                        specificStartY = levels[levelInSeries];
                        specificStartX = isRightDirection ? -60 : width + 60;
                    } 
                    else if (planetId === 'p11') {
                        // Circle Loop: Enter Top Left, Exit Top Right
                        // Visual: U-Turn / Semi-Circle
                        specificPattern = 'delta_circle';
                        specificStartX = -50; // Start Left off-screen
                        specificStartY = 50;  // Top
                    } 
                    else if (planetId === 'p12') {
                        // X Pattern
                        specificPattern = 'delta_x';
                        specificStartX = Math.random() > 0.5 ? 20 : width - 20;
                        specificStartY = -50;
                    }
                } 
                else {
                    // Standard logic for other sectors
                    if (isRareAlien) spawnBatch = 1; 
                    else {
                        if (quadrant === QuadrantType.GAMA) spawnBatch = 2; 
                    }
                    if (state.enemies.length + spawnBatch > maxEnemies) spawnBatch = maxEnemies - state.enemies.length;
                    specificStartX = Math.random() * (width - 200) + 100;
                }

                if (spawnBatch > 0) {
                    const squadId = Math.floor(Math.random() * 100000);
                    
                    for(let i=0; i<spawnBatch; i++) {
                        const offset = i * 60;
                        
                        let spawnX = specificStartX !== -999 ? specificStartX : (specificStartX + offset);
                        let spawnY = specificStartY !== -999 ? specificStartY : (-50 - (Math.abs(offset)*0.5));
                        
                        // Small jitter for batch spawns if not specific pattern
                        if (specificPattern === '' && spawnBatch > 1) {
                             spawnX = (Math.random() * (width - 200) + 100) + offset;
                        }

                        state.enemies.push(new Enemy(
                            spawnX, 
                            spawnY, 
                            'fighter', 
                            selectedShip, 
                            difficulty, 
                            quadrant, 
                            squadId, 
                            offset, 
                            specificPattern
                        )); 
                    }
                    state.lastSpawn = Date.now(); 
                }
            } 
            
            // ASTEROID SPAWNING
            if (state.asteroids.length < 3 && Math.random() > 0.99 && !state.rescueMode) {
                state.asteroids.push(new Asteroid(width, difficulty, quadrant));
            }

            // BOSS SPAWNING
            if (state.time <= 0) { 
                state.phase = 'boss'; 
                state.enemies = []; 
                const bossConfig = BOSS_SHIPS[Math.floor(Math.random() * BOSS_SHIPS.length)]; 
                state.enemies.push(new Enemy(width/2, -200, 'boss', bossConfig, difficulty, quadrant)); 
                setHud((h: any) => ({...h, alert: "BOSS DETECTED", alertType: 'alert'})); 
            } else if (state.frame % 60 === 0) {
                state.time--; 
            }
        }
    }
};
