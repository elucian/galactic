
import React from 'react';
import { GameEngineState } from './types';
import { audioService } from '../../services/audioService';
import { fireMissile, fireMine, fireRedMine } from './CombatMechanics';

export const InputController = {
    setup: (
        state: GameEngineState, 
        inputRef: React.MutableRefObject<{ main: boolean, secondary: boolean }>, 
        togglePause: (force?: boolean) => void, 
        setShowExitDialog: (v: boolean) => void, 
        setHud: any,
        handleManualRefuel: () => void,
        handleManualRehydrate: () => void,
        handleManualReload: () => void,
        handleManualEnergy: () => void
    ) => {
        const kd = (e: KeyboardEvent) => { 
            if(e.repeat) return;
            
            const caps = e.getModifierState("CapsLock");
            state.capsLock = caps;
            
            if (e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === '-' || e.code === 'NumpadAdd' || e.code === 'NumpadSubtract')) { e.preventDefault(); }
            if (e.code === 'Tab') { e.preventDefault(); } 
            
            state.keys.add(e.code); 
            if(e.code === 'KeyP') { togglePause(); }
            if(e.code === 'Escape') {
                if (state.isExitDialogOpen) { state.isExitDialogOpen = false; setShowExitDialog(false); togglePause(false); } 
                else { state.isExitDialogOpen = true; setShowExitDialog(true); togglePause(true); }
            }
            
            // Manual System Controls
            if (e.code === 'KeyF') handleManualRefuel();
            if (e.code === 'KeyH') handleManualRehydrate();
            if (e.code === 'KeyR') handleManualReload();
            if (e.code === 'KeyE') handleManualEnergy();
            
            if (e.code === 'KeyS') {
                state.shieldsEnabled = !state.shieldsEnabled;
                setHud((h: any) => ({...h, alert: state.shieldsEnabled ? "SHIELDS ONLINE" : "SHIELDS OFFLINE", alertType: state.shieldsEnabled ? 'success' : 'warning'}));
                audioService.playSfx('click');
            }

            if(!state.paused && state.active) {
                // Missile/Mine triggers
                if (!state.rescueMode) {
                    if(e.code === 'KeyB') fireRedMine(state, setHud); 
                    if(e.code === 'KeyN' || e.code === 'NumpadEnter' || e.code === 'Enter') fireMine(state, 'both');
                }
                
                if (e.code === 'Space') inputRef.current.main = true;
                if (e.code === 'ControlLeft' || e.code === 'ControlRight') inputRef.current.secondary = true;
            }
        };

        const ku = (e: KeyboardEvent) => {
            state.keys.delete(e.code);
            
            const caps = e.getModifierState("CapsLock");
            state.capsLock = caps;

            if (e.code === 'Space') inputRef.current.main = false;
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') inputRef.current.secondary = false;
            if (e.code === 'Tab' || e.code === 'NumpadAdd') { state.missileBurstCount = 0; }
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { state.mineBurstCount = 0; }
        };

        const clearInputs = () => {
            state.keys.clear();
            inputRef.current.main = false;
            inputRef.current.secondary = false;
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                clearInputs();
            }
        };

        window.addEventListener('keydown', kd); 
        window.addEventListener('keyup', ku);
        window.addEventListener('blur', clearInputs);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => { 
            window.removeEventListener('keydown', kd); 
            window.removeEventListener('keyup', ku); 
            window.removeEventListener('blur', clearInputs);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }
};
