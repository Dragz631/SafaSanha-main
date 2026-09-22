import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  MapPin,
  User,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Home,
  Users,
  ShieldCheck,
  Inbox,
  UserCheck,
  FileText,
} from 'lucide-react';
import { DeliveryData, ReceiverType } from '../types';
import { triggerCoinBurst } from '../utils/rewardEffect';
import {
  buildWhatsAppMessage,
  buildInsucessoWhatsAppMessage,
  copyTextToClipboard,
  getFormattedCurrentTime,
  getFormattedCurrentDate
} from '../utils/whatsappHelper';
import { cleanDoormanName } from '../utils/recebedorTexto';
import { RecebedoresConhecidos } from './RecebedoresConhecidos';
import { useMemoria } from '../state/MemoriaContext';
import { registrarRecebedor, sugerirRecebedores } from '../domain/memoria';
import { interpretarComplemento } from '../domain/endereco';
import { aplicarEntrega, aplicarInsucesso } from '../domain/entrega';

interface DeliveryWhatsAppModalProps {
  isOpen?: boolean;
  delivery: DeliveryData | null;
  /** Destino conhecido a que o pacote pertence (memória de recebedores é POR DESTINO, não por rua+número). */
  destinoId?: string;
  initialMode?: 'entrega' | 'insucesso';
  initialEditingReceipt?: boolean;
  onClose: () => void;
  /** Recebe o pacote já atualizado (status correto, recebedor real, fotos, horários). */
  onConfirmDelivery?: (updated: DeliveryData) => void;
  onSaveDelivery?: (updated: DeliveryData) => void;
}

const RECEIVER_PRESETS = [
  { id: 'proprio_morador', label: 'Próprio Morador', icon: User },
  { id: 'vizinho', label: 'Vizinho', icon: Home, placeholder: 'Ex: Vizinho Nº 12 ou da casa ao lado' },
  { id: 'terceiros', label: 'Terceiros / Outro', icon: UserCheck, placeholder: 'Ex: Nome da pessoa ou detalhes' },
  { id: 'familiar', label: 'Familiar / Parente', icon: Users, placeholder: 'Ex: Esposa, Mãe, Filho, Irmão' },
  { id: 'portaria', label: 'Portaria / Zelador', icon: ShieldCheck, placeholder: 'Ex: Porteiro José / Portaria bloco B' },
  { id: 'local_seguro', label: 'Local seguro (Grade/Portão)', icon: Inbox, placeholder: 'Ex: Por baixo do portão, na grade' },
];

const INSUCESSO_REASONS = [
  'Morador ausente / Ninguém atende',
  'Endereço não localizado / Nº não encontrado',
  'Acesso impedido / Portão trancado',
  'Cachorro solto / Risco no local',
  'Recusado pelo destinatário',
  'Sem local seguro / Chuva forte',
  'Outro motivo',
];

export const FAMILY_RELATIONS = [
  'Filho',
  'Filha',
  'Mãe',
  'Pai',
  'Esposa',
  'Marido',
  'Irmão',
  'Irmã',
  'Avô',
  'Avó',
  'Tio(a)',
  'Sobrinho(a)',
];

export const NEIGHBOR_LOCATION_PRESETS = [
  'Casa ao lado',
  'Casa da frente',
  'Fundos',
  'Vila ao lado',
];

