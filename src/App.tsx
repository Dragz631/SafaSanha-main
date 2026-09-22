import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Header } from './components/Header';
import { FloatingMoneyReward } from './components/FloatingMoneyReward';
import { CashCelebrationBurst } from './components/CashCelebrationBurst';
import { StreetPackageManager } from './components/StreetPackageManager';
import { GeneralSummaryTab } from './components/GeneralSummaryTab';
import { CloseDayModal } from './components/CloseDayModal';
import { AssociationTab } from './components/AssociationTab';
import { DailyStreetPickerModal } from './components/DailyStreetPickerModal';
import { DeliveryData } from './types';
import { CAJU_PRIMARY_AREAS } from './data/cajuStreets';
import { MemoriaProvider } from './state/MemoriaContext';
import { contarPacotes, pacotesDaRua, ruasDosPacotes, statusEntregue } from './domain/ruas';
import { dataLocal } from './domain/data';
import { chaveTexto } from './domain/texto';
import { gravarJSON, lerJSON, removerChave, useFalhasDeGravacao } from './utils/persistencia';
import { recuperarFotosDaFilaAntiga } from './utils/migracaoFotos';

// Função para normalizar e remover duplicatas na lista de ruas
const normalizeStreetList = (list: string[]): string[] => {
  const map = new Map<string, string>();
  list.forEach((st) => {
    const clean = st?.trim();
    // Filtra travessas de letras da Manilha para não aparecerem como botões soltos no topo
    if (clean && !/^rua\s+[a-k]$/i.test(clean) && !map.has(clean.toLowerCase())) {
      map.set(clean.toLowerCase(), clean);
    }
  });
  return Array.from(map.values());
};

const LOCAL_STORAGE_KEY = 'logiscan_deliveries_prod_v1';
const STREETS_STORAGE_KEY = 'logiscan_today_streets_v5';
const DAILY_CONFIRMED_DATE_KEY = 'safasanha_today_selection_date_v3';
/** Pacote fictício que a versão antiga gravava sozinha no primeiro uso. */
const ID_PACOTE_DEMO = 'del_init_1';

const DEFAULT_STREETS = CAJU_PRIMARY_AREAS;

function carregarPacotes(): DeliveryData[] {
  // Fotos que a versão antiga só guardava na fila do SafaSanhaso voltam para os pacotes (migração única).
  recuperarFotosDaFilaAntiga(LOCAL_STORAGE_KEY);
  const salvos = lerJSON<unknown>(LOCAL_STORAGE_KEY, []);
  if (!Array.isArray(salvos)) return [];
  return (salvos as DeliveryData[]).filter((d) => d && d.id_entrega !== ID_PACOTE_DEMO);
}

function AvisoArmazenamento() {
  const falhas = useFalhasDeGravacao();
  if (falhas.length === 0) return null;
  return (
    <div role="alert" className="sticky top-0 z-40 bg-rose-600 text-white text-xs font-bold px-3 py-2 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>
        Não foi possível salvar no aparelho (armazenamento cheio ou bloqueado). As últimas alterações podem se perder ao fechar o app.
        Encerre o dia para arquivar as entregas ou libere espaço.
      </span>
    </div>
  );
}

