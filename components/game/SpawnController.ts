
import { GameEngineState } from './types';
import { QuadrantType } from '../../types';
import { SHIPS, BOSS_SHIPS, ExtendedShipConfig } from '../../constants';
import { Enemy } from './Enemy';
import { Asteroid } from './Asteroid';

export const SpawnController = {
    update: (state: GameEngineState, width: number, height: number, difficulty: number, quadrant: QuadrantType, setHud: any) => {
        
        if (state.phase === 'travel') { 
            let maxEnemies = 4; 
            if (quadrant === QuadrantType.GAMA) maxEnemies = 5;
            if (quadrant === QuadrantType.DELTA) maxEnemies = 6;

            const canSpawn = state.enemies.length < maxEnemies;

            // ENEMY SPAWNING
            if (canSpawn && Date.now() - state.lastSpawn > 1500 && !state.rescueMode) { 
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
                if (isRareAlien) spawnBatch = 1; 
                else {
                    if (quadrant === QuadrantType.GAMA) spawnBatch = 2; 
                    if (quadrant === QuadrantType.DELTA) spawnBatch = Math.random() > 0.5 ? 2 : 1;
                }
                if (state.enemies.length + spawnBatch > maxEnemies) spawnBatch = maxEnemies - state.enemies.length;

                if (spawnBatch > 0) {
                    const squadId = Math.floor(Math.random() * 100000);
                    const startX = Math.random() * (width - 200) + 100;
                    for(let i=0; i<spawnBatch; i++) {
                        const offset = i * 60; 
                        state.enemies.push(new Enemy(startX + offset, -50 - (Math.abs(offset)*0.5), 'fighter', selectedShip, difficulty, quadrant, squadId, offset)); 
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
