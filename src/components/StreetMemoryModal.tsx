import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Trash2,
  Check,
  X,
  UserPlus,
  Home,
  CheckCheck,
  Sparkles,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { UserProfile, UserStreet, StreetPackage, StreetSavedAddress, SavedResidentInfo } from '../types';
import {
  getStreetSavedAddresses,
  saveAddressToStreetMemory,
  deleteSavedResident,
  deleteSavedHouse,
} from '../lib/userStorage';

interface StreetMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  street: UserStreet;
  onAddPackagesToStreet: (packages: StreetPackage[]) => void;
}

export const StreetMemoryModal: React.FC<StreetMemoryModalProps> = ({
  isOpen,
  onClose,
  user,
  street,
  onAddPackagesToStreet,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResidentKeys, setSelectedResidentKeys] = useState<Set<string>>(new Set());
  const [showManualAddForm, setShowManualAddForm] = useState(false);
  const [manualHouseNumber, setManualHouseNumber] = useState('');
  const [manualComplement, setManualComplement] = useState('');
  const [manualRecipientName, setManualRecipientName] = useState('');
  const [activeHouseToAddResident, setActiveHouseToAddResident] = useState<string | null>(null);
  const [newResidentName, setNewResidentName] = useState('');
  const [newResidentComplement, setNewResidentComplement] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Reload saved addresses from memory
  const savedAddresses = useMemo(() => {
    return getStreetSavedAddresses(user.id, street.name);
  }, [user.id, street.name, notification, showManualAddForm, activeHouseToAddResident]);

  // Existing packages in the street run today (to highlight already added houses)
  const existingKeysToday = useMemo(() => {
    const keys = new Set<string>();
    street.packages.forEach((p) => {
      const num = p.houseNumber.trim().toLowerCase().replace(/\s+/g, '');
      const rec = (p.recipientName || '').trim().toLowerCase();
      const comp = (p.complement || '').trim().toLowerCase().replace(/\s+/g, '');
      keys.add(`${num}___${comp}___${rec}`);
      // Also general house number key
      keys.add(`house___${num}`);
    });
    return keys;
  }, [street.packages]);

  // Filter addresses by search term
  const filteredAddresses = useMemo(() => {
    if (!searchTerm.trim()) return savedAddresses;
    const term = searchTerm.trim().toLowerCase();
    return savedAddresses.filter((addr) => {
      const matchHouse = addr.houseNumber.toLowerCase().includes(term);
      const matchResident = addr.residents.some(
        (r) =>
          r.recipientName.toLowerCase().includes(term) ||
          (r.complement && r.complement.toLowerCase().includes(term))
      );
      return matchHouse || matchResident;
    });
  }, [savedAddresses, searchTerm]);

  // Total remembered residents
  const totalResidentsCount = useMemo(() => {
    return savedAddresses.reduce((acc, curr) => acc + curr.residents.length, 0);
  }, [savedAddresses]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  // Toggle selection for bulk adding
  const toggleSelectResident = (houseNumber: string, resident: SavedResidentInfo) => {
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

  // Select all or deselect all
  const handleSelectAll = () => {
    if (selectedResidentKeys.size > 0) {
      setSelectedResidentKeys(new Set());
    } else {
      const allKeys = new Set<string>();
      filteredAddresses.forEach((addr) => {
        addr.residents.forEach((r) => {
          allKeys.add(`${addr.houseNumber}:::${r.id}`);
        });
      });
      setSelectedResidentKeys(allKeys);
    }
  };

  // Add a single resident to today's street packages
  const handleAddSingleResidentToday = (houseNumber: string, resident: SavedResidentInfo) => {
    const newPkg: StreetPackage = {
      id: `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      houseNumber: houseNumber.trim(),
      complement: resident.complement?.trim() || undefined,
      recipientName: resident.recipientName.trim(),
      status: 'pending',
    };

    onAddPackagesToStreet([newPkg]);
    showToast(`✅ Nº ${houseNumber} • ${resident.recipientName} adicionado à rota de hoje!`);
  };

  // Add all residents of a specific house to today's packages
  const handleAddAllHouseResidentsToday = (addr: StreetSavedAddress) => {
    const newPkgs: StreetPackage[] = addr.residents.map((r, idx) => ({
      id: `pkg_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      houseNumber: addr.houseNumber.trim(),
      complement: r.complement?.trim() || undefined,
      recipientName: r.recipientName.trim(),
      status: 'pending',
    }));

    onAddPackagesToStreet(newPkgs);
    showToast(`✅ ${newPkgs.length} pessoas do Nº ${addr.houseNumber} adicionadas à rota!`);
  };

  // Add selected residents in bulk to today's packages
  const handleAddSelectedToday = () => {
    if (selectedResidentKeys.size === 0) return;

    const newPkgs: StreetPackage[] = [];

    savedAddresses.forEach((addr) => {
      addr.residents.forEach((r) => {
        const key = `${addr.houseNumber}:::${r.id}`;
        if (selectedResidentKeys.has(key)) {
          newPkgs.push({
            id: `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            houseNumber: addr.houseNumber.trim(),
            complement: r.complement?.trim() || undefined,
            recipientName: r.recipientName.trim(),
            status: 'pending',
          });
        }
      });
    });

    if (newPkgs.length > 0) {
      onAddPackagesToStreet(newPkgs);
      setSelectedResidentKeys(new Set());
      showToast(`🎉 ${newPkgs.length} endereços adicionados com sucesso à entrega de hoje!`);
    }
  };

  // Add a brand new address to street memory
  const handleSaveManualAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualHouseNumber.trim()) return;

    saveAddressToStreetMemory(
      user.id,
      street.name,
      manualHouseNumber.trim(),
      manualComplement.trim() || undefined,
      manualRecipientName.trim() || 'Morador'
    );

    setManualHouseNumber('');
    setManualComplement('');
    setManualRecipientName('');
    setShowManualAddForm(false);
    showToast('💾 Endereço salvo na memória da rua!');
  };

  // Add a new resident to an existing house
  const handleSaveNewResidentToHouse = (houseNumber: string) => {
    if (!newResidentName.trim()) return;

    saveAddressToStreetMemory(
      user.id,
      street.name,
      houseNumber,
      newResidentComplement.trim() || undefined,
      newResidentName.trim()
    );

    setActiveHouseToAddResident(null);
    setNewResidentName('');
    setNewResidentComplement('');
    showToast(`👤 Novo morador adicionado ao Nº ${houseNumber}!`);
  };

  // Delete resident from memory
  const handleDeleteResident = (houseNumber: string, residentId: string, residentName: string) => {
    if (confirm(`Remover "${residentName}" da memória do Nº ${houseNumber}?`)) {
      deleteSavedResident(user.id, street.name, houseNumber, residentId);
      showToast('🗑️ Morador removido da memória.');
    }
  };

  // Delete entire house from memory
  const handleDeleteHouse = (houseNumber: string) => {
    if (confirm(`Excluir todo o Nº ${houseNumber} da memória desta rua?`)) {
      deleteSavedHouse(user.id, street.name, houseNumber);
      showToast('🗑️ Casa removida da memória.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-slate-950 p-4 sm:p-5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-slate-950/10 border border-slate-950/20 flex items-center justify-center font-black shrink-0">
              <BookOpen className="w-6 h-6 text-slate-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider bg-slate-950 text-amber-400 px-2 py-0.5 rounded-md">
                  Memória Inteligente
                </span>
                <span className="text-xs font-bold text-slate-900/80">
                  {savedAddresses.length} casas • {totalResidentsCount} pessoas
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-950 truncate mt-0.5">
                {street.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-950/10 hover:bg-slate-950/20 text-slate-950 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subheader / Search & Actions */}
        <div className="p-3 sm:p-4 bg-amber-50/50 border-b border-amber-100 flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por número, nome ou complemento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl border border-amber-200 bg-white text-xs font-bold text-slate-900 outline-none focus:border-amber-500 shadow-2xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-2.5 rounded-2xl border border-slate-300 hover:bg-white text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Marcar ou desmarcar todos"
            >
              <CheckCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>{selectedResidentKeys.size > 0 ? 'Desmarcar' : 'Marcar Todos'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowManualAddForm(!showManualAddForm)}
              className="px-3 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-900 text-amber-400 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 ml-auto sm:ml-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showManualAddForm ? 'Fechar Form' : 'Nova Casa'}</span>
            </button>
          </div>
        </div>

        {/* Manual Add Form (Expandable) */}
        {showManualAddForm && (
          <form
            onSubmit={handleSaveManualAddress}
            className="p-4 bg-amber-50 border-b border-amber-200 space-y-3 animate-fadeIn"
          >
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Salvar Novo Endereço na Memória da Rua</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Número *
                </label>
                <input
                  type="text"
                  placeholder="Ex: 142"
                  value={manualHouseNumber}
                  onChange={(e) => setManualHouseNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-black text-xs text-slate-900 outline-none focus:border-amber-500 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Complemento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Casa 2, Apto 301"
                  value={manualComplement}
                  onChange={(e) => setManualComplement(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-900 outline-none focus:border-amber-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Nome do Morador
                </label>
                <input
                  type="text"
                  placeholder="Ex: Maria Silva"
                  value={manualRecipientName}
                  onChange={(e) => setManualRecipientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-900 outline-none focus:border-amber-500 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowManualAddForm(false)}
                className="px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 font-black text-xs text-slate-950 shadow-xs cursor-pointer"
              >
                Salvar na Memória
              </button>
            </div>
          </form>
        )}

        {/* Notification Toast */}
        {notification && (
          <div className="bg-emerald-600 text-white font-bold text-xs px-4 py-2 text-center animate-fadeIn">
            {notification}
          </div>
        )}

        {/* Content: List of Saved Address Cards */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3.5">
          {filteredAddresses.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-300 space-y-2">
              <Home className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="font-black text-slate-800 text-sm">
                {searchTerm
                  ? 'Nenhum endereço encontrado para esta busca.'
                  : 'Nenhum número salvo nesta rua ainda.'}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                À medida que você adiciona pacotes ou realiza entregas na rua{' '}
                <strong>{street.name}</strong>, o SafaSanha salva automaticamente todas as casas e
                moradores na memória!
              </p>
              {!searchTerm && (
                <button
                  type="button"
                  onClick={() => setShowManualAddForm(true)}
                  className="mt-2 px-4 py-2 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Primeira Casa</span>
                </button>
              )}
            </div>
          ) : (
            filteredAddresses.map((addr) => {
              const cleanHouse = addr.houseNumber.trim().toLowerCase().replace(/\s+/g, '');
              const isHouseAlreadyInToday = existingKeysToday.has(`house___${cleanHouse}`);

              return (
                <div
                  key={addr.houseNumber}
                  className="bg-white rounded-2xl border-2 border-slate-200 hover:border-amber-400 p-3.5 sm:p-4 shadow-xs transition-all space-y-3"
                >
                  {/* Card Header: House Number and Quick Actions */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex flex-col items-center justify-center font-black shadow-xs shrink-0">
                        <span className="text-[8px] uppercase tracking-wider text-amber-950 font-bold leading-none">
                          Nº
                        </span>
                        <span className="text-base truncate max-w-[50px]">{addr.houseNumber}</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-black text-slate-900 text-sm">
                            Nº {addr.houseNumber}
                          </h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {addr.residents.length} {addr.residents.length === 1 ? 'morador' : 'moradores'}
                          </span>
                          {isHouseAlreadyInToday && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Na Rota de Hoje
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {street.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAddAllHouseResidentsToday(addr)}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Adicionar todos os moradores desta casa à rota de hoje"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar Todos ({addr.residents.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteHouse(addr.houseNumber)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                        title="Excluir casa da memória"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Residents of this house */}
                  <div className="space-y-2">
                    {addr.residents.map((res) => {
                      const resKey = `${addr.houseNumber}:::${res.id}`;
                      const isSelected = selectedResidentKeys.has(resKey);
                      const cleanRec = res.recipientName.trim().toLowerCase();
                      const cleanComp = (res.complement || '').trim().toLowerCase().replace(/\s+/g, '');
                      const isAlreadyAddedToday = existingKeysToday.has(
                        `${cleanHouse}___${cleanComp}___${cleanRec}`
                      );

                      return (
                        <div
                          key={res.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                            isSelected
                              ? 'border-amber-500 bg-amber-50/60'
                              : isAlreadyAddedToday
                              ? 'border-emerald-200 bg-emerald-50/30'
                              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectResident(addr.houseNumber, res)}
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                            />

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-xs text-slate-900 truncate">
                                  {res.recipientName}
                                </span>
                                {res.complement && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-white text-slate-700 border border-slate-200 shadow-2xs">
                                    {res.complement}
                                  </span>
                                )}
                              </div>

                              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                {res.timesDelivered !== undefined && res.timesDelivered > 0 && (
                                  <span className="text-emerald-700 font-bold">
                                    ✓ Entregue {res.timesDelivered}x
                                  </span>
                                )}
                                {res.lastReceiverName && (
                                  <span className="truncate">
                                    Último recebedor: {res.lastReceiverName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isAlreadyAddedToday ? (
                              <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>Já na Rota</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddSingleResidentToday(addr.houseNumber, res)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>+ Adicionar Hoje</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteResident(addr.houseNumber, res.id, res.recipientName)}
                              className="p-1 text-slate-300 hover:text-red-500 cursor-pointer"
                              title="Remover morador da memória"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Resident to This House Form or Button */}
                  {activeHouseToAddResident === addr.houseNumber ? (
                    <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2 animate-fadeIn">
                      <div className="text-[11px] font-bold text-amber-950">
                        + Adicionar Novo Morador no Nº {addr.houseNumber}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Nome da pessoa..."
                          value={newResidentName}
                          onChange={(e) => setNewResidentName(e.target.value)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                          autoFocus
                        />
                        <input
                          type="text"
                          placeholder="Complemento (Apto, Casa 2...)"
                          value={newResidentComplement}
                          onChange={(e) => setNewResidentComplement(e.target.value)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveHouseToAddResident(null);
                            setNewResidentName('');
                            setNewResidentComplement('');
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-600"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveNewResidentToHouse(addr.houseNumber)}
                          className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black"
                        >
                          Salvar Morador
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveHouseToAddResident(addr.houseNumber);
                        setNewResidentName('');
                        setNewResidentComplement('');
                      }}
                      className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer pt-0.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Adicionar outro morador nesta mesma casa</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-600">
            {selectedResidentKeys.size > 0 ? (
              <span className="text-amber-950 font-black">
                {selectedResidentKeys.size} {selectedResidentKeys.size === 1 ? 'endereço selecionado' : 'endereços selecionados'}
              </span>
            ) : (
              <span>Selecione endereços para adicionar em lote</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-slate-300 font-bold text-slate-700 text-xs hover:bg-slate-200/70 cursor-pointer"
            >
              Fechar
            </button>

            {selectedResidentKeys.size > 0 && (
              <button
                type="button"
                onClick={handleAddSelectedToday}
                className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Selecionados à Rota ({selectedResidentKeys.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
