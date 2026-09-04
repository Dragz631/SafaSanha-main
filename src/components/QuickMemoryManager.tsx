import React, { useState, useMemo } from 'react';
import {
  Compass,
  Plus,
  Check,
  UserPlus,
  Trash2,
  Search,
} from 'lucide-react';
import { DeliveryData } from '../types';
import {
  getSavedAddressesForStreet,
  deleteSavedResident,
  SavedAddressNumber,
  SavedResident,
} from '../utils/addressMemoryStorage';
import { MANILHA_SUB_STREETS, getManilhaSubStreet } from '../data/cajuStreets';

interface QuickMemoryManagerProps {
  streetName: string;
  isManilhaActive: boolean;
  manilhaSubStreet?: string;
  currentDeliveries: DeliveryData[];
  onAddDelivery: (delivery: DeliveryData) => void;
  onSelectForManualAdd: (houseNumber: string, complement?: string, subStreet?: string) => void;
  onToast: (msg: string) => void;
}

export const QuickMemoryManager: React.FC<QuickMemoryManagerProps> = ({
  streetName,
  isManilhaActive,
  manilhaSubStreet,
  currentDeliveries,
  onAddDelivery,
  onSelectForManualAdd,
  onToast,
}) => {
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<'todas' | 'na_rota' | 'pendentes'>('todas');

  // Estados exclusivos para a Manilha
  const [manilhaCategory, setManilhaCategory] = useState<'todas' | 'principais' | 'letras'>('todas');
  const [selectedSubStreet, setSelectedSubStreet] = useState<string>('todas');

  // Carrega todas as casas memorizadas
  const targetStreetKey = isManilhaActive ? 'Manilha' : streetName;
  const allSavedHouses = useMemo(() => {
    return getSavedAddressesForStreet(targetStreetKey);
  }, [targetStreetKey, refreshKey]);

  // Filtra de acordo com a Manilha (Vias Principais vs Letras) ou Rua Normal
  const filteredHouses = useMemo(() => {
    let list = allSavedHouses;

    if (isManilhaActive) {
      if (manilhaCategory === 'principais') {
        const principalNames = MANILHA_SUB_STREETS.filter((s) => s.type === 'principal').map((s) =>
          s.name.toLowerCase()
        );
        list = list.filter((h) => principalNames.includes((h.subStreet || '').toLowerCase()));
      } else if (manilhaCategory === 'letras') {
        const letraNames = MANILHA_SUB_STREETS.filter((s) => s.type === 'letra').map((s) =>
          s.name.toLowerCase()
        );
        list = list.filter((h) => letraNames.includes((h.subStreet || '').toLowerCase()));
      }

      if (selectedSubStreet !== 'todas') {
        list = list.filter(
          (h) => (h.subStreet || '').toLowerCase().trim() === selectedSubStreet.toLowerCase().trim()
        );
      }
    }

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter((h) => {
        const numMatch = h.houseNumber.toLowerCase().includes(q);
        const subMatch = (h.subStreet || '').toLowerCase().includes(q);
        const resMatch = h.residents.some(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            (r.complement || '').toLowerCase().includes(q)
        );
        return numMatch || subMatch || resMatch;
      });
    }

    return list;
  }, [allSavedHouses, isManilhaActive, manilhaCategory, selectedSubStreet, searchFilter]);

  // Contadores por sub-rua da Manilha
  const subStreetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allSavedHouses.forEach((h) => {
      const key = h.subStreet || 'Não especificada';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [allSavedHouses]);

  // Verifica se um morador/casa já está na rota ativa de hoje
  const isResidentInRoute = (house: SavedAddressNumber, resident: SavedResident): boolean => {
    const cleanHouse = house.houseNumber.trim().toLowerCase();
    const cleanName = resident.name.trim().toLowerCase();
    const cleanComp = (resident.complement || '').trim().toLowerCase();
    const houseSub = (house.subStreet || '').trim().toLowerCase();

    return currentDeliveries.some((d) => {
      const dNum = (d.numero_casa || d.endereco_numero || '').trim().toLowerCase();
      if (dNum !== cleanHouse) return false;

      if (isManilhaActive) {
        const dSub = getManilhaSubStreet(d).trim().toLowerCase();
        if (houseSub && dSub && dSub !== houseSub) return false;
      }

      if (cleanComp) {
        const dComp = (d.complemento || d.endereco_complemento || '').trim().toLowerCase();
        if (dComp === cleanComp) return true;
      }

      const dName = (d.nome_destinatario || d.recebedor_detalhes || '').trim().toLowerCase();
      if (dName && cleanName !== 'morador' && dName === cleanName) return true;

      return false;
    });
  };

  // Contadores globais de rota para os chips rápidos de filtro
  const { totalInRoute, totalPending } = useMemo(() => {
    let inRoute = 0;
    let pending = 0;
    allSavedHouses.forEach((h) => {
      h.residents.forEach((r) => {
        if (isResidentInRoute(h, r)) inRoute++;
        else pending++;
      });
    });
    return { totalInRoute: inRoute, totalPending: pending };
  }, [allSavedHouses, currentDeliveries, isManilhaActive]);

  // Aplica o filtro de status (todas, na_rota, pendentes)
  const displayedHouses = useMemo(() => {
    if (statusFilter === 'todas') return filteredHouses;
    return filteredHouses.filter((h) => {
      const someIn = h.residents.some((r) => isResidentInRoute(h, r));
      const someOut = h.residents.some((r) => !isResidentInRoute(h, r));
      if (statusFilter === 'na_rota') return someIn;
      if (statusFilter === 'pendentes') return someOut;
      return true;
    });
  }, [filteredHouses, statusFilter, currentDeliveries, isManilhaActive]);

  // Handler de 1 toque: adiciona o pacote salvo diretamente na rota de hoje
  const handleAddSingleSaved = (house: SavedAddressNumber, resident: SavedResident) => {
    const code = `#${Math.floor(1000 + Math.random() * 9000)}`;
    const comp = resident.complement || undefined;
    const client = resident.name || 'Morador';
    const targetSub = house.subStreet || manilhaSubStreet || 'Rua Leão XIII';

    const fullAddress = isManilhaActive
      ? `${targetSub}, ${house.houseNumber}${comp ? ` (${comp})` : ''} (Manilha – Caju)`
      : `${streetName}, ${house.houseNumber}${comp ? ` (${comp})` : ''}`;

    const newDelivery: DeliveryData = {
      id_entrega: `del_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      codigo_pacote: code,
      nome_destinatario: client,
      recebedor_detalhes: client,
      recebedor_tipo: 'proprio_morador',
      endereco_rua: isManilhaActive ? 'Manilha' : streetName,
      sub_rua_manilha: isManilhaActive ? targetSub : undefined,
      numero_casa: house.houseNumber,
      endereco_numero: house.houseNumber,
      complemento: comp,
      endereco_completo: fullAddress,
      foto_pacote_path: '',
      foto_local_path: '',
      data_hora: new Date().toISOString(),
      status: 'aguardando_rua',
      origem_leitura: 'manual',
    };

    onAddDelivery(newDelivery);

    try {
      if ('vibrate' in navigator) navigator.vibrate(40);
    } catch (_e) {}

    const streetLabel = isManilhaActive ? `${targetSub} Nº ${house.houseNumber}` : `Nº ${house.houseNumber}`;
    onToast(`✅ ${streetLabel} ${comp ? `(${comp})` : ''} de ${client} adicionado!`);
  };

  const handleDeleteRes = (house: SavedAddressNumber, residentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Remover este morador da memória desta casa?')) {
      deleteSavedResident(targetStreetKey, house.houseNumber, residentId, house.subStreet);
      setRefreshKey((k) => k + 1);
    }
  };

  return (
    <div className="space-y-3">
      {/* SE FOR MANILHA: DIVISÃO ENTRE VIAS PRINCIPAIS E RUAS COM LETRAS */}
      {isManilhaActive && (
        <div className="space-y-2 bg-slate-100/90 dark:bg-slate-900/90 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          {/* Nível 1: Abas Principais da Manilha */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setManilhaCategory('todas');
                setSelectedSubStreet('todas');
              }}
              className={`h-8 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 touch-manipulation ${
                manilhaCategory === 'todas'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Todas ({allSavedHouses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setManilhaCategory('principais');
                setSelectedSubStreet('todas');
              }}
              className={`h-8 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 touch-manipulation ${
                manilhaCategory === 'principais'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Meio & Lados</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setManilhaCategory('letras');
                setSelectedSubStreet('todas');
              }}
              className={`h-8 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 touch-manipulation ${
                manilhaCategory === 'letras'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Letras (A a K)</span>
            </button>
          </div>

          {/* Nível 2: Seletor Específico de Ruas / Letras da Manilha */}
          {manilhaCategory === 'principais' && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              <button
                type="button"
                onClick={() => setSelectedSubStreet('todas')}
                className={`h-7 px-2.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedSubStreet === 'todas'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Todas Principais
              </button>
              {MANILHA_SUB_STREETS.filter((s) => s.type === 'principal').map((st) => {
                const count = subStreetCounts[st.name] || 0;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedSubStreet(st.name)}
                    className={`h-7 px-2.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedSubStreet === st.name
                        ? 'bg-emerald-600 text-white font-black shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>{st.shortLabel}</span>
                    <span className="text-[10px] px-1 rounded-sm bg-slate-100 dark:bg-slate-900/60 font-mono">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {manilhaCategory === 'letras' && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              <button
                type="button"
                onClick={() => setSelectedSubStreet('todas')}
                className={`h-8 px-2.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedSubStreet === 'todas'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Todas Letras
              </button>
              {MANILHA_SUB_STREETS.filter((s) => s.type === 'letra').map((st) => {
                const letter = st.name.replace(/rua\s*/i, '').toUpperCase();
                const count = subStreetCounts[st.name] || 0;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedSubStreet(st.name)}
                    className={`w-8 h-8 rounded-lg text-xs font-black shrink-0 transition-all cursor-pointer flex items-center justify-center relative ${
                      selectedSubStreet === st.name
                        ? 'bg-emerald-600 text-white font-black scale-105 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                    title={`${st.name} (${count} casas salvas)`}
                  >
                    {letter}
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"></span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Barra de Filtros e Busca Rápida */}
      <div className="space-y-2">
        {allSavedHouses.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            {/* Chips de Filtro: Todas, Na Rota, Pendentes */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setStatusFilter('todas')}
                className={`text-xs font-black px-3 py-1.5 rounded-xl border transition-all cursor-pointer touch-manipulation active:scale-95 shrink-0 ${
                  statusFilter === 'todas'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                }`}
              >
                Todas ({allSavedHouses.length})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('na_rota')}
                className={`text-xs font-black px-3 py-1.5 rounded-xl border transition-all cursor-pointer touch-manipulation active:scale-95 shrink-0 flex items-center gap-1 ${
                  statusFilter === 'na_rota'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60'
                }`}
              >
                <Check className="w-3 h-3 stroke-[3]" />
                <span>Na Rota ({totalInRoute})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('pendentes')}
                className={`text-xs font-black px-3 py-1.5 rounded-xl border transition-all cursor-pointer touch-manipulation active:scale-95 shrink-0 ${
                  statusFilter === 'pendentes'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                }`}
              >
                + Pendentes ({totalPending})
              </button>
            </div>

            {/* Contador / Dica rápida */}
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 hidden xs:inline shrink-0">
              1 toque = rota
            </span>
          </div>
        )}

        {/* Busca de Casas/Moradores Memorizados */}
        {allSavedHouses.length > 2 && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={
                isManilhaActive
                  ? 'Buscar por número, morador ou via...'
                  : 'Buscar número ou morador salvo...'
              }
              className="w-full h-10 pl-10 pr-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 border border-slate-200 dark:border-slate-800 shadow-2xs transition-all"
            />
          </div>
        )}
      </div>

      {/* Lista Vazia */}
      {displayedHouses.length === 0 && (
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-6 text-center space-y-3 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto text-xl border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
            ⚡
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              {statusFilter === 'na_rota'
                ? 'Nenhuma casa desta rua foi adicionada na rota de hoje ainda.'
                : statusFilter === 'pendentes'
                ? 'Todos os moradores salvos já estão na rota de hoje!'
                : isManilhaActive && selectedSubStreet !== 'todas'
                ? `Nenhuma casa salva na ${selectedSubStreet} ainda.`
                : 'Nenhuma casa memorizada nesta rua ainda.'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
              Ao cadastrar novos pacotes pela aba <b>"✍️ Digitar Novo"</b>, o endereço e moradores ficam salvos para adicionar com 1 toque!
            </p>
          </div>
          {statusFilter === 'todas' && (
            <button
              type="button"
              onClick={() => onSelectForManualAdd('', '', selectedSubStreet !== 'todas' ? selectedSubStreet : undefined)}
              className="h-10 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl cursor-pointer shadow-md shadow-emerald-600/20 transition-all inline-flex items-center gap-1.5 touch-manipulation"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Cadastrar Primeiro Número</span>
            </button>
          )}
        </div>
      )}

      {/* Grid Ergonômico de Cards de Casas e Moradores (Inspirado no Modal de Ruas) */}
      {displayedHouses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {displayedHouses.map((house) => {
            const isVila = house.type === 'vila';
            const isApto = house.type === 'apartamento';
            const subLabel = house.subStreet || (isManilhaActive ? 'Manilha' : undefined);

            // Verifica quantos moradores dessa casa estão na rota
            const inRouteCount = house.residents.filter((r) => isResidentInRoute(house, r)).length;
            const allInRoute = inRouteCount > 0 && inRouteCount === house.residents.length;
            const someInRoute = inRouteCount > 0;

            return (
              <div
                key={`${house.subStreet || ''}_${house.houseNumber}`}
                className={`rounded-2xl border transition-all p-3 sm:p-3.5 space-y-2.5 ${
                  allInRoute
                    ? 'border-emerald-500/60 bg-emerald-500/[0.04] dark:bg-emerald-950/20 shadow-xs'
                    : someInRoute
                    ? 'border-emerald-400/40 bg-white dark:bg-slate-900 shadow-xs'
                    : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs'
                }`}
              >
                {/* TOPO DO CARD: NÚMERO DA CASA BEM DESTACADO + TIPO + STATUS */}
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Badge Destacado do Número da Residência (Estilo Placa) */}
                    <div
                      className={`h-8 px-2.5 rounded-xl font-mono font-black text-sm sm:text-base flex items-center gap-1 shrink-0 shadow-2xs border transition-all ${
                        isVila
                          ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-400/40'
                          : isApto
                          ? 'bg-sky-500/15 text-sky-900 dark:text-sky-200 border-sky-400/40'
                          : 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-emerald-400/40'
                      }`}
                    >
                      <span className="text-[10px] font-bold opacity-60">Nº</span>
                      <span>{house.houseNumber}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {subLabel && isManilhaActive && (
                          <span className="text-[9px] font-black bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md truncate max-w-[110px]">
                            {subLabel}
                          </span>
                        )}
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                          {isVila ? 'Vila' : isApto ? 'Prédio' : 'Casa'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                          • {house.residents.length} {house.residents.length === 1 ? 'morador' : 'moradores'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações da Casa: Status da Rota e + Morador */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {someInRoute && (
                      <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-300/60 dark:border-emerald-800/80">
                        {inRouteCount}/{house.residents.length} rota
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectForManualAdd(house.houseNumber, '', house.subStreet)}
                      className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer touch-manipulation active:scale-95 border border-slate-200 dark:border-slate-700"
                      title={`Cadastrar novo morador no Nº ${house.houseNumber}`}
                      aria-label="Adicionar morador"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </button>
                  </div>
                </div>

                {/* LISTA DE MORADORES: BOTÕES GRANDES PARA O POLEGAR (INSPIRADOS NO MODAL DE RUAS) */}
                <div className="space-y-1.5">
                  {house.residents.map((res) => {
                    const inRoute = isResidentInRoute(house, res);

                    return (
                      <div
                        key={res.id}
                        className="flex items-center gap-1.5"
                      >
                        {/* Botão Principal do Morador: Área de Toque Generosa (min 50px) */}
                        <button
                          type="button"
                          onClick={() => handleAddSingleSaved(house, res)}
                          className={`flex-1 min-h-[50px] p-2.5 sm:px-3 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] ${
                            inRoute
                              ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/30 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 hover:bg-slate-100/90 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                          }`}
                          title={
                            inRoute
                              ? 'Já adicionado na rota de hoje! Toque para adicionar outro pacote.'
                              : 'Toque para adicionar este morador à rota de hoje!'
                          }
                        >
                          {/* Lado Esquerdo: Ícone / Indicador de Seleção + Nome do Morador */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Indicador Circular Estilo Modal de Ruas */}
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                inRoute
                                  ? 'bg-emerald-500 text-white shadow-xs ring-2 ring-emerald-500/20'
                                  : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {inRoute ? (
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              ) : (
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <span
                                className={`font-black text-xs sm:text-sm block truncate leading-tight ${
                                  inRoute
                                    ? 'text-emerald-950 dark:text-emerald-200'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {res.name}
                              </span>
                              {res.complement && (
                                <span
                                  className={`text-[11px] block truncate font-semibold mt-0.5 ${
                                    inRoute
                                      ? 'text-emerald-800/80 dark:text-emerald-400'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {res.complement}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Lado Direito: Badge Visual Claro do Estado */}
                          <div className="shrink-0">
                            {inRoute ? (
                              <span className="text-[10px] font-black bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>Na Rota</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 px-2 py-1 rounded-lg">
                                + Rota
                              </span>
                            )}
                          </div>
                        </button>

                        {/* Botão de Excluir Morador da Memória (Discreto e Seguro) */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRes(house, res.id, e)}
                          className="w-8 h-[50px] flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0 touch-manipulation active:scale-95"
                          title="Remover morador da memória desta casa"
                          aria-label="Remover morador"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

