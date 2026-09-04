import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  ChevronUp,
  ChevronDown,
  PackageCheck,
  Copy,
  Check,
  Clock,
  Edit3,
  Trash2,
  Send,
  RotateCcw,
  XCircle,
  Building2,
  Home,
  Zap,
} from 'lucide-react';
import { UserProfile, UserStreet, StreetPackage } from '../types';
import {
  formatGroupDeliveryWhatsAppMessage,
  formatDeliveryWhatsAppMessage,
  formatFailureWhatsAppMessage,
  openWhatsApp,
  copyToClipboard,
} from '../lib/userStorage';

interface GroupedHouseCardProps {
  houseNum: string;
  packages: StreetPackage[];
  user: UserProfile;
  street: UserStreet;
  onDeliverPackage: (pkg: StreetPackage) => void;
  onDeliverAllInGroup: (houseNum: string, pkgs: StreetPackage[]) => void;
  onFailPackage: (pkg: StreetPackage) => void;
  onResetPackage: (pkgId: string) => void;
  onDeletePackage: (pkgId: string) => void;
  whatsappPhone?: string;
  defaultExpanded?: boolean;
}

export const GroupedHouseCard: React.FC<GroupedHouseCardProps> = ({
  houseNum,
  packages,
  user,
  street,
  onDeliverPackage,
  onDeliverAllInGroup,
  onFailPackage,
  onResetPackage,
  onDeletePackage,
  whatsappPhone,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copiedGroup, setCopiedGroup] = useState(false);
  const [copiedItemIndex, setCopiedItemIndex] = useState<number | null>(null);

  // Calculate statistics for this house group
  const totalCount = packages.length;
  const deliveredCount = packages.filter((p) => p.status === 'delivered').length;
  const failedCount = packages.filter((p) => p.status === 'failed').length;
  const pendingCount = totalCount - deliveredCount - failedCount;
  const isAllDelivered = totalCount > 0 && deliveredCount === totalCount;

  // Breakdown of names and counts (e.g. "pedro (2x) • joao (3x)")
  const recipientSummary = useMemo(() => {
    const countsMap = new Map<string, number>();
    packages.forEach((p) => {
      const name = (p.recipientName || 'Morador').trim();
      countsMap.set(name, (countsMap.get(name) || 0) + 1);
    });

    return Array.from(countsMap.entries())
      .map(([name, count]) => `${name} (${count}x)`)
      .join(' • ');
  }, [packages]);

  // Sub-units grouping (e.g., separating "casa 3" from "casa 4" or grouping same person's packages)
  const subUnits = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        complement?: string;
        recipientName: string;
        packages: StreetPackage[];
      }
    >();

    packages.forEach((pkg) => {
      const compKey = pkg.complement?.trim().toLowerCase() || '';
      const nameKey = (pkg.recipientName || 'Morador').trim().toLowerCase();
      // Distinguish sub-units by complement if present, otherwise by recipient name
      const groupKey = compKey ? `comp_${compKey}` : `name_${nameKey}`;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          complement: pkg.complement?.trim(),
          recipientName: pkg.recipientName?.trim() || 'Morador',
          packages: [],
        });
      }
      map.get(groupKey)!.packages.push(pkg);
    });

    return Array.from(map.values());
  }, [packages]);

  // Copy Group WhatsApp message
  const handleCopyGroupMessage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = formatGroupDeliveryWhatsAppMessage(
      user.name,
      street.name,
      houseNum,
      packages,
      'Portaria / Prédio'
    );
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedGroup(true);
      setTimeout(() => setCopiedGroup(false), 2000);
    }
  };

  // Copy Individual Package WhatsApp text
  const handleCopySingleItem = async (pkg: StreetPackage, idx: number) => {
    const text =
      pkg.status === 'failed'
        ? formatFailureWhatsAppMessage(user.name, street.name, pkg)
        : formatDeliveryWhatsAppMessage(user.name, street.name, pkg);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedItemIndex(idx);
      setTimeout(() => setCopiedItemIndex(null), 2000);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      {/* 1. Header Escuro do Agrupamento */}
      <div className="bg-slate-950 text-white p-4 sm:p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          {/* Badge Amarelo do Número + Resumo dos Nomes */}
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Badge Amarelo Nº */}
            <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 flex flex-col items-center justify-center font-black shrink-0 shadow-sm">
              <span className="text-[10px] uppercase font-extrabold text-slate-900 leading-none">
                Nº
              </span>
              <span className="text-xl sm:text-2xl font-black leading-tight truncate max-w-[48px] text-center">
                {houseNum}
              </span>
            </div>

            {/* Informações Agregadas */}
            <div className="min-w-0">
              {/* Badges de Quantidade & Status */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black px-2.5 py-0.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 flex items-center gap-1.5 shrink-0">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{totalCount} Pacotes Agregados</span>
                </span>

                {pendingCount > 0 && (
                  <span className="text-xs font-bold text-amber-400">
                    {pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'}
                  </span>
                )}

                {deliveredCount > 0 && (
                  <span className="text-xs font-bold text-emerald-400">
                    {deliveredCount} {deliveredCount === 1 ? 'entregue' : 'entregues'}
                  </span>
                )}

                {failedCount > 0 && (
                  <span className="text-xs font-bold text-red-400">
                    {failedCount} {failedCount === 1 ? 'falha' : 'falhas'}
                  </span>
                )}
              </div>

              {/* Sub-agrupamento por Nomes com contagem individual (ex: pedro (2x) • joao (3x)) */}
              <p className="text-sm font-bold text-slate-200 mt-1 truncate">
                {recipientSummary || 'Morador'}
              </p>
            </div>
          </div>

          {/* Botão de Expandir / Recolher */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all cursor-pointer shrink-0"
            title={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Botão Grande de Ação em Lote (Portaria / Zap Único com Seleção por Checkbox) */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => onDeliverAllInGroup(houseNum, packages)}
            className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer ${
              isAllDelivered
                ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <PackageCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {isAllDelivered
                ? `Reenviar Zap Único na Portaria (${totalCount} pacotes)`
                : `Entregar Todos na Portaria (Zap Único • ${totalCount} ${
                    totalCount === 1 ? 'pacote' : 'pacotes'
                  })`}
            </span>
          </button>

          {/* Botão de Copiar Zap Único */}
          <button
            type="button"
            onClick={handleCopyGroupMessage}
            className={`p-3 rounded-2xl border transition-all cursor-pointer shrink-0 ${
              copiedGroup
                ? 'bg-emerald-600 text-white border-emerald-400'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
            }`}
            title="Copiar mensagem consolidada do Zap Único"
          >
            {copiedGroup ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Seção de Pacotes Organizados por Casa / Morador */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50">
          {/* Cabeçalho da Lista Individual */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
              PACOTES DO Nº {houseNum} ({subUnits.length} {subUnits.length === 1 ? 'RESIDÊNCIA' : 'SUB-ENDEREÇOS / CASAS'})
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              {totalCount} {totalCount === 1 ? 'ITEM' : 'ITENS NO TOTAL'}
            </span>
          </div>

          {/* Blocos de Sub-Unidades (Casas / Apartamentos) */}
          <div className="space-y-4">
            {subUnits.map((subUnit, sIdx) => {
              const subPending = subUnit.packages.filter((p) => p.status === 'pending');
              const hasMultipleInSubUnit = subUnit.packages.length > 1;

              return (
                <div
                  key={subUnit.key}
                  className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5"
                >
                  {/* Cabeçalho da Sub-Unidade (Casa 3, Casa 4, etc.) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">
                        <Home className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-slate-900 text-xs truncate">
                            {subUnit.complement || `Residência ${sIdx + 1}`}
                          </span>
                          <span className="text-slate-400 font-bold text-xs">•</span>
                          <span className="text-slate-700 font-bold text-xs truncate">
                            {subUnit.recipientName}
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.2 rounded-md bg-slate-100 text-slate-600">
                            {subUnit.packages.length} {subUnit.packages.length === 1 ? 'pacote' : 'pacotes'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botão de Entrega em Lote da Mesma Casa/Morador se houver > 1 pacote */}
                    {hasMultipleInSubUnit && subPending.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          onDeliverAllInGroup(
                            `${houseNum}${subUnit.complement ? ` (${subUnit.complement})` : ''}`,
                            subUnit.packages
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer"
                        title="Entregar todos os pacotes desta mesma casa juntos"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Entregar {subUnit.packages.length} da {subUnit.complement || 'Casa'} Juntos</span>
                      </button>
                    )}
                  </div>

                  {/* Lista dos Pacotes da Sub-Unidade */}
                  <div className="space-y-1.5">
                    {subUnit.packages.map((pkg, idx) => {
                      const isDelivered = pkg.status === 'delivered';
                      const isFailed = pkg.status === 'failed';
                      const codeDisplay = pkg.code
                        ? pkg.code.startsWith('#')
                          ? pkg.code
                          : `#${pkg.code}`
                        : `#${pkg.id.replace(/\D/g, '').slice(-4) || `${idx + 101}`}`;

                      return (
                        <div
                          key={pkg.id}
                          className={`p-3 rounded-xl border transition-all flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 ${
                            isDelivered
                              ? 'bg-emerald-50/70 border-emerald-200'
                              : isFailed
                              ? 'bg-red-50/70 border-red-200'
                              : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Informações do Pacote */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-black text-[11px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-slate-900 text-xs truncate">
                                  {pkg.recipientName || 'Morador'}
                                </span>
                                {pkg.complement && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-white text-slate-700 border border-slate-200">
                                    {pkg.complement}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[11px] font-bold font-mono text-blue-600">
                                  {codeDisplay}
                                </span>

                                {!isDelivered && !isFailed && (
                                  <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-amber-500" />
                                    <span>Pendente</span>
                                  </span>
                                )}

                                {isDelivered && (
                                  <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Entregue{pkg.deliveredTo ? ` • ${pkg.deliveredTo}` : ''}</span>
                                  </span>
                                )}

                                {isFailed && (
                                  <span className="text-[11px] font-bold text-red-600 flex items-center gap-1">
                                    <XCircle className="w-3 h-3 text-red-500" />
                                    <span>{pkg.failureReason || 'Ausente'}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Ações Rápidas do Pacote Individual */}
                          <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
                            {!isDelivered && !isFailed ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onDeliverPackage(pkg)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-black text-xs transition-all cursor-pointer"
                                >
                                  Entregar
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onFailPackage(pkg)}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-slate-200/60 transition-all cursor-pointer"
                                  title="Registrar Ausente / Insucesso"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onDeletePackage(pkg.id)}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                                  title="Excluir pacote"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleCopySingleItem(pkg, idx)}
                                  className={`p-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                                    copiedItemIndex === idx
                                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                      : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                  title="Copiar comprovante individual"
                                >
                                  {copiedItemIndex === idx ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const message =
                                      pkg.status === 'failed'
                                        ? formatFailureWhatsAppMessage(user.name, street.name, pkg)
                                        : formatDeliveryWhatsAppMessage(user.name, street.name, pkg);
                                    openWhatsApp(message, whatsappPhone);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-xs shadow-2xs cursor-pointer"
                                  title="Abrir no WhatsApp"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Zap</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onResetPackage(pkg.id)}
                                  className="p-1.5 rounded-xl border border-slate-300 text-slate-500 hover:bg-slate-200/60 transition-all cursor-pointer"
                                  title="Desfazer e voltar para pendente"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onDeletePackage(pkg.id)}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                                  title="Excluir pacote"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
