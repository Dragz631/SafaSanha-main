import React, { useState, useMemo, useEffect } from 'react';
import {
  History,
  Calendar,
  Search,
  CheckCircle2,
  Package,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  Share2,
  Copy,
  Check,
  X,
  Trash2,
  Layers,
  ArrowRight,
  AlertTriangle,
  Building,
  Home,
} from 'lucide-react';
import { CompletedDayRecord, DeliveryData } from '../types';
import { loadCompletedHistory, saveCompletedHistory } from '../utils/historyHelper';
import { copyTextToClipboard } from '../utils/whatsappHelper';
import { getStreetInfo } from '../data/cajuStreets';
import { PackageTimelineModal } from './PackageTimelineModal';

interface DeliveryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HistoryStreetGroup {
  streetKey: string;
  streetName: string;
  sector: string;
  badgeColor: string;
  total: number;
  delivered: number;
  failed: number;
  deliveries: DeliveryData[];
}

export const DeliveryHistoryModal: React.FC<DeliveryHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [historyList, setHistoryList] = useState<CompletedDayRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  const [expandedStreetKeys, setExpandedStreetKeys] = useState<Record<string, boolean>>({});
  const [selectedForTimeline, setSelectedForTimeline] = useState<DeliveryData | null>(null);
  const [copiedDayId, setCopiedDayId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const records = loadCompletedHistory();
      setHistoryList(records);
      if (records.length > 0 && !expandedDayId) {
        setExpandedDayId(records[0].id_dia);
      }
    }
  }, [isOpen]);

  const toggleStreetExpansion = (streetKey: string) => {
    setExpandedStreetKeys((prev) => ({
      ...prev,
      [streetKey]: !prev[streetKey],
    }));
  };

  // Filtra dias e pacotes pela busca
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return historyList;
    const q = searchQuery.toLowerCase().trim();

    return historyList.filter((day) => {
      const matchesDate = day.data_referencia.includes(q);
      const matchesPackages = day.entregas.some((d) => {
        const code = d.codigo_pacote.toLowerCase();
        const client = (d.nome_destinatario || '').toLowerCase();
        const street = (d.endereco_rua || d.sub_rua_manilha || '').toLowerCase();
        const num = (d.numero_casa || '').toLowerCase();
        return code.includes(q) || client.includes(q) || street.includes(q) || num.includes(q);
      });
      return matchesDate || matchesPackages;
    });
  }, [historyList, searchQuery]);

  // Agrupa os pacotes de um dia por rua (estilo "Ruas Atendidas Hoje")
  const getStreetGroupsForDay = (day: CompletedDayRecord): HistoryStreetGroup[] => {
    const streetMap = new Map<string, DeliveryData[]>();

    day.entregas.forEach((del) => {
      let key = del.endereco_rua || 'Outra Rua';
      if (del.sub_rua_manilha) {
        key = `Manilha – ${del.sub_rua_manilha}`;
      }
      if (!streetMap.has(key)) {
        streetMap.set(key, []);
      }
      streetMap.get(key)!.push(del);
    });

    const result: HistoryStreetGroup[] = [];
    streetMap.forEach((items, streetName) => {
      const info = getStreetInfo(streetName.replace('Manilha – ', ''));
      const delivered = items.filter((d) => d.status === 'entregue' || d.status === 'concluido').length;
      const failed = items.filter((d) => d.status === 'insucesso').length;

      result.push({
        streetKey: `${day.id_dia}_${streetName}`,
        streetName,
        sector: info.sector,
        badgeColor: info.badgeColor,
        total: items.length,
        delivered,
        failed,
        deliveries: items,
      });
    });

    return result.sort((a, b) => a.streetName.localeCompare(b.streetName));
  };

  const handleCopyDaySummary = async (day: CompletedDayRecord) => {
    const streetGroups = getStreetGroupsForDay(day);
    const lines = [
      `📦 *HISTÓRICO DE ENTREGAS CONCLUÍDAS - ${day.data_referencia}*`,
      `✅ *Total de Pacotes Entregues:* ${day.total_entregues}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ...streetGroups.map((st) => {
        const header = `📍 *${st.streetName}* (${st.delivered}/${st.total} entregues)`;
        const items = st.deliveries
          .map((d) => {
            const time = d.data_hora_entrega
              ? new Date(d.data_hora_entrega).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : '';
            const num = `Nº ${d.numero_casa || 'S/N'}${d.complemento ? ` (${d.complemento})` : ''}`;
            const client = d.nome_destinatario || 'Morador';
            const rec = d.recebedor_detalhes ? ` • Rec: ${d.recebedor_detalhes}` : '';
            const status = d.status === 'entregue' || d.status === 'concluido' ? '✅' : '❌';
            return `  ${status} ${d.codigo_pacote} - ${num} (${client})${rec} [${time}]`;
          })
          .join('\n');
        return `${header}\n${items}`;
      }),
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `_SafaSanha • Sistema de Gestão de Entregas_`,
    ];

    const fullText = lines.join('\n');
    const success = await copyTextToClipboard(fullText);
    if (success) {
      setCopiedDayId(day.id_dia);
      setTimeout(() => setCopiedDayId(null), 2500);
    }
  };

  const handleClearHistory = () => {
    if (confirm('Tem certeza que deseja apagar o histórico permanente de entregas?')) {
      saveCompletedHistory([]);
      setHistoryList([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] pb-safe">
        {/* TOPO DO MODAL DE HISTÓRICO */}
        <div className="bg-slate-900 text-white p-4 pb-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-sm sm:text-base text-white leading-tight">
                  Histórico de Dias Concluídos
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black px-1.5 py-0.2 rounded-md border border-emerald-500/30">
                  {historyList.length} dias
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Organizado por ruas com o resumo de cada pacote
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BUSCA RÁPIDA NO HISTÓRICO */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por data (YYYY-MM-DD), rua, pacote ou morador..."
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-bold"
            />
          </div>

          {historyList.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer shrink-0"
              title="Limpar Histórico Permanente"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* LISTA DE DIAS ARQUIVADOS */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/40">
          {filteredHistory.length > 0 ? (
            filteredHistory.map((day) => {
              const isDayExpanded = expandedDayId === day.id_dia;
              const streetGroups = getStreetGroupsForDay(day);
              const dateFormatted = new Date(day.data_fechamento).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });

              return (
                <div
                  key={day.id_dia}
                  className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs space-y-0"
                >
                  {/* CABEÇALHO DO DIA */}
                  <div
                    onClick={() => setExpandedDayId(isDayExpanded ? null : day.id_dia)}
                    className="p-3.5 bg-slate-900 text-white flex items-center justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-xs sm:text-sm text-white capitalize truncate">
                            {dateFormatted}
                          </h3>
                          <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md">
                            {day.total_entregues} entregues
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Fechado às {new Date(day.data_fechamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {streetGroups.length} ruas atendidas
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyDaySummary(day);
                        }}
                        className={`p-1.5 rounded-lg border text-xs font-bold flex items-center justify-center cursor-pointer transition-all ${
                          copiedDayId === day.id_dia
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                        title="Copiar Relatório Completo do Dia"
                      >
                        {copiedDayId === day.id_dia ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <div className="p-1 text-slate-400">
                        {isDayExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* CARDS DAS RUAS ATENDIDAS NESTE DIA (ESTILO RUAS ATENDIDAS HOJE) */}
                  {isDayExpanded && (
                    <div className="p-3 space-y-2 bg-slate-50/70 dark:bg-slate-950/60">
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>Ruas Atendidas no Dia ({streetGroups.length})</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          Clique na rua para ver os pacotes
                        </span>
                      </div>

                      {streetGroups.map((st) => {
                        const isStreetExpanded = !!expandedStreetKeys[st.streetKey];

                        return (
                          <div
                            key={st.streetKey}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs space-y-0 transition-all"
                          >
                            {/* LINHA PRINCIPAL DO CARD DA RUA */}
                            <div
                              onClick={() => toggleStreetExpansion(st.streetKey)}
                              className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between gap-2 cursor-pointer select-none transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    st.failed === 0
                                      ? 'bg-emerald-500'
                                      : 'bg-amber-500'
                                  }`}
                                />
                                <div className="min-w-0">
                                  <span className="font-black text-xs text-slate-900 dark:text-slate-100 truncate block">
                                    {st.streetName}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-bold block truncate">
                                    {st.sector}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                    st.failed === 0
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                      : 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                  }`}
                                >
                                  {st.delivered}/{st.total} entregues
                                </span>
                                <div className="text-slate-400">
                                  {isStreetExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* DETALHAMENTO EXPANDIDO DA RUA */}
                            {isStreetExpanded && (
                              <div className="p-3 pt-2 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                                {/* Resumo Geral da Rua */}
                                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
                                  <span className="text-slate-700 dark:text-slate-300">
                                    Total: <b>{st.total} pacotes</b> ({st.delivered} entregues{st.failed > 0 ? `, ${st.failed} com falha` : ''})
                                  </span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-black">
                                    {Math.round((st.delivered / st.total) * 100)}% sucesso
                                  </span>
                                </div>

                                {/* LISTA DETALHADA DE PACOTES DESTA RUA COM RESUMO GERAL */}
                                <div className="space-y-1.5">
                                  {st.deliveries.map((del, idx) => {
                                    const timeStr = del.data_hora_entrega
                                      ? new Date(del.data_hora_entrega).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                      : 'Horário Gravado';
                                    const isDel = del.status === 'entregue' || del.status === 'concluido';

                                    return (
                                      <div
                                        key={del.id_entrega || idx}
                                        onClick={() => setSelectedForTimeline(del)}
                                        className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 hover:border-emerald-500/50 cursor-pointer transition-all shadow-xs"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                                              {del.codigo_pacote}
                                            </span>
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                              Nº {del.numero_casa || del.endereco_numero || 'S/N'}
                                              {del.complemento ? ` (${del.complemento})` : ''}
                                            </span>
                                            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                              • {del.nome_destinatario || 'Morador'}
                                            </span>
                                          </div>

                                          {/* O que aconteceu com o pacote */}
                                          <div className="flex items-center gap-2 mt-1 text-[11px]">
                                            {isDel ? (
                                              <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>Entregue às {timeStr}</span>
                                                {del.recebedor_detalhes && (
                                                  <span className="text-slate-500 font-normal">
                                                    (Rec: {del.recebedor_detalhes})
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                                                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                                <span>
                                                  Insucesso: {del.motivo_insucesso || del.recebedor_detalhes || 'Ausente'}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <span className="text-[10px] text-slate-400 hover:text-emerald-500 font-bold flex items-center gap-0.5">
                                            Ver timeline <ArrowRight className="w-3 h-3" />
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
              <History className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-black text-slate-700 dark:text-slate-300 text-sm">
                Nenhum dia concluído no histórico ainda
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Quando você finalizar as entregas e clicar em "Encerrar Dia", o histórico ficará gravado aqui permanentemente organizado por ruas.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Linha do Tempo e Provas do Pacote */}
      {selectedForTimeline && (
        <PackageTimelineModal
          isOpen={true}
          delivery={selectedForTimeline}
          onClose={() => setSelectedForTimeline(null)}
        />
      )}
    </div>
  );
};
