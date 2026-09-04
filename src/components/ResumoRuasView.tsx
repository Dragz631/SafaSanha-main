import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  ChevronRight,
  Plus,
  ListPlus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Sparkles,
  History,
  Flag,
  BookOpen,
} from 'lucide-react';
import { UserProfile, UserStreet, DayHistoryRecord } from '../types';
import {
  formatDaySummaryWhatsAppMessage,
  openWhatsApp,
  copyToClipboard,
  getStreetSavedAddresses,
} from '../lib/userStorage';
import { BulkStreetImportModal } from './BulkStreetImportModal';
import { FailuresListModal } from './FailuresListModal';
import { EndOfDayModal } from './EndOfDayModal';
import { HistoryModal } from './HistoryModal';
import { StreetMemoryModal } from './StreetMemoryModal';

interface ResumoRuasViewProps {
  user: UserProfile;
  streets: UserStreet[];
  whatsappPhone?: string;
  onSelectStreet: (street: UserStreet) => void;
  onAddStreet: (street: UserStreet) => void;
  onImportStreets: (streets: UserStreet[]) => void;
  onResetPackage: (streetId: string, pkgId: string) => void;
  onUpdateAllStreets?: (streets: UserStreet[]) => void;
}

export const ResumoRuasView: React.FC<ResumoRuasViewProps> = ({
  user,
  streets,
  whatsappPhone,
  onSelectStreet,
  onAddStreet,
  onImportStreets,
  onResetPackage,
  onUpdateAllStreets,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showFailuresModal, setShowFailuresModal] = useState(false);
  const [showEndOfDayModal, setShowEndOfDayModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [activeMemoryModalStreet, setActiveMemoryModalStreet] = useState<UserStreet | null>(null);
  const [newStreetName, setNewStreetName] = useState('');
  const [newStreetNeighborhood, setNewStreetNeighborhood] = useState('');

  // Live dynamic Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setCurrentTime(`${dateStr} às ${timeStr}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Calculate Metrics
  const totalStreets = streets.length;
  const completedStreets = streets.filter((s) => s.isCompleted).length;

  let totalPackages = 0;
  let deliveredPackages = 0;
  let failedPackages = 0;

  streets.forEach((s) => {
    totalPackages += s.packages.length;
    deliveredPackages += s.packages.filter((p) => p.status === 'delivered').length;
    failedPackages += s.packages.filter((p) => p.status === 'failed').length;
  });

  const pendingPackages = totalPackages - deliveredPackages - failedPackages;
  const isAllResolved = totalPackages > 0 && pendingPackages === 0;
  const progressPercent = totalPackages > 0 ? Math.round((deliveredPackages / totalPackages) * 100) : 0;

  // Send WhatsApp Daily Summary
  const handleSendWhatsApp = () => {
    const message = formatDaySummaryWhatsAppMessage(user.name, streets);
    openWhatsApp(message, whatsappPhone);
  };

  // Copy Summary to Clipboard
  const handleCopySummary = async () => {
    const message = formatDaySummaryWhatsAppMessage(user.name, streets);
    const success = await copyToClipboard(message);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Add single street
  const handleCreateSingleStreet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStreetName.trim()) return;

    const newStreet: UserStreet = {
      id: `street_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newStreetName.trim(),
      neighborhood: newStreetNeighborhood.trim() || undefined,
      order: streets.length + 1,
      isCompleted: false,
      packages: [],
      createdAt: new Date().toISOString(),
    };

    onAddStreet(newStreet);
    setNewStreetName('');
    setNewStreetNeighborhood('');
    setShowAddModal(false);
  };

  // Re-attempt multiple packages from EndOfDayModal
  const handleReattemptMultiplePackages = (packagesToReset: { streetId: string; pkgId: string }[]) => {
    packagesToReset.forEach(({ streetId, pkgId }) => {
      onResetPackage(streetId, pkgId);
    });
  };

  // Day finalized callback
  const handleDayFinalized = (updatedStreets: UserStreet[], newRecord: DayHistoryRecord) => {
    if (onUpdateAllStreets) {
      onUpdateAllStreets(updatedStreets);
    }
    alert(`🎉 Dia finalizado com sucesso! O relatório foi salvo no seu histórico de entregas.`);
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 space-y-4 animate-fadeIn">
      {/* 1. Painel Principal (Resumo Geral das Rotas) */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        {/* Date, Time and History Button */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{currentTime || 'Carregando data...'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="h-9 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-extrabold text-xs transition-all cursor-pointer flex items-center gap-1.5 touch-manipulation border border-slate-200/60 dark:border-slate-700/60"
            >
              <History className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Ver Histórico</span>
            </button>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-extrabold hidden sm:inline">
              {user.name}
            </span>
          </div>
        </div>

        {/* Progress Bar with X% CONCLUÍDO */}
        <div className="space-y-1.5 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-black">
            <span className="text-slate-900 dark:text-slate-100 uppercase tracking-wide">
              {progressPercent}% Concluído
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">
              {deliveredPackages} de {totalPackages} pacotes
            </span>
          </div>
          <div className="w-full bg-slate-200/80 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex shadow-inner">
            <div
              className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 4 Blocos de Métricas / Contadores em Linha */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 pt-0.5">
          {/* 1. Total */}
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-center space-y-0.5">
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">{totalPackages}</div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total</div>
          </div>

          {/* 2. Entregas */}
          <div className="p-3 sm:p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 text-center space-y-0.5">
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{deliveredPackages}</div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Entregues</div>
          </div>

          {/* 3. Pendentes */}
          <div className="p-3 sm:p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 text-center space-y-0.5">
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">{pendingPackages}</div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Pendentes</div>
          </div>

          {/* 4. Falhas - CLICÁVEL */}
          <button
            type="button"
            onClick={() => setShowFailuresModal(true)}
            className="p-3 sm:p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/30 border border-rose-200/70 dark:border-rose-800/40 text-center space-y-0.5 transition-all cursor-pointer touch-manipulation group active:scale-95"
            title="Clique para ver a lista de ruas e motivos dos insucessos"
          >
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
              {failedPackages}
            </div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center justify-center gap-1">
              <span>Falhas</span>
              {failedPackages > 0 && <span className="text-[9px] font-black underline">ver</span>}
            </div>
          </button>
        </div>
      </section>

      {/* 2. Destaque Especial: Finalizar Dia (Aparece quando 100% / pendentes resolvidos ou a qualquer hora) */}
      {isAllResolved ? (
        <section className="bg-slate-900 dark:bg-slate-950 text-white rounded-3xl p-5 sm:p-6 border-2 border-emerald-500/60 shadow-lg space-y-3 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-400/30 shrink-0">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  Todas as Entregas do Dia Concluídas
                </span>
                <h3 className="text-lg sm:text-xl font-black">
                  {failedPackages > 0
                    ? `${deliveredPackages} entregues e ${failedPackages} insucessos`
                    : '100% Entregue com Sucesso!'}
                </h3>
              </div>
            </div>

            <button
              onClick={() => setShowEndOfDayModal(true)}
              className="h-12 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer touch-manipulation"
            >
              <Flag className="w-4 h-4 stroke-[3]" />
              <span>Finalizar Dia & Enviar Resumo</span>
            </button>
          </div>
        </section>
      ) : (
        /* Seção de Prestação de Contas Padrão */
        <section className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Relatório WhatsApp</span>
            </h3>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEndOfDayModal(true)}
                className="h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-750 text-emerald-400 font-extrabold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 touch-manipulation"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Finalizar Dia</span>
              </button>

              <button
                onClick={handleCopySummary}
                className={`h-9 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 touch-manipulation ${
                  copied
                    ? 'bg-emerald-500 text-slate-950 font-black'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Botão de Destaque Verde (Mobile-First Touch) */}
          <button
            onClick={handleSendWhatsApp}
            className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-black text-sm sm:text-base shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            <Share2 className="w-5 h-5" />
            <span>Enviar Resumo do Dia no WhatsApp</span>
          </button>
        </section>
      )}

      {/* 3. Lista de Ruas Registradas */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100 tracking-tight">
              RUAS REGISTRADAS ({totalStreets})
            </h3>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              • {completedStreets} concluídas
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkModal(true)}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer flex items-center gap-1.5 touch-manipulation"
            >
              <ListPlus className="w-3.5 h-3.5 text-amber-500" />
              <span>Colar Lista</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-xs cursor-pointer flex items-center gap-1 touch-manipulation"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Nova Rua</span>
            </button>
          </div>
        </div>

        {/* Empty Streets State */}
        {streets.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800/50">
              <Plus className="w-6 h-6" />
            </div>
            <h4 className="font-black text-slate-900 dark:text-slate-100 text-base">Nenhuma rua cadastrada</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Cadastre suas ruas uma por uma ou cole uma lista completa para começar suas entregas de hoje!
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-xs cursor-pointer"
              >
                + Cadastrar Rua
              </button>
              <button
                onClick={() => setShowBulkModal(true)}
                className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-750 text-white font-black text-xs shadow-xs cursor-pointer"
              >
                Colar Lista em Lote
              </button>
            </div>
          </div>
        )}

        {/* Street Cards List (Mobile-First Touch & Dark/Light Styling) */}
        <div className="space-y-2.5">
          {streets.map((street) => {
            const sTotal = street.packages.length;
            const sDelivered = street.packages.filter((p) => p.status === 'delivered').length;
            const sFailed = street.packages.filter((p) => p.status === 'failed').length;
            const sPending = sTotal - sDelivered - sFailed;
            const isCompleted = street.isCompleted || (sTotal > 0 && sPending === 0);

            return (
              <div
                key={street.id}
                onClick={() => onSelectStreet(street)}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs hover:shadow-sm touch-manipulation active:scale-[0.99] ${
                  isCompleted
                    ? 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-500/40 hover:border-emerald-500'
                    : sDelivered > 0
                    ? 'bg-white dark:bg-slate-900 border-sky-300 dark:border-sky-500/40 hover:border-sky-400'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${
                      isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : sDelivered > 0
                        ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {isCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : <Clock className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-black text-slate-900 dark:text-slate-100 text-base leading-snug truncate">
                        {street.name}
                      </h4>
                      {isCompleted && (
                        <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Concluída
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {street.neighborhood ? `${street.neighborhood} • ` : ''}
                      <strong className="text-slate-800 dark:text-slate-200">{sDelivered}</strong>/{sTotal} entregues
                      {sFailed > 0 && (
                        <span className="text-rose-500 font-bold ml-1.5">• {sFailed} falha(s)</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMemoryModalStreet(street);
                    }}
                    className="h-8 px-2.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 text-amber-900 dark:text-amber-300 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-all border border-amber-400/30 touch-manipulation active:scale-95"
                    title="Ver casas salvas na memória desta rua"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="hidden sm:inline">Casas Salvas</span>
                    <span className="sm:hidden">Memória</span>
                  </button>

                  <div className="text-right hidden sm:block">
                    <span className="text-xs font-mono font-black text-slate-900 dark:text-slate-100">
                      {sTotal > 0 ? Math.round((sDelivered / sTotal) * 100) : 0}%
                    </span>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase">Taxa</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal Nova Rua */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-slate-950 text-white p-5 border-b border-slate-800">
              <h3 className="font-black text-lg">Adicionar Nova Rua</h3>
              <p className="text-xs text-slate-400">
                Cadastrar rua para {user.name}
              </p>
            </div>

            <form onSubmit={handleCreateSingleStreet} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Nome da Rua *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Rua Carlos Seidl, Rua Conde de Leopoldina..."
                  value={newStreetName}
                  onChange={(e) => setNewStreetName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Bairro ou Região (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Caju, Centro..."
                  value={newStreetNeighborhood}
                  onChange={(e) => setNewStreetNeighborhood(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-medium text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer shadow-sm"
                >
                  Salvar Rua
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Insucessos / Falhas */}
      <FailuresListModal
        isOpen={showFailuresModal}
        onClose={() => setShowFailuresModal(false)}
        user={user}
        streets={streets}
        whatsappPhone={whatsappPhone}
        onResetPackage={onResetPackage}
      />

      {/* Modal Fechamento do Dia */}
      <EndOfDayModal
        isOpen={showEndOfDayModal}
        onClose={() => setShowEndOfDayModal(false)}
        user={user}
        streets={streets}
        whatsappPhone={whatsappPhone}
        onDayFinalized={handleDayFinalized}
        onReattemptPackages={handleReattemptMultiplePackages}
      />

      {/* Modal Histórico de Dias Anteriores */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        user={user}
        whatsappPhone={whatsappPhone}
      />

      {/* Modal Importação em Lote */}
      <BulkStreetImportModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onImport={(imported) => {
          onImportStreets(imported);
          setShowBulkModal(false);
        }}
      />

      {/* Street Memory Modal para Rua Selecionada */}
      {activeMemoryModalStreet && (
        <StreetMemoryModal
          isOpen={!!activeMemoryModalStreet}
          onClose={() => setActiveMemoryModalStreet(null)}
          user={user}
          street={activeMemoryModalStreet}
          onAddPackagesToStreet={(newPkgs) => {
            const updated = streets.map((s) => {
              if (s.id === activeMemoryModalStreet.id) {
                return {
                  ...s,
                  packages: [...s.packages, ...newPkgs],
                  isCompleted: false,
                };
              }
              return s;
            });
            if (onUpdateAllStreets) {
              onUpdateAllStreets(updated);
            }
          }}
        />
      )}
    </div>
  );
};
