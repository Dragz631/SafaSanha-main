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
import { MoneyRewardOverlay } from './MoneyRewardOverlay';
import {
  getStreetInfo,
  MANILHA_SUB_STREETS,
  isManilhaDelivery,
  getManilhaSubStreet
} from '../data/cajuStreets';

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
}) => {
  // Modais locais
  const [internalRegionModalOpen, setInternalRegionModalOpen] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
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
      if (isManilhaDelivery(d)) return false;
      const st = (d.endereco_rua || d.endereco_completo || '').toLowerCase();
      return st.includes(cleanActive) || cleanActive.includes(st);
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

    onAddDelivery(newDelivery);

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

  // Agrupamento por número de casa (para ruas normais ou dentro de cada grupo)
  const groupedHouses = useMemo(() => {
    const map = new Map<string, DeliveryData[]>();

    sortedDeliveries.forEach((d) => {
      const num = d.numero_casa || d.endereco_numero || 'S/N';
      if (!map.has(num)) {
        map.set(num, []);
      }
      map.get(num)!.push(d);
    });

    return Array.from(map.entries()).map(([houseNumber, items]) => ({
      houseNumber,
      items,
      count: items.length,
      hasMultiple: items.length > 1,
    }));
  }, [sortedDeliveries]);

  // Contagem de casas com múltiplos pacotes
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
    const deliveredCount = updatedList.filter(
      (d) => d.status === 'entregue' || d.status === 'concluido'
    ).length;
    updatedList.forEach((d) => {
      onUpdateDelivery(d);
    });
    setSelectedGroupForDelivery(null);
    if (deliveredCount > 0) {
      triggerReward(deliveredCount, updatedList[0]?.nome_destinatario);
    }
  };

  return (
    <div className="space-y-3 pb-24">
      {/* OVERLAY DE RECOMPENSA EM DINHEIRO (ANIMAÇÃO AO CONCLUIR ENTREGA) */}
      <MoneyRewardOverlay
        isVisible={rewardState.isVisible}
        packageCount={rewardState.packageCount}
        clientName={rewardState.clientName}
        onClose={() => setRewardState({ isVisible: false })}
      />

      {/* 1. PAINEL DE CONTROLE DA RUA ATIVA COM BARRA DE PROGRESSO & RUAS DO DIA */}
      <div className="bg-white rounded-3xl p-3.5 border border-slate-200/90 shadow-sm space-y-2.5">
        
        {/* Rua Atual & Botão Trocar Rua */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black shrink-0 shadow-xs ${
              isManilhaActive ? 'bg-amber-400 text-slate-950' : 'bg-emerald-500 text-slate-950'
            }`}>
              {isManilhaActive ? <Navigation className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {isManilhaActive ? 'Setor Unificado' : 'Rua em Atendimento'}
                </span>
                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md border ${activeStreetInfo.badgeColor}`}>
                  {activeStreetInfo.sector}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight truncate">
                {activeStreet}
              </h1>
            </div>
          </div>

          <button
            onClick={openRegionModal}
            className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-300/80 shrink-0 cursor-pointer flex items-center gap-1 transition-all active:scale-95 shadow-xs"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>Definir Ruas de Hoje</span>
          </button>
        </div>

        {/* Barra de Progresso e Contadores Detalhados */}
        <div className={`grid gap-2 text-center pt-1 ${
          insucessoCount > 0 ? 'grid-cols-4' : 'grid-cols-3'
        }`}>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 block">Total</span>
            <span className="text-base font-black text-slate-900">{totalCount}</span>
          </div>

          <div className="bg-amber-50 p-2 rounded-xl border border-amber-200">
            <span className="text-[10px] font-bold text-amber-800 block">Pendentes</span>
            <span className="text-base font-black text-amber-900">{pendingCount}</span>
          </div>

          <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 block">Entregues</span>
            <span className="text-base font-black text-emerald-900">{deliveredCount}</span>
          </div>

          {insucessoCount > 0 && (
            <div className="bg-rose-50 p-2 rounded-xl border border-rose-200">
              <span className="text-[10px] font-bold text-rose-800 block">Insucessos</span>
              <span className="text-base font-black text-rose-900">{insucessoCount}</span>
            </div>
          )}
        </div>

        {/* Atalhos de Ruas Selecionadas para Hoje no Caju em carrossel horizontal */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] font-black text-slate-400 shrink-0 uppercase tracking-wider">
            Ruas de Hoje:
          </span>
          {savedStreets.map((st) => {
            const isCurrent = activeStreet.toLowerCase() === st.toLowerCase();
            const isMan = st.toLowerCase() === 'manilha' || st.toLowerCase().includes('manilha');
            return (
              <button
                key={st}
                onClick={() => onSelectStreet(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                  isCurrent
                    ? 'bg-slate-900 text-white shadow-xs'
                    : isMan
                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
                }`}
              >
                {isMan ? '🏗️ ' : '📍 '}
                <span>{st}</span>
              </button>
            );
          })}
          <button
            onClick={openRegionModal}
            className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300/80 transition-all cursor-pointer shrink-0 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Ruas de Hoje</span>
          </button>

          {deliveries.length > 0 && onClearAllDeliveries && (
            <button
              onClick={onClearAllDeliveries}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer shrink-0 flex items-center gap-1 ml-auto"
              title="Limpar todos os pacotes para iniciar um novo dia de entregas"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Novo Dia</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. BARRA DE ENTRADA RELÂMPAGO (ESPECIALIZADA PARA MANILHA OU RUA NORMAL) */}
      <div className={`rounded-2xl p-3 text-white shadow-md space-y-2.5 ${
        isManilhaActive
          ? 'bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 border border-amber-500/40'
          : 'bg-gradient-to-r from-emerald-600 to-teal-700'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span className="text-xs font-black tracking-wide">
              {isManilhaActive
                ? '🏗️ Cadastro na Manilha (Escolha a Rua/Letra + Nº)'
                : `📍 Cadastro na ${activeStreet}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all border border-white/20"
              title="Digitar ou colar vários pacotes de uma vez"
            >
              <ListPlus className="w-3 h-3 text-amber-300" />
              <span>Lote / Vários</span>
            </button>
          </div>
        </div>

        {/* SELETOR DE SUB-RUA EXCLUSIVO DA MANILHA (VIAS PRINCIPAIS + LETRAS A A K) */}
        {isManilhaActive && (
          <div className="space-y-1.5 bg-black/25 p-2 rounded-xl border border-white/10">
            <span className="text-[10px] font-black uppercase text-amber-200 block">
              Selecione a Rua da Manilha:
            </span>

            {/* Vias Centrais */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {MANILHA_SUB_STREETS.filter((s) => s.type === 'principal').map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setManilhaSubStreet(st.name);
                    quickInputRef.current?.focus();
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer shrink-0 ${
                    manilhaSubStreet === st.name
                      ? 'bg-amber-300 text-slate-950 shadow-xs'
                      : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                >
                  {st.name} ({st.shortLabel})
                </button>
              ))}
            </div>

            {/* Travessas de Letras (Ordem Alfabética: A a K) */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
              <span className="text-[10px] font-black text-amber-200/90 shrink-0">
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
                  className={`w-7 h-7 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                    manilhaSubStreet === st.name
                      ? 'bg-amber-300 text-slate-950 shadow-xs scale-105'
                      : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                  title={st.name}
                >
                  {st.name.replace(/rua\s*/i, '').toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Formulário Inline Super Rápido com Número da Casa e Complemento */}
        <form onSubmit={handleQuickAdd} className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            {/* Campo de Número da Casa - Foco Rápido */}
            <div className="w-24 sm:w-28 shrink-0">
              <input
                ref={quickInputRef}
                type="text"
                inputMode="numeric"
                value={quickHouseNumber}
                onChange={(e) => setQuickHouseNumber(e.target.value)}
                placeholder="Nº Casa"
                className="w-full px-2.5 py-2 bg-white text-slate-900 placeholder-slate-400 rounded-xl text-base font-black text-center focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-inner"
              />
            </div>

            {/* Campo de Complemento (Apto, Bloco, etc.) */}
            <div className="w-28 sm:w-32 shrink-0">
              <input
                ref={quickComplementInputRef}
                type="text"
                value={quickComplement}
                onChange={(e) => setQuickComplement(e.target.value)}
                placeholder="Compl. (Apto...)"
                className="w-full px-2.5 py-2 bg-white/95 text-slate-900 placeholder-slate-400 rounded-xl text-xs font-black text-center focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-300 shadow-inner"
              />
            </div>

            {/* Nome do Destinatário Opcional */}
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={quickClientName}
                onChange={(e) => setQuickClientName(e.target.value)}
                placeholder="Morador (Opcional)"
                className="w-full px-2.5 py-2 bg-white/90 text-slate-900 placeholder-slate-400 rounded-xl text-xs font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-300"
              />
            </div>

            {/* Botão de Voz */}
            <button
              type="button"
              onClick={toggleQuickVoice}
              className={`p-2 rounded-xl text-white cursor-pointer transition-all shrink-0 ${
                isQuickListening ? 'bg-rose-500 animate-pulse' : 'bg-white/20 hover:bg-white/30'
              }`}
              title="Falar número e complemento por voz"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Botão de Adicionar (Enter) */}
            <button
              type="submit"
              className="px-3 py-2 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-sm cursor-pointer shrink-0 flex items-center gap-1 transition-all"
              title="Adicionar Pacote (Pressione Enter)"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Adicionar</span>
            </button>
          </div>

          {/* Quick Chips de Complementos Rápidos em 1 toque */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5 pb-0.5">
            <span className="text-[10px] font-extrabold text-white/80 shrink-0">
              +Compl:
            </span>
            {['Apto ', 'Bloco A', 'Bloco B', 'Casa 2', 'Fundos', 'Sobrado', 'Loja '].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  setQuickComplement(chip);
                  quickComplementInputRef.current?.focus();
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer shrink-0 ${
                  quickComplement.toLowerCase().includes(chip.trim().toLowerCase())
                    ? 'bg-amber-300 text-slate-950 font-black'
                    : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
                }`}
              >
                {chip.trim()}
              </button>
            ))}
            {quickComplement && (
              <button
                type="button"
                onClick={() => setQuickComplement('')}
                className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/80 hover:bg-rose-600 text-white shrink-0"
                title="Limpar complemento"
              >
                ✕
              </button>
            )}
          </div>
        </form>

        {/* Toast Flutuante de Sucesso Rápido */}
        {quickToast && (
          <div className="text-[11px] font-black text-amber-200 bg-black/30 px-2.5 py-1 rounded-lg text-center animate-fadeIn">
            {quickToast}
          </div>
        )}
      </div>

      {/* 3. FILTRO, BUSCA E ORDENAÇÃO DINÂMICA */}
      <div className="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-xs space-y-2">
        {/* Campo de Busca Rápida */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isManilhaActive
                ? 'Buscar por Rua (Ex: Rua B, Leão XIII), número ou morador...'
                : 'Buscar por Nº casa, morador ou pacote...'
            }
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-bold"
          />
        </div>

        {/* Tabs de Filtro e Seletor de Ordenação */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 pt-0.5">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-xs font-black">
            <button
              onClick={() => setFilterStatus('todos')}
              className={`px-2.5 py-1 rounded-xl cursor-pointer shrink-0 transition-all ${
                filterStatus === 'todos'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({totalCount})
            </button>
            <button
              onClick={() => setFilterStatus('pendente')}
              className={`px-2.5 py-1 rounded-xl cursor-pointer shrink-0 transition-all ${
                filterStatus === 'pendente'
                  ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('entregue')}
              className={`px-2.5 py-1 rounded-xl cursor-pointer shrink-0 transition-all ${
                filterStatus === 'entregue'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              Entregues ({deliveredCount})
            </button>
            {insucessoCount > 0 && (
              <button
                onClick={() => setFilterStatus('insucesso')}
                className={`px-2.5 py-1 rounded-xl cursor-pointer shrink-0 transition-all ${
                  filterStatus === 'insucesso'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
                }`}
              >
                Falhas ({insucessoCount})
              </button>
            )}
          </div>

          {/* Seletor de Ordenação */}
          <div className="flex items-center gap-1 self-end sm:self-auto">
            <button
              onClick={toggleSortDirection}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 cursor-pointer text-xs font-bold flex items-center gap-1 border border-slate-200"
              title="Inverter ordem dos números"
            >
              {sortBy === 'numero_asc' ? (
                <>
                  <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[10px]">1 → 100</span>
                </>
              ) : sortBy === 'numero_desc' ? (
                <>
                  <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[10px]">100 → 1</span>
                </>
              ) : (
                <ArrowUpDown className="w-3.5 h-3.5" />
              )}
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="numero_asc">Nº Casa (Menor → Maior)</option>
              <option value="numero_desc">Nº Casa (Maior → Menor)</option>
              <option value="pendentes_primeiro">Pendentes Primeiro</option>
              <option value="hora_desc">Mais Recentes</option>
              <option value="codigo">Código Pacote</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. MODOS DE VISUALIZAÇÃO */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'grouped'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>
              {isManilhaActive
                ? `🏗️ Por Ruas da Manilha (${manilhaSubGroups.length})`
                : `🏢 Agrupado p/ Casas (${groupedHouses.length})`}
            </span>
          </button>

          <button
            onClick={() => setViewMode('individual')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'individual'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>📦 Lista Individual ({sortedDeliveries.length})</span>
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
                  key={group.houseNumber}
                  houseNumber={group.houseNumber}
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
          onSaveDelivery={(updated) => {
            onUpdateDelivery(updated);
            setSelectedForDelivery(null);
            if (updated.status === 'entregue' || updated.status === 'concluido') {
              triggerReward(1, updated.nome_destinatario);
            }
          }}
        />
      )}

      {/* MODAL WHATSAPP PARA ENTREGA EM GRUPO / PORTARIA */}
      {selectedGroupForDelivery && (
        <GroupedDeliveryWhatsAppModal
          isOpen={true}
          deliveries={selectedGroupForDelivery}
          onClose={() => setSelectedGroupForDelivery(null)}
          onConfirmDelivery={handleConfirmGroupDelivery}
        />
      )}
    </div>
  );
};
