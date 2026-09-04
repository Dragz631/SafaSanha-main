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
  FileText,
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

  // Disparo de abertura de entrega individual (sem disparar moedas antes da confirmação)
  const handleSingleDeliveryWithParticles = (e: React.MouseEvent, del: DeliveryData, mode: 'entrega' | 'insucesso') => {
    e.stopPropagation();
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
        className={`rounded-2xl border transition-all duration-200 shadow-sm overflow-hidden ${
          isDel
            ? 'bg-slate-900/90 border-emerald-500/40 shadow-emerald-500/5'
            : isIns
            ? 'bg-slate-900/90 border-rose-500/40 shadow-rose-500/5'
            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="p-3.5 pb-2.5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Bloco do Número com design em alto contraste */}
            <div
              className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black shrink-0 shadow-xs border ${
                isDel
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : isIns
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
                  {name}
                </span>
                {comp && (
                  <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded-md shrink-0 border border-slate-700">
                    {comp}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="text-[10px] font-mono font-bold text-sky-300 bg-sky-950/60 px-1.5 py-0.5 rounded-md border border-sky-800/50">
                  {code}
                </span>

                {isDel ? (
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-emerald-800/40">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Entregue ({single.recebedor_detalhes || 'Morador'})</span>
                  </span>
                ) : isIns ? (
                  <span className="text-[10px] font-bold text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-rose-800/40">
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>Insucesso: {single.motivo_insucesso || 'Ausente'}</span>
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

          {/* Ações de Edição e Exclusão discretas */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onEditDelivery(single)}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
              title="Editar"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDeleteDelivery(single.id_entrega)}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 cursor-pointer transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Botão de Ação Direta Mobile-First (Altura 48px para polegar) */}
        <div
          className="p-3 pt-1.5 flex items-center gap-2 border-t border-slate-800/80"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => handleSingleDeliveryWithParticles(e, single, isIns ? 'insucesso' : 'entrega')}
            className={`flex-1 h-12 px-3.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] touch-manipulation ${
              isDel
                ? 'bg-slate-800/90 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30'
                : isIns
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md font-black'
            }`}
          >
            {isDel ? (
              <FileText className="w-4 h-4 text-emerald-400" />
            ) : isIns ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            )}
            <span>{isDel ? '📄 Ver Registro / Copiar' : isIns ? '⚠️ Insucesso' : '✓ Entregar Pacote (+2 🪙)'}</span>
          </button>

          {!isDel && !isIns && (
            <button
              onClick={(e) => handleSingleDeliveryWithParticles(e, single, 'insucesso')}
              className="h-12 w-12 bg-slate-800 hover:bg-rose-950/40 text-rose-400 border border-slate-700/80 rounded-xl flex items-center justify-center cursor-pointer transition-colors touch-manipulation shrink-0"
              title="Registrar insucesso"
            >
              <AlertTriangle className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleQuickCopyGroup}
            className={`h-12 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border cursor-pointer transition-colors touch-manipulation shrink-0 ${
              copiedGroup
                ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-black'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
            }`}
            title="Copiar texto pronto"
          >
            {copiedGroup ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  }

  // CASO 2: MÚLTIPLOS PACOTES NO MESMO NÚMERO
  return (
    <div
      className={`rounded-2xl border transition-all duration-200 shadow-sm overflow-hidden ${
        isAllDelivered
          ? 'bg-slate-900/90 border-emerald-500/40'
          : isAllInsucesso
          ? 'bg-slate-900/90 border-rose-500/40'
          : 'bg-slate-900 border-slate-800 hover:border-slate-750'
      }`}
    >
      {/* CABEÇALHO DO CARD AGRUPADO */}
      <div className="p-3.5 bg-slate-950 text-white flex items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          {/* Número em Grande Destaque */}
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-amber-300 border border-slate-700/80 flex flex-col items-center justify-center font-black shrink-0 font-mono shadow-xs">
            <span className="text-[8px] uppercase tracking-tighter opacity-70 leading-none">Nº</span>
            <span className="text-xl leading-none mt-0.5">{houseNumber}</span>
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
                <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 uppercase">
                  <Building className="w-3 h-3 text-sky-400" />
                  <span>Prédio / Portaria ({totalCount} aptos)</span>
                </span>
              ) : (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 uppercase">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  <span>Residência ({totalCount} pacotes)</span>
                </span>
              )}

              {isAllDelivered ? (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Todos Entregues</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-400">
                  {pendingList.length} pendente{pendingList.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Subtítulo explicando a forma de entrega para o entregador */}
            <p className="text-[11px] text-slate-400 font-medium truncate mt-1">
              {locationType === 'vila' ? (
                <span>🚶‍♂️ Entrega de casa em casa na vila</span>
              ) : locationType === 'portaria' ? (
                <span>📦 Deixar com portaria / recebedor</span>
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
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer shrink-0 transition-colors flex items-center justify-center border border-slate-700/60"
          title={isExpanded ? 'Recolher detalhes' : 'Expandir pacotes'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* CASO PORTARIA OU RESIDÊNCIA ÚNICA: BOTÃO MASTER DE BAIXAR TODOS JUNTOS */}
      {locationType !== 'vila' && (
        <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex items-center gap-2">
          <button
            onClick={handleDeliverAllClick}
            className={`flex-1 h-12 px-3.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-[0.98] touch-manipulation ${
              isAllDelivered
                ? 'bg-slate-800/90 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md font-black'
            }`}
          >
            {isAllDelivered ? (
              <FileText className="w-4 h-4 text-emerald-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            )}
            <span>
              {isAllDelivered
                ? '📄 Ver Registro do Grupo / Copiar'
                : `✓ Entregar Todos na Portaria (${pendingList.length > 0 ? `${pendingList.length} pendentes` : `${totalCount} aptos`})`}
            </span>
          </button>

          <button
            onClick={handleQuickCopyGroup}
            className={`h-12 px-3.5 rounded-xl border text-xs font-bold flex items-center justify-center cursor-pointer transition-colors touch-manipulation shrink-0 ${
              copiedGroup
                ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-black'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
            }`}
            title="Copiar texto consolidado de todos os pacotes"
          >
            {copiedGroup ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* LISTAGEM DOS PACOTES DESTE NÚMERO */}
      {isExpanded && (
        <div className="p-3 space-y-2.5 bg-slate-950/60 border-t border-slate-800">
          {/* Se for VILA: Exibe agrupado por cada CASA da vila (Entrega de Casa em Casa!) */}
          {locationType === 'vila' ? (
            <div className="space-y-2">
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
                <span>Casas da Vila no Nº {houseNumber}</span>
                <span className="font-mono text-emerald-400">{deliveries.length} pacotes</span>
              </div>

              {vilaSubGroups.map((sub) => {
                const isSubDel = sub.isGroupDelivered;
                const hasMultiInSameCasa = sub.items.length > 1;

                return (
                  <div
                    key={sub.key}
                    className={`rounded-xl border p-3 space-y-2.5 transition-all ${
                      isSubDel
                        ? 'bg-slate-900/90 border-emerald-500/40'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    {/* Cabeçalho da Casa na Vila */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-xs border border-emerald-500/30 shrink-0">
                          {sub.label}
                        </span>
                        <span className="text-xs font-bold text-slate-200 truncate">
                          {sub.items.map((it) => it.nome_destinatario).join(', ')}
                        </span>
                      </div>

                      {/* Botão de Entrega Dedicado para Esta Casa Específica da Vila */}
                      <button
                        onClick={(e) => {
                          if (hasMultiInSameCasa) {
                            onOpenGroupDeliveryModal(sub.items);
                          } else {
                            handleSingleDeliveryWithParticles(e, sub.items[0], 'entrega');
                          }
                        }}
                        className={`h-9 px-3 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 touch-manipulation ${
                          isSubDel
                            ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm'
                        }`}
                      >
                        {isSubDel ? <FileText className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>
                          {isSubDel
                            ? 'Ver Registro'
                            : hasMultiInSameCasa
                            ? `Entregar (${sub.items.length})`
                            : 'Entregar'}
                        </span>
                      </button>
                    </div>

                    {/* Lista dos pacotes desta casa específica */}
                    <div className="space-y-1.5 pl-1">
                      {sub.items.map((pkg) => {
                        const code = pkg.codigo_pacote.startsWith('#') ? pkg.codigo_pacote : `#${pkg.codigo_pacote}`;
                        const isPkgDel = pkg.status === 'entregue' || pkg.status === 'concluido';

                        return (
                          <div
                            key={pkg.id_entrega}
                            className="flex items-center justify-between text-xs py-1.5 border-t border-slate-800"
                          >
                            <div className="flex items-center gap-2 min-w-0 truncate">
                              <span className="font-mono font-bold text-[10px] text-sky-300 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/40">
                                {code}
                              </span>
                              <span className="text-slate-300 font-medium truncate">
                                {pkg.nome_destinatario}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isPkgDel ? (
                                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Entregue</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-400">Pendente</span>
                              )}

                              <button
                                onClick={(e) => handleSingleDeliveryWithParticles(e, pkg, 'entrega')}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800"
                                title="Abrir individual"
                              >
                                <FileText className="w-3.5 h-3.5" />
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
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-1">
                <span>Itens do Nº {houseNumber}</span>
                <span className="font-mono text-emerald-400">{totalCount} itens</span>
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
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                      isPkgDel
                        ? 'bg-slate-900/90 border-emerald-500/40'
                        : isPkgIns
                        ? 'bg-slate-900/90 border-rose-500/40'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-black flex items-center justify-center shrink-0 border border-slate-700">
                        {idx + 1}
                      </span>

                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs text-slate-100 truncate">
                            {name}
                          </span>
                          {comp && (
                            <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700 shrink-0">
                              {comp}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] font-bold text-sky-300 bg-sky-950/60 px-1 py-0.2 rounded border border-sky-800/40">
                            {code}
                          </span>
                          {isPkgDel ? (
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Entregue</span>
                            </span>
                          ) : isPkgIns ? (
                            <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Insucesso</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-400" />
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
                        className={`h-8 px-2.5 rounded-lg text-xs font-black cursor-pointer border transition-colors touch-manipulation ${
                          isPkgDel
                            ? 'bg-slate-800 text-emerald-400 border-emerald-500/40 hover:bg-slate-750'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400'
                        }`}
                        title={isPkgDel ? 'Ver registro da entrega' : 'Entregar individualmente'}
                      >
                        {isPkgDel ? 'Registro' : 'Entregar'}
                      </button>

                      <button
                        onClick={() => onEditDelivery(pkg)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 cursor-pointer"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDeleteDelivery(pkg.id_entrega)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 cursor-pointer"
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
