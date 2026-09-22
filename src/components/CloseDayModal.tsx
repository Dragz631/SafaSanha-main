import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Package,
  ShieldCheck,
  X,
  ArrowRight,
  Sparkles,
  Archive,
  Truck
} from 'lucide-react';
import { DeliveryData } from '../types';
import { closeCurrentDeliveryDay } from '../utils/historyHelper';

interface CloseDayModalProps {
  isOpen: boolean;
  deliveries: DeliveryData[];
  onClose: () => void;
  onConfirmCloseDay: (params: {
    nextDayDeliveries: DeliveryData[];
    totalDelivered: number;
    totalRolledOver: number;
  }) => void;
}

export const CloseDayModal: React.FC<CloseDayModalProps> = ({
  isOpen,
  deliveries,
  onClose,
  onConfirmCloseDay,
}) => {
  const [rolloverToNextDay, setRolloverToNextDay] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  const deliveredList = deliveries.filter(
    (d) => d.status === 'entregue' || d.status === 'concluido'
  );
  const nonDeliveredList = deliveries.filter(
    (d) => d.status !== 'entregue' && d.status !== 'concluido'
  );
  const failedList = nonDeliveredList.filter((d) => d.status === 'insucesso');
  const pendingList = nonDeliveredList.filter((d) => d.status !== 'insucesso');

  const handleExecuteCloseDay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const result = closeCurrentDeliveryDay({
        deliveries,
        rolloverNonDeliveredToNextDay: rolloverToNextDay,
      });

      setIsProcessing(false);
      if (!result.historicoSalvo) {
        window.alert(
          'Não foi possível arquivar o dia (armazenamento do aparelho cheio). Nada foi apagado. Libere espaço e tente encerrar de novo.'
        );
        return;
      }
      onConfirmCloseDay({
        nextDayDeliveries: result.nextDayDeliveries,
        totalDelivered: result.totalDelivered,
        totalRolledOver: result.totalRolledOver,
      });
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-800 flex flex-col max-h-[92vh] pb-safe">

        {/* CABEÇALHO DO MODAL */}
        <div className="bg-slate-950 text-white p-4 pb-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-white leading-tight">
                Encerrar Dia de Entregas
              </h2>
              <p className="text-[11px] text-slate-400">
                Arquivar entregas concluídas no histórico definitivo e preparar nova rota
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CORPO: RESUMO E OPÇÃO DE REMANEJO */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1 bg-slate-950/30">

          {/* Card das Entregas que irão para o Histórico */}
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-emerald-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Entregas Concluídas (Sobem para o Histórico)</span>
              </div>
              <span className="bg-emerald-600 text-white font-black text-xs px-2.5 py-1 rounded-xl">
                {deliveredList.length} pacotes
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/80 leading-relaxed">
              Estes <strong>{deliveredList.length} pacotes</strong> serão gravados permanentemente no seu Histórico com a hora exata da entrega, quem recebeu e rastro temporal como <strong>prova definitiva antiacareação</strong>.
            </p>

            {/* Moedas de Ouro do Dia */}
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5 text-xs font-black text-amber-300">
              <span className="flex items-center gap-1.5">
                <span>🪙</span>
                <span>Moedas de Ouro Ganhas Hoje:</span>
              </span>
              <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-lg">
                +{deliveredList.length * 2} moedas
              </span>
            </div>
          </div>

          {/* Card dos Pacotes Não Entregues */}
          {nonDeliveredList.length > 0 ? (
            <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-amber-300 text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Pacotes Não Entregues Hoje</span>
                </div>
                <span className="bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded-xl">
                  {nonDeliveredList.length} ({failedList.length} falhas, {pendingList.length} pendentes)
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Escolha o que fazer com os pacotes que não foram entregues hoje:
              </p>

              {/* Opções de Ação com os Não Entregues */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setRolloverToNextDay(true)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                    rolloverToNextDay
                      ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/30'
                      : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                    rolloverToNextDay ? 'border-amber-500 bg-amber-500 text-slate-950' : 'border-slate-600'
                  }`}>
                    {rolloverToNextDay && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <span className="font-black text-xs text-slate-100 block">
                      🔄 Enviar para o Dia Seguinte (Recomendado)
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium leading-relaxed block mt-0.5">
                      Mantém o pacote com você para a próxima rota, preserva a data original de entrada na J&T e registra a tentativa no histórico da timeline.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRolloverToNextDay(false)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                    !rolloverToNextDay
                      ? 'bg-rose-500/10 border-rose-500 ring-1 ring-rose-500/30'
                      : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                    !rolloverToNextDay ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-600'
                  }`}>
                    {!rolloverToNextDay && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <span className="font-black text-xs text-slate-100 block">
                      📦 Devolver ao Galpão / Encerrar sem Reagendamento
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium leading-relaxed block mt-0.5">
                      Remove os pacotes pendentes da sua rota atual para devolução ao galpão da J&T.
                    </span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center space-y-1">
              <span className="text-xl">🎉</span>
              <h4 className="font-black text-emerald-300 text-xs">
                100% dos pacotes foram entregues!
              </h4>
              <p className="text-[11px] text-emerald-200/80">
                Nenhum pacote pendente ou com falha. Dia perfeito para arquivamento definitivo.
              </p>
            </div>
          )}

        </div>

        {/* BOTÃO DE CONFIRMAÇÃO DE FECHAMENTO DO DIA */}
        <div className="p-3.5 bg-slate-900 border-t border-slate-800 space-y-2">
          <button
            onClick={handleExecuteCloseDay}
            disabled={isProcessing || deliveries.length === 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isProcessing
                ? 'Gravando Histórico Definitivo...'
                : 'Confirmar Fechamento do Dia & Gravar Histórico'}
            </span>
          </button>

          <p className="text-[10px] text-slate-500 text-center font-medium">
            Os dados de entregas concluídas ficarão salvos para consulta a qualquer momento na aba Resumo.
          </p>
        </div>

      </div>
    </div>
  );
};
