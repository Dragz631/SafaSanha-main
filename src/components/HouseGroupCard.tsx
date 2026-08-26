import React, { useState } from 'react';
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Share2,
  Copy,
  Check,
  MoreVertical,
  Edit3,
  Trash2,
  RotateCcw,
  Users,
  ChevronDown,
  ChevronUp,
  Building,
  Home
} from 'lucide-react';
import { DeliveryData } from '../types';
import {
  buildWhatsAppMessage,
  buildGroupedWhatsAppMessage,
  copyTextToClipboard,
  getFormattedCurrentTime
} from '../utils/whatsappHelper';

interface HouseGroupCardProps {
  houseNumber: string;
  deliveries: DeliveryData[];
  onOpenSingleDeliveryModal: (delivery: DeliveryData, mode?: 'entrega' | 'insucesso') => void;
  onOpenGroupDeliveryModal: (deliveries: DeliveryData[]) => void;
  onEditDelivery: (delivery: DeliveryData) => void;
  onDeleteDelivery: (id: string) => void;
  onUpdateDelivery: (delivery: DeliveryData) => void;
}

export const HouseGroupCard: React.FC<HouseGroupCardProps> = ({
  houseNumber,
  deliveries,
  onOpenSingleDeliveryModal,
  onOpenGroupDeliveryModal,
  onEditDelivery,
  onDeleteDelivery,
  onUpdateDelivery,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [copiedGroup, setCopiedGroup] = useState<boolean>(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const totalCount = deliveries.length;
  const deliveredList = deliveries.filter((d) => d.status === 'entregue' || d.status === 'concluido');
  const insucessoList = deliveries.filter((d) => d.status === 'insucesso');
  const pendingList = deliveries.filter(
    (d) => d.status !== 'entregue' && d.status !== 'concluido' && d.status !== 'insucesso'
  );

  const isAllDelivered = deliveredList.length === totalCount && totalCount > 0;
  const isAllInsucesso = insucessoList.length === totalCount && totalCount > 0;
  const hasMultiple = totalCount > 1;

  // Agrupamento de nomes de destinatários na mesma casa
  const clientNamesSummary = React.useMemo(() => {
    const counts: { [name: string]: number } = {};
    deliveries.forEach((d) => {
      const name = d.nome_destinatario || d.recebedor_detalhes || 'Morador';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [deliveries]);

  const handleQuickCopyGroup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = buildGroupedWhatsAppMessage(deliveries);
    const ok = await copyTextToClipboard(msg);
    if (ok) {
      setCopiedGroup(true);
      setTimeout(() => setCopiedGroup(false), 2000);
    }
  };

  const handleDeliverAllClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasMultiple) {
      onOpenGroupDeliveryModal(deliveries);
    } else if (deliveries.length === 1) {
      onOpenSingleDeliveryModal(deliveries[0], 'entrega');
    }
  };

  // CASO 1: Apenas 1 pacote nesta casa
  if (!hasMultiple && deliveries.length === 1) {
    const single = deliveries[0];
    const isDel = single.status === 'entregue' || single.status === 'concluido';
    const isIns = single.status === 'insucesso';
    const code = single.codigo_pacote.startsWith('#') ? single.codigo_pacote : `#${single.codigo_pacote}`;
    const name = single.nome_destinatario || 'Morador';
    const comp = single.complemento || single.endereco_complemento || '';

    return (
      <div
        onClick={() => onOpenSingleDeliveryModal(single, isIns ? 'insucesso' : 'entrega')}
        className={`rounded-2xl border transition-all duration-150 shadow-xs relative overflow-hidden cursor-pointer active:scale-[0.99] ${
          isDel
            ? 'bg-emerald-50/40 border-emerald-300/80'
            : isIns
            ? 'bg-rose-50/40 border-rose-300/80'
            : 'bg-white border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="p-3.5 pb-2.5 flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            {/* Bloco do Número */}
            <div
              className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 shadow-xs ${
                isDel
                  ? 'bg-emerald-600 text-white'
                  : isIns
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-900 text-white'
              }`}
            >
              <span className="text-[9px] uppercase tracking-tighter opacity-80 leading-none">Nº</span>
              <span className="text-lg leading-none mt-0.5">{houseNumber}</span>
            </div>

            <div className="min-w-0 truncate">
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-black text-sm text-slate-900 leading-tight truncate">
                  {name}
                </span>
                {comp && (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-md shrink-0">
                    {comp}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="text-[11px] font-mono font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded-md border border-blue-200">
                  {code}
                </span>

                {isDel ? (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Entregue ({single.recebedor_detalhes || 'Próprio Morador'})</span>
                  </span>
                ) : isIns ? (
                  <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded-md flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    <span>Insucesso: {single.motivo_insucesso || 'Ausente'}</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span>Pendente</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ações de Edição e Exclusão */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onEditDelivery(single)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              title="Editar"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDeleteDelivery(single.id_entrega)}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Botão de Zap Direto */}
        <div className="p-3 pt-1.5 flex items-center gap-1.5 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onOpenSingleDeliveryModal(single, isIns ? 'insucesso' : 'entrega')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] ${
              isDel
                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                : isIns
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{isDel ? 'Reenviar no Zap' : isIns ? '⚠️ Zap Insucesso' : '📲 Zap c/ Texto Pronto'}</span>
          </button>

          {!isDel && !isIns && (
            <button
              onClick={() => onOpenSingleDeliveryModal(single, 'insucesso')}
              className="py-2.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
              title="Registrar insucesso"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            </button>
          )}

          <button
            onClick={handleQuickCopyGroup}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 border cursor-pointer ${
              copiedGroup ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="Copiar texto"
          >
            {copiedGroup ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>
      </div>
    );
  }

  // CASO 2: MÚLTIPLOS PACOTES NO MESMO NÚMERO (CARD AGRUPADO DE PORTARIA / CASA)
  return (
    <div className={`rounded-2xl border-2 transition-all duration-200 shadow-sm overflow-hidden ${
      isAllDelivered
        ? 'bg-emerald-50/30 border-emerald-400'
        : isAllInsucesso
        ? 'bg-rose-50/30 border-rose-400'
        : 'bg-white border-slate-300'
    }`}>
      
      {/* CABEÇALHO DO CARD AGRUPADO DO NÚMERO */}
      <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          {/* Número em Grande Destaque */}
          <div className="w-13 h-13 rounded-2xl bg-amber-400 text-slate-950 flex flex-col items-center justify-center font-black shrink-0 shadow-md">
            <span className="text-[9px] uppercase tracking-tighter opacity-80 leading-none">Nº</span>
            <span className="text-xl leading-none mt-0.5">{houseNumber}</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                <Building className="w-3 h-3 text-amber-300" />
                <span>{totalCount} Pacotes Agregados</span>
              </span>

              {isAllDelivered ? (
                <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Todos Entregues</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-300">
                  {pendingList.length} pendente{pendingList.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Resumo de nomes de quem recebe */}
            <p className="text-xs font-bold text-slate-200 truncate mt-1">
              {clientNamesSummary.map((c, i) => (
                <span key={`${c.name}-${i}`}>
                  {i > 0 ? ' • ' : ''}
                  {c.name} {c.count > 1 ? `(${c.count}x)` : ''}
                </span>
              ))}
            </p>
          </div>
        </div>

        {/* Toggle para recolher/expandir lista */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer shrink-0 transition-colors"
          title={isExpanded ? 'Recolher detalhes' : 'Expandir pacotes'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* BOTÃO MASTER: ENTREGAR TODOS NA PORTARIA / MORADOR */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <button
          onClick={handleDeliverAllClick}
          className={`flex-1 py-3 px-3.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.98] ${
            isAllDelivered
              ? 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-emerald-700/20'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>
            {isAllDelivered
              ? '📲 Reenviar Zap da Portaria (Todos)'
              : `📲 Entregar Todos na Portaria (Zap Único • ${totalCount} pacotes)`}
          </span>
        </button>

        <button
          onClick={handleQuickCopyGroup}
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center cursor-pointer transition-all ${
            copiedGroup
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
          }`}
          title="Copiar texto consolidado de todos os pacotes"
        >
          {copiedGroup ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-slate-500" />}
        </button>
      </div>

      {/* LISTAGEM DOS PACOTES DESTE NÚMERO */}
      {isExpanded && (
        <div className="p-3 space-y-2 bg-white">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 uppercase tracking-wider px-1">
            <span>Pacotes Individuais do Nº {houseNumber}</span>
            <span>{totalCount} itens</span>
          </div>

          <div className="space-y-1.5">
            {deliveries.map((pkg, idx) => {
              const isPkgDel = pkg.status === 'entregue' || pkg.status === 'concluido';
              const isPkgIns = pkg.status === 'insucesso';
              const code = pkg.codigo_pacote.startsWith('#') ? pkg.codigo_pacote : `#${pkg.codigo_pacote}`;
              const name = pkg.nome_destinatario || pkg.recebedor_detalhes || 'Morador';
              const comp = pkg.complemento || pkg.endereco_complemento;

              return (
                <div
                  key={pkg.id_entrega}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                    isPkgDel
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : isPkgIns
                      ? 'bg-rose-50/60 border-rose-200'
                      : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    <div className="min-w-0 truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs text-slate-900 truncate">
                          {name}
                        </span>
                        {comp && (
                          <span className="text-[9px] font-bold text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                            {comp}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded">
                          {code}
                        </span>
                        {isPkgDel ? (
                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Entregue</span>
                          </span>
                        ) : isPkgIns ? (
                          <span className="text-[10px] font-bold text-rose-700 flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Insucesso</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>Pendente</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações Rápidas por Pacote */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onOpenSingleDeliveryModal(pkg, 'entrega')}
                      className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-[10px] font-black cursor-pointer"
                      title="Entregar individualmente"
                    >
                      {isPkgDel ? 'Zap' : 'Entregar'}
                    </button>
                    <button
                      onClick={() => onEditDelivery(pkg)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer"
                      title="Editar"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteDelivery(pkg.id_entrega)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
