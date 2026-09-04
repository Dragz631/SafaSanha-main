import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  MapPin,
  Camera,
  Plus,
  Search,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Package,
  Share2,
  Clock,
  Sparkles,
  ChevronDown,
  Edit3,
  Trash2,
  SlidersHorizontal,
  Layers,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Zap,
  Mic,
  ListPlus,
  Navigation,
  Compass
} from 'lucide-react';
import { DeliveryData } from '../types';
import { PackageCard } from './PackageCard';
import { HouseGroupCard } from './HouseGroupCard';
import { ManilhaSubStreetCard } from './ManilhaSubStreetCard';
import { GroupedDeliveryWhatsAppModal } from './GroupedDeliveryWhatsAppModal';
import { QuickPackageScannerModal } from './QuickPackageScannerModal';
import { ManualPackageModal } from './ManualPackageModal';
import { DeliveryWhatsAppModal } from './DeliveryWhatsAppModal';
import { RegionStreetsModal } from './RegionStreetsModal';
import { QuickBatchAddModal } from './QuickBatchAddModal';
import { triggerCoinBurst } from '../utils/rewardEffect';
import { StreetAddressMemoryModal } from './StreetAddressMemoryModal';
import { QuickMemoryManager } from './QuickMemoryManager';
import { StreetCompletedModal } from './StreetCompletedModal';
import { saveAddressToMemory, getSavedAddressesForStreet } from '../utils/addressMemoryStorage';
import {
  getStreetInfo,
  MANILHA_SUB_STREETS,
  isManilhaDelivery,
  getManilhaSubStreet
} from '../data/cajuStreets';


export type ComplementGroupType = 'portaria' | 'vila' | 'residencia';

export const classifyComplementType = (comp?: string): ComplementGroupType => {
  if (!comp) return 'residencia';
  const c = comp.toLowerCase().trim();

  // Prédio / Apartamento / Portaria
  if (
    c.includes('apto') ||
    c.includes('apartamento') ||
    c.includes('bloco') ||
    c.includes('sala') ||
    c.includes('conjunto') ||
    c.includes('condominio') ||
    c.includes('cond.') ||
    c.includes('cobertura') ||
    c.includes('edificio') ||
    c.includes('ed.')
  ) {
    return 'portaria';
  }

  // Vila / Casas
  if (
    c.includes('casa') ||
    c.includes('vila') ||
    c.includes('fundos') ||
    c.includes('frente') ||
    c.includes('sobrado') ||
    c.includes('terreo') ||
    c.includes('vilinha') ||
    c.includes('bione')
  ) {
    return 'vila';
  }

  return 'residencia';
};

interface StreetPackageManagerProps {
  deliveries: DeliveryData[];
  activeStreet: string;
  savedStreets: string[];
  onSelectStreet: (street: string) => void;
  onAddStreet: (streetName: string) => void;
  onDeleteStreet: (streetName: string) => void;
  onRenameStreet: (oldName: string, newName: string) => void;
  onAddDelivery: (delivery: DeliveryData) => void;
  onAddBatchDeliveries?: (deliveries: DeliveryData[]) => void;
  onUpdateDelivery: (delivery: DeliveryData) => void;
  onDeleteDelivery: (id: string) => void;
  onClearAllDeliveries?: () => void;
  isRegionModalOpen?: boolean;
  onOpenRegionModal?: () => void;
  onCloseRegionModal?: () => void;
  onOpenDailyStreetPicker?: () => void;
  onOpenCloseDayModal?: () => void;
}

