import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Building,
  Users,
  ShieldCheck,
  Home,
  UserCheck,
  User,
  CheckCircle2,
  AlertTriangle,
  Inbox,
  FileText,
  Edit2,
} from 'lucide-react';
import { DeliveryData, ReceiverType } from '../types';
import { triggerCoinBurst } from '../utils/rewardEffect';
import {
  buildGroupedWhatsAppMessage,
  copyTextToClipboard,
  getFormattedCurrentTime,
  getFormattedCurrentDate
} from '../utils/whatsappHelper';
import { cleanDoormanName } from '../utils/recebedorTexto';
import { RecebedoresConhecidos } from './RecebedoresConhecidos';
import { useMemoria } from '../state/MemoriaContext';
import { registrarRecebedor, sugerirRecebedores } from '../domain/memoria';
import { aplicarEntrega } from '../domain/entrega';
import { FAMILY_RELATIONS, NEIGHBOR_LOCATION_PRESETS } from './DeliveryWhatsAppModal';

interface GroupedDeliveryWhatsAppModalProps {
  isOpen?: boolean;
  deliveries: DeliveryData[];
  /** Destino conhecido a que TODOS os pacotes do grupo pertencem (a memória de recebedores é por destino). */
  destinoId?: string;
  onClose: () => void;
  onConfirmGroupDelivery?: (updatedDeliveries: DeliveryData[]) => void;
  onConfirmDelivery?: (updatedDeliveries: DeliveryData[]) => void;
}

const RECEIVER_PRESETS = [
  { id: 'portaria', label: 'Portaria / Zelador', icon: ShieldCheck, placeholder: 'Ex: Porteiro José / Zelador Carlos' },
  { id: 'proprio_morador', label: 'Próprio Morador', icon: User, placeholder: 'Ex: Entregue aos próprios moradores' },
  { id: 'familiar', label: 'Familiar / Parente', icon: Users, placeholder: 'Ex: Esposa, Mãe, Filho, Irmão' },
  { id: 'vizinho', label: 'Vizinho', icon: Home, placeholder: 'Ex: Vizinho da casa ao lado' },
  { id: 'terceiros', label: 'Terceiros / Recepção', icon: UserCheck, placeholder: 'Ex: Recepção ou outro' },
  { id: 'local_seguro', label: 'Local seguro (Portão/Grade)', icon: Inbox, placeholder: 'Ex: Deixado na grade ou área segura' },
];

