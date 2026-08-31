import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Coins, DollarSign, TrendingUp, CheckCircle2 } from 'lucide-react';

interface MoneyRewardOverlayProps {
  isVisible: boolean;
  packageCount?: number;
  clientName?: string;
  onClose: () => void;
}

// Síntese de som agradável de moedas / caixa registradora (Web Audio API)
const playChaChingSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Primeiro tom metálico (moeda 1)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(987.77, now); // B5
    osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08); // E6
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Segundo tom (caixa registradora / 'cha-ching' agudo)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now + 0.08); // E6
    osc2.frequency.exponentialRampToValueAtTime(1975.53, now + 0.22); // B6
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.35, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.65);

    // Terceiro tom (brilho dourado)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(2637.02, now + 0.14); // E7
    gain3.gain.setValueAtTime(0.001, now);
    gain3.gain.setValueAtTime(0.2, now + 0.14);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.14);
    osc3.stop(now + 0.8);
  } catch (_e) {
    // Ignora silenciosamente se o navegador bloquear autoplay
  }
};

export const MoneyRewardOverlay: React.FC<MoneyRewardOverlayProps> = ({
  isVisible,
  packageCount = 1,
  clientName,
  onClose,
}) => {
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (isVisible && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      playChaChingSound();

      // Dispara confetti personalizado com tons de ouro, esmeralda e cédulas
      try {
        confetti({
          particleCount: 65,
          spread: 80,
          origin: { y: 0.65 },
          colors: ['#10b981', '#fbbf24', '#f59e0b', '#34d399', '#fef08a', '#ffffff'],
          ticks: 200,
          gravity: 0.9,
          scalar: 1.2,
        });

        // Segundo burst lateral de moedas/ouro
        setTimeout(() => {
          confetti({
            particleCount: 35,
            angle: 60,
            spread: 55,
            origin: { x: 0.1, y: 0.7 },
            colors: ['#fbbf24', '#10b981', '#f59e0b'],
          });
          confetti({
            particleCount: 35,
            angle: 120,
            spread: 55,
            origin: { x: 0.9, y: 0.7 },
            colors: ['#fbbf24', '#10b981', '#f59e0b'],
          });
        }, 180);
      } catch (_e) {}

      // Timer para fechar automaticamente
      const timer = setTimeout(() => {
        onClose();
      }, 2300);

      return () => {
        clearTimeout(timer);
      };
    } else if (!isVisible) {
      hasTriggeredRef.current = false;
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  // Gerador de elementos flutuantes de dinheiro e ouro
  const floatingCoins = [
    { text: '💰', left: '12%', top: '25%', delay: '0s', size: 'text-3xl' },
    { text: '💵', left: '80%', top: '22%', delay: '0.1s', size: 'text-4xl' },
    { text: '🪙', left: '18%', top: '65%', delay: '0.15s', size: 'text-3xl' },
    { text: '💸', left: '76%', top: '60%', delay: '0.2s', size: 'text-3xl' },
    { text: 'R$', left: '28%', top: '15%', delay: '0.05s', size: 'text-2xl font-black text-amber-300' },
    { text: 'R$', left: '68%', top: '75%', delay: '0.25s', size: 'text-2xl font-black text-emerald-300' },
    { text: '✨', left: '48%', top: '12%', delay: '0.1s', size: 'text-2xl text-yellow-300' },
    { text: '🪙', left: '88%', top: '42%', delay: '0.18s', size: 'text-3xl' },
    { text: '💰', left: '8%', top: '45%', delay: '0.22s', size: 'text-3xl' },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs cursor-pointer animate-fadeIn select-none"
    >
      {/* Elementos flutuantes de dinheiro e ouro ao redor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {floatingCoins.map((item, idx) => (
          <div
            key={`coin-${idx}`}
            className={`absolute ${item.size} animate-bounce transition-transform duration-700 drop-shadow-md`}
            style={{
              left: item.left,
              top: item.top,
              animationDelay: item.delay,
              animationDuration: '1.2s',
            }}
          >
            {item.text}
          </div>
        ))}
      </div>

      {/* CARD PRINCIPAL DE RECOMPENSA FINANCEIRA */}
      <div
        className="relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 max-w-sm w-full border-2 border-amber-400 shadow-2xl shadow-amber-500/30 text-center space-y-4 transform scale-100 animate-fadeIn"
        style={{
          boxShadow: '0 0 40px rgba(251, 191, 36, 0.4), inset 0 0 20px rgba(16, 185, 129, 0.2)',
        }}
      >
        {/* Glow e Partículas de Fundo */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-20 h-20 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />

        {/* Ícone 3D de Dinheiro / Ouro */}
        <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-emerald-400 p-0.5 shadow-lg shadow-amber-500/40 animate-pulse flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center relative overflow-hidden">
            <span className="text-4xl leading-none select-none">💰</span>
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-400/10 to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Textos de Impacto Visual */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-black uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Entrega Confirmada</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-emerald-300 bg-clip-text text-transparent leading-tight tracking-tight drop-shadow-sm">
            + R$ DINHEIRO NA CONTA!
          </h2>

          <p className="text-xs font-bold text-slate-300">
            {packageCount > 1
              ? `🚀 ${packageCount} pacotes entregues de uma vez!`
              : clientName
              ? `Pacote entregue para ${clientName}!`
              : 'Pacote finalizado com sucesso!'}
          </p>
        </div>

        {/* Placa de Status Financeiro */}
        <div className="bg-slate-800/90 border border-amber-400/40 rounded-2xl p-3 flex items-center justify-center gap-3">
          <div className="text-left flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-amber-300/80 font-black block leading-none">
                Crédito da Entrega
              </span>
              <span className="text-xs font-black text-white leading-none mt-0.5 block">
                Valor Computado
              </span>
            </div>
          </div>
          <span className="text-xs font-black text-emerald-400 bg-emerald-950/80 border border-emerald-600/60 px-2.5 py-1 rounded-lg">
            PAGO ✅
          </span>
        </div>

        <p className="text-[10px] text-slate-400 font-medium">
          Toque em qualquer lugar para continuar
        </p>
      </div>
    </div>
  );
};
