import React, { useState, useEffect } from 'react';
import { onCelebration, CelebrationEventData, FloatingParticle } from '../utils/rewardEffect';
import { Sparkles } from 'lucide-react';

export const CashCelebrationBurst: React.FC = () => {
  const [activeEvent, setActiveEvent] = useState<CelebrationEventData | null>(null);

  useEffect(() => {
    const unsub = onCelebration((data) => {
      setActiveEvent(data);
      const timer = setTimeout(() => {
        setActiveEvent(null);
      }, 1800);

      return () => clearTimeout(timer);
    });

    return unsub;
  }, []);

  if (!activeEvent) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* 1. Partículas Voadoras Físicas de Moedas e Cifrões saindo do Ponto de Clique */}
      {activeEvent.particles.map((p) => {
        return (
          <div
            key={p.id}
            className="absolute select-none will-change-transform text-2xl sm:text-3xl"
            style={{
              left: `${p.x}px`,
              top: `${p.y}px`,
              animation: 'moneyBurstFly 1.4s cubic-bezier(0.12, 0.8, 0.32, 1) forwards',
              '--target-x': `${p.vx * 0.9}px`,
              '--target-y': `${p.vy * 0.9}px`,
              '--rot': `${p.rotation}deg`,
              '--scale': p.scale,
            } as React.CSSProperties}
          >
            {p.emoji}
          </div>
        );
      })}

      {/* 2. Banner Flutuante de Alto Impacto: + R$ DINHEIRO NA CONTA! */}
      <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 via-teal-700 to-amber-600 text-white px-5 py-2.5 rounded-2xl shadow-2xl border-2 border-amber-300/60 backdrop-blur-md animate-fadeIn scale-105">
        <span className="text-2xl animate-bounce leading-none">💰</span>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm sm:text-base tracking-tight text-white drop-shadow-sm">
              + R$ DINHEIRO NA CONTA!
            </span>
            <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md uppercase shadow-xs">
              {activeEvent.count > 1 ? `${activeEvent.count}x baixas` : 'Confirmado'}
            </span>
          </div>
          {activeEvent.clientName && (
            <span className="text-[11px] text-emerald-100 font-bold truncate max-w-[220px]">
              {activeEvent.clientName}
            </span>
          )}
        </div>
        <Sparkles className="w-5 h-5 text-amber-300 shrink-0 animate-spin" />
      </div>

      <style>{`
        @keyframes moneyBurstFly {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) translate(0px, 0px) scale(0.6) rotate(0deg);
          }
          60% {
            opacity: 1;
            transform: translate(-50%, -50%) translate(var(--target-x), var(--target-y)) scale(var(--scale)) rotate(var(--rot));
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translate(var(--target-x), calc(var(--target-y) + 80px)) scale(0.4) rotate(calc(var(--rot) + 180deg));
          }
        }
      `}</style>
    </div>
  );
};
