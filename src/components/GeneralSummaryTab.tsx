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
  ArrowRight
} from 'lucide-react';
import { DeliveryData } from '../types';
import {
  buildDailySummaryWhatsAppMessage,
  shareOrOpenWhatsApp,
  copyTextToClipboard,
  getFormattedCurrentDate,
  getFormattedCurrentTime
} from '../utils/whatsappHelper';

interface GeneralSummaryTabProps {
  deliveries: DeliveryData[];
  savedStreets: string[];
  onSelectStreet: (street: string) => void;
  onClearAllDeliveries?: () => void;
}

export const GeneralSummaryTab: React.FC<GeneralSummaryTabProps> = ({
  deliveries,
  savedStreets,
  onSelectStreet,
  onClearAllDeliveries,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

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
      if (clean && !streetsMap.has(clean.toLowerCase())) {
        streetsMap.set(clean.toLowerCase(), clean);
      }
    });
    deliveries.forEach((d) => {
      const st = (d.endereco_rua || d.endereco_completo?.split(',')[0])?.trim();
      if (st && !streetsMap.has(st.toLowerCase())) {
        streetsMap.set(st.toLowerCase(), st);
      }
    });
    return Array.from(streetsMap.values());
  }, [savedStreets, deliveries]);

  // Estatísticas por rua
  const streetStats = useMemo(() => {
    return allStreets.map((st) => {
      const cleanSt = st.toLowerCase().trim();
      const stDeliveries = deliveries.filter((d) => {
        const dSt = (d.endereco_rua || d.endereco_completo || '').toLowerCase();
        return dSt.includes(cleanSt) || cleanSt.includes(dSt);
      });

      const total = stDeliveries.length;
      const delivered = stDeliveries.filter((d) => d.status === 'entregue' || d.status === 'concluido').length;
      const insucesso = stDeliveries.filter((d) => d.status === 'insucesso').length;
      const pending = total - delivered - insucesso;
      const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;

      return {
        name: st,
        total,
        delivered,
        insucesso,
        pending,
        pct,
        isCompleted: delivered === total && total > 0,
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
      setShareFeedback('Abrindo WhatsApp com o resumo...');
    } else {
      setShareFeedback('Resumo copiado para a área de transferência!');
    }
    setTimeout(() => setShareFeedback(null), 3000);
  };

  const handleCopySummary = async () => {
    const ok = await copyTextToClipboard(summaryMessage);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-3.5 pt-3 pb-24 space-y-3.5">
      
      {/* 1. CABEÇALHO DO RESUMO GERAL */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white leading-tight">
                Resumo Geral das Rotas
              </h2>
              <p className="text-[11px] text-slate-400">
                {getFormattedCurrentDate(new Date())} • {getFormattedCurrentTime(new Date())}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black text-emerald-400 block leading-none">
              {percentage}%
            </span>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
              Concluído
            </span>
          </div>
        </div>

        {/* Barra de Progresso Geral */}
        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
          {insucessoCount > 0 && (
            <div
              className="bg-rose-500 h-full transition-all duration-500"
              style={{ width: `${(insucessoCount / totalPackages) * 100}%` }}
            />
          )}
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-4 gap-2 text-center pt-1">
          <div className="bg-slate-800/80 p-2 rounded-2xl border border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 block">Total</span>
            <span className="text-base font-black text-white">{totalPackages}</span>
          </div>
          <div className="bg-emerald-950/60 p-2 rounded-2xl border border-emerald-800/60">
            <span className="text-[10px] font-bold text-emerald-400 block">Entregues</span>
            <span className="text-base font-black text-emerald-300">{deliveredCount}</span>
          </div>
          <div className="bg-amber-950/60 p-2 rounded-2xl border border-amber-800/60">
            <span className="text-[10px] font-bold text-amber-400 block">Pendentes</span>
            <span className="text-base font-black text-amber-300">{pendingCount}</span>
          </div>
          <div className="bg-rose-950/60 p-2 rounded-2xl border border-rose-800/60">
            <span className="text-[10px] font-bold text-rose-400 block">Falhas</span>
            <span className="text-base font-black text-rose-300">{insucessoCount}</span>
          </div>
        </div>
      </div>

      {/* 2. BOTÃO DE ENVIO DO RESUMO NO WHATSAPP */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>Prestação de Contas / Relatório WhatsApp</span>
          </span>
          <button
            onClick={handleCopySummary}
            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>

        {shareFeedback && (
          <div className="p-2 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-center text-xs font-bold animate-pulse">
            {shareFeedback}
          </div>
        )}

        <button
          onClick={handleShareSummary}
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <Share2 className="w-4 h-4" />
          <span>📲 Enviar Resumo do Dia no WhatsApp</span>
        </button>
      </div>

      {/* 3. RELAÇÃO DE TODAS AS RUAS FEITAS & REGISTRADAS */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-slate-700" />
            <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">
              Ruas Registradas ({streetStats.length})
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-500">
            {streetStats.filter((s) => s.isCompleted).length} concluídas
          </span>
        </div>

        <div className="space-y-2">
          {streetStats.map((st, idx) => (
            <div
              key={`stat-st-${st.name}-${idx}`}
              onClick={() => onSelectStreet(st.name)}
              className="p-3 rounded-2xl border border-slate-200/90 hover:border-emerald-500/60 bg-slate-50 hover:bg-white transition-all cursor-pointer shadow-xs active:scale-[0.99] space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      st.isCompleted
                        ? 'bg-emerald-500'
                        : st.total === 0
                        ? 'bg-slate-300'
                        : 'bg-amber-500 animate-pulse'
                    }`}
                  />
                  <span className="font-black text-xs text-slate-900 truncate">
                    {st.name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                      st.isCompleted
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : st.total === 0
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {st.delivered}/{st.total} entregues
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>

              {/* Mini barra de progresso da rua */}
              {st.total > 0 && (
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full"
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

      {/* 4. AÇÃO DE LIMPEZA / NOVO DIA */}
      {deliveries.length > 0 && onClearAllDeliveries && (
        <div className="pt-2 text-center">
          <button
            onClick={onClearAllDeliveries}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black cursor-pointer transition-all inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Encerrar Rota e Iniciar Novo Dia</span>
          </button>
        </div>
      )}

    </div>
  );
};
