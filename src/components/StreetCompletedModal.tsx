import React, { useEffect } from 'react';
import {
  Trophy,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Archive,
  Compass,
  Package,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DeliveryData } from '../types';

interface StreetCompletedModalProps {
  isOpen: boolean;
  streetName: string;
  deliveredCount: number;
  insucessoCount: number;
  failedDeliveries: DeliveryData[];
  remainingStreetsCount: number;
  nextStreetName?: string;
  onClose: () => void;
  onGoToNextStreet?: (streetName: string) => void;
  onOpenCloseDayModal?: () => void;
}

export const playStreetCompletedSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    // Acorde triunfante em arpejo: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);

      gain.gain.setValueAtTime(0.001, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.3, now + i * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.45);
    });

    // Sino brilhante final
    setTimeout(() => {
      try {
        const oscBell = ctx.createOscillator();
        const gainBell = ctx.createGain();
        const t = ctx.currentTime;
        oscBell.type = 'sine';
        oscBell.frequency.setValueAtTime(2093.0, t); // C7
        gainBell.gain.setValueAtTime(0.35, t);
        gainBell.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        oscBell.connect(gainBell);
        gainBell.connect(ctx.destination);
        oscBell.start(t);
        oscBell.stop(t + 0.8);
      } catch (_e) {}
    }, 420);
  } catch (_e) {}
};

export const StreetCompletedModal: React.FC<StreetCompletedModalProps> = ({
  isOpen,
  streetName,
  deliveredCount,
  insucessoCount,
  failedDeliveries,
  remainingStreetsCount,
  nextStreetName,
  onClose,
  onGoToNextStreet,
  onOpenCloseDayModal,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    // Dispara som triunfante
    playStreetCompletedSound();

    // Vibração tátil
    try {
      if ('vibrate' in navigator) navigator.vibrate([80, 50, 120, 60, 200]);
    } catch (_e) {}

    // Explosão rica de confetes
    try {
      confetti({
        particleCount: 50,
        spread: 80,
        startVelocity: 35,
        origin: { x: 0.5, y: 0.4 },
        colors: ['#10b981', '#fbbf24', '#f59e0b', '#3b82f6', '#ffffff'],
      });
      setTimeout(() => {
        try {
          confetti({
            particleCount: 30,
            angle: 60,
            spread: 60,
            origin: { x: 0.2, y: 0.5 },
            colors: ['#10b981', '#fbbf24'],
          });
          confetti({
            particleCount: 30,
            angle: 120,
            spread: 60,
            origin: { x: 0.8, y: 0.5 },
            colors: ['#10b981', '#fbbf24'],
          });
        } catch (_e) {}
      }, 180);
    } catch (_e) {}
  }, [isOpen]);

  if (!isOpen) return null;

  const hasInsucesso = insucessoCount > 0;
  const isAllStreetsDone = remainingStreetsCount === 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col animate-scaleUp">
        {/* CABEÇALHO COM TROFÉU E DESTAQUE */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 text-white p-5 text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg mb-2.5 animate-bounce">
              <Trophy className="w-8 h-8 fill-slate-950" />
            </div>

            <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-black/30 px-2.5 py-0.5 rounded-full mb-1">
              Missão Cumprida
            </span>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              RUA FINALIZADA!
            </h2>
            <p className="text-xs text-emerald-100 font-bold mt-0.5 truncate max-w-xs">
              {streetName}
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* ESTATÍSTICA DESTA RUA */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase tracking-wider">
                Entregues com Sucesso
              </span>
              <span className="text-lg font-black text-emerald-950 dark:text-emerald-200">
                {deliveredCount} {deliveredCount === 1 ? 'pacote' : 'pacotes'}
              </span>
            </div>

            <div
              className={`p-2.5 rounded-2xl border ${
                hasInsucesso
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200'
              }`}
            >
              <span className="text-[10px] font-bold block uppercase tracking-wider opacity-80">
                Insucessos
              </span>
              <span className="text-lg font-black">
                {insucessoCount} {insucessoCount === 1 ? 'pacote' : 'pacotes'}
              </span>
            </div>
          </div>

          {/* MENSAGEM MOTIVACIONAL DO OBJETIVO DO DIA */}
          <div className="bg-gradient-to-r from-amber-50 to-amber-100/70 dark:from-amber-950/40 dark:to-slate-900 p-3.5 rounded-2xl border border-amber-300 dark:border-amber-700/60 text-slate-900 dark:text-slate-100 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
              <Sparkles className="w-4 h-4 fill-amber-400" />
              <span className="font-black text-xs uppercase tracking-wide">
                {isAllStreetsDone ? 'Objetivo do Dia Alcançado!' : 'Rumo ao Final do Dia!'}
              </span>
            </div>

            {isAllStreetsDone ? (
              <p className="text-xs text-slate-700 dark:text-slate-300 font-bold leading-relaxed">
                🎉 <b>Parabéns!</b> Você finalizou <b>todas as ruas</b> da sua rota de hoje! Você está 100% livre para encerrar o dia e fechar seu relatório com chave de ouro.
              </p>
            ) : (
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                Faltam apenas <b>{remainingStreetsCount} {remainingStreetsCount === 1 ? 'rua' : 'ruas'}</b> para você bater a meta e encerrar o dia! Você está muito perto!
              </p>
            )}
          </div>

          {/* AVISO E DECISÃO DE INSUCESSO (SE HOUVER PACOTE COM FALHA) */}
          {hasInsucesso && (
            <div className="bg-rose-50 dark:bg-rose-950/40 rounded-2xl p-3.5 border border-rose-200 dark:border-rose-800/80 space-y-2.5">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-xs font-black">
                  Atenção: Restou {insucessoCount} pacote com insucesso nesta rua!
                </span>
              </div>

              {/* Lista dos pacotes com insucesso */}
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-0.5 no-scrollbar">
                {failedDeliveries.map((del) => (
                  <div
                    key={del.id_entrega}
                    className="bg-white dark:bg-slate-900/80 p-2 rounded-xl border border-rose-200/80 dark:border-rose-900 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-black text-slate-900 dark:text-slate-100 truncate block">
                        Nº {del.numero_casa || del.endereco_numero} {del.complemento ? `(${del.complemento})` : ''} • {del.nome_destinatario || 'Morador'}
                      </span>
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block truncate">
                        Motivo: {del.motivo_insucesso || del.recebedor_detalhes || 'Ausente / Não atende'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 px-1.5 py-0.5 rounded-md shrink-0">
                      {del.codigo_pacote}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                O que você deseja fazer com {insucessoCount === 1 ? 'este pacote' : 'estes pacotes'}?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                  <span>Manter na Rota de Hoje</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenCloseDayModal) onOpenCloseDayModal();
                  }}
                  className="py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Encerrar / Devolver</span>
                </button>
              </div>
            </div>
          )}

          {/* BOTÕES DE AÇÃO PRINCIPAIS */}
          <div className="space-y-2 pt-1">
            {!hasInsucesso && !isAllStreetsDone && nextStreetName && onGoToNextStreet && (
              <button
                type="button"
                onClick={() => {
                  onGoToNextStreet(nextStreetName);
                  onClose();
                }}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Compass className="w-4 h-4" />
                <span>🚀 Ir para a Próxima Rua ({nextStreetName})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {!hasInsucesso && isAllStreetsDone && onOpenCloseDayModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCloseDayModal();
                }}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Archive className="w-4 h-4 text-amber-300" />
                <span>📦 Encerrar o Dia e Gerar Relatório</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition-all text-center"
            >
              Continuar no App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
