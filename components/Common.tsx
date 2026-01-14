
import React from 'react';

export const ItemSVG = ({ type, color = "currentColor", size = 20 }: { type: string, color?: string, size?: number }) => {
  const t = type?.toLowerCase() || '';
  if (['weapon', 'gun', 'projectile', 'laser'].includes(t)) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10h12l4-4v8l-4-4H2z"/><path d="M10 14v4"/><path d="M14 14v2"/></svg>;
  if (['shield'].includes(t)) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  if (t === 'missile') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l-2 4h4l-2-4zM10 6h4v12l-2 4-2-4V6z"/><path d="M8 14h8"/><path d="M9 10h6"/></svg>;
  if (t === 'mine') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>;
  if (t === 'fuel') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h16"/><path d="M4 16h16"/><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M12 2v20"/></svg>;
  if (t === 'energy') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="10" rx="2" ry="2"/><path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="14" y2="12"/><line x1="18" y1="12" x2="18" y2="12"/></svg>;
  if (t === 'repair') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (t === 'robot') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>;
  if (t === 'ammo') return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M2 12H7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />
          <path d="M3 9H6" stroke={color} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.4" />
          <path d="M3 15H6" stroke={color} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.4" />
          <rect x="7" y="7" width="8" height="10" rx="1" fill="#b45309" />
          <path d="M15 7H16C19.5 7 21.5 9 21.5 12C21.5 15 19.5 17 16 17H15V7Z" fill={color} />
      </svg>
  );
  if (['gold', 'platinum', 'lithium', 'goods', 'iron', 'copper', 'chromium', 'titanium'].includes(t)) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
  return null;
};