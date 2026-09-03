import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Plus,
  Trash2,
  Home,
  Building2,
  Check,
  BookOpen,
  Sparkles,
  CheckSquare,
  Square,
} from 'lucide-react';
import { DeliveryData } from '../types';
import {
  SavedAddressNumber,
  SavedResident,
  getSavedAddressesForStreet,
  saveAddressToMemory,
  deleteSavedResident,
  deleteSavedHouse,
} from '../utils/addressMemoryStorage';

interface StreetAddressMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  streetName: string;
  currentDeliveries: DeliveryData[];
  onAddSelectedPackages: (newDeliveries: DeliveryData[]) => void;
}

export const StreetAddressMemoryModal: React.FC<StreetAddressMemoryModalProps> = ({
  isOpen,
  onClose,
  streetName,
  currentDeliveries,
  onAddSelectedPackages,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'vila' | 'apartamento' | 'casa'>('todos');
  const [savedHouses, setSavedHouses] = useState<SavedAddressNumber[]>([]);
  const [selectedResidentKeys, setSelectedResidentKeys] = useState<Set<string>>(new Set());

  // Novo morador inline em uma casa específica
  const [addingToHouseNum, setAddingToHouseNum] = useState<string | null>(null);
  const [newResidentName, setNewResidentName] = useState('');
  const [newResidentComplement, setNewResidentComplement] = useState('');

  // Nova casa avulsa
  const [isAddingNewHouse, setIsAddingNewHouse] = useState(false);
  const [newHouseNum, setNewHouseNum] = useState('');
  const [newHouseResident, setNewHouseResident] = useState('');
  const [newHouseComp, setNewHouseComp] = useState('');

  // Carrega as casas salvas para esta rua
  const reloadAddresses = () => {
    const list = getSavedAddressesForStreet(streetName);
    setSavedHouses(list);
  };

  useEffect(() => {
    if (isOpen) {
      reloadAddresses();
      setSelectedResidentKeys(new Set());
      setSearchTerm('');
      setAddingToHouseNum(null);
      setIsAddingNewHouse(false);
    }
  }, [isOpen, streetName]);

  // Total de moradores salvos
  const totalResidentsCount = useMemo(() => {
    return savedHouses.reduce((acc, h) => acc + h.residents.length, 0);
  }, [savedHouses]);

  // Verifica se um morador/número já está na rota de hoje
  const isAlreadyOnRoute = (houseNumber: string, residentName: string, comp?: string): boolean => {
    const cleanNum = houseNumber.trim().toLowerCase();
    const cleanName = residentName.trim().toLowerCase();
    const cleanComp = (comp || '').trim().toLowerCase();

    return currentDeliveries.some((d) => {
      const dNum = (d.numero_casa || d.endereco_numero || '').trim().toLowerCase();
      const dName = (d.nome_destinatario || '').trim().toLowerCase();
      const dComp = (d.complemento || '').trim().toLowerCase();

      return dNum === cleanNum && (dName === cleanName || (cleanComp && dComp === cleanComp));
    });
  };

  // Casas filtradas
  const filteredHouses = useMemo(() => {
    let list = [...savedHouses];

    if (typeFilter !== 'todos') {
      list = list.filter((h) => h.type === typeFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((h) => {
        const matchesNum = h.houseNumber.toLowerCase().includes(q);
        const matchesResident = h.residents.some(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            (r.complement && r.complement.toLowerCase().includes(q))
        );
        return matchesNum || matchesResident;
      });
    }

    return list;
  }, [savedHouses, typeFilter, searchTerm]);

  // Alterna seleção de um morador específico
  const toggleResidentSelection = (houseNumber: string, resident: SavedResident) => {
    const key = `${houseNumber}:::${resident.id}`;
    setSelectedResidentKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Seleciona todos os moradores de uma casa
  const selectAllInHouse = (house: SavedAddressNumber) => {
    setSelectedResidentKeys((prev) => {
      const next = new Set(prev);
      house.residents.forEach((r) => {
        next.add(`${house.houseNumber}:::${r.id}`);
      });
      return next;
    });
  };

  // Selecionar todos os filtrados
  const handleSelectAll = () => {
    const next = new Set<string>();
    filteredHouses.forEach((h) => {
      h.residents.forEach((r) => {
        next.add(`${h.houseNumber}:::${r.id}`);
      });
    });
    setSelectedResidentKeys(next);
  };

  // Desmarcar todos
  const handleDeselectAll = () => {
    setSelectedResidentKeys(new Set());
  };

  // Adicionar diretamente 1 morador na rota de hoje
  const handleAddSingleResidentToRoute = (houseNumber: string, resident: SavedResident) => {
    const code = `#${Math.floor(1000 + Math.random() * 9000)}`;
    const fullAddress = `${streetName}, ${houseNumber}${resident.complement ? ` (${resident.complement})` : ''}`;

    const newPkg: DeliveryData = {
      id_entrega: `del_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      codigo_pacote: code,
      nome_destinatario: resident.name,
      recebedor_detalhes: resident.name,
      recebedor_tipo: 'proprio_morador',
      endereco_rua: streetName,
      numero_casa: houseNumber,
      endereco_numero: houseNumber,
      complemento: resident.complement,
      endereco_completo: fullAddress,
      foto_pacote_path: '',
      foto_local_path: '',
      data_hora: new Date().toISOString(),
      status: 'aguardando_rua',
      origem_leitura: 'manual',
    };

    onAddSelectedPackages([newPkg]);
  };

  // Adiciona todos os moradores selecionados à rota de hoje
  const handleConfirmBatchAdd = () => {
    if (selectedResidentKeys.size === 0) return;

    const toAdd: DeliveryData[] = [];
    const now = Date.now();
    let counter = 0;

    savedHouses.forEach((h) => {
      h.residents.forEach((r) => {
        const key = `${h.houseNumber}:::${r.id}`;
        if (selectedResidentKeys.has(key)) {
          counter++;
          const code = `#${Math.floor(1000 + Math.random() * 9000)}`;
          const fullAddress = `${streetName}, ${h.houseNumber}${r.complement ? ` (${r.complement})` : ''}`;

          toAdd.push({
            id_entrega: `del_${now}_${counter}_${Math.random().toString(36).substring(2, 5)}`,
            codigo_pacote: code,
            nome_destinatario: r.name,
            recebedor_detalhes: r.name,
            recebedor_tipo: 'proprio_morador',
            endereco_rua: streetName,
            numero_casa: h.houseNumber,
            endereco_numero: h.houseNumber,
            complemento: r.complement,
            endereco_completo: fullAddress,
            foto_pacote_path: '',
            foto_local_path: '',
            data_hora: new Date().toISOString(),
            status: 'aguardando_rua',
            origem_leitura: 'manual',
          });
        }
      });
    });

    if (toAdd.length > 0) {
      onAddSelectedPackages(toAdd);
      onClose();
    }
  };

  // Salvar novo morador dentro de uma casa
  const handleSaveInlineResident = (houseNumber: string) => {
    if (!newResidentName.trim()) return;
    saveAddressToMemory(streetName, houseNumber, newResidentComplement.trim() || undefined, newResidentName.trim());
    setNewResidentName('');
    setNewResidentComplement('');
    setAddingToHouseNum(null);
    reloadAddresses();
  };

  // Salvar casa nova avulsa
  const handleSaveNewHouse = () => {
    if (!newHouseNum.trim()) return;
    saveAddressToMemory(
      streetName,
      newHouseNum.trim(),
      newHouseComp.trim() || undefined,
      newHouseResident.trim() || 'Morador'
    );
    setNewHouseNum('');
    setNewHouseResident('');
    setNewHouseComp('');
    setIsAddingNewHouse(false);
    reloadAddresses();
  };

  // Excluir morador
  const handleDeleteResident = (houseNumber: string, residentId: string) => {
    deleteSavedResident(streetName, houseNumber, residentId);
    reloadAddresses();
  };

  // Excluir casa inteira
  const handleDeleteEntireHouse = (houseNumber: string) => {
    deleteSavedHouse(streetName, houseNumber);
    reloadAddresses();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        {/* Cabeçalho Limpo e Elegante */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 text-amber-400 border border-slate-700 flex items-center justify-center font-black shrink-0 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg">Caderno de Casas Salvas</h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  {savedHouses.length} casas salvas
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Rua: <strong className="text-white">{streetName}</strong> • {totalResidentsCount} moradores
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Busca & Filtros */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por número da casa, morador ou complemento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-emerald-500 shadow-inner"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Abas de Tipos e Ações Rápidas */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTypeFilter('todos')}
                className={`px-2.5 py-1 rounded-lg font-black text-[11px] transition-all cursor-pointer ${
                  typeFilter === 'todos'
                    ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Todos ({savedHouses.length})
              </button>

              <button
                type="button"
                onClick={() => setTypeFilter('vila')}
                className={`px-2.5 py-1 rounded-lg font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                  typeFilter === 'vila'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-800/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-50'
                }`}
              >
                <Home className="w-3 h-3" />
                <span>Vilas / Casas</span>
              </button>

              <button
                type="button"
                onClick={() => setTypeFilter('apartamento')}
                className={`px-2.5 py-1 rounded-lg font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                  typeFilter === 'apartamento'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 hover:bg-blue-50'
                }`}
              >
                <Building2 className="w-3 h-3" />
                <span>Apartamentos</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 underline px-1.5 py-0.5 cursor-pointer"
              >
                Marcar Todos
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 underline px-1.5 py-0.5 cursor-pointer"
              >
                Desmarcar
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Cards de Casas */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50/50 dark:bg-slate-950/40">
          {filteredHouses.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-slate-800 dark:text-slate-200 text-sm">
                  {searchTerm ? 'Nenhum número encontrado para a busca' : 'Nenhuma casa memorizada nesta rua ainda'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                  Conforme você cadastrar ou entregar pacotes nesta rua, o SafaSanha salvará automaticamente
                  cada número e morador aqui.
                </p>
              </div>

              {!isAddingNewHouse && (
                <button
                  type="button"
                  onClick={() => setIsAddingNewHouse(true)}
                  className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Cadastrar Primeiro Número Manualmente</span>
                </button>
              )}
            </div>
          ) : (
            filteredHouses.map((house) => {
              return (
                <div
                  key={house.houseNumber}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  {/* Cabeçalho do Card da Casa */}
                  <div className="bg-slate-900 dark:bg-slate-950 text-white p-3 flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 font-mono font-black text-sm border border-slate-700 shadow-xs">
                        Nº {house.houseNumber}
                      </span>

                      {/* Tag do Tipo com Detecção Inteligente de Vila/Apartamento */}
                      {house.type === 'vila' ? (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase flex items-center gap-1">
                          <Home className="w-3 h-3 text-emerald-400" />
                          <span>Vila ({house.residents.length} casas)</span>
                        </span>
                      ) : house.type === 'apartamento' ? (
                        <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-black uppercase flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-blue-400" />
                          <span>Prédio ({house.residents.length} aptos)</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-black uppercase">
                          Residência
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => selectAllInHouse(house)}
                        className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        title="Marcar todos os moradores deste número para entrega"
                      >
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Marcar Todos</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteEntireHouse(house.houseNumber)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/10 cursor-pointer"
                        title="Remover casa da memória"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Lista de Moradores da Casa */}
                  <div className="p-2.5 divide-y divide-slate-100 dark:divide-slate-800 space-y-1">
                    {house.residents.map((resident) => {
                      const key = `${house.houseNumber}:::${resident.id}`;
                      const isSelected = selectedResidentKeys.has(key);
                      const onRoute = isAlreadyOnRoute(house.houseNumber, resident.name, resident.complement);

                      return (
                        <div
                          key={resident.id}
                          className={`p-2 rounded-xl flex items-center justify-between gap-2 transition-all ${
                            isSelected
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-300/80 dark:border-emerald-800'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div
                            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                            onClick={() => toggleResidentSelection(house.houseNumber, resident)}
                          >
                            <div className="text-emerald-600 shrink-0">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <strong className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                                  {resident.name}
                                </strong>
                                {resident.complement && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    {resident.complement}
                                  </span>
                                )}
                                {onRoute && (
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/70 dark:border-emerald-800 flex items-center gap-0.5">
                                    <Check className="w-2.5 h-2.5" />
                                    Na Rota
                                  </span>
                                )}
                              </div>
                              {resident.timesDelivered && resident.timesDelivered > 1 && (
                                <p className="text-[10px] text-slate-400 font-medium">
                                  {resident.timesDelivered} entregas anteriores
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAddSingleResidentToRoute(house.houseNumber, resident)}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                              title="Adicionar apenas este morador à rota de hoje"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+1 Hoje</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteResident(house.houseNumber, resident.id)}
                              className="p-1 rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 cursor-pointer"
                              title="Excluir este morador"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Botão / Formulário para adicionar outro morador na mesma casa */}
                    {addingToHouseNum === house.houseNumber ? (
                      <div className="pt-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 animate-fadeIn">
                        <div className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                          + Novo morador no Nº {house.houseNumber}:
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            placeholder="Nome do morador *"
                            value={newResidentName}
                            onChange={(e) => setNewResidentName(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-400"
                            autoFocus
                          />
                          <input
                            type="text"
                            placeholder="Compl. (Casa 2, Apto 101)"
                            value={newResidentComplement}
                            onChange={(e) => setNewResidentComplement(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-400"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setAddingToHouseNum(null)}
                            className="px-2.5 py-1 text-slate-500 font-bold text-xs"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveInlineResident(house.houseNumber)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg shadow-xs"
                          >
                            Salvar Morador
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setAddingToHouseNum(house.houseNumber);
                            setNewResidentName('');
                            setNewResidentComplement('');
                          }}
                          className="text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
                        >
                          <Plus className="w-3 h-3 text-emerald-600" />
                          <span>Adicionar outro morador nesta mesma casa</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Adicionar Nova Casa Avulsa */}
          {isAddingNewHouse ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-3.5 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Cadastrar Novo Número na Memória da Rua</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingNewHouse(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Nº da Casa *"
                  value={newHouseNum}
                  onChange={(e) => setNewHouseNum(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-black text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Compl. (Casa 1, Apto 202...)"
                  value={newHouseComp}
                  onChange={(e) => setNewHouseComp(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
                <input
                  type="text"
                  placeholder="Nome do Morador *"
                  value={newHouseResident}
                  onChange={(e) => setNewHouseResident(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNewHouse(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewHouse}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  Salvar na Memória
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingNewHouse(true)}
              className="w-full py-2.5 px-3 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4 text-emerald-500" />
              <span>+ Cadastrar Outro Número Salvo Nesta Rua</span>
            </button>
          )}
        </div>

        {/* Rodapé Fixo com Botão Consolidado */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 shadow-lg">
          <div className="text-xs">
            <span className="font-bold text-slate-500">Selecionados: </span>
            <strong className="text-slate-950 dark:text-slate-100 font-black text-sm">
              {selectedResidentKeys.size} morador(es)
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Fechar
            </button>

            <button
              type="button"
              disabled={selectedResidentKeys.size === 0}
              onClick={handleConfirmBatchAdd}
              className={`px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
                selectedResidentKeys.size > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Adicionar Marcados à Rota ({selectedResidentKeys.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
