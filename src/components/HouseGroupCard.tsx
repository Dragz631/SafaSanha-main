import React, { useState, useMemo } from 'react';
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Share2,
  Copy,
  Check,
  Edit3,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Building,
  Home,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { DeliveryData } from '../types';
import {
  buildWhatsAppMessage,
  buildGroupedWhatsAppMessage,
  copyTextToClipboard,
} from '../utils/whatsappHelper';
import { triggerCoinBurst } from '../utils/rewardEffect';

interface HouseGroupCardProps {
  houseNumber: string;
  deliveries: DeliveryData[];
  forcedCategory?: 'portaria' | 'vila' | 'residencia';
  groupLabel?: string;
  onOpenSingleDeliveryModal: (delivery: DeliveryData, mode?: 'entrega' | 'insucesso') => void;
  onOpenGroupDeliveryModal: (deliveries: DeliveryData[]) => void;
  onEditDelivery: (delivery: DeliveryData) => void;
  onDeleteDelivery: (id: string) => void;
  onUpdateDelivery: (delivery: DeliveryData) => void;
}

export type HouseLocationType = 'portaria' | 'vila' | 'residencia';

export const HouseGroupCard: React.FC<HouseGroupCardProps> = ({
  houseNumber,
  deliveries,
  forcedCategory,
  groupLabel,
  onOpenSingleDeliveryModal,
  onOpenGroupDeliveryModal,
  onEditDelivery,
  onDeleteDelivery,
  onUpdateDelivery,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [copiedGroup, setCopiedGroup] = useState<boolean>(false);

  const totalCount = deliveries.length;
  const deliveredList = deliveries.filter((d) => d.status === 'entregue' || d.status === 'concluido');
  const insucessoList = deliveries.filter((d) => d.status === 'insucesso');
  const pendingList = deliveries.filter(
    (d) => d.status !== 'entregue' && d.status !== 'concluido' && d.status !== 'insucesso'
  );

  const isAllDelivered = deliveredList.length === totalCount && totalCount > 0;
  const isAllInsucesso = insucessoList.length === totalCount && totalCount > 0;
  const hasMultiple = totalCount > 1;

  // DETECÇÃO INTELIGENTE DO TIPO DE LOCAL: Portaria (Prédio) vs Vila (Casas) vs Residência Única
  const locationType: HouseLocationType = useMemo(() => {
    if (forcedCategory) return forcedCategory;
    if (deliveries.length <= 1) return 'residencia';

    const complements = deliveries.map((d) => (d.complemento || d.endereco_complemento || '').toLowerCase().trim());

    // Se tiver complemento explícito de apartamento/bloco/condomínio
    const hasApartmentKeyword = complements.some(
      (c) =>
        c.includes('apto') ||
        c.includes('apartamento') ||
        c.includes('bloco') ||
        c.includes('sala') ||
        c.includes('condominio') ||
        c.includes('cond')
    );

    // Se tiver complemento explícito de casa/vila/fundos/sobrado
    const hasHouseKeyword = complements.some(
      (c) =>
        c.includes('casa') ||
        c.includes('vila') ||
        c.includes('fundos') ||
        c.includes('sobrado') ||
        c.includes('frente')
    );

    if (hasHouseKeyword) {
      return 'vila';
    }

    if (hasApartmentKeyword) {
      return 'portaria';
    }

    // Se não tiver palavra-chave mas houver múltiplos moradores com nomes diferentes no mesmo número:
    // Em vilas comunitárias/cortiços, trata como Vila (entrega de casa em casa) para não misturar os pacotes!
    const uniqueNames = new Set(deliveries.map((d) => (d.nome_destinatario || '').toLowerCase().trim()));
    if (uniqueNames.size > 1) {
      return 'vila';
    }

    return 'residencia';
  }, [deliveries]);

  // Sub-agrupamento para Vilas (agrupa os pacotes que forem exatamente da MESMA casa/morador dentro da vila)
  const vilaSubGroups = useMemo(() => {
    if (locationType !== 'vila') return [];

    const map = new Map<string, DeliveryData[]>();
    deliveries.forEach((d) => {
      // Chave por complemento (ex: 'Casa 1', 'Casa 2') ou nome se não tiver complemento
      const comp = (d.complemento || d.endereco_complemento || '').trim();
      const key = comp ? comp.toLowerCase() : `morador_${(d.nome_destinatario || 'Morador').trim().toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(d);
    });

    return Array.from(map.entries()).map(([key, items]) => {
      const displayLabel = items[0].complemento || items[0].endereco_complemento || `Casa (${items[0].nome_destinatario || 'Morador'})`;
      return {
        key,
        label: displayLabel,
        items,
        isGroupDelivered: items.every((d) => d.status === 'entregue' || d.status === 'concluido'),
      };
    });
  }, [deliveries, locationType]);

  // Resumo de destinatários
  const clientNamesSummary = useMemo(() => {
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

  // Disparo de entrega individual com efeito de moedas saindo do botão
  const handleSingleDeliveryWithParticles = (e: React.MouseEvent, del: DeliveryData, mode: 'entrega' | 'insucesso') => {
    e.stopPropagation();
    if (del.status === 'entregue' || del.status === 'concluido') {
      triggerCoinBurst(1, del.nome_destinatario, e);
    }
    onOpenSingleDeliveryModal(del, mode);
  };

  // Disparo para portaria ou todos os pacotes da mesma casa
  const handleDeliverAllClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (locationType === 'portaria') {
      // Abre modal de portaria (onde ele pode desmarcar apartamentos se não existirem!)
      onOpenGroupDeliveryModal(deliveries);
    } else if (deliveries.length === 1) {
      onOpenSingleDeliveryModal(deliveries[0], 'entrega');
    } else {
      // Residência única com múltiplos pacotes para a mesma pessoa
      onOpenGroupDeliveryModal(deliveries);
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
        onClick={(e) => handleSingleDeliveryWithParticles(e, single, isIns ? 'insucesso' : 'entrega')}
        className={`rounded-2xl border transition-all duration-200 shadow-xs relative overflow-hidden cursor-pointer active:scale-[0.99] ${
          isDel
            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300/70 dark:border-emerald-800/60'
            : isIns
            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300/70 dark:border-rose-800/60'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="p-3.5 pb-2.5 flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            {/* Bloco do Número com design suave e limpo */}
            <div
              className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 shadow-xs ${
                isDel
                  ? 'bg-emerald-600 text-white'
                  : isIns
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-900 dark:bg-slate-800 text-white border border-slate-700/50'
              }`}
            >
              <span className="text-[9px] uppercase tracking-tighter opacity-70 leading-none">Nº</span>
              <span className="text-lg leading-none mt-0.5">{houseNumber}</span>
            </div>

            <div className="min-w-0 truncate">
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-black text-sm text-slate-900 dark:text-slate-100 leading-tight truncate">
                  {name}
                </span>
                {comp && (
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded-md shrink-0 border border-slate-200/60 dark:border-slate-700/60">
                    {comp}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="text-[10px] font-mono font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded-md border border-blue-200/60 dark:border-blue-900/40">
                  {code}
                </span>

                {isDel ? (
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Entregue ({single.recebedor_detalhes || 'Morador'})</span>
                  </span>
                ) : isIns ? (
                  <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/40 px-1.5 py-0.2 rounded-md flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                    <span>Insucesso: {single.motivo_insucesso || 'Ausente'}</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded-md flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span>Pendente</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ações de Edição e Exclusão */}
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onEditDelivery(single)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Editar"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDeleteDelivery(single.id_entrega)}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Botão de Zap Direto */}
        <div
          className="p-3 pt-1.5 flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-800/80"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => handleSingleDeliveryWithParticles(e, single, isIns ? 'insucesso' : 'entrega')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] ${
              isDel
                ? 'bg-emerald-100/90 dark:bg-emerald-950/50 hover:bg-emerald-200 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                : isIns
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{isDel ? 'Reenviar no Zap' : isIns ? 'Zap Insucesso' : 'Zap c/ Texto Pronto'}</span>
          </button>

          {!isDel && !isIns && (
            <button
              onClick={(e) => handleSingleDeliveryWithParticles(e, single, 'insucesso')}
              className="py-2.5 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Registrar insucesso"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleQuickCopyGroup}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 border cursor-pointer transition-colors ${
              copiedGroup
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Copiar texto"
          >
            {copiedGroup ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    );
  }

  // CASO 2: MÚLTIPLOS PACOTES NO MESMO NÚMERO
  return (
    <div
      className={`rounded-2xl border transition-all duration-200 shadow-xs overflow-hidden ${
        isAllDelivered
          ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-800/60'
          : isAllInsucesso
          ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-300/80 dark:border-rose-800/60'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* CABEÇALHO DO CARD AGRUPADO */}
      <div className="p-3.5 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between gap-2.5 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          {/* Número em Grande Destaque */}
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-amber-300 border border-amber-400/30 flex flex-col items-center justify-center font-black shrink-0 shadow-xs">
            <span className="text-[9px] uppercase tracking-tighter opacity-70 leading-none">Nº</span>
            <span className="text-xl leading-none mt-0.5 font-mono">{houseNumber}</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Tag com Detecção Exata: Vila vs Portaria vs Residência */}
              {locationType === 'vila' ? (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 uppercase">
                  <Home className="w-3 h-3 text-emerald-400" />
                  <span>Vila ({vilaSubGroups.length} casas)</span>
                </span>
              ) : locationType === 'portaria' ? (
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 uppercase">
                  <Building className="w-3 h-3 text-blue-400" />
                  <span>Prédio / Portaria ({totalCount} aptos)</span>
                </span>
              ) : (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 uppercase">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  <span>Residência ({totalCount} pacotes)</span>
                </span>
              )}

              {isAllDelivered ? (
                <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Todos Entregues</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-400">
                  {pendingList.length} pendente{pendingList.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Subtítulo explicando a forma de entrega para o entregador */}
            <p className="text-[11px] text-slate-300 font-medium truncate mt-1">
              {locationType === 'vila' ? (
                <span>🚶‍♂️ Entrega individual de casa em casa</span>
              ) : locationType === 'portaria' ? (
                <span>📦 Entrega agrupada com porteiro / zelador</span>
              ) : (
                <span>📦 Pacotes para a mesma residência</span>
              )}
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

      {/* CASO PORTARIA OU RESIDÊNCIA ÚNICA: BOTÃO MASTER DE BAIXAR TODOS JUNTOS */}
      {locationType !== 'vila' && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <button
            onClick={handleDeliverAllClick}
            className={`flex-1 py-2.5 px-3.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-[0.98] ${
              isAllDelivered
                ? 'bg-emerald-700/90 hover:bg-emerald-600 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>
              {isAllDelivered
                ? 'Reenviar Zap da Portaria (Todos)'
                : `Entregar Todos na Portaria (Zap Portaria • ${totalCount} aptos)`}
            </span>
          </button>

          <button
            onClick={handleQuickCopyGroup}
            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center cursor-pointer transition-colors ${
              copiedGroup
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Copiar texto consolidado de todos os pacotes"
          >
            {copiedGroup ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      )}

      {/* LISTAGEM DOS PACOTES DESTE NÚMERO */}
      {isExpanded && (
        <div className="p-3 space-y-2.5 bg-white dark:bg-slate-900">
          {/* Se for VILA: Exibe agrupado por cada CASA da vila (Entrega de Casa em Casa!) */}
          {locationType === 'vila' ? (
            <div className="space-y-2">
              <div className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
                <span>Casas da Vila no Nº {houseNumber}</span>
                <span>{deliveries.length} pacotes no total</span>
              </div>

              {vilaSubGroups.map((sub) => {
                const isSubDel = sub.isGroupDelivered;
                const hasMultiInSameCasa = sub.items.length > 1;

                return (
                  <div
                    key={sub.key}
                    className={`rounded-xl border p-2.5 space-y-2 transition-all ${
                      isSubDel
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80'
                    }`}
                  >
                    {/* Cabeçalho da Casa na Vila */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 font-black text-xs border border-emerald-200 dark:border-emerald-800 shrink-0">
                          {sub.label}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {sub.items.map((it) => it.nome_destinatario).join(', ')}
                        </span>
                      </div>

                      {/* Botão de Entrega Dedicado para Esta Casa Específica da Vila */}
                      <button
                        onClick={(e) => {
                          if (hasMultiInSameCasa) {
                            // Se tiver mais de 1 pacote para a mesma casa da vila, entrega os pacotes daquela casa juntos!
                            onOpenGroupDeliveryModal(sub.items);
                          } else {
                            handleSingleDeliveryWithParticles(e, sub.items[0], 'entrega');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 ${
                          isSubDel
                            ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 border border-emerald-300'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs'
                        }`}
                      >
                        <Share2 className="w-3 h-3" />
                        <span>
                          {isSubDel
                            ? 'Reenviar Zap'
                            : hasMultiInSameCasa
                            ? `Entregar Casa (${sub.items.length})`
                            : 'Entregar Casa'}
                        </span>
                      </button>
                    </div>

                    {/* Lista dos pacotes desta casa específica */}
                    <div className="space-y-1 pl-1">
                      {sub.items.map((pkg) => {
                        const code = pkg.codigo_pacote.startsWith('#') ? pkg.codigo_pacote : `#${pkg.codigo_pacote}`;
                        const isPkgDel = pkg.status === 'entregue' || pkg.status === 'concluido';

                        return (
                          <div
                            key={pkg.id_entrega}
                            className="flex items-center justify-between text-xs py-1 border-t border-slate-200/50 dark:border-slate-700/50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.2 rounded">
                                {code}
                              </span>
                              <span className="text-slate-700 dark:text-slate-300 font-medium">
                                {pkg.nome_destinatario}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isPkgDel ? (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Entregue</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-500">Pendente</span>
                              )}

                              <button
                                onClick={(e) => handleSingleDeliveryWithParticles(e, pkg, 'entrega')}
                                className="p-1 text-slate-400 hover:text-emerald-600"
                                title="Abrir individual"
                              >
                                <Share2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Se for PORTARIA OU RESIDÊNCIA NORMAL: lista padrão de pacotes */
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                <span>Itens do Nº {houseNumber}</span>
                <span>{totalCount} itens</span>
              </div>

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
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50'
                        : isPkgIns
                        ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50'
                        : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>

                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs text-slate-900 dark:text-slate-100 truncate">
                            {name}
                          </span>
                          {comp && (
                            <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700 shrink-0">
                              {comp}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-1 py-0.2 rounded">
                            {code}
                          </span>
                          {isPkgDel ? (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Entregue</span>
                            </span>
                          ) : isPkgIns ? (
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Insucesso</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-0.5">
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
                        onClick={(e) => handleSingleDeliveryWithParticles(e, pkg, 'entrega')}
                        className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-200 rounded-lg text-[10px] font-black cursor-pointer border border-emerald-200 dark:border-emerald-800 transition-colors"
                        title="Entregar individualmente"
                      >
                        {isPkgDel ? 'Zap' : 'Entregar'}
                      </button>

                      <button
                        onClick={() => onEditDelivery(pkg)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDeleteDelivery(pkg.id_entrega)}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
