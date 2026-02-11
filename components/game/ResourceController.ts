
import { GameEngineState } from './types';
import { audioService } from '../../services/audioService';
import { WEAPONS, EXOTIC_WEAPONS } from '../../constants';
import { AmmoType, Shield } from '../../types';

export const ResourceController = {
    handleManualRefuel: (state: GameEngineState, maxFuel: number, setHud: any) => {
        if (state.isRefueling) return;
        const hasFuel = state.cargo.some(c => c.type === 'fuel');
        if (hasFuel) {
            state.isRefueling = true; 
            state.refuelType = 'fuel'; 
            state.refuelStartVal = state.fuel;
            state.refuelDuration = 600; // 10s duration
            state.refuelTimer = 0;
            setHud((h: any) => ({...h, alert: "MANUAL REFUEL INITIATED", alertType: 'info'})); 
            audioService.playSfx('buy');
        } else {
            setHud((h: any) => ({...h, alert: "FUEL SUPPLY MISSING", alertType: 'error'}));
            audioService.playSfx('denied');
        }
    },

    handleManualRehydrate: (state: GameEngineState, maxWater: number, setHud: any) => {
        if (state.isRefueling) return;
        const hasWater = state.cargo.some(c => c.type === 'water');
        if (hasWater) {
            state.isRefueling = true; 
            state.refuelType = 'water'; 
            state.refuelStartVal = state.water;
            state.refuelDuration = 600; // 10s duration
            state.refuelTimer = 0;
            setHud((h: any) => ({...h, alert: "MANUAL REHYDRATION INITIATED", alertType: 'info'})); 
            audioService.playSfx('buy');
        } else {
            setHud((h: any) => ({...h, alert: "WATER SUPPLY MISSING", alertType: 'error'}));
            audioService.playSfx('denied');
        }
    },

    handleManualReload: (state: GameEngineState, setHud: any) => {
        if (state.rescueMode) return;
        
        let reloadTriggered = false;
        Object.keys(state.gunStates).forEach(keyStr => {
            const key = parseInt(keyStr); 
            const gun = state.gunStates[key];
            const wId = state.weapons[key]?.id; 
            const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === wId);
            
            if (!wDef || !wDef.isAmmoBased) return;
            
            if (gun.mag < gun.maxMag && gun.reloadTimer === 0) {
                const defType = wDef.defaultAmmo || 'iron';
                const hasAmmo = (state.ammo[defType] || 0) > 0 || Object.values(state.ammo).some((v: number) => v > 0);
                
                if (hasAmmo) { 
                    gun.reloadTimer = Date.now() + 3000; 
                    reloadTriggered = true;
                }
            }
        });

        if (reloadTriggered) {
            setHud((h: any) => ({...h, alert: "MANUAL RELOAD CYCLE STARTED", alertType: 'warning'}));
            audioService.playSfx('click');
        } else {
            audioService.playSfx('denied');
        }
    },

    handleManualEnergy: (state: GameEngineState, setHud: any) => {
        if (state.isEnergizing || state.rescueMode) return;
        
        const energyIdx = state.cargo.findIndex(c => c.type === 'energy');
        if (energyIdx >= 0) {
            state.isEnergizing = true;
            state.energizeTimer = 0;
            setHud((h: any) => ({...h, alert: "ENERGY INJECTION SEQUENCE", alertType: 'info'}));
            audioService.playSfx('buy');
        } else {
            setHud((h: any) => ({...h, alert: "ENERGY CELLS MISSING", alertType: 'error'}));
            audioService.playSfx('denied');
        }
    },

    update: (state: GameEngineState, maxFuel: number, maxWater: number, maxEnergy: number, shield1: Shield | null, shield2: Shield | null, setHud: any) => {
        // 1. REFUELING LOGIC
        if (state.isRefueling) {
            state.refuelTimer++;
            const DURATION = state.refuelDuration || 600;
            const progress = state.refuelTimer / DURATION;
            if (state.refuelType === 'fuel') {
                const target = Math.min(maxFuel, state.fuel + 1.0); 
                state.fuel = state.refuelStartVal + (progress * (target - state.refuelStartVal));
            } else {
                const target = Math.min(maxWater, state.water + 20); 
                state.water = state.refuelStartVal + (progress * (target - state.refuelStartVal));
            }
            if (state.refuelTimer >= DURATION) {
                state.isRefueling = false; state.refuelTimer = 0;
                const cargoIdx = state.cargo.findIndex(c => c.type === state.refuelType);
                if (cargoIdx >= 0) {
                    state.cargo[cargoIdx].quantity--;
                    if (state.cargo[cargoIdx].quantity <= 0) state.cargo.splice(cargoIdx, 1);
                    setHud((h: any) => ({...h, alert: state.refuelType === 'fuel' ? "REFUELING COMPLETE" : "REHYDRATION COMPLETE", alertType: 'success'}));
                    audioService.playSfx('buy');
                } else { setHud((h: any) => ({...h, alert: "ERROR: SUPPLY MISSING", alertType: 'error'})); }
            } else if (state.refuelTimer % 30 === 0) {
                setHud((h: any) => ({...h, alert: state.refuelType === 'fuel' ? `REFUELING... ${Math.floor(progress*100)}%` : `REHYDRATING... ${Math.floor(progress*100)}%`, alertType: 'warning'}));
            }
        } else {
            // AUTOMATIC CRITICAL TRIGGER
            const criticalFuel = state.fuel < maxFuel * 0.1;
            const criticalWater = state.water < maxWater * 0.1;
            if (criticalFuel || criticalWater) {
                if (criticalWater) {
                    const hasWater = state.cargo.some(c => c.type === 'water');
                    if (hasWater) {
                        state.isRefueling = true; state.refuelType = 'water'; state.refuelStartVal = state.water; state.refuelDuration = 600;
                        setHud((h: any) => ({...h, alert: "INITIATING AUTO-REHYDRATION", alertType: 'warning'})); audioService.playSfx('buy'); 
                    } else if (state.frame % 180 === 0) { setHud((h: any) => ({...h, alert: "CRITICAL WATER - OUT OF SUPPLY", alertType: 'error'})); }
                } else if (criticalFuel) {
                    const hasFuel = state.cargo.some(c => c.type === 'fuel');
                    if (hasFuel) {
                        state.isRefueling = true; state.refuelType = 'fuel'; state.refuelStartVal = state.fuel; state.refuelDuration = 600;
                        setHud((h: any) => ({...h, alert: "INITIATING AUTO-REFUEL", alertType: 'warning'})); audioService.playSfx('buy');
                    } else if (state.frame % 180 === 0) {
                        setHud((h: any) => ({...h, alert: "CRITICAL FUEL - ABORT IMMEDIATELY", alertType: 'error'})); audioService.playAlertSiren();
                    }
                }
            }
        }

        // 2. ENERGY INJECTION LOGIC
        if (state.isEnergizing) {
            state.energizeTimer++;
            const DURATION = 180;
            const progress = state.energizeTimer / DURATION;
            
            if (state.energizeTimer >= DURATION) {
                state.isEnergizing = false; state.energizeTimer = 0;
                
                const energyIdx = state.cargo.findIndex(c => c.type === 'energy');
                if (energyIdx >= 0) {
                    state.cargo[energyIdx].quantity--;
                    if (state.cargo[energyIdx].quantity <= 0) state.cargo.splice(energyIdx, 1);
                    
                    let remaining = 500;
                    
                    if (shield1 && state.sh1 < shield1.capacity) {
                        const needed = shield1.capacity - state.sh1;
                        const take = Math.min(needed, remaining);
                        state.sh1 += take; remaining -= take;
                    }
                    if (remaining > 0 && shield2 && state.sh2 < shield2.capacity) {
                        const needed = shield2.capacity - state.sh2;
                        const take = Math.min(needed, remaining);
                        state.sh2 += take; remaining -= take;
                    }
                    if (remaining > 0 && state.energy < maxEnergy) {
                        const needed = maxEnergy - state.energy;
                        const take = Math.min(needed, remaining);
                        state.energy += take; remaining -= take;
                    }
                    if (remaining > 0) {
                        state.capacitor = Math.min(100, state.capacitor + (remaining / 5));
                    }

                    setHud((h: any) => ({...h, alert: "SYSTEMS RECHARGED", alertType: 'success'}));
                    audioService.playSfx('buy');
                }
            } else if (state.energizeTimer % 30 === 0) {
                setHud((h: any) => ({...h, alert: `INJECTING POWER... ${Math.floor(progress*100)}%`, alertType: 'info'}));
            }
        }

        // 3. REPAIR LOGIC
        if (state.hp < 100 && !state.rescueMode) {
            if (state.cargo.some(c => c.id === 'bot_repair')) {
                const hasIron = state.cargo.some(c => c.type === 'iron');
                const hasCopper = state.cargo.some(c => c.type === 'copper');
                if ((hasIron || hasCopper) && state.energy > 50) {
                    if (state.frame % 60 === 0) {
                        state.hp = Math.min(100, state.hp + 1);
                        state.energy -= 20;
                        const metal = state.cargo.find(c => c.type === 'iron' || c.type === 'copper');
                        if (metal) {
                            metal.quantity--;
                            if (metal.quantity <= 0) state.cargo = state.cargo.filter(c => c !== metal);
                        }
                    }
                }
            }
        }

        // 4. RELOAD LOGIC
        if (!state.rescueMode) {
            Object.keys(state.gunStates).forEach(keyStr => {
                const key = parseInt(keyStr); const gun = state.gunStates[key];
                const wId = state.weapons[key]?.id;
                const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === wId);
                if (!wDef || !wDef.isAmmoBased) return;
                
                if (gun.mag <= 0 && gun.reloadTimer === 0) {
                    const defType = wDef.defaultAmmo || 'iron';
                    let hasAmmo = (state.ammo[defType] || 0) > 0;
                    if (!hasAmmo) { const anyAmmo = Object.keys(state.ammo).some(k => (state.ammo[k as AmmoType] || 0) > 0); if (anyAmmo) hasAmmo = true; }
                    if (hasAmmo) { gun.reloadTimer = Date.now() + 10000; setHud((h: any) => ({...h, alert: "RELOADING WEAPON SYSTEMS...", alertType: 'warning'})); } 
                    else { if (state.frame % 300 === 0) { setHud((h: any) => ({...h, alert: "AMMUNITION DEPLETED", alertType: 'error'})); } }
                }
                
                if (gun.reloadTimer > 0 && Date.now() > gun.reloadTimer) {
                    const defType = wDef.defaultAmmo || 'iron';
                    let typeToUse = (state.ammo[defType] || 0) > 0 ? defType : null;
                    if (!typeToUse) { typeToUse = Object.keys(state.ammo).find(k => (state.ammo[k as AmmoType] || 0) > 0) as AmmoType || null; }
                    if (typeToUse) { const amount = Math.min(gun.maxMag, state.ammo[typeToUse]); state.ammo[typeToUse] -= amount; gun.mag += amount; gun.reloadTimer = 0; audioService.playSfx('buy'); setHud((h: any) => ({...h, alert: "WEAPONS RELOADED", alertType: 'success'})); } else { gun.reloadTimer = 0; }
                }
            });
        }
    }
};
