import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Clock,
  MapPin,
  Building,
  Users,
  ShieldCheck,
  Home,
  UserCheck,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Inbox,
  Bookmark
} from 'lucide-react';
import { DeliveryData } from '../types';
import { saveAddressToMemory } from '../utils/addressMemoryStorage';
import { triggerCoinBurst } from '../utils/rewardEffect';
import {
  buildGroupedWhatsAppMessage,
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

interface GroupedDeliveryWhatsAppModalProps {
  isOpen?: boolean;
  deliveries: DeliveryData[];
  onClose: () => void;
  onConfirmGroupDelivery?: (updatedDeliveries: DeliveryData[]) => void;
  onConfirmDelivery?: (updatedDeliveries: DeliveryData[]) => void;
}

const RECEIVER_PRESETS = [
  { id: 'portaria', label: 'Portaria / Zelador', icon: ShieldCheck, placeholder: 'Ex: Porteiro José / Zelador Carlos' },
  { id: 'proprio_morador', label: 'Próprio Morador', icon: Users, placeholder: 'Ex: Entregue aos próprios moradores' },
  { id: 'vizinho', label: 'Vizinho', icon: Home, placeholder: 'Ex: Vizinho da casa ao lado' },
  { id: 'terceiros', label: 'Terceiros / Recepção', icon: UserCheck, placeholder: 'Ex: Recepção ou familiar' },
  { id: 'local_seguro', label: 'Local seguro (Portão/Grade)', icon: Inbox, placeholder: 'Ex: Deixado na grade ou área segura' },
];

export const GroupedDeliveryWhatsAppModal: React.FC<GroupedDeliveryWhatsAppModalProps> = ({
  isOpen = true,
  deliveries,
  onClose,
  onConfirmGroupDelivery,
}) => {
  const first = deliveries && deliveries.length > 0 ? deliveries[0] : null;
  const streetName = first?.endereco_rua || first?.endereco_completo?.split(',')[0]?.trim() || 'Rua Principal';
  const houseNumber = first?.numero_casa || first?.endereco_numero || 'S/N';

  // Horário atual exato no momento da abertura
  const [deliveryTime, setDeliveryTime] = useState<string>(() => getFormattedCurrentTime(new Date()));
  const [deliveryDate, setDeliveryDate] = useState<string>(() => getFormattedCurrentDate(new Date()));

  // Recebedor
  const [receiverType, setReceiverType] = useState<string>('portaria');
  const [receiverCustomText, setReceiverCustomText] = useState<string>('');

  // Seleção de quais pacotes do grupo serão entregues
  const [selectedIds, setSelectedIds] = useState<string[]>(() => deliveries ? deliveries.map((d) => d.id_entrega) : []);

  const [copied, setCopied] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [doormenVersion, setDoormenVersion] = useState<number>(0);

  // Porteiros cadastrados na memória para este número
  const savedDoormen = useMemo(() => {
    if (!houseNumber) return [];
    return getDoormenForAddress(streetName, houseNumber);
  }, [streetName, houseNumber, doormenVersion]);

  // Atualiza horário sempre que abrir
  useEffect(() => {
    setDeliveryTime(getFormattedCurrentTime(new Date()));
    setDeliveryDate(getFormattedCurrentDate(new Date()));
    setSelectedIds(deliveries ? deliveries.map((d) => d.id_entrega) : []);
    setCopied(false);
    setShareFeedback(null);
    if (savedDoormen.length === 1 && !receiverCustomText) {
      setReceiverCustomText(savedDoormen[0]);
    }
  }, [deliveries]);

  // Lista dos pacotes selecionados
  const activeDeliveries = useMemo(() => {
    if (!deliveries) return [];
    return deliveries.filter((d) => selectedIds.includes(d.id_entrega));
  }, [deliveries, selectedIds]);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length === 1) return; // mantém pelo menos 1
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const computedReceiver = useMemo(() => {
    if (receiverType === 'portaria') {
      const clean = cleanDoormanName(receiverCustomText);
      return clean ? `Portaria (${clean})` : 'Portaria / Zelador';
    }
    if (receiverType === 'proprio_morador') {
      return receiverCustomText.trim() ? `Moradores (${receiverCustomText.trim()})` : 'Próprio Morador';
    }
    if (receiverType === 'vizinho') {
      return receiverCustomText.trim() ? `Vizinho (${receiverCustomText.trim()})` : 'Vizinho';
    }
    if (receiverType === 'terceiros') {
      return receiverCustomText.trim() ? `Terceiros (${receiverCustomText.trim()})` : 'Terceiros / Recepção';
    }
    if (receiverType === 'local_seguro') {
      return receiverCustomText.trim() ? `Local Seguro (${receiverCustomText.trim()})` : 'Local seguro (Grade/Portão)';
    }
    return receiverCustomText.trim() || 'Recebedor na Portaria';
  }, [receiverType, receiverCustomText]);

  // Mensagem calculada em tempo real com todos os pacotes e nomes
  const currentMessage = useMemo(() => {
    return buildGroupedWhatsAppMessage(activeDeliveries, {
      streetName,
      houseNumber,
      customReceiver: computedReceiver,
      customDate: deliveryDate,
      customTime: deliveryTime,
    });
  }, [activeDeliveries, streetName, houseNumber, computedReceiver, deliveryDate, deliveryTime]);

  const handleShareAndConfirm = async (e?: React.MouseEvent) => {
    try {
      triggerCoinBurst(activeDeliveries.length, 'Portaria / Condomínio', e || null);
    } catch (_err) {}
    // Salva o porteiro na memória se for portaria e tiver nome
    if (receiverType === 'portaria' && receiverCustomText.trim()) {
      saveDoormanForAddress(streetName, houseNumber, receiverCustomText.trim());
    }

    const res = await shareOrOpenWhatsApp(currentMessage);
    if (res.method === 'share') {
      setShareFeedback('Abrindo WhatsApp...');
    } else if (res.method === 'whatsapp') {
      setShareFeedback('Abrindo WhatsApp com o texto agrupado...');
    } else {
      setShareFeedback('Texto consolidado copiado!');
    }

    // Salva todos os pacotes selecionados como entregues
    const nowIso = new Date().toISOString();
    const updated = (deliveries || []).map((d) => {
      if (selectedIds.includes(d.id_entrega)) {
        return {
          ...d,
          status: 'entregue' as const,
          recebedor_detalhes: computedReceiver,
          recebedor_tipo: (receiverType as any) || 'portaria',
          data_hora: nowIso,
        };
      }
      return d;
    });

    onConfirmGroupDelivery(updated);

    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleCopyText = async () => {
    const ok = await copyTextToClipboard(currentMessage);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveWithoutOpening = (e?: React.MouseEvent) => {
    try {
      triggerCoinBurst(activeDeliveries.length, 'Portaria / Condomínio', e || null);
    } catch (_err) {}
    if (receiverType === 'portaria' && receiverCustomText.trim()) {
      saveDoormanForAddress(streetName, houseNumber, receiverCustomText.trim());
    }

    const nowIso = new Date().toISOString();
    const updated = (deliveries || []).map((d) => {
      if (selectedIds.includes(d.id_entrega)) {
        return {
          ...d,
          status: 'entregue' as const,
          recebedor_detalhes: computedReceiver,
          recebedor_tipo: (receiverType as any) || 'portaria',
          data_hora: nowIso,
        };
      }
      return d;
    });
    onConfirmGroupDelivery(updated);
    onClose();
  };

  const activePreset = RECEIVER_PRESETS.find((p) => p.id === receiverType);

  if (!isOpen || !deliveries || deliveries.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] pb-safe">
        
        {/* Cabeçalho */}
        <div className="bg-slate-900 text-white p-4 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex flex-col items-center justify-center font-black shrink-0 shadow-md">
                <span className="text-[8px] uppercase tracking-tighter opacity-80 leading-none">Nº</span>
                <span className="text-base leading-none mt-0.5">{houseNumber}</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="font-black text-sm text-white">
                    Entrega Agregada (Portaria / Casa)
                  </h2>
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-md">
                    {activeDeliveries.length} pacotes
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {streetName} • Nº {houseNumber}
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
        </div>

        {/* Corpo */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
          
          {/* Pacotes que serão entregues */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block flex items-center justify-between">
              <span>Pacotes a Entregar neste Endereço:</span>
              <span className="text-emerald-700 font-bold">{activeDeliveries.length} de {deliveries.length} selecionados</span>
            </label>

            <div className="space-y-1 max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-1.5 bg-slate-50">
              {deliveries.map((pkg) => {
                const isChecked = selectedIds.includes(pkg.id_entrega);
                const code = pkg.codigo_pacote.startsWith('#') ? pkg.codigo_pacote : `#${pkg.codigo_pacote}`;
                const name = pkg.nome_destinatario || 'Morador';

                return (
                  <button
                    key={pkg.id_entrega}
                    type="button"
                    onClick={() => toggleSelect(pkg.id_entrega)}
                    className={`w-full p-2 rounded-lg border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-white border-emerald-400 shadow-xs'
                        : 'bg-slate-100 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                        isChecked ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'
                      }`}>
                        {isChecked ? '✓' : ''}
                      </span>
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded text-[10px]">
                        {code}
                      </span>
                      <span className="font-extrabold text-slate-900 truncate">
                        {name}
                      </span>
                    </div>

                    {pkg.complemento && (
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                        {pkg.complemento}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quem Recebeu */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Quem recebeu na Portaria / Endereço? *</span>
            </label>

            <div className="grid grid-cols-2 gap-1.5">
              {RECEIVER_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = receiverType === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setReceiverType(preset.id);
                      if (preset.id === 'portaria' && savedDoormen.length === 1 && !receiverCustomText) {
                        setReceiverCustomText(savedDoormen[0]);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-500'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 font-bold'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="text-xs leading-tight">{preset.label}</span>
                  </button>
                );
              })}
            </div>

            {/* OPÇÕES DE PORTEIROS SALVOS NO NÚMERO */}
            {receiverType === 'portaria' && savedDoormen.length > 0 && (
              <div className="p-2.5 bg-amber-50/90 border border-amber-300/80 rounded-2xl space-y-1.5 animate-fadeIn shadow-xs mt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-amber-950 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Porteiros cadastrados no Nº {houseNumber}:</span>
                  </span>
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-200/70 px-1 py-0.2 rounded">
                    Memória
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
                          className={`px-2.5 py-1 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                            isChosen
                              ? 'bg-emerald-600 text-white font-black'
                              : 'text-slate-800 hover:bg-amber-100/50'
                          }`}
                        >
                          <span>👮‍♂️ {doorman}</span>
                          {isChosen && <Check className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDoormanForAddress(streetName, houseNumber, doorman);
                            if (isChosen) setReceiverCustomText('');
                            setDoormenVersion((v) => v + 1);
                          }}
                          className={`p-1 text-slate-400 hover:text-rose-600 border-l ${
                            isChosen ? 'border-emerald-500 text-emerald-100' : 'border-amber-100'
                          }`}
                          title="Remover porteiro da memória"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-1 space-y-1">
              <label className="text-[10px] font-bold text-slate-600 block flex items-center justify-between">
                <span>
                  {receiverType === 'portaria'
                    ? 'Nome do Porteiro / Zelador:'
                    : 'Detalhes de quem recebeu:'}
                </span>
                {receiverType === 'portaria' && (
                  <span className="text-emerald-700 font-extrabold text-[9px] flex items-center gap-0.5">
                    <Bookmark className="w-2.5 h-2.5" />
                    Salva no Nº {houseNumber}
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
                    : activePreset?.placeholder || 'Detalhes de quem recebeu...'
                }
                className="w-full px-3 py-2 bg-slate-50 border-2 border-emerald-400 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-xs"
              />
            </div>
          </div>

          {/* Horário Atual Exato */}
          <div className="flex items-center justify-between bg-slate-100 p-2.5 rounded-xl text-slate-700">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span className="font-extrabold text-[11px]">Horário da Entrega:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="w-16 px-1.5 py-1 bg-white border border-slate-300 rounded font-black text-center text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={() => {
                  setDeliveryTime(getFormattedCurrentTime(new Date()));
                  setDeliveryDate(getFormattedCurrentDate(new Date()));
                }}
                className="text-[10px] font-black bg-emerald-600 text-white px-2 py-1 rounded cursor-pointer hover:bg-emerald-500"
              >
                Agora
              </button>
            </div>
          </div>

          {/* Preview da Mensagem Consolidada */}
          <div className="bg-emerald-50/70 border-2 border-emerald-300/80 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                <Sparkles className="w-3 h-3" />
                Mensagem Única Consolidada
              </span>
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

            <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-white/90 p-3 rounded-xl border border-slate-200 max-h-48 overflow-y-auto select-all">
              {currentMessage}
            </pre>
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
            onClick={(e) => handleShareAndConfirm(e)}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
          >
            <Share2 className="w-5 h-5 text-white" />
            <span>📲 Dar Baixa no Grupo e Abrir Zap ({activeDeliveries.length} pacotes)</span>
          </button>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={(e) => handleSaveWithoutOpening(e)}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 py-1 px-2 rounded-lg cursor-pointer"
            >
              Baixar todos sem abrir Zap
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
