
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
            createExplosion(state, state.px, state.py, '#ef4444', 50, 'boss'); 
            audioService.playExplosion(0, 2.0, 'player'); 
            setHud((h: any) => ({...h, alert: "CRITICAL FAILURE - CAPSULE EJECTED", alertType: 'alert'}));
        }
    }
};

export const applyShieldRamDamage = (state: GameEngineState, enemy: any, setHud: any) => {
    if (!state.shieldsEnabled || (state.sh1 <= 0 && state.sh2 <= 0)) return;
    
    // Z-Level Check: Shield ramming requires same plane
    if (Math.abs(enemy.z) > 50) return;
    
    // Damage logic for Shield Ramming
    // Boss takes damage based on shield strength
    const damage = 20; 
    enemy.hp -= damage;
    
    // Boss flashes or reacts
    enemy.vibration = 10;
    
    // Feedback
    createExplosion(state, enemy.x, enemy.y + 40, '#ffffff', 5, 'shield_effect');
    if (state.frame % 10 === 0) {
        audioService.playImpact('shield', 0.5);
    }
};

export const applyJetDamage = (state: GameEngineState, activeJets: {up: boolean, down: boolean, left: boolean, right: boolean}, setHud: any) => {
    const boss = state.enemies.find(e => e.type === 'boss');
    if (!boss || boss.hp <= 0) return;

    // Z-Level Check: Jets cannot burn if Z levels differ
    if (Math.abs(boss.z) > 50) return; 

    const shipX = state.px;
    const shipY = state.py;
    const bossX = boss.x;
    const bossY = boss.y;
    
    // Hitbox offsets for jets relative to ship center
    // Main Jets (Up key -> Fire Rear)
    // Retro Jets (Down key -> Fire Front)
    // Side Jets (Left/Right)
    
    const checkBurn = (jetX: number, jetY: number, radius: number) => {
        const dx = jetX - bossX;
        const dy = jetY - bossY;
        return Math.hypot(dx, dy) < (radius + 40); // 40 is approx Boss half-width
    };

    let hit = false;

    // Rear Jets (Firing Downwards from ship bottom)
    if (activeJets.up) {
        if (checkBurn(shipX, shipY + 70, 40)) hit = true;
    }
    
    // Front Jets (Firing Upwards from ship top/sides)
    if (activeJets.down) {
        if (checkBurn(shipX - 30, shipY - 20, 30)) hit = true;
        if (checkBurn(shipX + 30, shipY - 20, 30)) hit = true;
    }
    
    // Left Jets (Firing Rightwards from left side)
    if (activeJets.right) {
        if (checkBurn(shipX - 40, shipY, 30)) hit = true;
    }
    
    // Right Jets (Firing Leftwards from right side)
    if (activeJets.left) {
        if (checkBurn(shipX + 40, shipY, 30)) hit = true;
    }

    if (hit) {
        const damage = 5; // High frequency low damage
        boss.hp -= damage;
        if (state.frame % 4 === 0) {
            createExplosion(state, boss.x + (Math.random()-0.5)*40, boss.y + (Math.random()-0.5)*40, '#f97316', 2, 'fireworks');
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
        state.bullets.push({ x: state.px, y: state.py, vx: 0, vy: -3, vz: 0, damage: 600, color: isEmp ? '#22d3ee' : '#ef4444', type: isEmp ? 'missile_emp' : 'missile', life: 600, isEnemy: false, width: 12, height: 28, homingState: 'launching', launchTime: state.frame, headColor: isEmp ? '#22d3ee' : '#ef4444', finsColor: isEmp ? '#0ea5e9' : '#ef4444', turnRate: 0.05, maxSpeed: 14, z: 0 }); 
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
            state.bullets.push({ x: state.px, y: state.py + 20, vx: dir * speed, vy: 0, vz: 0, damage: 750, color: isEmp ? '#22d3ee' : '#fbbf24', type: isEmp ? 'mine_emp' : 'mine', life: 600, isEnemy: false, width: 14, height: 14, homingState: 'launching', launchTime: state.frame, turnRate: 0.08, maxSpeed: 10, z: 0 }); 
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
        state.bullets.push({ x: state.px, y: state.py + 30, vx: vx, vy: 0, vz: 0, damage: 1800, color: '#ef4444', type: 'mine_red', life: 600, isEnemy: false, width: 20, height: 20, homingState: 'launching', launchTime: state.frame, turnRate: 0.05, maxSpeed: 8, z: 0, glow: true, glowIntensity: 30 }); 
        audioService.playWeaponFire('mine'); 
        setHud((h: any) => ({...h, alert: 'OMEGA MINE DEPLOYED', alertType: 'warning'})); 
    } 
};

const getCapacitorBeamState = (chargeLevel: number) => {
    let color = '#ef4444'; 
    if (chargeLevel > 80) { color = '#e0f2fe'; } else if (chargeLevel > 40) { color = '#facc15'; }
    return { color };
};

export const firePowerShot = (state: GameEngineState, activeShip: { config: ExtendedShipConfig, fitting: any }, setHud: any, canvasHeight: number, globalScale: number = 1.0) => { 
    let mainWeapon = activeShip.fitting.weapons[0];
    
    // For Alien ships (test mode), if slot 0 is empty, grab any equipped weapon
    if (!mainWeapon && activeShip.config.isAlien) {
        mainWeapon = activeShip.fitting.weapons[1] || activeShip.fitting.weapons[2];
    }

    const mainDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null; 
    const baseDamage = mainDef ? mainDef.damage : 45; 
    
    // Automatic fallback to normal shot if capacitor is depleted
    if (state.capacitor <= 0) {
        state.capacitorLocked = true;
        fireNormalShot(state, activeShip, globalScale);
        return;
    }

    const capRatio = state.capacitor / 100;
    const damageMult = 1.0 + (9.0 * capRatio); 
    const dmg = baseDamage * damageMult; 
    
    const baseCost = 0.5;
    const variableCost = 4.5 * (capRatio * capRatio);
    const totalCost = baseCost + variableCost;

    state.capacitor = Math.max(0, state.capacitor - totalCost); 
    if (state.capacitor <= 0) {
        state.capacitorLocked = true;
        setHud((h: any) => ({...h, alert: "CAPACITOR DRAINED", alertType: 'warning'}));
    }

    const lengthMult = 1.0 + (1.0 * capRatio);
    const EXP_GROWTH_RATE = 1.06;

    // Adjust for ship scale
    const noseOffset = 30 * globalScale;

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

        // Scale projectiles slightly
        const projScale = Math.max(1, globalScale * 0.8);
        w *= projScale;
        h *= projScale;

        // Apply Power Shot Scaling (1.5x Width, 2.0x Length at max charge)
        w = w * (1 + 0.5 * capRatio);
        h = h * lengthMult;

        const spawnY = state.py - noseOffset - (h / 2);

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
        const baseW = 4 * Math.max(1, globalScale * 0.8); 
        const baseH = 25 * Math.max(1, globalScale * 0.8); 
        
        const width = baseW * (1 + 0.5 * capRatio); 
        const height = baseH * lengthMult; 
        const color = beamState.color;

        const spawnY = state.py - noseOffset - (height / 2);

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

export const fireNormalShot = (state: GameEngineState, activeShip: { config: ExtendedShipConfig, fitting: any, gunColor?: string }, globalScale: number = 1.0) => { 
    if (state.weaponCoolDownTimer > state.frame) return;
    
    const mainWeapon = activeShip.fitting.weapons[0]; 
    const mainDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null; 
    const fireRate = (mainDef?.id === 'exotic_rainbow_spread' || mainDef?.id === 'exotic_star_shatter') ? 6 : (mainDef ? mainDef.fireRate : 4); 
    const delay = 1000 / fireRate; 
    
    if (Date.now() - state.lastRapidFire > delay) { 
        let usedPower = false;
        let isImprecise = false;

        if (mainDef && mainDef.isAmmoBased) { 
            const gun = state.gunStates[0]; 
            if (!gun || gun.mag <= 0) return; 
            gun.mag--; 
            usedPower = true;
        } else { 
            const isExotic = mainDef?.id.includes('exotic');
            const cost = isExotic ? 2.0 : 1.0;
            
            if (state.capacitor >= cost && !state.capacitorLocked) {
                state.capacitor -= cost;
                usedPower = true;
            } else if (state.energy >= cost) {
                state.energy -= cost;
                usedPower = true;
                isImprecise = true;
            }
        } 
        
        if (!usedPower) return;

        let damage = mainDef ? mainDef.damage : 45; 
        let weaponId = mainDef ? mainDef.id : 'gun_pulse'; 
        let crystalColor = (mainDef?.beamColor) || (activeShip.gunColor || activeShip.config.noseGunColor || '#f87171'); 
        
        let shotAngle = 0;
        if (isImprecise) {
            const randomFactor = (Math.random() - 0.5) + (Math.random() - 0.5); 
            shotAngle = randomFactor * 15; 
        } else if (mainDef?.id.includes('exotic')) {
            const sprayAngleDeg = (Math.random() * 30) - 15; 
            shotAngle = sprayAngleDeg; 
        }

        const rad = shotAngle * (Math.PI / 180);
        
        // Calculate spawn offset based on scale
        const noseOffset = 24 * globalScale;
        const projScale = Math.max(1, globalScale * 0.8);

        if (mainDef?.id.includes('exotic')) {
            let speed = 20;
            
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

            let w = 6 * projScale; 
            let h = 12 * projScale;

            if (mainDef.id === 'exotic_rainbow_spread') { w = 16 * projScale; h = 4 * projScale; speed = 14; }
            if (mainDef.id === 'exotic_flamer') { w = 30 * projScale; h = 30 * projScale; }
            if (mainDef.id === 'exotic_phaser_sweep') { h = 40 * projScale; w = 3.5 * projScale; speed = 32; }

            const vx = Math.sin(rad) * speed;
            const vy = -Math.cos(rad) * speed;

            if (mainDef.id === 'exotic_octo_burst') {
                state.bullets.push({
                    x: state.px, y: state.py - 30 * globalScale, 
                    vx: Math.sin(rad) * 12, 
                    vy: -12, 
                    damage: damage,
                    color: crystalColor,
                    type: 'octo_shell',
                    life: 80,
                    isEnemy: false,
                    width: 8 * projScale, height: 8 * projScale,
                    glow: true,
                    glowIntensity: 20,
                    isMain: true,
                    weaponId,
                    growthRate: 0,
                    detonationY: undefined 
                });
                audioService.playWeaponFire('missile', 0);
            } else if (mainDef.id === 'exotic_phaser_sweep') {
                const spawnY = state.py - 30 * globalScale - (h / 2);
                 state.bullets.push({ 
                    x: state.px, y: spawnY, 
                    vx, vy, 
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
                if (mainDef.id === 'exotic_star_shatter') { w = 6 * projScale; h = 6 * projScale; }
                state.bullets.push({ 
                    x: state.px, y: state.py - 24 * globalScale, 
                    vx, vy, 
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
            const speed = 30;
            const vx = Math.sin(rad) * speed;
            const vy = -Math.cos(rad) * speed;
            state.bullets.push({ x: state.px, y: state.py - 24 * globalScale, vx, vy, damage, color: crystalColor, type: 'laser', life: 50, isEnemy: false, width: 4 * projScale, height: 25 * projScale, glow: true, glowIntensity: 5, isMain: true, weaponId }); 
            audioService.playWeaponFire(mainDef?.type === WeaponType.LASER ? 'laser' : 'cannon', 0, activeShip.config.id); 
        } 
        
        state.weaponFireTimes[0] = Date.now(); 
        const heatAdd = (mainDef && mainDef.type === WeaponType.PROJECTILE) ? 2.0 : 1.0;
        state.weaponHeat[0] = Math.min(100, (state.weaponHeat[0] || 0) + heatAdd); 
        state.lastRapidFire = Date.now(); 
    } 
};

export const fireAlienWeapons = (state: GameEngineState, activeShip: { config: ExtendedShipConfig, fitting: any }, globalScale: number = 1.0) => {
    if (activeShip.config.wingStyle === 'alien-a') {
        fireNormalShot(state, activeShip, globalScale);
    } else {
        fireWingWeapon(state, activeShip, 1, globalScale);
        fireWingWeapon(state, activeShip, 2, globalScale);
    }
};

export const fireWingWeapon = (state: GameEngineState, activeShip: { config: ExtendedShipConfig, fitting: any }, slotIndex: number, globalScale: number = 1.0) => {
    const weapon = activeShip.fitting.weapons[slotIndex];
    if (!weapon) return;
    
    const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === weapon.id);
    if (!wDef) return;

    const now = Date.now();
    const lastFire = state.weaponFireTimes[slotIndex] || 0;
    const delay = 1000 / wDef.fireRate;
    
    if (now - lastFire < delay) return;

    let canFire = false;
    if (wDef.isAmmoBased) {
        const gunState = state.gunStates[slotIndex];
        if (gunState && gunState.mag > 0 && gunState.reloadTimer === 0) {
            gunState.mag--;
            canFire = true;
        }
    } else {
        const cost = wDef.energyCost;
        if (state.energy >= cost) {
            state.energy -= cost;
            canFire = true;
        }
    }

    if (!canFire) return;

    const mounts = getWingMounts(activeShip.config);
    const mountIdx = slotIndex - 1;
    if (!mounts[mountIdx]) return;
    
    const m = mounts[mountIdx];
    // Coordinate Logic:
    // Ship is drawn centered at state.px, state.py.
    // Ship drawing coordinates are 0-100, center at 50,50.
    // We calculate offset from center (50,50)
    const offsetX = m.x - 50;
    const offsetY = m.y - 50;
    
    // Scale Logic:
    // The player ship is drawn with `ctx.scale(scale, scale)` where scale = 0.6 * globalScale (for player).
    // So visual offset = logical offset * 0.6 * globalScale.
    const shipScale = 0.6 * globalScale;
    
    const spawnX = state.px + (offsetX * shipScale);
    const spawnY = state.py + (offsetY * shipScale);

    let type = 'projectile';
    let color = wDef.beamColor || '#fff';
    // Scale projectile size slightly to match larger ships
    const projScale = Math.max(1, globalScale * 0.8);
    let w = 4 * projScale;
    let h = 16 * projScale;
    let speed = 20;
    let life = 50;
    
    if (wDef.id.includes('exotic')) {
        if (wDef.id === 'exotic_plasma_orb') { w = 8 * projScale; h = 8 * projScale; speed = 16; type = 'projectile'; }
        else if (wDef.id === 'exotic_flamer') { w = 20 * projScale; h = 20 * projScale; speed = 18; color='#3b82f6'; }
        else if (wDef.id === 'exotic_electric') { type = 'laser'; w = 3 * projScale; h = 20 * projScale; speed = 25; color='#00ffff'; }
        else if (wDef.id === 'exotic_wave') { w = 12 * projScale; h = 6 * projScale; speed = 15; }
        else if (wDef.id === 'exotic_rainbow_spread') { w = 8 * projScale; h = 4 * projScale; speed = 14; }
    } else {
        if (wDef.type === WeaponType.LASER) { type = 'laser'; h = 20 * projScale; speed = 25; }
    }

    state.bullets.push({ 
        x: spawnX, 
        y: spawnY, 
        vx: 0, 
        vy: -speed, 
        damage: wDef.damage, 
        color: color, 
        type: type, 
        life: life, 
        isEnemy: false, 
        width: w, 
        height: h, 
        weaponId: wDef.id 
    }); 
    
    if (wDef.id.includes('exotic')) {
        audioService.playWeaponFire('exotic_single', 0);
    } else if (wDef.type === WeaponType.LASER) {
        audioService.playWeaponFire('laser', 0);
    } else {
        audioService.playWeaponFire('cannon', 0);
    }

    state.weaponFireTimes[slotIndex] = now;
    state.weaponHeat[slotIndex] = Math.min(100, (state.weaponHeat[slotIndex] || 0) + 2);
};
