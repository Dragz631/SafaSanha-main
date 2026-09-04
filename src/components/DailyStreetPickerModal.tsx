import React, { useState, useMemo } from 'react';
import {
  Check,
  CheckCheck,
  X,
  Plus,
  Compass,
  Sparkles,
  MapPin,
  Layers,
  Package,
  Building2,
  Trash2
} from 'lucide-react';
import { DAILY_STREET_CARDS, DailyStreetCardItem } from '../data/cajuStreets';
import { DeliveryData } from '../types';

interface DailyStreetPickerModalProps {
  isOpen: boolean;
  savedStreets: string[];
  deliveries: DeliveryData[];
  onClose: () => void;
  onConfirmStreets: (selectedStreets: string[]) => void;
  onOpenAssociacaoTab?: () => void;
}

export const DailyStreetPickerModal: React.FC<DailyStreetPickerModalProps> = ({
  isOpen,
  savedStreets,
  deliveries,
  onClose,
  onConfirmStreets,
  onOpenAssociacaoTab,
}) => {
  // Estado local dos nomes de ruas selecionados
  const [selectedSet, setSelectedSet] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    savedStreets.forEach((s) => {
      const clean = s.trim();
      if (clean) initial.add(clean.toLowerCase());
    });
    // Se não tiver nenhuma selecionada, por padrão pré-seleciona as principais do wireframe
    if (initial.size === 0) {
      DAILY_STREET_CARDS.forEach((c) => initial.add(c.streetName.toLowerCase()));
    }
    return initial;
  });

  const [customStreetInput, setCustomStreetInput] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  // Sincroniza se o modal for aberto e o savedStreets mudar
  React.useEffect(() => {
    if (isOpen && savedStreets.length > 0) {
      setSelectedSet(new Set(savedStreets.map((s) => s.trim().toLowerCase())));
    }
  }, [isOpen, savedStreets]);

  // Contagem de pacotes para cada rua/setor nas entregas carregadas
  const packageCountByStreet = useMemo(() => {
    const counts = new Map<string, number>();
    deliveries.forEach((d) => {
      const rua = (d.endereco_rua || d.endereco_completo || '').toLowerCase().trim();
      DAILY_STREET_CARDS.forEach((card) => {
        const target = card.streetName.toLowerCase();
        if (rua.includes(target) || target.includes(rua)) {
          counts.set(target, (counts.get(target) || 0) + 1);
        }
      });
    });
    return counts;
  }, [deliveries]);

  // Ruas customizadas adicionais que o entregador possa ter em savedStreets fora dos 9 cards padrão
  const extraCustomStreets = useMemo(() => {
    const defaultLower = new Set(DAILY_STREET_CARDS.map((c) => c.streetName.toLowerCase()));
    return savedStreets.filter((s) => !defaultLower.has(s.trim().toLowerCase()));
  }, [savedStreets]);

  if (!isOpen) return null;

  const toggleStreet = (streetName: string) => {
    const lower = streetName.trim().toLowerCase();
    try {
      if ('vibrate' in navigator) navigator.vibrate(25);
    } catch (_e) {}

    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(lower)) {
        next.delete(lower);
      } else {
        next.add(lower);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(30);
    } catch (_e) {}
    const next = new Set<string>();
    DAILY_STREET_CARDS.forEach((c) => next.add(c.streetName.toLowerCase()));
    extraCustomStreets.forEach((s) => next.add(s.toLowerCase()));
    setSelectedSet(next);
  };

  const handleClearAll = () => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(20);
    } catch (_e) {}
    setSelectedSet(new Set());
  };

  const handleAddCustomStreet = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customStreetInput.trim();
    if (!clean) return;
    try {
      if ('vibrate' in navigator) navigator.vibrate(30);
    } catch (_e) {}
    setSelectedSet((prev) => {
      const next = new Set(prev);
      next.add(clean.toLowerCase());
      return next;
    });
    setCustomStreetInput('');
    setShowAddCustom(false);
  };

  const handleConfirm = () => {
    try {
      if ('vibrate' in navigator) navigator.vibrate([40, 60, 40]);
    } catch (_e) {}

    // Monta a lista final preservando a grafia formal dos cards ou o nome original customizado
    const finalList: string[] = [];

    DAILY_STREET_CARDS.forEach((card) => {
      if (selectedSet.has(card.streetName.toLowerCase())) {
        finalList.push(card.streetName);
      }
    });

    // Adiciona extras selecionados
    selectedSet.forEach((selectedLower) => {
      if (!DAILY_STREET_CARDS.some((c) => c.streetName.toLowerCase() === selectedLower)) {
        // Encontra a capitalização original se existia
        const found = extraCustomStreets.find((s) => s.toLowerCase() === selectedLower);
        finalList.push(found || selectedLower);
      }
    });

    // Se o usuário selecionou "Associações" especificamente e tiver callback
    const selectedAssoc = selectedSet.has('associações') || selectedSet.has('associacoes');
    if (selectedAssoc && onOpenAssociacaoTab && finalList.length === 1) {
      onOpenAssociacaoTab();
    }

    // Se por acaso desmarcou tudo, fallback seguro para Carlos Seidl
    if (finalList.length === 0) {
      finalList.push('Rua Carlos Seidl');
    }

    onConfirmStreets(finalList);
    onClose();
  };

  const countSelected = selectedSet.size;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn overflow-hidden">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full border-t sm:border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[90vh] transition-colors">
        
        {/* HEADER LIMPO E ELEGANTE */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer touch-manipulation"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="pr-10">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Quais as ruas de hoje?
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
              Selecione as ruas que você vai atender no dia
            </p>
          </div>

          {/* CHIPS DE AÇÃO RÁPIDA */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-3 py-1.5 rounded-xl border border-emerald-300/80 dark:border-emerald-800 transition-all cursor-pointer touch-manipulation active:scale-95"
              >
                ✓ Todas
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs font-black text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer touch-manipulation active:scale-95"
              >
                ✕ Limpar
              </button>
            </div>

            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-900/50">
              {countSelected} de {DAILY_STREET_CARDS.length + extraCustomStreets.length}
            </span>
          </div>
        </div>

        {/* GRADE 3X3 DE CARDS COM ALTA USABILIDADE */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain">
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {DAILY_STREET_CARDS.map((card) => {
              const isSelected = selectedSet.has(card.streetName.toLowerCase());
              const count = packageCountByStreet.get(card.streetName.toLowerCase()) || 0;

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => toggleStreet(card.streetName)}
                  className={`relative flex flex-col items-center justify-between text-center p-3 rounded-2xl border transition-all cursor-pointer select-none touch-manipulation min-h-[96px] sm:min-h-[108px] active:scale-[0.97] ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/30 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                  }`}
                >
                  {/* Topo do Card: Ícone e Check */}
                  <div className="w-full flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-500">
                      {card.type === 'hub' ? (
                        <Layers className="w-3.5 h-3.5" />
                      ) : card.type === 'associacao' ? (
                        <Building2 className="w-3.5 h-3.5" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5" />
                      )}
                    </span>

                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 opacity-50'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  {/* Nome da Rua */}
                  <span className="font-extrabold text-xs sm:text-sm tracking-tight leading-snug line-clamp-2 my-1">
                    {card.label}
                  </span>

                  {/* Rodapé do Card: Contador de Pacotes */}
                  <div className="h-4 flex items-center">
                    {count > 0 ? (
                      <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md leading-none">
                        {count} pct{count > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] text-transparent select-none">-</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* RUAS EXTRAS / CUSTOMIZADAS */}
          {extraCustomStreets.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                Outras Ruas Cadastradas:
              </span>
              <div className="flex flex-wrap gap-2">
                {extraCustomStreets.map((st) => {
                  const isSelected = selectedSet.has(st.toLowerCase());
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => toggleStreet(st)}
                      className={`h-10 px-3.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer touch-manipulation flex items-center gap-2 ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        isSelected ? 'bg-emerald-500 text-white' : 'border border-slate-400 dark:border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[2.5]" />}
                      </div>
                      <span>{st}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ADICIONAR NOVA RUA / BECO / TRAVESSA */}
          <div className="pt-1">
            {!showAddCustom ? (
              <button
                type="button"
                onClick={() => setShowAddCustom(true)}
                className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 cursor-pointer touch-manipulation py-2"
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar outra rua, beco ou travessa</span>
              </button>
            ) : (
              <form onSubmit={handleAddCustomStreet} className="flex gap-2 animate-fadeIn pt-1">
                <input
                  type="text"
                  value={customStreetInput}
                  onChange={(e) => setCustomStreetInput(e.target.value)}
                  placeholder="Nome da rua ou travessa..."
                  autoFocus
                  className="flex-1 h-11 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="h-11 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl cursor-pointer touch-manipulation"
                >
                  Adicionar
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="h-11 px-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer touch-manipulation"
                >
                  Cancelar
                </button>
              </form>
            )}
          </div>
        </div>

        {/* BOTÃO PRINCIPAL DE CONFIRMAÇÃO (56px TOUCH TARGET) */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 pb-6 sm:pb-5">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer touch-manipulation"
          >
            <CheckCheck className="w-5 h-5 stroke-[2.5]" />
            <span>
              Confirmar Ruas ({countSelected} selecionada{countSelected === 1 ? '' : 's'})
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
