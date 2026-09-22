import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Plus,
  X,
  Check,
  Trash2,
  Edit2,
  Package,
  Clock,
  CheckCircle2,
  Sparkles,
  Search,
  Layers,
  ArrowRight,
  Compass,
  Navigation,
  CheckSquare,
  Square
} from 'lucide-react';
import { DeliveryData } from '../types';
import {
  CAJU_PRIMARY_AREAS,
  MANILHA_SUB_STREETS,
  getStreetInfo,
} from '../data/cajuStreets';
import { contarPacotes, ehAreaManilha, pacotesDaRua, ruasDosPacotes } from '../domain/ruas';

interface RegionStreetsModalProps {
  isOpen: boolean;
  activeStreet: string;
  savedStreets: string[];
  deliveries: DeliveryData[];
  onClose: () => void;
  onSelectStreet: (street: string) => void;
  onAddStreet: (streetName: string) => void;
  onDeleteStreet: (streetName: string) => void;
  onRenameStreet: (oldName: string, newName: string) => void;
}

export const RegionStreetsModal: React.FC<RegionStreetsModalProps> = ({
  isOpen,
  activeStreet,
  savedStreets,
  deliveries,
  onClose,
  onSelectStreet,
  onAddStreet,
  onDeleteStreet,
  onRenameStreet,
}) => {
  const [newStreetName, setNewStreetName] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [editingStreet, setEditingStreet] = useState<string | null>(null);
  const [editNameInput, setEditNameInput] = useState('');

  // Unifica todas as ruas principais do Caju disponíveis para o entregador selecionar para hoje
  const availablePrimaryStreets = useMemo(() => {
    const map = new Map<string, string>();

    // 1. Áreas principais do Caju (incluindo Manilha unificada)
    CAJU_PRIMARY_AREAS.forEach((st) => {
      map.set(st.toLowerCase().trim(), st);
    });

    // 2. Ruas salvas no LocalStorage / State
    savedStreets.forEach((st) => {
      const clean = st?.trim();
      if (clean && !map.has(clean.toLowerCase())) {
        map.set(clean.toLowerCase(), clean);
      }
    });

    // 3. Ruas com pacotes (se não for sub-rua da Manilha)
    ruasDosPacotes(deliveries).forEach((st) => {
      if (!map.has(st.toLowerCase())) map.set(st.toLowerCase(), st);
    });

    return Array.from(map.values());
  }, [savedStreets, deliveries]);

  // Calcula estatísticas de pacotes por rua (mesma contagem de todas as outras telas)
  const getStreetStats = (street: string) => {
    const c = contarPacotes(pacotesDaRua(deliveries, street));
    return { total: c.total, delivered: c.entregues, insucesso: c.insucessos, pending: c.pendentes, isManilha: ehAreaManilha(street) };
  };

  // Filtra as ruas pela busca
  const filteredStreets = useMemo(() => {
    if (!searchFilter.trim()) return availablePrimaryStreets;
    const q = searchFilter.toLowerCase().trim();
    return availablePrimaryStreets.filter((st) => {
      const info = getStreetInfo(st);
      return (
        st.toLowerCase().includes(q) ||
        info.sector.toLowerCase().includes(q) ||
        info.description.toLowerCase().includes(q)
      );
    });
  }, [availablePrimaryStreets, searchFilter]);

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStreetName.trim()) return;
    const clean = newStreetName.trim();
    onAddStreet(clean);
    onSelectStreet(clean);
    setNewStreetName('');
    onClose();
  };

  const handleStartEdit = (st: string) => {
    setEditingStreet(st);
    setEditNameInput(st);
  };

  const handleSaveEdit = (oldName: string) => {
    if (editNameInput.trim() && editNameInput.trim() !== oldName) {
      onRenameStreet(oldName, editNameInput.trim());
    }
    setEditingStreet(null);
  };

  const handleToggleIncludeToday = (street: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCurrentlySaved = savedStreets.some((s) => s.toLowerCase() === street.toLowerCase());
    if (isCurrentlySaved) {
      // Se não for a única rua, remove das ruas de hoje
      if (savedStreets.length > 1) {
        onDeleteStreet(street);
      }
    } else {
      onAddStreet(street);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-800 flex flex-col max-h-[92vh] pb-safe">

        {/* TOPO DO MODAL */}
        <div className="bg-slate-950 text-white p-4 pb-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-white leading-tight">
                Ruas do Caju para Hoje
              </h2>
              <p className="text-[11px] text-slate-400">
                Selecione as ruas e a Manilha que você está atendendo hoje
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BUSCA RÁPIDA */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar rua do Caju ou Manilha..."
              className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-bold px-0.5">
            💡 Marque no botão <span className="text-emerald-400">"Hoje"</span> para fixar a rua na barra rápida do topo.
          </p>
        </div>

        {/* LISTAGEM DE RUAS DO CAJU & MANILHA */}
        <div className="p-3.5 space-y-2.5 overflow-y-auto flex-1 bg-slate-950/30">
          {filteredStreets.length > 0 ? (
            filteredStreets.map((street, idx) => {
              const isActive = activeStreet.toLowerCase() === street.toLowerCase();
              const isEditing = editingStreet === street;
              const stats = getStreetStats(street);
              const info = getStreetInfo(street);
              const isPreset = CAJU_PRIMARY_AREAS.some((s) => s.toLowerCase() === street.toLowerCase());
              const isIncludedToday = savedStreets.some((s) => s.toLowerCase() === street.toLowerCase());
              const isManilha = street.toLowerCase() === 'manilha' || street.toLowerCase().includes('manilha');

              return (
                <div
                  key={`street-item-${street}-${idx}`}
                  className={`rounded-2xl border transition-all p-3 flex items-center justify-between gap-2.5 ${
                    isActive
                      ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/30'
                      : isManilha
                      ? 'bg-amber-400/5 border-amber-400/40 hover:border-amber-400/70'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        value={editNameInput}
                        onChange={(e) => setEditNameInput(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-emerald-500 rounded-lg text-xs font-bold text-slate-100 focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(street)}
                        className="p-1.5 bg-emerald-600 text-white rounded-lg cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingStreet(null)}
                        className="p-1.5 bg-slate-800 text-slate-300 rounded-lg cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* BOTÃO PRINCIPAL DE SELEÇÃO RÁPIDA COM 1 TOQUE */}
                      <button
                        onClick={() => {
                          onAddStreet(street);
                          onSelectStreet(street);
                          onClose();
                        }}
                        className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                      >
                        <div
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 font-black ${
                            isActive
                              ? 'bg-emerald-600 text-white'
                              : isManilha
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {isActive ? (
                            <Check className="w-5 h-5" />
                          ) : isManilha ? (
                            <Navigation className="w-4 h-4" />
                          ) : (
                            <MapPin className="w-4 h-4" />
                          )}
                        </div>

                        <div className="truncate flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-xs font-black truncate ${
                                isActive ? 'text-emerald-300' : 'text-slate-100'
                              }`}
                            >
                              {street}
                            </span>
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md border ${info.badgeColor}`}>
                              {info.sector}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold mt-0.5">
                            <span className="font-medium truncate max-w-[140px] xs:max-w-[190px]">
                              {isManilha ? 'Inclui Leão XIII, Canal, Penha e Letras A a K' : info.description}
                            </span>
                            <span>•</span>
                            {stats.total > 0 ? (
                              <span className={stats.pending > 0 ? 'text-amber-400 font-black' : 'text-emerald-400 font-black'}>
                                {stats.total} pct ({stats.delivered} ok{stats.insucesso > 0 ? `, ${stats.insucesso} falhas` : ''})
                              </span>
                            ) : (
                              <span className="text-slate-500">0 pacotes</span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* AÇÕES: MARCAR NA ROTA DE HOJE E ATENDER */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Botão de Fixar / Desfixar na Rota de Hoje */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleIncludeToday(street, e)}
                          className={`p-1.5 rounded-xl border text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                            isIncludedToday
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                          }`}
                          title={isIncludedToday ? 'Rua fixada no topo' : 'Fixar no topo para hoje'}
                        >
                          {isIncludedToday ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span className="hidden xs:inline">Hoje</span>
                        </button>

                        {isActive ? (
                          <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl">
                            Ativa
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              onAddStreet(street);
                              onSelectStreet(street);
                              onClose();
                            }}
                            className="bg-slate-100 hover:bg-white active:scale-95 text-slate-950 text-[11px] font-black px-2.5 py-1.5 rounded-xl cursor-pointer transition-all"
                          >
                            Atender
                          </button>
                        )}

                        {!isPreset && (
                          <>
                            <button
                              onClick={() => handleStartEdit(street)}
                              className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Renomear Rua"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteStreet(street)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
                              title="Remover rua"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 text-center space-y-2">
              <p className="text-xs text-slate-400 font-bold">
                Nenhuma rua encontrada no Caju com "{searchFilter}".
              </p>
              <button
                onClick={() => {
                  if (searchFilter.trim()) {
                    onAddStreet(searchFilter.trim());
                    onSelectStreet(searchFilter.trim());
                    setSearchFilter('');
                    onClose();
                  }
                }}
                className="px-3 py-2 bg-emerald-600 text-white font-black text-xs rounded-xl cursor-pointer hover:bg-emerald-500"
              >
                + Adicionar "{searchFilter}" no Caju
              </button>
            </div>
          )}
        </div>

        {/* FORMULÁRIO RÁPIDO PARA ADICIONAR OUTRA RUA */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
          <form onSubmit={handleAddNew} className="flex items-center gap-2">
            <input
              type="text"
              value={newStreetName}
              onChange={(e) => setNewStreetName(e.target.value)}
              placeholder="Cadastrar outra rua do Caju..."
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700/80 focus:border-emerald-500 rounded-xl text-xs font-bold text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newStreetName.trim()}
              className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
