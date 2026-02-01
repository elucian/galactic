
import React from 'react';
import { Shield, ShipFitting } from '../../types';
import { LEDMeter, HudButton } from './HUD';

interface GameHUDProps {
    hud: any;
    shield: Shield | null;
    secondShield: Shield | null;
    maxEnergy: number;
    maxFuel: number;
    maxWater: number;
    hasGuns: boolean;
    hasAmmoWeapons: boolean;
    maxAmmoInMags: number;
    fontSize: string;
    onPauseToggle: () => void;
    onAbort: () => void;
    onExitDialogClose: () => void;
    onExitGame: () => void;
    showExitDialog: boolean;
    fireMissile: () => void;
    fireMine: () => void;
    fireRedMine: () => void;
    inputRef: any;
}

export const GameHUD: React.FC<GameHUDProps> = ({
    hud, shield, secondShield, maxEnergy, maxFuel, maxWater, hasGuns, hasAmmoWeapons, maxAmmoInMags, fontSize,
    onPauseToggle, onAbort, onExitDialogClose, onExitGame, showExitDialog, fireMissile, fireMine, fireRedMine, inputRef
}) => {
    
    const hudLabel = fontSize === 'small' ? 'text-[8px]' : (fontSize === 'large' ? 'text-[12px]' : 'text-[10px]');
    const hudScore = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-lg' : 'text-sm');
    const hudTimer = fontSize === 'small' ? 'text-xs' : (fontSize === 'large' ? 'text-xl' : 'text-base');
    const hudAlertText = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[16px]' : 'text-[12px]');

    return (
        <>
            {showExitDialog && (
                <div className="fixed inset-0 z-[6000] bg-black/80 flex items-center justify-center backdrop-blur-sm pointer-events-auto">
                    <div className="bg-zinc-900 border-2 border-red-500 p-8 rounded-xl flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(220,38,38,0.5)] max-w-sm w-full">
                        <h2 className="text-3xl font-black text-red-500 uppercase tracking-widest retro-font">GAME PAUSED</h2>
                        <div className="flex flex-col w-full gap-3">
                            <button 
                                onClick={onExitDialogClose} 
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded border border-emerald-400 transition-all shadow-lg"
                            >
                                RESUME
                            </button>
                            <button 
                                onClick={onExitGame} 
                                className="w-full py-4 bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-200 font-black uppercase tracking-widest rounded border border-zinc-600 hover:border-red-500 transition-all"
                            >
                                EXIT GAME
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute inset-0 pointer-events-none p-2 sm:p-4 flex flex-col justify-between z-10">
                {hud.isPaused && !showExitDialog && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                        <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-widest drop-shadow-lg mb-4 animate-pulse">GAME PAUSED</h2>
                        <p className="text-sm md:text-xl text-emerald-400 font-mono uppercase tracking-[0.2em] bg-black/80 px-4 py-2 rounded border border-emerald-500/50">Press P to Resume</p>
                    </div>
                )}

                <div className="flex justify-between items-start pointer-events-auto relative z-[60]">
                    <div className="flex flex-col gap-1 w-32 sm:w-48">
                        <div className="flex flex-col gap-1">
                            <LEDMeter value={hud.hp} max={100} colorStart="#10b981" label="H" vertical={false} />
                            {hud.sh1 > 0 && <LEDMeter value={hud.sh1} max={shield?.capacity || 100} colorStart={hud.shieldsOnline ? (shield?.color || '#3b82f6') : '#52525b'} label="S" vertical={false} />}
                            {hud.sh2 > 0 && <LEDMeter value={hud.sh2} max={secondShield?.capacity || 100} colorStart={hud.shieldsOnline ? (secondShield?.color || '#a855f7') : '#52525b'} label="S" vertical={false} />}
                        </div>
                    </div>

                    {!hud.boss && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 flex flex-col items-center bg-black/60 px-6 py-2 rounded-b-xl border-x border-b border-zinc-800/50 backdrop-blur-sm pointer-events-none">
                            <div className={`${hudTimer} font-mono font-black text-red-500 tabular-nums tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] leading-none`}>
                                {Math.floor(hud.timer / 60).toString().padStart(2, '0')}:{Math.floor(hud.timer % 60).toString().padStart(2, '0')}
                            </div>
                            <div className={`${hudScore} font-black text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] tabular-nums mt-1 leading-none`}>
                                {Math.floor(hud.score).toLocaleString()}
                            </div>
                        </div>
                    )}

                    <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-700 p-2 rounded-lg flex flex-col items-end gap-2 shadow-lg min-w-[100px]">
                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                            <button onClick={(e) => {
                                e.stopPropagation();
                                e.currentTarget.blur();
                                onPauseToggle();
                            }} className="flex-1 py-2 sm:px-4 bg-zinc-800 border border-zinc-600 text-white text-[10px] font-bold hover:bg-zinc-700 hover:border-white transition-colors uppercase">
                                {hud.isPaused ? "RESUME" : "PAUSE"}
                            </button>
                            <button onClick={(e) => {
                                e.stopPropagation();
                                e.currentTarget.blur();
                                onAbort();
                            }} className="flex-1 py-2 sm:px-4 bg-red-900/50 border border-red-600 text-red-200 text-[10px] font-bold hover:bg-red-800 transition-colors uppercase">
                                ABORT
                            </button>
                        </div>
                    </div>
                </div>

                {hud.boss && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 w-64 flex flex-col items-center pointer-events-none">
                        <div className="w-full flex justify-between text-[9px] font-black uppercase text-red-500 mb-1">
                            <span>{hud.boss.config.name}</span>
                            <span>{Math.ceil(hud.boss.hp)}</span>
                        </div>
                        <div className="w-full h-3 bg-black border-2 border-red-900 rounded-sm overflow-hidden mb-1 relative z-10">
                            <div className="h-full bg-red-600 transition-all duration-200" style={{ width: `${Math.max(0, (hud.boss.hp / hud.boss.maxHp) * 100)}%` }} />
                        </div>
                        <div className="w-full flex flex-col gap-[1px]">
                            {hud.boss.shieldLayers.map((l: any, i: number) => (
                                <div key={i} className="w-full h-1.5 bg-black border border-zinc-800 relative">
                                    <div className="h-full transition-all duration-200 opacity-80" style={{ width: `${(l.current/l.max)*100}%`, backgroundColor: l.color }} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex flex-row gap-[6px] pointer-events-none bg-zinc-950 p-2 border border-zinc-800 rounded">
                    {!hud.rescueMode && <LEDMeter value={hud.overload} max={100} colorStart={hud.capacitorLocked ? '#52525b' : '#10b981'} label={hud.capacitorLocked ? "LCK" : "C"} vertical={true} reverseColor={true} />}
                    <LEDMeter value={hud.energy} max={maxEnergy} colorStart="#22d3ee" label="E" vertical={true} />
                </div>

                <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex flex-row gap-[6px] pointer-events-none bg-zinc-950 p-2 border border-zinc-800 rounded">
                    <LEDMeter value={hud.fuel} max={maxFuel} colorStart="#f97316" label="F" vertical={true} />
                    <LEDMeter value={hud.water} max={maxWater} colorStart="#3b82f6" label="W" vertical={true} />
                </div>

                <div className="absolute bottom-2 sm:bottom-4 left-0 right-0 flex justify-center items-end pointer-events-auto">
                    <div className="flex justify-between items-end w-full px-2 sm:px-4 gap-2">
                        
                        <div className="flex items-end gap-2 shrink-0">
                            {hasGuns && !hud.rescueMode && (
                                <HudButton 
                                    label={hud.powerMode ? "POWER" : "NORMAL"} 
                                    subLabel={hud.capacitorLocked ? "JAMMED" : (hud.powerMode ? "CAPSLOCK" : "AUTO")} 
                                    onDown={() => { if(!hud.capacitorLocked) inputRef.current.main = true; }}
                                    onUp={() => { inputRef.current.main = false; }}
                                    colorClass={hud.capacitorLocked ? 'text-zinc-500' : (hud.powerMode ? 'text-orange-500 animate-pulse' : 'text-emerald-400')}
                                    borderClass={hud.capacitorLocked ? 'border-zinc-700 bg-zinc-950' : (hud.powerMode ? 'border-orange-500' : 'border-emerald-600')}
                                    active={inputRef.current.main}
                                />
                            )}
                            
                            {hasAmmoWeapons && !hud.rescueMode && (
                                 <HudButton 
                                    label="AMMO" 
                                    subLabel={hud.isReloading ? "RELOAD" : "AUTO"}
                                    onDown={() => { inputRef.current.secondary = true; }}
                                    onUp={() => { inputRef.current.secondary = false; }}
                                    colorClass={hud.isReloading ? 'text-amber-500 animate-pulse' : 'text-blue-400'}
                                    borderClass={hud.isReloading ? 'border-amber-600' : 'border-blue-600'}
                                    active={inputRef.current.secondary}
                                    count={hud.ammoCount}
                                    maxCount={maxAmmoInMags > 0 ? maxAmmoInMags : 1}
                                />
                            )}
                        </div>

                        <div className="flex-1 flex justify-center pb-2 w-full sm:w-auto">
                            {hud.alert && (
                                <div className="text-center bg-black/60 border-y border-zinc-500/30 backdrop-blur-sm px-4 py-1 sm:px-6 sm:py-2 max-w-[200px] sm:max-w-none">
                                    <span className={`${hudAlertText} font-black uppercase tracking-[0.1em] leading-tight whitespace-pre-wrap ${hud.alertType === 'alert' ? 'text-red-500 animate-pulse' : (hud.alertType === 'warning' ? 'text-amber-500' : 'text-emerald-400')}`}>
                                        {hud.alert}
                                    </span>
                                </div>
                            )}
                        </div>

                        {!hud.rescueMode && (
                            <div className="flex gap-1 sm:gap-2 items-end shrink-0 justify-end flex-wrap sm:flex-nowrap max-w-[220px] sm:max-w-none">
                                {hud.missiles > 0 && (
                                    <HudButton 
                                        label="MISSILE" 
                                        subLabel={`x${hud.missiles}`}
                                        onClick={fireMissile}
                                        colorClass="text-white"
                                        borderClass="border-zinc-700 hover:border-zinc-500"
                                        count={hud.missiles}
                                        maxCount={10}
                                    />
                                )}

                                {hud.mines > 0 && (
                                    <HudButton 
                                        label="MINE" 
                                        subLabel={`x${hud.mines}`}
                                        onClick={fireMine}
                                        colorClass="text-white"
                                        borderClass="border-zinc-700 hover:border-zinc-500"
                                        count={hud.mines}
                                        maxCount={10}
                                    />
                                )}

                                {hud.redMines > 0 && (
                                    <HudButton 
                                        label="OMEGA" 
                                        subLabel={`x${hud.redMines}`}
                                        onClick={fireRedMine}
                                        colorClass="text-red-500 animate-pulse"
                                        borderClass="border-red-900 hover:border-red-500"
                                        count={hud.redMines}
                                        maxCount={5}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
