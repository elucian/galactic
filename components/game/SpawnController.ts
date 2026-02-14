
import { GameEngineState } from './types';
import { QuadrantType } from '../../types';
import { SHIPS, BOSS_SHIPS, ExtendedShipConfig, PLANETS } from '../../constants';
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
                if (state.enemies.length < 3) {
                     spawnDelay = 800; 
                } else {
                     const speed = 3 * speedMult; 
                     let pathLength = height + 200; 
                     if (planetId === 'p10') pathLength = width * 1.2; 
                     else if (planetId === 'p11') pathLength = width * 1.5; 
                     else if (planetId === 'p12') pathLength = Math.hypot(width, height);

                     const timeOnScreenFrames = pathLength / speed;
                     const timeOnScreenMs = (timeOnScreenFrames / 60) * 1000;
                     
                     spawnDelay = timeOnScreenMs / 6;
                     spawnDelay = Math.max(800, Math.min(2000, spawnDelay)); 
                }
            } else if (quadrant === QuadrantType.GAMA) {
                spawnDelay = 2000; // Slower spawn for columns to clear
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

                const baseConfig = spawnPool[Math.floor(Math.random() * spawnPool.length)] || SHIPS[0]; 
                
                // BOMBER LOGIC
                let isBomber = false;
                const pIndex = PLANETS.findIndex(p => p.id === planetId);
                
                if (pIndex >= 3) { // Start from Beta (idx 3)
                    const range = 8; // p12(11) - p4(3) = 8
                    const step = Math.min(range, pIndex - 3);
                    const bomberChance = 0.05 + (step / range) * 0.25;
                    
                    if (Math.random() < bomberChance) {
                        isBomber = true;
                    }
                }

                const selectedShip = isBomber 
                    ? { ...baseConfig, defaultGuns: 0, name: baseConfig.name + ' Bomber' } 
                    : baseConfig;

                let spawnBatch = 1;
                let specificPattern = '';
                let specificStartX = -999; // Sentinel
                let specificStartY = -999;

                // SECTOR SPECIFIC FORMATION LOGIC
                if (quadrant === QuadrantType.DELTA) {
                    spawnBatch = 1; // Always Solo in Delta for precise control
                    state.waveCounter++; 
                    
                    if (planetId === 'p10') {
                        const seriesIndex = Math.floor((state.waveCounter - 1) / 3);
                        const isRightDirection = seriesIndex % 2 === 0;
                        const levelInSeries = (state.waveCounter - 1) % 3;
                        const levels = [height * 0.15, height * 0.28, height * 0.41];
                        specificPattern = 'delta_h_rows';
                        specificStartY = levels[levelInSeries];
                        specificStartX = isRightDirection ? -60 : width + 60;
                    } 
                    else if (planetId === 'p11') {
                        specificPattern = 'delta_circle';
                        specificStartX = -50; 
                        specificStartY = 50;  
                    } 
                    else if (planetId === 'p12') {
                        specificPattern = 'delta_x';
                        specificStartX = Math.random() > 0.5 ? 20 : width - 20;
                        specificStartY = -50;
                    }
                } 
                else if (quadrant === QuadrantType.GAMA) {
                    // GAMMA: Column formation
                    specificPattern = 'sine';
                    if (width >= 1024) spawnBatch = 3;
                    else if (width >= 768) spawnBatch = 2;
                    else spawnBatch = 1;
                }
                else {
                    // ALFA / BETA: Random positions
                    if (isRareAlien) spawnBatch = 1; 
                    else {
                        // Beta might have 2 sometimes but standard is 1 usually
                        if (quadrant === QuadrantType.BETA && Math.random() > 0.7) spawnBatch = 2;
                    }
                    specificStartX = Math.random() * (width - 200) + 100;
                }

                if (state.enemies.length + spawnBatch > maxEnemies) spawnBatch = maxEnemies - state.enemies.length;

                if (spawnBatch > 0) {
                    const squadId = Math.floor(Math.random() * 100000);
                    
                    for(let i=0; i<spawnBatch; i++) {
                        const offset = i * 60;
                        
                        let spawnX = 0;
                        let spawnY = 0;

                        if (quadrant === QuadrantType.GAMA) {
                             // Override Position for Gamma Columns
                             let cols = 1;
                             if (width >= 1024) cols = 3;
                             else if (width >= 768) cols = 2;
                             
                             let ratio = 0.5;
                             if (cols === 2) ratio = i === 0 ? 0.3 : 0.7;
                             if (cols === 3) ratio = i === 0 ? 0.2 : (i === 1 ? 0.5 : 0.8);
                             
                             spawnX = width * ratio;
                             spawnY = -50 - (Math.random() * 50); // Slight Y variation for stream effect
                        } else {
                             // Default Position Logic (Delta, Alfa, Beta)
                             spawnX = specificStartX !== -999 ? specificStartX : (specificStartX + offset);
                             spawnY = specificStartY !== -999 ? specificStartY : (-50 - (Math.abs(offset)*0.5));
                             
                             // Jitter for standard batches in Alfa/Beta
                             if (specificPattern === '' && spawnBatch > 1) {
                                  // Re-randomize X if multiple spawned but not specifically patterned
                                  // Note: specificStartX is already random for Alfa/Beta, 
                                  // but to spread them out horizontally if they clump:
                                  if (quadrant !== QuadrantType.DELTA) {
                                      spawnX = (Math.random() * (width - 200) + 100);
                                  }
                             }
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
