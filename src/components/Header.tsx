import React, { useState, useEffect } from 'react';
import { Package, CheckCircle2, Clock, AlertTriangle, TrendingUp, Users, Truck, Sun, Moon, Cloud, RefreshCw, X, Server, Wifi } from 'lucide-react';
import { getStreetInfo } from '../data/cajuStreets';
import { subscribeSyncStatus, triggerSync, getSafasanhasoUrl, setSafasanhasoUrl } from '../services/safasanhasoClient';

interface HeaderProps {
  activeStreet: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  activeTab?: 'ruas' | 'resumo' | 'associacao';
  onTabChange?: (tab: 'ruas' | 'resumo' | 'associacao') => void;
  onOpenStreetPicker?: () => void;
  onOpenDailyStreetPicker?: () => void;
  onOpenAddStreet?: () => void;
  pendingCount: number;
  totalCount: number;
  deliveredCount: number;
  insucessoCount?: number;
  totalAllDeliveries?: number;
  coinsToday?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeStreet,
  theme = 'light',
  onToggleTheme,
  activeTab = 'ruas',
  onTabChange,
  onOpenDailyStreetPicker,
  pendingCount,
  totalCount,
  deliveredCount,
  insucessoCount = 0,
  coinsToday = 0,
}) => {
  const [syncInfo, setSyncInfo] = useState<{ isOnline: boolean; pendingCount: number; lastSyncTime?: string }>({
    isOnline: true,
    pendingCount: 0,
  });
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(() => getSafasanhasoUrl());
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeSyncStatus((status) => {
      setSyncInfo(status);
    });
    return unsub;
  }, []);

  const handleManualSync = async () => {
    setIsSyncingNow(true);
    setSyncFeedback(null);
    try {
      const res = await triggerSync();
      if (res.sent > 0) {
        setSyncFeedback(`✓ ${res.sent} entrega(s) enviada(s) para o SafaSanhaso!`);
      } else if (res.remaining === 0) {
        setSyncFeedback('✓ Tudo sincronizado com o SafaSanhaso!');
      } else {
        setSyncFeedback(`⚠️ PC inacessível no momento. ${res.remaining} entrega(s) guardada(s) com segurança no celular.`);
      }
    } catch (_e) {
      setSyncFeedback('⚠️ Erro ao tentar conectar. Os dados continuam 100% seguros no celular.');
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleSaveServerUrl = () => {
    setSafasanhasoUrl(serverUrlInput);
    handleManualSync();
  };

  return (
    <header className="bg-slate-900 dark:bg-slate-950 text-white sticky top-0 z-30 shadow-sm border-b border-slate-800 transition-colors duration-200">
      <div className="max-w-xl mx-auto px-3.5 pt-2.5 pb-2">
        <div className="flex items-center justify-between gap-2">
          {/* Logo & Nome */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight text-white">SafaSanha</span>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase">
                  Zap Pronto
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate max-w-[170px] xs:max-w-[220px]">
                Organizador de Rota e WhatsApp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* BADGE SAFASANHASO (STATUS DE SINCRONIZAÇÃO EM TEMPO REAL) */}
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[11px] font-black cursor-pointer touch-manipulation transition-all active:scale-95 shrink-0 ${
                syncInfo.pendingCount > 0
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 shadow-xs'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-emerald-400'
              }`}
              title="Status da Conexão com SafaSanhaso (Desktop)"
            >
              <Cloud className="w-3.5 h-3.5" />
              {syncInfo.pendingCount > 0 ? (
                <span className="text-[10px] text-amber-300 font-black">{syncInfo.pendingCount} na fila</span>
              ) : (
                <span className="text-[10px] text-emerald-400 font-bold hidden xs:inline">Desktop OK</span>
              )}
            </button>

            {/* BADGE DE MOEDAS DE OURO DO DIA (2 MOEDAS POR PACOTE ENTREGUE) */}
            <div
              className="flex items-center gap-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-400/40 text-amber-300 px-2 py-1 rounded-xl shrink-0 shadow-xs cursor-default select-none"
              title={`Saldo do Dia: ${coinsToday} moedas de ouro (2 moedas por pacote entregue)`}
            >
              <span className="text-xs leading-none animate-pulse">🪙</span>
              <span className="text-xs font-black text-amber-200">{coinsToday}</span>
              <span className="hidden xs:inline text-[9px] uppercase font-black tracking-tight text-amber-400/90">moedas</span>
            </div>

            {/* BOTÃO QUAL AS RUAS DE HOJE (DO WIREFRAME) */}
            {onOpenDailyStreetPicker && (
              <button
                type="button"
                onClick={onOpenDailyStreetPicker}
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-black cursor-pointer touch-manipulation transition-all active:scale-95 shrink-0"
                title="Qual as ruas de hoje? Abrir seletor 3x3 de ruas da rota"
              >
                <span>🗺️</span>
                <span className="hidden sm:inline">Ruas de Hoje</span>
              </button>
            )}

            {/* Contador de Status */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1 rounded-xl shrink-0">
              {pendingCount > 0 ? (
                <div className="flex items-center gap-1 text-[11px] font-black text-amber-400">
                  <Clock className="w-3 h-3" />
                  <span>{pendingCount} pendentes</span>
                </div>
              ) : insucessoCount > 0 ? (
                <div className="flex items-center gap-1 text-[11px] font-black text-rose-400">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{insucessoCount} falha{insucessoCount > 1 ? 's' : ''}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[11px] font-black text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{totalCount > 0 ? 'Concluído' : '0 pacotes'}</span>
                </div>
              )}
            </div>

            {/* BOTÃO MODO DIA / MODO NOITE */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                title={theme === 'dark' ? 'Mudar para Modo Dia (Claro)' : 'Mudar para Modo Noite (Escuro)'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-300" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* ABAS PRINCIPAIS DE NAVEGAÇÃO */}
        {onTabChange && (
          <div className="grid grid-cols-3 gap-1.5 mt-2 bg-slate-800/90 p-1 rounded-2xl border border-slate-700/80 text-[11px] font-black">
            <button
              onClick={() => onTabChange('ruas')}
              className={`py-1.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'ruas'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Entregas</span>
            </button>

            <button
              onClick={() => onTabChange('resumo')}
              className={`py-1.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'resumo'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Resumo & Ruas</span>
            </button>

            <button
              onClick={() => onTabChange('associacao')}
              className={`py-1.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'associacao'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Associação</span>
            </button>
          </div>
        )}
      </div>

      {/* MODAL DE STATUS & CONEXÃO SAFASANHASO */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn text-slate-900 dark:text-white">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-black">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">SafaSanhaso Desktop</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Logiscan Companion Hub</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* STATUS CARDS */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Fila no Celular:</span>
                <span className={`font-black px-2 py-0.5 rounded-lg ${
                  syncInfo.pendingCount > 0
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {syncInfo.pendingCount} pendente{syncInfo.pendingCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Modo de Operação:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5" /> 100% Offline e Online
                </span>
              </div>
            </div>

            {/* AVISO RESILIENTE (TRANQUILIZA O USUÁRIO A 20KM DO PC) */}
            <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl text-[11px] text-emerald-900 dark:text-emerald-200 space-y-1">
              <span className="font-black block">📱 Ajudante na rua (mesmo a 20km do PC):</span>
              <p className="opacity-90 leading-relaxed">
                Todas as fotos e baixas são salvas <b>instantaneamente no celular</b>. Quando você estiver no mesmo Wi-Fi do PC ou quando houver conexão, tudo é enviado automaticamente sem perder nada!
              </p>
            </div>

            {/* ENDEREÇO DO SERVIDOR */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Endereço IP/URL do SafaSanhaso:
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="http://localhost:4000 ou IP do PC"
                  className="flex-1 h-10 px-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleSaveServerUrl}
                  className="h-10 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-black cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </div>

            {syncFeedback && (
              <p className="text-[11px] font-bold text-center text-emerald-700 dark:text-emerald-300 animate-fadeIn">
                {syncFeedback}
              </p>
            )}

            {/* BOTÃO FORÇAR ENVIO */}
            <button
              type="button"
              disabled={isSyncingNow}
              onClick={handleManualSync}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingNow ? 'animate-spin' : ''}`} />
              <span>{isSyncingNow ? 'Sincronizando...' : 'Sincronizar Agora com o PC'}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
