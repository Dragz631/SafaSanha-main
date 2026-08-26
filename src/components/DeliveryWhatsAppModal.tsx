import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Clock,
  MapPin,
  User,
  Package,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Calendar,
  Home,
  Users,
  ShieldCheck,
  Inbox,
  UserCheck,
  Bookmark
} from 'lucide-react';
import { DeliveryData } from '../types';
import {
  buildWhatsAppMessage,
  buildInsucessoWhatsAppMessage,
  shareOrOpenWhatsApp,
  copyTextToClipboard,
  getFormattedCurrentTime,
  getFormattedCurrentDate
} from '../utils/whatsappHelper';
import {
  getDoormenForAddress,
  saveDoormanForAddress,
  removeDoormanForAddress,
  cleanDoormanName
} from '../utils/doormanStorage';

interface DeliveryWhatsAppModalProps {
  isOpen?: boolean;
  delivery: DeliveryData | null;
  initialMode?: 'entrega' | 'insucesso';
  onClose: () => void;
  onConfirmDelivered?: () => void;
  onConfirmDelivery?: (updated: DeliveryData) => void;
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

export const DeliveryWhatsAppModal: React.FC<DeliveryWhatsAppModalProps> = ({
  isOpen = true,
  delivery,
  initialMode = 'entrega',
  onClose,
  onConfirmDelivered,
  onConfirmDelivery,
}) => {
  const [mode, setMode] = useState<'entrega' | 'insucesso'>(initialMode);
  
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

  // Insucesso
  const [selectedReason, setSelectedReason] = useState<string>(INSUCESSO_REASONS[0]);
  const [customReasonText, setCustomReasonText] = useState<string>('');

  const [copied, setCopied] = useState(false);
  const [isEditingData, setIsEditingData] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [doormenVersion, setDoormenVersion] = useState<number>(0);

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
      // Se estiver entregando agora, usa o horário atual real do momento da entrega
      const isAlreadyDelivered = delivery.status === 'entregue' || delivery.status === 'concluido';
      const effectiveDate = isAlreadyDelivered && delivery.data_hora ? delivery.data_hora : new Date();
      
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
      }

