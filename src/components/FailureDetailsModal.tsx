import React, { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  MapPin,
  Clock,
  RotateCcw,
  Share2,
  Copy,
  Check,
  Search,
  ArrowRight,
  Package,
  User,
  CheckCircle2,
  PhoneCall,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { DeliveryData } from '../types';
import {
  buildInsucessoWhatsAppMessage,
  shareOrOpenWhatsApp,
  copyTextToClipboard,
  getFormattedCurrentTime,
  getFormattedCurrentDate
} from '../utils/whatsappHelper';
import { PackageTimelineModal } from './PackageTimelineModal';

interface FailureDetailsModalProps {
  isOpen: boolean;
  deliveries: DeliveryData[];
  onClose: () => void;
  onSelectStreet?: (street: string) => void;
  onReopenDelivery?: (delivery: DeliveryData) => void;
  onEditDelivery?: (delivery: DeliveryData) => void;
}

export const FailureDetailsModal: React.FC<FailureDetailsModalProps> = ({
  isOpen,
  deliveries,
  onClose,
  onSelectStreet,
  onReopenDelivery,
  onEditDelivery,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [selectedTimelineDelivery, setSelectedTimelineDelivery] = useState<DeliveryData | null>(null);

  // Filtra apenas pacotes com status de insucesso
  const failedDeliveries = useMemo(() => {
    return deliveries.filter((d) => d.status === 'insucesso');
  }, [deliveries]);

  // Filtro de busca
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return failedDeliveries;
    const q = searchQuery.toLowerCase().trim();
    return failedDeliveries.filter((d) => {
      const client = (d.nome_destinatario || d.recebedor_detalhes || '').toLowerCase();
      const street = (d.endereco_rua || d.endereco_completo || '').toLowerCase();
      const num = (d.numero_casa || d.endereco_numero || '').toLowerCase();
      const code = (d.codigo_pacote || '').toLowerCase();
      const reason = (d.motivo_insucesso || '').toLowerCase();
      return (
        client.includes(q) ||
        street.includes(q) ||
        num.includes(q) ||
        code.includes(q) ||
        reason.includes(q)
      );
    });
  }, [failedDeliveries, searchQuery]);

  // Mensagem consolidada de todas as falhas para envio aos supervisores / WhatsApp
  const consolidatedMessage = useMemo(() => {
    if (failedDeliveries.length === 0) return '';
    const dateStr = getFormattedCurrentDate(new Date());
    const timeStr = getFormattedCurrentTime(new Date());

    let msg = `⚠️ *RELATÓRIO DE INSUCESSOS / FALHAS* ⚠️\n`;
    msg += `📅 *Data:* ${dateStr} • ${timeStr}\n`;
    msg += `📦 *Total de Falhas:* ${failedDeliveries.length} pacote(s)\n`;
    msg += `─────────────────────────\n\n`;

    failedDeliveries.forEach((d, idx) => {
      const code = d.codigo_pacote.startsWith('#') ? d.codigo_pacote : `#${d.codigo_pacote}`;
      const street = d.endereco_rua || d.endereco_completo?.split(',')[0]?.trim() || 'Rua não informada';
      const num = d.numero_casa || d.endereco_numero || 'S/N';
      const client = d.nome_destinatario || 'Morador';
      const reason = d.motivo_insucesso || 'Motivo não informado';
      const time = getFormattedCurrentTime(d.data_hora);

      msg += `*${idx + 1}. Pacote:* ${code}\n`;
      msg += `📍 *Endereço:* ${street}, Nº ${num}\n`;
      msg += `👤 *Destinatário:* ${client}\n`;
      msg += `❌ *Motivo da Falha:* ${reason}\n`;
      msg += `⏰ *Horário:* ${time}\n\n`;
    });

    msg += `─────────────────────────\n`;
    msg += `_LogiScan • Prestação de Contas_`;
    return msg;
  }, [failedDeliveries]);

  const handleShareConsolidated = async () => {
    const res = await shareOrOpenWhatsApp(consolidatedMessage);
    if (res.method === 'share') {
      setShareFeedback('Abrindo WhatsApp...');
    } else if (res.method === 'whatsapp') {
      setShareFeedback('Abrindo WhatsApp com o relatório...');
    } else {
      setShareFeedback('Relatório copiado para a área de transferência!');
    }
    setTimeout(() => setShareFeedback(null), 3000);
  };

  const handleCopyConsolidated = async () => {
    const ok = await copyTextToClipboard(consolidatedMessage);
    if (ok) {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const handleCopySingleItem = async (d: DeliveryData) => {
    const singleMsg = buildInsucessoWhatsAppMessage(d, d.motivo_insucesso || 'Insucesso na entrega');
    const ok = await copyTextToClipboard(singleMsg);
    if (ok) {
      setCopiedItemId(d.id_entrega);
      setTimeout(() => setCopiedItemId(null), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] pb-safe">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-black shadow-md shadow-rose-500/30 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-sm sm:text-base text-white leading-tight">
                  Pacotes com Falha / Insucesso
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {failedDeliveries.length} falha{failedDeliveries.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Lista detalhada com motivo e endereço de cada insucesso
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

        {/* FEEDBACK DE COMPARTILHAMENTO */}
        {shareFeedback && (
          <div className="bg-rose-50 border-b border-rose-200 p-2 text-center text-xs font-bold text-rose-800 animate-fadeIn">
            {shareFeedback}
          </div>
        )}

        {/* BARRA DE AÇÕES & BUSCA */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5">
          {/* Botões de Ação Consolidada */}
          {failedDeliveries.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleShareConsolidated}
                className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>📲 Enviar Lista de Falhas no WhatsApp</span>
              </button>

              <button
                onClick={handleCopyConsolidated}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                  copiedSummary
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
                title="Copiar relatório consolidado"
              >
                {copiedSummary ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-slate-500" />}
                <span className="hidden sm:inline">{copiedSummary ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          )}

          {/* Campo de Busca Rápida */}
          {failedDeliveries.length > 1 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por cliente, rua, número ou motivo da falha..."
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
              />
            </div>
          )}
        </div>

        {/* LISTA DOS PACOTES COM FALHA */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 bg-slate-100/50">
          {filteredList.length > 0 ? (
            filteredList.map((d, idx) => {
              const code = d.codigo_pacote.startsWith('#') ? d.codigo_pacote : `#${d.codigo_pacote}`;
              const street = d.endereco_rua || d.endereco_completo?.split(',')[0]?.trim() || 'Rua Principal';
              const num = d.numero_casa || d.endereco_numero || 'S/N';
              const comp = d.complemento || d.endereco_complemento || '';
              const client = d.nome_destinatario || d.recebedor_detalhes || 'Morador';
              const reason = d.motivo_insucesso || 'Morador ausente / Não localizado';
              const time = getFormattedCurrentTime(d.data_hora);
              const date = getFormattedCurrentDate(d.data_hora);
              const isCopied = copiedItemId === d.id_entrega;

              return (
                <div
                  key={d.id_entrega || idx}
                  className="bg-white rounded-2xl border-2 border-rose-200 p-3.5 shadow-sm space-y-3 transition-all hover:border-rose-300"
                >
                  {/* Linha Superior: Código + Número + Horário */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex flex-col items-center justify-center font-black shrink-0">
                        <span className="text-[8px] uppercase tracking-tighter opacity-80 leading-none">Nº</span>
                        <span className="text-base leading-none mt-0.5">{num}</span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-xs text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100">
                            {code}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {time}
                          </span>
                        </div>
                        <h4 className="font-black text-xs text-slate-900 truncate mt-0.5">
                          {street}{comp ? ` • ${comp}` : ''}
                        </h4>
                      </div>
                    </div>

                    <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 border border-rose-200">
                      <ShieldAlert className="w-3 h-3 text-rose-600" />
                      Insucesso
                    </span>
                  </div>

                  {/* Destinatário */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-bold text-slate-900 truncate">
                      Destinatário: <span className="font-medium text-slate-700">{client}</span>
                    </span>
                  </div>

                  {/* MOTIVO DETALHADO DA FALHA (DESTAQUE MÁXIMO) */}
                  <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      Motivo Registrado da Falha:
                    </span>
                    <p className="text-xs font-black text-rose-950 leading-snug">
                      "{reason}"
                    </p>
                  </div>

                  {/* AÇÕES INDIVIDUAIS: REABRIR, COPIAR, IR PARA A RUA */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {onReopenDelivery && (
                      <button
                        onClick={() => {
                          onReopenDelivery({
                            ...d,
                            status: 'aguardando_rua',
                            motivo_insucesso: undefined,
                          });
                        }}
                        className="flex-1 py-2 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                        <span>Reabrir / Tentar</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleCopySingleItem(d)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                        isCopied
                          ? 'bg-rose-700 text-white border-rose-700'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                      title="Copiar mensagem individual de insucesso"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      <span className="text-[11px]">{isCopied ? 'Copiado!' : 'Copiar Zap'}</span>
                    </button>

                    {/* Botão de Ver Linha Temporal */}
                    <button
                      onClick={() => setSelectedTimelineDelivery(d)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center justify-center cursor-pointer transition-all shrink-0"
                      title="Ver Linha Temporal / Rastro do Pacote"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                    </button>

                    {onSelectStreet && (
                      <button
                        onClick={() => {
                          onSelectStreet(street);
                          onClose();
                        }}
                        className="py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black flex items-center justify-center gap-1 cursor-pointer transition-all"
                        title="Ir para a rua do pacote"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[11px]">Ir à Rua</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-800">
                  {searchQuery ? 'Nenhuma falha corresponde à sua busca' : 'Nenhuma falha registrada!'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  {searchQuery
                    ? `Nenhum resultado com o termo "${searchQuery}".`
                    : 'Excelente! Todos os pacotes do dia foram entregues com sucesso ou estão em rota.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500">
            {failedDeliveries.length} pacote(s) com insucesso
          </span>
          <button
            onClick={onClose}
            className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>

      {/* Modal Secundário de Linha do Tempo */}
      {selectedTimelineDelivery && (
        <PackageTimelineModal
          isOpen={true}
          delivery={selectedTimelineDelivery}
          onClose={() => setSelectedTimelineDelivery(null)}
        />
      )}
    </div>
  );
};