export const GroupedDeliveryWhatsAppModal: React.FC<GroupedDeliveryWhatsAppModalProps> = ({
  isOpen = true,
  deliveries,
  destinoId,
  onClose,
  onConfirmGroupDelivery,
}) => {
  const { memoria, atualizar } = useMemoria();
  const first = deliveries && deliveries.length > 0 ? deliveries[0] : null;
  const streetName = first?.endereco_rua || first?.endereco_completo?.split(',')[0]?.trim() || 'Rua Principal';
  const houseNumber = first?.numero_casa || first?.endereco_numero || 'S/N';

  // Verifica se todos os pacotes já foram entregues
  const isAllGroupDelivered = Boolean(
    deliveries &&
    deliveries.length > 0 &&
    deliveries.every((d) => d.status === 'entregue' || d.status === 'concluido')
  );

  const [isEditingReceipt, setIsEditingReceipt] = useState<boolean>(false);

  // Horário atual exato no momento da abertura
  const [deliveryTime, setDeliveryTime] = useState<string>(() => getFormattedCurrentTime(new Date()));
  const [deliveryDate, setDeliveryDate] = useState<string>(() => getFormattedCurrentDate(new Date()));

  // Recebedor
  const [receiverType, setReceiverType] = useState<string>(first?.recebedor_tipo || 'portaria');
  const [receiverCustomText, setReceiverCustomText] = useState<string>(isAllGroupDelivered ? first?.recebedor_detalhes || '' : '');

  // Familiar
  const [familyRelation, setFamilyRelation] = useState<string>('');
  const [familyName, setFamilyName] = useState<string>('');

  // Vizinho
  const [neighborNumber, setNeighborNumber] = useState<string>('');
  const [neighborName, setNeighborName] = useState<string>('');

  // Seleção de quais pacotes do grupo serão entregues
  const [selectedIds, setSelectedIds] = useState<string[]>(() => deliveries ? deliveries.map((d) => d.id_entrega) : []);

  const [copied, setCopied] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Recebedores CONHECIDOS deste destino (só sugestão; o registro guarda quem recebeu de fato)
  const conhecidos = (categoria: string) => sugerirRecebedores(memoria, destinoId, { categoria }).map((r) => r.rotulo);
  const savedDoormen = useMemo(() => conhecidos('portaria'), [memoria, destinoId]);
  const savedFamily = useMemo(() => conhecidos('familiar'), [memoria, destinoId]);
  const savedNeighbors = useMemo(() => conhecidos('vizinho'), [memoria, destinoId]);
  const savedTerceiros = useMemo(() => conhecidos('terceiros'), [memoria, destinoId]);

  // Atualiza horário e dados sempre que abrir
  useEffect(() => {
    const isDone = Boolean(
      deliveries &&
      deliveries.length > 0 &&
      deliveries.every((d) => d.status === 'entregue' || d.status === 'concluido')
    );
    const effectiveDate = isDone && first?.data_hora ? first.data_hora : new Date();

    setDeliveryTime(getFormattedCurrentTime(effectiveDate));
    setDeliveryDate(getFormattedCurrentDate(effectiveDate));
    setSelectedIds(deliveries ? deliveries.map((d) => d.id_entrega) : []);
    setCopied(false);
    setShareFeedback(null);
    setIsEditingReceipt(false);

    if (isDone && first?.recebedor_detalhes) {
      setReceiverCustomText(first.recebedor_detalhes);
    } else if (savedDoormen.length === 1 && !receiverCustomText) {
      setReceiverCustomText(savedDoormen[0]);
    }
  }, [deliveries]);

  // Lista dos pacotes selecionados
  const activeDeliveries = useMemo(() => {
    if (!deliveries) return [];
    return deliveries.filter((d) => selectedIds.includes(d.id_entrega));
  }, [deliveries, selectedIds]);

  // Conta estritamente quantos pacotes são NOVOS (ainda não estavam como entregues)
  const newlyDeliveredCount = useMemo(() => {
    return activeDeliveries.filter(
      (d) => d.status !== 'entregue' && d.status !== 'concluido'
    ).length;
  }, [activeDeliveries]);

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
      return receiverCustomText.trim() ? `Vizinho (${receiverCustomText.trim()})` : 'Vizinho';
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
      return receiverCustomText.trim() ? `Familiar (${receiverCustomText.trim()})` : 'Familiar / Parente';
    }
    if (receiverType === 'terceiros') {
      return receiverCustomText.trim() ? `Terceiros (${receiverCustomText.trim()})` : 'Terceiros / Recepção';
    }
    if (receiverType === 'local_seguro') {
      return receiverCustomText.trim() ? `Local Seguro (${receiverCustomText.trim()})` : 'Local seguro (Grade/Portão)';
    }
    return receiverCustomText.trim() || 'Recebedor na Portaria';
  }, [receiverType, receiverCustomText, familyRelation, familyName, neighborNumber, neighborName]);

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

  /**
   * Copiar Texto do Grupo e Concluir
   * Trava de segurança: somente concede moedas para pacotes que ainda NÃO estavam entregues!
   */
  /**
   * Conclui a baixa do grupo: aplica a entrega a cada pacote selecionado e ensina a memória com quem
   * recebeu DE FATO agora (o histórico conhecido apenas sugere; não prova quem recebeu hoje).
   */
  const concluirGrupo = (): DeliveryData[] => {
    const agora = new Date().toISOString();

    if (destinoId) {
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
        atualizar((m) => registrarRecebedor(m, destinoId, { categoria: receiverType, rotulo }, agora));
      }
    }

    return (deliveries || []).map((d) => {
      if (!selectedIds.includes(d.id_entrega)) return d;
      const jaEntregue = d.status === 'entregue' || d.status === 'concluido';
      return aplicarEntrega(
        d,
        {
          recebedor_tipo: (receiverType as ReceiverType) || 'portaria',
          recebedor_detalhes: computedReceiver,
        },
        jaEntregue ? d.data_hora_entrega || d.data_hora : agora
      );
    });
  };

  const handleCopyAndConfirm = async (e?: React.MouseEvent) => {
    if (newlyDeliveredCount > 0) {
      try {
        triggerCoinBurst(newlyDeliveredCount * 2, 'Portaria / Condomínio', e || null);
      } catch (_err) {}
    }

    await copyTextToClipboard(currentMessage);
    setCopied(true);
    setShareFeedback(
      newlyDeliveredCount > 0
        ? `📋 Texto copiado e ${newlyDeliveredCount} pacote(s) concluído(s) (+${newlyDeliveredCount * 2} 🪙)!`
        : '📋 Texto copiado com sucesso!'
    );

    const updated = concluirGrupo();
    if (onConfirmGroupDelivery) {
      onConfirmGroupDelivery(updated);
    }

    setTimeout(() => {
      onClose();
    }, 450);
  };

  /**
   * Concluir sem Copiar
   */
  const handleSaveWithoutOpening = (e?: React.MouseEvent) => {
    if (newlyDeliveredCount > 0) {
      try {
        triggerCoinBurst(newlyDeliveredCount * 2, 'Portaria / Condomínio', e || null);
      } catch (_err) {}
    }

    const updated = concluirGrupo();
    if (onConfirmGroupDelivery) {
      onConfirmGroupDelivery(updated);
    }
    onClose();
  };

  /**
   * Copiar Texto do Registro do Grupo (sem moedas duplicadas)
   */
  const handleCopyReceipt = async () => {
    const ok = await copyTextToClipboard(currentMessage);
    if (ok) {
      setCopied(true);
      setShareFeedback('✓ Texto consolidado do grupo copiado!');
      setTimeout(() => {
        setCopied(false);
        setShareFeedback(null);
      }, 2000);
    }
  };

  if (!isOpen || !deliveries || deliveries.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn overflow-hidden">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border-t sm:border border-slate-200/90 dark:border-slate-800 flex flex-col max-h-[92vh] sm:max-h-[90vh] pb-safe transition-colors">
        
        {/* CABEÇALHO */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer touch-manipulation"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 pr-10">
            <div className={`w-10 h-10 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 border shadow-xs ${
              isAllGroupDelivered && !isEditingReceipt
                ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-400 text-slate-950 border-amber-400'
            }`}>
              {isAllGroupDelivered && !isEditingReceipt ? (
                <FileText className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <>
                  <span className="text-[8px] uppercase tracking-tighter opacity-80 leading-none">Nº</span>
                  <span className="text-base leading-none mt-0.5">{houseNumber}</span>
                </>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight truncate leading-tight">
                  {isAllGroupDelivered && !isEditingReceipt
                    ? 'Registro da Entrega Agregada'
                    : isEditingReceipt
                    ? 'Corrigir Recebedor do Grupo'
                    : 'Entrega Agregada (Portaria / Casa)'}
                </h2>
                <span className="bg-amber-400/20 text-amber-800 dark:text-amber-300 text-[10px] font-black px-1.5 py-0.2 rounded-md border border-amber-400/30 shrink-0">
                  {activeDeliveries.length} pacotes
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5">
                {streetName} • Nº {houseNumber}
              </p>
            </div>
          </div>
        </div>

        {/* CORPO DO MODAL */}
        {isAllGroupDelivered && !isEditingReceipt ? (
          /* MODO A: VISUALIZAÇÃO DO REGISTRO DE ENTREGA DO GRUPO */
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
            {/* Banner de Conclusão */}
            <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                    <span>Todos os {deliveries.length} pacotes entregues</span>
                    <span className="bg-amber-400/20 text-amber-800 dark:text-amber-300 text-[10px] font-black px-1.5 py-0.2 rounded-md border border-amber-400/30">
                      +{deliveries.length * 2} 🪙 Moedas
                    </span>
                  </h3>
                  <p className="text-[11px] text-emerald-800/90 dark:text-emerald-400 font-semibold mt-0.5">
                    Registrada às {deliveryTime} ({deliveryDate})
                  </p>
                </div>
              </div>
            </div>

            {/* Detalhes de quem recebeu */}
            <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Recebedor do Grupo:
                </span>
                <span className="font-black text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                  {first?.recebedor_detalhes || computedReceiver}
                </span>
              </div>
            </div>

            {/* Lista dos pacotes entregues */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Pacotes Entregues neste Endereço:
              </span>
              <div className="space-y-1.5 max-h-44 overflow-y-auto border border-slate-200/80 dark:border-slate-800 rounded-2xl p-2 bg-slate-50 dark:bg-slate-950/60">
                {deliveries.map((pkg) => {
                  const code = pkg.codigo_pacote.startsWith('#') ? pkg.codigo_pacote : `#${pkg.codigo_pacote}`;
                  return (
                    <div
                      key={pkg.id_entrega}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shadow-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">
                          ✓
                        </span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded text-[10px]">
                          {code}
                        </span>
                        <span className="font-extrabold text-slate-900 dark:text-white truncate">
                          {pkg.nome_destinatario}
                        </span>
                      </div>
                      {pkg.complemento && (
                        <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded shrink-0">
                          {pkg.complemento}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Texto Formatado Consolidado */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Texto Pronto da Portaria:
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

              <pre className="font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 select-all max-h-40 overflow-y-auto">
                {currentMessage}
              </pre>
            </div>

          </div>
        ) : (
          /* MODO B: FORMULÁRIO DE SELEÇÃO E REGISTRO */
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
            
            {/* Pacotes que serão entregues */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block flex items-center justify-between">
                <span>Pacotes a Entregar neste Endereço:</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">{activeDeliveries.length} de {deliveries.length} selecionados</span>
              </label>

              <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200/80 dark:border-slate-800 rounded-2xl p-2 bg-slate-50 dark:bg-slate-950/60">
                {deliveries.map((pkg) => {
                  const isChecked = selectedIds.includes(pkg.id_entrega);
                  const code = pkg.codigo_pacote.startsWith('#') ? pkg.codigo_pacote : `#${pkg.codigo_pacote}`;
                  const name = pkg.nome_destinatario || 'Morador';

                  return (
                    <button
                      key={pkg.id_entrega}
                      type="button"
                      onClick={() => toggleSelect(pkg.id_entrega)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer touch-manipulation ${
                        isChecked
                          ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                          isChecked ? 'bg-emerald-600 text-white' : 'bg-slate-300 dark:bg-slate-600 text-slate-700'
                        }`}>
                          {isChecked ? '✓' : ''}
                        </span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 rounded text-[10px]">
                          {code}
                        </span>
                        <span className="font-extrabold text-slate-900 dark:text-white truncate">
                          {name}
                        </span>
                      </div>
                      {pkg.complemento && (
                        <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded shrink-0">
                          {pkg.complemento}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SELEÇÃO DO TIPO DE RECEBEDOR DO GRUPO */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Quem recebeu os pacotes?</span>
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
                        if (preset.id === 'portaria' && savedDoormen.length === 1 && !receiverCustomText) {
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

              {/* Porteiros Cadastrados na Memória do Condomínio/Endereço */}
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
                    placeholder="Ex: Porteiro José / Zelador Carlos"
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
                    Onde os pacotes foram deixados?
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Na portaria', 'Na grade', 'Na recepção', 'Com o vigia'].map((opt) => (
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
                    placeholder="Ex: Na recepção, com o vigia..."
                    className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* CASO E: TERCEIROS / RECEPÇÃO */}
              {receiverType === 'terceiros' && (
                <div className="space-y-1 animate-fadeIn pt-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Identificação de quem recebeu:
                  </label>
                  <RecebedoresConhecidos nomes={savedTerceiros} atual={receiverCustomText} onEscolher={setReceiverCustomText} />
                  <input
                    type="text"
                    value={receiverCustomText}
                    onChange={(e) => setReceiverCustomText(e.target.value)}
                    placeholder="Ex: Recepção, administração..."
                    className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Pré-visualização da Mensagem */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Texto que será gerado:
              </span>
              <pre className="font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 max-h-32 overflow-y-auto select-all">
                {currentMessage}
              </pre>
            </div>
          </div>
        )}

        {/* RODAPÉ COM BOTÕES (56px TOUCH TARGET) */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-2 pb-6 sm:pb-5">
          {shareFeedback && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center text-xs font-black animate-fadeIn">
              {shareFeedback}
            </div>
          )}

          {isAllGroupDelivered && !isEditingReceipt ? (
            /* BOTÕES DO REGISTRO DO GRUPO */
            <>
              <button
                type="button"
                onClick={handleCopyReceipt}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation active:scale-[0.99]"
              >
                {copied ? <Check className="w-5 h-5 stroke-[2.5]" /> : <Copy className="w-5 h-5 stroke-[2.5]" />}
                <span>{copied ? '✓ Texto do Grupo Copiado!' : '📋 Copiar Texto do Grupo'}</span>
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
          ) : (
            /* BOTÕES DE BAIXAR GRUPO COM SEGURANÇA DE MOEDAS */
            <>
              <button
                type="button"
                onClick={(e) => handleCopyAndConfirm(e)}
                className="w-full h-14 font-black text-sm sm:text-base rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all select-none bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-600/20 cursor-pointer touch-manipulation active:scale-[0.99]"
              >
                <Copy className="w-5 h-5 stroke-[2.5]" />
                <span>
                  {newlyDeliveredCount > 0
                    ? `Copiar Texto e Concluir (+${newlyDeliveredCount * 2} 🪙)`
                    : `Copiar Texto do Grupo (${activeDeliveries.length} pacotes)`}
                </span>
              </button>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={(e) => handleSaveWithoutOpening(e)}
                  className="h-11 px-3 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer touch-manipulation"
                >
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                  <span>
                    {newlyDeliveredCount > 0
                      ? `Concluir sem copiar (+${newlyDeliveredCount * 2} 🪙)`
                      : 'Concluir sem copiar'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={isEditingReceipt ? () => setIsEditingReceipt(false) : onClose}
                  className="h-11 px-3 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold text-xs cursor-pointer touch-manipulation"
                >
                  {isEditingReceipt ? 'Voltar' : 'Cancelar'}
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
