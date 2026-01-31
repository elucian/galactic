
import { ExtendedShipConfig, WEAPONS, EXOTIC_WEAPONS, SHIELDS, EXOTIC_SHIELDS } from '../../constants';
import { ShipPart, Shield, EquippedWeapon, WeaponType } from '../../types';
import { getEngineCoordinates, getWingMounts } from '../../utils/drawingUtils';

export const drawRetro = (ctx: CanvasRenderingContext2D, x: number, y: number, angleDeg: number, usingWater: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    const rad = (angleDeg * Math.PI) / 180;
    ctx.rotate(rad);
    const flicker = 0.8 + Math.random() * 0.4;
    const len = 30 * flicker; 
    const w = 6; 
    ctx.beginPath(); ctx.moveTo(-w/2, 0); ctx.lineTo(0, -len); ctx.lineTo(w/2, 0); ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, -len);
    if (usingWater) { grad.addColorStop(0, '#e0f2fe'); grad.addColorStop(0.4, '#3b82f6'); grad.addColorStop(1, 'rgba(59, 130, 246, 0)'); } 
    else { grad.addColorStop(0, '#fff'); grad.addColorStop(0.2, '#fbbf24'); grad.addColorStop(1, 'rgba(251, 191, 36, 0)'); }
    ctx.fillStyle = grad; ctx.globalAlpha = 0.9; ctx.fill();
    ctx.restore();
};

export const drawShip = (ctx: CanvasRenderingContext2D, shipData: any, isPlayer = false, movement?: { up: boolean, down: boolean, left: boolean, right: boolean }, usingWater = false, isRescue = false) => { 
    const { config, color, wingColor, cockpitColor, gunColor, secondaryGunColor, gunBodyColor, engineColor, nozzleColor, fitting, equippedWeapons, weaponFireTimes } = shipData; 
    const scale = isPlayer ? 0.6 : 0.5; 
    ctx.save(); 
    ctx.scale(scale, scale); 
    ctx.translate(-50, -50); 
    
    if (isRescue) {
        ctx.save();
        ctx.translate(50, 50);
        
        ctx.fillStyle = '#e2e8f0'; 
        ctx.beginPath();
        ctx.ellipse(0, 5, 20, 28, 0, 0, Math.PI * 2); 
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = cockpitColor || '#0ea5e9';
        ctx.beginPath();
        ctx.ellipse(0, -2, 12, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.ellipse(-4, -6, 3, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = engineColor || '#334155';
        ctx.fillRect(-6, 28, 12, 6);
        
        if (movement?.up) {
             ctx.fillStyle = '#f97316';
             ctx.beginPath();
             ctx.moveTo(-4, 34);
             ctx.lineTo(0, 48); 
             ctx.lineTo(4, 34);
             ctx.fill();
        } else {
             ctx.fillStyle = '#f97316';
             ctx.globalAlpha = 0.6;
             ctx.beginPath();
             ctx.moveTo(-3, 34);
