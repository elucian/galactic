
import { GameEngineState, Projectile } from './types';
import { audioService } from '../../services/audioService';
import { WEAPONS, EXOTIC_WEAPONS, ExtendedShipConfig } from '../../constants';
import { WeaponType, Shield } from '../../types';
import { calculateDamage, OCTO_COLORS } from './utils';
import { getWingMounts } from '../../utils/drawingUtils';

// --- DAMAGE LOGIC ---

export const createExplosion = (state: GameEngineState, x: number, y: number, color: string, count: number, type: 'standard' | 'boss' | 'asteroid' | 'mine' | 'fireworks' | 'smoke' | 'shield_effect' | 'player' = 'standard') => { 
    state.particles.push({ x, y, vx: 0, vy: 0, life: 0.5, color: '#ffffff', size: type === 'boss' ? 50 : 25 }); 
    for(let i=0; i<count; i++) { 
        const angle = Math.random() * Math.PI * 2; 
        const speed = Math.random() * (type === 'boss' ? 12 : 8) + 2; 
        let pColor = color;
        if (type === 'fireworks') { if (Math.random() > 0.5) pColor = OCTO_COLORS[Math.floor(Math.random() * OCTO_COLORS.length)]; }
        state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.0 + Math.random() * 0.5, color: Math.random() > 0.5 ? pColor : '#ffffff', size: Math.random()*3+2 }); 
    } 
};

export const takeDamage = (state: GameEngineState, amt: number, type: string, shield: Shield | null, secondShield: Shield | null, setHud: any) => {
    if (state.rescueMode) return;
    state.shakeX = 15; state.shakeY = 15;
    let activeShieldColor = ''; 
    if (state.sh1 > 0 && shield) activeShieldColor = shield.color; 
    else if (state.sh2 > 0 && secondShield) activeShieldColor = secondShield.color;
    
    let finalDmg = 0;
    
    // CHECK SHIELD TOGGLE
    const shieldActive = state.shieldsEnabled && (state.sh1 > 0 || state.sh2 > 0);

    if (shieldActive) {
        finalDmg = calculateDamage(amt, type, 'shield', activeShieldColor);
        if (state.sh1 > 0) { state.sh1 = Math.max(0, state.sh1 - finalDmg); } else { state.sh2 = Math.max(0, state.sh2 - finalDmg); }
        state.wasShieldHit = true; 
    } else {
        // Direct Hull Hit
        finalDmg = calculateDamage(amt, type, 'hull'); 
        state.hp = Math.max(0, state.hp - finalDmg);
        if (state.hp <= 0) {
            state.hp = 0; state.rescueMode = true; state.asteroids = []; state.bullets = [];
            audioService.updateReactorHum(false, 0); 
            createExplosion(state, state.px, state.py, '#ef4444', 50, 'boss'); 
            audioService.playExplosion(0, 2.0, 'player'); 
            setHud((h: any) => ({...h, alert: "CRITICAL FAILURE - CAPSULE EJECTED", alertType: 'alert'}));
        }
    }
};

export const createAreaDamage = (state: GameEngineState, x: number, y: number, radius: number, damage: number, shield: Shield | null, secondShield: Shield | null, setHud: any) => { 
    state.enemies.forEach(e => { 
        if (e.hp > 0) { 
            const dist = Math.hypot(e.x - x, e.y - y); 
            if (dist < radius) { 
                const factor = 1 - (dist / radius); 
                const dmg = damage * factor; 
                if (dmg > 5) { 
                    e.damageHull(dmg, 'explosion', false, false); 
                    createExplosion(state, e.x, e.y, '#f97316', 2); 
                } 
            } 
        } 
    }); 
    if (!state.rescueMode) { 
        const dist = Math.hypot(state.px - x, state.py - y); 
        if (dist < radius) { 
            const factor = 1 - (dist / radius); 
            const dmg = damage * factor * 0.5; 
            if (dmg > 5) { 
                takeDamage(state, dmg, 'explosion', shield, secondShield, setHud); 
            } 
        } 
    } 
};

// --- FIRING LOGIC ---

export const fireMissile = (state: GameEngineState) => { 
    if (state.missiles > 0) { 
        const isEmp = state.missiles % 2 !== 0; 
        state.missiles--; 
        state.lastMissileFire = Date.now(); 
        state.bullets.push({ x: state.px, y: state.py, vx: 0, vy: -3, vz: 0, damage: 200, color: isEmp ? '#22d3ee' : '#ef4444', type: isEmp ? 'missile_emp' : 'missile', life: 600, isEnemy: false, width: 12, height: 28, homingState: 'launching', launchTime: state.frame, headColor: isEmp ? '#22d3ee' : '#ef4444', finsColor: isEmp ? '#0ea5e9' : '#ef4444', turnRate: 0.05, maxSpeed: 14, z: 0 }); 
        audioService.playWeaponFire(isEmp ? 'emp' : 'missile'); 
    } 
};

