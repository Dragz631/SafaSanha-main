import React, { useEffect, useState } from 'react';
import { Sparkles, Coins, CheckCircle2 } from 'lucide-react';

export interface MoneyCelebrationEvent {
  id: string;
  houseNumber: string;
  recipientName?: string;
  packageCount?: number;
  amount?: string;
  streetName?: string;
}

interface MoneyCelebrationToastProps {
  event: MoneyCelebrationEvent | null;
  onDismiss: () => void;
}

export const MoneyCelebrationToast: React.FC<MoneyCelebrationToastProps> = ({ event, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (event) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 2700);
      return () => clearTimeout(timer);
    }
  }, [event, onDismiss]);

  if (!event || !visible) return null;

  const count = event.packageCount || 1;
  const earningsText = event.amount || (count > 1 ? `+ R$ ${(count * 4.5).toFixed(2).replace('.', ',')}` : '+ R$ 4,50');

  return (
    <div
      onClick={() => {
        setVisible(false);
        setTimeout(onDismiss, 200);
      }}
      className="fixed inset-x-0 top-4 z-[9999] flex justify-center px-4 pointer-events-auto cursor-pointer animate-bounce-in"
    >
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950 text-white px-5 py-3.5 rounded-3xl border-2 border-amber-400 shadow-2xl flex items-center gap-3.5 max-w-md w-full backdrop-blur-md">
        {/* Animated Golden Coin Icon */}
        <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex flex-col items-center justify-center font-black shrink-0 shadow-lg border border-yellow-200 animate-pulse">
          <Coins className="w-6 h-6 text-amber-950 stroke-[2.5]" />
          <span className="text-[9px] font-black uppercase tracking-tighter leading-none text-amber-950">
            PAGO
          </span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-emerald-400 font-black text-xs uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              Dinheiro na Conta!
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              {count > 1 ? `${count} pacotes` : '1 pacote'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl sm:text-2xl font-black text-amber-300 tracking-tight">
              {earningsText}
            </span>
            <span className="text-xs text-slate-300 font-bold truncate">
              Nº {event.houseNumber} {event.recipientName ? `• ${event.recipientName}` : ''}
            </span>
          </div>

          <p className="text-[11px] text-emerald-200/90 font-medium truncate flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Baixa concluída com sucesso no SafaSanha</span>
          </p>
        </div>

        {/* Floating background sparkles */}
        <div className="absolute -right-2 -bottom-2 text-3xl opacity-20 pointer-events-none select-none">
          💵
        </div>
        <div className="absolute -left-2 -top-2 text-2xl opacity-20 pointer-events-none select-none">
          🪙
        </div>
      </div>
    </div>
  );
};
