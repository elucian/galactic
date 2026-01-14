
import React from 'react';

interface LandingGearProps {
    type: 'mechanical' | 'telescopic' | 'skids' | 'insect' | 'magnetic';
    extension: number; // 0 (retracted) to 1 (extended)
    compression: number; // 0 (fully compressed) to 1 (uncompressed)
    side: 'left' | 'right';
    className?: string;
}

export const LandingGear: React.FC<LandingGearProps> = ({ type, extension, compression, side }) => {
    const m = side === 'right' ? 1 : -1;

    // --- TELESCOPIC LOGIC ---
    if (type === 'telescopic' || type === 'skids') { // Using telescopic logic for skids as placeholder
        const fullLen = 55; 
        const retractedLen = 10;
        const maxCompression = 10;
        
        // Extension moves the foot down
        // Compression moves the foot up (subtracts from length)
        const currentLen = (retractedLen + (fullLen - retractedLen) * extension) - ((1 - compression) * maxCompression);
        const housingH = 25;
        const pistonVisible = Math.max(0, currentLen - housingH);
        
        const hipX = 12 * m;
        const hipY = 0;

        return (
            <g transform={`translate(${hipX}, ${hipY})`}>
                <rect x="-4" y="0" width="8" height={housingH} rx="2" fill="#334155" stroke="#1e293b" strokeWidth="1" />
                {pistonVisible > 0 && (
                    <rect x="-2" y={housingH - 2} width="4" height={pistonVisible + 2} fill="#cbd5e1" stroke="#475569" strokeWidth="0.5" />
                )}
                <g transform={`translate(0, ${currentLen})`}>
                    <path d="M-8,0 L8,0 L6,3 L-6,3 Z" fill="#475569" stroke="#1e293b" strokeWidth="1" />
                    <rect x="-8" y="3" width="16" height="1" fill="#1e293b" />
                </g>
            </g>
        );
    }

    // --- MECHANICAL / INSECT / MAGNETIC LOGIC ---
    // Multi-stage animation for complex legs
    const p = extension;
    let kx, ky, fx, fy;
    
    // Default Mechanical Strut Logic
    if (p < 0.6) {
        // PHASE 1: Deploy Wide (Extension 0 -> 0.6)
        const t = p / 0.6;
        const ease = t * (2 - t); // Ease out
        
        const kx_start = 8; const ky_start = 5;
        const kx_end = 45;  const ky_end = 25; // Wide stance
        
        kx = kx_start + (kx_end - kx_start) * ease;
        ky = ky_start + (ky_end - ky_start) * ease;
        
        // Foot follows tucked
        fx = kx + 5;
        fy = ky + 5;
    } else {
        // PHASE 2: Lock Vertical (Extension 0.6 -> 1.0)
        const t = (p - 0.6) / 0.4;
        const ease = t * t * (3 - 2 * t); // Smoothstep
        
        const kx_start = 45; const ky_start = 25;
        const kx_end = 25;   const ky_end = 45; // Pull knee in and down
        
        kx = kx_start + (kx_end - kx_start) * ease;
        ky = ky_start + (ky_end - ky_start) * ease;
        
        const fx_start = 50; const fy_start = 30;
        const fx_end = 25;   const fy_end = 72; // Fully extended length
        
        fx = fx_start + (fx_end - fx_start) * ease;
        fy = fy_start + (fy_end - fy_start) * ease;
    }
    
    // Apply Compression
    // Moves Foot Y up towards Knee Y
    const maxComp = 15;
    const compAmount = (1 - compression) * maxComp;
    fy -= compAmount;
    if (fy < ky + 5) fy = ky + 5; // Clamp

    const hipX = 22 * m;
    const hipY = 0; 
    
    // Calculate Housing Endpoint (60% of Hip->Knee)
    const hx = kx * 0.6;
    const hy = ky * 0.6;

    return (
        <g transform={`translate(${hipX}, ${hipY})`}>
            {/* Inner Piston (Full length background) */}
            <line x1="0" y1="0" x2={kx * m} y2={ky} stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
            {/* Outer Housing (Thicker, partial length) */}
            <line x1="0" y1="0" x2={hx * m} y2={hy} stroke="#475569" strokeWidth="6" strokeLinecap="round" />
            {/* Lower Leg */}
            <line x1={kx * m} y1={ky} x2={fx * m} y2={fy} stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
            
            {/* Joints */}
            <circle cx="0" cy="0" r="3" fill="#1e293b" />
            <circle cx={kx * m} cy={ky} r="3" fill="#334155" stroke="#1e293b" strokeWidth="1" />
            
            {/* Foot */}
            <g transform={`translate(${fx * m}, ${fy})`}>
                <path d="M-6,0 L6,0 L4,3 L-4,3 Z" fill="#334155" stroke="#94a3b8" strokeWidth="1" />
                <rect x="-6" y="3" width="12" height="1" fill="#1e293b" />
            </g>
        </g>
    );
};
