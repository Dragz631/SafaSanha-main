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
  ShieldCheck,
  Trash2,
  Filter,
  Sparkles
} from 'lucide-react';
import { CompletedDayRecord, DeliveryData } from '../types';
import { loadCompletedHistory, saveCompletedHistory, buildProofOfDeliveryText } from '../utils/historyHelper';
import { copyTextToClipboard, shareOrOpenWhatsApp } from '../utils/whatsappHelper';
import { PackageTimelineModal } from './PackageTimelineModal';

interface DeliveryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeliveryHistoryModal: React.FC<DeliveryHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [historyList, setHistoryList] = useState<CompletedDayRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
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
        return code.includes(q) || client.includes(q) || street.includes(q);
      });
      return matchesDate || matchesPackages;
    });
  }, [historyList, searchQuery]);

  const handleCopyDaySummary = async (day: CompletedDayRecord) => {
    const lines = [
      `📅 *HISTÓRICO DE ENTREGAS CONCLUÍDAS - ${day.data_referencia}*`,
      `✅ *Total de Pacotes Entregues:* ${day.total_entregues}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ...day.entregas.map((d, i) => {
        const time = d.data_hora_entrega ? new Date(d.data_hora_entrega).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
        const addr = d.sub_rua_manilha ? `${d.sub_rua_manilha}, Nº ${d.numero_casa || 'S/N'}` : `${d.endereco_rua}, Nº ${d.numero_casa || 'S/N'}`;
        return `${i + 1}. [${d.codigo_pacote}] ${d.nome_destinatario || 'Morador'} - ${addr} (${time})`;
      }),
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🔒 _Registro permanente SafaSanha LogiScan._`,
    ];

    const ok = await copyTextToClipboard(lines.join('\n'));
    if (ok) {
      setCopiedDayId(day.id_dia);
      setTimeout(() => setCopiedDayId(null), 2000);
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
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] pb-safe">
        
        {/* TOPO DO MODAL DE HISTÓRICO */}
        <div className="bg-slate-900 text-white p-4 pb-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-black text-sm sm:text-base text-white leading-tight">
                  Histórico de Dias Concluídos
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black px-1.5 py-0.2 rounded-md border border-emerald-500/30">
                  Prova Definitiva
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Arquivo permanente com data, hora exata e linha do tempo de entrega
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

        {/* BUSCA RÁPIDA NO HISTÓRICO */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por pacote, data (ex: 2026-08), morador ou rua..."
              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-xs font-bold"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {historyList.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Limpar Histórico"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* LISTA DE DIAS ARQUIVADOS */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 bg-slate-50/50">
          {filteredHistory.length > 0 ? (
            filteredHistory.map((day) => {
              const isExpanded = expandedDayId === day.id_dia;
              const dateFormatted = new Date(day.data_fechamento).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });

              return (
                <div
                  key={day.id_dia}
                  className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-xs space-y-0"
                >
                  {/* CABEÇALHO DO DIA */}
                  <div
                    onClick={() => setExpandedDayId(isExpanded ? null : day.id_dia)}
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
                          Fechado às {new Date(day.data_fechamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
                        title="Copiar Resumo do Dia"
                      >
                        {copiedDayId === day.id_dia ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <div className="p-1 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* RESUMO POR RUAS DO DIA */}
                  <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <span className="text-[10px] font-black text-slate-400 shrink-0 uppercase tracking-wider">
                      Ruas:
                    </span>
                    {day.resumo_ruas.map((r, i) => (
                      <span
                        key={i}
                        className="bg-white border border-slate-200 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 shadow-xs"
                      >
                        {r.nome_rua}: <strong>{r.qtd_entregues}</strong>
                      </span>
                    ))}
                  </div>

                  {/* LISTA DE PACOTES ENTREGUES NO DIA */}
                  {isExpanded && (
                    <div className="p-3 space-y-2 bg-slate-50/50">
                      {day.entregas.map((del, idx) => {
                        const timeStr = del.data_hora_entrega
                          ? new Date(del.data_hora_entrega).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                          : 'Horário Gravado';

                        return (
                          <div
                            key={del.id_entrega || idx}
                            className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                  {del.codigo_pacote}
                                </span>
                                <span className="text-xs font-bold text-slate-800 truncate">
                                  {del.nome_destinatario || 'Morador'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium mt-1">
                                <span className="truncate">
                                  {del.sub_rua_manilha
                                    ? `${del.sub_rua_manilha}, Nº ${del.numero_casa || 'S/N'}`
                                    : `${del.endereco_rua || 'Caju'}, Nº ${del.numero_casa || 'S/N'}`}
                                </span>
                                <span>•</span>
                                <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{timeStr}</span>
                                </span>
                              </div>
                            </div>

                            {/* Botão de Ver Linha do Tempo / Prova */}
                            <button
                              onClick={() => setSelectedForTimeline(del)}
                              className="py-1.5 px-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] rounded-xl shadow-xs flex items-center gap-1 cursor-pointer shrink-0 active:scale-95 transition-all"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Ver Prova</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-3xl p-8 border-2 border-dashed border-slate-200 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <History className="w-6 h-6" />
              </div>
              <h3 className="font-black text-slate-900 text-sm">
                Nenhum dia concluído no histórico ainda
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Quando você terminar suas entregas do dia, clique em <strong>"Encerrar Dia"</strong> na aba de Resumo para salvar as provas de entrega permanentemente.
              </p>
            </div>
          )}
        </div>

        {/* MODAL SECUNDÁRIO DE TIMELINE PARA O PACOTE SELECIONADO */}
        {selectedForTimeline && (
          <PackageTimelineModal
            isOpen={true}
            delivery={selectedForTimeline}
            onClose={() => setSelectedForTimeline(null)}
          />
        )}

      </div>
    </div>
  );
};
