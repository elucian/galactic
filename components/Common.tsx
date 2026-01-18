
import React from 'react';

export const ItemSVG = ({ type, color = "currentColor", size = 20 }: { type: string, color?: string, size?: number }) => {
  const t = type?.toLowerCase() || '';
  
  // SHIP WEAPONS (Removed 'gun')
  if (['weapon', 'projectile', 'laser'].includes(t)) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10h12l4-4v8l-4-4H2z"/><path d="M10 14v4"/><path d="M14 14v2"/></svg>;
  
  // PERSONAL WEAPONS (New Icon)
  if (t === 'gun') return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {/* Sci-Fi Blaster Shape */}
          <path d="M3 10h5l2-3h8l1 3h2v4h-2v3h-4v-3h-3v3H8v-3H3v-4z" />
          <path d="M7 10v4" strokeOpacity="0.5" />
          <line x1="14" y1="13" x2="19" y2="13" strokeOpacity="0.5" />
      </svg>
  );

  if (['shield'].includes(t)) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  
  // MISSILE (Cylindrical Silver with Colored Fins/Head)
  if (t === 'missile') return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          {/* Silver Body */}
          <path d="M9 6h6v11h-6z" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
          {/* Colored Head */}
          <path d="M9 6 L12 2 L15 6 Z" fill={color} />
          {/* Colored Fins */}
          <path d="M9 14 L6 18 L9 17 Z" fill={color} />
          <path d="M15 14 L18 18 L15 17 Z" fill={color} />
          {/* Nozzle */}
          <path d="M10 17h4v2h-4z" fill="#475569" />
      </svg>
  );

  if (t === 'mine') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>;
  if (t === 'fuel') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h16"/><path d="M4 16h16"/><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M12 2v20"/></svg>;
  if (t === 'energy') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="10" rx="2" ry="2"/><path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="14" y2="12"/><line x1="18" y1="12" x2="18" y2="12"/></svg>;
  if (t === 'repair') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (t === 'robot') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>;
  if (t === 'water') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>;
  if (t === 'ammo') return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M2 12H7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />
          <path d="M3 9H6" stroke={color} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.4" />
          <path d="M3 15H6" stroke={color} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.4" />
          <rect x="7" y="7" width="8" height="10" rx="1" fill="#b45309" />
          <path d="M15 7H16C19.5 7 21.5 9 21.5 12C21.5 15 19.5 17 16 17H15V7Z" fill={color} />
      </svg>
  );
  // RESOURCES / INGOTS
  if (['iron', 'copper', 'chromium', 'titanium', 'gold', 'platinum', 'lithium', 'tungsten', 'silver'].includes(t)) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l3-4h6l3 4" strokeOpacity="0.8" />
            <path d="M6 9h12l-2 9H8z" fill={color} fillOpacity="0.2" />
            <path d="M6 9l2 9" strokeOpacity="0.5" />
            <path d="M18 9l-2 9" strokeOpacity="0.5" />
            <path d="M9 5l-1 4" strokeOpacity="0.3" />
            <path d="M15 5l1 4" strokeOpacity="0.3" />
        </svg>
      );
  }

  // NEW ICONS
  if (t === 'drug' || t === 'medicine') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>;
  if (t === 'food') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 0 0-5 5v5h10V7a5 5 0 0 0-5-5Z"/><path d="M7 12v5a5 5 0 0 0 10 0v-5"/></svg>;
  if (t === 'equipment' || t === 'part') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  if (t === 'luxury') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>;

  // Fallback
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
};
