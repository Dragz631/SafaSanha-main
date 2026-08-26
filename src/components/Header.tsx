import React from 'react';
import { Package, MapPin, CheckCircle2, Clock, Plus, AlertTriangle, TrendingUp, Users, Truck } from 'lucide-react';

interface HeaderProps {
  activeStreet: string;
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
  activeTab = 'ruas',
  onTabChange,
  onOpenStreetPicker,
  onOpenAddStreet,
  pendingCount,
  totalCount,
  deliveredCount,
  insucessoCount = 0,
  totalAllDeliveries = 0,
}) => {
  return (
    <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md border-b border-slate-800">
      <div className="max-w-xl mx-auto px-3.5 pt-2.5 pb-2">
        <div className="flex items-center justify-between gap-2">
          {/* Logo & Nome */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight text-white">LogiScan</span>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase">
                  Zap Pronto
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate max-w-[170px] xs:max-w-[220px]">
                Portaria, Associação e Relatório WhatsApp
              </p>
            </div>
          </div>

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

        {/* Barra de Rua Ativa com Toque Rápido (Exibida quando na aba de Ruas) */}
        {activeTab === 'ruas' && (
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-2">
            <button
              onClick={onOpenStreetPicker}
              className="flex items-center gap-1.5 text-left flex-1 min-w-0 bg-slate-800 hover:bg-slate-700/90 active:scale-[0.99] px-2.5 py-1.5 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="truncate flex-1">
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider leading-none mb-0.5">
                  Rua em Atendimento
                </span>
                <span className="text-xs font-black text-white truncate block">
                  {activeStreet}
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0 border border-emerald-500/20">
                Trocar Rua
              </span>
            </button>

            <button
              onClick={onOpenAddStreet || onOpenStreetPicker}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-2 rounded-xl text-xs font-black flex items-center gap-1 shrink-0 cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              title="Cadastrar Nova Rua na Região"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[11px]">+ Rua</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