      setCopied(false);
      setIsEditingData(false);
      setShareFeedback(null);
    }
  }, [delivery, initialMode]);

  // Porteiros cadastrados na memória para este endereço/número
  const savedDoormen = useMemo(() => {
    if (!houseNumber) return [];
    return getDoormenForAddress(streetName, houseNumber);
  }, [streetName, houseNumber, doormenVersion]);

  // Calcula o nome final do recebedor dinamicamente
  const computedReceiver = useMemo(() => {
    if (receiverType === 'proprio_morador') return 'Próprio Morador';
    if (receiverType === 'vizinho') {
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
  }, [receiverType, receiverCustomText]);

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
          customReceiver: computedReceiver,
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
  ]);

  const saveUpdatedDelivery = (newStatus: 'entregue' | 'insucesso') => {
    if (!delivery) return;

    // Se for portaria e tiver digitado/selecionado nome de porteiro, salva na memória associado ao número!
    if (mode === 'entrega' && receiverType === 'portaria' && receiverCustomText.trim()) {
      saveDoormanForAddress(streetName, houseNumber, receiverCustomText.trim());
    }

    const updated: DeliveryData = {
      ...delivery,
      nome_destinatario: clientName,
      recebedor_detalhes: mode === 'entrega' ? computedReceiver : clientName,
      recebedor_tipo: (receiverType as any) || 'proprio_morador',
      endereco_rua: streetName,
      numero_casa: houseNumber,
      endereco_numero: houseNumber,
      complemento: complement,
      codigo_pacote: packageCode,
      status: newStatus,
      motivo_insucesso: newStatus === 'insucesso' ? computedReason : undefined,
      data_hora: new Date().toISOString(),
    };

    if (onConfirmDelivery) {
      onConfirmDelivery(updated);
    } else if (onConfirmDelivered) {
      onConfirmDelivered();
    }
  };

  const handleShareAndConfirm = async () => {
    const targetStatus = mode === 'entrega' ? 'entregue' : 'insucesso';
    
    // Dispara compartilhamento no celular
    const res = await shareOrOpenWhatsApp(currentMessage);
    
    if (res.method === 'share') {
      setShareFeedback('Abrindo WhatsApp...');
    } else if (res.method === 'whatsapp') {
      setShareFeedback('Abrindo WhatsApp com o texto na caixa...');
    } else {
      setShareFeedback('Texto copiado para a área de transferência!');
    }

    saveUpdatedDelivery(targetStatus);

    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleCopyText = async () => {
    const success = await copyTextToClipboard(currentMessage);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveWithoutOpening = () => {
    const targetStatus = mode === 'entrega' ? 'entregue' : 'insucesso';
    saveUpdatedDelivery(targetStatus);
    onClose();
  };

  const activePreset = RECEIVER_PRESETS.find(p => p.id === receiverType);

  if (!isOpen || !delivery) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] pb-safe">
        
        {/* Cabeçalho do Modal */}
        <div className="bg-slate-900 text-white p-4 pb-3">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
                mode === 'entrega' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
              }`}>
                {mode === 'entrega' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
              <div>
                <h2 className="font-black text-sm text-white">
                  {mode === 'entrega' ? 'Registrar Entrega' : 'Registrar Insucesso'}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {houseNumber !== 'S/N' ? `Nº ${houseNumber} • ` : ''}{streetName}
                  {complement ? ` (${complement})` : ''}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Toggle Sucesso vs Insucesso */}
          <div className="flex bg-slate-800 p-1 rounded-xl gap-1">
            <button
              onClick={() => setMode('entrega')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'entrega'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Entregue com Sucesso</span>
            </button>
            <button
              onClick={() => setMode('insucesso')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'insucesso'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Insucesso (Falha)</span>
            </button>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
          
          {/* MODO 1: ENTREGUE COM SUCESSO - SELETOR DINÂMICO DE RECEBEDOR */}
          {mode === 'entrega' && (
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
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
                          // Pré-seleciona se houver apenas 1 porteiro salvo
                          setReceiverCustomText(savedDoormen[0]);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-500'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 font-bold'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-slate-500 border border-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs leading-tight">{preset.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Seção Especial: OPÇÕES DE PORTEIROS SALVOS NO NÚMERO */}
              {receiverType === 'portaria' && savedDoormen.length > 0 && (
                <div className="p-3 bg-amber-50/90 border border-amber-300/80 rounded-2xl space-y-2 animate-fadeIn shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-amber-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>Porteiros cadastrados no Nº {houseNumber}:</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-200/70 px-1.5 py-0.5 rounded-md">
                      Memória Ativa
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {savedDoormen.map((doorman) => {
                      const isChosen = cleanDoormanName(receiverCustomText).toLowerCase() === doorman.toLowerCase();
                      return (
                        <div
                          key={doorman}
                          className="inline-flex items-center bg-white rounded-xl border border-amber-200 shadow-xs overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setReceiverCustomText(doorman)}
                            className={`px-2.5 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                              isChosen
                                ? 'bg-emerald-600 text-white font-black'
                                : 'text-slate-800 hover:bg-amber-100/50'
                            }`}
                          >
                            <span>👮‍♂️ {doorman}</span>
                            {isChosen && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeDoormanForAddress(streetName, houseNumber, doorman);
                              if (isChosen) setReceiverCustomText('');
                              setDoormenVersion((v) => v + 1);
                            }}
                            className={`p-1.5 text-slate-400 hover:text-rose-600 transition-colors border-l ${
                              isChosen ? 'border-emerald-500 text-emerald-100 hover:text-white' : 'border-amber-100'
                            }`}
                            title="Remover este porteiro da memória deste número"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Detalhe adicional do recebedor */}
              {receiverType !== 'proprio_morador' && (
                <div className="pt-1 animate-fadeIn space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 block flex items-center justify-between">
                    <span>
                      {receiverType === 'portaria'
                        ? 'Nome do Porteiro / Zelador:'
                        : 'Identificação / Detalhe de quem recebeu:'}
                    </span>
                    {receiverType === 'portaria' && (
                      <span className="text-emerald-700 font-extrabold text-[9px] flex items-center gap-0.5">
                        <Bookmark className="w-2.5 h-2.5" />
                        Salva automático na memória
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={receiverCustomText}
                    onChange={(e) => setReceiverCustomText(e.target.value)}
                    placeholder={
                      receiverType === 'portaria'
                        ? 'Digite o nome do porteiro (Ex: José, Carlos)...'
                        : activePreset?.placeholder || 'Digite o detalhe...'
                    }
                    className="w-full px-3 py-2.5 bg-slate-50 border-2 border-emerald-400 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-xs"
                    autoFocus
                  />
                  {receiverType === 'portaria' && receiverCustomText.trim() && (
                    <p className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>
                        "{cleanDoormanName(receiverCustomText)}" ficará gravado para futuras entregas no Nº {houseNumber}.
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MODO 2: INSUCESSO - SELECIONAR MOTIVO */}
          {mode === 'insucesso' && (
            <div className="space-y-2">
              <label className="text-[11px] font-black text-rose-800 uppercase tracking-wider block flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Qual o motivo do insucesso? *</span>
              </label>

              <div className="space-y-1.5">
                {INSUCESSO_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-rose-50 border-rose-500 text-rose-950 font-black ring-1 ring-rose-500'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 font-bold'
                      }`}
                    >
                      <span>{reason}</span>
                      {isSelected && <Check className="w-4 h-4 text-rose-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {selectedReason === 'Outro motivo' && (
                <div className="pt-1">
                  <input
                    type="text"
                    value={customReasonText}
                    onChange={(e) => setCustomReasonText(e.target.value)}
                    placeholder="Descreva o motivo do insucesso..."
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-rose-400 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-600"
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}

          {/* PREVIEW DO TEXTO PRONTO DO WHATSAPP (ATUALIZA EM TEMPO REAL) */}
          <div className={`border-2 rounded-2xl p-3.5 relative transition-colors ${
            mode === 'entrega' ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/70 border-rose-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 border ${
                mode === 'entrega'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-rose-100 text-rose-900 border-rose-300'
              }`}>
                <Sparkles className="w-3 h-3" />
                Mensagem Gerada para o Zap
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditingData(!isEditingData)}
                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>{isEditingData ? 'Fechar Edição' : 'Editar Dados'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyText}
                  className={`text-[11px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-white/80 p-3 rounded-xl border border-slate-200/80 max-h-48 overflow-y-auto select-all">
              {currentMessage}
            </pre>
          </div>

          {/* Ajuste Rápido de Campos (Inclusive Complemento do Endereço) */}
          {isEditingData && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 text-xs animate-fadeIn shadow-xs">
              <p className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ajustar Dados e Complementos da Entrega</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">🏠 Nº Casa</label>
                  <input
                    type="text"
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">📦 Código Pacote</label>
                  <input
                    type="text"
                    value={packageCode}
                    onChange={(e) => setPackageCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Barra de Complemento do Endereço */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                  📍 Complemento do Endereço (Apto, Bloco, Casa, Loja, etc.):
                </label>
                <input
                  type="text"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  placeholder="Ex: Apto 302, Bloco B, Casa 2"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">👤 Cliente (Destinatário)</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">📅 Data</label>
                  <input
                    type="text"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">⏰ Horário</label>
                  <input
                    type="text"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dica da Câmera do WhatsApp */}
          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-slate-700">
            <span className="text-base">📸</span>
            <div className="space-y-0.5 text-[11px] leading-tight">
              <p className="font-extrabold text-slate-900">Como funciona o envio:</p>
              <p className="text-slate-600">
                O botão abaixo abre o WhatsApp e coloca o texto na caixa de entrada do grupo. Depois é só você tocar no ícone da câmera do WhatsApp e tirar a foto da entrega!
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé com Botões Mobile */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
          {shareFeedback && (
            <div className="p-2 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-center text-xs font-bold animate-pulse">
              {shareFeedback}
            </div>
          )}

          <button
            onClick={handleShareAndConfirm}
            className={`w-full py-3.5 px-4 text-white font-black text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] ${
              mode === 'entrega'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
            }`}
          >
            <Share2 className="w-5 h-5 text-white" />
            <span>
              {mode === 'entrega'
                ? '📲 Abrir Zap com Texto de Entrega'
                : '⚠️ Abrir Zap com Texto de Insucesso'}
            </span>
          </button>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleSaveWithoutOpening}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 py-1 px-2 rounded-lg cursor-pointer"
            >
              Salvar sem abrir Zap
            </button>
            <button
              onClick={onClose}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 py-1 px-2 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
