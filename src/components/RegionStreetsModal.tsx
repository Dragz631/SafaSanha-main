import React, { useState } from 'react';
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
  Search
} from 'lucide-react';
import { DeliveryData } from '../types';

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

  // Deduplica ruas para exibição segura
  const uniqueStreets = React.useMemo(() => {
    const map = new Map<string, string>();
    savedStreets.forEach((st) => {
      const clean = st?.trim();
      if (clean && !map.has(clean.toLowerCase())) {
        map.set(clean.toLowerCase(), clean);
      }
    });
    return Array.from(map.values());
  }, [savedStreets]);

  // Ruas filtradas pela busca
  const filtered = uniqueStreets.filter((st) =>
    st.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStreetName.trim()) return;
    onAddStreet(newStreetName.trim());
    onSelectStreet(newStreetName.trim());
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

  // Calcula contadores de cada rua
  const getStreetStats = (street: string) => {
    const clean = street.toLowerCase().trim();
    const list = deliveries.filter((d) => {
      const st = (d.endereco_rua || d.endereco_completo || '').toLowerCase();
      return st.includes(clean) || clean.includes(st);
    });
    const total = list.length;
    const delivered = list.filter(
      (d) => d.status === 'entregue' || d.status === 'concluido'
    ).length;
    const pending = total - delivered;
    return { total, delivered, pending };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] pb-safe">
        
        {/* Topo do Modal */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-sm text-white">Ruas da Região</h2>
              <p className="text-[11px] text-slate-400">
                Selecione ou adicione novas ruas para atendimento
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

        {/* Formulário de Adicionar Nova Rua */}
        <div className="p-4 pb-2 border-b border-slate-100 bg-slate-50 space-y-2">
          <form onSubmit={handleAddNew} className="flex items-center gap-2">
            <input
              type="text"
              value={newStreetName}
              onChange={(e) => setNewStreetName(e.target.value)}
              placeholder="Digite o nome da nova rua (Ex: Rua Bela)..."
              className="flex-1 px-3 py-2.5 bg-white border-2 border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-bold text-slate-900 focus:outline-none placeholder-slate-400 shadow-xs"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newStreetName.trim()}
              className="py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1 cursor-pointer shrink-0 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar</span>
            </button>
          </form>

          {/* Busca Rápida de Ruas (quando houver mais de 3) */}
          {savedStreets.length > 3 && (
            <div className="relative pt-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 mt-0.5" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar ruas..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Lista de Ruas com Contadores de Pacotes */}
        <div className="p-4 space-y-2 overflow-y-auto flex-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
            Ruas Cadastradas ({uniqueStreets.length})
          </span>

          {filtered.length > 0 ? (
            filtered.map((street, idx) => {
              const isActive = activeStreet.toLowerCase() === street.toLowerCase();
              const isEditing = editingStreet === street;
              const stats = getStreetStats(street);

              return (
                <div
                  key={`modal-st-${street.toLowerCase()}-${idx}`}
                  className={`rounded-2xl border transition-all p-3 flex items-center justify-between gap-2 ${
                    isActive
                      ? 'bg-emerald-50/80 border-emerald-500 shadow-xs shadow-emerald-500/10'
                      : 'bg-white border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        value={editNameInput}
                        onChange={(e) => setEditNameInput(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-white border-2 border-emerald-500 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
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
                        className="p-1.5 bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Botão de Selecionar Rua */}
                      <button
                        onClick={() => {
                          onSelectStreet(street);
                          onClose();
                        }}
                        className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                      >
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-emerald-600 text-white font-black'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isActive ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <MapPin className="w-3.5 h-3.5" />
                          )}
                        </div>

                        <div className="truncate">
                          <span
                            className={`text-xs font-black block truncate ${
                              isActive ? 'text-emerald-950' : 'text-slate-800'
                            }`}
                          >
                            {street}
                          </span>

                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold mt-0.5">
                            {stats.total > 0 ? (
                              <>
                                <span>{stats.total} pacotes</span>
                                <span>•</span>
                                {stats.pending > 0 ? (
                                  <span className="text-amber-700 font-extrabold">
                                    {stats.pending} pendentes
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-extrabold flex items-center gap-0.5">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Tudo entregue
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400 font-medium">Nenhum pacote</span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Ações de Edição e Exclusão */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(street)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                          title="Renomear Rua"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {savedStreets.length > 1 && (
                          <button
                            onClick={() => onDeleteStreet(street)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                            title="Remover da lista de ruas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs">
              Nenhuma rua encontrada com "{searchFilter}".
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-4 bg-slate-900 text-white font-black text-xs rounded-xl cursor-pointer hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
