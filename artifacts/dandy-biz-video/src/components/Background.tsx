import React from 'react';

export function Background() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Base dark fill */}
      <div className="absolute inset-0" style={{ background: '#001a14' }} />

      {/* Static gradient mesh — pure greens only */}
      <div className="absolute inset-0" style={{
        background: [
          'radial-gradient(ellipse 90% 70% at 15% 25%, #004D40 0%, transparent 65%)',
          'radial-gradient(ellipse 70% 55% at 85% 75%, #003830 0%, transparent 60%)',
          'radial-gradient(ellipse 50% 40% at 60% 10%, #002e26 0%, transparent 55%)',
          'radial-gradient(ellipse 60% 50% at 80% 15%, rgba(0,58,46,0.5) 0%, transparent 60%)',
          'radial-gradient(ellipse 40% 35% at 10% 80%, rgba(0,77,64,0.45) 0%, transparent 55%)',
        ].join(', '),
      }} />

      {/* CSS-animated orb — top right, deep green */}
      <div style={{
        position: 'absolute',
        width: '55vw', height: '55vw',
        top: '-20%', right: '-10%',
        background: 'radial-gradient(circle, rgba(0,77,60,0.45) 0%, transparent 70%)',
        borderRadius: '50%',
        animation: 'orbFloat1 22s ease-in-out infinite',
      }} />

      {/* CSS-animated orb — bottom left */}
      <div style={{
        position: 'absolute',
        width: '35vw', height: '35vw',
        bottom: '-8%', left: '-5%',
        background: 'radial-gradient(circle, rgba(0,64,50,0.35) 0%, transparent 70%)',
        borderRadius: '50%',
        animation: 'orbFloat2 28s ease-in-out infinite',
      }} />

      {/* CSS-animated centre pulse */}
      <div style={{
        position: 'absolute',
        width: '25vw', height: '25vw',
        top: '35%', left: '40%',
        background: 'radial-gradient(circle, rgba(0,77,64,0.4) 0%, transparent 70%)',
        borderRadius: '50%',
        animation: 'orbPulse 18s ease-in-out infinite',
      }} />

      {/* Dot grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }} />

      {/* Edge vignette */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 120% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.35) 100%)',
      }} />

      <style>{`
        @keyframes orbFloat1 {
          0%   { transform: translate(0px, 0px); }
          33%  { transform: translate(40px, -30px); }
          66%  { transform: translate(-25px, 40px); }
          100% { transform: translate(0px, 0px); }
        }
        @keyframes orbFloat2 {
          0%   { transform: translate(0px, 0px); }
          33%  { transform: translate(-30px, 35px); }
          66%  { transform: translate(25px, -20px); }
          100% { transform: translate(0px, 0px); }
        }
        @keyframes orbPulse {
          0%   { transform: scale(1);    opacity: 0.6; }
          50%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1);    opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
