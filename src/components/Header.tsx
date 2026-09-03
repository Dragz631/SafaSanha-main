import React from 'react';
import { Package, CheckCircle2, Clock, AlertTriangle, TrendingUp, Users, Truck, Sun, Moon } from 'lucide-react';
import { getStreetInfo } from '../data/cajuStreets';

interface HeaderProps {
  activeStreet: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  activeTab?: 'ruas' | 'resumo' | 'associacao';
  onTabChange?: (tab: 'ruas' | 'resumo' | 'associacao') => void;
  onOpenStreetPicker?: () => void;
  onOpenAddStreet?: () => void;
  pendingCount: number;
  totalCount: number;
  deliveredCount: number;
  insucessoCount?: number;
  totalAllDeliveries?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeStreet,
  theme = 'light',
  onToggleTheme,
  activeTab = 'ruas',
  onTabChange,
  pendingCount,
  totalCount,
  deliveredCount,
  insucessoCount = 0,
}) => {
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
    </header>
  );
};
