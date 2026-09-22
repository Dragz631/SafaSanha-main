import React, { useState } from 'react';
import {
  MapPin,
  Package,
  CheckCircle2,
  Clock,
  Share2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Building,
  Navigation,
  Sparkles
} from 'lucide-react';
import { DeliveryData } from '../types';
import { NumeroCard } from './NumeroCard';
import { useMemoria } from '../state/MemoriaContext';
import { agruparRua, filtrarGrupos } from '../domain/agrupamento';
import { PackageCard } from './PackageCard';
import { ManilhaSubStreetDef } from '../data/cajuStreets';
import { buildGroupedWhatsAppMessage, copyTextToClipboard } from '../utils/whatsappHelper';

interface ManilhaSubStreetCardProps {
  subStreetDef: ManilhaSubStreetDef;
  deliveries: DeliveryData[];
  /** Todos os pacotes desta sub-rua (base da classificação; `deliveries` já vem filtrado pela busca). */
  todos?: DeliveryData[];
  viewMode: 'grouped' | 'individual';
  onOpenSingleDeliveryModal: (delivery: DeliveryData, mode?: 'entrega' | 'insucesso') => void;
  onOpenGroupDeliveryModal: (deliveries: DeliveryData[]) => void;
  onEditDelivery: (delivery: DeliveryData) => void;
  onDeleteDelivery: (id: string) => void;
  onUpdateDelivery: (delivery: DeliveryData) => void;
  onConfirmarDestino: (pacote: DeliveryData, destinoId: string) => void;
  onMudarStatus?: (delivery: DeliveryData, status: DeliveryData['status']) => DeliveryData;
}

