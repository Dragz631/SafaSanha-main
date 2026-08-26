import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Search,
  Sparkles,
  ShieldCheck,
  Package,
  MapPin,
  User,
  Clock,
  Play,
  Check,
  ChevronLeft,
  ChevronRight,
  Key,
  Truck,
  Layers,
  RefreshCw,
  MoreVertical,
  Undo2,
  MessageSquare,
  RotateCcw,
  Eye,
  Building2,
  Tag,
  Maximize2,
  X,
  FileText,
  Zap,
  Calendar
} from 'lucide-react';
import { DeliveryData } from '../types';
import { ContinuousScannerModal } from './ContinuousScannerModal';

// High contrast barcode SVG component for direct pistol optical scanner reading from screen
const SimpleBarcodeSVG: React.FC<{ code: string }> = ({ code }) => {
  const bars: { width: number; isBlack: boolean }[] = [];
  bars.push({ width: 3, isBlack: true });
  bars.push({ width: 2, isBlack: false });
  
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    const pattern1 = (charCode % 3) + 1;
    const pattern2 = ((charCode * 3) % 4) + 1;
    const pattern3 = (charCode % 2) + 1;
    bars.push({ width: pattern1, isBlack: true });
    bars.push({ width: pattern2, isBlack: false });
    bars.push({ width: pattern3, isBlack: true });
    bars.push({ width: 2, isBlack: false });
  }
  bars.push({ width: 4, isBlack: true });
  bars.push({ width: 2, isBlack: false });
  bars.push({ width: 3, isBlack: true });

  let x = 10;
  const rects = bars.map((b, idx) => {
    const currentX = x;
    x += b.width * 2.8;
    if (!b.isBlack) return null;
    return (
      <rect
        key={idx}
        x={currentX}
        y={8}
        width={b.width * 2.8}
        height={62}
        fill="#000000"
      />
    );
  });

  return (
    <div className="w-full max-w-sm mx-auto bg-white p-2.5 rounded-2xl border-2 border-slate-900 shadow-md">
      <svg className="w-full h-20 bg-white" viewBox={`0 0 ${x + 20} 85`}>
        <rect x="0" y="0" width={x + 20} height="85" fill="#FFFFFF" />
        {rects}
      </svg>
      <div className="text-center font-mono font-black text-lg text-slate-950 tracking-widest bg-slate-100 py-1 rounded-xl border border-slate-300 mt-1">
        {code}
      </div>
    </div>
  );
};

interface EsteiraBaixasViewProps {
  deliveries: DeliveryData[];
  onUpdateDelivery: (updated: DeliveryData) => void;
  onSelectDeliveryForReceipt: (delivery: DeliveryData) => void;
  initialTab?: 'esteira' | 'pin' | 'insucesso';
}

