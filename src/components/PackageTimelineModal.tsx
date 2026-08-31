import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Package,
  Calendar,
  ShieldCheck,
  Share2,
  Copy,
  Check,
  X,
  User,
  ArrowRight,
  Sparkles,
  Layers,
  History,
  RotateCcw
} from 'lucide-react';
import { DeliveryData, DeliveryTimelineEvent } from '../types';
import { ensurePackageTimeline, buildProofOfDeliveryText } from '../utils/historyHelper';
import { copyTextToClipboard, shareOrOpenWhatsApp } from '../utils/whatsappHelper';

interface PackageTimelineModalProps {
  isOpen: boolean;
  delivery: DeliveryData | null;
  onClose: () => void;
}

export const PackageTimelineModal: React.FC<PackageTimelineModalProps> = ({
  isOpen,
  delivery,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  if (!isOpen || !delivery) return null;

  const timeline = ensurePackageTimeline(delivery);
  const isDelivered = delivery.status === 'entregue' || delivery.status === 'concluido';

  const handleCopyProof = async () => {
    const text = buildProofOfDeliveryText(delivery);
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleShareProof = async () => {
    const text = buildProofOfDeliveryText(delivery);
    const res = await shareOrOpenWhatsApp(text);
    if (res.method === 'share') {
      setShareFeedback('Abrindo opções...');
    } else if (res.method === 'whatsapp') {
      setShareFeedback('Abrindo WhatsApp...');
    }
    setTimeout(() => setShareFeedback(null), 2500);
  };

  const getEventIcon = (tipo: DeliveryTimelineEvent['tipo']) => {
    switch (tipo) {
      case 'entrada_app':
        return <Package className="w-4 h-4 text-blue-600" />;
      case 'em_rota':
        return <MapPin className="w-4 h-4 text-amber-600" />;
      case 'tentativa_insucesso':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case 'reagendamento_dia_seguinte':
        return <RotateCcw className="w-4 h-4 text-purple-600" />;
      case 'entrega_concluida':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const getEventBadge = (tipo: DeliveryTimelineEvent['tipo']) => {
    switch (tipo) {
      case 'entrada_app':
        return 'bg-blue-100 text-blue-900 border-blue-200';
      case 'em_rota':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'tentativa_insucesso':
        return 'bg-rose-100 text-rose-900 border-rose-200';
      case 'reagendamento_dia_seguinte':
        return 'bg-purple-100 text-purple-900 border-purple-200';
      case 'entrega_concluida':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300 ring-2 ring-emerald-500/20';
      default:
        return 'bg-slate-100 text-slate-900 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] pb-safe">
        
        {/* TOPO COM IDENTIFICAÇÃO DO PACOTE & BANNER ANTIACAREAÇÃO */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-black text-sm sm:text-base text-white leading-tight">
                  Linha Temporal do Pacote
                </h2>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase">
                  Antiacareação
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate font-mono">
                {delivery.codigo_pacote} • {delivery.nome_destinatario || 'Morador'}
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

        {/* BANNER DE STATUS DEFINITIVO */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isDelivered ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-xs font-black text-slate-800">
              {isDelivered ? 'Entrega Concluída com Prova Gravada' : 'Pacote em Rota / Atendimento'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyProof}
              className={`py-1.5 px-2.5 rounded-xl border text-xs font-black flex items-center gap-1 cursor-pointer transition-all ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
              title="Copiar texto formal de prova de entrega"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copiado!' : 'Copiar Prova'}</span>
            </button>

            <button
              onClick={handleShareProof}
              className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              title="Compartilhar no WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>

        {shareFeedback && (
          <div className="bg-emerald-50 text-emerald-900 text-xs font-bold text-center py-1.5 border-b border-emerald-200">
            {shareFeedback}
          </div>
        )}

        {/* CORPO: LINHA DO TEMPO CRONOLÓGICA (DA ENTRADA ATÉ A ENTREGA) */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          
          {/* Card Resumo do Endereço */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              Localização Registrada:
            </span>
            <p className="text-xs font-black text-slate-900">
              {delivery.sub_rua_manilha
                ? `${delivery.sub_rua_manilha}, Nº ${delivery.numero_casa || 'S/N'}${delivery.complemento ? ` (${delivery.complemento})` : ''} • Setor Manilha (Caju)`
                : `${delivery.endereco_rua || 'Caju'}, Nº ${delivery.numero_casa || 'S/N'}${delivery.complemento ? ` (${delivery.complemento})` : ''}`}
            </p>
            {delivery.recebedor_detalhes && (
              <p className="text-[11px] text-slate-600 font-medium">
                Recebedor cadastrado: <strong>{delivery.recebedor_detalhes}</strong> ({
                  delivery.recebedor_tipo === 'proprio_morador' ? 'Próprio Morador' : delivery.recebedor_tipo === 'vizinho' ? 'Vizinho' : delivery.recebedor_tipo === 'associacao' ? 'Associação' : 'Comércio'
                })
              </p>
            )}
          </div>

          {/* Timeline de Eventos */}
          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {timeline.map((event, idx) => {
              const dateObj = new Date(event.timestamp);
              const dateFormatted = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : event.timestamp;

              return (
                <div key={event.id || idx} className="relative group">
                  {/* Ponto / Ícone na Linha */}
                  <div className="absolute -left-6 top-0.5 w-6 h-6 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center shadow-xs">
                    {getEventIcon(event.tipo)}
                  </div>

                  {/* Card do Evento */}
                  <div className={`p-3 rounded-2xl border transition-all ${getEventBadge(event.tipo)}`}>
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <h4 className="font-black text-xs leading-tight">
                        {event.titulo}
                      </h4>
                      <span className="text-[10px] font-bold opacity-80 font-mono">
                        {dateFormatted}
                      </span>
                    </div>

                    <p className="text-[11px] mt-1 leading-relaxed opacity-95">
                      {event.descricao}
                    </p>

                    {event.detalhes && (
                      <p className="text-[10px] font-medium mt-0.5 opacity-80 italic">
                        {event.detalhes}
                      </p>
                    )}

                    {event.foto_url && (
                      <div className="mt-2">
                        <img
                          src={event.foto_url}
                          alt="Comprovante"
                          className="w-24 h-24 object-cover rounded-xl border border-black/10 shadow-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* RODAPÉ DO MODAL COM AVISO LEGAL */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 text-center">
          <p className="text-[10px] text-slate-500 font-medium">
            🔒 Prova temporal auditável gerada pelo SafaSanha LogiScan para proteção contra careação.
          </p>
        </div>

      </div>
    </div>
  );
};
