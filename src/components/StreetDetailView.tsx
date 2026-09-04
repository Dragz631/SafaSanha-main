import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  XCircle,
  Share2,
  Trash2,
  Home,
  User,
  Send,
  Check,
  RotateCcw,
  Copy,
  Building2,
  Layers,
  BookOpen,
  Coins,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, UserStreet, StreetPackage, ReceiverCategory } from '../types';
import {
  formatDeliveryWhatsAppMessage,
  formatStreetSummaryWhatsAppMessage,
  openWhatsApp,
  copyToClipboard,
  saveAddressToStreetMemory,
  getStreetSavedAddresses,
} from '../lib/userStorage';
import { DeliveryConfirmModal } from './DeliveryConfirmModal';
import { GroupedHouseCard } from './GroupedHouseCard';
import { GroupPortariaConfirmModal } from './GroupPortariaConfirmModal';
import { StreetMemoryModal } from './StreetMemoryModal';
import { MoneyCelebrationToast, MoneyCelebrationEvent } from './MoneyCelebrationToast';

interface StreetDetailViewProps {
  user: UserProfile;
  street: UserStreet;
  defaultWhatsAppPhone?: string;
  onBack: () => void;
  onUpdateStreet: (updatedStreet: UserStreet) => void;
  onDeleteStreet: (streetId: string) => void;
}