export const EsteiraBaixasView: React.FC<EsteiraBaixasViewProps> = ({
  deliveries,
  onUpdateDelivery,
  onSelectDeliveryForReceipt,
  initialTab = 'esteira',
}) => {
  // Top level Folder/Tab State: 'esteira' | 'pin' | 'insucesso'
  const [esteiraTab, setEsteiraTab] = useState<'esteira' | 'pin' | 'insucesso'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setEsteiraTab(initialTab);
    }
  }, [initialTab]);

  // Esteira View Mode: 'focused' (Carousel Stepper) | 'grid' (Cards)
  const [viewMode, setViewMode] = useState<'focused' | 'grid'>('focused');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  // Scanner & Bip input
  const [bipInput, setBipInput] = useState<string>('');
  const [isContinuousScannerOpen, setIsContinuousScannerOpen] = useState<boolean>(false);
  const [bipFeedback, setBipFeedback] = useState<{ type: 'success' | 'warning' | 'error'; msg: string } | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<number>(0);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // 3-Dots Menu Dropdown active delivery ID
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Trava Desfazer (6-second Undo Stack)
  const [lastConfirmedDelivery, setLastConfirmedDelivery] = useState<DeliveryData | null>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState<number>(0);

  // Modals inside Esteira
  const [pinPromptDelivery, setPinPromptDelivery] = useState<DeliveryData | null>(null);
  const [pinInputVal, setPinInputVal] = useState<string>('');
  const [insucessoDelivery, setInsucessoDelivery] = useState<DeliveryData | null>(null);
  const [insucessoReason, setInsucessoReason] = useState<string>('Cliente Ausente');

  // REGRA DE OURO PARA ENTRAR NA ESTEIRA DE BAIXAS J&T:
  // Um pacote SÓ PODE ser enviado para a Esteira se atender aos 3 critérios simultaneamente:
  // 1. Possuir a Foto do Pacote / Etiqueta
  // 2. Possuir a Foto do Local / Fachada / Portaria
  // 3. Possuir o Nome do Recebedor preenchido
  const isEligibleForEsteira = (d: DeliveryData) => {
    const hasFotoPacote = Boolean(d.foto_pacote_path && d.foto_pacote_path.trim().length > 0);
    const hasFotoLocal = Boolean(d.foto_local_path && d.foto_local_path.trim().length > 0);
    const hasRecebedor = Boolean(
      (d.nome_destinatario && d.nome_destinatario.trim().length > 0) ||
      (d.recebedor_detalhes && d.recebedor_detalhes.trim().length > 0)
    );
    return hasFotoPacote && hasFotoLocal && hasRecebedor;
  };

  // Filter 1: Ready for Mother's Bip (must satisfy the 3 golden criteria)
  const readyForBip = deliveries.filter(
    (d) => (d.status === 'entregue' || d.status === 'pendente_baixa') && isEligibleForEsteira(d)
  );

  // Filter 2: Retained PIN (status === 'aguardando_pin')
  const waitingPin = deliveries.filter((d) => d.status === 'aguardando_pin');

  // Filter 3: Insucessos (status === 'insucesso' || status === 'agendado_reentrega' || status === 'devolucao_galpao')
  const insucessosList = deliveries.filter(
    (d) => d.status === 'insucesso' || d.status === 'agendado_reentrega' || d.status === 'devolucao_galpao'
  );

  // Filter 4: Completed J&T (status === 'processado_jt' || status === 'concluido')
  const processedJt = deliveries.filter(
    (d) => d.status === 'processado_jt' || d.status === 'concluido'
  );

  // Filter ready items by search
  const filteredReady = readyForBip.filter((d) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase().trim();
    return (
      d.codigo_pacote.toLowerCase().includes(q) ||
      (d.nome_destinatario || '').toLowerCase().includes(q) ||
      (d.endereco_completo || d.endereco_rua || '').toLowerCase().includes(q) ||
      (d.associacao_nome || '').toLowerCase().includes(q)
    );
  });

  // Ensure focused index remains valid
  useEffect(() => {
    if (focusedIndex >= filteredReady.length && filteredReady.length > 0) {
      setFocusedIndex(filteredReady.length - 1);
    }
  }, [filteredReady.length, focusedIndex]);

  // Undo Timer countdown effect
  useEffect(() => {
    if (undoTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setUndoTimeLeft((prev) => {
        if (prev <= 1) {
          setLastConfirmedDelivery(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [undoTimeLeft]);

  // Handle Mother Manual/Bip Scanner Input
  const handleBipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = bipInput.trim().toUpperCase();
    if (!cleanCode) return;

    const item = deliveries.find((d) => d.codigo_pacote.toUpperCase() === cleanCode);

    if (!item) {
      setBipFeedback({
        type: 'error',
        msg: `❌ Pacote ${cleanCode} não encontrado no sistema.`,
      });
    } else if (item.status === 'aguardando_pin') {
      setBipFeedback({
        type: 'warning',
        msg: `🔒 ATENÇÃO: Pacote ${cleanCode} está AGUARDANDO PALAVRA-CHAVE (PIN). Não pode ser baixado até que o PIN seja inserido!`,
      });
    } else if (item.status === 'processado_jt' || item.status === 'concluido') {
      setBipFeedback({
        type: 'warning',
        msg: `ℹ️ Pacote ${cleanCode} já foi baixado na J&T previamente.`,
      });
    } else {
      executeConfirmBip(item);
    }

    setBipInput('');
    setTimeout(() => setBipFeedback(null), 5000);
  };

  // Confirm Single Item Baixa with 6s Undo Activation
  const executeConfirmBip = (item: DeliveryData) => {
    const updatedItem: DeliveryData = {
      ...item,
      status: 'processado_jt',
      data_hora: new Date().toLocaleString('pt-BR'),
    };
    onUpdateDelivery(updatedItem);

    // Activate 6-second Trava Desfazer
    setLastConfirmedDelivery(item);
    setUndoTimeLeft(6);

    setBipFeedback({
      type: 'success',
      msg: `🟣 SUCESSO! Pacote ${item.codigo_pacote} bipado e baixado no sistema J&T Express!`,
    });
    setTimeout(() => setBipFeedback(null), 4000);
  };

  // Undo Last Bip Execution
  const handleUndoLastBip = () => {
    if (!lastConfirmedDelivery) return;
    const restoredItem: DeliveryData = {
      ...lastConfirmedDelivery,
      status: 'entregue',
    };
    onUpdateDelivery(restoredItem);
    const code = restoredItem.codigo_pacote;
    setLastConfirmedDelivery(null);
    setUndoTimeLeft(0);

    setBipFeedback({
      type: 'warning',
      msg: `↩️ Baixa do pacote ${code} DESFEITA! Ele voltou para a Esteira de Baixas.`,
    });
    setTimeout(() => setBipFeedback(null), 4000);
  };

  // Batch Process All Ready Items
  const handleRunBatchBip = () => {
    if (readyForBip.length === 0) return;
    setIsProcessingBatch(true);
    setBatchProgress(0);

    let count = 0;
    const total = readyForBip.length;
    const interval = setInterval(() => {
      if (count >= total) {
        clearInterval(interval);
        setIsProcessingBatch(false);
        setBipFeedback({
          type: 'success',
          msg: `🎉 LOTE FINALIZADO! Todos os ${total} pacotes entregues foram bipados e baixados na J&T!`,
        });
        setTimeout(() => setBipFeedback(null), 6000);
        return;
      }

      const currentItem = readyForBip[count];
      const updated: DeliveryData = {
        ...currentItem,
        status: 'processado_jt',
        data_hora: new Date().toLocaleString('pt-BR'),
      };
      onUpdateDelivery(updated);
      count++;
      setBatchProgress(Math.round((count / total) * 100));
    }, 300);
  };

  // Move delivery to Waiting for PIN
  const handleMoveToPin = (item: DeliveryData) => {
    onUpdateDelivery({
      ...item,
      status: 'aguardando_pin',
    });
    setOpenMenuId(null);
    setBipFeedback({
      type: 'warning',
      msg: `🟡 Pacote ${item.codigo_pacote} marcado como 'Requer Palavra-Chave (PIN)'. A esteira NÃO TRAVA e você pode continuar bipando normalmente!`,
    });
    setTimeout(() => setBipFeedback(null), 5000);
  };

  // Send WhatsApp message to customer for PIN
  const handleSendWhatsAppPin = (item: DeliveryData) => {
    const name = item.nome_destinatario || item.recebedor_detalhes || 'Cliente';
    const text = encodeURIComponent(
      `Olá ${name}! Seu pacote ${item.codigo_pacote} da J&T Express está pronto para liberação. Por favor, envie sua Palavra-Chave (PIN) para que possamos concluir a entrega. Obrigado!`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Re-send Insucesso back to street (1. Reenviar Hoje)
  const handleResendToStreet = (item: DeliveryData) => {
    onUpdateDelivery({
      ...item,
      status: 'aguardando_rua',
      motivo_insucesso: undefined,
    });
    setBipFeedback({
      type: 'success',
      msg: `🔄 Pacote ${item.codigo_pacote} reenviado para a rota da rua do entregador no mesmo dia!`,
    });
    setTimeout(() => setBipFeedback(null), 4000);
  };

  // Schedule re-delivery for tomorrow (2. Agendar Reentrega)
  const handleScheduleReentry = (item: DeliveryData) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowFormatted = tomorrow.toLocaleDateString('pt-BR');

    onUpdateDelivery({
      ...item,
      status: 'agendado_reentrega',
      data_reentrega: tomorrowFormatted,
    });
    setBipFeedback({
      type: 'warning',
      msg: `📅 Pacote ${item.codigo_pacote} agendado para reentrega amanhã (${tomorrowFormatted})!`,
    });
    setTimeout(() => setBipFeedback(null), 4000);
  };

  // Mark for warehouse return (3. Devolver ao Galpão)
  const handleReturnToWarehouse = (item: DeliveryData) => {
    onUpdateDelivery({
      ...item,
      status: 'devolucao_galpao',
    });
    setBipFeedback({
      type: 'error',
      msg: `📦 Pacote ${item.codigo_pacote} marcado para Devolução Física ao Galpão J&T!`,
    });
    setTimeout(() => setBipFeedback(null), 4000);
  };

  // Helper logic for 10-pack batching & person grouping rules
  const getItemDisplayConfig = (item: DeliveryData, index: number, list: DeliveryData[]) => {
    // 1. Recipient grouping
    const nameKey = (item.nome_destinatario || item.recebedor_detalhes || '').toLowerCase().trim();
    const addrKey = (item.endereco_completo || item.endereco_rua || '').toLowerCase().trim();
    const personKey = nameKey ? `${nameKey}_${addrKey}` : null;

    let personPkgs: DeliveryData[] = [];
    let personPos = 0;

    if (personKey) {
      personPkgs = list.filter((d) => {
        const n = (d.nome_destinatario || d.recebedor_detalhes || '').toLowerCase().trim();
        const a = (d.endereco_completo || d.endereco_rua || '').toLowerCase().trim();
        return `${n}_${a}` === personKey;
      });
      personPos = personPkgs.findIndex((d) => d.id_entrega === item.id_entrega);
    }

    const isMultiPerson = personPkgs.length > 1;
    const isLastForPerson = isMultiPerson && personPos === personPkgs.length - 1;

    // 2. Association / Condo 10-pack batching
    const groupName = item.associacao_nome || (item.eh_predio ? `Condomínio ${addrKey}` : null);
    let groupPkgs: DeliveryData[] = [];
    let groupPos = 0;

    if (groupName) {
      groupPkgs = list.filter(
        (d) =>
          d.associacao_nome === item.associacao_nome ||
          (item.eh_predio && d.eh_predio)
      );
      groupPos = groupPkgs.findIndex((d) => d.id_entrega === item.id_entrega);
    }

    const totalInGroup = groupPkgs.length;
    const isLargeGroup = totalInGroup > 10;

    let batchNum = 1;
    let posInBatch = 1;
    let batchSize = 1;

    if (isLargeGroup) {
      batchNum = Math.floor(groupPos / 10) + 1;
      posInBatch = (groupPos % 10) + 1;
      batchSize = Math.min(10, totalInGroup - (batchNum - 1) * 10);
    }

    // Rules:
    // If multi-pkg person and NOT the last package for this person -> Label Only
    // If large group (>10) and NOT the last package of that 10-pack batch -> Label Only
    // Else -> Full Proof (Local photo + Receiver details)
    let isLabelOnly = false;
    let badgeText = '';

    if (isMultiPerson && !isLastForPerson) {
      isLabelOnly = true;
      badgeText = `🏷️ Etiqueta ${personPos + 1} de ${personPkgs.length} (${item.nome_destinatario || 'Cliente'}) — Local no pacote ${personPkgs.length}`;
    } else if (isLargeGroup && posInBatch < batchSize) {
      isLabelOnly = true;
      badgeText = `🏷️ Lote ${batchNum} (${posInBatch} de ${batchSize}) — Bipagem Rápida Etiqueta`;
    } else if (isLargeGroup && posInBatch === batchSize) {
      isLabelOnly = false;
      badgeText = `🏁 FIM DO LOTE ${batchNum} (${posInBatch} de ${batchSize}) — Confirmar Portaria / Balcão`;
    } else if (isMultiPerson && isLastForPerson) {
      isLabelOnly = false;
      badgeText = `📍 Pacote Final ${personPos + 1} de ${personPkgs.length} (${item.nome_destinatario}) — Validar Local de Entrega`;
    } else {
      isLabelOnly = false;
      badgeText = `📦 Pacote Individual`;
    }

    return {
      isLabelOnly,
      badgeText,
      isMultiPerson,
      personPos: personPos + 1,
      personTotal: personPkgs.length,
      isLargeGroup,
      batchNum,
      posInBatch,
      batchSize,
      groupName,
    };
  };

  const currentFocusedItem = filteredReady[focusedIndex];
  const currentConfig = currentFocusedItem
    ? getItemDisplayConfig(currentFocusedItem, focusedIndex, filteredReady)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-16 space-y-6 animate-fadeIn relative">
      
      {/* Banner Top Bar */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-purple-900/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Smartphone className="w-64 h-64 text-purple-300" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>PASSO 3 — PERFIL MÃE / MODO ESTEIRA DE BAIXAS</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Esteira de Baixas J&T Express
          </h2>
          <p className="text-xs sm:text-sm text-purple-200/80 leading-relaxed font-medium">
            Painel de conferência para a Mãe dar baixas ultra-rápidas na J&T com lotes de 10 em 10, agrupamento por cliente e trava de desfazer.
          </p>
        </div>
      </div>

      {/* TOP ISOLATED FOLDERS / TABS SWITCHER */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300">
        <button
          onClick={() => setEsteiraTab('esteira')}
          className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            esteiraTab === 'esteira'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-300/60'
          }`}
        >
          <Truck className="w-4 h-4 text-purple-300" />
          <span>🚗 Esteira de Baixas</span>
          <span className="bg-purple-950/80 text-purple-200 px-2 py-0.5 rounded-full text-[10px]">
            {readyForBip.length}
          </span>
        </button>

        <button
          onClick={() => setEsteiraTab('pin')}
          className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            esteiraTab === 'pin'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-300/60'
          }`}
        >
          <Key className="w-4 h-4 text-amber-200" />
          <span>🔒 Aguardando PIN</span>
          {waitingPin.length > 0 && (
            <span className="bg-amber-900 text-amber-100 px-2 py-0.5 rounded-full text-[10px] font-black">
              {waitingPin.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setEsteiraTab('insucesso')}
          className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            esteiraTab === 'insucesso'
              ? 'bg-rose-700 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-300/60'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-200" />
          <span>❌ Insucessos do Dia</span>
          {insucessosList.length > 0 && (
            <span className="bg-rose-950 text-rose-200 px-2 py-0.5 rounded-full text-[10px] font-black">
              {insucessosList.length}
            </span>
          )}
        </button>
      </div>

      {/* STATS SUMMARY BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-purple-800">🚗 Na Esteira (Rua)</span>
          <p className="text-2xl font-black text-slate-900">{readyForBip.length} <span className="text-xs font-normal text-slate-500">pcts</span></p>
        </div>

        <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-amber-900">🔒 Retidos em PIN</span>
          <p className="text-2xl font-black text-amber-900">{waitingPin.length} <span className="text-xs font-normal text-amber-700">pcts</span></p>
        </div>

        <div className="bg-purple-900 text-white p-3.5 rounded-2xl border border-purple-800 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-purple-200">🟣 Bipados J&T</span>
          <p className="text-2xl font-black text-white">{processedJt.length} <span className="text-xs font-normal text-purple-300">pcts</span></p>
        </div>

        <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-rose-800">❌ Não Entregues</span>
          <p className="text-2xl font-black text-rose-900">{insucessosList.length} <span className="text-xs font-normal text-rose-700">pcts</span></p>
        </div>
      </div>

      {/* TAB 1: ESTEIRA PRINCIPAL DE BAIXAS */}
      {esteiraTab === 'esteira' && (
        <div className="space-y-6">

          {/* Live Scanner / Bip Bar */}
          <div className="bg-white border-2 border-purple-300 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-purple-600 text-white rounded-2xl shadow-2xs">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 uppercase tracking-wide">
                    Leitor Físico / Bipagem Manual J&T
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Bipe o código de barras da etiqueta para confirmar a baixa na hora.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsContinuousScannerOpen(true)}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5 fill-slate-950" />
                  <span>⚡ Câmera Metralhadora</span>
                </button>

                <button
                  onClick={handleRunBatchBip}
                  disabled={readyForBip.length === 0 || isProcessingBatch}
                  className="bg-purple-900 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isProcessingBatch ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Baixando ({batchProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Bipar Lote Todo ({readyForBip.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <form onSubmit={handleBipSubmit} className="flex items-center gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-purple-600 font-bold">
                  🔍
                </div>
                <input
                  type="text"
                  value={bipInput}
                  onChange={(e) => setBipInput(e.target.value)}
                  placeholder="Aguardando bipagem... Ex: JT00000001BR"
                  className="w-full bg-purple-50/50 border-2 border-purple-300 focus:border-purple-600 focus:bg-white text-slate-900 text-sm font-mono font-black pl-10 pr-4 py-3 rounded-2xl outline-none shadow-inner"
                />
              </div>

              <button
                type="submit"
                className="bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs sm:text-sm px-6 py-3 rounded-2xl shadow-md cursor-pointer shrink-0"
              >
                🟣 Dar Baixa
              </button>
            </form>

            {bipFeedback && (
              <div
                className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold animate-fadeIn ${
                  bipFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : bipFeedback.type === 'warning'
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-rose-50 text-rose-900 border-rose-300'
                }`}
              >
                {bipFeedback.msg}
              </div>
            )}
          </div>

          {/* MAIN ESTEIRA CAROUSEL / STEPPER VIEW */}
          <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-800 space-y-4">
            
            {/* Carousel Header & View Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/20 text-purple-300 rounded-2xl border border-purple-500/30">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white flex items-center gap-2">
                    Carrossel da Esteira Inteligente
                    <span className="text-xs bg-purple-500/30 text-purple-200 px-3 py-0.5 rounded-full border border-purple-400/30 font-bold">
                      {filteredReady.length} na esteira
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Lotes de 10 em 10 para Associações e aglutinação de etiquetas por cliente.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                {/* Search */}
                <div className="relative w-48 sm:w-56">
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filtrar pacote..."
                    className="w-full bg-slate-800 border border-slate-700 text-xs text-white font-semibold pl-8 pr-3 py-2 rounded-xl focus:border-purple-500 outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>

                {/* View Mode Toggle Buttons */}
                <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 shrink-0">
                  <button
                    onClick={() => setViewMode('focused')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'focused' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🎯 Focado
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📱 Grade ({filteredReady.length})
                  </button>
                </div>
              </div>
            </div>

            {/* EMPTY STATE */}
            {filteredReady.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-14 h-14 bg-purple-950 text-purple-400 rounded-full flex items-center justify-center mx-auto border border-purple-800 shadow-inner">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="font-extrabold text-base text-slate-200">
                  Nenhum pacote pendente na Esteira de Baixas!
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Todos os pacotes entregues na rua já foram bipados e baixados no sistema J&T Express.
                </p>
              </div>
            ) : viewMode === 'focused' && currentFocusedItem && currentConfig ? (
              
              /* FOCUSED MODE: MODO TELA CHEIA PARA BIPAGEM COM PISTOLA J&T */
              <div className="space-y-5 animate-fadeIn">
                
                {/* Top Status & Cadence Bar */}
                <div className="bg-slate-800/90 border-2 border-purple-600/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-purple-600 text-white text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-xl shadow-xs">
                      📦 Pacote {focusedIndex + 1} de {filteredReady.length}
                    </span>
                    <span className="text-sm font-mono font-black text-purple-200 tracking-wider bg-purple-950/80 px-3 py-1 rounded-xl border border-purple-700">
                      {currentFocusedItem.codigo_pacote}
                    </span>
                    {currentConfig.groupName && (
                      <span className="text-xs font-black bg-purple-900 text-purple-100 px-3 py-1 rounded-xl border border-purple-700">
                        🏛️ {currentConfig.groupName}
                      </span>
                    )}
                  </div>

                  {/* Badge Rule Tag */}
                  <div className="text-xs font-extrabold text-purple-200 bg-purple-950 px-3.5 py-1.5 rounded-xl border border-purple-700 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-purple-400" />
                    <span>{currentConfig.badgeText}</span>
                  </div>
                </div>

                {/* MAIN HIGH-PERFORMANCE COMMAND CONSOLE CARD FOR PISTOL SCANNING */}
                <div className="bg-slate-950 border-2 border-purple-500/60 rounded-3xl p-4 sm:p-6 shadow-[0_0_40px_rgba(147,51,234,0.15)] space-y-6 relative">
                  
                  {/* Console Header & Dropdown Actions */}
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                      <span className="text-xs sm:text-sm font-black text-purple-200 tracking-wider uppercase">
                        MESA DE COMANDO • FILA CONTINUADA DE BAIXA J&T
                      </span>
                    </div>

                    <div className="relative shrink-0">
                      <button
                        onClick={() =>
                          setOpenMenuId(
                            openMenuId === currentFocusedItem.id_entrega
                              ? null
                              : currentFocusedItem.id_entrega
                          )
                        }
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer border border-slate-700 transition-all"
                        title="Mais opções"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {/* Dropdown Menu */}
                      {openMenuId === currentFocusedItem.id_entrega && (
                        <div className="absolute right-0 top-11 z-30 w-64 bg-slate-900 border-2 border-purple-500 rounded-2xl shadow-2xl p-2 space-y-1 text-xs animate-fadeIn">
                          <button
                            onClick={() => handleMoveToPin(currentFocusedItem)}
                            className="w-full text-left px-3 py-2 rounded-xl text-amber-300 hover:bg-amber-950/60 font-bold flex items-center gap-2 cursor-pointer"
                          >
                            <Key className="w-4 h-4 text-amber-400" />
                            <span>🔒 Mover para Aguardando PIN</span>
                          </button>

                          <button
                            onClick={() => {
                              setInsucessoDelivery(currentFocusedItem);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-rose-300 hover:bg-rose-950/60 font-bold flex items-center gap-2 cursor-pointer"
                          >
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                            <span>❌ Marcar Insucesso / Não Entregue</span>
                          </button>

                          <button
                            onClick={() => {
                              onSelectDeliveryForReceipt(currentFocusedItem);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-purple-200 hover:bg-purple-950/60 font-bold flex items-center gap-2 cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-purple-400" />
                            <span>📄 Ver Comprovante Digital Completo</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* a) CARD CENTRAL DA ETIQUETA: CONTEINER COM BORDA ILUMINADA (NEON AZUL/ROXO CORPORATIVO) */}
                  <div className="bg-slate-900 border-2 border-blue-500/80 shadow-[0_0_35px_rgba(59,130,246,0.25)] rounded-3xl p-5 sm:p-6 text-center space-y-4 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-300 font-black text-xs uppercase tracking-wider border border-blue-400/40">
                      <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span>🎯 ÁREA DE BIPAGEM PISTOLA J&T — CÓDIGO & ETIQUETA EM ALTO CONTRASTE</span>
                    </div>

                    {/* Barcode SVG Vector for laser scanner guns */}
                    <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-900 shadow-xl max-w-md mx-auto">
                      <SimpleBarcodeSVG code={currentFocusedItem.codigo_pacote} />
                    </div>

                    {/* Photo of label (if available) */}
                    {currentFocusedItem.foto_pacote_path || currentFocusedItem.foto_comprovante_url ? (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[11px] font-black text-blue-300 uppercase tracking-wide">
                          📸 Foto da Etiqueta Física Fixada no Pacote:
                        </p>
                        <div className="relative group max-w-xs mx-auto">
                          <img
                            src={currentFocusedItem.foto_pacote_path || currentFocusedItem.foto_comprovante_url}
                            alt="Foto da Etiqueta"
                            onClick={() => onSelectDeliveryForReceipt(currentFocusedItem)}
                            className="max-h-56 sm:max-h-64 w-auto mx-auto object-contain bg-white rounded-2xl border-2 border-blue-400 shadow-md cursor-pointer hover:scale-102 transition-all"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-800/90 rounded-2xl border border-slate-700 text-slate-300 font-bold text-xs max-w-md mx-auto">
                        📦 Etiqueta Registrada no Sistema: <span className="font-mono font-black text-purple-300">{currentFocusedItem.codigo_pacote}</span>
                      </div>
                    )}

                    <p className="text-xs font-semibold text-slate-400">
                      ⚡ Aponte o leitor de código de barras ou a câmera diretamente para o código para baixa instantânea.
                    </p>
                  </div>

                  {/* GRID DUPLO: b) PAINEL DE INFORMAÇÕES INTEGRADO + c) GALERIA DE PROVAS SECUNDÁRIA */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                    
                    {/* b) Painel de Informações Integrado */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="text-[11px] font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                          <User className="w-4 h-4 text-purple-400" />
                          <span>Informações do Destinatário & Rota</span>
                        </div>

                        <h4 className="font-black text-base text-white leading-snug">
                          {currentFocusedItem.nome_destinatario || currentFocusedItem.recebedor_detalhes || 'Morador/Destinatário'}
                        </h4>

                        <div className="text-xs font-bold text-slate-300 space-y-1">
                          <p className="flex items-start gap-1.5 text-slate-200">
                            <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                            <span>
                              {currentFocusedItem.endereco_rua || currentFocusedItem.endereco_completo || 'Endereço não informado'}
                              {currentFocusedItem.numero_casa ? `, Nº ${currentFocusedItem.numero_casa}` : ''}
                              {currentFocusedItem.complemento ? ` (${currentFocusedItem.complemento})` : ''}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-purple-200 bg-purple-950 px-3 py-1 rounded-xl border border-purple-800">
                            🏘️ {currentFocusedItem.bairro || 'Sem Bairro'}
                          </span>

                          {/* Tag de PIN / Palavra-Chave em destaque */}
                          {currentFocusedItem.palavra_chave ? (
                            <span className="text-xs font-black text-emerald-300 bg-emerald-950 px-3 py-1 rounded-xl border border-emerald-500/80 flex items-center gap-1.5 shadow-sm">
                              <Key className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>🔑 PIN: {currentFocusedItem.palavra_chave}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                              Sem PIN Obrigatório
                            </span>
                          )}
                        </div>

                        {currentFocusedItem.ajudante_nome && (
                          <p className="text-[11px] font-extrabold text-slate-400">
                            🛵 Entregador: <span className="text-slate-200">{currentFocusedItem.ajudante_nome}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* c) Galeria de Provas Secundária (Miniatura Discreta de Conferência) */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="text-[11px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Foto 2: Evidência do Local / Recebedor</span>
                        </div>

                        {currentFocusedItem.foto_local_path || currentFocusedItem.foto_comprovante_url ? (
                          <div className="relative group max-w-xs mx-auto">
                            <img
                              src={currentFocusedItem.foto_local_path || currentFocusedItem.foto_comprovante_url}
                              alt="Evidência Local"
                              onClick={() => onSelectDeliveryForReceipt(currentFocusedItem)}
                              className="w-full h-36 object-cover rounded-xl border-2 border-emerald-500/80 shadow-md cursor-pointer hover:scale-102 transition-all"
                            />
                            <span className="absolute bottom-2 right-2 bg-slate-950/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md pointer-events-none">
                              Ampliar 🔍
                            </span>
                          </div>
                        ) : (
                          <div className="w-full h-36 bg-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-400 font-bold text-xs p-3 text-center">
                            <span>📷 Sem Foto Secundária</span>
                            <span className="text-[10px] text-slate-500 font-normal mt-1">
                              Evidência digital guardada no inventário
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700 text-xs flex items-center justify-between">
                        <span className="text-slate-300 font-bold">
                          Recebedor: {currentFocusedItem.recebedor_detalhes || 'Morador'}
                        </span>
                        <span className="text-[10px] font-mono text-purple-300 font-bold">
                          {currentFocusedItem.data_hora}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* d) CONTROLES DE FILA: BOTÕES INFERIORES GRANDES E RESPONSIVOS */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800 max-w-3xl mx-auto">
                    <button
                      type="button"
                      onClick={() => setFocusedIndex((prev) => Math.max(0, prev - 1))}
                      disabled={focusedIndex === 0}
                      className="bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-200 font-black text-sm px-5 py-4 rounded-2xl flex items-center gap-2 cursor-pointer transition-all border border-slate-700 shadow-md shrink-0 active:scale-95"
                    >
                      <ChevronLeft className="w-5 h-5 text-purple-400" />
                      <span>⬅️ Pacote Anterior</span>
                    </button>

                    {/* BOTÃO PRINCIPAL DE CONFIRMAÇÃO DE BAIXA */}
                    <button
                      type="button"
                      onClick={() => executeConfirmBip(currentFocusedItem)}
                      className="bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white font-black text-base sm:text-lg px-8 py-4 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2.5 cursor-pointer transition-all hover:scale-102 flex-1 min-w-[240px] active:scale-98"
                    >
                      <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0" />
                      <span>🟢 Confirmar & Próximo (Baixa J&T)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFocusedIndex((prev) => Math.min(filteredReady.length - 1, prev + 1))}
                      disabled={focusedIndex === filteredReady.length - 1}
                      className="bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-200 font-black text-sm px-5 py-4 rounded-2xl flex items-center gap-2 cursor-pointer transition-all border border-slate-700 shadow-md shrink-0 active:scale-95"
                    >
                      <span>Próximo Pacote ➡️</span>
                      <ChevronRight className="w-5 h-5 text-purple-400" />
                    </button>
                  </div>

                  {/* AÇÕES SECUNDÁRIAS DISCRETAS (PIN E INSUCESSO) */}
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => handleMoveToPin(currentFocusedItem)}
                      className="bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-700/70 font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>🔒 Retirar por PIN Pendente</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInsucessoDelivery(currentFocusedItem);
                        setOpenMenuId(null);
                      }}
                      className="bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800/70 font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span>❌ Registrar Insucesso</span>
                    </button>
                  </div>

                </div>
              </div>

            ) : (

              /* GRID VIEW (ALL CARDS ON ESTEIRA) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredReady.map((item, idx) => {
                  const cfg = getItemDisplayConfig(item, idx, filteredReady);
                  return (
                    <div
                      key={item.id_entrega}
                      className="bg-slate-800/90 border-2 border-purple-800/60 hover:border-purple-500 rounded-2xl p-4 space-y-3 shadow-lg transition-all flex flex-col justify-between relative"
                    >
                      {/* Badge Tag */}
                      <div className="flex justify-between items-center text-[10px] font-bold text-purple-300 bg-purple-950 px-2.5 py-1 rounded-lg border border-purple-800">
                        <span>{cfg.badgeText}</span>
                        
                        {/* 3-Dots Menu Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === item.id_entrega ? null : item.id_entrega)}
                            className="text-slate-300 hover:text-white p-0.5 cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuId === item.id_entrega && (
                            <div className="absolute right-0 top-6 z-30 w-56 bg-slate-900 border-2 border-purple-500 rounded-xl shadow-2xl p-1.5 space-y-1 text-xs">
                              <button
                                onClick={() => handleMoveToPin(item)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-amber-300 hover:bg-amber-950 font-bold flex items-center gap-2 cursor-pointer"
                              >
                                <Key className="w-3.5 h-3.5" />
                                <span>🔒 Mover para Aguardando PIN</span>
                              </button>
                              <button
                                onClick={() => {
                                  setInsucessoDelivery(item);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-rose-300 hover:bg-rose-950 font-bold flex items-center gap-2 cursor-pointer"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>❌ Marcar Insucesso</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Photo & Recipient */}
                      <div className="flex items-start gap-3">
                        <img
                          src={item.foto_pacote_path || item.foto_comprovante_url || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=300&q=80'}
                          alt="Comprovante"
                          onClick={() => onSelectDeliveryForReceipt(item)}
                          className="w-14 h-14 object-cover rounded-xl border border-purple-400/50 cursor-pointer"
                        />
                        <div className="space-y-1 text-xs min-w-0 flex-1">
                          <h5 className="font-mono font-black text-purple-300 text-xs">{item.codigo_pacote}</h5>
                          <p className="font-black text-white truncate flex items-center gap-1">
                            <User className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate">{item.nome_destinatario || item.recebedor_detalhes || 'Morador/Destinatário'}</span>
                          </p>
                          <p className="text-[11px] text-slate-200 font-bold truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate">
                              {item.endereco_rua || item.endereco_completo || 'Rua não informada'}
                              {item.numero_casa ? `, Nº ${item.numero_casa}` : ''}
                            </span>
                          </p>
                          {item.palavra_chave && (
                            <span className="text-[10px] font-black text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/80 inline-flex items-center gap-1 my-0.5">
                              <Key className="w-3 h-3 text-emerald-400 shrink-0" />
                              🔑 PIN Registrado: {item.palavra_chave}
                            </span>
                          )}
                          <p className="text-[10px] font-black text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800/80 inline-block">
                            🏘️ Bairro: {item.bairro || 'Não informado'}
                          </p>
                        </div>
                      </div>

                      {/* Action Button Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleMoveToPin(item)}
                          className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5 text-amber-200" />
                          <span>⚠️ Requer PIN</span>
                        </button>
                        <button
                          onClick={() => executeConfirmBip(item)}
                          className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer shadow-md"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>🟣 Baixar J&T</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>
      )}

      {/* TAB 2: AGUARDANDO PALAVRA-CHAVE (PIN) */}
      {esteiraTab === 'pin' && (
        <div className="bg-amber-950/70 border-2 border-amber-600/80 rounded-3xl p-5 sm:p-6 text-amber-100 space-y-4 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-amber-800/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 text-slate-950 rounded-2xl font-black">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-lg text-amber-200">
                  🔒 Pasta de Pendências: Aguardando Palavra-Chave (PIN)
                </h3>
                <p className="text-xs text-amber-200/80 font-medium">
                  Estes pacotes estão bloqueados e NÃO entram na Esteira da Mãe até que o PIN seja validado.
                </p>
              </div>
            </div>

            <span className="bg-amber-500/20 text-amber-300 font-bold text-xs px-3 py-1 rounded-full border border-amber-500/30">
              {waitingPin.length} retidos
            </span>
          </div>

          {waitingPin.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-amber-400 mx-auto" />
              <h4 className="font-bold text-amber-200 text-sm">Nenhum pacote retido em PIN!</h4>
              <p className="text-xs text-amber-300/70">Todos os pacotes estão liberados para a esteira.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {waitingPin.map((pinItem) => (
                <div key={pinItem.id_entrega} className="bg-slate-900/95 border-2 border-amber-600/80 p-4 rounded-2xl space-y-3 text-xs shadow-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-black text-amber-300 text-sm">{pinItem.codigo_pacote}</span>
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                      🔒 Bloqueado PIN
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-white text-xs">{pinItem.nome_destinatario || pinItem.recebedor_detalhes}</p>
                    <p className="text-[11px] text-slate-300">
                      📍 {pinItem.endereco_completo || pinItem.endereco_rua || 'Endereço'} {pinItem.numero_casa ? `, Nº ${pinItem.numero_casa}` : ''}
                    </p>
                    {pinItem.palavra_chave && (
                      <p className="text-[10px] font-black text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/80 inline-flex items-center gap-1 my-0.5">
                        <Key className="w-3 h-3 text-emerald-400 shrink-0" />
                        🔑 PIN Registrado: {pinItem.palavra_chave}
                      </p>
                    )}
                    {pinItem.ajudante_nome && (
                      <p className="text-[10px] text-amber-300 font-bold">Ajudante: {pinItem.ajudante_nome}</p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <button
                      onClick={() => setPinPromptDelivery(pinItem)}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2 rounded-xl cursor-pointer shadow-xs"
                    >
                      🔑 Digitar PIN / Liberar Pacote
                    </button>

                    <button
                      onClick={() => handleSendWhatsAppPin(pinItem)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>💬 Cobrar PIN via WhatsApp</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INSUCESSOS DO DIA */}
      {esteiraTab === 'insucesso' && (
        <div className="bg-rose-950/70 border-2 border-rose-700/80 rounded-3xl p-5 sm:p-6 text-rose-100 space-y-4 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-rose-800/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-600 text-white rounded-2xl font-black">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-lg text-rose-200">
                  ❌ Pasta de Insucessos / Não Entregues do Dia
                </h3>
                <p className="text-xs text-rose-200/80 font-medium">
                  Registro de pacotes com falha de entrega na rua com motivo e ajudante responsável.
                </p>
              </div>
            </div>

            <span className="bg-rose-500/20 text-rose-300 font-bold text-xs px-3 py-1 rounded-full border border-rose-500/30">
              {insucessosList.length} falhas
            </span>
          </div>

          {insucessosList.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-rose-400 mx-auto" />
              <h4 className="font-bold text-rose-200 text-sm">Nenhum insucesso registrado hoje!</h4>
              <p className="text-xs text-rose-300/70">Todas as tentativas de entrega foram concluídas com sucesso.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {insucessosList.map((insItem) => (
                <div key={insItem.id_entrega} className="bg-slate-900/95 border-2 border-rose-700/80 p-4 rounded-2xl space-y-3 text-xs shadow-lg">
                  <div className="flex justify-between items-center flex-wrap gap-1">
                    <span className="font-mono font-black text-rose-300 text-sm">{insItem.codigo_pacote}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      insItem.status === 'agendado_reentrega'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : insItem.status === 'devolucao_galpao'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }`}>
                      {insItem.status === 'agendado_reentrega'
                        ? `📅 Agendado Reentrega (${insItem.data_reentrega || 'Amanhã'})`
                        : insItem.status === 'devolucao_galpao'
                        ? '📦 Devolução Galpão J&T'
                        : '❌ Não Entregue'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-white text-xs">{insItem.nome_destinatario || insItem.recebedor_detalhes}</p>
                    <p className="text-[11px] text-slate-300">
                      📍 {insItem.endereco_completo || insItem.endereco_rua || 'Endereço'} {insItem.numero_casa ? `, Nº ${insItem.numero_casa}` : ''}
                    </p>
                    <p className="text-[11px] font-bold text-rose-300 bg-rose-950/80 p-2 rounded-lg border border-rose-900">
                      ⚠️ Motivo: {insItem.motivo_insucesso || 'Cliente Ausente'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      🚚 Ajudante Responsável: <strong className="text-white">{insItem.ajudante_nome || 'Ajudante 1'}</strong>
                    </p>
                  </div>

                  {(insItem.foto_insucesso || insItem.foto_local_path) && (
                    <div>
                      <span className="text-[10px] text-rose-300 font-bold block mb-1">📸 Foto de Evidência da Tentativa:</span>
                      <img
                        src={insItem.foto_insucesso || insItem.foto_local_path}
                        alt="Evidência Insucesso"
                        className="w-full h-28 object-cover rounded-xl border border-rose-800"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 pt-2 border-t border-rose-900/80">
                    <p className="text-[10px] font-black text-rose-300/80 uppercase tracking-wider">
                      ⚡ Tratar Insucesso:
                    </p>

                    <button
                      onClick={() => handleResendToStreet(insItem)}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[11px] py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                      <span>1. 🔄 Reenviar Hoje (Volta pra Rua)</span>
                    </button>

                    <button
                      onClick={() => handleScheduleReentry(insItem)}
                      className="w-full bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[11px] py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <Calendar className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                      <span>2. 📅 Agendar Reentrega (Amanhã)</span>
                    </button>

                    <button
                      onClick={() => handleReturnToWarehouse(insItem)}
                      className="w-full bg-purple-700 hover:bg-purple-600 text-white font-extrabold text-[11px] py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <Package className="w-3.5 h-3.5 text-purple-200 shrink-0" />
                      <span>3. 📦 Devolver ao Galpão J&T</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FLOATING UNDO BANNER (TRAVA DESFAZER - 6 SECONDS) */}
      {lastConfirmedDelivery && undoTimeLeft > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white border-2 border-purple-500 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 animate-slideUp">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black">
                Pacote <span className="font-mono text-purple-300">{lastConfirmedDelivery.codigo_pacote}</span> baixado na J&T!
              </p>
              <p className="text-[10px] text-slate-300 font-medium">
                Trava de Desfazer ativa por: <strong className="text-amber-400 font-black">{undoTimeLeft}s</strong>
              </p>
            </div>
          </div>

          <button
            onClick={handleUndoLastBip}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black px-4 py-2 rounded-xl cursor-pointer shadow-md transition-all flex items-center gap-1.5 shrink-0"
          >
            <Undo2 className="w-4 h-4" />
            <span>↩️ Desfazer Baixa</span>
          </button>
        </div>
      )}

      {/* MODAL: INPUT PIN FOR WAITING PACKAGE */}
      {pinPromptDelivery && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500 text-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-black">
                <Key className="w-5 h-5" />
                <span>Validar Palavra-Chave (PIN)</span>
              </div>
              <button onClick={() => setPinPromptDelivery(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Informe a Palavra-Chave (PIN) fornecida pelo cliente <strong className="text-amber-300">{pinPromptDelivery.nome_destinatario}</strong> para liberar o pacote <strong className="font-mono text-amber-300">{pinPromptDelivery.codigo_pacote}</strong> para a Esteira da Mãe.
            </p>

            <input
              type="text"
              value={pinInputVal}
              onChange={(e) => setPinInputVal(e.target.value)}
              placeholder="Digite o PIN ou Palavra-Chave..."
              className="w-full bg-slate-800 border-2 border-amber-500/80 rounded-xl px-4 py-3 font-mono font-black text-sm text-amber-300 outline-none focus:bg-slate-950"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPinPromptDelivery(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (pinInputVal.trim()) {
                    onUpdateDelivery({
                      ...pinPromptDelivery,
                      status: 'entregue',
                      palavra_chave: pinInputVal.trim(),
                    });
                    setPinPromptDelivery(null);
                    setPinInputVal('');
                    setBipFeedback({
                      type: 'success',
                      msg: `✅ PIN validado com sucesso! O pacote foi liberado para a Esteira da Mãe.`,
                    });
                    setTimeout(() => setBipFeedback(null), 4000);
                  }
                }}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black px-5 py-2 rounded-xl cursor-pointer shadow-md"
              >
                🔑 Confirmar & Liberar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MARK INSUCESSO REASON */}
      {insucessoDelivery && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-rose-600 text-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-black">
                <AlertTriangle className="w-5 h-5" />
                <span>Registrar Insucesso na Entrega</span>
              </div>
              <button onClick={() => setInsucessoDelivery(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Pacote: <strong className="font-mono text-rose-300">{insucessoDelivery.codigo_pacote}</strong> ({insucessoDelivery.nome_destinatario || 'Cliente'})
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Motivo do Insucesso:</label>
              <select
                value={insucessoReason}
                onChange={(e) => setInsucessoReason(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-xs text-white font-bold rounded-xl p-3 outline-none"
              >
                <option value="Cliente Ausente">👤 Cliente Ausente (Ninguém atendeu)</option>
                <option value="Empresa Fechada">🏢 Empresa / Estabelecimento Fechado</option>
                <option value="Portaria Recusou">🚪 Portaria / Condomínio Recusou</option>
                <option value="Cliente não soube/passou Palavra-Chave">🔑 Cliente não soube/passou Palavra-Chave (PIN)</option>
                <option value="Endereço Não Localizado">📍 Endereço Não Localizado / Incompleto</option>
                <option value="Outro Motivo">⚠️ Outro Motivo Operacional</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setInsucessoDelivery(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onUpdateDelivery({
                    ...insucessoDelivery,
                    status: 'insucesso',
                    motivo_insucesso: insucessoReason,
                  });
                  setInsucessoDelivery(null);
                  setBipFeedback({
                    type: 'warning',
                    msg: `❌ Pacote marcado como Insucesso (${insucessoReason}) e movido para a pasta de insucessos.`,
                  });
                  setTimeout(() => setBipFeedback(null), 4000);
                }}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-black px-5 py-2 rounded-xl cursor-pointer shadow-md"
              >
                Confirmar Insucesso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SCANNER CONTINUO EM CAMERA ABERTA */}
      <ContinuousScannerModal
        isOpen={isContinuousScannerOpen}
        isPaused={Boolean(pinPromptDelivery || insucessoDelivery)}
        onClose={() => setIsContinuousScannerOpen(false)}
        onScanCode={(code, photoDataUrl) => {
          const cleanCode = code.trim().toUpperCase();
          const item = readyForBip.find((d) => d.codigo_pacote.toUpperCase() === cleanCode);
          if (!item) {
            setBipFeedback({
              type: 'error',
              msg: `❌ Pacote ${cleanCode} não encontrado na esteira de prontas.`,
            });
          } else {
            const updatedItem = photoDataUrl ? { ...item, foto_pacote_path: photoDataUrl } : item;
            executeConfirmBip(updatedItem);
          }
        }}
        modoContinuo={true}
      />
    </div>
  );
};