export const StreetPackageManager: React.FC<StreetPackageManagerProps> = ({
  deliveries,
  activeStreet,
  savedStreets,
  onSelectStreet,
  onAddStreet,
  onDeleteStreet,
  onRenameStreet,
  onAddDelivery,
  onAddBatchDeliveries,
  onUpdateDelivery,
  onDeleteDelivery,
  onClearAllDeliveries,
  isRegionModalOpen,
  onOpenRegionModal,
  onCloseRegionModal,
  onOpenDailyStreetPicker,
  onOpenCloseDayModal,
}) => {
  // Modais locais
  const [internalRegionModalOpen, setInternalRegionModalOpen] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState<boolean>(false);
  const [editingDelivery, setEditingDelivery] = useState<DeliveryData | null>(null);
  
  // Identifica se a área ativa é o Setor Unificado da Manilha
  const isManilhaActive = useMemo(() => {
    const clean = activeStreet.toLowerCase().trim();
    return clean === 'manilha' || clean.includes('manilha') || clean.includes('penha');
  }, [activeStreet]);

  // Sub-rua selecionada para cadastro rápido na Manilha
  const [manilhaSubStreet, setManilhaSubStreet] = useState<string>('Rua Leão XIII');

  // Estado da Barra de Entrada Relâmpago (Direto na tela principal)
  const [quickHouseNumber, setQuickHouseNumber] = useState<string>('');
  const [quickComplement, setQuickComplement] = useState<string>('');
  const [quickClientName, setQuickClientName] = useState<string>('');
  const [quickToast, setQuickToast] = useState<string | null>(null);
  const quickInputRef = useRef<HTMLInputElement | null>(null);
  const quickComplementInputRef = useRef<HTMLInputElement | null>(null);

  // Voz para a barra rápida
  const [isQuickListening, setIsQuickListening] = useState(false);
  const quickRecognitionRef = useRef<any>(null);

  // Modal WhatsApp (Entrega vs Insucesso)
  const [selectedForDelivery, setSelectedForDelivery] = useState<DeliveryData | null>(null);
  const [deliveryModalMode, setDeliveryModalMode] = useState<'entrega' | 'insucesso'>('entrega');
  const [selectedGroupForDelivery, setSelectedGroupForDelivery] = useState<DeliveryData[] | null>(null);

  // Modo de visualização: Agrupado por Casas/Portaria (Padrão) ou Lista Individual
  const [viewMode, setViewMode] = useState<'grouped' | 'individual'>('grouped');

  // Filtros e Busca
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendente' | 'entregue' | 'insucesso'>('todos');
  const [sortBy, setSortBy] = useState<'numero_asc' | 'numero_desc' | 'pendentes_primeiro' | 'hora_desc' | 'codigo'>('numero_asc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cadastroTab, setCadastroTab] = useState<'rapido' | 'digitar'>('rapido');

  // Casas salvas na memória para esta rua
  const savedAddressesForActiveStreet = useMemo(() => {
    return getSavedAddressesForStreet(isManilhaActive ? 'Manilha' : activeStreet);
  }, [activeStreet, isManilhaActive, isMemoryModalOpen, deliveries]);

  // Sugestões instantâneas ao digitar número
  const quickNumberSuggestions = useMemo(() => {
    if (!quickHouseNumber.trim()) return [];
    const clean = quickHouseNumber.trim().toLowerCase();
    const match = savedAddressesForActiveStreet.find(
      (h) => h.houseNumber.toLowerCase() === clean
    );
    return match ? match.residents : [];
  }, [quickHouseNumber, savedAddressesForActiveStreet]);

  const regionModalOpen = isRegionModalOpen !== undefined ? isRegionModalOpen : internalRegionModalOpen;
  const openRegionModal = onOpenRegionModal || (() => setInternalRegionModalOpen(true));
  const closeRegionModal = onCloseRegionModal || (() => setInternalRegionModalOpen(false));

  // Inicializa reconhecimento de voz com extração inteligente de Complemento
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'pt-BR';
      rec.continuous = false;
      rec.interimResults = false;

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        let working = transcript;
        let extractedComp = '';

        // Procura por termos comuns de complemento (Ex: "Apto 302", "Bloco B", "Casa 2", "Fundos", "Loja 5")
        const compMatch = working.match(/(?:apto|apartamento|bloco|casa|fundos|sobrado|loja|sala)\s*[\d\w]+/i);
        if (compMatch) {
          extractedComp = compMatch[0];
          setQuickComplement(extractedComp);
          working = working.replace(compMatch[0], '').trim();
        }

        const match = working.match(/(?:casa|número|numero)?\s*(\d+[a-zA-Z]?)\s*(.*)/i);
        if (match) {
          setQuickHouseNumber(match[1]);
          if (match[2]?.trim()) setQuickClientName(match[2].trim());
        } else {
          const nums = working.match(/\d+/);
          if (nums) setQuickHouseNumber(nums[0]);
          else setQuickClientName(working);
        }
        setIsQuickListening(false);
      };

      rec.onerror = () => setIsQuickListening(false);
      rec.onend = () => setIsQuickListening(false);
      quickRecognitionRef.current = rec;
    }
  }, []);

  const toggleQuickVoice = () => {
    if (!quickRecognitionRef.current) {
      alert('Voz não suportada neste dispositivo.');
      return;
    }
    if (isQuickListening) {
      quickRecognitionRef.current.stop();
      setIsQuickListening(false);
    } else {
      try {
        quickRecognitionRef.current.start();
        setIsQuickListening(true);
      } catch (_e) {
        setIsQuickListening(false);
      }
    }
  };

  // Pacotes pertencentes à rua/área ativa
  const streetDeliveries = useMemo(() => {
    if (isManilhaActive) {
      return deliveries.filter((d) => isManilhaDelivery(d));
    }
    const cleanActive = activeStreet.trim().toLowerCase();
    return deliveries.filter((d) => {
      const st = (d.endereco_rua || '').trim().toLowerCase();
      if (st && (st === cleanActive || cleanActive.includes(st) || st.includes(cleanActive))) {
        return true;
      }
      if (isManilhaDelivery(d)) return false;
      const comp = (d.endereco_completo || '').toLowerCase();
      return comp.includes(cleanActive) || cleanActive.includes(comp);
    });
  }, [deliveries, activeStreet, isManilhaActive]);

  // Contadores da rua ativa
  const totalCount = streetDeliveries.length;
  const deliveredCount = streetDeliveries.filter(
    (d) => d.status === 'entregue' || d.status === 'concluido'
  ).length;
  const insucessoCount = streetDeliveries.filter(
    (d) => d.status === 'insucesso'
  ).length;
  const pendingCount = totalCount - deliveredCount - insucessoCount;

  // Lista de pacotes que tiveram insucesso nesta rua
  const failedDeliveries = useMemo(
    () => streetDeliveries.filter((d) => d.status === 'insucesso'),
    [streetDeliveries]
  );

  // Calcula quantas outras ruas ainda possuem pacotes pendentes
  const remainingStreets = useMemo(() => {
    const streetPendingMap = new Map<string, number>();
    deliveries.forEach((d) => {
      const isPending =
        d.status !== 'entregue' && d.status !== 'concluido' && d.status !== 'insucesso';
      if (isPending) {
        const st = d.sub_rua_manilha || d.endereco_rua || 'Outra Rua';
        streetPendingMap.set(st, (streetPendingMap.get(st) || 0) + 1);
      }
    });

    const currentKey = isManilhaActive ? 'Manilha' : activeStreet;
    streetPendingMap.delete(currentKey);
    if (isManilhaActive && manilhaSubStreet) {
      streetPendingMap.delete(manilhaSubStreet);
    }
    return Array.from(streetPendingMap.keys());
  }, [deliveries, activeStreet, isManilhaActive, manilhaSubStreet]);

  // Modal de Celebração de Rua Finalizada & Decisão de Insucessos
  const [isStreetCompletedModalOpen, setIsStreetCompletedModalOpen] = useState<boolean>(false);
  const prevPendingRef = useRef<number | null>(null);
  const completedStreetRef = useRef<string>('');

  useEffect(() => {
    if (
      prevPendingRef.current !== null &&
      prevPendingRef.current > 0 &&
      pendingCount === 0 &&
      totalCount > 0 &&
      completedStreetRef.current !== activeStreet
    ) {
      completedStreetRef.current = activeStreet;
      const timer = setTimeout(() => {
        setIsStreetCompletedModalOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }

    prevPendingRef.current = pendingCount;
    if (pendingCount > 0) {
      completedStreetRef.current = '';
    }
  }, [pendingCount, totalCount, activeStreet]);

  // Handler de Adição Relâmpago (1 Toque / Enter)
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = quickHouseNumber.trim();
    if (!cleanNum) {
      quickInputRef.current?.focus();
      return;
    }

    const client = quickClientName.trim() || 'Morador';
    const comp = quickComplement.trim();
    const code = `#${Math.floor(1000 + Math.random() * 9000)}`;

    const targetStreet = isManilhaActive ? 'Manilha' : activeStreet;
    const targetSub = isManilhaActive ? manilhaSubStreet : undefined;
    const fullAddress = isManilhaActive
      ? `${manilhaSubStreet}, ${cleanNum}${comp ? ` (${comp})` : ''} (Manilha • Caju)`
      : `${activeStreet}, ${cleanNum}${comp ? ` (${comp})` : ''}`;

    const newDelivery: DeliveryData = {
      id_entrega: `del_${Date.now()}`,
      codigo_pacote: code,
      nome_destinatario: client,
      recebedor_detalhes: client,
      recebedor_tipo: 'proprio_morador',
      endereco_rua: targetStreet,
      sub_rua_manilha: targetSub,
      numero_casa: cleanNum,
      endereco_numero: cleanNum,
      complemento: comp || undefined,
      endereco_completo: fullAddress,
      foto_pacote_path: '',
      foto_local_path: '',
      data_hora: new Date().toISOString(),
      status: 'aguardando_rua',
      origem_leitura: 'manual',
    };

    // Salva imediatamente na memória da rua
    try {
      saveAddressToMemory(targetStreet, cleanNum, comp || undefined, client, targetSub);
    } catch (_err) {}

    onAddDelivery(newDelivery);
    setFilterStatus('todos');
    setSearchQuery('');

    try {
      if ('vibrate' in navigator) navigator.vibrate(40);
    } catch (_e) {}

    const toastMsg = isManilhaActive
      ? `✅ ${manilhaSubStreet} Nº ${cleanNum} adicionado na Manilha!`
      : `✅ Nº ${cleanNum} ${comp ? `(${comp})` : ''} adicionado!`;

    setQuickToast(toastMsg);
    setQuickHouseNumber('');
    setQuickComplement('');
    setQuickClientName('');
    quickInputRef.current?.focus();

    setTimeout(() => {
      setQuickToast(null);
    }, 2200);
  };

  // Filtro de busca e status
  const filteredDeliveries = useMemo(() => {
    return streetDeliveries.filter((d) => {
      const isDel = d.status === 'entregue' || d.status === 'concluido';
      const isIns = d.status === 'insucesso';
      const isPend = !isDel && !isIns;

      if (filterStatus === 'pendente' && !isPend) return false;
      if (filterStatus === 'entregue' && !isDel) return false;
      if (filterStatus === 'insucesso' && !isIns) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const client = (d.nome_destinatario || d.recebedor_detalhes || '').toLowerCase();
        const code = d.codigo_pacote.toLowerCase();
        const num = (d.numero_casa || d.endereco_numero || '').toLowerCase();
        const complement = (d.complemento || d.endereco_complemento || '').toLowerCase();
        const sub = (d.sub_rua_manilha || '').toLowerCase();
        return (
          client.includes(q) ||
          code.includes(q) ||
          num.includes(q) ||
          complement.includes(q) ||
          sub.includes(q)
        );
      }

      return true;
    });
  }, [streetDeliveries, filterStatus, searchQuery]);

  // Ordenação dos pacotes
  const sortedDeliveries = useMemo(() => {
    return [...filteredDeliveries].sort((a, b) => {
      if (sortBy === 'pendentes_primeiro') {
        const aIsPend = a.status !== 'entregue' && a.status !== 'concluido' && a.status !== 'insucesso';
        const bIsPend = b.status !== 'entregue' && b.status !== 'concluido' && b.status !== 'insucesso';
        if (aIsPend && !bIsPend) return -1;
        if (!aIsPend && bIsPend) return 1;
        const numA = parseInt(a.numero_casa || a.endereco_numero || '0', 10) || 0;
        const numB = parseInt(b.numero_casa || b.endereco_numero || '0', 10) || 0;
        return numA - numB;
      }
      if (sortBy === 'numero_asc' || sortBy === 'numero_desc') {
        const numA = parseInt(a.numero_casa || a.endereco_numero || '0', 10) || 0;
        const numB = parseInt(b.numero_casa || b.endereco_numero || '0', 10) || 0;
        return sortBy === 'numero_asc' ? numA - numB : numB - numA;
      }
      if (sortBy === 'codigo') {
        return a.codigo_pacote.localeCompare(b.codigo_pacote);
      }
      return new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime();
    });
  }, [filteredDeliveries, sortBy]);

  // Agrupamento por sub-rua da Manilha (quando na Manilha)
  const manilhaSubGroups = useMemo(() => {
    if (!isManilhaActive) return [];

    return MANILHA_SUB_STREETS.map((subDef) => {
      const items = sortedDeliveries.filter(
        (d) => getManilhaSubStreet(d).toLowerCase() === subDef.name.toLowerCase()
      );
      return {
        subDef,
        items,
        count: items.length,
      };
    }).filter((g) => g.count > 0);
  }, [isManilhaActive, sortedDeliveries]);

  // Agrupamento Inteligente por Número E Complemento (Diferencia Vila e Apartamento no mesmo número!)
  const groupedHouses = useMemo(() => {
    // 1. Mapeia todos os pacotes pelo número da casa
    const houseNumberMap = new Map<string, DeliveryData[]>();

    sortedDeliveries.forEach((d) => {
      const num = d.numero_casa || d.endereco_numero || 'S/N';
      if (!houseNumberMap.has(num)) {
        houseNumberMap.set(num, []);
      }
      houseNumberMap.get(num)!.push(d);
    });

    interface SubGroupItem {
      groupKey: string;
      houseNumber: string;
      category: 'portaria' | 'vila' | 'residencia';
      groupLabel: string;
      items: DeliveryData[];
      count: number;
      hasMultiple: boolean;
    }

    const groups: SubGroupItem[] = [];

    // 2. Para cada número, separa em grupos dedicados:
    //    - Prédio / Apartamentos (Portaria)
    //    - Vila de Casas (Entrega individual)
    //    - Residência única (Sem complemento ou morador único)
    houseNumberMap.forEach((items, houseNumber) => {
      const aptoItems: DeliveryData[] = [];
      const vilaItems: DeliveryData[] = [];
      const residenciaItems: DeliveryData[] = [];

      items.forEach((d) => {
        const cat = classifyComplementType(d.complemento || d.endereco_complemento);
        if (cat === 'portaria') {
          aptoItems.push(d);
        } else if (cat === 'vila') {
          vilaItems.push(d);
        } else {
          residenciaItems.push(d);
        }
      });

      // SE HOUVER APARTAMENTOS: Cria Card dedicado de Prédio / Portaria
      if (aptoItems.length > 0) {
        groups.push({
          groupKey: `${houseNumber}_portaria`,
          houseNumber,
          category: 'portaria',
          groupLabel: `Nº ${houseNumber} • Prédio / Apartamentos`,
          items: aptoItems,
          count: aptoItems.length,
          hasMultiple: aptoItems.length > 1,
        });
      }

      // SE HOUVER VILA DE CASAS: Cria Card dedicado de Vila (Entrega de casa em casa!)
      if (vilaItems.length > 0) {
        // Se houver residências avulsas neste número que também tem vila, incorpora na vila
        const mergedVila = [...vilaItems, ...residenciaItems];
        groups.push({
          groupKey: `${houseNumber}_vila`,
          houseNumber,
          category: 'vila',
          groupLabel: `Nº ${houseNumber} • Vila de Casas`,
          items: mergedVila,
          count: mergedVila.length,
          hasMultiple: mergedVila.length > 1,
        });
      } else if (residenciaItems.length > 0) {
        // Apenas residência normal
        groups.push({
          groupKey: `${houseNumber}_residencia`,
          houseNumber,
          category: 'residencia',
          groupLabel: `Nº ${houseNumber}`,
          items: residenciaItems,
          count: residenciaItems.length,
          hasMultiple: residenciaItems.length > 1,
        });
      }
    });

    return groups;
  }, [sortedDeliveries]);

  const multipleHousesCount = useMemo(() => {
    return groupedHouses.filter((g) => g.hasMultiple).length;
  }, [groupedHouses]);

  // Toggle rápido da direção de número de casas (1->100 vs 100->1)
  const toggleSortDirection = () => {
    if (sortBy === 'numero_asc') {
      setSortBy('numero_desc');
    } else {
      setSortBy('numero_asc');
    }
  };

  // Estado do Efeito Visual de Dinheiro na Entrega
  const [rewardState, setRewardState] = useState<{
    isVisible: boolean;
    packageCount?: number;
    clientName?: string;
  }>({ isVisible: false });

  const triggerReward = (count: number = 1, clientName?: string) => {
    setRewardState({
      isVisible: true,
      packageCount: count,
      clientName,
    });
  };

  const activeStreetInfo = useMemo(() => getStreetInfo(activeStreet), [activeStreet]);

  const handleOpenDeliveryModal = (del: DeliveryData, mode: 'entrega' | 'insucesso' = 'entrega') => {
    setSelectedForDelivery(del);
    setDeliveryModalMode(mode);
  };

  const handleOpenGroupDeliveryModal = (groupItems: DeliveryData[]) => {
    setSelectedGroupForDelivery(groupItems);
  };

  const handleConfirmGroupDelivery = (updatedList: DeliveryData[]) => {
    updatedList.forEach((d) => {
      onUpdateDelivery(d);
    });
    setSelectedGroupForDelivery(null);
  };

  return (
    <div className="space-y-3 pb-24">
      {/* 1. PAINEL DE CONTROLE DA RUA ATIVA COM BARRA DE PROGRESSO & RUAS DO DIA */}
      <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80 shadow-md space-y-3.5 transition-colors">
        
        {/* Rua Atual & Botão Trocar Rua */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black shrink-0 shadow-sm border ${
              isManilhaActive 
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/30' 
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              {isManilhaActive ? <Navigation className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {isManilhaActive ? 'Setor Unificado' : 'Rua em Atendimento'}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${activeStreetInfo.badgeColor}`}>
                  {activeStreetInfo.sector}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-slate-100 leading-snug tracking-tight truncate">
                {activeStreet}
              </h1>
            </div>
          </div>

          <button
            onClick={onOpenDailyStreetPicker || openRegionModal}
            className="h-10 px-3.5 bg-slate-800 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1.5 transition-all active:scale-95 shadow-sm touch-manipulation"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="hidden xs:inline">Ruas de Hoje</span>
            <span className="xs:hidden">Ruas</span>
          </button>
        </div>

        {/* Indicador de Progresso com Contadores Integrados e Elegantes */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-slate-300">
              Progresso da Rua
            </span>
            <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-slate-800 text-emerald-400 border border-slate-700/50">
              {totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0}%
            </span>
          </div>

          {/* Barra de Progresso Suave */}
          <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden flex shadow-inner">
            <div
              className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{
                width: `${totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0}%`,
              }}
            />
          </div>

          {/* Métricas Compactas em Linha */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-[11px] font-bold">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Total:</span>
              <span className="text-slate-100 font-extrabold text-xs">{totalCount}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-xs shadow-emerald-400/50"></span>
                <span>{deliveredCount} entregues</span>
              </div>

              <div className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                <span>{pendingCount} pendentes</span>
              </div>

              {insucessoCount > 0 && (
                <div className="flex items-center gap-1 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
                  <span>{insucessoCount} falhas</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Atalhos de Ruas Selecionadas para Hoje em carrossel ergonômico */}
        <div className="pt-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] font-black text-slate-400 shrink-0 uppercase tracking-wider pl-0.5">
            Rotas:
          </span>
          {savedStreets.map((st) => {
            const isCurrent = activeStreet.toLowerCase() === st.toLowerCase();
            const isMan = st.toLowerCase() === 'manilha' || st.toLowerCase().includes('manilha');
            return (
              <button
                key={st}
                onClick={() => onSelectStreet(st)}
                className={`h-9 px-3.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 touch-manipulation ${
                  isCurrent
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                    : isMan
                    ? 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 border border-amber-400/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700/60'
                }`}
              >
                <span>{isMan ? '🏗️' : '📍'}</span>
                <span>{st}</span>
              </button>
            );
          })}
          <button
            onClick={onOpenDailyStreetPicker || openRegionModal}
            className="h-9 px-3 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-slate-750 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer shrink-0 flex items-center gap-1 touch-manipulation"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Ruas</span>
          </button>
        </div>
      </div>

      {/* 2. ÁREA DE CADASTRO E MODO RÁPIDO (LIMPO E ERGONÔMICO) */}
      <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-slate-800/90 shadow-md space-y-3">
        {/* Cabeçalho da Seção de Cadastro */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-wide text-slate-200">
              {isManilhaActive ? '🏗️ Entrada na Manilha' : `📍 Nova Entrega na ${activeStreet}`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsBatchModalOpen(true)}
            className="h-8 px-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all border border-slate-700/70"
            title="Digitar ou colar vários pacotes de uma vez"
          >
            <ListPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>Em Lote</span>
          </button>
        </div>

        {/* SELETOR DE SUB-RUA EXCLUSIVO DA MANILHA */}
        {isManilhaActive && (
          <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] font-black uppercase text-amber-300/90 block">
              Selecione a Sub-Rua da Manilha:
            </span>

            {/* Vias Centrais */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {MANILHA_SUB_STREETS.filter((s) => s.type === 'principal').map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setManilhaSubStreet(st.name);
                    quickInputRef.current?.focus();
                  }}
                  className={`h-8 px-3 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                    manilhaSubStreet === st.name
                      ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                      : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700/50'
                  }`}
                >
                  {st.name} ({st.shortLabel})
                </button>
              ))}
            </div>

            {/* Travessas de Letras (Ordem Alfabética: A a K) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              <span className="text-[10px] font-black text-slate-400 shrink-0">
                Letras:
              </span>
              {MANILHA_SUB_STREETS.filter((s) => s.type === 'letra').map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setManilhaSubStreet(st.name);
                    quickInputRef.current?.focus();
                  }}
                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                    manilhaSubStreet === st.name
                      ? 'bg-amber-400 text-slate-950 shadow-sm scale-105'
                      : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700/50'
                  }`}
                  title={st.name}
                >
                  {st.name.replace(/rua\s*/i, '').toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ABAS DO CADASTRO: MODO RÁPIDO (CASAS SALVAS) vs DIGITAR NOVO */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/70 rounded-xl border border-slate-800/80 gap-1">
          <button
            type="button"
            onClick={() => setCadastroTab('rapido')}
            className={`h-10 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 touch-manipulation ${
              cadastroTab === 'rapido'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>⚡ Casas Salvas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCadastroTab('digitar');
              setTimeout(() => quickInputRef.current?.focus(), 80);
            }}
            className={`h-10 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 touch-manipulation ${
              cadastroTab === 'digitar'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>✍️ Digitar Novo</span>
          </button>
        </div>

        {/* CONTEÚDO DINÂMICO: MODO RÁPIDO (SELEÇÃO DIRETA) OU FORMULÁRIO DE DIGITAÇÃO */}
        {cadastroTab === 'rapido' ? (
          <div className="pt-1">
            <QuickMemoryManager
              streetName={activeStreet}
              isManilhaActive={isManilhaActive}
              manilhaSubStreet={manilhaSubStreet}
              currentDeliveries={deliveries}
              onAddDelivery={(newDel) => {
                onAddDelivery(newDel);
                setFilterStatus('todos');
                setSearchQuery('');
              }}
              onSelectForManualAdd={(houseNum, comp, subStreet) => {
                setQuickHouseNumber(houseNum);
                if (comp) setQuickComplement(comp);
                if (subStreet) setManilhaSubStreet(subStreet);
                setCadastroTab('digitar');
                setTimeout(() => {
                  quickComplementInputRef.current?.focus();
                }, 100);
              }}
              onToast={(msg) => {
                setQuickToast(msg);
                setTimeout(() => setQuickToast(null), 2500);
              }}
            />
          </div>
        ) : (
          <form onSubmit={handleQuickAdd} className="space-y-2.5 pt-1">
            <div className="flex items-center gap-2">
              {/* Campo de Número da Casa - Foco Primário do Dedo */}
              <div className="w-28 sm:w-32 shrink-0">
                <input
                  ref={quickInputRef}
                  type="text"
                  inputMode="numeric"
                  value={quickHouseNumber}
                  onChange={(e) => setQuickHouseNumber(e.target.value)}
                  placeholder="Nº Casa"
                  className="w-full h-12 px-3 bg-slate-950 text-white placeholder-slate-500 border border-slate-700/80 rounded-xl text-lg font-black text-center focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Campo de Complemento (Apto, Bloco, etc.) */}
              <div className="flex-1 min-w-0">
                <input
                  ref={quickComplementInputRef}
                  type="text"
                  value={quickComplement}
                  onChange={(e) => setQuickComplement(e.target.value)}
                  placeholder="Compl. (Apto, Bloco...)"
                  className="w-full h-12 px-3 bg-slate-950 text-white placeholder-slate-500 border border-slate-700/80 rounded-xl text-sm font-bold text-center focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Botão de Voz */}
              <button
                type="button"
                onClick={toggleQuickVoice}
                className={`w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                  isQuickListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/80'
                }`}
                title="Falar número e complemento por voz"
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>

            {/* Linha 2: Nome do Morador + Botão de Adicionar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={quickClientName}
                  onChange={(e) => setQuickClientName(e.target.value)}
                  placeholder="Nome do Morador (Opcional)"
                  className="w-full h-12 px-3.5 bg-slate-950 text-white placeholder-slate-500 border border-slate-700/80 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="h-12 px-5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-sm rounded-xl shadow-md cursor-pointer shrink-0 flex items-center gap-1.5 transition-all touch-manipulation"
                title="Adicionar Pacote e Salvar na Memória"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                <span>Adicionar</span>
              </button>
            </div>

            {/* Chips Rápidos de Complementos Mais Usados */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">
                +Compl:
              </span>
              {['Apto ', 'Bloco A', 'Bloco B', 'Casa 1', 'Casa 2', 'Fundos', 'Sobrado'].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setQuickComplement(chip);
                    quickComplementInputRef.current?.focus();
                  }}
                  className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center ${
                    quickComplement.toLowerCase().includes(chip.trim().toLowerCase())
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  {chip.trim()}
                </button>
              ))}
              {quickComplement && (
                <button
                  type="button"
                  onClick={() => setQuickComplement('')}
                  className="h-7 px-2 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 shrink-0"
                  title="Limpar complemento"
                >
                  ✕
                </button>
              )}
            </div>
          </form>
        )}

        {/* Toast Flutuante de Sucesso Rápido */}
        {quickToast && (
          <div className="text-xs font-extrabold text-emerald-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-emerald-500/30 text-center animate-fadeIn shadow-sm">
            {quickToast}
          </div>
        )}
      </div>

      {/* 3. FILTRO, BUSCA E ORDENAÇÃO DINÂMICA */}
      <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl p-3 border border-slate-800/80 shadow-sm space-y-2.5 transition-colors">
        {/* Campo de Busca Rápida */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isManilhaActive
                ? 'Buscar por Rua (Ex: Rua B), nº ou morador...'
                : 'Buscar por Nº casa, morador ou pacote...'
            }
            className="w-full h-11 pl-10 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-bold"
          />
        </div>

        {/* Tabs de Filtro e Seletor de Ordenação */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-0.5">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-bold">
            <button
              onClick={() => setFilterStatus('todos')}
              className={`h-9 px-3 rounded-xl cursor-pointer shrink-0 transition-all ${
                filterStatus === 'todos'
                  ? 'bg-slate-100 text-slate-950 font-black shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700/50'
              }`}
            >
              Todos ({totalCount})
            </button>
            <button
              onClick={() => setFilterStatus('pendente')}
              className={`h-9 px-3 rounded-xl cursor-pointer shrink-0 transition-all ${
                filterStatus === 'pendente'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                  : 'bg-slate-800 text-amber-400 hover:bg-slate-750 border border-slate-700/50'
              }`}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('entregue')}
              className={`h-9 px-3 rounded-xl cursor-pointer shrink-0 transition-all ${
                filterStatus === 'entregue'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                  : 'bg-slate-800 text-emerald-400 hover:bg-slate-750 border border-slate-700/50'
              }`}
            >
              Entregues ({deliveredCount})
            </button>
            {insucessoCount > 0 && (
              <button
                onClick={() => setFilterStatus('insucesso')}
                className={`h-9 px-3 rounded-xl cursor-pointer shrink-0 transition-all ${
                  filterStatus === 'insucesso'
                    ? 'bg-rose-600 text-white font-black shadow-sm'
                    : 'bg-slate-800 text-rose-400 hover:bg-slate-750 border border-slate-700/50'
                }`}
              >
                Falhas ({insucessoCount})
              </button>
            )}
          </div>

          {/* Seletor de Ordenação */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={toggleSortDirection}
              className="h-9 px-2.5 bg-slate-800 hover:bg-slate-750 rounded-xl text-slate-300 cursor-pointer text-xs font-bold flex items-center gap-1 border border-slate-700/60"
              title="Inverter ordem dos números"
            >
              {sortBy === 'numero_asc' ? (
                <>
                  <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px]">1 → 100</span>
                </>
              ) : sortBy === 'numero_desc' ? (
                <>
                  <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px]">100 → 1</span>
                </>
              ) : (
                <ArrowUpDown className="w-3.5 h-3.5" />
              )}
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 px-2.5 bg-slate-800 border border-slate-700/60 rounded-xl text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="numero_asc">Nº Casa (1 → 100)</option>
              <option value="numero_desc">Nº Casa (100 → 1)</option>
              <option value="pendentes_primeiro">Pendentes Primeiro</option>
              <option value="hora_desc">Mais Recentes</option>
              <option value="codigo">Código Pacote</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. MODOS DE VISUALIZAÇÃO */}
      <div className="px-0.5">
        <div className="grid grid-cols-2 p-1 bg-slate-900/90 rounded-xl border border-slate-800/80 gap-1 shadow-sm">
          <button
            onClick={() => setViewMode('grouped')}
            className={`h-9 px-2.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 touch-manipulation ${
              viewMode === 'grouped'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>
              {isManilhaActive
                ? `🏗️ Ruas Manilha (${manilhaSubGroups.length})`
                : `🏢 Por Casas (${groupedHouses.length})`}
            </span>
          </button>

          <button
            onClick={() => setViewMode('individual')}
            className={`h-9 px-2.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 touch-manipulation ${
              viewMode === 'individual'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📦 Individual ({sortedDeliveries.length})</span>
          </button>
        </div>
      </div>

      {/* 5. LISTA DE PACOTES / ESTRUTURAÇÃO DA MANILHA OU RUA NORMAL */}
      <div className="space-y-3">
        {isManilhaActive ? (
          /* VISUALIZAÇÃO UNIFICADA DA MANILHA (CARDS AGRUPADOS POR SUB-RUA / LETRAS A A K EM ORDEM ALFABÉTICA) */
          manilhaSubGroups.length > 0 ? (
            manilhaSubGroups.map((group) => (
              <ManilhaSubStreetCard
                key={group.subDef.id}
                subStreetDef={group.subDef}
                deliveries={group.items}
                viewMode={viewMode}
                onOpenSingleDeliveryModal={(del, mode) => handleOpenDeliveryModal(del, mode || 'entrega')}
                onOpenGroupDeliveryModal={(items) => handleOpenGroupDeliveryModal(items)}
                onEditDelivery={(del) => setEditingDelivery(del)}
                onDeleteDelivery={(id) => onDeleteDelivery(id)}
                onUpdateDelivery={(del) => {
                  onUpdateDelivery(del);
                  if (del.status === 'entregue' || del.status === 'concluido') {
                    triggerReward(1, del.nome_destinatario);
                  }
                }}
              />
            ))
          ) : (
            <div className="bg-white rounded-3xl p-8 border-2 border-dashed border-amber-300 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <Navigation className="w-6 h-6" />
              </div>
              <h3 className="font-black text-slate-900 text-sm">
                Nenhum pacote cadastrado na Manilha ainda
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Escolha a rua acima (Leão XIII, Canal, Penha ou Letras A a K), digite o número da casa e adicione!
              </p>
            </div>
          )
        ) : (
          /* VISUALIZAÇÃO DE RUA NORMAL DO CAJU */
          sortedDeliveries.length > 0 ? (
            viewMode === 'grouped' ? (
              groupedHouses.map((group) => (
                <HouseGroupCard
                  key={group.groupKey || group.houseNumber}
                  houseNumber={group.houseNumber}
                  forcedCategory={group.category}
                  groupLabel={group.groupLabel}
                  deliveries={group.items}
                  onOpenSingleDeliveryModal={(del, mode) => handleOpenDeliveryModal(del, mode || 'entrega')}
                  onOpenGroupDeliveryModal={(items) => handleOpenGroupDeliveryModal(items)}
                  onEditDelivery={(del) => setEditingDelivery(del)}
                  onDeleteDelivery={(id) => onDeleteDelivery(id)}
                  onUpdateDelivery={(del) => {
                    onUpdateDelivery(del);
                    if (del.status === 'entregue' || del.status === 'concluido') {
                      triggerReward(1, del.nome_destinatario);
                    }
                  }}
                />
              ))
            ) : (
              sortedDeliveries.map((delivery, index) => (
                <PackageCard
                  key={delivery.id_entrega}
                  index={index}
                  delivery={delivery}
                  onDeliverClick={(del) => handleOpenDeliveryModal(del, 'entrega')}
                  onOpenDeliveryModal={(del, mode) => handleOpenDeliveryModal(del, mode || 'entrega')}
                  onEditClick={(del) => setEditingDelivery(del)}
                  onEdit={(del) => setEditingDelivery(del)}
                  onDeleteClick={(id) => onDeleteDelivery(id)}
                  onDelete={(id) => onDeleteDelivery(id)}
                  onQuickStatusChange={(del, status) => {
                    onUpdateDelivery({ ...del, status });
                    if (status === 'entregue' || status === 'concluido') {
                      triggerReward(1, del.nome_destinatario);
                    }
                  }}
                  onToggleStatus={(del) => {
                    const targetStatus = del.status === 'entregue' ? 'aguardando_rua' : 'entregue';
                    onUpdateDelivery({
                      ...del,
                      status: targetStatus,
                    });
                    if (targetStatus === 'entregue') {
                      triggerReward(1, del.nome_destinatario);
                    }
                  }}
                />
              ))
            )
          ) : (
            <div className="bg-white rounded-3xl p-8 border-2 border-dashed border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="font-black text-slate-900 text-sm">
                Nenhum pacote cadastrado para {activeStreet}
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Use a barra de entrada rápida acima para adicionar o primeiro pacote pelo número da casa.
              </p>
            </div>
          )
        )}
      </div>

      {/* MODAL REGIONAL DE SELEÇÃO DE RUAS DO CAJU PARA HOJE */}
      <RegionStreetsModal
        isOpen={regionModalOpen}
        activeStreet={activeStreet}
        savedStreets={savedStreets}
        deliveries={deliveries}
        onClose={closeRegionModal}
        onSelectStreet={onSelectStreet}
        onAddStreet={onAddStreet}
        onDeleteStreet={onDeleteStreet}
        onRenameStreet={onRenameStreet}
      />

      {/* MODAL DE CADASTRO MANUAL COMPLETO */}
      <ManualPackageModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSave={(data) => {
          onAddDelivery(data);
          setIsManualModalOpen(false);
        }}
        activeStreet={activeStreet}
      />

      {/* MODAL DE CADASTRO EM LOTE */}
      <QuickBatchAddModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        activeStreet={activeStreet}
        onSaveBatch={(batch) => {
          if (onAddBatchDeliveries) {
            onAddBatchDeliveries(batch);
          } else {
            batch.forEach((d) => onAddDelivery(d));
          }
          setIsBatchModalOpen(false);
        }}
      />

      {/* MODAL WHATSAPP PARA ENTREGA INDIVIDUAL */}
      {selectedForDelivery && (
        <DeliveryWhatsAppModal
          isOpen={true}
          delivery={selectedForDelivery}
          mode={deliveryModalMode}
          onClose={() => setSelectedForDelivery(null)}
          onConfirmDelivery={(updated) => {
            onUpdateDelivery(updated);
            setSelectedForDelivery(null);
          }}
          onSaveDelivery={(updated) => {
            onUpdateDelivery(updated);
            setSelectedForDelivery(null);
          }}
          onConfirmDelivered={() => {
            if (selectedForDelivery) {
              const updated = { ...selectedForDelivery, status: 'entregue' as const };
              onUpdateDelivery(updated);
            }
            setSelectedForDelivery(null);
          }}
        />
      )}

      {/* MODAL WHATSAPP PARA ENTREGA EM GRUPO / PORTARIA */}
      {selectedGroupForDelivery && (
        <GroupedDeliveryWhatsAppModal
          isOpen={true}
          deliveries={selectedGroupForDelivery}
          onClose={() => setSelectedGroupForDelivery(null)}
          onConfirmGroupDelivery={handleConfirmGroupDelivery}
          onConfirmDelivery={handleConfirmGroupDelivery}
        />
      )}

      {/* MODAL DO CADERNO DE CASAS E MORADORES SALVOS */}
      <StreetAddressMemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        streetName={isManilhaActive ? 'Manilha' : activeStreet}
        currentDeliveries={deliveries}
        onAddSelectedPackages={(newPackages) => {
          if (onAddBatchDeliveries) {
            onAddBatchDeliveries(newPackages);
          } else {
            newPackages.forEach((p) => onAddDelivery(p));
          }
          setQuickToast(`Adicionado(s) ${newPackages.length} pacote(s) da memória!`);
          setTimeout(() => setQuickToast(null), 2500);
        }}
      />
      {/* Modal de Celebração de Rua Finalizada & Decisão de Insucessos */}
      <StreetCompletedModal
        isOpen={isStreetCompletedModalOpen}
        streetName={isManilhaActive ? `Manilha (${manilhaSubStreet || 'Geral'})` : activeStreet}
        deliveredCount={deliveredCount}
        insucessoCount={insucessoCount}
        failedDeliveries={failedDeliveries}
        remainingStreetsCount={remainingStreets.length}
        nextStreetName={remainingStreets[0]}
        onClose={() => setIsStreetCompletedModalOpen(false)}
        onGoToNextStreet={(nextSt) => onSelectStreet(nextSt)}
        onOpenCloseDayModal={onOpenCloseDayModal}
      />
    </div>
  );
};