function Conteudo() {
  const [activeTab, setActiveTab] = useState<'ruas' | 'resumo' | 'associacao'>(() => {
    try {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam === 'resumo' || tabParam === 'associacao' || tabParam === 'ruas') return tabParam;
    } catch (_e) {}
    return 'ruas';
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const themeParam = new URLSearchParams(window.location.search).get('theme');
      if (themeParam === 'dark' || themeParam === 'light') return themeParam;
      const saved = localStorage.getItem('safasanha_theme_v2');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (_e) {}
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem('safasanha_theme_v2', theme);
    } catch (_e) {}
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const [activeStreet, setActiveStreet] = useState<string>('Rua Carlos Seidl');
  const [isRegionModalOpen, setIsRegionModalOpen] = useState<boolean>(false);
  const [isCloseDayModalOpen, setIsCloseDayModalOpen] = useState<boolean>(false);

  // Seletor diário de ruas ("Qual as ruas de hoje?") — abre sozinho na primeira vez de cada dia.
  const [isDailyStreetPickerOpen, setIsDailyStreetPickerOpen] = useState<boolean>(() => {
    try {
      if (new URLSearchParams(window.location.search).get('tab') === 'resumo') return false;
      return localStorage.getItem(DAILY_CONFIRMED_DATE_KEY) !== dataLocal();
    } catch (_e) {
      return false;
    }
  });

  // Lista de ruas selecionadas para a rota de hoje
  const [savedStreets, setSavedStreets] = useState<string[]>(() => {
    const parsed = lerJSON<unknown>(STREETS_STORAGE_KEY, null);
    if (Array.isArray(parsed) && parsed.length > 0) return normalizeStreetList(parsed as string[]);
    return normalizeStreetList(DEFAULT_STREETS);
  });

  // Entregas do dia (começam vazias; nenhum dado de demonstração é injetado)
  const [deliveries, setDeliveries] = useState<DeliveryData[]>(carregarPacotes);

  useEffect(() => {
    gravarJSON(LOCAL_STORAGE_KEY, deliveries);
  }, [deliveries]);

  useEffect(() => {
    gravarJSON(STREETS_STORAGE_KEY, savedStreets);
  }, [savedStreets]);

  // Ruas dos pacotes carregados entram na lista da região (sem duplicar e sem soltar sub-ruas da Manilha)
  useEffect(() => {
    setSavedStreets((prev) => {
      const map = new Map<string, string>();
      prev.forEach((st) => {
        const clean = st?.trim();
        if (clean && !/^rua\s+[a-k]$/i.test(clean)) map.set(chaveTexto(clean), clean);
      });
      let changed = false;
      ruasDosPacotes(deliveries).forEach((st) => {
        if (!/^rua\s+[a-k]$/i.test(st) && !map.has(chaveTexto(st))) {
          map.set(chaveTexto(st), st);
          changed = true;
        }
      });
      return changed ? Array.from(map.values()) : prev;
    });
  }, [deliveries]);

  // Handlers de Ruas
  const handleAddStreet = (newStreet: string) => {
    const clean = newStreet.trim();
    if (!clean) return;
    setSavedStreets((prev) => (prev.some((s) => chaveTexto(s) === chaveTexto(clean)) ? prev : [...prev, clean]));
    setActiveStreet(clean);
  };

  const handleDeleteStreet = (streetToDelete: string) => {
    const remaining = savedStreets.filter((s) => chaveTexto(s) !== chaveTexto(streetToDelete));
    setSavedStreets(remaining);
    if (chaveTexto(activeStreet) === chaveTexto(streetToDelete) && remaining.length > 0) {
      setActiveStreet(remaining[0]);
    }
  };

  const handleRenameStreet = (oldName: string, newName: string) => {
    const cleanNew = newName.trim();
    if (!cleanNew) return;
    setSavedStreets((prev) => normalizeStreetList(prev.map((s) => (chaveTexto(s) === chaveTexto(oldName) ? cleanNew : s))));
    if (chaveTexto(activeStreet) === chaveTexto(oldName)) setActiveStreet(cleanNew);
    // Atualiza pacotes que tinham a rua antiga (o vínculo de destino é refeito pela chave nova ao editar/cadastrar)
    setDeliveries((prev) =>
      prev.map((d) =>
        chaveTexto(d.endereco_rua) === chaveTexto(oldName)
          ? {
              ...d,
              endereco_rua: cleanNew,
              endereco_completo: `${cleanNew}, ${d.numero_casa || 'S/N'}${d.complemento ? ` (${d.complemento})` : ''}`,
              destino_id: undefined,
            }
          : d
      )
    );
  };

  // Handlers de Entregas
  const handleAddDelivery = (newDelivery: DeliveryData) => setDeliveries((prev) => [newDelivery, ...prev]);

  const handleAddBatchDeliveries = (newDeliveries: DeliveryData[]) => {
    if (newDeliveries.length === 0) return;
    setDeliveries((prev) => [...newDeliveries, ...prev]);
  };

  const handleUpdateDelivery = (updated: DeliveryData) =>
    setDeliveries((prev) => prev.map((d) => (d.id_entrega === updated.id_entrega ? updated : d)));

  const handleDeleteDelivery = (id: string) => setDeliveries((prev) => prev.filter((d) => d.id_entrega !== id));

  const handleClearAllDeliveries = () => {
    if (window.confirm('Deseja realmente limpar todos os pacotes e começar um novo dia de entregas?')) {
      setDeliveries([]);
      removerChave(LOCAL_STORAGE_KEY);
    }
  };

  // Contagem da rua ativa — a MESMA função usada por todas as telas
  const streetDeliveries = useMemo(() => pacotesDaRua(deliveries, activeStreet), [deliveries, activeStreet]);
  const { entregues: deliveredCount, insucessos: insucessoCount, pendentes: pendingCount } = useMemo(
    () => contarPacotes(streetDeliveries),
    [streetDeliveries]
  );

  // Moedas de Ouro do Dia: cada pacote entregue soma 2 moedas
  const coinsToday = useMemo(() => deliveries.filter(statusEntregue).length * 2, [deliveries]);

  const handleConfirmDailyStreets = (selected: string[]) => {
    if (selected.length > 0) {
      setSavedStreets(selected);
      if (!selected.some((s) => chaveTexto(s) === chaveTexto(activeStreet))) setActiveStreet(selected[0]);
    }
    try {
      localStorage.setItem(DAILY_CONFIRMED_DATE_KEY, dataLocal());
    } catch (_e) {}
  };

  return (
    <div
      className={`min-h-screen font-sans flex flex-col antialiased transition-colors duration-200 selection:bg-emerald-500 selection:text-white ${
        theme === 'dark' ? 'dark bg-[#090d16] text-slate-100' : 'bg-[#f4f6f9] text-slate-900'
      }`}
    >
      <AvisoArmazenamento />

      <Header
        activeStreet={activeStreet}
        theme={theme}
        onToggleTheme={toggleTheme}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenStreetPicker={() => setIsRegionModalOpen(true)}
        onOpenDailyStreetPicker={() => setIsDailyStreetPickerOpen(true)}
        onOpenAddStreet={() => setIsRegionModalOpen(true)}
        pendingCount={pendingCount}
        totalCount={streetDeliveries.length}
        deliveredCount={deliveredCount}
        insucessoCount={insucessoCount}
        totalAllDeliveries={deliveries.length}
        coinsToday={coinsToday}
      />

      <main className="flex-1 max-w-xl mx-auto w-full px-3 sm:px-4 py-2">
        {activeTab === 'ruas' && (
          <StreetPackageManager
            deliveries={deliveries}
            activeStreet={activeStreet}
            savedStreets={savedStreets}
            onSelectStreet={setActiveStreet}
            onAddStreet={handleAddStreet}
            onDeleteStreet={handleDeleteStreet}
            onRenameStreet={handleRenameStreet}
            onAddDelivery={handleAddDelivery}
            onAddBatchDeliveries={handleAddBatchDeliveries}
            onUpdateDelivery={handleUpdateDelivery}
            onDeleteDelivery={handleDeleteDelivery}
            onClearAllDeliveries={handleClearAllDeliveries}
            isRegionModalOpen={isRegionModalOpen}
            onOpenRegionModal={() => setIsRegionModalOpen(true)}
            onCloseRegionModal={() => setIsRegionModalOpen(false)}
            onOpenDailyStreetPicker={() => setIsDailyStreetPickerOpen(true)}
            onOpenCloseDayModal={() => setIsCloseDayModalOpen(true)}
          />
        )}

        {activeTab === 'resumo' && (
          <GeneralSummaryTab
            deliveries={deliveries}
            savedStreets={savedStreets}
            onSelectStreet={(street) => {
              setActiveStreet(street);
              setActiveTab('ruas');
            }}
            onClearAllDeliveries={handleClearAllDeliveries}
            onUpdateDelivery={handleUpdateDelivery}
            onSetDeliveries={setDeliveries}
          />
        )}

        {activeTab === 'associacao' && <AssociationTab />}
      </main>

      <FloatingMoneyReward />
      <CashCelebrationBurst />

      <CloseDayModal
        isOpen={isCloseDayModalOpen}
        deliveries={deliveries}
        onClose={() => setIsCloseDayModalOpen(false)}
        onConfirmCloseDay={(params) => {
          setDeliveries(params.nextDayDeliveries);
          setIsCloseDayModalOpen(false);
          setIsDailyStreetPickerOpen(false);
          setActiveTab('resumo');
        }}
      />

      <DailyStreetPickerModal
        isOpen={isDailyStreetPickerOpen}
        savedStreets={savedStreets}
        deliveries={deliveries}
        onClose={() => setIsDailyStreetPickerOpen(false)}
        onConfirmStreets={handleConfirmDailyStreets}
        onOpenAssociacaoTab={() => setActiveTab('associacao')}
      />
    </div>
  );
}

export default function App() {
  return (
    <MemoriaProvider>
      <Conteudo />
    </MemoriaProvider>
  );
}
