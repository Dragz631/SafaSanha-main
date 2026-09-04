import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  CheckCircle2,
  Share2,
  Copy,
  Check,
  Edit3,
  Trash2,
  MoreVertical,
  RotateCcw,
  AlertTriangle,
  Users,
  ChevronRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { DeliveryData } from '../types';
import {
  buildWhatsAppMessage,
  shareOrOpenWhatsApp,
  copyTextToClipboard,
  getFormattedCurrentTime,
  getFormattedCurrentDate
} from '../utils/whatsappHelper';
import { PackageTimelineModal } from './PackageTimelineModal';

interface PackageCardProps {
  delivery: DeliveryData;
  index?: number;
  onOpenDeliveryModal?: (delivery: DeliveryData, initialMode?: 'entrega' | 'insucesso') => void;
  onDeliverClick?: (delivery: DeliveryData) => void;
  onEdit?: (delivery: DeliveryData) => void;
  onEditClick?: (delivery: DeliveryData) => void;
  onDelete?: (id: string) => void;
  onDeleteClick?: (id: string) => void;
  onToggleStatus?: (delivery: DeliveryData) => void;
  onQuickStatusChange?: (delivery: DeliveryData, status: any) => void;
}

export const PackageCard: React.FC<PackageCardProps> = ({
  delivery,
  index = 0,
  onOpenDeliveryModal,
  onDeliverClick,
  onEdit,
  onEditClick,
  onDelete,
  onDeleteClick,
  onToggleStatus,
  onQuickStatusChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  const handleOpenModal = (mode: 'entrega' | 'insucesso' = 'entrega') => {
    if (onOpenDeliveryModal) {
      onOpenDeliveryModal(delivery, mode);
    } else if (onDeliverClick) {
      onDeliverClick(delivery);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(delivery);
    } else if (onEditClick) {
      onEditClick(delivery);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(delivery.id_entrega);
    } else if (onDeleteClick) {
      onDeleteClick(delivery.id_entrega);
    }
  };

  const isDelivered = delivery.status === 'entregue' || delivery.status === 'concluido';
  const isInsucesso = delivery.status === 'insucesso';
  const houseNumber = delivery.numero_casa || delivery.endereco_numero || 'S/N';
  const clientName = delivery.nome_destinatario || delivery.recebedor_detalhes || 'Cliente';
  const complement = delivery.complemento || delivery.endereco_complemento || '';
  const packageCode = delivery.codigo_pacote.startsWith('#')
    ? delivery.codigo_pacote
    : `#${delivery.codigo_pacote}`;
  const formattedTime = getFormattedCurrentTime(delivery.data_hora);
  const formattedDate = getFormattedCurrentDate(delivery.data_hora);
  const receiverDetails = delivery.recebedor_detalhes || 'Próprio Morador';

  const handleQuickCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = buildWhatsAppMessage(delivery);
    const ok = await copyTextToClipboard(msg);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUndoStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleStatus) {
      onToggleStatus({
        ...delivery,
        status: 'aguardando_rua',
        motivo_insucesso: undefined,
      });
    } else if (onQuickStatusChange) {
      onQuickStatusChange({ ...delivery, motivo_insucesso: undefined }, 'aguardando_rua');
    }
    setShowMenu(false);
  };

  return (
    <div
      onClick={() => handleOpenModal(isInsucesso ? 'insucesso' : 'entrega')}
      className={`rounded-2xl border transition-all duration-200 shadow-sm relative overflow-hidden cursor-pointer active:scale-[0.99] ${
        isDelivered
          ? 'bg-slate-900/90 border-emerald-500/40 shadow-emerald-500/5'
          : isInsucesso
          ? 'bg-slate-900/90 border-rose-500/40 shadow-rose-500/5'
          : 'bg-slate-900 border-slate-800 hover:border-slate-750'
      }`}
    >
      {/* Topo do Card: Número da Casa & Detalhes */}
      <div className="p-3.5 pb-2.5 flex items-start justify-between gap-3">
        {/* Número da Casa em Destaque Alto */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black shrink-0 shadow-xs border ${
              isDelivered
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : isInsucesso
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-950 text-white border-slate-700/80 font-mono'
            }`}
          >
            <span className="text-[8px] uppercase tracking-tighter opacity-70 leading-none">Nº</span>
            <span className="text-lg leading-none mt-0.5">{houseNumber}</span>
          </div>

          <div className="min-w-0 truncate">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-black text-sm text-slate-100 leading-snug truncate">
                {clientName}
              </span>
              {complement && (
                <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded-md shrink-0 border border-slate-700">
                  {complement}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[10px] font-mono font-bold text-sky-300 bg-sky-950/60 px-1.5 py-0.5 rounded-md border border-sky-800/50">
                {packageCode}
              </span>

              {isDelivered ? (
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-emerald-800/40">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Entregue às {formattedTime} ({receiverDetails})</span>
                </span>
              ) : isInsucesso ? (
                <span className="text-[10px] font-bold text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-rose-800/40">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span>Insucesso: {delivery.motivo_insucesso || 'Ausente'}</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-slate-700/60">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Pendente</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Menu de Opções Rápido */}
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-9 z-30 bg-slate-950 rounded-xl shadow-xl border border-slate-800 py-1 w-48 text-xs font-bold text-slate-200">
                {(isDelivered || isInsucesso) && (
                  <button
                    onClick={handleUndoStatus}
                    className="w-full px-3 py-2 text-left hover:bg-slate-900 flex items-center gap-2 text-amber-400 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Voltar para Pendente</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleOpenModal('entrega');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-900 flex items-center gap-2 text-emerald-400 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Registrar Entrega</span>
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleOpenModal('insucesso');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-900 flex items-center gap-2 text-rose-400 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Registrar Insucesso</span>
                </button>

                <button
                  onClick={handleEditClick}
                  className="w-full px-3 py-2 text-left hover:bg-slate-900 flex items-center gap-2 cursor-pointer border-t border-slate-800"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Editar Pacote</span>
                </button>

                <button
                  onClick={handleDeleteClick}
                  className="w-full px-3 py-2 text-left hover:bg-rose-950/40 text-rose-400 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Botões de Ação na Parte Inferior do Card (Altura 48px para polegar) */}
      <div className="p-3 pt-1.5 flex items-center gap-2 border-t border-slate-800/80" onClick={(e) => e.stopPropagation()}>
        {/* Botão Principal */}
        <button
          onClick={() => handleOpenModal(isInsucesso ? 'insucesso' : 'entrega')}
          className={`flex-1 h-12 px-3.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] touch-manipulation ${
            isDelivered
              ? 'bg-slate-800/90 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30'
              : isInsucesso
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md font-black'
          }`}
        >
          {isDelivered ? (
            <FileText className="w-4 h-4 text-emerald-400" />
          ) : isInsucesso ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          )}
          <span>
            {isDelivered
              ? '📄 Ver Registro / Copiar'
              : isInsucesso
              ? '⚠️ Insucesso'
              : '✓ Entregar Pacote (+2 🪙)'}
          </span>
        </button>

        {/* Botão Rápido de Insucesso (se estiver pendente) */}
        {!isDelivered && !isInsucesso && (
          <button
            onClick={() => handleOpenModal('insucesso')}
            className="h-12 w-12 bg-slate-800 hover:bg-rose-950/40 text-rose-400 border border-slate-700/80 rounded-xl flex items-center justify-center cursor-pointer transition-colors touch-manipulation shrink-0"
            title="Registrar insucesso / morador ausente"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
        )}

        {/* Botão de Linha do Tempo / Antiacareação */}
        <button
          onClick={() => setIsTimelineOpen(true)}
          className="h-12 w-11 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 flex items-center justify-center transition-all cursor-pointer touch-manipulation shrink-0"
          title="Ver Linha Temporal / Prova Definitiva"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </button>

        {/* Botão de Cópia Rápida */}
        <button
          onClick={handleQuickCopy}
          className={`h-12 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer touch-manipulation shrink-0 ${
            copied
              ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-black'
              : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
          }`}
          title="Copiar texto pronto"
        >
          {copied ? (
            <Check className="w-4 h-4 stroke-[3]" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Modal da Linha Temporal Antiacareação */}
      {isTimelineOpen && (
        <PackageTimelineModal
          isOpen={true}
          delivery={delivery}
          onClose={() => setIsTimelineOpen(false)}
        />
      )}
    </div>
  );
};
