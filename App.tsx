
// CHECKPOINT: Defender V15.19
// VERSION: V15.19 - Sector State Isolation
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameState, Planet, Moon, MissionType, ShipConfig, Weapon, Shield, GameSettings, EquippedWeapon, WeaponType, QuadrantType, ShipFitting } from './types';
import { INITIAL_CREDITS, SHIPS, WEAPONS, SHIELDS, PLANETS } from './constants';
import GameEngine from './components/GameEngine';
import LandingScene from './components/LandingScene';
import { getMissionBriefing } from './services/geminiService';
import { audioService } from './services/audioService';

const SAVE_KEY = 'galactic_defender_v15_9';

const ShipIcon = ({ shape, color = 'white', className = '', showJets = false }: { shape: string, color?: string, className?: string, showJets?: boolean }) => {
  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: `drop-shadow(0 0 5px ${color})` }}>
        {shape === 'arrow' && <path d="M50 10 L10 90 L50 70 L90 90 Z" fill={color} />}
        {shape === 'stealth' && <path d="M50 5 L10 95 L50 80 L90 95 Z" fill={color} stroke="white" strokeWidth="2" />}
        {shape === 'wing' && <path d="M50 20 L0 80 L50 60 L100 80 Z" fill={color} />}
        {shape === 'block' && <rect x="20" y="20" width="60" height="60" rx="4" fill={color} />}
        {shape === 'mine-layer' && <path d="M50 10 L10 40 L10 80 L50 95 L90 80 L90 40 Z" fill={color} />}
      </svg>
      {showJets && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-0">
          <div className="w-1.5 h-6 bg-blue-400 rounded-full animate-pulse opacity-80 blur-[1px]" />
          <div className="w-1 h-8 bg-white/80 rounded-full animate-bounce opacity-90 blur-[1px]" />
          <div className="w-1.5 h-6 bg-blue-400 rounded-full animate-pulse opacity-80 blur-[1px]" />
        </div>
      )}
    </div>
  );
};

const Starfield = ({ count = 100, isFixed = true, velocity = { x: 0, y: 0 } }: { count?: number, isFixed?: boolean, velocity?: { x: number, y: number } }) => {
  const stars = useMemo(() => {
    const colors = ['#ffffff', '#60a5fa', '#f87171', '#fbbf24', '#ffffff'];
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 5,
      duration: 2 + Math.random() * 4,
      flicker: Math.random() > 0.3,
      parallax: 0.1 + Math.random() * 0.9
    }));
  }, [count]);

  return (
    <div className={`${isFixed ? 'fixed' : 'absolute'} inset-0 pointer-events-none overflow-hidden z-0`}>
      {stars.map(s => (
        <div
          key={s.id}
          className={`absolute rounded-full ${s.flicker ? 'animate-pulse' : ''}`}
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            backgroundColor: s.color,
            boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
            opacity: 0.8,
            transform: `translate(${-velocity.x * s.parallax * 15}px, ${-velocity.y * s.parallax * 15}px)`,
            transition: 'transform 0.08s linear'
          }}
        />
      ))}
    </div>
  );
};

const WarpTransition = ({ onComplete }: { onComplete: () => void }) => {
  useEffect(() => {
    audioService.playSfx('transition');
    const timer = setTimeout(onComplete, 4000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[1000] bg-black overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.3)_0%,transparent_100%)]" />
      <div className="warp-tunnel">
        {Array.from({ length: 150 }).map((_, i) => (
          <div key={i} className="warp-star" style={{
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
            animationDelay: Math.random() * 2 + 's',
            animationDuration: (0.3 + Math.random() * 1.2) + 's'
          }} />
        ))}
      </div>
      <div className="relative z-10 animate-vibrate">
        <div className="w-24 h-24 md:w-32 md:h-32 p-4 bg-blue-500/10 rounded-full border border-blue-400/30 shadow-[0_0_80px_rgba(59,130,246,0.4)] backdrop-blur-md">
          <ShipIcon shape="stealth" color="#10b981" />
        </div>
      </div>
      <div className="absolute bottom-10 md:bottom-20 px-6 text-center retro-font text-blue-400 text-[10px] md:text-sm animate-pulse tracking-widest uppercase">Warp Drive Active - Bending Space-Time</div>
    </div>
  );
};

