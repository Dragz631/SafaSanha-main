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
  ShieldCheck
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
      className={`rounded-2xl border transition-all duration-200 shadow-xs relative overflow-hidden cursor-pointer active:scale-[0.99] ${
        isDelivered
          ? 'bg-emerald-50/40 border-emerald-300/80 shadow-emerald-500/5'
          : isInsucesso
          ? 'bg-rose-50/40 border-rose-300/80 shadow-rose-500/5'
          : 'bg-white border-slate-200/90 hover:border-slate-300'
      }`}
    >
      {/* Topo do Card: Número da Casa & Detalhes */}
      <div className="p-3.5 pb-2.5 flex items-start justify-between gap-2">
        {/* Número da Casa em Destaque Alto */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 shadow-xs ${
              isDelivered
                ? 'bg-emerald-600 text-white'
                : isInsucesso
                ? 'bg-rose-600 text-white'
                : 'bg-slate-900 text-white'
            }`}
          >
            <span className="text-[9px] uppercase tracking-tighter opacity-80 leading-none">Nº</span>
            <span className="text-lg leading-none mt-0.5">{houseNumber}</span>
          </div>

          <div className="min-w-0 truncate">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-extrabold text-sm text-slate-900 leading-tight truncate">
                {clientName}
              </span>
              {complement && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-md shrink-0">
                  {complement}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[11px] font-mono font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded-md border border-blue-200">
                {packageCode}
              </span>

              {isDelivered ? (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.2 rounded-md flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Entregue às {formattedTime} ({receiverDetails})</span>
                </span>
              ) : isInsucesso ? (
                <span className="text-[10px] font-bold text-rose-800 bg-rose-100/90 px-1.5 py-0.2 rounded-md flex items-center gap-1 shrink-0">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span>Insucesso: {delivery.motivo_insucesso || 'Ausente'}</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-md flex items-center gap-0.5 shrink-0">
                  <Clock className="w-3 h-3 text-amber-500" />
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
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-8 z-30 bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-44 text-xs font-bold text-slate-700">
                {(isDelivered || isInsucesso) && (
                  <button
                    onClick={handleUndoStatus}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-amber-700 cursor-pointer"
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
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-emerald-700 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Registrar Entrega</span>
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleOpenModal('insucesso');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-rose-600 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Registrar Insucesso</span>
                </button>

                <button
                  onClick={handleEditClick}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-t border-slate-100"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Editar Pacote</span>
                </button>

                <button
                  onClick={handleDeleteClick}
                  className="w-full px-3 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Botões de Ação na Parte Inferior do Card */}
      <div className="p-3 pt-1.5 flex items-center gap-1.5 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
        {/* Botão Principal do WhatsApp (Abre seleção de recebedor ou confirmação) */}
        <button
          onClick={() => handleOpenModal(isInsucesso ? 'insucesso' : 'entrega')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] ${
            isDelivered
              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
              : isInsucesso
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>
            {isDelivered
              ? 'Reenviar no Zap'
              : isInsucesso
              ? '⚠️ Zap Insucesso'
              : '📲 Zap c/ Texto Pronto'}
          </span>
        </button>

        {/* Botão Rápido de Insucesso (se estiver pendente) */}
        {!isDelivered && !isInsucesso && (
          <button
            onClick={() => handleOpenModal('insucesso')}
            className="py-2.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
            title="Registrar insucesso / morador ausente"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden xs:inline">Insucesso</span>
          </button>
        )}

        {/* Botão de Linha do Tempo / Antiacareação */}
        <button
          onClick={() => setIsTimelineOpen(true)}
          className="p-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
          title="Ver Linha Temporal / Prova Definitiva"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        </button>

        {/* Botão de Cópia Rápida */}
        <button
          onClick={handleQuickCopy}
          className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition-all cursor-pointer ${
            copied
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
          }`}
          title="Copiar texto pronto"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden xs:inline">Copiar</span>
            </>
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
