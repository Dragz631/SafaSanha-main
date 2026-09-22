import React, { useState, useMemo } from 'react';
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Share2,
  Copy,
  Check,
  ChevronRight,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  History,
  Archive,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { DeliveryData } from '../types';
import {
  buildDailySummaryWhatsAppMessage,
  shareOrOpenWhatsApp,
  copyTextToClipboard,
  getFormattedCurrentDate,
  getFormattedCurrentTime
} from '../utils/whatsappHelper';
import { FailureDetailsModal } from './FailureDetailsModal';
import { DeliveryHistoryModal } from './DeliveryHistoryModal';
import { CloseDayModal } from './CloseDayModal';
import { getStreetInfo } from '../data/cajuStreets';
import { contarPacotes, pacotesDaRua, pacotesSemRua, ruasDosPacotes } from '../domain/ruas';
import { chaveTexto } from '../domain/texto';

interface GeneralSummaryTabProps {
  deliveries: DeliveryData[];
  savedStreets: string[];
  onSelectStreet: (street: string) => void;
  onClearAllDeliveries?: () => void;
  onUpdateDelivery?: (delivery: DeliveryData) => void;
  onSetDeliveries?: (deliveries: DeliveryData[]) => void;
}

export const GeneralSummaryTab: React.FC<GeneralSummaryTabProps> = ({
  deliveries,
  savedStreets,
  onSelectStreet,
  onClearAllDeliveries,
  onUpdateDelivery,
  onSetDeliveries,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [isFailuresModalOpen, setIsFailuresModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isCloseDayModalOpen, setIsCloseDayModalOpen] = useState<boolean>(false);
  const [closeDayToast, setCloseDayToast] = useState<string | null>(null);

  // Calcula estatísticas gerais
  const totalPackages = deliveries.length;
  const deliveredCount = deliveries.filter((d) => d.status === 'entregue' || d.status === 'concluido').length;
  const insucessoCount = deliveries.filter((d) => d.status === 'insucesso').length;
  const pendingCount = totalPackages - deliveredCount - insucessoCount;
  const percentage = totalPackages > 0 ? Math.round((deliveredCount / totalPackages) * 100) : 0;

  // Unifica todas as ruas (tanto as cadastradas quanto as presentes nos pacotes) sem duplicatas
  const allStreets = useMemo(() => {
    const streetsMap = new Map<string, string>();
    savedStreets.forEach((st) => {
      const clean = st?.trim();
      if (clean && !streetsMap.has(chaveTexto(clean))) {
        streetsMap.set(chaveTexto(clean), clean);
      }
    });
    ruasDosPacotes(deliveries).forEach((st) => {
      if (!streetsMap.has(chaveTexto(st))) streetsMap.set(chaveTexto(st), st);
    });
    return Array.from(streetsMap.values());
  }, [savedStreets, deliveries]);

  // Estatísticas por rua / setor (mesma contagem de todas as outras telas)
  const streetStats = useMemo(() => {
    return allStreets.map((st) => {
      const { total, entregues: delivered, insucessos: insucesso, pendentes: pending } = contarPacotes(
        pacotesDaRua(deliveries, st)
      );
      const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;
      const info = getStreetInfo(st);

      return {
        name: st,
        total,
        delivered,
        insucesso,
        pending,
        pct,
        isCompleted: delivered === total && total > 0,
        sector: info.sector,
        badgeColor: info.badgeColor,
      };
    }).sort((a, b) => b.total - a.total);
  }, [allStreets, deliveries]);

  const summaryMessage = useMemo(() => {
    return buildDailySummaryWhatsAppMessage({
      total: totalPackages,
      delivered: deliveredCount,
      pending: pendingCount,
      insucesso: insucessoCount,
      streets: streetStats.filter((s) => s.total > 0),
    });
  }, [totalPackages, deliveredCount, pendingCount, insucessoCount, streetStats]);

  const handleShareSummary = async () => {
    const res = await shareOrOpenWhatsApp(summaryMessage);
    if (res.method === 'share') {
      setShareFeedback('Abrindo WhatsApp...');
    } else if (res.method === 'whatsapp') {
      setShareFeedback('Abrindo conversa do WhatsApp...');
    }
    setTimeout(() => setShareFeedback(null), 2500);
  };

  const handleCopySummary = async () => {
    const ok = await copyTextToClipboard(summaryMessage);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirmCloseDay = (params: {
    nextDayDeliveries: DeliveryData[];
    totalDelivered: number;
    totalRolledOver: number;
  }) => {
    if (onSetDeliveries) {
      onSetDeliveries(params.nextDayDeliveries);
    } else if (onClearAllDeliveries && params.nextDayDeliveries.length === 0) {
      onClearAllDeliveries();
    }

    setCloseDayToast(
      `✅ Dia encerrado! ${params.totalDelivered} pacotes gravados no Histórico Permanente.` +
        (params.totalRolledOver > 0
          ? ` ${params.totalRolledOver} pacote(s) reagendados para a próxima rota.`
          : '')
    );

    setTimeout(() => {
      setCloseDayToast(null);
    }, 4500);
  };

  return (
    <div className="max-w-xl mx-auto px-3.5 pt-3 pb-24 space-y-3.5 animate-fadeIn">
      
      {/* TOAST DE FEEDBACK DE FECHAMENTO DO DIA */}
      {closeDayToast && (
        <div className="bg-emerald-600 text-white p-3.5 rounded-2xl shadow-xl text-xs font-black text-center animate-fadeIn flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-white shrink-0 stroke-[2.5]" />
          <span>{closeDayToast}</span>
        </div>
      )}

      {/* 1. CABEÇALHO DO RESUMO GERAL */}
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black border border-emerald-500/30 shrink-0">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                Resumo Geral das Rotas
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                {getFormattedCurrentDate(new Date())} • {getFormattedCurrentTime(new Date())}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block leading-none">
              {percentage}%
            </span>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-black">
              Concluído
            </span>
          </div>
        </div>

        {/* Barra de Progresso Geral */}
        <div className="space-y-1">
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex shadow-inner">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
            {insucessoCount > 0 && (
              <div
                className="bg-rose-500 h-full transition-all duration-500"
                style={{ width: `${(insucessoCount / (totalPackages || 1)) * 100}%` }}
              />
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold px-0.5">
            <span>{deliveredCount} de {totalPackages} pacotes entregues</span>
            {insucessoCount > 0 && (
              <span className="text-rose-500 font-black">{insucessoCount} falha(s)</span>
            )}
          </div>
        </div>

        {/* Cards de Métricas (4 Colunas) */}
        <div className="grid grid-cols-4 gap-2 text-center pt-0.5">
          {/* Total */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Total</span>
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{totalPackages}</span>
          </div>

          {/* Entregues */}
          <div className="bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/50">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">Entregues</span>
            <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">{deliveredCount}</span>
          </div>

          {/* Pendentes */}
          <div className="bg-amber-50/80 dark:bg-amber-950/40 p-2.5 rounded-2xl border border-amber-200/80 dark:border-amber-800/50">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">Pendentes</span>
            <span className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400">{pendingCount}</span>
          </div>

          {/* Falhas Interativo */}
          <button
            type="button"
            onClick={() => setIsFailuresModalOpen(true)}
            className={`p-2.5 rounded-2xl border transition-all cursor-pointer text-center relative group active:scale-95 touch-manipulation ${
              insucessoCount > 0
                ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 shadow-xs ring-1 ring-rose-400/40'
                : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40 opacity-70'
            }`}
            title="Ver detalhes dos pacotes com falha"
          >
            {insucessoCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            )}
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 block flex items-center justify-center gap-0.5">
              <span>Falhas</span>
              {insucessoCount > 0 && <ChevronRight className="w-2.5 h-2.5" />}
            </span>
            <span className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 block leading-tight">
              {insucessoCount}
            </span>
          </button>
        </div>

        {/* PAINEL DE MOEDAS DE OURO CONQUISTADAS HOJE */}
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl p-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0 text-xl">
              🪙
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                  {deliveredCount * 2} Moedas de Ouro
                </span>
                <span className="bg-amber-400/20 text-amber-800 dark:text-amber-300 text-[9px] font-black px-1.5 py-0.2 rounded-md border border-amber-400/30 uppercase">
                  Saldo de Hoje
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-tight mt-0.5 truncate">
                Cada pacote entregue soma 2 moedas de ouro (+2 🪙).
              </p>
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 block leading-none">
              +{deliveredCount * 2}
            </span>
            <span className="text-[8px] uppercase tracking-wider text-amber-700 dark:text-amber-500 font-black">
              acumuladas
            </span>
          </div>
        </div>
      </div>

      {/* BANNER DE DESTAQUE DE FALHAS (SE HOUVER INSUCESSOS) */}
      {insucessoCount > 0 && (
        <div
          onClick={() => setIsFailuresModalOpen(true)}
          className="bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-2xl p-3.5 shadow-xs flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-xs sm:text-sm text-rose-950 dark:text-rose-200 leading-tight">
                {insucessoCount} pacote{insucessoCount > 1 ? 's' : ''} com falha registrada
              </h3>
              <p className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold truncate mt-0.5">
                Toque aqui para abrir e ver os motivos de cada falha
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-rose-600 text-white text-[11px] font-black px-2.5 py-1 rounded-xl shrink-0">
            <span>Ver</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* 2. BOTÕES DE AÇÃO: HISTÓRICO & ENCERRAR DIA (48px TOUCH TARGET) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Botão Histórico Permanente */}
        <button
          type="button"
          onClick={() => setIsHistoryModalOpen(true)}
          className="h-13 px-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between gap-2.5 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-xs font-black block">
                Histórico de Dias Concluídos
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                Provas definitivas antiacareação
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        {/* Botão Encerrar Dia */}
        <button
          type="button"
          onClick={() => setIsCloseDayModalOpen(true)}
          disabled={deliveries.length === 0}
          className="h-13 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-750 disabled:opacity-50 text-white rounded-2xl border border-slate-700/60 shadow-xs flex items-center justify-between gap-2.5 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-xs font-black block">
                Encerrar Dia de Entregas
              </span>
              <span className="text-[10px] text-emerald-300 font-medium block">
                Gravar histórico e iniciar nova rota
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* 3. RELATÓRIO WHATSAPP (56px TOUCH TARGET) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
            <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
            <span>Prestação de Contas / WhatsApp</span>
          </span>
          <button
            onClick={handleCopySummary}
            className={`h-8 px-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 touch-manipulation ${
              copied
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>

        {shareFeedback && (
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center text-xs font-black animate-pulse">
            {shareFeedback}
          </div>
        )}

        <button
          onClick={handleShareSummary}
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all touch-manipulation"
        >
          <Share2 className="w-5 h-5 stroke-[2.5]" />
          <span>Enviar Resumo do Dia no WhatsApp</span>
        </button>
      </div>

      {/* Pacotes sem rua não pertencem a nenhuma rua (nunca são somados a uma): avisa em vez de esconder */}
      {pacotesSemRua(deliveries).length > 0 && (
        <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 text-rose-800 text-xs font-bold p-3">
          ⚠️ {pacotesSemRua(deliveries).length} pacote(s) sem rua informada — não aparecem em nenhuma rua. Corrija o endereço deles.
        </div>
      )}

      {/* 4. RELAÇÃO DE TODAS AS RUAS ATENDIDAS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
              Ruas Atendidas Hoje ({streetStats.length})
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {streetStats.filter((s) => s.isCompleted).length} concluídas
          </span>
        </div>

        <div className="space-y-2">
          {streetStats.map((st, idx) => (
            <div
              key={`stat-st-${st.name}-${idx}`}
              onClick={() => onSelectStreet(st.name)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs active:scale-[0.99] space-y-2 touch-manipulation ${
                st.isCompleted
                  ? 'bg-slate-50/80 dark:bg-slate-950/50 border-emerald-300/80 dark:border-emerald-500/40 hover:border-emerald-500'
                  : 'bg-slate-50/50 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      st.isCompleted
                        ? 'bg-emerald-500'
                        : st.total === 0
                        ? 'bg-slate-300 dark:bg-slate-600'
                        : 'bg-amber-500 animate-pulse'
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate block">
                      {st.name}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block truncate">
                      {st.sector}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${
                      st.isCompleted
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : st.total === 0
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {st.delivered}/{st.total} entregues
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                </div>
              </div>

              {/* Mini barra de progresso da rua */}
              {st.total > 0 && (
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${st.pct}%` }}
                  />
                  {st.insucesso > 0 && (
                    <div
                      className="bg-rose-500 h-full"
                      style={{ width: `${(st.insucesso / st.total) * 100}%` }}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MODAL DETALHADO DE FALHAS / MOTIVOS */}
      <FailureDetailsModal
        isOpen={isFailuresModalOpen}
        deliveries={deliveries}
        onClose={() => setIsFailuresModalOpen(false)}
        onSelectStreet={(street) => {
          setIsFailuresModalOpen(false);
          onSelectStreet(street);
        }}
        onReopenDelivery={(reopened) => {
          if (onUpdateDelivery) {
            onUpdateDelivery(reopened);
          }
        }}
      />

      {/* MODAL DE HISTÓRICO DE DIAS CONCLUÍDOS */}
      <DeliveryHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {/* MODAL DE FECHAMENTO DO DIA */}
      <CloseDayModal
        isOpen={isCloseDayModalOpen}
        deliveries={deliveries}
        onClose={() => setIsCloseDayModalOpen(false)}
        onConfirmCloseDay={handleConfirmCloseDay}
      />

    </div>
  );
};
