import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { StreetPackageManager } from './components/StreetPackageManager';
import { GeneralSummaryTab } from './components/GeneralSummaryTab';
import { AssociationTab } from './components/AssociationTab';
import { DeliveryData } from './types';
import { INITIAL_DELIVERIES } from './data/sampleData';

// Função para normalizar e remover duplicatas na lista de ruas
const normalizeStreetList = (list: string[]): string[] => {
  const map = new Map<string, string>();
  list.forEach((st) => {
    const clean = st?.trim();
    if (clean && !map.has(clean.toLowerCase())) {
      map.set(clean.toLowerCase(), clean);
    }
  });
  return Array.from(map.values());
};

const LOCAL_STORAGE_KEY = 'logiscan_deliveries_prod_v1';
const STREETS_STORAGE_KEY = 'logiscan_region_streets_v3';

const DEFAULT_STREETS = [
  'Rua Carlos Seidl',
  'Rua Conde de Leopoldina',
  'Rua Bela',
  'Travessa do Triunfo',
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'ruas' | 'resumo' | 'associacao'>('ruas');
  const [activeStreet, setActiveStreet] = useState<string>('Rua Carlos Seidl');
  const [isRegionModalOpen, setIsRegionModalOpen] = useState<boolean>(false);

  // Lista de ruas da região persistidas no LocalStorage sem duplicatas
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
          return parsed;
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
        if (clean) map.set(clean.toLowerCase(), clean);
      });
      let changed = false;
      deliveries.forEach((d) => {
        const st = d.endereco_rua || d.endereco_completo?.split(',')[0]?.trim();
        if (st && !map.has(st.trim().toLowerCase())) {
          map.set(st.trim().toLowerCase(), st.trim());
          changed = true;
        }
      });
      return changed ? Array.from(map.values()) : prev;
    });
  }, [deliveries]);

  // Sincroniza com o backend se disponível
  useEffect(() => {
    fetch('/api/deliveries')
      .then((res) => res.json())
      .then((data: DeliveryData[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setDeliveries(data);
        }
      })
      .catch((_err) => {});
  }, []);

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

  // Handlers de Entregas
  const handleAddDelivery = (newDelivery: DeliveryData) => {
    setDeliveries((prev) => [newDelivery, ...prev]);
    // Garante que a rua do pacote está nas ruas da região
    if (newDelivery.endereco_rua) {
      handleAddStreet(newDelivery.endereco_rua);
    }
    fetch('/api/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDelivery),
    }).catch(() => {});
  };

  const handleAddBatchDeliveries = (newDeliveries: DeliveryData[]) => {
    if (newDeliveries.length === 0) return;
    setDeliveries((prev) => [...newDeliveries, ...prev]);

    // Agrega novas ruas unicamente em lote sem chamadas repetidas
    const newStreets: string[] = [];
    newDeliveries.forEach((d) => {
      const st = d.endereco_rua || d.endereco_completo?.split(',')[0]?.trim();
      if (st && !newStreets.some((s) => s.toLowerCase() === st.toLowerCase())) {
        newStreets.push(st);
      }
    });

    if (newStreets.length > 0) {
      setSavedStreets((prev) => normalizeStreetList([...prev, ...newStreets]));
    }

    newDeliveries.forEach((d) => {
      fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).catch(() => {});
    });
  };

  const handleUpdateDelivery = (updated: DeliveryData) => {
    setDeliveries((prev) =>
      prev.map((d) => (d.id_entrega === updated.id_entrega ? updated : d))
    );
    fetch('/api/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});
  };

  const handleDeleteDelivery = (id: string) => {
    setDeliveries((prev) => prev.filter((d) => d.id_entrega !== id));
    fetch(`/api/deliveries/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleClearAllDeliveries = () => {
    if (window.confirm('Deseja realmente limpar todos os pacotes e começar um novo dia de entregas?')) {
      setDeliveries([]);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
      {/* Header Compacto Mobile */}
      <Header
        activeStreet={activeStreet}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenStreetPicker={() => setIsRegionModalOpen(true)}
        onOpenAddStreet={() => setIsRegionModalOpen(true)}
        pendingCount={pendingCount}
        totalCount={streetDeliveries.length}
        deliveredCount={deliveredCount}
        insucessoCount={insucessoCount}
        totalAllDeliveries={deliveries.length}
      />

      {/* Conteúdo Principal de acordo com a Aba Ativa */}
      <main className="flex-1">
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
          />
        )}

        {activeTab === 'associacao' && (
          <AssociationTab />
        )}
      </main>
    </div>
  );
}
