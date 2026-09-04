import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { FloatingMoneyReward } from './components/FloatingMoneyReward';
import { CashCelebrationBurst } from './components/CashCelebrationBurst';
import { StreetPackageManager } from './components/StreetPackageManager';
import { GeneralSummaryTab } from './components/GeneralSummaryTab';
import { CloseDayModal } from './components/CloseDayModal';
import { AssociationTab } from './components/AssociationTab';
import { DailyStreetPickerModal } from './components/DailyStreetPickerModal';
import { DeliveryWhatsAppModal } from './components/DeliveryWhatsAppModal';
import { DeliveryData } from './types';
import { INITIAL_DELIVERIES } from './data/sampleData';
import { CAJU_PRIMARY_AREAS, isManilhaDelivery } from './data/cajuStreets';

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
const DAILY_CONFIRMED_DATE_KEY = 'safasanha_today_selection_date_v2';

const DEFAULT_STREETS = CAJU_PRIMARY_AREAS;

export default function App() {
  const [activeTab, setActiveTab] = useState<'ruas' | 'resumo' | 'associacao'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'resumo' || tabParam === 'associacao' || tabParam === 'ruas') return tabParam;
    } catch (_e) {}
    return 'ruas';
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const themeParam = params.get('theme');
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
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };
  const [activeStreet, setActiveStreet] = useState<string>('Rua Carlos Seidl');
  const [isRegionModalOpen, setIsRegionModalOpen] = useState<boolean>(false);
  const [isCloseDayModalOpen, setIsCloseDayModalOpen] = useState<boolean>(false);

  // Modal Diário de Seleção 3x3 do Wireframe ("Qual as ruas de hoje?")
  const [isDailyStreetPickerOpen, setIsDailyStreetPickerOpen] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('modal') === 'picker') return true;
      if (params.get('tab') === 'resumo') return false;
      const todayStr = new Date().toISOString().slice(0, 10);
      const confirmedDate = localStorage.getItem(DAILY_CONFIRMED_DATE_KEY);
      // Se ainda não confirmou as ruas para o dia de hoje, abre automaticamente ao iniciar!
      return confirmedDate !== todayStr;
    } catch (_e) {
      return false;
    }
  });

  // Lista de ruas selecionadas para a rota de hoje
  const [savedStreets, setSavedStreets] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STREETS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeStreetList(parsed);
        }
      }
    } catch (_e) {}
    return normalizeStreetList(DEFAULT_STREETS);
  });

  // Lista de entregas e pacotes para uso em produção (inicialmente limpo)
  const [deliveries, setDeliveries] = useState<DeliveryData[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Sanitização de segurança: se a rua for Carlos Seidl ou outra rua normal, remove sub_rua_manilha residual
          return parsed.map((d: DeliveryData) => {
            const rua = (d.endereco_rua || '').toLowerCase().trim();
            if (
              rua.includes('carlos seidl') ||
              rua.includes('general sampaio') ||
              rua.includes('general gurjão') ||
              rua.includes('praia do caju') ||
              rua.includes('monsenhor') ||
              rua.includes('tavares')
            ) {
              return {
                ...d,
                sub_rua_manilha: undefined,
              };
            }
            return d;
          });
        }
      }
    } catch (_e) {}
    return INITIAL_DELIVERIES;
  });

  // Salva entregas no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(deliveries));
    } catch (_e) {}
  }, [deliveries]);

  // Salva ruas da região no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STREETS_STORAGE_KEY, JSON.stringify(savedStreets));
    } catch (_e) {}
  }, [savedStreets]);

  // Sincroniza ruas dos pacotes carregados para a lista da região de forma segura e sem duplicar
  useEffect(() => {
    setSavedStreets((prev) => {
      const map = new Map<string, string>();
      prev.forEach((st) => {
        const clean = st?.trim();
        if (clean && !/^rua\s+[a-k]$/i.test(clean)) {
          map.set(clean.toLowerCase(), clean);
        }
      });
      let changed = false;
      deliveries.forEach((d) => {
        const st = d.endereco_rua || d.endereco_completo?.split(',')[0]?.trim();
        // Não adiciona sub-ruas ou letras da Manilha como abas soltas no topo
        if (st && !isManilhaDelivery(d) && !/^rua\s+[a-k]$/i.test(st) && !map.has(st.trim().toLowerCase())) {
          map.set(st.trim().toLowerCase(), st.trim());
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
    setSavedStreets((prev) => {
      if (prev.some((s) => s.toLowerCase() === clean.toLowerCase())) {
        return prev;
      }
      return [...prev, clean];
    });
    setActiveStreet(clean);
  };

  const handleDeleteStreet = (streetToDelete: string) => {
    setSavedStreets((prev) => prev.filter((s) => s.toLowerCase() !== streetToDelete.toLowerCase()));
    if (activeStreet.toLowerCase() === streetToDelete.toLowerCase()) {
      setSavedStreets((prev) => {
        const remaining = prev.filter((s) => s.toLowerCase() !== streetToDelete.toLowerCase());
        if (remaining.length > 0) {
          setActiveStreet(remaining[0]);
        }
        return remaining;
      });
    }
  };

  const handleRenameStreet = (oldName: string, newName: string) => {
    const cleanNew = newName.trim();
    if (!cleanNew) return;
    setSavedStreets((prev) =>
      normalizeStreetList(prev.map((s) => (s.toLowerCase() === oldName.toLowerCase() ? cleanNew : s)))
    );
    if (activeStreet.toLowerCase() === oldName.toLowerCase()) {
      setActiveStreet(cleanNew);
    }
    // Atualiza pacotes que tinham a rua antiga
    setDeliveries((prev) =>
      prev.map((d) => {
        if (d.endereco_rua?.toLowerCase() === oldName.toLowerCase()) {
          return {
            ...d,
            endereco_rua: cleanNew,
            endereco_completo: `${cleanNew}, ${d.numero_casa || 'S/N'}`,
          };
        }
        return d;
      })
    );
  };

  // Handlers de Entregas (100% em memória local com LocalStorage instantâneo)
  const handleAddDelivery = (newDelivery: DeliveryData) => {
    setDeliveries((prev) => [newDelivery, ...prev]);
  };

  const handleAddBatchDeliveries = (newDeliveries: DeliveryData[]) => {
    if (newDeliveries.length === 0) return;
    setDeliveries((prev) => [...newDeliveries, ...prev]);
  };

  const handleUpdateDelivery = (updated: DeliveryData) => {
    setDeliveries((prev) =>
      prev.map((d) => (d.id_entrega === updated.id_entrega ? updated : d))
    );
  };

  const handleDeleteDelivery = (id: string) => {
    setDeliveries((prev) => prev.filter((d) => d.id_entrega !== id));
  };

  const handleClearAllDeliveries = () => {
    if (window.confirm('Deseja realmente limpar todos os pacotes e começar um novo dia de entregas?')) {
      setDeliveries([]);
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch (_e) {}
    }
  };

  // Pacotes da rua ativa
  const streetDeliveries = useMemo(() => {
    const cleanActive = activeStreet.trim().toLowerCase();
    return deliveries.filter((d) => {
      const st = (d.endereco_rua || d.endereco_completo || '').toLowerCase();
      return st.includes(cleanActive) || cleanActive.includes(st);
    });
  }, [deliveries, activeStreet]);

  const deliveredCount = streetDeliveries.filter(
    (d) => d.status === 'entregue' || d.status === 'concluido'
  ).length;
  const insucessoCount = streetDeliveries.filter(
    (d) => d.status === 'insucesso'
  ).length;
  const pendingCount = streetDeliveries.length - deliveredCount - insucessoCount;

  // Moedas de Ouro do Dia: Cada pacote entregue soma 2 moedas de ouro
  const totalDeliveredAll = useMemo(() => {
    return deliveries.filter(
      (d) => d.status === 'entregue' || d.status === 'concluido'
    ).length;
  }, [deliveries]);

  const coinsToday = totalDeliveredAll * 2;

  // Confirmação do Seletor 3x3 de Ruas Diárias
  const handleConfirmDailyStreets = (selected: string[]) => {
    if (selected.length > 0) {
      setSavedStreets(selected);
      if (!selected.some((s) => s.toLowerCase() === activeStreet.toLowerCase())) {
        setActiveStreet(selected[0]);
      }
    }
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      localStorage.setItem(DAILY_CONFIRMED_DATE_KEY, todayStr);
    } catch (_e) {}
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col antialiased transition-colors duration-200 selection:bg-emerald-500 selection:text-white ${
    theme === 'dark' ? 'dark bg-[#090d16] text-slate-100' : 'bg-[#f4f6f9] text-slate-900'
  }`}>
      {/* Header Compacto Mobile */}
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

      {/* Conteúdo Principal de acordo com a Aba Ativa */}
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

        {activeTab === 'associacao' && (
          <AssociationTab />
        )}
      </main>

      {/* Recompensa Leve de Moedas Flutuante Não-Bloqueante */}
      <FloatingMoneyReward />
      {/* Efeito Visual Rico de Moedas e Notas Voadoras */}
      <CashCelebrationBurst />

      {/* Modal de Encerramento do Dia Global */}
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

      {/* Seletor Diário de Ruas (Grid 3x3 do Wireframe) */}
      <DailyStreetPickerModal
        isOpen={
          isDailyStreetPickerOpen &&
          new URLSearchParams(window.location.search).get('picker') !== 'false' &&
          !new URLSearchParams(window.location.search).get('modal')
        }
        savedStreets={savedStreets}
        deliveries={deliveries}
        onClose={() => setIsDailyStreetPickerOpen(false)}
        onConfirmStreets={handleConfirmDailyStreets}
        onOpenAssociacaoTab={() => setActiveTab('associacao')}
      />

      {/* Visualização para Modais de Entrega: Registro, Corrigir, Familiar e Vizinho */}
      {Boolean(new URLSearchParams(window.location.search).get('modal')) && (
        <DeliveryWhatsAppModal
          isOpen={true}
          delivery={{
            id_entrega: 'preview_del_1',
            codigo_pacote: '#BR987654321',
            nome_destinatario: 'Maria Oliveira Santos',
            endereco_rua: 'Rua Carlos Seidl',
            numero_casa: '142',
            complemento: 'Casa 2',
            status:
              new URLSearchParams(window.location.search).get('modal') === 'registro' ||
              new URLSearchParams(window.location.search).get('modal') === 'corrigir'
                ? 'entregue'
                : 'aguardando_rua',
            recebedor_tipo:
              new URLSearchParams(window.location.search).get('modal') === 'familiar'
                ? 'familiar'
                : new URLSearchParams(window.location.search).get('modal') === 'vizinho'
                ? 'vizinho'
                : 'portaria',
            recebedor_detalhes:
              new URLSearchParams(window.location.search).get('modal') === 'familiar'
                ? 'Familiar (Filho: Lucas)'
                : new URLSearchParams(window.location.search).get('modal') === 'vizinho'
                ? 'Vizinho Nº 144 (Dona Maria)'
                : 'Portaria (José Carlos)',
            data_hora: new Date().toISOString(),
          }}
          initialEditingReceipt={new URLSearchParams(window.location.search).get('modal') === 'corrigir'}
          onClose={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('modal');
            window.history.pushState({}, '', url);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
