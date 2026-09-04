import React, { useState } from 'react';
import {
  X,
  Calendar,
  Package,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Share2,
  Copy,
  Check,
  Building,
  Truck,
  History,
} from 'lucide-react';
import { UserProfile, DayHistoryRecord } from '../types';
import {
  getDayHistories,
  openWhatsApp,
  copyToClipboard,
} from '../lib/userStorage';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  whatsappPhone?: string;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  user,
  whatsappPhone,
}) => {
  if (!isOpen) return null;

  const histories = getDayHistories(user.id);
  const [expandedId, setExpandedId] = useState<string | null>(
    histories.length > 0 ? histories[0].id : null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSendZap = (text: string) => {
    openWhatsApp(text, whatsappPhone);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-400/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg">Histórico de Fechamentos</h3>
              <p className="text-xs text-slate-300">
                Rotas e prestação de contas salvas de {user.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 text-xs">
          {histories.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <History className="w-7 h-7" />
              </div>
              <h4 className="font-black text-slate-800 text-sm">Nenhum histórico finalizado ainda</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Quando você concluir as entregas do dia e apertar em <strong>Finalizar Dia</strong>, o histórico com todas as ruas, entregas e insucessos ficará salvo aqui!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {histories.map((record) => {
                const isExpanded = expandedId === record.id;
                const dateFinished = new Date(record.finishedAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={record.id}
                    className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-xs transition-all"
                  >
                    {/* Record Card Header */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : record.id)}
                      className="p-4 bg-slate-50 hover:bg-slate-100/80 cursor-pointer flex items-center justify-between gap-3 select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex flex-col items-center justify-center font-black shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-black text-slate-900">
                              {record.date}
                            </strong>
                            <span className="text-[11px] font-bold text-slate-500">
                              às {dateFinished}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                              {record.deliveredCount} entregues
                            </span>
                            {record.failedCount > 0 && (
                              <span className="text-[11px] font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                                {record.failedCount} falhas
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="p-4 space-y-4 border-t border-slate-200 bg-white animate-fadeIn">
                        {/* Streets Breakdown */}
                        <div>
                          <span className="text-[11px] font-black uppercase text-slate-500 block mb-1.5">
                            Ruas Atendidas:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {record.streetsSummary.map((st) => (
                              <div
                                key={st.streetName}
                                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                              >
                                <span className="font-black text-slate-900 truncate">
                                  {st.streetName}
                                </span>
                                <span className="text-xs font-bold text-slate-600">
                                  {st.delivered}/{st.total}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Failed Packages Details & Destination */}
                        {record.failedPackages.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-black uppercase text-red-700 block">
                              Insucessos & Destinos ({record.failedPackages.length}):
                            </span>
                            <div className="space-y-1">
                              {record.failedPackages.map((pkg) => (
                                <div
                                  key={pkg.id}
                                  className="p-2.5 rounded-xl bg-red-50/70 border border-red-200 flex flex-wrap items-center justify-between gap-2"
                                >
                                  <div>
                                    <strong className="text-xs font-black text-slate-900">
                                      Nº {pkg.houseNumber} {pkg.complement ? `(${pkg.complement})` : ''} • {pkg.streetName}
                                    </strong>
                                    <div className="text-[11px] text-slate-600">
                                      {pkg.recipientName || 'Morador'} — <span className="text-red-700 font-bold">{pkg.failureReason || 'Ausente'}</span>
                                    </div>
                                  </div>

                                  <div>
                                    {pkg.failedResolution === 'reroute' ? (
                                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                        <Truck className="w-3 h-3" />
                                        Manter em Rota
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                                        <Building className="w-3 h-3" />
                                        Devolver Galpão
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Summary Message & Actions */}
                        <div className="space-y-2 pt-1 border-t border-slate-100">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
                            <span>Resumo Formatado:</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopy(record.id, record.summaryMessage)}
                                className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-bold cursor-pointer"
                              >
                                {copiedId === record.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                <span>{copiedId === record.id ? 'Copiado!' : 'Copiar'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSendZap(record.summaryMessage)}
                                className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-bold cursor-pointer"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>Reenviar Zap</span>
                              </button>
                            </div>
                          </div>

                          <pre className="p-3 rounded-xl bg-slate-900 text-emerald-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all border border-slate-800 shadow-inner max-h-40 overflow-y-auto">
                            {record.summaryMessage}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