export const fireMine = (state: GameEngineState, side: 'left' | 'right' | 'toggle' | 'both' = 'toggle') => { 
    const cost = side === 'both' ? 2 : 1;
    if (state.mines >= cost) { 
        const isEmp = state.mines % 2 !== 0; 
        state.mines -= cost; 
        state.lastMineFire = Date.now(); 
        
        const speed = 5; 
        const launch = (dir: number) => {
            state.bullets.push({ x: state.px, y: state.py + 20, vx: dir * speed, vy: 0, vz: 0, damage: 250, color: isEmp ? '#22d3ee' : '#fbbf24', type: isEmp ? 'mine_emp' : 'mine', life: 600, isEnemy: false, width: 14, height: 14, homingState: 'launching', launchTime: state.frame, turnRate: 0.08, maxSpeed: 10, z: 0 }); 
        };

        if (side === 'both') {
            launch(-1);
            launch(1);
        } else {
            let vxDir = 0;
            if (side === 'toggle') {
                state.mineSide = !state.mineSide;
                vxDir = state.mineSide ? -1 : 1;
            } else if (side === 'left') {
                vxDir = -1;
            } else if (side === 'right') {
                vxDir = 1;
            }
            launch(vxDir);
        }

        audioService.playWeaponFire('mine'); 
    } 
};

export const fireRedMine = (state: GameEngineState, setHud: any) => { 
    if (state.redMines > 0) { 
        state.redMines--; 
        state.lastRedMineFire = Date.now(); 
        state.omegaSide = !state.omegaSide; 
        const speed = 4; 
        const vx = state.omegaSide ? -speed : speed; 
        state.bullets.push({ x: state.px, y: state.py + 30, vx: vx, vy: 0, vz: 0, damage: 600, color: '#ef4444', type: 'mine_red', life: 600, isEnemy: false, width: 20, height: 20, homingState: 'launching', launchTime: state.frame, turnRate: 0.05, maxSpeed: 8, z: 0, glow: true, glowIntensity: 30 }); 
        audioService.playWeaponFire('mine'); 
        setHud((h: any) => ({...h, alert: 'OMEGA MINE DEPLOYED', alertType: 'warning'})); 
    } 
};

const getCapacitorBeamState = (chargeLevel: number) => {
    let color = '#ef4444'; 
    if (chargeLevel > 80) { color = '#e0f2fe'; } else if (chargeLevel > 40) { color = '#facc15'; }
    return { color };
};

