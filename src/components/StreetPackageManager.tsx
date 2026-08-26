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
  ListPlus
} from 'lucide-react';
import { DeliveryData } from '../types';
import { PackageCard } from './PackageCard';
import { HouseGroupCard } from './HouseGroupCard';
import { GroupedDeliveryWhatsAppModal } from './GroupedDeliveryWhatsAppModal';
import { QuickPackageScannerModal } from './QuickPackageScannerModal';
import { ManualPackageModal } from './ManualPackageModal';
import { DeliveryWhatsAppModal } from './DeliveryWhatsAppModal';
import { RegionStreetsModal } from './RegionStreetsModal';
import { QuickBatchAddModal } from './QuickBatchAddModal';

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

  // Pacotes pertencentes à rua ativa
  const streetDeliveries = useMemo(() => {
    const cleanActive = activeStreet.trim().toLowerCase();
    return deliveries.filter((d) => {
      const st = (d.endereco_rua || d.endereco_completo || '').toLowerCase();
      return st.includes(cleanActive) || cleanActive.includes(st);
    });
  }, [deliveries, activeStreet]);

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

    const newDelivery: DeliveryData = {
      id_entrega: `del_${Date.now()}`,
      codigo_pacote: code,
      nome_destinatario: client,
      recebedor_detalhes: client,
      recebedor_tipo: 'proprio_morador',
      endereco_rua: activeStreet,
      numero_casa: cleanNum,
      endereco_numero: cleanNum,
      complemento: comp || undefined,
      endereco_completo: `${activeStreet}, ${cleanNum}${comp ? ` (${comp})` : ''}`,
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

    setQuickToast(`✅ Nº ${cleanNum} ${comp ? `(${comp})` : ''} adicionado!`);
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
        return client.includes(q) || code.includes(q) || num.includes(q) || complement.includes(q);
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

  // Agrupamento por número de casa (para Portarias / Prédios / Múltiplos pacotes no mesmo endereço)
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
    <div className="max-w-xl mx-auto px-3.5 pt-3 pb-28 space-y-3">
      
      {/* 1. SELETOR DE RUA & MÉTRICAS DA RUA */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs space-y-3">
        
        {/* Cabeçalho da Rua Ativa com Botão de Troca e Gestão */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <h2 className="text-base font-black text-slate-900 truncate">
              {activeStreet}
            </h2>
          </div>
          <button
            onClick={openRegionModal}
            className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-300/80 shrink-0 cursor-pointer flex items-center gap-1 transition-all active:scale-95"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>Trocar Rua</span>
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

        {/* Atalhos de Ruas da Região em carrossel horizontal */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] font-black text-slate-400 shrink-0 uppercase tracking-wider">
            Região:
          </span>
          {savedStreets.map((st) => {
            const isCurrent = activeStreet.toLowerCase() === st.toLowerCase();
            return (
              <button
                key={st}
                onClick={() => onSelectStreet(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                  isCurrent
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
                }`}
              >
                {st}
              </button>
            );
          })}
          <button
            onClick={openRegionModal}
            className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300/80 transition-all cursor-pointer shrink-0 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Rua</span>
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

      {/* 2. BARRA DE ENTRADA RELÂMPAGO (CADASTRO EM 1 SEGUNDO DIRETO NA TELA) */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-3 text-white shadow-md space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span className="text-xs font-black tracking-wide">
              Cadastro Rápido (1 Toque)
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

        {/* Formulário Inline Super Rápido com Complemento e Chips */}
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
              title="Falar número e complemento por voz (Ex: '563 Diego Apto 302')"
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
            <span className="text-[10px] font-extrabold text-emerald-200 shrink-0">
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
            placeholder="Buscar por Nº casa, morador ou pacote..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-bold"
          />
        </div>

        {/* Tabs de Filtro e Seletor de Ordenação */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 pt-0.5">
          {/* Status Tabs */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl text-[11px] font-extrabold overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilterStatus('todos')}
              className={`flex-1 py-1 px-2 rounded-lg transition-all cursor-pointer text-center whitespace-nowrap ${
                filterStatus === 'todos'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos ({totalCount})
            </button>
            <button
              onClick={() => setFilterStatus('pendente')}
              className={`flex-1 py-1 px-2 rounded-lg transition-all cursor-pointer text-center whitespace-nowrap ${
                filterStatus === 'pendente'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('entregue')}
              className={`flex-1 py-1 px-2 rounded-lg transition-all cursor-pointer text-center whitespace-nowrap ${
                filterStatus === 'entregue'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Entregues ({deliveredCount})
            </button>
            {insucessoCount > 0 && (
              <button
                onClick={() => setFilterStatus('insucesso')}
                className={`flex-1 py-1 px-2 rounded-lg transition-all cursor-pointer text-center whitespace-nowrap ${
                  filterStatus === 'insucesso'
                    ? 'bg-white text-rose-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Insucessos ({insucessoCount})
              </button>
            )}
          </div>

          {/* Ordenação Flexível & Botão de Inverter Direção */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 sm:flex-initial">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-bold text-slate-700 py-1.5 px-2.5 rounded-xl appearance-none pr-6 cursor-pointer focus:outline-none"
              >
                <option value="numero_asc">🔼 Nº Casa: 1 → 100 (Subindo)</option>
                <option value="numero_desc">🔽 Nº Casa: 100 → 1 (Descendo)</option>
                <option value="pendentes_primeiro">⏳ Pendentes Primeiro</option>
                <option value="hora_desc">🕒 Mais Recentes</option>
                <option value="codigo">📦 Código do Pacote</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              onClick={toggleSortDirection}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 cursor-pointer shrink-0"
              title="Inverter direção da rua (Subindo / Descendo)"
            >
              {sortBy === 'numero_desc' ? (
                <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4. SELETOR DE MODO DE VISUALIZAÇÃO (AGRUPADO P/ PORTARIA vs INDIVIDUAL) */}
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
            <span>🏢 Agrupado p/ Casas / Portaria ({groupedHouses.length})</span>
            {multipleHousesCount > 0 && (
              <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-md">
                {multipleHousesCount} com +1 pacote
              </span>
            )}
          </button>

          <button
            onClick={() => setViewMode('individual')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'individual'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>📦 Todos os Pacotes ({sortedDeliveries.length})</span>
          </button>
        </div>
      </div>

      {/* 5. LISTA DE PACOTES / CASAS INTERATIVOS */}
      <div className="space-y-2.5">
        {sortedDeliveries.length > 0 ? (
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
                onUpdateDelivery={(del) => onUpdateDelivery(del)}
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
                onQuickStatusChange={(del, status) =>
                  onUpdateDelivery({ ...del, status })
                }
                onToggleStatus={(del) =>
                  onUpdateDelivery({
                    ...del,
                    status: del.status === 'entregue' ? 'aguardando_rua' : 'entregue',
                  })
                }
              />
            ))
          )
        ) : (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-800">
                Nenhum pacote cadastrado na rua
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Digite o número da casa acima na barra verde, use o cadastro em lote ou bipe com a câmera na <span className="font-bold text-slate-700">{activeStreet}</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setIsBatchModalOpen(true)}
                className="px-3.5 py-2 bg-amber-50 text-amber-800 font-black text-xs rounded-xl border border-amber-300 cursor-pointer"
              >
                📋 Inserir Vários em Lote
              </button>
              <button
                onClick={() => setIsManualModalOpen(true)}
                className="px-3.5 py-2 bg-slate-100 text-slate-800 font-black text-xs rounded-xl border border-slate-300 cursor-pointer"
              >
                + Formulário Completo
              </button>
              <button
                onClick={() => setIsScannerOpen(true)}
                className="px-3.5 py-2 bg-emerald-600 text-white font-black text-xs rounded-xl cursor-pointer"
              >
                📸 Bipar com Câmera
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. BARRA DE AÇÕES INFERIOR FIXA (ZONA DO POLEGAR NO CELULAR) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-4 py-2.5 pb-safe max-w-xl mx-auto flex items-center gap-2">
        <button
          onClick={() => setIsBatchModalOpen(true)}
          className="px-3.5 py-3 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-black text-xs rounded-2xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
          title="Inserir vários números em lote"
        >
          <ListPlus className="w-4 h-4" />
          <span>📋 LOTE</span>
        </button>

        <button
          onClick={() => setIsManualModalOpen(true)}
          className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-black text-xs rounded-2xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>➕ MANUAL</span>
        </button>

        <button
          onClick={() => setIsScannerOpen(true)}
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
        >
          <Camera className="w-4 h-4" />
          <span>📸 BIPAR</span>
        </button>
      </div>

      {/* MODAL DE GESTÃO DE RUAS DA REGIÃO */}
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

      {/* MODAL DE CADASTRO EM LOTE (VÁRIOS DE UMA VEZ) */}
      <QuickBatchAddModal
        isOpen={isBatchModalOpen}
        activeStreet={activeStreet}
        onClose={() => setIsBatchModalOpen(false)}
        onAddBatch={(newBatch) => {
          if (onAddBatchDeliveries) {
            onAddBatchDeliveries(newBatch);
          } else {
            newBatch.forEach(d => onAddDelivery(d));
          }
        }}
      />

      {/* MODAL SCANNER DE CÂMERA RÁPIDO */}
      <QuickPackageScannerModal
        isOpen={isScannerOpen}
        activeStreet={activeStreet}
        onClose={() => setIsScannerOpen(false)}
        onPackageScanned={(newDel) => {
          onAddDelivery(newDel);
          setIsScannerOpen(false);
        }}
      />

      {/* MODAL MANUAL DE ADIÇÃO / EDIÇÃO */}
      <ManualPackageModal
        isOpen={isManualModalOpen || !!editingDelivery}
        activeStreet={activeStreet}
        initialDelivery={editingDelivery}
        onClose={() => {
          setIsManualModalOpen(false);
          setEditingDelivery(null);
        }}
        onSave={(savedDelivery) => {
          if (editingDelivery) {
            onUpdateDelivery(savedDelivery);
          } else {
            onAddDelivery(savedDelivery);
          }
          setIsManualModalOpen(false);
          setEditingDelivery(null);
        }}
      />

      {/* MODAL WHATSAPP COM SELETOR DE RECEBEDOR, INSUCESSO E TEXTO PRONTO */}
      {selectedForDelivery && (
        <DeliveryWhatsAppModal
          delivery={selectedForDelivery}
          initialMode={deliveryModalMode}
          onClose={() => setSelectedForDelivery(null)}
          onConfirmDelivery={(updated) => {
            onUpdateDelivery(updated);
            setSelectedForDelivery(null);
          }}
        />
      )}

      {/* MODAL DE ENTREGA AGREGADA DE MÚLTIPLOS PACOTES (PORTARIA / CASA) */}
      {selectedGroupForDelivery && (
        <GroupedDeliveryWhatsAppModal
          deliveries={selectedGroupForDelivery}
          onClose={() => setSelectedGroupForDelivery(null)}
          onConfirmGroupDelivery={handleConfirmGroupDelivery}
        />
      )}

    </div>
  );
};