export const ManilhaSubStreetCard: React.FC<ManilhaSubStreetCardProps> = ({
  subStreetDef,
  deliveries,
  todos,
  viewMode,
  onOpenSingleDeliveryModal,
  onOpenGroupDeliveryModal,
  onEditDelivery,
  onDeleteDelivery,
  onUpdateDelivery,
  onConfirmarDestino,
  onMudarStatus,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const totalCount = deliveries.length;
  const deliveredCount = deliveries.filter(
    (d) => d.status === 'entregue' || d.status === 'concluido'
  ).length;
  const insucessoCount = deliveries.filter((d) => d.status === 'insucesso').length;
  const pendingCount = totalCount - deliveredCount - insucessoCount;
  const isCompleted = deliveredCount === totalCount && totalCount > 0;
  const pct = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0;

  // Organização por número/destino desta sub-rua. Classificada sobre TODOS os pacotes da sub-rua;
  // a busca/filtro só escondem (nunca reclassificam).
  const { memoria } = useMemoria();
  const grupos = React.useMemo(() => {
    const visiveis = new Set(deliveries.map((d) => d.id_entrega));
    return filtrarGrupos(agruparRua(todos ?? deliveries, memoria), (p) => visiveis.has(p.id_entrega));
  }, [deliveries, todos, memoria]);

  // Lista dos nomes dos destinatários para exibição compacta
  const clientsSummary = React.useMemo(() => {
    const names = deliveries.map((d) => d.nome_destinatario || 'Morador');
    const unique = Array.from(new Set(names));
    return unique.slice(0, 4).join(', ') + (unique.length > 4 ? ` e +${unique.length - 4}` : '');
  }, [deliveries]);

  const handleCopySubStreetGroup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = buildGroupedWhatsAppMessage(deliveries);
    const ok = await copyTextToClipboard(msg);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeliverAllClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deliveries.length > 0) {
      onOpenGroupDeliveryModal(deliveries);
    }
  };

  return (
    <div
      className={`rounded-3xl border-2 transition-all duration-200 overflow-hidden shadow-sm space-y-0 ${
        isCompleted
          ? 'bg-emerald-50/40 border-emerald-400'
          : insucessoCount > 0
          ? 'bg-amber-50/20 border-amber-300'
          : 'bg-white border-amber-400/80 shadow-md shadow-amber-500/5'
      }`}
    >
      {/* CABEÇALHO DO CARD DA SUB-RUA NA MANILHA */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between gap-2.5 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Badge de Ícone da Sub-Rua */}
          <div
            className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 shadow-md ${
              subStreetDef.type === 'principal'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-blue-500 text-white'
            }`}
          >
            {subStreetDef.type === 'principal' ? (
              <Navigation className="w-5 h-5" />
            ) : (
              <span className="text-base font-black leading-none">
                {subStreetDef.name.replace(/rua\s*/i, '').toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-sm text-white leading-tight truncate">
                {subStreetDef.name}
              </h3>
              <span
                className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${
                  subStreetDef.type === 'principal'
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                    : 'bg-blue-400/20 text-blue-300 border-blue-400/40'
                }`}
              >
                {subStreetDef.shortLabel}
              </span>
              {isCompleted ? (
                <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>100% Entregue</span>
                </span>
              ) : (
                <span className="text-[10px] font-black text-amber-300">
                  {totalCount} pacote{totalCount > 1 ? 's' : ''} ({pendingCount} pendente{pendingCount === 1 ? '' : 's'})
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-300 truncate mt-0.5">
              {deliveries.length > 0 ? clientsSummary : subStreetDef.role}
            </p>
          </div>
        </div>

        {/* Toggle Expandir/Recolher */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* BARRA DE PROGRESSO & AÇÕES RÁPIDAS DA SUB-RUA */}
      <div className="p-2.5 bg-slate-50 border-b border-slate-200/90 flex items-center justify-between gap-2">
        {/* Barra de Progresso */}
        <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
          {insucessoCount > 0 && (
            <div
              className="bg-rose-500 h-full"
              style={{ width: `${(insucessoCount / totalCount) * 100}%` }}
            />
          )}
        </div>

        {/* Botão de Entregar Todos da Sub-Rua */}
        <button
          onClick={handleDeliverAllClick}
          className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-all"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Zap da {subStreetDef.name}</span>
        </button>

        <button
          onClick={handleCopySubStreetGroup}
          className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center cursor-pointer transition-all ${
            copied
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
          }`}
          title="Copiar texto consolidado desta rua da Manilha"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
        </button>
      </div>

      {/* CONTEÚDO EXPANDIDO (CARDS INTERNOS DE CASAS / PACOTES) */}
      {isExpanded && (
        <div className="p-3 space-y-2 bg-slate-50/40">
          {viewMode === 'grouped' ? (
            grupos.map((grupo) => (
              <NumeroCard
                key={`${subStreetDef.id}-${grupo.numeroChave}`}
                grupo={grupo}
                onOpenSingleDeliveryModal={onOpenSingleDeliveryModal}
                onOpenGroupDeliveryModal={onOpenGroupDeliveryModal}
                onEditDelivery={onEditDelivery}
                onDeleteDelivery={onDeleteDelivery}
                onConfirmarDestino={onConfirmarDestino}
              />
            ))
          ) : (
            deliveries.map((delivery, index) => (
              <PackageCard
                key={delivery.id_entrega}
                index={index}
                delivery={delivery}
                onDeliverClick={(del) => onOpenSingleDeliveryModal(del, 'entrega')}
                onOpenDeliveryModal={(del, mode) => onOpenSingleDeliveryModal(del, mode || 'entrega')}
                onEditClick={(del) => onEditDelivery(del)}
                onEdit={(del) => onEditDelivery(del)}
                onDeleteClick={(id) => onDeleteDelivery(id)}
                onDelete={(id) => onDeleteDelivery(id)}
                onQuickStatusChange={(del, status) => {
                  onUpdateDelivery(onMudarStatus ? onMudarStatus(del, status) : { ...del, status });
                }}
                onToggleStatus={(del) => {
                  const alvo = del.status === 'entregue' ? 'aguardando_rua' : 'entregue';
                  onUpdateDelivery(onMudarStatus ? onMudarStatus(del, alvo) : { ...del, status: alvo });
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