const LaunchSimulation = ({ onComplete }: { onComplete: () => void }) => {
  useEffect(() => {
    audioService.playSfx('transition');
    const timer = setTimeout(onComplete, 5000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[1000] bg-[#020205] flex flex-col items-center justify-center overflow-hidden">
      <Starfield count={300} isFixed />
      <div className="absolute bottom-[-110vh] left-1/2 -translate-x-1/2 w-[400vw] h-[180vh] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.15)_0%,transparent_70%)] rounded-[50%] blur-3xl animate-planet-descend" />
      <div className="absolute bottom-[-105vh] left-1/2 -translate-x-1/2 w-[400vw] h-[180vh] bg-zinc-950 rounded-[50%] border-t-4 border-emerald-500/20 animate-planet-descend flex flex-col items-center pt-20">
         <div className="w-full h-full bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.05)_0%,transparent_60%)]" />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center h-full w-full">
        <div className="animate-ship-ascent">
          <div className="w-24 h-24 md:w-32 md:h-32">
            <ShipIcon shape="arrow" color="#10b981" showJets />
          </div>
        </div>
      </div>
      <div className="absolute bottom-12 md:bottom-20 px-6 text-center retro-font text-emerald-500/70 text-[8px] md:text-sm animate-pulse tracking-[0.8em] uppercase z-20">Planetary Escape Velocity Achieved</div>
      <style>{`
        @keyframes planet-descend { from { transform: translateX(-50%) translateY(0); } to { transform: translateX(-50%) translateY(120vh); } }
        @keyframes ship-ascent { 0% { transform: translateY(150px) scale(0.85); } 30% { transform: translateY(0) scale(1.0); } 100% { transform: translateY(-70vh) scale(0.5); opacity: 0; } }
        .animate-planet-descend { animation: planet-descend 5s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .animate-ship-ascent { animation: ship-ascent 5s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
      `}</style>
    </div>
  );
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    const baseState: GameState = {
      credits: INITIAL_CREDITS, selectedShipId: 'vanguard', ownedShips: ['vanguard'], shipFittings: { 'vanguard': { weapons: [], shieldId: null } }, shipColors: { 'vanguard': '#10b981' }, currentPlanet: null, currentMoon: null, currentMission: null, currentQuadrant: QuadrantType.ALFA, conqueredMoonIds: [], shipMapPosition: { [QuadrantType.ALFA]: { x: 50, y: 50 }, [QuadrantType.BETA]: { x: 50, y: 50 }, [QuadrantType.GAMA]: { x: 50, y: 50 }, [QuadrantType.DELTA]: { x: 50, y: 50 }, }, shipRotation: 0, orbitingEntityId: null, orbitAngle: 0, dockedPlanetId: 'p1', tutorialCompleted: false, settings: { musicVolume: 0.3, sfxVolume: 0.5, musicEnabled: true, sfxEnabled: true, displayMode: 'windowed', autosaveEnabled: true }, taskForceShipIds: [], activeTaskForceIndex: 0, pilotName: 'STRIKER', pilotAvatar: '👨‍🚀'
    };
    if (saved) { try { return JSON.parse(saved); } catch(e) { return baseState; } }
    return baseState;
  });

  const [screen, setScreenState] = useState<'intro' | 'hangar' | 'map' | 'briefing' | 'game' | 'results' | 'warp' | 'launch'>('intro');
  const [targetQuadrant, setTargetQuadrant] = useState<QuadrantType>(QuadrantType.ALFA);
  const [briefing, setBriefing] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isWarpDialogOpen, setIsWarpDialogOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; reward: number } | null>(null);
  const [isAutoDocking, setIsAutoDocking] = useState(false);

  useEffect(() => { localStorage.setItem(SAVE_KEY, JSON.stringify(gameState)); }, [gameState]);

  const onArrival = async (entity: any) => {
    audioService.playSfx('click');
    if (entity.id === 'sun') return; 
    if (entity.status === 'friendly') {
      setGameState(p => ({ ...p, dockedPlanetId: entity.id, currentQuadrant: entity.quadrant }));
      setScreenState('hangar');
      setIsAutoDocking(false);
      return;
    }
    setIsLoading(true);
    let targetPlanet: Planet | null = entity && 'moons' in entity ? entity : null;
    let targetMoon: Moon | null = entity && !('moons' in entity) ? entity : null;
    let missionType = entity.id === 'comet_gama' ? MissionType.COMET : MissionType.ATTACK;
    setGameState(prev => ({ ...prev, currentPlanet: targetPlanet, currentMoon: targetMoon, currentMission: missionType, dockedPlanetId: null }));
    const briefingText = await getMissionBriefing(entity.name, missionType);
    setBriefing(briefingText);
    setIsLoading(false);
    setScreenState('briefing');
  };

  const handleJump = (q: QuadrantType) => { setTargetQuadrant(q); setIsWarpDialogOpen(false); setGameState(p => ({ ...p, dockedPlanetId: null })); setScreenState('warp'); setIsAutoDocking(false); };
  const handleReturnHome = () => { if (gameState.dockedPlanetId) { const p = PLANETS.find(p => p.id === gameState.dockedPlanetId); if (p) { setTargetQuadrant(p.quadrant); setIsAutoDocking(true); setScreenState('warp'); } } else { setScreenState('intro'); } };
  const currentShip = useMemo(() => SHIPS.find(s => s.id === gameState.selectedShipId), [gameState.selectedShipId]);
  const exitHangar = () => { setScreenState('launch'); };
  const updatePilot = (name: string, avatar: string) => { setGameState(p => ({ ...p, pilotName: name, pilotAvatar: avatar })); };
  const updateShipColor = (color: string) => { if (gameState.selectedShipId) { setGameState(p => ({ ...p, shipColors: { ...p.shipColors, [gameState.selectedShipId!]: color } })); } };

  return (
    <div className="w-full h-full flex flex-col bg-black text-white selection:bg-emerald-500 overflow-hidden font-mono">
      {screen === 'intro' && (
        <div className="flex-grow flex flex-col items-center justify-center relative p-6 md:p-10">
          <Starfield count={150} isFixed />
          <div className="relative z-10 text-center space-y-6 md:space-y-10 max-w-3xl">
            <h1 className="retro-font text-3xl md:text-7xl text-emerald-400 animate-pulse drop-shadow-[0_0_20px_rgba(16,185,129,0.4)] uppercase">Galactic Defender</h1>
            <div className="bg-white/5 p-6 md:p-10 border border-white/10 backdrop-blur-xl space-y-4 md:space-y-6 rounded-lg shadow-2xl">
              <p className="text-emerald-400 text-sm md:text-xl leading-relaxed uppercase tracking-widest font-bold">Year 2348: Outer Rim Expansion</p>
              <p className="text-zinc-400 text-[10px] md:text-base leading-relaxed uppercase tracking-tighter">Alien signals have disrupted our colonies. Our outposts are falling silent. You are authorized to defend our sectors at any cost.</p>
            </div>
            <button onClick={() => setScreenState('hangar')} className="px-10 py-5 bg-white/5 hover:bg-white/10 border border-white/10 retro-font text-[10px] md:text-sm rounded-lg uppercase tracking-widest transition-all backdrop-blur-md shadow-xl active:scale-95">Initialize Commander</button>
          </div>
        </div>
      )}
      {screen === 'warp' && <WarpTransition onComplete={() => { setGameState(p => ({ ...p, currentQuadrant: targetQuadrant })); setScreenState('map'); }} />}
      {screen === 'launch' && <WarpTransition onComplete={() => setScreenState('map')} />}
      {screen === 'hangar' && (
        <div className="flex-grow flex flex-col h-full bg-zinc-950 relative overflow-hidden">
           <Starfield count={50} isFixed />
           <header className="flex justify-between items-center p-4 md:p-6 border-b border-white/5 relative z-10 shrink-0">
             <div className="retro-font text-xs md:text-2xl text-emerald-400">COMMAND HANGAR</div>
             <div className="flex gap-2">
                <button onClick={() => setIsConfigOpen(true)} className="px-4 py-2 bg-white/5 border border-white/10 retro-font text-[8px] hover:bg-white/10 transition-all uppercase rounded backdrop-blur-sm">Config</button>
                <button onClick={() => setIsManualOpen(true)} className="px-4 py-2 bg-white/5 border border-white/10 retro-font text-[8px] hover:bg-white/10 transition-all uppercase rounded backdrop-blur-sm">Manual</button>
                <div className="retro-font text-yellow-500 text-[10px] md:text-sm uppercase tracking-tight ml-4 flex items-center">₿{gameState.credits.toLocaleString()}</div>
             </div>
           </header>
           <div className="flex-grow flex flex-col md:flex-row gap-4 p-4 md:p-8 overflow-hidden relative z-10">
             <div className="w-full md:w-1/3 bg-white/5 border border-white/10 p-4 overflow-y-auto space-y-2 rounded-lg backdrop-blur-xl custom-scrollbar">
               <h3 className="retro-font text-[8px] md:text-[9px] text-zinc-500 mb-2 uppercase tracking-widest">Fleet Assets</h3>
               {SHIPS.map(ship => (
                 <div key={ship.id} onClick={() => setGameState(p => ({ ...p, selectedShipId: ship.id }))} className={`p-4 border transition-all flex justify-between items-center cursor-pointer rounded-lg ${gameState.selectedShipId === ship.id ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/5 hover:bg-white/5 hover:border-white/20'}`}>
                   <span className="retro-font text-[8px] md:text-[9px] uppercase">{ship.name}</span>
                   <div className="w-8 h-8 md:w-10 md:h-10"><ShipIcon shape={ship.shape} color={gameState.shipColors[ship.id] || ship.defaultColor} /></div>
                 </div>
               ))}
             </div>
             <div className="w-full md:w-2/3 flex flex-col gap-4 overflow-hidden">
               <div className="flex-grow bg-white/5 border border-white/10 p-6 flex flex-col items-center justify-center gap-4 md:gap-8 relative overflow-hidden rounded-lg backdrop-blur-xl shadow-2xl">
                 {gameState.selectedShipId && (
                   <>
                     <div className="w-32 h-32 md:w-48 md:h-48 relative z-10 drop-shadow-[0_0_40px_rgba(16,185,129,0.25)] shrink-0"><ShipIcon shape={SHIPS.find(s=>s.id === gameState.selectedShipId)!.shape} color={gameState.shipColors[gameState.selectedShipId] || SHIPS.find(s=>s.id === gameState.selectedShipId)!.defaultColor} /></div>
                     <div className="text-center z-10 max-w-md overflow-y-auto px-4"><h2 className="retro-font text-sm md:text-2xl text-emerald-400 mb-2 uppercase">{SHIPS.find(s=>s.id === gameState.selectedShipId)!.name}</h2><p className="text-zinc-400 text-[9px] md:text-xs uppercase tracking-tighter leading-relaxed">{SHIPS.find(s=>s.id === gameState.selectedShipId)!.description}</p></div>
                   </>
                 )}
               </div>
               <button onClick={exitHangar} className="w-full py-6 md:py-8 bg-emerald-500/5 hover:bg-emerald-500/15 border border-emerald-500/40 retro-font text-xs md:text-xl tracking-[0.4em] transition-all rounded-lg shrink-0 uppercase shadow-lg">Depart to Orbit</button>
             </div>
           </div>
           {isConfigOpen && (
             <div className="fixed inset-0 z-[1200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
                <div className="bg-zinc-900/60 border border-white/10 p-8 max-w-lg w-full space-y-8 rounded-lg backdrop-blur-2xl shadow-2xl">
                   <h3 className="retro-font text-lg text-emerald-400 uppercase tracking-widest text-center">Pilot Matrix</h3>
                   <div className="space-y-4">
                      <div><label className="retro-font text-[10px] text-zinc-500 uppercase block mb-2">Callsign</label><input value={gameState.pilotName} onChange={(e) => updatePilot(gameState.pilotName, gameState.pilotAvatar)} className="w-full bg-white/5 border border-white/10 p-4 text-emerald-400 uppercase retro-font text-xs outline-none focus:border-emerald-500 rounded-lg" /></div>
                      <div><label className="retro-font text-[10px] text-zinc-500 uppercase block mb-2">Bio-Avatar</label><div className="flex gap-4 text-3xl">{['👨‍🚀', '👩‍🚀', '👽', '🤖', '💀'].map(a => (<button key={a} onClick={() => updatePilot(gameState.pilotName, a)} className={`p-3 border transition-all rounded-lg ${gameState.pilotAvatar === a ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:bg-white/10'}`}>{a}</button>))}</div></div>
                      <div><label className="retro-font text-[10px] text-zinc-500 uppercase block mb-2">Hull Coating</label><div className="flex gap-3">{['#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#a855f7', '#ffffff'].map(c => (<button key={c} onClick={() => updateShipColor(c)} className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-125 ${gameState.shipColors[gameState.selectedShipId!] === c ? 'border-white shadow-[0_0_10px_white]' : 'border-transparent'}`} style={{ backgroundColor: c }} />))}</div></div>
                   </div>
                   <button onClick={() => setIsConfigOpen(false)} className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 retro-font text-xs uppercase rounded-lg transition-all shadow-lg">Sync Matrix</button>
                </div>
             </div>
           )}
           {isManualOpen && (
             <div className="fixed inset-0 z-[1200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
                <div className="bg-zinc-900/60 border border-white/10 p-8 max-w-2xl w-full space-y-6 rounded-lg backdrop-blur-2xl shadow-2xl">
                   <h3 className="retro-font text-lg text-emerald-400 uppercase tracking-widest text-center">Fleet Protocol</h3>
                   <div className="font-mono text-sm text-zinc-400 space-y-4 uppercase h-64 overflow-y-auto custom-scrollbar pr-4"><p className="text-emerald-500 font-bold border-b border-white/5 pb-1">Navigation:</p><p>Use the Sector Map for gravity anchors. The central star stabilizes the system. Click planets to view tactical intelligence.</p><p className="text-emerald-500 font-bold border-b border-white/5 pb-1">Deep Space Travel:</p><p>Warp Gates connect ALFA, BETA, GAMA, and DELTA quadrants. High caution advised in the Delta Singularity zone.</p><p className="text-emerald-500 font-bold border-b border-white/5 pb-1">Strategic Operations:</p><p>Engage occupied systems to restore peace. Credits earned from missions are vital for fleet sustainability.</p></div>
                   <button onClick={() => setIsManualOpen(false)} className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/50 retro-font text-xs uppercase rounded-lg transition-all shadow-lg">Confirm Protocol</button>
                </div>
             </div>
           )}
        </div>
      )}
      {screen === 'map' && (<MapScreen key={gameState.currentQuadrant} planets={PLANETS.filter(p => p.quadrant === gameState.currentQuadrant)} onArrival={onArrival} currentQuadrant={gameState.currentQuadrant} onOpenWarp={() => setIsWarpDialogOpen(true)} initialFocusId={gameState.dockedPlanetId} pilotAvatar={gameState.pilotAvatar} pilotName={gameState.pilotName} selectedShipId={gameState.selectedShipId} shipColors={gameState.shipColors} onReturnHome={handleReturnHome} autoDock={isAutoDocking} />)}
      {screen === 'briefing' && (<div className="flex-grow flex items-center justify-center p-6 bg-black relative"><Starfield count={80} isFixed /><div className="max-w-2xl w-full bg-white/5 border border-white/10 p-6 md:p-10 space-y-6 md:space-y-8 rounded-lg shadow-2xl z-10 backdrop-blur-2xl"><h2 className="retro-font text-sm md:text-2xl text-emerald-400 border-b border-white/5 pb-4 uppercase tracking-widest">Tactical Briefing</h2><p className="font-mono text-xs md:text-xl text-white uppercase leading-relaxed max-h-[30vh] overflow-y-auto custom-scrollbar">{briefing || "Decrypting transmission..."}</p><div className="flex flex-col md:flex-row gap-4"><button onClick={() => setScreenState('map')} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 retro-font text-[10px] rounded-lg uppercase transition-all backdrop-blur-md">Hold Position</button><button onClick={() => setScreenState('game')} className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 retro-font text-[10px] rounded-lg uppercase transition-all backdrop-blur-md shadow-lg">Engage</button></div></div></div>)}
      {screen === 'game' && currentShip && (<div className="flex-grow flex items-center justify-center relative"><GameEngine ship={currentShip} weapons={[]} shield={null} missionType={gameState.currentMission!} difficulty={5} onGameOver={(success) => { setLastResult({ success, reward: success ? 10000 : 2500 }); setGameState(p => ({ ...p, credits: p.credits + (success ? 10000 : 2500) })); setScreenState('results'); }} isFullScreen={true} playerColor={gameState.shipColors[gameState.selectedShipId!] || currentShip.defaultColor || '#10b981'} /></div>)}
      {screen === 'results' && lastResult && (
        <div className="flex-grow flex flex-col items-center justify-center gap-6 md:gap-10 bg-black relative">
          <Starfield count={100} isFixed />
          <h2 className={`retro-font text-3xl md:text-6xl z-10 uppercase tracking-[0.2em] drop-shadow-2xl ${lastResult.success ? 'text-emerald-500' : 'text-red-500'}`}>{lastResult.success ? 'Victory' : 'Mission Failed'}</h2>
          <div className="retro-font text-xs md:text-xl z-10 uppercase tracking-widest text-zinc-400">Combat Pay: ₿{lastResult.reward.toLocaleString()}</div>
          <button onClick={() => setScreenState('map')} className="px-10 py-5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 retro-font text-[10px] md:text-base rounded-lg z-10 transition-all uppercase backdrop-blur-md shadow-xl">Return to Fleet</button>
        </div>
      )}
      {isWarpDialogOpen && (
        <div className="fixed inset-0 z-[1100] bg-black/90 flex items-center justify-center p-6 backdrop-blur-xl">
          <div className="bg-zinc-950/60 border border-blue-500/30 p-6 md:p-10 max-w-lg w-full space-y-8 rounded-lg shadow-2xl backdrop-blur-2xl">
            <h3 className="retro-font text-xs md:text-xl text-blue-400 text-center tracking-[0.4em] uppercase">Sector Jump Matrix</h3>
            <div className="grid grid-cols-2 gap-4">{[{ type: QuadrantType.ALFA, color: 'text-yellow-400', bColor: 'border-yellow-500/30', icon: '#fbbf24' }, { type: QuadrantType.BETA, color: 'text-orange-500', bColor: 'border-orange-500/30', icon: '#f97316' }, { type: QuadrantType.GAMA, color: 'text-blue-400', bColor: 'border-blue-500/30', icon: '#60a5fa' }, { type: QuadrantType.DELTA, color: 'text-zinc-400', bColor: 'border-white/10', icon: '#000000' }].map(q => (<button key={q.type} onClick={() => handleJump(q.type)} className={`flex flex-col items-center justify-center py-8 border transition-all gap-4 rounded-lg ${gameState.currentQuadrant === q.type ? 'bg-blue-500/10 ' + q.bColor + ' shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}`}><div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${q.type === QuadrantType.DELTA ? 'bg-black border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.15)]' : ''}`} style={{ backgroundColor: q.icon }}>{q.type === QuadrantType.DELTA && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}</div><div className={`retro-font text-[9px] ${q.color} uppercase tracking-widest`}>{q.type}</div></button>))}</div>
            <button onClick={() => setIsWarpDialogOpen(false)} className="w-full py-4 bg-red-500/5 text-red-400/80 border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 transition-all retro-font text-[10px] uppercase rounded-lg shadow-lg">Abort Sequence</button>
          </div>
        </div>
      )}
      {isLoading && <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-2xl flex items-center justify-center"><div className="retro-font text-emerald-400 text-xs animate-pulse tracking-[0.8em] uppercase">Synchronizing Fleet Uplink...</div></div>}
    </div>
  );
};

// --- MAP SCREEN COMPONENT ---

const MapScreen = ({ planets, onArrival, currentQuadrant, onOpenWarp, initialFocusId, pilotAvatar, pilotName, selectedShipId, shipColors, onReturnHome, autoDock }: any) => {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(initialFocusId || null);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [camZoom, setCamZoom] = useState(0.01); 
  const [camOffset, setCamOffset] = useState({ x: 100, y: 0 }); 
  const [isScanning, setIsScanning] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [isIntroZooming, setIsIntroZooming] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isManualZooming, setIsManualZooming] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false); 
  const [isStatusMinimized, setIsStatusMinimized] = useState(false);
  const [isTacticalMinimized, setIsTacticalMinimized] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mouseClientPos, setMouseClientPos] = useState({ x: 0, y: 0 });
  
  const [rectBounds, setRectBounds] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const [isDrawingRect, setIsDrawingRect] = useState(false);
  const [zoomCountdown, setZoomCountdown] = useState<number | null>(null);
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const outerWrapperRef = useRef<HTMLDivElement>(null);

  const cometState = useRef({ 
    angle: Math.random() * Math.PI * 2,
    orbitPrecession: Math.random() * Math.PI * 2,
    periapsis: 140, 
    apapsis: 1200, 
    eccentricity: 0.45, 
    scale: 4.5, 
    lastUpdate: 0,
    currentSpeedFactor: 1.0,
    prevPos: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 }
  });
  const [cometVisuals, setCometVisuals] = useState({ x: 0, y: 0, tailLen: 60, tailAngle: 0, isSelectable: false, proximityFactor: 0 });

  const radiusRange = useMemo(() => { if (planets.length === 0) return { min: 1, max: 1000 }; const r = planets.map((p: any) => p.orbitRadius); return { min: Math.min(...r), max: Math.max(...r) }; }, [planets]);
  const planetOffsets = useMemo(() => { return planets.reduce((acc: any, p: any) => { acc[p.id] = { startAngle: Math.random() * Math.PI * 2, spinSpeed: (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1) }; return acc; }, {}); }, [planets]);

  const SUN_COLORS: Record<string, string> = { [QuadrantType.ALFA]: '#fbbf24', [QuadrantType.BETA]: '#f97316', [QuadrantType.GAMA]: '#60a5fa', [QuadrantType.DELTA]: '#000000' };
  const currentSunColor = SUN_COLORS[currentQuadrant] || '#f97316';
  const isDelta = currentQuadrant === QuadrantType.DELTA;
  const isGama = currentQuadrant === QuadrantType.GAMA;

  const SUN_OBJECT = { id: 'sun', name: isDelta ? 'SINGULARITY' : 'Sol Prime', description: isDelta ? 'A massive black hole consuming everything in its path.' : 'The massive star at the center of the sector.', status: 'neutral', size: 10.24, color: currentSunColor };
  const COMET_OBJECT = { id: 'comet_gama', name: 'X-77 ICARUS', description: 'A massive yellow comet with a variable tail. High eccentricity orbit stabilized by the Gama-3 gravity well.', status: 'occupied', size: 1.2, color: '#facc15' };

  const getPlanetOrbitData = useCallback((p: any) => {
    const offsets = planetOffsets[p.id] || { startAngle: 0 };
    const distFactor = radiusRange.max === radiusRange.min ? 1 : (radiusRange.max - p.orbitRadius) / (radiusRange.max - radiusRange.min);
    const speedMultiplier = (1.0 + (0.5 * distFactor)) * 2.25; 
    const angle = localTime * (p.orbitSpeed * 4.32 * speedMultiplier) * (p.orbitDirection || 1) + offsets.startAngle;
    return { x: Math.cos(angle) * p.orbitRadius * 6, y: Math.sin(angle) * p.orbitRadius * 6, angle };
  }, [localTime, planetOffsets, radiusRange]);

  useEffect(() => { 
    const interval = setInterval(() => {
      setLocalTime(t => t + 0.018);
      if (isGama) {
        const c = cometState.current;
        const a = (c.periapsis + c.apapsis) / 2;
        const r = (a * (1 - Math.pow(c.eccentricity, 2))) / (1 + c.eccentricity * Math.cos(c.angle));
        const proximityFactor = (r - c.periapsis) / (c.apapsis - c.periapsis);
        const stepBase = 0.0032; 
        const keplerAccel = Math.pow(a / r, 1.6); 
        c.angle += stepBase * keplerAccel * (0.5 + proximityFactor * 0.7); 
        const finalAngle = c.angle + c.orbitPrecession;
        let cx = Math.cos(finalAngle) * r * c.scale;
        let cy = Math.sin(finalAngle) * r * c.scale;
        c.velocity = { x: cx - c.prevPos.x, y: cy - c.prevPos.y };
        c.prevPos = { x: cx, y: cy };
        const baseTailLen = 140;
        const tailLen = baseTailLen * (1 - proximityFactor);
        const tailAngle = Math.atan2(cy, cx) * (180 / Math.PI);
        setCometVisuals({ x: cx, y: cy, tailLen, tailAngle, isSelectable: r < c.periapsis * 6.0, proximityFactor });
        if (isTracking && selectedEntityId === 'comet_gama' && !isDragging && !isAnimating) {
          setCamOffset(prev => ({ x: prev.x + (-cx - prev.x) * 0.12, y: prev.y + (-cy - prev.y) * 0.12 }));
        }
      }
    }, 16); 
    return () => clearInterval(interval); 
  }, [isGama, isTracking, selectedEntityId, isDragging, isAnimating]);

  useEffect(() => {
    const startZoom = 0.0625;
    const targetZoom = 0.15625; 
    setCamZoom(startZoom);
    setCamOffset({ x: 100, y: 50 });
    let start = Date.now();
    const duration = 3000;
    const animate = () => {
      let now = Date.now();
      let progress = Math.min((now - start) / duration, 1);
      let easeProgress = 1 - Math.pow(1 - progress, 3);
      setCamZoom(startZoom + easeProgress * (targetZoom - startZoom));
      setCamOffset({ x: 100 * (1 - easeProgress), y: 50 * (1 - easeProgress) });
      if (progress < 1) requestAnimationFrame(animate);
      else { setIsIntroZooming(false); if (autoDock && initialFocusId) setTimeout(focusAndDock, 800); }
    };
    animate();
  }, [currentQuadrant, autoDock]);

  const isAnyZoomingActive = isAnimating || isManualZooming || isIntroZooming;

  const selectedEntity = useMemo(() => { 
    if (selectedEntityId === 'sun') return SUN_OBJECT; 
    if (selectedEntityId === 'comet_gama') return COMET_OBJECT;
    return planets.find((p: any) => p.id === selectedEntityId); 
  }, [selectedEntityId, planets, SUN_OBJECT, COMET_OBJECT]);

  const selectEntity = (id: string | null) => { if (isIntroZooming || isCalculating) return; audioService.playSfx('click'); setSelectedEntityId(id); setIsTracking(false); };

  const performZoomToWorldBounds = useCallback((wX1: number, wY1: number, wX2: number, wY2: number) => {
    setIsAnimating(true);
    const rectW = Math.abs(wX2 - wX1);
    const rectH = Math.abs(wY2 - wY1);
    const midX = (wX1 + wX2) / 2;
    const midY = (wY1 + wY2) / 2;
    
    const viewportRect = outerWrapperRef.current?.getBoundingClientRect();
    if (!viewportRect) return;

    const padding = 0.8;
    const targetZoomX = (viewportRect.width * padding) / rectW;
    const targetZoomY = (viewportRect.height * padding) / rectH;
    const targetZoom = Math.min(targetZoomX, targetZoomY, 4);

    let startZoom = camZoom; let startX = camOffset.x; let startY = camOffset.y; let start = Date.now(); const dur = 1200;
    const anim = () => { 
      let elapsed = Date.now() - start; 
      let p = Math.min(elapsed / dur, 1); 
      let e = 1 - Math.pow(1 - p, 4); 
      setCamZoom(startZoom + e * (targetZoom - startZoom)); 
      setCamOffset({ x: startX + e * (-midX - startX), y: startY + e * (-midY - startY) }); 
      if (p < 1) requestAnimationFrame(anim); 
      else { setIsAnimating(false); } 
    };
    anim();
  }, [camZoom, camOffset]);

  const focusOnSelected = useCallback(() => {
    if (!selectedEntity || isCalculating) return;
    let x = 0, y = 0;
    if (selectedEntity.id === 'comet_gama') { x = cometVisuals.x; y = cometVisuals.y; }
    else if (selectedEntity.id !== 'sun') { const data = getPlanetOrbitData(selectedEntity); x = data.x; y = data.y; }
    
    const worldSize = (selectedEntity.size * 25);
    const targetZoom = 48 / worldSize;
    
    setIsAnimating(true);
    let startZoom = camZoom; let startX = camOffset.x; let startY = camOffset.y; let start = Date.now(); const dur = 1000;
    const anim = () => {
      let elapsed = Date.now() - start;
      let p = Math.min(elapsed / dur, 1);
      let e = 1 - Math.pow(1 - p, 4);
      setCamZoom(startZoom + e * (targetZoom - startZoom));
      setCamOffset({ x: startX + e * (-x - startX), y: startY + e * (-y - startY) });
      if (p < 1) requestAnimationFrame(anim);
      else { setIsAnimating(false); setIsTracking(true); }
    };
    anim();
  }, [selectedEntity, getPlanetOrbitData, cometVisuals, isCalculating, camZoom, camOffset]);

  const focusAndDock = () => { if (!initialFocusId) return; const ent = planets.find((p: any) => p.id === initialFocusId); if (ent) { setSelectedEntityId(initialFocusId); focusOnSelected(); setTimeout(() => onArrival(ent), 1500); } };
  const resetView = () => { if (isIntroZooming || isCalculating) return; setIsTracking(false); setIsAnimating(true); const startZoom = camZoom; const startX = camOffset.x; const startY = camOffset.y; const dur = 800; let start = Date.now(); const anim = () => { let p = Math.min((Date.now() - start) / dur, 1); let e = 1 - Math.pow(1 - p, 3); setCamZoom(startZoom + e * (0.15625 - startZoom)); setCamOffset({ x: startX + e * (0 - startX), y: startY + e * (0 - startY) }); if (p < 1) requestAnimationFrame(anim); else { setIsAnimating(false); setSelectedEntityId(null); } }; anim(); };

  const getHitEntity = useCallback((clientX: number, clientY: number) => {
    const rect = outerWrapperRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const worldX = (clientX - centerX) / camZoom - camOffset.x;
    const worldY = (clientY - centerY) / camZoom - camOffset.y;
    let closestId: string | null = null;
    let minDistanceSq = Infinity;
    const SNAP_RADIUS_PX = 28; 
    const SNAP_RADIUS_WORLD = SNAP_RADIUS_PX / camZoom;

    const sunDistSq = worldX * worldX + worldY * worldY;
    const sunVisualRadius = (SUN_OBJECT.size * 25) / 2;
    const sunHitbox = Math.max(sunVisualRadius, SNAP_RADIUS_WORLD);
    if (sunDistSq < sunHitbox * sunHitbox) { minDistanceSq = sunDistSq; closestId = 'sun'; }

    if (isGama && cometVisuals.isSelectable) {
      const dx = worldX - cometVisuals.x;
      const dy = worldY - cometVisuals.y;
      const distSq = dx * dx + dy * dy;
      const cometHitbox = Math.max(20, SNAP_RADIUS_WORLD);
      if (distSq < cometHitbox * cometHitbox && distSq < minDistanceSq) { minDistanceSq = distSq; closestId = 'comet_gama'; }
    }

    planets.forEach((p: any) => {
      const data = getPlanetOrbitData(p);
      const dx = worldX - data.x;
      const dy = worldY - data.y;
      const distSq = dx * dx + dy * dy;
      const planetVisualRadius = (p.size * 25) / 2;
      const planetHitbox = Math.max(planetVisualRadius, SNAP_RADIUS_WORLD);
      if (distSq < planetHitbox * planetHitbox && distSq < minDistanceSq) { minDistanceSq = distSq; closestId = p.id; }
    });
    return closestId;
  }, [camZoom, camOffset, getPlanetOrbitData, isGama, planets, cometVisuals]);

  const isNearEdge = useCallback((clientX: number, clientY: number) => {
    const rect = outerWrapperRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const margin = 30;
    return (
      clientX < rect.left + margin || 
      clientX > rect.right - margin || 
      clientY < rect.top + margin || 
      clientY > rect.bottom - margin
    );
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => { 
    if (isIntroZooming || isCalculating) return;
    setMouseClientPos({ x: e.clientX, y: e.clientY });
    if (isDragging) {
      const dx = (e.clientX - dragStart.x) / camZoom; 
      const dy = (e.clientY - dragStart.y) / camZoom; 
      setCamOffset(prev => ({ x: prev.x + dx, y: prev.y + dy })); 
      setDragStart({ x: e.clientX, y: e.clientY }); 
      return;
    }
    if (isDrawingRect && rectBounds) {
      setRectBounds(prev => ({ ...prev!, x2: e.clientX, y2: e.clientY }));
      return;
    }
    setHoveredEntityId(getHitEntity(e.clientX, e.clientY));
  };

  const handleMouseDown = (e: React.MouseEvent) => { 
    if (isIntroZooming || isCalculating) return; 
    
    // Safety: Ignore if clicking buttons, inputs, or UI panels specifically
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('.ui-panel')) return;

    const hitId = getHitEntity(e.clientX, e.clientY);
    
    if (zoomTimerRef.current) {
        clearTimeout(zoomTimerRef.current);
        zoomTimerRef.current = null;
        setZoomCountdown(null);
    }

    if (hitId) {
      if (hitId === selectedEntityId) {
        setIsDragging(true); 
        setIsTracking(false); 
        setDragStart({ x: e.clientX, y: e.clientY }); 
      } else {
        selectEntity(hitId);
      }
    } else {
      // strictly block tactical zoom when near sides of the screen (30px margin)
      if (isNearEdge(e.clientX, e.clientY)) return;

      setIsDrawingRect(true);
      setRectBounds({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);
      setIsCalculating(true);
      setTimeout(() => { setIsCalculating(false); }, 1000); 
    }
    if (isDrawingRect && rectBounds) {
        setIsDrawingRect(false);
        const dx = Math.abs(rectBounds.x2 - rectBounds.x1);
        const dy = Math.abs(rectBounds.y2 - rectBounds.y1);
        
        if (dx > 20 && dy > 20) {
            setZoomCountdown(3);
            let count = 3;
            const interval = setInterval(() => {
                count--;
                setZoomCountdown(count);
                if (count <= 0) clearInterval(interval);
            }, 1000);

            zoomTimerRef.current = setTimeout(() => {
                const rect = outerWrapperRef.current?.getBoundingClientRect();
                if (rect) {
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    const wX1 = (rectBounds.x1 - cx) / camZoom - camOffset.x;
                    const wY1 = (rectBounds.y1 - cy) / camZoom - camOffset.y;
                    const wX2 = (rectBounds.x2 - cx) / camZoom - camOffset.x;
                    const wY2 = (rectBounds.y2 - cy) / camZoom - camOffset.y;
                    performZoomToWorldBounds(wX1, wY1, wX2, wY2);
                }
                setRectBounds(null);
                setZoomCountdown(null);
            }, 3000);
        } else {
            setRectBounds(null);
        }
    }
  };

  const scrollRange = 1000;
  const hScrollPos = ((scrollRange - camOffset.x) / (scrollRange * 2)) * 100; 
  const vScrollPos = ((scrollRange - camOffset.y) / (scrollRange * 2)) * 100;

  const handleHScroll = (e: React.ChangeEvent<HTMLInputElement>) => { if (isCalculating) return; setIsTracking(false); const val = parseFloat(e.target.value); setCamOffset(prev => ({ ...prev, x: scrollRange - (val / 100 * (scrollRange * 2)) })); };
  const handleVScroll = (e: React.ChangeEvent<HTMLInputElement>) => { if (isCalculating) return; setIsTracking(false); const val = parseFloat(e.target.value); setCamOffset(prev => ({ ...prev, y: scrollRange - (val / 100 * (scrollRange * 2)) })); };

  const reticleThickness = 2 / camZoom;
  const reticleOffset = 16 / camZoom; 
  const starVelocity = (isTracking && selectedEntityId === 'comet_gama') ? cometState.current.velocity : { x: 0, y: 0 };

  const mapCursorClass = isCalculating
    ? 'cursor-wait'
    : (isDragging 
        ? 'cursor-grabbing' 
        : (hoveredEntityId 
            ? (hoveredEntityId === selectedEntityId ? 'cursor-grab' : 'cursor-pointer') 
            : (isNearEdge(mouseClientPos.x, mouseClientPos.y) ? 'cursor-default' : 'cursor-crosshair')));

  const drawRectStyle = useMemo(() => {
    if (!rectBounds) return null;
    const x = Math.min(rectBounds.x1, rectBounds.x2);
    const y = Math.min(rectBounds.y1, rectBounds.y2);
    const w = Math.abs(rectBounds.x2 - rectBounds.x1);
    const h = Math.abs(rectBounds.y2 - rectBounds.y1);
    return { left: x, top: y, width: w, height: h };
  }, [rectBounds]);

  // Polar Jets Logic for Delta Black Hole
  // Optimized for 30s cycle, 10s active, with precise oscillation
  const jetCycle = 30;
  const jetDuration = 10;
  const isJetActive = (localTime % jetCycle) < jetDuration;
  const activeTime = localTime % jetCycle; // 0 to 10 when active
  // 3 oscillations back and forth over 10 seconds (f = 0.3 Hz)
  const jetOscillation = isJetActive ? Math.sin((activeTime / jetDuration) * Math.PI * 6) * 10 : 0;
  const axialTilt = 10;

  return (
    <div ref={outerWrapperRef} className={`flex-grow w-full relative bg-[#010103] flex items-center justify-center overflow-hidden select-none ${mapCursorClass}`} onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={(e) => handleMouseUp(e)}>
      <Starfield count={300} isFixed velocity={starVelocity} />
      
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0 flex items-center justify-center pointer-events-none" 
        style={{ 
          transform: `scale(${camZoom}) translate(${camOffset.x}px, ${camOffset.y}px)`, 
          transition: (isDragging || isDrawingRect) ? 'none' : 'transform 100ms linear' 
        }}
      >
        <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
            {/* SUN SYSTEM */}
            <div className="absolute flex items-center justify-center pointer-events-none sun-pivot" style={{ left: '50%', top: '50%', width: 0, height: 0 }}>
              {/* Polar Jets for Delta Singularity */}
              {isDelta && isJetActive && (
                <div className="absolute z-10" style={{ transform: `rotate(${axialTilt + jetOscillation}deg)` }}>
                   {/* Top Jet */}
                   <div className="absolute bottom-[50px] left-1/2 -translate-x-1/2 w-4 md:w-6 h-[800px] bg-[linear-gradient(to_top,rgba(59,130,246,0.8)_0%,rgba(59,130,246,0.3)_40%,transparent_100%)] blur-[8px] animate-pulse" />
                   <div className="absolute bottom-[50px] left-1/2 -translate-x-1/2 w-1 md:w-2 h-[1200px] bg-white opacity-40 blur-[2px]" />
                   {/* Bottom Jet */}
                   <div className="absolute top-[50px] left-1/2 -translate-x-1/2 w-4 md:w-6 h-[800px] bg-[linear-gradient(to_bottom,rgba(59,130,246,0.8)_0%,rgba(59,130,246,0.3)_40%,transparent_100%)] blur-[8px] animate-pulse" />
                   <div className="absolute top-[50px] left-1/2 -translate-x-1/2 w-1 md:w-2 h-[1200px] bg-white opacity-40 blur-[2px]" />
                </div>
              )}

              <div className={`absolute rounded-full transition-all z-[30]`} 
                   style={{ 
                     width: SUN_OBJECT.size * 25 + 'px', height: SUN_OBJECT.size * 25 + 'px', 
                     backgroundColor: isDelta ? '#000' : currentSunColor, 
                     boxShadow: isDelta ? `0 0 120px rgba(255,140,0,0.3), 0 0 50px rgba(96,165,250,0.15), inset 0 0 80px rgba(255,255,255,0.08)` : `0 0 180px ${currentSunColor}, 0 0 60px white, 0 0 300px ${currentSunColor}44`,
                     transform: 'translate(-50%, -50%)', top: 0, left: 0
                   }}>
                {isDelta && <div className="absolute w-[350%] h-[60%] bg-[radial-gradient(ellipse_at_center,rgba(255,165,0,0.25)_0%,transparent_70%)] blur-3xl animate-spin-slow opacity-90" style={{ animationDuration: '18s', left: '-125%', top: '20%' }} />}
                <div className="w-full h-full rounded-full animate-pulse bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.7)_0%,transparent_70%)] opacity-20" />
              </div>
              {selectedEntityId === 'sun' && !isAnyZoomingActive && (
                <div className="absolute border-dashed border-emerald-400 rounded-full z-[25] animate-rotate-dashed" 
                     style={{ 
                       width: (SUN_OBJECT.size * 25 + reticleOffset) + 'px', height: (SUN_OBJECT.size * 25 + reticleOffset) + 'px', 
                       borderWidth: reticleThickness + 'px', top: 0, left: 0
                     }} />
              )}
            </div>

            {/* COMET GAMA */}
            {isGama && (
              <div className="absolute z-30 pointer-events-none comet-pivot" style={{ left: '50%', top: '50%', transform: `translate(${cometVisuals.x}px, ${cometVisuals.y}px)`, width: 0, height: 0 }}>
                <div className="absolute pointer-events-none" style={{ left: 0, top: 0, transform: `translate(-50%, -50%) rotate(${cometVisuals.tailAngle}deg)`, zIndex: 20, opacity: 1 - (cometVisuals.proximityFactor * 0.45) }}>
                  <div className="absolute inset-[-18px] bg-[radial-gradient(circle,rgba(250,204,21,0.85)_0%,rgba(250,204,21,0.3)_60%,transparent_100%)] rounded-full blur-md animate-pulse" />
                  {cometVisuals.tailLen > 2 && (
                    <div className="absolute origin-left" style={{ left: '4px', top: 0, width: cometVisuals.tailLen * 4.6 + 'px', height: '36px', background: `linear-gradient(to right, rgba(250,204,21, ${0.94 - cometVisuals.proximityFactor * 0.4}) 0%, rgba(250,204,21, ${0.48 - cometVisuals.proximityFactor * 0.4}) 45%, transparent 100%)`, transform: `translateY(-50%)`, clipPath: 'polygon(0 0, 0 100%, 100% 50%)', filter: `blur(${7 + cometVisuals.proximityFactor * 10}px)`, opacity: (0.8 + Math.sin(localTime * 8) * 0.1) * (1 - Math.pow(cometVisuals.proximityFactor, 2)), mixBlendMode: 'screen' }} />
                  )}
                </div>
                <div className={`absolute rounded-full relative z-[30]`} 
                     style={{ 
                       width: '32px', height: '32px',
                       backgroundColor: '#fffbeb', boxShadow: '0 0 35px #facc15, 0 0 15px white, inset 0 0 10px rgba(255,255,255,0.9)', 
                       transform: 'translate(-50%, -50%)', top: 0, left: 0 
                     }}>
                  <div className="absolute inset-[-4px] border border-yellow-100/40 rounded-full animate-pulse" />
                </div>
                {selectedEntityId === 'comet_gama' && !isAnyZoomingActive && (
                  <div className="absolute border-dashed border-yellow-400 rounded-full z-[40] animate-rotate-dashed" 
                       style={{ 
                         width: (32 + reticleOffset) + 'px', height: (32 + reticleOffset) + 'px', 
                         borderWidth: reticleThickness + 'px', top: 0, left: 0
                       }} />
                )}
              </div>
            )}

            {/* PLANETS */}
            {planets.map((p: any) => {
              const { x, y } = getPlanetOrbitData(p);
              const offsets = planetOffsets[p.id] || { spinSpeed: 0 };
              const visualDiameter = p.size * 25;
              const isSelected = selectedEntityId === p.id;
              const isHovered = hoveredEntityId === p.id;
              return (
                <React.Fragment key={p.id}>
                    <div className="absolute border border-white/5 rounded-full pointer-events-none" style={{ width: p.orbitRadius * 12 + 'px', height: p.orbitRadius * 12 + 'px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
                    <div className="absolute z-20 pointer-events-none planet-pivot" style={{ left: '50%', top: '50%', transform: `translate(${x}px, ${y}px)`, width: 0, height: 0 }}>
                      {p.moons && p.moons.map((m: any) => {
                        const moonRotationalSpeed = 15 / Math.sqrt(m.distance || 10);
                        const moonAngle = localTime * moonRotationalSpeed * (m.orbitDirection || 1) + (m.angle * (Math.PI / 180));
                        const mx = Math.cos(moonAngle) * m.distance;
                        const my = Math.sin(moonAngle) * m.distance;
                        return (
                          <React.Fragment key={m.id}>
                            <div className="absolute border border-white/5 rounded-full" style={{ width: m.distance * 2 + 'px', height: m.distance * 2 + 'px', transform: 'translate(-50%, -50%)' }} />
                            <div className="absolute rounded-full border border-black/30 shadow-[inset_-2px_-2px_5px_rgba(0,0,0,0.5),0_0_10px_rgba(255,255,255,0.5)]" 
                                 style={{ width: m.size * 25 + 'px', height: m.size * 25 + 'px', backgroundColor: m.color || '#94a3b8', transform: `translate(-50%, -50%) translate(${mx}px, ${my}px)`, top: 0, left: 0 }} />
                          </React.Fragment>
                        );
                      })}
                      
                      <div className={`absolute rounded-full border-2 overflow-hidden z-[30] ${isSelected ? 'border-emerald-500/30' : (isHovered ? 'border-white/60 scale-105' : 'border-transparent')}`} 
                           style={{ 
                             width: visualDiameter + 'px', height: visualDiameter + 'px', 
                             backgroundColor: p.color, boxShadow: isSelected ? '0 0 40px rgba(16, 185, 129, 0.4)' : '0 0 15px rgba(0,0,0,0.6)', 
                             transform: 'translate(-50%, -50%)', top: 0, left: 0, transition: 'transform 0.2s ease-out'
                           }}>
                          <div className="absolute inset-0 opacity-40" style={{ background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 10px, rgba(255,255,255,0.08) 10px, rgba(255,255,255,0.08) 20px)', transform: `rotate(${localTime * offsets.spinSpeed * 20}deg)` }} />
                          <div className="absolute inset-0 shadow-[inset_-6px_-6px_20px_rgba(0,0,0,0.6),inset_6px_6px_15px_rgba(255,255,255,0.25)]" />
                          {p.hasRings && <div className="absolute inset-[-65%] border-4 border-zinc-400/20 rounded-full rotate-[35deg] shadow-[0_0_20px_rgba(255,255,255,0.05)]" />}
                      </div>

                      {isSelected && !isAnyZoomingActive && (
                        <div className="absolute border-dashed border-emerald-400 rounded-full z-[35] animate-rotate-dashed" 
                             style={{ 
                               width: (visualDiameter + reticleOffset) + 'px', height: (visualDiameter + reticleOffset) + 'px', 
                               borderWidth: reticleThickness + 'px', top: 0, left: 0
                             }} />
                      )}
                    </div>
                </React.Fragment>
              );
            })}
        </div>
      </div>

      {rectBounds && (
          <div className="absolute border-2 border-dashed border-blue-400/60 bg-blue-500/5 pointer-events-none z-50 transition-colors duration-300" style={{ ...drawRectStyle }}>
             {zoomCountdown !== null && (
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="retro-font text-[9px] text-blue-400 animate-pulse uppercase bg-black/40 px-3 py-1 rounded">Tactical Zoom in {zoomCountdown}s</div>
                 </div>
             )}
          </div>
      )}

      <div className="absolute left-6 top-1/2 -translate-y-1/2 h-[60vh] w-6 flex flex-col items-center z-50 pointer-events-none">
        <div className="w-[1px] h-full bg-white/10" />
        <input type="range" min="0" max="100" step="0.1" value={vScrollPos} onChange={handleVScroll} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer pointer-events-auto" style={{ transform: 'rotate(90deg)', width: '60vh' }} />
        <div className="absolute w-2.5 h-12 bg-white/5 border border-white/20 rounded-full pointer-events-none backdrop-blur-xl shadow-lg" style={{ top: `${vScrollPos}%`, transform: 'translateY(-50%)' }} />
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[60vw] h-6 flex flex-row items-center z-50 pointer-events-none">
        <div className="h-[1px] w-full bg-white/10" />
        <input type="range" min="0" max="100" step="0.1" value={hScrollPos} onChange={handleHScroll} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer pointer-events-auto" />
        <div className="absolute h-2.5 w-12 bg-white/5 border border-white/20 rounded-full pointer-events-none backdrop-blur-xl shadow-lg" style={{ left: `${hScrollPos}%`, transform: 'translateX(-50%)' }} />
      </div>

      <div className="absolute top-6 left-14 flex flex-col gap-3 z-50">
        <div className="flex gap-2">
          <button onClick={() => { if (!isCalculating) setCamZoom(prev => Math.min(prev * 1.25, 4)); }} className="w-11 h-11 bg-white/5 backdrop-blur-xl border border-white/10 retro-font text-xs hover:bg-white/10 hover:border-white/30 rounded-lg flex items-center justify-center transition-all shadow-xl pointer-events-auto cursor-auto">+</button>
          <button onClick={() => { if (!isCalculating) setCamZoom(prev => Math.max(prev / 1.25, 0.005)); }} className="w-11 h-11 bg-white/5 backdrop-blur-xl border border-white/10 retro-font text-xs hover:bg-white/10 hover:border-white/30 rounded-lg flex items-center justify-center transition-all shadow-xl pointer-events-auto cursor-auto">-</button>
          <button onClick={focusOnSelected} disabled={!selectedEntity || isCalculating} className={`w-11 h-11 bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center rounded-lg transition-all shadow-xl pointer-events-auto cursor-auto ${(!selectedEntity || isCalculating) ? 'opacity-20' : 'hover:bg-white/10 hover:border-white/30 text-emerald-400'}`} title="Focus Matrix"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button onClick={resetView} disabled={isCalculating} className={`w-11 h-11 bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center rounded-lg transition-all shadow-xl pointer-events-auto cursor-auto ${isCalculating ? 'opacity-20' : 'hover:bg-white/10 hover:border-white/30 text-zinc-400'}`} title="Outer Scan"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="12" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></button>
        </div>
      </div>

      <div className="absolute bottom-12 left-12 right-12 flex justify-between items-end pointer-events-none z-50 overflow-hidden py-4">
        <div className="relative pointer-events-auto h-32 flex items-center ui-panel cursor-auto">
          <div className={`h-full bg-zinc-950/40 backdrop-blur-2xl border border-white/10 p-5 rounded-xl flex items-center gap-8 shadow-2xl transition-transform duration-500 ease-in-out ${isStatusMinimized ? '-translate-x-[calc(100%+12px)]' : ''}`}>
            <button onClick={() => { setIsStatusMinimized(true); audioService.playSfx('click'); }} className="w-10 h-10 flex items-center justify-center hover:scale-110 transition-transform group cursor-auto" title="Minimize Fleet Status"><svg viewBox="0 0 100 100" className="w-6 h-6 fill-zinc-600 group-hover:fill-emerald-400 transition-colors drop-shadow-[0_0_5px_rgba(16,185,129,0.2)]"><path d="M70 10 L20 50 L70 90 Z" /></svg></button>
            <div className="flex items-center gap-5 border-r border-white/10 pr-8 h-full">
              <div className="w-20 h-20 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-center text-5xl shadow-inner animate-pulse-slow">{pilotAvatar}</div>
              <div><div className="retro-font text-[7px] text-zinc-500 uppercase tracking-[0.3em] mb-1">Sector Commander</div><div className="retro-font text-sm text-emerald-400 uppercase tracking-wide">{pilotName}</div></div>
            </div>
            <div className="flex items-center gap-5 h-full">
              <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-xl p-3"><ShipIcon shape={SHIPS.find(s=>s.id === selectedShipId)?.shape || 'arrow'} color={shipColors[selectedShipId] || '#fff'} /></div>
              <div className="flex flex-col gap-3">
                <button onClick={onOpenWarp} className="px-6 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 retro-font text-[9px] uppercase rounded-lg transition-all backdrop-blur-md cursor-auto">Jump</button>
                <button onClick={onReturnHome} className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 retro-font text-[9px] uppercase rounded-lg transition-all backdrop-blur-md cursor-auto">Home</button>
              </div>
            </div>
          </div>
          {isStatusMinimized && (
            <button onClick={() => { setIsStatusMinimized(false); audioService.playSfx('click'); }} className="absolute bottom-0 w-12 h-32 bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/30 rounded-r-lg flex flex-col items-center hover:bg-emerald-500/20 transition-all pointer-events-auto shadow-xl overflow-hidden cursor-auto" style={{ left: '-12px' }}>
              <div className="h-12 w-full flex items-center justify-center shrink-0 border-b border-emerald-500/10"><svg viewBox="0 0 100 100" className="w-4 h-4 fill-emerald-400"><path d="M30 10 L80 50 L30 90 Z" /></svg></div>
              <div className="flex-grow w-full flex items-center justify-center"><div className="rotate-90 retro-font text-[9px] text-emerald-400 whitespace-nowrap tracking-[0.3em] uppercase">Status</div></div>
            </button>
          )}
        </div>
        
        <div className="relative pointer-events-auto w-80 ui-panel cursor-auto">
          <div className={`w-full bg-zinc-950/40 border border-white/10 p-6 flex flex-col gap-4 shadow-2xl backdrop-blur-2xl rounded-xl transition-transform duration-500 ease-in-out ${isTacticalMinimized ? 'translate-y-[calc(100%+48px)]' : ''}`}>
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <button onClick={() => { setIsTacticalMinimized(true); audioService.playSfx('click'); }} className="w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform group cursor-auto" title="Minimize Tactical Feed"><svg viewBox="0 0 100 100" className="w-5 h-5 fill-zinc-600 group-hover:fill-blue-400 transition-colors drop-shadow-[0_0_5px_rgba(59,130,246,0.2)]"><path d="M10 30 L50 80 L90 30 Z" /></svg></button>
                <span className="retro-font text-[8px] md:text-[9px] text-zinc-500 uppercase tracking-[0.3em]">Tactical</span>
              </div>
              <button onClick={() => { if (!isCalculating) { setIsScanning(true); setTimeout(() => setIsScanning(false), 1500); audioService.playSfx('transition'); } }} className={`text-emerald-400 text-[8px] md:text-[9px] retro-font uppercase transition-all cursor-auto ${isScanning || isCalculating ? 'opacity-30' : 'animate-pulse'}`}>{isScanning ? 'Streaming...' : 'Sync Feed'}</button>
            </div>
            <div className="flex-grow overflow-y-auto max-h-32 md:max-h-48 space-y-1.5 custom-scrollbar pr-3">
              <div onClick={() => selectEntity('sun')} className={`p-2 font-mono text-[10px] md:text-[11px] cursor-auto transition-all flex justify-between uppercase rounded-lg border ${selectedEntityId === 'sun' ? 'bg-white/10 text-orange-400 border-white/10' : 'text-zinc-500 border-transparent hover:text-zinc-200'}`}>
                <span>{SUN_OBJECT.name}</span><span className="text-orange-900/50 text-[8px] tracking-widest">[NUCLEUS]</span>
              </div>
              {isGama && (
                <div onClick={() => { if (cometVisuals.isSelectable) selectEntity('comet_gama'); }} className={`p-2 font-mono text-[10px] md:text-[11px] cursor-auto transition-all flex justify-between uppercase rounded-lg border ${selectedEntityId === 'comet_gama' ? 'bg-white/10 text-yellow-400 border-white/10' : (cometVisuals.isSelectable ? 'text-zinc-300 border-transparent hover:text-white' : 'text-zinc-700 border-transparent cursor-not-allowed')}`}>
                  <span>{COMET_OBJECT.name}</span><span className="text-[8px] tracking-widest">{cometVisuals.isSelectable ? '[LOCKED]' : '[OUTSIDE RANGE]'}</span>
                </div>
              )}
              {planets.map((p: any) => (
                <div key={p.id} onClick={() => selectEntity(p.id)} className={`p-2 font-mono text-[10px] md:text-[11px] cursor-auto transition-all flex justify-between uppercase rounded-lg border ${selectedEntityId === p.id ? 'bg-white/10 text-emerald-400 border-white/10' : 'text-zinc-500 border-transparent hover:text-zinc-200'}`}>
                  <span>{p.name}</span><span className={`text-[8px] opacity-70 ${p.status === 'occupied' ? 'text-red-400' : (p.status === 'friendly' ? 'text-emerald-400' : 'text-blue-400')}`}>[{p.status}]</span>
                </div>
              ))}
            </div>
            {selectedEntity && (
              <div className="animate-in fade-in slide-in-from-bottom duration-500 space-y-4 pt-4 border-t border-white/10">
                <div className={`retro-font text-[9px] md:text-xs uppercase tracking-tight ${selectedEntity.id === 'sun' ? 'text-orange-400' : (selectedEntity.id === 'comet_gama' ? 'text-yellow-400' : 'text-emerald-400')}`}>{selectedEntity.name}</div>
                <p className="text-[8px] md:text-[10px] font-mono text-zinc-400 uppercase leading-relaxed h-12 md:h-20 overflow-y-auto custom-scrollbar pr-1">{selectedEntity.description}</p>
                {selectedEntity.id !== 'sun' && (
                  <button onClick={() => onArrival(selectedEntity)} disabled={isCalculating} className={`w-full py-4 retro-font text-[9px] border rounded-lg uppercase transition-all shadow-xl backdrop-blur-md cursor-auto ${isCalculating ? 'opacity-50 cursor-not-allowed' : (selectedEntity.status === 'friendly' ? 'bg-blue-500/5 hover:bg-blue-500/15 border-blue-500/40 text-blue-300' : (selectedEntity.id === 'comet_gama' ? 'bg-yellow-500/5 hover:bg-yellow-500/15 border-yellow-500/40 text-yellow-300' : 'bg-emerald-500/5 hover:bg-emerald-500/15 border-emerald-500/40 text-emerald-300'))}`}>{selectedEntity.status === 'friendly' ? 'Initiate Landing' : 'Lock Target'}</button>
                )}
              </div>
            )}
          </div>
          {isTacticalMinimized && (
            <button onClick={() => { setIsTacticalMinimized(false); audioService.playSfx('click'); }} className="absolute right-0 bottom-[-12px] w-80 h-12 bg-blue-500/10 backdrop-blur-xl border border-blue-500/30 rounded-t-lg flex flex-row items-center hover:bg-blue-500/20 transition-all pointer-events-auto shadow-xl border-b-0 overflow-hidden cursor-auto">
              <div className="w-12 h-full flex items-center justify-center shrink-0 border-r border-blue-500/10"><svg viewBox="0 0 100 100" className="w-4 h-4 fill-blue-400"><path d="M10 70 L50 20 L90 70 Z" /></svg></div>
              <div className="flex-grow h-full flex items-center justify-start pl-4"><div className="retro-font text-[9px] text-blue-400 tracking-[0.4em] uppercase">Tactical</div></div>
            </button>
          )}
        </div>
      </div>
      
      {isScanning && <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center"><div className="w-full h-[1px] bg-emerald-500/20 shadow-[0_0_30px_emerald] animate-scan-line" /></div>}
      
      <style>{` 
        @keyframes scan-line { 0% { transform: translateY(-50vh); } 100% { transform: translateY(50vh); } } 
        .animate-scan-line { animation: scan-line 1.5s linear; } 
        input[type=range] { writing-mode: bt-lr; -webkit-appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 48px; width: 24px; cursor: pointer; }
        .animate-spin-slow { animation: spin 18s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes pulse-slow { 0%, 100% { opacity: 0.8; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
};

export default App;