export const firePowerShot = (state: GameEngineState, activeShip: { config: ExtendedShipConfig, fitting: any }, setHud: any, canvasHeight: number) => { 
    const mainWeapon = activeShip.fitting.weapons[0]; 
    const mainDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null; 
    const baseDamage = mainDef ? mainDef.damage : 45; 
    
    const capRatio = state.capacitor / 100;
    const damageMult = 1.0 + (3.0 * capRatio); 
    const dmg = baseDamage * damageMult; 
    
    let powerCost = 5.0 * capRatio;
    if (powerCost < 0.5) powerCost = 0.5;

    if (mainDef?.id === 'exotic_star_shatter') powerCost *= 1.5; 
    if (mainDef?.id === 'exotic_phaser_sweep') powerCost *= 2.0; 

    if (state.capacitor <= 0 || state.capacitorLocked) return;

    state.capacitor = Math.max(0, state.capacitor - powerCost);
    if (state.capacitor <= 0.1) {
        state.capacitorLocked = true;
        setHud((h: any) => ({...h, alert: "CAPACITOR DRAINED - RECHARGING", alertType: 'warning'}));
    }

    const lengthMult = 1.0 + (1.0 * capRatio);
    const EXP_GROWTH_RATE = 1.06;

    if (mainDef?.id.includes('exotic')) {
        const isStar = mainDef.id === 'exotic_star_shatter';
        const isRainbow = mainDef.id === 'exotic_rainbow_spread';
        const isFlamer = mainDef.id === 'exotic_flamer';
        const isWave = mainDef.id === 'exotic_wave';
        const isGravity = mainDef.id === 'exotic_gravity_wave';
        const isOrb = mainDef.id === 'exotic_plasma_orb';
        const isElectric = mainDef.id === 'exotic_electric';
        const isOcto = mainDef.id === 'exotic_octo_burst';
        const isPhaser = mainDef.id === 'exotic_phaser_sweep';

        let w = 6;
        let h = 12; 
        let grow = EXP_GROWTH_RATE; 
        let speed = 20; 
        const life = 60;
        let color = mainDef.beamColor || '#fff';
        let type = 'projectile';
        let detY = undefined;
        let isMulti = false;

        if (isOrb) { w = 8; h = 8; speed = 16; grow = 1.05; }
        else if (isWave) { w = 10; h = 6; speed = 16; grow = 1.05; }
        else if (isGravity) { w = 10; h = 6; speed = 16; grow = 1.06; }
        else if (isStar) { w = 12; h = 12; speed = 18; grow = 1.045; } 
        else if (isRainbow) { w = 10; h = 4; speed = 14; }
        else if (isFlamer) { w = 30; h = 30; speed = 20; grow = 1.03; color = '#3b82f6'; }
        else if (isElectric) { type = 'laser'; w = 4; h = 20; speed = 28; }
        else if (isOcto) { 
            type = 'octo_shell';
            w = 12; h = 12; grow = 0; speed = 12; 
            color = OCTO_COLORS[Math.floor(Math.random() * OCTO_COLORS.length)];
            const distRatio = 0.5 + ((Math.random() + Math.random()) / 2) * 0.5; 
            const dist = canvasHeight * distRatio;
            detY = state.py - dist;
            isMulti = Math.random() > 0.7; 
        }
        else if (isPhaser) { type = 'laser'; w = 5; h = 40; speed = 32; color = '#d946ef'; }

        if (isPhaser || isElectric) {
            h = h * lengthMult;
        } else {
            w = w * (1 + 0.5 * capRatio);
            h = h * lengthMult;
        }

        const spawnY = state.py - 30 - (h / 2);

        state.bullets.push({
            x: state.px, y: spawnY,
            vx: 0, vy: -speed, 
            damage: dmg,
            color: color,
            type: type,
            life: life,
            isEnemy: false,
            width: w,
            height: h,
            weaponId: mainDef.id,
            isOvercharge: true,
            isMain: true,
            growthRate: grow, 
            initialWidth: w, 
            initialHeight: h,
            glow: true,
            glowIntensity: 30 * capRatio, 
            detonationY: detY,
            isMulticolor: isMulti
        });
        
        if (isPhaser) audioService.playWeaponFire('phaser', 0); 
        else audioService.playWeaponFire('exotic_power', 0);
    } else { 
        const beamState = getCapacitorBeamState(state.capacitor);
        const baseW = 4; 
        const baseH = 25; 
        
        const width = baseW * (1 + 0.4 * capRatio); 
        const height = baseH * lengthMult; 
        const color = beamState.color;

        const spawnY = state.py - 30 - (height / 2);

        state.bullets.push({ 
            x: state.px, y: spawnY, vx: 0, vy: -35, damage: dmg, color: color, type: 'laser', life: 50, isEnemy: false, width: width, height: height, glow: true, glowIntensity: 20 * capRatio, isMain: true, weaponId: mainWeapon?.id || 'gun_pulse', isOvercharge: true,
            growthRate: EXP_GROWTH_RATE, initialWidth: width, initialHeight: height
        }); 
        audioService.playWeaponFire('mega', 0, activeShip.config.id);
    } 
    
    state.weaponFireTimes[0] = Date.now(); 
    state.weaponHeat[0] = Math.min(100, (state.weaponHeat[0] || 0) + 1.0); 
    state.lastRapidFire = Date.now(); 
};

