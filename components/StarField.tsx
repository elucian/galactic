
import React, { useMemo } from 'react';

export const StarField = () => {
  const stars = useMemo(() => {
    return Array.from({ length: 200 }).map((_, i) => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.7 + 0.3,
      animDuration: 2 + Math.random() * 3
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
       {stars.map((s, i) => (
         <div key={i} className="absolute rounded-full bg-white animate-pulse" 
              style={{ 
                left: `${s.left}%`, 
                top: `${s.top}%`, 
                width: s.size, 
                height: s.size, 
                opacity: s.opacity,
                animationDuration: `${s.animDuration}s`
              }} />
       ))}
    </div>
  );
};
