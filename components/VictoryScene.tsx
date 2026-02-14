
import React, { useEffect, useRef, useState } from 'react';
import { ShipIcon } from './ShipIcon';
import { SHIPS } from '../constants';
import { audioService } from '../services/audioService';

interface VictorySceneProps {
    mode: 'cinematic' | 'simple';
    onExit: () => void;
    onRestart: () => void;
    title?: string;
    subtitle?: string;
}

export const VictoryScene: React.FC<VictorySceneProps> = ({ mode, onExit, onRestart, title = "VICTORY ACHIEVED", subtitle = "SECTOR LIBERATED" }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // UI Visibility: Immediate for simple, delayed for cinematic
    const [uiVisible, setUiVisible] = useState(() => mode === 'simple'); 
    const [showButton, setShowButton] = useState(() => mode === 'simple');
    
    const animState = useRef({
        fireworksActive: false,
        startTime: Date.now()
    });
    
    const onRestartRef = useRef(onRestart);
    useEffect(() => { onRestartRef.current = onRestart; }, [onRestart]);

    const shipRefs = useRef<(HTMLDivElement | null)[]>([]);
    const shipConfig = SHIPS[0]; 
    
    const particles = useRef<{x: number, y: number, vx: number, vy: number, life: number, color: string, size: number}[]>([]);
    const stars = useRef<{x: number, y: number, size: number, alpha: number}[]>([]);

    // Initialize Stars Once
    useEffect(() => {
        stars.current = Array.from({ length: 150 }).map(() => ({
            x: Math.random(),
            y: Math.random(),
            size: Math.random() * 2 + 0.5,
            alpha: Math.random() * 0.8 + 0.2
        }));
    }, []);

    // Sequence Logic
    useEffect(() => {
        animState.current.startTime = Date.now();
        animState.current.fireworksActive = false;

        if (mode === 'cinematic') {
            setUiVisible(false);
            setShowButton(false);

            audioService.playTrack('victory');
            
            // 4s: Start Fireworks (Delayed per request)
            const t1 = setTimeout(() => { 
                animState.current.fireworksActive = true; 
            }, 4000);
            
            // 15s: Show UI Text
            const t2 = setTimeout(() => { 
                setUiVisible(true); 
            }, 15000); 
            
            // 16s: Show Buttons
            const t3 = setTimeout(() => { 
                setShowButton(true); 
            }, 16000);
            
            // Auto-restart backup (2 mins)
            const t4 = setTimeout(() => {
                onRestartRef.current();
            }, 120000);

            return () => {
                clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
                audioService.stop();
            };
        } else {
            // Simple Mode: Visible immediately
            setUiVisible(true);
            setShowButton(true);
            const t = setTimeout(() => { onRestartRef.current(); }, 60000);
            return () => clearTimeout(t);
        }
    }, [mode]); 

    // Animation Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        const colors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ffffff'];
        
        const loop = () => {
            const w = canvas.width = window.innerWidth;
            const h = canvas.height = window.innerHeight;
            const now = Date.now();
            const elapsed = (now - animState.current.startTime) * 0.001; 

            ctx.clearRect(0, 0, w, h);

            // 1. Draw Stars (Always)
            ctx.fillStyle = '#ffffff';
            stars.current.forEach(star => {
                // Twinkle effect
                ctx.globalAlpha = star.alpha * (0.8 + Math.sin(now * 0.002 + star.x * 10) * 0.2);
                ctx.beginPath();
                ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1.0;

            // 2. Draw Red Planet (Centered) - Always
            const planetX = w * 0.5;
            const planetY = h * 0.5; 
            const planetRadius = Math.min(w, h) * 0.15; 

            const grad = ctx.createRadialGradient(planetX - planetRadius*0.3, planetY - planetRadius*0.3, planetRadius * 0.1, planetX, planetY, planetRadius);
            grad.addColorStop(0, '#ef4444');
            grad.addColorStop(0.5, '#991b1b');
            grad.addColorStop(1, '#450a0a');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(planetX, planetY, planetRadius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 30;
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // 3. Draw Moons
            
            // Moon 1: Inner Circular
            // Orbit Diameter ~ Width/Height of screen (clamped for visibility)
            // Reduced Speed: 0.05 (approx 20% of typical 0.25)
            const m1OrbitR = Math.min(w, h) * 0.35; 
            const m1Size = 8;
            const m1Speed = 0.05; 
            const m1Angle = elapsed * m1Speed;
            
            const m1X = planetX + Math.cos(m1Angle) * m1OrbitR;
            const m1Y = planetY + Math.sin(m1Angle) * m1OrbitR;

            // Draw Orbit Line (Subtle)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(planetX, planetY, m1OrbitR, 0, Math.PI * 2);
            ctx.stroke();

            // Draw Moon 1
            ctx.fillStyle = '#94a3b8'; // Light Grey
            ctx.beginPath();
            ctx.arc(m1X, m1Y, m1Size, 0, Math.PI*2);
            ctx.fill();
            // Moon 1 Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.arc(m1X - 2, m1Y + 2, m1Size, 0, Math.PI*2);
            ctx.fill();


            // Moon 2: Peripheral Elliptical (Screen Edges)
            // Smaller Size
            // Reduced Speed: 0.08 (approx 30% of typical 0.25)
            const m2OrbitRx = w * 0.48; // Near width edge
            const m2OrbitRy = h * 0.48; // Near height edge
            const m2Size = 5; // Smaller
            const m2Speed = 0.08; 
            const m2Angle = (elapsed * m2Speed) + Math.PI; // Start opposite
            
            const m2X = planetX + Math.cos(m2Angle) * m2OrbitRx;
            const m2Y = planetY + Math.sin(m2Angle) * m2OrbitRy;

            // Draw Moon 2
            ctx.fillStyle = '#64748b'; // Darker Grey
            ctx.beginPath();
            ctx.arc(m2X, m2Y, m2Size, 0, Math.PI*2);
            ctx.fill();

            // 4. Update Ships (Cinematic Only)
            if (mode === 'cinematic') {
                const orbitRx = w * 0.45; 
                const orbitRy = h * 0.35; 
                const speed = 0.3; 
                
                const t = (elapsed * speed) % (Math.PI * 2);
                const tilt = 0.2;
                
                const rawX = Math.cos(t) * orbitRx;
                const rawY = Math.sin(t) * orbitRy;
                
                const lx = planetX + (rawX * Math.cos(tilt) - rawY * Math.sin(tilt));
                const ly = planetY + (rawX * Math.sin(tilt) + rawY * Math.cos(tilt));
                
                const dRawX = -Math.sin(t) * orbitRx;
                const dRawY = Math.cos(t) * orbitRy;
                const dx = dRawX * Math.cos(tilt) - dRawY * Math.sin(tilt);
                const dy = dRawX * Math.sin(tilt) + dRawY * Math.cos(tilt);
                const angle = Math.atan2(dy, dx) + (Math.PI / 2);

                const isFront = rawY > 0;
                const zIndex = isFront ? 30 : 10;
                const depthFactor = (Math.sin(t) + 1) / 2;
                const baseScale = 0.5 + (depthFactor * 0.5); 
                
                // Fade in ships starting at 2 seconds
                const SHIP_START_DELAY = 2.0;
                let opacity = 0;
                if (elapsed > SHIP_START_DELAY) {
                    const fadeProgress = Math.min(1, (elapsed - SHIP_START_DELAY) / 2.0);
                    opacity = (0.6 + (depthFactor * 0.4)) * fadeProgress;
                }

                [0, 1, 2].forEach(i => {
                    const el = shipRefs.current[i];
                    if (el) {
                        let sx = lx;
                        let sy = ly;
                        let sScale = baseScale;

                        if (i === 0) {
                            sScale *= 1.0;
                        } else {
                            const offsetMag = 50 * baseScale;
                            const side = i === 1 ? -1 : 1; 
                            const shipRot = angle - (Math.PI/2);
                            const offsetX = side * offsetMag; 
                            const offsetY = offsetMag; 
                            
                            const rotX = offsetX * Math.cos(shipRot) - offsetY * Math.sin(shipRot);
                            const rotY = offsetX * Math.sin(shipRot) + offsetY * Math.cos(shipRot);
                            
                            sx += rotX;
                            sy += rotY;
                            sScale *= 0.7;
                        }

                        el.style.zIndex = zIndex.toString();
                        el.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) rotate(${angle.toFixed(3)}rad) scale(${sScale.toFixed(3)})`;
                        el.style.opacity = opacity.toFixed(2);
                        // Hide element completely if opacity is 0 to avoid blocking or ghosts
                        el.style.display = opacity > 0.01 ? 'block' : 'none';
                    }
                });
            }

            // 5. Fireworks (Cinematic Only)
            if (mode === 'cinematic' && animState.current.fireworksActive) {
                if (Math.random() < 0.05) {
                    const exX = w * 0.1 + Math.random() * w * 0.8;
                    const exY = h * 0.1 + Math.random() * h * 0.6;
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    const count = 40 + Math.floor(Math.random() * 60);
                    
                    audioService.playExplosion(0, 0.5, 'fireworks');

                    for(let i=0; i<count; i++) {
                        const a = Math.random() * Math.PI * 2;
                        const s = 2 + Math.random() * 6;
                        particles.current.push({
                            x: exX,
                            y: exY,
                            vx: Math.cos(a) * s,
                            vy: Math.sin(a) * s,
                            life: 1.0 + Math.random() * 0.5,
                            color: color,
                            size: 2 + Math.random() * 3
                        });
                    }
                }
            }

            // Draw Particles
            particles.current.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.05; 
                p.life -= 0.01;
                p.size *= 0.98;

                if (p.life > 0) {
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
            particles.current = particles.current.filter(p => p.life > 0);
            ctx.globalAlpha = 1;

            animId = requestAnimationFrame(loop);
        };
        animId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animId);
    }, [mode]);

    const handleExitClick = () => {
        try { window.close(); } catch(e) { }
        onExit(); 
    };

    return (
        <div className="absolute inset-0 z-[5000] overflow-hidden pointer-events-auto bg-black/95">
            <canvas ref={canvasRef} className="absolute inset-0 z-20 pointer-events-none" />
            
            {/* Ships Container - Only rendered in DOM for cinematic logic to control */}
            {mode === 'cinematic' && (
                <div className="absolute inset-0 pointer-events-none">
                    {[0, 1, 2].map((_, i) => (
                        <div 
                            key={i}
                            ref={(el) => { shipRefs.current[i] = el; }}
                            className="absolute w-32 h-32 will-change-transform"
                            style={{ left: '0', top: '0', transform: 'translate(-1000px, -1000px)', opacity: 0, display: 'none' }}
                        >
                            <ShipIcon config={shipConfig} showJets={true} jetType="combustion" forceShieldScale={true} className="w-full h-full drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                        </div>
                    ))}
                </div>
            )}

            {/* UI LAYER - High Z-Index */}
            <div className={`absolute inset-0 z-[100] transition-opacity duration-1000 flex flex-col items-center justify-center pointer-events-none ${uiVisible ? 'opacity-100 bg-black/40' : 'opacity-0'}`}>
                
                <h1 className="retro-font text-5xl md:text-8xl text-yellow-500 font-black uppercase tracking-tighter drop-shadow-[0_0_25px_rgba(251,191,36,0.8)] animate-pulse mb-8 text-center px-4" style={{ background: 'linear-gradient(to bottom, #fde047, #d97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', color: 'transparent' }}>
                    {title}
                </h1>

                <h2 className="retro-font text-2xl md:text-4xl text-white/70 font-black uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] mb-12 text-center w-full px-4">
                    {subtitle}
                </h2>

                <div className={`flex gap-6 transition-opacity duration-500 pointer-events-auto ${showButton ? 'opacity-100' : 'opacity-0'}`}>
                    <button 
                        onClick={handleExitClick}
                        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-black uppercase tracking-[0.2em] px-8 py-4 rounded border-2 border-zinc-700 hover:border-zinc-500 transition-all transform hover:scale-105 shadow-lg w-40 cursor-pointer"
                    >
                        Exit
                    </button>
                    <button 
                        onClick={onRestart}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] px-8 py-4 rounded border-2 border-emerald-400 hover:border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all transform hover:scale-105 w-40 cursor-pointer"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
};