export const fireNormalShot = (state: GameEngineState, activeShip: { config: ExtendedShipConfig, fitting: any, gunColor?: string }) => { 
    if (state.weaponCoolDownTimer > state.frame) return;
    if (state.capacitorLocked) return;

    const mainWeapon = activeShip.fitting.weapons[0]; 
    const mainDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null; 
    const fireRate = (mainDef?.id === 'exotic_rainbow_spread' || mainDef?.id === 'exotic_star_shatter') ? 6 : (mainDef ? mainDef.fireRate : 4); 
    const delay = 1000 / fireRate; 
    
    if (Date.now() - state.lastRapidFire > delay) { 
        if (mainDef && mainDef.isAmmoBased) { 
            const gun = state.gunStates[0]; 
            if (!gun || gun.mag <= 0) return; 
            gun.mag--; 
        } else { 
            const isExotic = mainDef?.id.includes('exotic');
            const capacitorCost = isExotic ? 2.0 : 1.0;
            if (state.capacitor < capacitorCost) return; 
            state.capacitor -= capacitorCost; 
        } 
        
        let damage = mainDef ? mainDef.damage : 45; 
        let weaponId = mainDef ? mainDef.id : 'gun_pulse'; 
        let crystalColor = (mainDef?.beamColor) || (activeShip.gunColor || activeShip.config.noseGunColor || '#f87171'); 
        
        if (mainDef?.id.includes('exotic')) {
            const sprayAngleDeg = (Math.random() * 30) - 15; 
            const sprayRad = sprayAngleDeg * (Math.PI / 180);
            const speed = 20;
            
            if (mainDef.id === 'exotic_flamer') {
                crystalColor = '#3b82f6'; 
            } else if (mainDef.id === 'exotic_octo_burst') {
                crystalColor = OCTO_COLORS[Math.floor(Math.random() * OCTO_COLORS.length)];
            } else if (mainDef.id === 'exotic_rainbow_spread') {
                const rainbowColors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
                crystalColor = rainbowColors[Math.floor(Math.random() * rainbowColors.length)];
            } else if (mainDef.id !== 'exotic_phaser_sweep') {
                audioService.playWeaponFire('exotic_single', 0);
            }

            let w = 6; 
            let h = 12;

            if (mainDef.id === 'exotic_rainbow_spread') { w = 16; h = 4; }
            if (mainDef.id === 'exotic_flamer') { w = 12; h = 12; }
            if (mainDef.id === 'exotic_phaser_sweep') { h = 40; w = 3.5; }

            if (mainDef.id === 'exotic_octo_burst') {
                state.bullets.push({
                    x: state.px, y: state.py - 30, 
                    vx: Math.sin(sprayRad) * 12, 
                    vy: -12, 
                    damage: damage,
                    color: crystalColor,
                    type: 'octo_shell',
                    life: 80,
                    isEnemy: false,
                    width: 8, height: 8,
                    glow: true,
                    glowIntensity: 20,
                    isMain: true,
                    weaponId,
                    growthRate: 0,
                    detonationY: undefined 
                });
                audioService.playWeaponFire('missile', 0);
            } else if (mainDef.id === 'exotic_phaser_sweep') {
                const spawnY = state.py - 30 - (h / 2);
                 state.bullets.push({ 
                    x: state.px, y: spawnY, 
                    vx: Math.sin(sprayRad) * speed, 
                    vy: -Math.cos(sprayRad) * speed, 
                    damage, 
                    color: crystalColor, 
                    type: 'laser', 
                    life: 50, 
                    isEnemy: false, 
                    width: w, 
                    height: h, 
                    glow: true, 
                    glowIntensity: 5, 
                    isMain: true, 
                    weaponId,
                    growthRate: 0 
                });
                audioService.playWeaponFire('phaser', 0);
            } else {
                const growth = (mainDef.id === 'exotic_flamer') ? 1.025 : 0; 
                if (mainDef.id === 'exotic_star_shatter') { w = 6; h = 6; }
                state.bullets.push({ 
                    x: state.px, y: state.py - 24, 
                    vx: Math.sin(sprayRad) * speed, 
                    vy: -Math.cos(sprayRad) * speed, 
                    damage, 
                    color: crystalColor, 
                    type: 'projectile', 
                    life: 50, 
                    isEnemy: false, 
                    width: w, 
                    height: h, 
                    glow: true, 
                    glowIntensity: 5, 
                    isMain: true, 
                    weaponId,
                    growthRate: growth 
                });
                if (mainDef.id === 'exotic_flamer') {
                    audioService.playWeaponFire('flame', 0);
                }
            }
        } else { 
            state.bullets.push({ x: state.px, y: state.py - 24, vx: 0, vy: -30, damage, color: crystalColor, type: 'laser', life: 50, isEnemy: false, width: 4, height: 25, glow: true, glowIntensity: 5, isMain: true, weaponId }); 
            audioService.playWeaponFire(mainDef?.type === WeaponType.LASER ? 'laser' : 'cannon', 0, activeShip.config.id); 
        } 
        
        state.weaponFireTimes[0] = Date.now(); 
        const heatAdd = (mainDef && mainDef.type === WeaponType.PROJECTILE) ? 2.0 : 1.0;
        state.weaponHeat[0] = Math.min(100, (state.weaponHeat[0] || 0) + heatAdd); 
        state.lastRapidFire = Date.now(); 
    } 
};