export const StreetDetailView: React.FC<StreetDetailViewProps> = ({
  user,
  street,
  defaultWhatsAppPhone,
  onBack,
  onUpdateStreet,
  onDeleteStreet,
}) => {
  // Add package form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [houseNumber, setHouseNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [code, setCode] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'all'>('grouped');

  // Street Memory and Money Celebration states
  const [showStreetMemoryModal, setShowStreetMemoryModal] = useState(false);
  const [moneyToastEvent, setMoneyToastEvent] = useState<MoneyCelebrationEvent | null>(null);

  // Saved addresses from memory for this street
  const savedStreetAddresses = useMemo(() => {
    return getStreetSavedAddresses(user.id, street.name);
  }, [user.id, street.name, showStreetMemoryModal]);

  // Delivery Modal State
  const [deliveryModalPkg, setDeliveryModalPkg] = useState<StreetPackage | null>(null);
  const [groupPortariaModalData, setGroupPortariaModalData] = useState<{
    houseNum: string;
    packages: StreetPackage[];
  } | null>(null);

  // Failure Modal State
  const [failedModalPkg, setFailedModalPkg] = useState<StreetPackage | null>(null);
  const [failReason, setFailReason] = useState('Morador Ausente');

  const totalPackages = street.packages.length;
  const deliveredPackages = street.packages.filter((p) => p.status === 'delivered').length;
  const failedPackages = street.packages.filter((p) => p.status === 'failed').length;
  const pendingPackages = totalPackages - deliveredPackages - failedPackages;
  const progressPercent = totalPackages > 0 ? Math.round((deliveredPackages / totalPackages) * 100) : 0;

  // Grouped by House Number if viewMode === 'grouped'
  const groupedPackageList = useMemo(() => {
    const groupMap = new Map<string, StreetPackage[]>();
    street.packages.forEach((p) => {
      const key = p.houseNumber.trim() || 'S/N';
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(p);
    });
    return Array.from(groupMap.entries());
  }, [street.packages]);

  const multiPackageGroupsCount = useMemo(() => {
    return groupedPackageList.filter(([_, pkgs]) => pkgs.length > 1).length;
  }, [groupedPackageList]);

  // Batch group delivery handler
  const handleBatchDeliverGroup = (
    receiverData: {
      category: ReceiverCategory;
      subtype?: string;
      receiverName?: string;
      deliveredTo: string;
    },
    andOpenZap: boolean,
    selectedPackageIds?: string[]
  ) => {
    if (!groupPortariaModalData) return;
    const targetIds = new Set(
      selectedPackageIds && selectedPackageIds.length > 0
        ? selectedPackageIds
        : groupPortariaModalData.packages.map((p) => p.id)
    );
    const now = new Date().toISOString();

    const updatedPackages = street.packages.map((p) => {
      if (targetIds.has(p.id)) {
        return {
          ...p,
          status: 'delivered' as const,
          receiverCategory: receiverData.category,
          receiverSubtype: receiverData.subtype,
          receiverName: receiverData.receiverName,
          deliveredTo: receiverData.deliveredTo,
          deliveredAt: now,
        };
      }
      return p;
    });

    const willBeAllDelivered =
      updatedPackages.length > 0 && updatedPackages.every((p) => p.status === 'delivered');

    onUpdateStreet({
      ...street,
      packages: updatedPackages,
      isCompleted: willBeAllDelivered,
    });

    const savedHouseNum = groupPortariaModalData.houseNum;
    const deliveredCount = targetIds.size;

    setGroupPortariaModalData(null);

    setMoneyToastEvent({
      id: `money_batch_${Date.now()}`,
      houseNumber: savedHouseNum,
      recipientName: receiverData.deliveredTo,
      packageCount: deliveredCount,
      streetName: street.name,
    });

    if (willBeAllDelivered) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  // Add new package
  const handleAddPackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!houseNumber.trim() && !recipientName.trim()) return;

    const cleanNum = houseNumber.trim() || 'S/N';
    const cleanComp = complement.trim() || undefined;
    const cleanRec = recipientName.trim() || 'Morador';

    const newPkg: StreetPackage = {
      id: `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      houseNumber: cleanNum,
      complement: cleanComp,
      recipientName: cleanRec,
      code: code.trim() || undefined,
      status: 'pending',
    };

    // Immediately save into street address memory!
    saveAddressToStreetMemory(user.id, street.name, cleanNum, cleanComp, cleanRec);

    const updatedPackages = [...street.packages, newPkg];
    onUpdateStreet({
      ...street,
      packages: updatedPackages,
      isCompleted: false,
    });

    setHouseNumber('');
    setComplement('');
    setRecipientName('');
    setCode('');
    setShowAddForm(false);
  };

  // Confirm delivery from modal
  const handleConfirmPackageDelivery = (updatedPkg: StreetPackage) => {
    const updatedPackages = street.packages.map((p) =>
      p.id === updatedPkg.id ? updatedPkg : p
    );

    const willBeAllDelivered =
      updatedPackages.length > 0 &&
      updatedPackages.every((p) => p.status === 'delivered');

    onUpdateStreet({
      ...street,
      packages: updatedPackages,
      isCompleted: willBeAllDelivered,
    });

    setDeliveryModalPkg(null);

    // Save to street memory
    saveAddressToStreetMemory(
      user.id,
      street.name,
      updatedPkg.houseNumber,
      updatedPkg.complement,
      updatedPkg.recipientName,
      {
        category: updatedPkg.receiverCategory,
        subtype: updatedPkg.receiverSubtype,
        receiverName: updatedPkg.receiverName,
        isDelivered: true,
      }
    );

    // Trigger visual money celebration toast!
    setMoneyToastEvent({
      id: `money_${Date.now()}`,
      houseNumber: updatedPkg.houseNumber,
      recipientName: updatedPkg.recipientName,
      packageCount: 1,
      streetName: street.name,
    });

    if (willBeAllDelivered) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  // Mark as Failed/Absent
  const handleConfirmFailed = () => {
    if (!failedModalPkg) return;

    const updatedPkg: StreetPackage = {
      ...failedModalPkg,
      status: 'failed',
      failureReason: failReason,
      deliveredAt: new Date().toISOString(),
    };

    const updatedPackages = street.packages.map((p) =>
      p.id === failedModalPkg.id ? updatedPkg : p
    );

    onUpdateStreet({
      ...street,
      packages: updatedPackages,
    });

    setFailedModalPkg(null);
  };

  // Reopen/Reset package to pending
  const handleResetPackage = (pkgId: string) => {
    const updatedPackages = street.packages.map((p) =>
      p.id === pkgId
        ? {
            ...p,
            status: 'pending' as const,
            deliveredTo: undefined,
            receiverCategory: undefined,
            receiverSubtype: undefined,
            receiverName: undefined,
            deliveredAt: undefined,
          }
        : p
    );

    onUpdateStreet({
      ...street,
      packages: updatedPackages,
      isCompleted: false,
    });
  };

  // Delete Package
  const handleDeletePackage = (pkgId: string) => {
    const updatedPackages = street.packages.filter((p) => p.id !== pkgId);
    onUpdateStreet({
      ...street,
      packages: updatedPackages,
    });
  };

  // Send single delivery proof to WhatsApp
  const handleSendSingleProof = (pkg: StreetPackage) => {
    const message = formatDeliveryWhatsAppMessage(user.name, street.name, pkg);
    openWhatsApp(message, defaultWhatsAppPhone);
  };

  // Send entire street summary to WhatsApp
  const handleSendStreetSummary = () => {
    const message = formatStreetSummaryWhatsAppMessage(user.name, street);
    openWhatsApp(message, defaultWhatsAppPhone);
  };

  // Toggle Street Complete
  const handleToggleStreetComplete = () => {
    const nextState = !street.isCompleted;
    if (nextState) {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.5 },
      });
    }
    onUpdateStreet({
      ...street,
      isCompleted: nextState,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 space-y-4 animate-fadeIn">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-xs">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-bold px-3 py-2 rounded-2xl hover:bg-slate-100 transition-all cursor-pointer text-sm"
        >
          <ArrowLeft className="w-5 h-5 text-emerald-600" />
          <span>Voltar para Ruas</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowStreetMemoryModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer active:scale-95"
            title="Abrir casas e moradores salvos nesta rua"
          >
            <BookOpen className="w-4 h-4 text-slate-950" />
            <span>Casas Salvas ({savedStreetAddresses.length})</span>
          </button>

          <button
            onClick={handleSendStreetSummary}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
            title="Enviar resumo da rua no WhatsApp"
          >
            <Share2 className="w-4 h-4" />
            <span>Zap da Rua</span>
          </button>

          <button
            onClick={handleToggleStreetComplete}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer ${
              street.isCompleted
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{street.isCompleted ? 'Concluída' : 'Concluir Rua'}</span>
          </button>
        </div>
      </div>

      {/* Street Hero Info */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Logistan Expedito
              </span>
              {street.isCompleted && (
                <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  100% Finalizada
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1">{street.name}</h2>
            <p className="text-xs text-slate-300">
              Entregador: <strong className="text-white">{user.name}</strong> •{' '}
              {deliveredPackages} de {totalPackages} pacotes entregues
            </p>
          </div>

          <div className="text-right">
            <div className="text-3xl font-black text-emerald-400">{progressPercent}%</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Progresso</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10">
          <div
            className="bg-emerald-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
          <span>📦 Números & Destinatários</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-black">
            {totalPackages}
          </span>
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Adicionar Número</span>
          </button>
        </div>
      </div>

      {/* Visões de Listagem: Agrupado vs Todos */}
      {street.packages.length > 0 && (
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 text-xs font-black">
          <button
            onClick={() => setViewMode('grouped')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              viewMode === 'grouped'
                ? 'bg-slate-950 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Building2 className={`w-3.5 h-3.5 ${viewMode === 'grouped' ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span>Agrupado p/ Casas / Portaria ({multiPackageGroupsCount})</span>
            {multiPackageGroupsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] ml-1">
                {multiPackageGroupsCount} com +1 pacote
              </span>
            )}
          </button>

          <button
            onClick={() => setViewMode('all')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              viewMode === 'all'
                ? 'bg-slate-950 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className={`w-3.5 h-3.5 ${viewMode === 'all' ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span>Todos os Pacotes ({street.packages.length})</span>
          </button>
        </div>
      )}

      {/* Add Number/Package Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddPackage}
          className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-emerald-500 shadow-md space-y-3 animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              Adicionar Entrega na {street.name}
            </h4>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                Nº da Casa / Prédio *
              </label>
              <div className="relative">
                <Home className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Ex: 142, 48, 563"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none text-sm font-bold text-slate-900"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                Complemento (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Casa 2, Apto 302, Fundos"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none text-sm font-medium text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                Nome do Morador / Pessoa
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Ex: Maria Oliveira"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none text-sm text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black text-xs text-white shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </form>
      )}

      {/* Empty State */}
      {street.packages.length === 0 && (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Home className="w-8 h-8" />
          </div>
          <h4 className="font-black text-slate-900 text-base">Nenhum número cadastrado nesta rua</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Coloque os números das casas com complemento se tiver e o nome da pessoa para o app organizar para você!
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Adicionar Primeiro Número
          </button>
        </div>
      )}

      {/* Packages/Numbers List */}
      {street.packages.length > 0 && (
        <div className="space-y-3">
          {viewMode === 'grouped' ? (
            groupedPackageList.map(([houseNum, pkgs]) => {
              if (pkgs.length > 1) {
                return (
                  <GroupedHouseCard
                    key={houseNum}
                    houseNum={houseNum}
                    packages={pkgs}
                    user={user}
                    street={street}
                    onDeliverPackage={(pkg) => setDeliveryModalPkg(pkg)}
                    onDeliverAllInGroup={(hNum, pList) =>
                      setGroupPortariaModalData({ houseNum: hNum, packages: pList })
                    }
                    onFailPackage={(pkg) => {
                      setFailedModalPkg(pkg);
                      setFailReason('Morador Ausente');
                    }}
                    onResetPackage={(pkgId) => handleResetPackage(pkgId)}
                    onDeletePackage={(pkgId) => handleDeletePackage(pkgId)}
                    whatsappPhone={defaultWhatsAppPhone}
                  />
                );
              }

              const pkg = pkgs[0];
              const isDelivered = pkg.status === 'delivered';
              const isFailed = pkg.status === 'failed';

              return (
                <div
                  key={pkg.id}
                  className={`p-4 rounded-3xl border-2 transition-all shadow-xs ${
                    isDelivered
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : isFailed
                      ? 'bg-red-50/70 border-red-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Left info */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black shadow-xs shrink-0 ${
                          isDelivered
                            ? 'bg-emerald-600 text-white'
                            : isFailed
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-900 text-white'
                        }`}
                      >
                        <span className="text-[9px] uppercase text-white/80 leading-none">Nº</span>
                        <span className="text-sm font-black truncate max-w-[44px] text-center">
                          {pkg.houseNumber}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-slate-900 text-base leading-snug">
                            {pkg.recipientName || 'Morador'}
                          </h4>

                          {pkg.complement && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {pkg.complement}
                            </span>
                          )}

                          {isDelivered && (
                            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Entregue
                            </span>
                          )}

                          {isFailed && (
                            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-red-200 text-red-900 border border-red-300 flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              {pkg.failureReason || 'Insucesso'}
                            </span>
                          )}
                        </div>

                        {isDelivered && pkg.deliveredTo && (
                          <p className="text-xs text-emerald-800 font-bold mt-1">
                            🤝 {pkg.deliveredTo}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-2">
                      {!isDelivered ? (
                        <>
                          <button
                            onClick={() => setDeliveryModalPkg(pkg)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>✅ Entregar</span>
                          </button>

                          <button
                            onClick={() => {
                              setFailedModalPkg(pkg);
                              setFailReason('Morador Ausente');
                            }}
                            className="px-2.5 py-2 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-all cursor-pointer"
                            title="Marcar como Ausente / Não entregue"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <CopyItemButton
                            userName={user.name}
                            streetName={street.name}
                            pkg={pkg}
                          />
                          <button
                            onClick={() => handleSendSingleProof(pkg)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-xs shadow-xs cursor-pointer"
                            title="Abrir no WhatsApp"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Zap</span>
                          </button>

                          <button
                            onClick={() => handleResetPackage(pkg.id)}
                            className="p-2 rounded-2xl border border-slate-300 text-slate-500 hover:bg-slate-100 cursor-pointer"
                            title="Desfazer"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDeletePackage(pkg.id)}
                        className="p-2 rounded-2xl text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="space-y-2.5">
              {street.packages.map((pkg) => {
                const isDelivered = pkg.status === 'delivered';
                const isFailed = pkg.status === 'failed';

                return (
                  <div
                    key={pkg.id}
                    className={`p-4 rounded-3xl border-2 transition-all shadow-xs ${
                      isDelivered
                        ? 'bg-emerald-50/70 border-emerald-300'
                        : isFailed
                        ? 'bg-red-50/70 border-red-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Left info */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black shadow-xs shrink-0 ${
                            isDelivered
                              ? 'bg-emerald-600 text-white'
                              : isFailed
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          <span className="text-[9px] uppercase text-white/80 leading-none">Nº</span>
                          <span className="text-sm font-black truncate max-w-[44px] text-center">
                            {pkg.houseNumber}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-slate-900 text-base leading-snug">
                              {pkg.recipientName || 'Morador'}
                            </h4>

                            {pkg.complement && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                {pkg.complement}
                              </span>
                            )}

                            {isDelivered && (
                              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Entregue
                              </span>
                            )}

                            {isFailed && (
                              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-red-200 text-red-900 border border-red-300 flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                {pkg.failureReason || 'Insucesso'}
                              </span>
                            )}
                          </div>

                          {isDelivered && pkg.deliveredTo && (
                            <p className="text-xs text-emerald-800 font-bold mt-1">
                              🤝 {pkg.deliveredTo}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div className="flex items-center gap-2">
                        {!isDelivered ? (
                          <>
                            <button
                              onClick={() => setDeliveryModalPkg(pkg)}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>✅ Entregar</span>
                            </button>

                            <button
                              onClick={() => {
                                setFailedModalPkg(pkg);
                                setFailReason('Morador Ausente');
                              }}
                              className="px-2.5 py-2 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-all cursor-pointer"
                              title="Marcar como Ausente / Não entregue"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <CopyItemButton
                              userName={user.name}
                              streetName={street.name}
                              pkg={pkg}
                            />
                            <button
                              onClick={() => handleSendSingleProof(pkg)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-xs shadow-xs cursor-pointer"
                              title="Abrir no WhatsApp"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Zap</span>
                            </button>

                            <button
                              onClick={() => handleResetPackage(pkg.id)}
                              className="p-2 rounded-2xl border border-slate-300 text-slate-500 hover:bg-slate-100 cursor-pointer"
                              title="Desfazer"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handleDeletePackage(pkg.id)}
                          className="p-2 rounded-2xl text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Delivery with Hierarchical Options and Address Memory */}
      {deliveryModalPkg && (
        <DeliveryConfirmModal
          isOpen={!!deliveryModalPkg}
          onClose={() => setDeliveryModalPkg(null)}
          user={user}
          street={street}
          pkg={deliveryModalPkg}
          defaultWhatsAppPhone={defaultWhatsAppPhone}
          onConfirm={handleConfirmPackageDelivery}
        />
      )}

      {/* Group Portaria / Condominium Delivery Modal */}
      {groupPortariaModalData && (
        <GroupPortariaConfirmModal
          isOpen={!!groupPortariaModalData}
          onClose={() => setGroupPortariaModalData(null)}
          user={user}
          street={street}
          houseNumber={groupPortariaModalData.houseNum}
          packages={groupPortariaModalData.packages}
          defaultWhatsAppPhone={defaultWhatsAppPhone}
          onConfirmGroupDelivery={handleBatchDeliverGroup}
        />
      )}

      {/* Street Memory Modal (Caderno de Casas & Moradores Salvos) */}
      {showStreetMemoryModal && (
        <StreetMemoryModal
          isOpen={showStreetMemoryModal}
          onClose={() => setShowStreetMemoryModal(false)}
          user={user}
          street={street}
          onAddPackagesToStreet={(newPkgs) => {
            onUpdateStreet({
              ...street,
              packages: [...street.packages, ...newPkgs],
              isCompleted: false,
            });
          }}
        />
      )}

      {/* Money Reward Celebration Toast ("Dinheiro na Conta!") */}
      <MoneyCelebrationToast
        event={moneyToastEvent}
        onDismiss={() => setMoneyToastEvent(null)}
      />

      {/* Failure Reason Modal */}
      {failedModalPkg && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-red-600 text-white p-5">
              <h3 className="font-black text-lg">Registrar Insucesso / Ausente</h3>
              <p className="text-xs text-red-100">
                Nº {failedModalPkg.houseNumber} • {street.name}
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Motivo:
                </label>
                <div className="space-y-2">
                  {[
                    'Morador Ausente / Ninguém Atende',
                    'Endereço Não Localizado / Nº Inexistente',
                    'Encomenda Recusada',
                    'Sem Acesso ao Portão / Cão Bravo',
                  ].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setFailReason(reason)}
                      className={`w-full p-3 rounded-2xl border-2 font-bold text-xs text-left cursor-pointer ${
                        failReason === reason
                          ? 'border-red-600 bg-red-50 text-red-900'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFailedModalPkg(null)}
                className="flex-1 py-3 px-4 rounded-2xl border border-slate-300 font-bold text-slate-700 text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmFailed}
                className="flex-1 py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm cursor-pointer"
              >
                Salvar Insucesso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CopyItemButton: React.FC<{ userName: string; streetName: string; pkg: StreetPackage }> = ({
  userName,
  streetName,
  pkg,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = formatDeliveryWhatsAppMessage(userName, streetName, pkg);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-2xs transition-all cursor-pointer ${
        copied
          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
      }`}
      title="Copiar texto formatado"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{copied ? 'Copiado!' : 'Copiar'}</span>
    </button>
  );
};

