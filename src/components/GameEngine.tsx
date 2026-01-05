
import React, { useRef, useEffect } from 'react';
import { audioService } from '../services/audioService';

// Mock classes for game entities
class Missile {
  constructor(
    public x: number, 
    public y: number, 
    public vx: number, 
    public vy: number, 
    public friendly: boolean, 
    public isEmp: boolean
  ) {}
}

class Mine {
  constructor(public x: number, public y: number) {}
}

interface GameEngineProps {
  onGameOver: (win: boolean, score: number, aborted: boolean, stats: any) => void;
}

const GameEngine: React.FC<GameEngineProps> = ({ onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onGameOverRef = useRef(onGameOver);

  // Initialize Game State
  const stateRef = useRef({
    keys: new Set<string>(),
    isPaused: false,
    gameActive: true,
    isMeltdown: false,
    integrity: 100,
    score: 0,
    missileStock: 10,
    mineStock: 5,
    playerDead: false,
    px: window.innerWidth / 2,
    py: window.innerHeight - 100,
    missiles: [] as Missile[],
    mines: [] as Mine[],
    hullPacks: 0,
    missionCargo: [],
    bossDead: false,
    fuel: 100,
    equippedWeapons: [] as any[],
  });

  // Mock Ships Data
  const ships = [{
    fitting: {
      weapons: [{ id: 'gun_bolt' }] // Default weapon
    }
  }];

  const togglePause = () => {
    stateRef.current.isPaused = !stateRef.current.isPaused;
  };

  useEffect(() => {
    // Key Handler Logic (Restored from snippet)
    const handleKey = (e: KeyboardEvent, isDown: boolean) => { 
        const s = stateRef.current; 
        
        // Prevent default browser actions for game keys to avoid UI interference
        if (['Tab', 'CapsLock', 'ShiftLeft'].includes(e.code)) {
            e.preventDefault();
        }

        if (isDown) s.keys.add(e.code); else s.keys.delete(e.code); 
        
        // Pause via P only now to free Space/Enter
        if (isDown && s.isPaused && e.code === 'KeyP') { togglePause(); return; }
        if (isDown && e.code === 'KeyP') { togglePause(); return; }
        if (isDown && e.code === 'Escape') { s.gameActive = false; const finalHP = s.isMeltdown ? 25 : Math.max(0, s.integrity); onGameOverRef.current(false, s.score, true, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: finalHP, hullPacks: s.hullPacks, cargo: s.missionCargo }); } 
        
        // Missiles: Backslash OR Tab
        if (isDown && (e.code === 'Backslash' || e.code === 'Tab') && !s.playerDead && !s.isPaused) { 
            e.preventDefault(); 
            if (s.missileStock > 0) { 
                s.missileStock--; 
                const isEmp = ships[0].fitting.weapons.some(w => w.id === 'ord_missile_emp'); 
                s.missiles.push(new Missile(s.px, s.py - 40, (Math.random() - 0.5) * 4, -7.0, false, isEmp)); 
                audioService.playWeaponFire('missile'); 
            } 
        } 
        
        // Mines: Enter OR CapsLock
        if (isDown && (e.code === 'Enter' || e.code === 'CapsLock') && !s.playerDead && !s.isPaused) { 
            e.preventDefault(); 
            if (s.mineStock > 0) { 
                s.mineStock--; 
                s.mines.push(new Mine(s.px, s.py)); 
                audioService.playWeaponFire('mine'); 
            } 
        } 
    };

    const handleKeyDown = (e: KeyboardEvent) => handleKey(e, true);
    const handleKeyUp = (e: KeyboardEvent) => handleKey(e, false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return <canvas ref={canvasRef} className="block w-full h-full" />;
};

export default GameEngine;