export const fireAlienWeapons = (state: GameEngineState, activeShip: { config: ExtendedShipConfig, fitting: any }) => { 
    const mounts = getWingMounts(activeShip.config); 
    const slots = [0, 1, 2]; 
    const scale = 0.6; 
    let fired = false; 
    
    slots.forEach(slotIdx => { 
        const w = activeShip.fitting.weapons[slotIdx]; 
        if (w && w.id) { 
            const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id); 
            if (wDef) { 
                const lastFire = state.weaponFireTimes[slotIdx] || 0; 
                const delay = 1000 / wDef.fireRate; 
                if (Date.now() - lastFire < delay) return; 
                if (state.energy < wDef.energyCost) return; 
                
                let startX = state.px; 
                let startY = state.py; 
                
                if (slotIdx === 0) { 
                    startY = state.py - 30; 
                } else { 
                    const mountIdx = slotIdx - 1; 
                    const m = mounts[mountIdx]; 
                    startX = state.px + (m.x - 50) * scale; 
                    startY = state.py + (m.y - 50) * scale; 
                } 
                
                const damage = wDef.damage; 
                const color = wDef.beamColor || '#fff'; 
                const bulletSpeed = w.id.includes('exotic') ? 10 : 18; 
                
                if (wDef.id === 'exotic_gravity_wave') { 
                    const angles = [-15, 0, 15]; 
                    angles.forEach(deg => { 
                        const rad = deg * (Math.PI / 180); 
                        state.bullets.push({ x: startX, y: startY, vx: Math.sin(rad) * 8, vy: -Math.cos(rad) * 8, damage, color: '#60a5fa', type: 'projectile', life: 80, isEnemy: false, width: 20, height: 20, weaponId: w.id, growthRate: 0.5 }); 
                    }); 
                } else if (wDef.type === WeaponType.LASER) { 
                    state.bullets.push({ x: startX, y: startY, vx: 0, vy: -30, damage, color, type: 'laser', life: 50, isEnemy: false, width: 4, height: 25, weaponId: w.id }); 
                } else { 
                    state.bullets.push({ x: startX, y: startY, vx: 0, vy: -bulletSpeed, damage, color, type: 'projectile', life: 60, isEnemy: false, width: 4, height: 16, weaponId: w.id }); 
                } 
                
                state.weaponFireTimes[slotIdx] = Date.now(); 
                state.energy -= wDef.energyCost; 
                fired = true; 
            } 
        } 
    }); 
    
    if (fired) { 
        if (activeShip.fitting.weapons.some((w: any) => w?.id === 'exotic_flamer')) { 
            audioService.playWeaponFire('flame', 0, activeShip.config.id); 
        } else { 
            audioService.playWeaponFire('cannon', 0, activeShip.config.id); 
        } 
    } 
};

export const fireWingWeapon = (state: GameEngineState, activeShip: { config: ExtendedShipConfig, fitting: any }, slotIdx: number) => { 
    const mounts = getWingMounts(activeShip.config); 
    const w = activeShip.fitting.weapons[slotIdx];
    
    if (w && w.id) { 
        const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id); 
        if (wDef) { 
            const interval = Math.max(1, Math.floor(60 / wDef.fireRate)); 
            if (state.frame % interval === 0) { 
                if (wDef.isAmmoBased) { 
                    const gun = state.gunStates[slotIdx]; 
                    if (!gun || gun.mag <= 0) return; 
                    gun.mag--; 
                } else if (state.energy < wDef.energyCost) return; 
                
                state.weaponFireTimes[slotIdx] = Date.now(); 
                const scale = 0.6; 
                const m = mounts[slotIdx - 1]; 
                const startX = state.px + (m.x - 50) * scale; 
                const startY = state.py + (m.y - 50) * scale; 
                const damage = wDef.damage; 
                const color = wDef.beamColor || '#fff'; 
                
                if (wDef.id === 'exotic_gravity_wave') { 
                    const angles = [-15, 0, 15]; 
                    angles.forEach(deg => { 
                        const rad = deg * (Math.PI / 180); 
                        state.bullets.push({ x: startX, y: startY, vx: Math.sin(rad) * 8, vy: -Math.cos(rad) * 8, damage, color: '#60a5fa', type: 'projectile', life: 80, isEnemy: false, width: 20, height: 20, weaponId: w.id, growthRate: 0.5 }); 
                    }); 
                } else { 
                    state.bullets.push({ x: startX, y: startY, vx: 0, vy: -20, damage, color, type: wDef.type === WeaponType.LASER ? 'laser' : 'projectile', life: 60, isEnemy: false, width: 4, height: 16, weaponId: w.id }); 
                } 
                if (!wDef.isAmmoBased) state.energy -= wDef.energyCost; 
                audioService.playWeaponFire('cannon', 0, activeShip.config.id); 
            } 
        } 
    } 
};
