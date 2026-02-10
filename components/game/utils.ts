
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

export const calculateDamage = (baseDamage: number, type: string, targetType: 'hull' | 'shield', shieldColor?: string) => {
    let powerMult = 1.0;
    let disruptionMult = 1.0;

    if (type === 'laser' || type === 'bolt' || type === 'gun_bolt' || type === 'exotic_phaser_sweep' || type === 'exotic_electric') {
        powerMult = 0.4;
        disruptionMult = 1.5;
    } else if (type === 'projectile' || type === 'cannon' || type === 'gun_vulcan' || type === 'gun_heavy' || type === 'gun_repeater' || type === 'gun_plasma' || type === 'gun_hyper') {
        powerMult = 1.2;
        disruptionMult = 0.4;
    } else if (type === 'blaster') {
        // Personal Blaster: Neutral damage profile
        powerMult = 1.0;
        disruptionMult = 1.0;
    } else if (type.includes('missile') || type.includes('mine') || type === 'rocket' || type === 'firework_shell' || type === 'octo_shell') {
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
        let pRes = 1.0;
        let dRes = 1.0;

        if (shieldColor === '#ef4444') { 
            dRes = 0.5; 
            pRes = 1.5; 
        } else if (shieldColor === '#3b82f6') {
            pRes = 0.5;
            dRes = 1.5;
        } 
        
        const powerComponent = (baseDamage * powerMult) * pRes;
        const disruptionComponent = (baseDamage * disruptionMult) * dRes;
        return powerComponent + disruptionComponent;
    } else {
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