export const DeliveryWhatsAppModal: React.FC<DeliveryWhatsAppModalProps> = ({
  isOpen = true,
  delivery,
  destinoId,
  initialMode = 'entrega',
  initialEditingReceipt = false,
  onClose,
  onConfirmDelivery,
  onSaveDelivery,
}) => {
  const { memoria, atualizar } = useMemoria();
  const [mode, setMode] = useState<'entrega' | 'insucesso'>(initialMode);
  
  // Verifica se o pacote já foi entregue anteriormente
  const isAlreadyDelivered = Boolean(
    delivery && (delivery.status === 'entregue' || delivery.status === 'concluido')
  );

  // Modo de edição caso o entregador queira corrigir dados de uma entrega já feita
  const [isEditingReceipt, setIsEditingReceipt] = useState(initialEditingReceipt);

  // Dados da Entrega
  const [clientName, setClientName] = useState('');
  const [streetName, setStreetName] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [packageCode, setPackageCode] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  // Recebedor (Sucesso)
  const [receiverType, setReceiverType] = useState<string>('proprio_morador');
  const [receiverCustomText, setReceiverCustomText] = useState<string>('');

  // Familiar
  const [familyRelation, setFamilyRelation] = useState<string>('');
  const [familyName, setFamilyName] = useState<string>('');

  // Vizinho
  const [neighborNumber, setNeighborNumber] = useState<string>('');
  const [neighborName, setNeighborName] = useState<string>('');

  // Insucesso
  const [selectedReason, setSelectedReason] = useState<string>(INSUCESSO_REASONS[0]);
  const [customReasonText, setCustomReasonText] = useState<string>('');

  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [isEditingData, setIsEditingData] = useState(false);

  useEffect(() => {
    if (delivery) {
      setClientName(delivery.nome_destinatario || 'Cliente');
      const st = delivery.endereco_rua || delivery.endereco_completo?.split(',')[0]?.trim() || 'Rua Carlos Seidl';
      const num = delivery.numero_casa || delivery.endereco_numero || 'S/N';
      setStreetName(st);
      setHouseNumber(num);
      setComplement(delivery.complemento || delivery.endereco_complemento || '');
      setPackageCode(
        delivery.codigo_pacote.startsWith('#')
          ? delivery.codigo_pacote
          : `#${delivery.codigo_pacote}`
      );
      
      const alreadyDone = delivery.status === 'entregue' || delivery.status === 'concluido';
      const effectiveDate = alreadyDone && delivery.data_hora ? delivery.data_hora : new Date();
      
      setDeliveryTime(getFormattedCurrentTime(effectiveDate));
      setDeliveryDate(getFormattedCurrentDate(effectiveDate));
      
      if (delivery.status === 'insucesso') {
        setMode('insucesso');
        if (delivery.motivo_insucesso) {
          setSelectedReason(delivery.motivo_insucesso);
        }
      } else {
        setMode(initialMode || 'entrega');
        if (delivery.recebedor_tipo) {
          setReceiverType(delivery.recebedor_tipo);
        }
        if (delivery.recebedor_detalhes) {
          setReceiverCustomText(delivery.recebedor_detalhes);

          if (delivery.recebedor_tipo === 'familiar') {
            const famMatch = delivery.recebedor_detalhes.match(/^Familiar\s*\((.*?)\)$/i);
            const inner = famMatch ? famMatch[1].trim() : delivery.recebedor_detalhes;
            const parts = inner.split(/[:\-]/);
            if (parts.length > 1) {
              setFamilyRelation(parts[0].trim());
              setFamilyName(parts.slice(1).join('-').trim().replace(/^\((.*?)\)$/, '$1'));
            } else if (FAMILY_RELATIONS.some((r) => r.toLowerCase() === inner.toLowerCase())) {
              setFamilyRelation(inner);
              setFamilyName('');
            } else {
              setFamilyName(inner);
            }
          }

          if (delivery.recebedor_tipo === 'vizinho') {
            const vizMatch = delivery.recebedor_detalhes.match(/^Vizinho\s*\((.*?)\)$/i);
            const inner = vizMatch ? vizMatch[1].trim() : delivery.recebedor_detalhes;
            const parenMatch = inner.match(/^(.*?)\s*\((.*?)\)$/);
            if (parenMatch) {
              setNeighborNumber(parenMatch[1].replace(/^Nº\s*/i, '').trim());
              setNeighborName(parenMatch[2].trim());
            } else if (/^\d+/.test(inner) || inner.toLowerCase().startsWith('nº') || inner.toLowerCase().startsWith('casa')) {
              setNeighborNumber(inner.replace(/^Nº\s*/i, '').trim());
              setNeighborName('');
            } else {
              setNeighborName(inner);
            }
          }
        }
      }

      setCopied(false);
      setIsEditingReceipt(initialEditingReceipt || false);
      setIsEditingData(false);
      setShareFeedback(null);
    }
  }, [delivery, initialMode, initialEditingReceipt]);

  // Recebedores CONHECIDOS deste destino (sugestão; quem recebeu de fato é o que o operador confirmar abaixo)
  const unidadeChave = useMemo(() => interpretarComplemento(complement).unidade?.chave, [complement]);
  const conhecidos = (categoria: string) =>
    sugerirRecebedores(memoria, destinoId, { categoria, unidadeChave }).map((r) => r.rotulo);
  const savedDoormen = useMemo(() => conhecidos('portaria'), [memoria, destinoId, unidadeChave]);
  const savedFamily = useMemo(() => conhecidos('familiar'), [memoria, destinoId, unidadeChave]);
  const savedNeighbors = useMemo(() => conhecidos('vizinho'), [memoria, destinoId, unidadeChave]);
  const savedTerceiros = useMemo(() => conhecidos('terceiros'), [memoria, destinoId, unidadeChave]);

  // Calcula o nome final do recebedor dinamicamente
  const computedReceiver = useMemo(() => {
    if (receiverType === 'proprio_morador') return 'Próprio Morador';
    
    if (receiverType === 'vizinho') {
      const numPart = neighborNumber.trim();
      const namePart = neighborName.trim();
      if (numPart || namePart) {
        let detail = '';
        if (numPart && namePart) {
          detail = /^\d+/.test(numPart) ? `Nº ${numPart} (${namePart})` : `${numPart} (${namePart})`;
        } else if (numPart) {
          detail = /^\d+/.test(numPart) ? `Nº ${numPart}` : numPart;
        } else {
          detail = namePart;
        }
        return `Vizinho (${detail})`;
      }
      return receiverCustomText.trim()
        ? `Vizinho (${receiverCustomText.trim()})`
        : 'Vizinho';
    }

    if (receiverType === 'terceiros') {
      return receiverCustomText.trim()
        ? `Terceiros (${receiverCustomText.trim()})`
        : 'Terceiros';
    }

    if (receiverType === 'familiar') {
      const rel = familyRelation.trim();
      const nm = familyName.trim();
      if (rel || nm) {
        const detail = rel
          ? nm
            ? `${rel}: ${nm}`
            : rel
          : nm;
        return `Familiar (${detail})`;
      }
      return receiverCustomText.trim()
        ? `Familiar (${receiverCustomText.trim()})`
        : 'Familiar / Parente';
    }

    if (receiverType === 'portaria') {
      const clean = cleanDoormanName(receiverCustomText);
      return clean
        ? `Portaria (${clean})`
        : 'Portaria / Zelador';
    }

    if (receiverType === 'local_seguro') {
      return receiverCustomText.trim()
        ? `Local Seguro (${receiverCustomText.trim()})`
        : 'Local seguro (Grade/Portão)';
    }

    return receiverCustomText.trim() || 'Outro Recebedor';
  }, [receiverType, receiverCustomText, familyRelation, familyName, neighborNumber, neighborName]);

  const computedReason = useMemo(() => {
    if (selectedReason === 'Outro motivo') {
      return customReasonText.trim() || 'Outro motivo';
    }
    return selectedReason;
  }, [selectedReason, customReasonText]);

  // Mensagem calculada em tempo real
  const currentMessage = useMemo(() => {
    if (!delivery) return '';
    if (mode === 'entrega') {
      return buildWhatsAppMessage(
        {
          ...delivery,
          nome_destinatario: clientName,
          endereco_rua: streetName,
          numero_casa: houseNumber,
          complemento: complement,
          codigo_pacote: packageCode,
        },
        {
          customReceiver: isAlreadyDelivered && !isEditingReceipt && delivery.recebedor_detalhes ? delivery.recebedor_detalhes : computedReceiver,
          customDate: deliveryDate,
          customTime: deliveryTime,
        }
      );
    } else {
      return buildInsucessoWhatsAppMessage(
        {
          ...delivery,
          nome_destinatario: clientName,
          endereco_rua: streetName,
          numero_casa: houseNumber,
          complemento: complement,
          codigo_pacote: packageCode,
        },
        computedReason,
        {
          customDate: deliveryDate,
          customTime: deliveryTime,
        }
      );
    }
  }, [
    mode,
    delivery,
    clientName,
    streetName,
    houseNumber,
    complement,
    packageCode,
    computedReceiver,
    computedReason,
    deliveryDate,
    deliveryTime,
    isAlreadyDelivered,
    isEditingReceipt,
  ]);

  const saveUpdatedDelivery = (newStatus: 'entregue' | 'insucesso') => {
    if (!delivery) return;
    const agora = new Date().toISOString();

    // Aprende com QUEM RECEBEU DE FATO. O histórico só sugere; o registro da entrega guarda o recebedor real.
    if (mode === 'entrega' && newStatus === 'entregue' && destinoId) {
      let rotulo = '';
      if (receiverType === 'portaria') {
        rotulo = cleanDoormanName(receiverCustomText);
      } else if (receiverType === 'familiar') {
        rotulo = familyRelation
          ? familyName.trim()
            ? `${familyRelation} (${familyName.trim()})`
            : familyRelation
          : familyName.trim() || receiverCustomText.trim();
      } else if (receiverType === 'vizinho') {
        const numPart = neighborNumber.trim();
        const namePart = neighborName.trim();
        rotulo = numPart && namePart
          ? (/^\d+/.test(numPart) ? `Nº ${numPart} (${namePart})` : `${numPart} (${namePart})`)
          : (numPart ? (/^\d+/.test(numPart) ? `Nº ${numPart}` : numPart) : namePart || receiverCustomText.trim());
      } else if (receiverType === 'terceiros' || receiverType === 'local_seguro') {
        rotulo = receiverCustomText.trim();
      }
      if (rotulo.length >= 2) {
        atualizar((m) => registrarRecebedor(m, destinoId, { categoria: receiverType, rotulo, unidadeChave }, agora));
      }
    }

    const base: DeliveryData = {
      ...delivery,
      nome_destinatario: clientName,
      endereco_rua: streetName,
      numero_casa: houseNumber,
      endereco_numero: houseNumber,
      complemento: complement.trim() || undefined,
      codigo_pacote: packageCode,
    };
    // Corrigir o recibo de uma entrega já feita não muda a hora em que ela aconteceu.
    const quando = isAlreadyDelivered ? delivery.data_hora_entrega || delivery.data_hora : agora;
    const updated =
      newStatus === 'entregue'
        ? aplicarEntrega(
            base,
            {
              recebedor_tipo: (receiverType as ReceiverType) || 'proprio_morador',
              recebedor_detalhes: computedReceiver,
            },
            quando
          )
        : aplicarInsucesso(base, computedReason, agora);

    if (onConfirmDelivery) onConfirmDelivery(updated);
    else if (onSaveDelivery) onSaveDelivery(updated);
  };

  /**
   * Copiar Texto e Concluir Entrega (1 toque rápido)
   * Se for uma nova entrega bem-sucedida, concede +2 moedas de ouro!
   * Se já estiver entregue, NUNCA duplica moedas.
   */
  const handleCopyAndComplete = async (e?: React.MouseEvent) => {
    const targetStatus = mode === 'entrega' ? 'entregue' : 'insucesso';

    // 1. Copia o texto para a área de transferência do celular
    await copyTextToClipboard(currentMessage);
    setCopied(true);

    // 2. Concede +2 moedas de ouro APENAS se for uma nova entrega concluída
    if (targetStatus === 'entregue' && !isAlreadyDelivered) {
      try {
        triggerCoinBurst(2, clientName, e || null);
      } catch (_err) {}
    }

    // 3. Salva a entrega com o novo status
    saveUpdatedDelivery(targetStatus);

    setShareFeedback(
      targetStatus === 'entregue'
        ? '📋 Texto copiado e entrega concluída (+2 🪙)!'
        : '📋 Texto copiado e insucesso registrado!'
    );

    setTimeout(() => {
      onClose();
    }, 450);
  };

  /**
   * Concluir sem Copiar
   */
  const handleCompleteWithoutCopy = (e?: React.MouseEvent) => {
    const targetStatus = mode === 'entrega' ? 'entregue' : 'insucesso';

    // Concede moedas apenas se for nova entrega
    if (targetStatus === 'entregue' && !isAlreadyDelivered) {
      try {
        triggerCoinBurst(2, clientName, e || null);
      } catch (_err) {}
    }

    saveUpdatedDelivery(targetStatus);
    onClose();
  };

  /**
   * Copiar Texto do Registro (quando já entregue) - SEM MOEDAS DUPLICADAS
   */
  const handleCopyReceipt = async () => {
    const success = await copyTextToClipboard(currentMessage);
    if (success) {
      setCopied(true);
      setShareFeedback('✓ Texto da entrega copiado com sucesso!');
      setTimeout(() => {
        setCopied(false);
        setShareFeedback(null);
      }, 2500);
    }
  };

  const activePreset = RECEIVER_PRESETS.find(p => p.id === receiverType);

  if (!isOpen || !delivery) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn overflow-hidden">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border-t sm:border border-slate-200/90 dark:border-slate-800 flex flex-col max-h-[92vh] sm:max-h-[90vh] pb-safe transition-colors">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer touch-manipulation"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 pr-10">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black shrink-0 border shadow-xs ${
              isAlreadyDelivered && !isEditingReceipt
                ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : isEditingReceipt
                ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : mode === 'entrega'
                ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30'
            }`}>
              {isAlreadyDelivered && !isEditingReceipt ? (
                <FileText className="w-5 h-5 stroke-[2.5]" />
              ) : isEditingReceipt ? (
                <Edit2 className="w-5 h-5 stroke-[2.5]" />
              ) : mode === 'entrega' ? (
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              )}
            </div>

            <div className="min-w-0">
              <h2 className="font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight truncate leading-tight">
                {isAlreadyDelivered && !isEditingReceipt
                  ? 'Registro da Entrega'
                  : isEditingReceipt
                  ? 'Corrigir Recebedor'
                  : mode === 'entrega'
                  ? 'Registrar Entrega'
                  : 'Registrar Insucesso'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5">
                {houseNumber !== 'S/N' ? `Nº ${houseNumber} • ` : ''}{streetName}
                {complement ? ` (${complement})` : ''}
              </p>
            </div>
          </div>

          {/* Toggle Sucesso vs Insucesso (apenas quando registrando nova entrega) */}
          {!isAlreadyDelivered && !isEditingReceipt && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 mt-3">
              <button
                type="button"
                onClick={() => setMode('entrega')}
                className={`flex-1 h-9 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-manipulation ${
                  mode === 'entrega'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>Entregue (+2 🪙)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('insucesso')}
                className={`flex-1 h-9 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-manipulation ${
                  mode === 'insucesso'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                <span>Insucesso</span>
              </button>
            </div>
          )}
        </div>

        {/* CORPO DO MODAL */}
        {isAlreadyDelivered && !isEditingReceipt ? (
          /* CASO 1: VISUALIZANDO REGISTRO DA ENTREGA JÁ FEITA */
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
            {/* Banner de Entrega Concluída */}
            <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                    <span>Entrega Concluída</span>
                    <span className="bg-amber-400/20 text-amber-800 dark:text-amber-300 text-[10px] font-black px-1.5 py-0.2 rounded-md border border-amber-400/30">
                      +2 🪙 Moedas
                    </span>
                  </h3>
                  <p className="text-[11px] text-emerald-800/90 dark:text-emerald-400 font-semibold mt-0.5">
                    Registrada às {deliveryTime} ({deliveryDate})
                  </p>
                </div>
              </div>
            </div>

            {/* Informações de Quem Recebeu */}
            <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Quem Recebeu:
                </span>
                <span className="font-black text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>{delivery.recebedor_detalhes || computedReceiver}</span>
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Destinatário:</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">{clientName}</span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Código:</span>
                <span className="font-mono font-black text-slate-700 dark:text-slate-300 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.2 rounded-md">
                  {packageCode}
                </span>
              </div>
            </div>

            {/* Mensagem WhatsApp Formatada */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Comprovante / WhatsApp:
                </span>
                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer touch-manipulation ${
                    copied
                      ? 'bg-emerald-600 text-white border-emerald-600 font-black'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {copied ? <Check className="w-3 h-3 stroke-[3]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>

              <pre className="font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 select-all max-h-44 overflow-y-auto">
                {currentMessage}
              </pre>
            </div>

          </div>
        ) : (
          /* CASO 2: FORMULÁRIO DE REGISTRO / EDIÇÃO DE RECEBEDOR */
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
            
            {/* SELEÇÃO DE RECEBEDOR (MODO ENTREGA) */}
            {mode === 'entrega' && (
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Quem recebeu o pacote? *</span>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {RECEIVER_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = receiverType === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setReceiverType(preset.id);
                          if (preset.id === 'proprio_morador') {
                            setReceiverCustomText('');
                          } else if (preset.id === 'portaria' && savedDoormen.length === 1 && !receiverCustomText) {
                            setReceiverCustomText(savedDoormen[0]);
                          }
                        }}
                        className={`min-h-[50px] p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer touch-manipulation active:scale-95 ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-950 dark:text-emerald-100 font-black shadow-xs ring-2 ring-emerald-500/20'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 font-bold'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                        <span className="text-xs leading-tight">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Porteiros Cadastrados no Endereço */}
                {receiverType === 'portaria' && savedDoormen.length > 0 && (
                  <div className="p-3 bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/40 rounded-2xl space-y-2 animate-fadeIn shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 stroke-[2.5]" />
                        <span>Porteiros conhecidos neste destino:</span>
                      </span>
                      <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 bg-amber-200/70 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
                        Memória
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {savedDoormen.map((doorman) => {
                        const isChosen = cleanDoormanName(receiverCustomText).toLowerCase() === doorman.toLowerCase();
                        return (
                          <button
                            key={doorman}
                            type="button"
                            onClick={() => setReceiverCustomText(doorman)}
                            className={`h-9 px-3 rounded-xl text-xs font-black transition-all cursor-pointer touch-manipulation flex items-center gap-1.5 ${
                              isChosen
                                ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-500/30'
                                : 'bg-white dark:bg-slate-800 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 hover:bg-amber-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <User className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>{doorman}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* DETALHES ESPECÍFICOS DE ACORDO COM QUEM RECEBEU */}

                {/* CASO A: PORTARIA */}
                {receiverType === 'portaria' && (
                  <div className="space-y-1 animate-fadeIn pt-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Nome do Porteiro / Detalhes da Portaria:
                    </label>
                    <input
                      type="text"
                      value={receiverCustomText}
                      onChange={(e) => setReceiverCustomText(e.target.value)}
                      placeholder="Ex: Porteiro José / Portaria bloco B"
                      className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900"
                      autoFocus={savedDoormen.length === 0}
                    />
                  </div>
                )}

                {/* CASO B: FAMILIAR / PARENTE */}
                {receiverType === 'familiar' && (
                  <div className="space-y-2.5 animate-fadeIn p-3 bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/90 dark:border-slate-800 rounded-2xl">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                          <span>Quem é o familiar? *</span>
                        </span>
                        {familyRelation && (
                          <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-300/60 dark:border-emerald-800/60">
                            {familyRelation}
                          </span>
                        )}
                      </div>

                      {/* Chips de Parentesco Rápido */}
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {FAMILY_RELATIONS.map((rel) => {
                          const isSelected = familyRelation === rel;
                          return (
                            <button
                              key={rel}
                              type="button"
                              onClick={() => setFamilyRelation(rel)}
                              className={`h-9 px-2 rounded-xl text-xs font-black transition-all cursor-pointer touch-manipulation active:scale-95 flex items-center justify-center ${
                                isSelected
                                  ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/20'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 font-bold'
                              }`}
                            >
                              {rel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Nome do familiar */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Nome do familiar (opcional):
                      </label>
                      <input
                        type="text"
                        value={familyName}
                        onChange={(e) => setFamilyName(e.target.value)}
                        placeholder="Ex: Lucas, Dona Maria..."
                        className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Familiares Salvos nesta residência */}
                    {savedFamily.length > 0 && (
                      <div className="pt-1 space-y-1.5 border-t border-slate-200/60 dark:border-slate-800/80">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Conhecidos neste destino:
                          </span>
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">1 toque</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {savedFamily.map((fam) => (
                            <button
                              key={fam}
                              type="button"
                              onClick={() => {
                                const parts = fam.split(/[:\-]/);
                                if (parts.length > 1) {
                                  setFamilyRelation(parts[0].trim());
                                  setFamilyName(parts.slice(1).join('-').trim().replace(/^\((.*?)\)$/, '$1'));
                                } else if (FAMILY_RELATIONS.some((r) => r.toLowerCase() === fam.toLowerCase())) {
                                  setFamilyRelation(fam);
                                  setFamilyName('');
                                } else {
                                  setFamilyName(fam);
                                }
                              }}
                              className="h-8 px-2.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                            >
                              <Users className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>{fam}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* CASO C: VIZINHO */}
                {receiverType === 'vizinho' && (
                  <div className="space-y-2.5 animate-fadeIn p-3 bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/90 dark:border-slate-800 rounded-2xl">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 block flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Home className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                          <span>Nº da casa ou local do vizinho: *</span>
                        </span>
                      </label>

                      {/* Chips rápidos de localização de vizinho */}
                      <div className="flex flex-wrap gap-1.5">
                        {NEIGHBOR_LOCATION_PRESETS.map((loc) => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => setNeighborNumber(loc)}
                            className={`h-8 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              neighborNumber === loc
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {loc}
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={neighborNumber}
                        onChange={(e) => setNeighborNumber(e.target.value)}
                        placeholder="Ex: 144 ou Casa ao lado"
                        className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                    </div>

                    {/* Nome do vizinho */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Nome do vizinho (opcional):
                      </label>
                      <input
                        type="text"
                        value={neighborName}
                        onChange={(e) => setNeighborName(e.target.value)}
                        placeholder="Ex: Dona Maria, Seu Carlos..."
                        className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Vizinhos salvos no endereço */}
                    {savedNeighbors.length > 0 && (
                      <div className="pt-1 space-y-1.5 border-t border-slate-200/60 dark:border-slate-800/80">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Vizinhos conhecidos neste destino:
                          </span>
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">1 toque</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {savedNeighbors.map((viz) => (
                            <button
                              key={viz}
                              type="button"
                              onClick={() => {
                                const parenMatch = viz.match(/^(.*?)\s*\((.*?)\)$/);
                                if (parenMatch) {
                                  setNeighborNumber(parenMatch[1].replace(/^Nº\s*/i, '').trim());
                                  setNeighborName(parenMatch[2].trim());
                                } else {
                                  setNeighborNumber(viz.replace(/^Nº\s*/i, '').trim());
                                }
                              }}
                              className="h-8 px-2.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                            >
                              <Home className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>{viz}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* CASO D: LOCAL SEGURO */}
                {receiverType === 'local_seguro' && (
                  <div className="space-y-2 animate-fadeIn p-3 bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/90 dark:border-slate-800 rounded-2xl">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Onde o pacote foi deixado?
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Por baixo do portão', 'Na grade', 'Caixa de correio', 'Com o vigia'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setReceiverCustomText(opt)}
                          className={`h-8 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            receiverCustomText === opt
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={receiverCustomText}
                      onChange={(e) => setReceiverCustomText(e.target.value)}
                      placeholder="Ex: Por baixo do portão, na grade..."
                      className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}

                {/* CASO E: TERCEIROS / OUTROS */}
                {receiverType === 'terceiros' && (
                  <div className="space-y-1 animate-fadeIn pt-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Nome / Identificação de quem recebeu:
                    </label>
                    <RecebedoresConhecidos nomes={savedTerceiros} atual={receiverCustomText} onEscolher={setReceiverCustomText} />
                    <input
                      type="text"
                      value={receiverCustomText}
                      onChange={(e) => setReceiverCustomText(e.target.value)}
                      placeholder="Ex: Nome da pessoa ou detalhes"
                      className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )}

            {/* SELEÇÃO DE INSUCESSO (MODO INSUCESSO) */}
            {mode === 'insucesso' && (
              <div className="space-y-2">
                <label className="text-[11px] font-black text-rose-800 dark:text-rose-400 uppercase tracking-wider block flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 stroke-[2.5]" />
                  <span>Motivo do Insucesso *</span>
                </label>

                <div className="space-y-1.5">
                  {INSUCESSO_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`w-full min-h-[44px] p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer touch-manipulation flex items-center justify-between ${
                        selectedReason === reason
                          ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-400 dark:border-rose-600 text-rose-950 dark:text-rose-200 font-black shadow-xs ring-1 ring-rose-500/30'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{reason}</span>
                      {selectedReason === reason && <Check className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 stroke-[3]" />}
                    </button>
                  ))}
                </div>

                {selectedReason === 'Outro motivo' && (
                  <input
                    type="text"
                    value={customReasonText}
                    onChange={(e) => setCustomReasonText(e.target.value)}
                    placeholder="Descreva o motivo com clareza..."
                    className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950/60 border border-rose-300 dark:border-rose-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                    autoFocus
                  />
                )}
              </div>
            )}

            {/* PRÉ-VISUALIZAÇÃO DO TEXTO */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Texto que será gerado:
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingData(!isEditingData)}
                  className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer touch-manipulation"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>{isEditingData ? 'Ocultar ajuste' : 'Ajustar dados'}</span>
                </button>
              </div>

              {/* Formulário expandível de ajuste rápido de cliente ou endereço */}
              {isEditingData && (
                <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2 animate-fadeIn text-[11px]">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Destinatário</label>
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full h-9 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Número</label>
                      <input
                        type="text"
                        value={houseNumber}
                        onChange={(e) => setHouseNumber(e.target.value)}
                        className="w-full h-9 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Complemento</label>
                    <input
                      type="text"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Apt, Bloco, Casa..."
                      className="w-full h-9 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              <pre className="font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 select-all max-h-28 overflow-y-auto">
                {currentMessage}
              </pre>
            </div>

          </div>
        )}

        {/* RODAPÉ COM BOTÕES DE AÇÃO (56px TOUCH TARGET) */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-2 pb-6 sm:pb-5">
          {shareFeedback && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center text-xs font-black animate-fadeIn">
              {shareFeedback}
            </div>
          )}

          {/* MODO A: VISUALIZANDO REGISTRO DA ENTREGA CONCLUÍDA */}
          {isAlreadyDelivered && !isEditingReceipt ? (
            <>
              <button
                type="button"
                onClick={handleCopyReceipt}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation active:scale-[0.99]"
              >
                {copied ? <Check className="w-5 h-5 stroke-[2.5]" /> : <Copy className="w-5 h-5 stroke-[2.5]" />}
                <span>{copied ? '✓ Texto Copiado com Sucesso!' : '📋 Copiar Texto da Entrega'}</span>
              </button>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingReceipt(true)}
                  className="h-11 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer touch-manipulation border border-slate-200/60 dark:border-slate-700/60"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Corrigir recebedor</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer touch-manipulation"
                >
                  Fechar
                </button>
              </div>
            </>
          ) : isEditingReceipt ? (
            /* MODO B: CORRIGINDO DADOS DE UMA ENTREGA JÁ CONCLUÍDA */
            <>
              <button
                type="button"
                onClick={() => {
                  saveUpdatedDelivery('entregue');
                  setIsEditingReceipt(false);
                  onClose();
                }}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-[0.99]"
              >
                <Check className="w-5 h-5 stroke-[2.5]" />
                <span>Salvar Correções no Registro</span>
              </button>

              <div className="flex items-center justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingReceipt(false)}
                  className="h-11 px-4 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold text-xs cursor-pointer touch-manipulation"
                >
                  Voltar ao Registro
                </button>
              </div>
            </>
          ) : (
            /* MODO C: REGISTRANDO UMA NOVA ENTREGA */
            <>
              {/* BOTÃO PRINCIPAL: COPIAR E CONCLUIR */}
              <button
                type="button"
                onClick={(e) => handleCopyAndComplete(e)}
                className={`w-full h-14 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all select-none cursor-pointer touch-manipulation active:scale-[0.99] ${
                  mode === 'entrega'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20 active:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20 active:bg-rose-700'
                }`}
              >
                <Copy className="w-5 h-5 stroke-[2.5]" />
                <span>
                  {mode === 'entrega'
                    ? 'Copiar Texto e Concluir (+2 🪙)'
                    : 'Copiar Texto e Marcar Insucesso'}
                </span>
              </button>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={(e) => handleCompleteWithoutCopy(e)}
                  className="h-11 px-3 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer touch-manipulation"
                >
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                  <span>
                    {mode === 'entrega' ? 'Concluir sem copiar (+2 🪙)' : 'Salvar sem copiar'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 px-3 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold text-xs cursor-pointer touch-manipulation"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
