import React, { useState, useEffect } from 'react';
import { onRewardTriggered } from '../utils/rewardEffect';
import { TrendingUp, Sparkles } from 'lucide-react';

export const FloatingMoneyReward: React.FC = () => {
  const [reward, setReward] = useState<{ id: number; count: number; clientName?: string } | null>(null);

  useEffect(() => {
    const unsub = onRewardTriggered(({ count, clientName }) => {
      const id = Date.now();
      setReward({ id, count, clientName });

      const timer = setTimeout(() => {
        setReward((curr) => (curr?.id === id ? null : curr));
      }, 1900);

      return () => clearTimeout(timer);
    });

    return unsub;
  }, []);

  if (!reward) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fadeIn">
      <div className="flex items-center gap-2.5 bg-gradient-to-r from-amber-600 via-amber-700 to-emerald-700 text-white px-4 py-2 rounded-2xl shadow-xl shadow-amber-950/20 border border-amber-300/40 backdrop-blur-md">
        <span className="text-lg leading-none animate-bounce">🪙</span>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-xs tracking-tight text-amber-200 drop-shadow-xs">
              +{(reward.count || 1) * 2} MOEDAS DE OURO!
            </span>
            <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase">
              {reward.count > 1 ? `${reward.count}x baixas` : '1 entrega'}
            </span>
          </div>
          {reward.clientName && (
            <span className="text-[10px] text-emerald-100 font-medium truncate max-w-[200px]">
              Destinatário: {reward.clientName}
            </span>
          )}
        </div>
        <Sparkles className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
      </div>
    </div>
  );
};
