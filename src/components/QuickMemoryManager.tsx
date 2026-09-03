import React, { useState, useMemo } from 'react';
import {
  Building,
  Home,
  MapPin,
  Plus,
  Check,
  UserPlus,
  Trash2,
  Search,
  Compass,
  Layers,
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
    if (window.confirm('Remover este morador da memória?')) {
      deleteSavedResident(targetStreetKey, house.houseNumber, residentId, house.subStreet);
      setRefreshKey((k) => k + 1);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* SE FOR MANILHA: DIVISÃO ESPECIALIZADA ENTRE AS RUAS DO MEIO/LADOS E RUAS COM LETRAS */}
      {isManilhaActive && (
        <div className="space-y-1.5 bg-black/30 p-2 rounded-xl border border-white/10">
          {/* Nível 1: Abas Principais da Manilha */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setManilhaCategory('todas');
                setSelectedSubStreet('todas');
              }}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                manilhaCategory === 'todas'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <Compass className="w-3 h-3" />
              <span>Todas Manilha ({allSavedHouses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setManilhaCategory('principais');
                setSelectedSubStreet('todas');
              }}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                manilhaCategory === 'principais'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <span>📍 Meio & Lados</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setManilhaCategory('letras');
                setSelectedSubStreet('todas');
              }}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                manilhaCategory === 'letras'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <span>🔤 Letras (A a K)</span>
            </button>
          </div>

          {/* Nível 2: Seletor Específico de Ruas / Letras da Manilha */}
          {manilhaCategory === 'principais' && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
              <button
                type="button"
                onClick={() => setSelectedSubStreet('todas')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 transition-all cursor-pointer ${
                  selectedSubStreet === 'todas'
                    ? 'bg-white text-slate-950 font-black'
                    : 'bg-white/15 text-white hover:bg-white/25'
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
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                      selectedSubStreet === st.name
                        ? 'bg-white text-slate-950 font-black'
                        : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    <span>{st.shortLabel}</span>
                    <span className="text-[9px] bg-black/20 px-1 py-0.2 rounded-sm opacity-80">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {manilhaCategory === 'letras' && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
              <button
                type="button"
                onClick={() => setSelectedSubStreet('todas')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 transition-all cursor-pointer ${
                  selectedSubStreet === 'todas'
                    ? 'bg-white text-slate-950 font-black'
                    : 'bg-white/15 text-white hover:bg-white/25'
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
                    className={`w-6 h-6 rounded-md text-[11px] font-black shrink-0 transition-all cursor-pointer flex items-center justify-center relative ${
                      selectedSubStreet === st.name
                        ? 'bg-white text-slate-950 font-black scale-105'
                        : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                    title={`${st.name} (${count} casas salvas)`}
                  >
                    {letter}
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400"></span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Barra de Busca de Casas/Moradores Memorizados */}
      {allSavedHouses.length > 3 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-white/60 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={
              isManilhaActive
                ? 'Buscar por Rua/Letra, número ou morador da Manilha...'
                : 'Filtrar por número ou morador salvo...'
            }
            className="w-full pl-8 pr-3 py-1.5 bg-black/25 text-white placeholder-white/50 rounded-xl text-xs font-bold focus:outline-none focus:bg-black/35 border border-white/10"
          />
        </div>
      )}

      {/* Lista Vazia */}
      {filteredHouses.length === 0 && (
        <div className="bg-white/10 dark:bg-slate-900/60 rounded-xl p-3 text-center space-y-2 border border-white/10">
          <div className="w-8 h-8 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center mx-auto text-sm">
            💡
          </div>
          <p className="text-xs font-bold text-white">
            {isManilhaActive && selectedSubStreet !== 'todas'
              ? `Nenhum número memorizado na ${selectedSubStreet} ainda.`
              : 'Nenhum número memorizado nesta área ainda.'}
          </p>
          <p className="text-[11px] text-white/70">
            Digite o número e morador na aba <b>"✍️ Digitar Novo"</b>. Ele será gravado para sempre!
          </p>
          <button
            type="button"
            onClick={() => onSelectForManualAdd('', '', selectedSubStreet !== 'todas' ? selectedSubStreet : undefined)}
            className="mt-1 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl cursor-pointer shadow-xs"
          >
            ✍️ Cadastrar Primeiro Número {selectedSubStreet !== 'todas' ? `na ${selectedSubStreet}` : ''}
          </button>
        </div>
      )}

      {/* Grid de Cards dos Números e Moradores Memorizados */}
      {filteredHouses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-0.5 no-scrollbar">
          {filteredHouses.map((house) => {
            const isVila = house.type === 'vila';
            const isApto = house.type === 'apartamento';
            const subLabel = house.subStreet || (isManilhaActive ? 'Manilha' : undefined);

            return (
              <div
                key={`${house.subStreet || ''}_${house.houseNumber}`}
                className="bg-black/25 hover:bg-black/35 rounded-xl p-2.5 border border-white/10 flex flex-col justify-between gap-2 transition-all"
              >
                {/* Cabeçalho do Número com a Sub-Rua / Letra (se for Manilha) */}
                <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                        isVila
                          ? 'bg-amber-400 text-slate-950'
                          : isApto
                          ? 'bg-sky-400 text-slate-950'
                          : 'bg-emerald-400 text-slate-950'
                      }`}
                    >
                      {isVila ? <Home className="w-3.5 h-3.5" /> : isApto ? <Building className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        {subLabel && isManilhaActive && (
                          <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-md truncate max-w-[120px]">
                            {subLabel}
                          </span>
                        )}
                        <span className="font-black text-xs text-white">
                          Nº {house.houseNumber}
                        </span>
                        <span className="text-[10px] text-white/70 font-bold">
                          {isVila ? 'Vila' : isApto ? 'Prédio' : 'Casa'} ({house.residents.length})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botão para Adicionar Outro Morador a Este Mesmo Número */}
                  <button
                    type="button"
                    onClick={() => onSelectForManualAdd(house.houseNumber, '', house.subStreet)}
                    className="px-1.5 py-0.5 bg-white/15 hover:bg-white/30 text-amber-200 text-[10px] font-black rounded-md flex items-center gap-1 cursor-pointer transition-all shrink-0"
                    title={`Adicionar novo morador no Nº ${house.houseNumber}`}
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>+ Morador</span>
                  </button>
                </div>

                {/* Lista de Moradores Cadastrados com Botão de 1 Toque para Entrar na Rota */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {house.residents.map((res) => {
                    const inRoute = isResidentInRoute(house, res);

                    return (
                      <div key={res.id} className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleAddSingleSaved(house, res)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                            inRoute
                              ? 'bg-emerald-500 text-white border border-emerald-300/40 font-black'
                              : 'bg-white text-slate-900 hover:bg-amber-300 hover:text-slate-950'
                          }`}
                          title={
                            inRoute
                              ? 'Já adicionado na rota de hoje! Clique para adicionar outro pacote.'
                              : 'Clique para adicionar este pacote à rota de hoje!'
                          }
                        >
                          {inRoute ? (
                            <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span>
                            {res.complement ? `${res.complement}: ` : ''}
                            {res.name}
                          </span>
                          {inRoute && (
                            <span className="text-[9px] bg-emerald-700/80 px-1 py-0.2 rounded-md uppercase tracking-wider font-bold">
                              Na Rota
                            </span>
                          )}
                        </button>

                        {/* Excluir Morador da Memória */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRes(house, res.id, e)}
                          className="p-1 text-white/40 hover:text-rose-400 hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                          title="Remover morador da memória"
                        >
                          <Trash2 className="w-3 h-3" />
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
