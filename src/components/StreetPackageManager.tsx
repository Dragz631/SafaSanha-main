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
import { NumeroCard } from './NumeroCard';
import { ManilhaSubStreetCard } from './ManilhaSubStreetCard';
import { GroupedDeliveryWhatsAppModal } from './GroupedDeliveryWhatsAppModal';
import { QuickPackageScannerModal } from './QuickPackageScannerModal';
import { ManualPackageModal } from './ManualPackageModal';
import { DeliveryWhatsAppModal } from './DeliveryWhatsAppModal';
import { RegionStreetsModal } from './RegionStreetsModal';
import { QuickBatchAddModal } from './QuickBatchAddModal';
import { triggerCoinBurst } from '../utils/rewardEffect';
import { QuickMemoryManager } from './QuickMemoryManager';
import { StreetCompletedModal } from './StreetCompletedModal';
import { SugestoesDestino } from './SugestoesDestino';
import { getStreetInfo, MANILHA_SUB_STREETS, getManilhaSubStreet } from '../data/cajuStreets';
import { useMemoria } from '../state/MemoriaContext';
import { agruparRua, destinoIdDoPacote, enderecoDoPacote, filtrarGrupos, type GrupoNumero } from '../domain/agrupamento';
import { cadastrarPacote, confirmarDestino, corrigirPacote, gerarCodigoManual, montarPacote } from '../domain/cadastro';
import { contarPacotes, ehAreaManilha, pacotesDaRua, statusEntregue } from '../domain/ruas';
import { aplicarEntrega, aplicarInsucesso, reabrirPacote } from '../domain/entrega';

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
  // OCR por etiqueta: pendente de decisão de produto — nenhum botão abre este modal ainda.
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [editingDelivery, setEditingDelivery] = useState<DeliveryData | null>(null);
  
  const { memoria, atualizar } = useMemoria();

  // Identifica se a área ativa é o Setor Unificado da Manilha
  const isManilhaActive = useMemo(() => ehAreaManilha(activeStreet), [activeStreet]);

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
  const streetDeliveries = useMemo(() => pacotesDaRua(deliveries, activeStreet), [deliveries, activeStreet]);

  // Contadores da rua ativa (mesma contagem do topo, do Resumo e dos seletores de rua)
  const {
    total: totalCount,
    entregues: deliveredCount,
    insucessos: insucessoCount,
    pendentes: pendingCount,
  } = useMemo(() => contarPacotes(streetDeliveries), [streetDeliveries]);

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

    const comp = quickComplement.trim();
    const agora = new Date().toISOString();

    const novo = montarPacote(
      {
        rua: isManilhaActive ? 'Manilha' : activeStreet,
        subRuaManilha: isManilhaActive ? manilhaSubStreet : undefined,
        numero: cleanNum,
        complemento: comp,
        nome: quickClientName,
      },
      agora,
      deliveries.map((d) => d.codigo_pacote)
    );

    // Vincula ao destino conhecido só quando a identidade é clara; se houver ambiguidade, o pacote entra
    // SEM vínculo (fica "pendente de confirmação") e a memória não aprende nada até o operador confirmar.
    const r = cadastrarPacote(memoria, novo, agora);
    atualizar(() => r.memoria);
    onAddDelivery(r.pacote);
    setFilterStatus('todos');
    setSearchQuery('');

    try {
      if ('vibrate' in navigator) navigator.vibrate(40);
    } catch (_e) {}

    const rotuloRua = isManilhaActive ? `${manilhaSubStreet} ` : '';
    const toastMsg = r.pendente
      ? `⚠️ ${rotuloRua}Nº ${cleanNum} adicionado — confirme o destino abaixo`
      : isManilhaActive
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

  // Organização da rua: Nº → destino → unidade → pacote (a lógica vive em src/domain/agrupamento.ts).
  // Calculada sobre TODOS os pacotes da rua; busca/filtro só escondem, nunca reclassificam.
  const grupos = useMemo(() => {
    const visiveis = new Set(sortedDeliveries.map((d) => d.id_entrega));
    const lista = filtrarGrupos(agruparRua(streetDeliveries, memoria), (p) => visiveis.has(p.id_entrega));
    if (sortBy === 'numero_asc') return lista;
    if (sortBy === 'numero_desc') return [...lista].reverse();
    // demais ordenações: pela posição do primeiro pacote de cada número na lista já ordenada
    const pos = new Map(sortedDeliveries.map((d, i) => [d.id_entrega, i]));
    const menor = (g: GrupoNumero) =>
      Math.min(...[...g.destinos.flatMap((d) => d.pacotes), ...g.pendentes.map((p) => p.pacote)].map((p) => pos.get(p.id_entrega) ?? 0));
    return [...lista].sort((a, b) => menor(a) - menor(b));
  }, [streetDeliveries, sortedDeliveries, memoria, sortBy]);

  const pendentesDeConfirmacao = useMemo(() => grupos.reduce((acc, g) => acc + g.pendentes.length, 0), [grupos]);

  /** Troca rápida de status (menu do card individual) com as MESMAS regras de horário/motivo das baixas. */
  const mudarStatusRapido = (d: DeliveryData, status: DeliveryData['status']): DeliveryData => {
    const agora = new Date().toISOString();
    if (status === 'entregue' || status === 'concluido') {
      return aplicarEntrega(d, { recebedor_tipo: d.recebedor_tipo, recebedor_detalhes: d.recebedor_detalhes }, agora);
    }
    if (status === 'aguardando_rua') return reabrirPacote(d, agora);
    if (status === 'insucesso') return aplicarInsucesso(d, d.motivo_insucesso || 'Morador ausente / Ninguém atende', agora);
    return { ...d, status };
  };

  const enderecoMudou = (a: DeliveryData, b: DeliveryData) => enderecoDoPacote(a).destinoId !== enderecoDoPacote(b).destinoId;

  /** Salva um pacote alterado por um modal; se o endereço mudou (ou não há vínculo), refaz o vínculo ao destino. */
  const salvarPacoteAtualizado = (atualizado: DeliveryData, original?: DeliveryData | null) => {
    const refazer = !atualizado.destino_id || (original ? enderecoMudou(original, atualizado) : false);
    if (refazer) {
      const r = cadastrarPacote(memoria, { ...atualizado, destino_id: undefined }, new Date().toISOString());
      atualizar(() => r.memoria);
      onUpdateDelivery(r.pacote);
    } else {
      onUpdateDelivery(atualizado);
    }
  };

  /** O operador confirmou o destino de um pacote pendente. Só agora a memória aprende com ele. */
  const handleConfirmarDestino = (pacote: DeliveryData, destinoId: string) => {
    const r = confirmarDestino(memoria, pacote, destinoId, new Date().toISOString());
    atualizar(() => r.memoria);
    onUpdateDelivery(r.pacote);
    setQuickToast('✅ Destino confirmado');
    setTimeout(() => setQuickToast(null), 2000);
  };

  /** Correção manual do endereço/nome/código (preserva status, fotos e recebedor). */
  const handleSalvarCorrecao = (dados: DeliveryData) => {
    if (!editingDelivery) return;
    const r = corrigirPacote(
      memoria,
      editingDelivery,
      {
        rua: editingDelivery.endereco_rua || activeStreet,
        subRuaManilha: editingDelivery.sub_rua_manilha,
        numero: dados.numero_casa || 'S/N',
        complemento: dados.complemento,
        nome: dados.nome_destinatario,
        codigo: dados.codigo_pacote,
      },
      new Date().toISOString()
    );
    atualizar(() => r.memoria);
    onUpdateDelivery(r.pacote);
    setEditingDelivery(null);
    setQuickToast(r.pendente ? '⚠️ Endereço corrigido — confirme o destino' : '✅ Pacote corrigido');
    setTimeout(() => setQuickToast(null), 2200);
  };

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

            {/* Destinos já conhecidos neste número (sugestão: nada é vinculado até adicionar) */}
            <SugestoesDestino
              rua={isManilhaActive ? manilhaSubStreet : activeStreet}
              numero={quickHouseNumber}
              complemento={quickComplement}
              onEscolher={({ complemento, nome }) => {
                setQuickComplement(complemento);
                if (nome) setQuickClientName(nome);
              }}
            />

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

      {pendentesDeConfirmacao > 0 && (
        <div role="status" className="rounded-2xl border border-amber-500/50 bg-amber-950/30 text-amber-200 text-xs font-bold p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {pendentesDeConfirmacao} pacote(s) aguardando confirmação de destino. O sistema não escolhe sozinho quando o mesmo número tem mais de um local.
          </span>
        </div>
      )}

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
                : `🏢 Por Casas (${grupos.length})`}
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
                todos={streetDeliveries.filter((d) => getManilhaSubStreet(d).toLowerCase() === group.subDef.name.toLowerCase())}
                onConfirmarDestino={handleConfirmarDestino}
                onMudarStatus={mudarStatusRapido}
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
              grupos.map((grupo) => (
                <NumeroCard
                  key={grupo.numeroChave}
                  grupo={grupo}
                  onOpenSingleDeliveryModal={(del, mode) => handleOpenDeliveryModal(del, mode || 'entrega')}
                  onOpenGroupDeliveryModal={(items) => handleOpenGroupDeliveryModal(items)}
                  onEditDelivery={(del) => setEditingDelivery(del)}
                  onDeleteDelivery={(id) => onDeleteDelivery(id)}
                  onConfirmarDestino={handleConfirmarDestino}
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
                    onUpdateDelivery(mudarStatusRapido(del, status));
                    if (status === 'entregue' || status === 'concluido') {
                      triggerReward(1, del.nome_destinatario);
                    }
                  }}
                  onToggleStatus={(del) => {
                    const targetStatus = del.status === 'entregue' ? 'aguardando_rua' : 'entregue';
                    onUpdateDelivery(mudarStatusRapido(del, targetStatus));
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

      {/* CORREÇÃO MANUAL DO PACOTE (endereço, complemento, nome, código) */}
      <ManualPackageModal
        isOpen={!!editingDelivery}
        initialDelivery={editingDelivery}
        onClose={() => setEditingDelivery(null)}
        onSave={handleSalvarCorrecao}
        activeStreet={activeStreet}
      />

      {/* MODAL DE CADASTRO EM LOTE */}
      <QuickBatchAddModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        activeStreet={activeStreet}
        onAddBatch={(batch) => {
          const agora = new Date().toISOString();
          const usados = new Set(deliveries.map((d) => d.codigo_pacote));
          let mem = memoria;
          let pendentes = 0;
          const salvos = batch.map((b) => {
            const codigo = usados.has(b.codigo_pacote) ? gerarCodigoManual(usados) : b.codigo_pacote;
            usados.add(codigo);
            // Na Manilha o lote vale para a sub-rua selecionada.
            const base: DeliveryData = {
              ...b,
              codigo_pacote: codigo,
              data_hora_entrada: b.data_hora,
              sub_rua_manilha: isManilhaActive ? manilhaSubStreet : undefined,
              endereco_completo: isManilhaActive ? `${manilhaSubStreet}, ${b.numero_casa}${b.complemento ? ` (${b.complemento})` : ''} (Manilha • Caju)` : b.endereco_completo,
            };
            const r = cadastrarPacote(mem, base, agora);
            mem = r.memoria;
            if (r.pendente) pendentes++;
            return r.pacote;
          });
          atualizar(() => mem);
          if (onAddBatchDeliveries) onAddBatchDeliveries(salvos);
          else salvos.forEach((d) => onAddDelivery(d));
          setIsBatchModalOpen(false);
          setFilterStatus('todos');
          setQuickToast(
            pendentes > 0
              ? `⚠️ ${salvos.length} pacote(s) adicionado(s) — ${pendentes} aguardando confirmação de destino`
              : `✅ ${salvos.length} pacote(s) adicionado(s)`
          );
          setTimeout(() => setQuickToast(null), 3000);
        }}
      />

      {/* MODAL WHATSAPP PARA ENTREGA INDIVIDUAL */}
      {selectedForDelivery && (
        <DeliveryWhatsAppModal
          isOpen={true}
          delivery={selectedForDelivery}
          destinoId={destinoIdDoPacote(selectedForDelivery, streetDeliveries, memoria)}
          initialMode={deliveryModalMode}
          onClose={() => setSelectedForDelivery(null)}
          onConfirmDelivery={(updated) => {
            salvarPacoteAtualizado(updated, selectedForDelivery);
            setSelectedForDelivery(null);
          }}
        />
      )}

      {/* MODAL WHATSAPP PARA ENTREGA EM GRUPO (mesmo destino) */}
      {selectedGroupForDelivery && (
        <GroupedDeliveryWhatsAppModal
          isOpen={true}
          deliveries={selectedGroupForDelivery}
          destinoId={destinoIdDoPacote(selectedGroupForDelivery[0], streetDeliveries, memoria)}
          onClose={() => setSelectedGroupForDelivery(null)}
          onConfirmGroupDelivery={handleConfirmGroupDelivery}
        />
      )}


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
