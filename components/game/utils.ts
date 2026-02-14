
import { QuadrantType } from '../../types';

export const ASTEROID_VARIANTS = [
    { color: '#3b82f6', type: 'ice', loot: ['water', 'fuel'] }, 
    { color: '#e2e8f0', type: 'platinum', loot: ['platinum', 'titanium', 'silver'] }, 
    { color: '#6b7280', type: 'rock', loot: ['iron', 'copper', 'chromium', 'titanium'] }, 
    { color: '#78350f', type: 'copper', loot: ['copper', 'iron'] }, 
    { color: '#fbbf24', type: 'gold', loot: ['gold', 'copper'] }, 
    { color: '#ef4444', type: 'rust', loot: ['iron', 'copper', 'gold'] }, 
    { color: '#d946ef', type: 'rare', loot: ['lithium', 'iridium', 'platinum'] }, 
];

export const OCTO_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#ef4444', '#a855f7'];

export const getShieldType = (color: string): 'kinetic' | 'energy' | 'omni' => {
    // SUPREME/OMNI SHIELDS (White)
    if (color === '#ffffff') {
        return 'omni';
    }
    // KINETIC SHIELDS (Red, Purple, Gold)
    // Strong vs Bullets, Weak vs Energy, Stops Ordnance
    if (color === '#ef4444' || color === '#a855f7' || color === '#fbbf24') {
        return 'kinetic';
    }
    // ENERGY SHIELDS (Blue, Green, Cyan)
    // Strong vs Energy, Weak vs Bullets, Lets Ordnance Pass
    return 'energy';
};

export const calculateDamage = (baseDamage: number, type: string, targetType: 'hull' | 'shield', shieldColor?: string) => {
    let powerMult = 1.0;
    let disruptionMult = 1.0;

    // Determine Weapon Characteristics
    if (type === 'laser' || type === 'bolt' || type === 'gun_bolt' || type === 'exotic_phaser_sweep' || type === 'exotic_electric') {
        // ENERGY WEAPON
        powerMult = 0.4;     // Weak vs Hull/Kinetic Shield
        disruptionMult = 1.5; // Strong vs Energy Shield
    } else if (type === 'projectile' || type === 'cannon' || type === 'gun_vulcan' || type === 'gun_heavy' || type === 'gun_repeater' || type === 'gun_plasma' || type === 'gun_hyper') {
        // KINETIC WEAPON
        powerMult = 1.2;      // Strong vs Hull/Energy Shield
        disruptionMult = 0.4; // Weak vs Kinetic Shield
    } else if (type === 'blaster') {
        powerMult = 1.0;
        disruptionMult = 1.0;
    } else if (type.includes('missile') || type.includes('mine') || type === 'bomb' || type === 'rocket' || type === 'firework_shell' || type === 'octo_shell') {
        // ORDNANCE
        powerMult = 1.0;
        disruptionMult = 1.0;
        if (type.includes('emp')) {
            powerMult = 0.0;
            disruptionMult = 5.0; 
        }
    } else if (type === 'explosion') {
        powerMult = 1.0;
        disruptionMult = 1.0;
    }

    if (targetType === 'shield' && shieldColor) {
        const shieldType = getShieldType(shieldColor);
        let pRes = 1.0;
        let dRes = 1.0;

        if (shieldType === 'omni') {
            // Supreme Shield: Strong resistance to EVERYTHING
            pRes = 0.5;
            dRes = 0.5;
        } else if (shieldType === 'kinetic') { 
            // Kinetic Shield (Red/Purple): Resists Kinetic (power), Weak to Energy (disruption)
            pRes = 0.4;  // Resists Bullets
            dRes = 2.0;  // Weak to Lasers
        } else {
            // Energy Shield (Blue/Green): Resists Energy (disruption), Weak to Kinetic (power)
            pRes = 2.0;  // Weak to Bullets
            dRes = 0.4;  // Resists Lasers
        }
        
        // "powerMult" maps to Physical/Kinetic damage
        // "disruptionMult" maps to Energy/Disruption damage
        const powerComponent = (baseDamage * powerMult) * pRes;
        const disruptionComponent = (baseDamage * disruptionMult) * dRes;
        return powerComponent + disruptionComponent;
    } else {
        // Hull Damage
        return baseDamage * powerMult;
    }
};

export const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
};

export const mixColor = (c1: string, c2: string, weight: number) => {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    const w = Math.min(1, Math.max(0, weight));
    const r = Math.round(rgb1.r * (1 - w) + rgb2.r * w);
    const g = Math.round(rgb1.g * (1 - w) + rgb2.g * w);
    const b = Math.round(rgb1.b * (1 - w) + rgb2.b * w);
    return `rgb(${r},${g},${b})`;
};

export const getAlienColors = (q: QuadrantType) => {
    switch(q) {
        case QuadrantType.ALFA: return { hull: '#f97316', wing: '#fdba74' };
        case QuadrantType.BETA: return { hull: '#7f1d1d', wing: '#fca5a5' };
        case QuadrantType.GAMA: return { hull: '#1e3a8a', wing: '#93c5fd' };
        case QuadrantType.DELTA: return { hull: '#334155', wing: '#cbd5e1' };
        default: return { hull: '#f97316', wing: '#fdba74' };
    }
};
