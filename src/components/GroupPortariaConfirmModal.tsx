import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  Building2,
  Users,
  Shield,
  Home,
  Store,
  Sparkles,
  Zap,
  Copy,
  Send,
  PackageCheck,
  Clock,
  User,
} from 'lucide-react';
import {
  UserProfile,
  UserStreet,
  StreetPackage,
  ReceiverCategory,
  AddressMemoryRecord,
} from '../types';
import {
  lookupAddressMemory,
  rememberAddress,
  saveAddressToStreetMemory,
  buildReceiverFullDescription,
  formatGroupDeliveryWhatsAppMessage,
  copyToClipboard,
  openWhatsApp,
  getFrequentReceiversForCategory,
} from '../lib/userStorage';
import { learnItem, getLearnedItems } from '../lib/memoryEngine';
import { playCashChime, triggerMoneyConfetti } from '../lib/audioCelebration';

interface GroupPortariaConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  street: UserStreet;
  houseNumber: string;
  packages: StreetPackage[];
  defaultWhatsAppPhone?: string;
  onConfirmGroupDelivery: (
    receiverData: {
      category: ReceiverCategory;
      subtype?: string;
      receiverName?: string;
      deliveredTo: string;
    },
    andOpenZap: boolean,
    selectedPackageIds?: string[]
  ) => void;
}

const DEFAULT_PORTARIA_SUBTYPES = ['Porteiro', 'Zelador', 'Recepção', 'Guarita', 'Síndico', 'Administração'];
const DEFAULT_FAMILIAR_SUBTYPES = ['Mãe', 'Pai', 'Filho(a)', 'Irmão/Irmã', 'Esposa/Marido', 'Sogra/Sogro'];
const DEFAULT_SEGURANCA_SUBTYPES = ['Vigilante', 'Segurança da Rua', 'Guarita'];

export const GroupPortariaConfirmModal: React.FC<GroupPortariaConfirmModalProps> = ({
  isOpen,
  onClose,
  user,
  street,
  houseNumber,
  packages,
  defaultWhatsAppPhone,
  onConfirmGroupDelivery,
}) => {
  if (!isOpen || packages.length === 0) return null;

  const [category, setCategory] = useState<ReceiverCategory>('portaria');
  const [subtype, setSubtype] = useState<string>('Porteiro');
  const [receiverName, setReceiverName] = useState<string>('');
  const [memoryRecord, setMemoryRecord] = useState<AddressMemoryRecord | null>(null);
  const [memorySuggestion, setMemorySuggestion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Checkbox Selection state for each package
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const pending = packages.filter((p) => p.status !== 'delivered');
    const initial = pending.length > 0 ? pending : packages;
    return new Set(initial.map((p) => p.id));
  });

  // Frequent receivers
  const [frequentPorteiros, setFrequentPorteiros] = useState<string[]>([]);
  const [frequentSeguranca, setFrequentSeguranca] = useState<string[]>([]);
  const [frequentFamiliars, setFrequentFamiliars] = useState<string[]>([]);

  // Subtypes
  const [learnedPortariaSubtypes, setLearnedPortariaSubtypes] = useState<string[]>(DEFAULT_PORTARIA_SUBTYPES);
  const [learnedSegurancaSubtypes, setLearnedSegurancaSubtypes] = useState<string[]>(DEFAULT_SEGURANCA_SUBTYPES);
  const [learnedFamiliarSubtypes, setLearnedFamiliarSubtypes] = useState<string[]>(DEFAULT_FAMILIAR_SUBTYPES);

  // Only selected packages will be processed
  const packagesToDeliver = useMemo(() => {
    return packages.filter((p) => selectedIds.has(p.id));
  }, [packages, selectedIds]);

  const togglePackageSelection = (pkgId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pkgId)) {
        next.delete(pkgId);
      } else {
        next.add(pkgId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(packages.map((p) => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  useEffect(() => {
    setFrequentPorteiros(getFrequentReceiversForCategory(user.id, 'portaria'));
    setFrequentSeguranca(getFrequentReceiversForCategory(user.id, 'seguranca'));
    setFrequentFamiliars(getFrequentReceiversForCategory(user.id, 'familiar'));

    const customPort = getLearnedItems(user.id, 'subtype', 'portaria');
    setLearnedPortariaSubtypes(Array.from(new Set([...DEFAULT_PORTARIA_SUBTYPES, ...customPort])));

    const customSeg = getLearnedItems(user.id, 'subtype', 'seguranca');
    setLearnedSegurancaSubtypes(Array.from(new Set([...DEFAULT_SEGURANCA_SUBTYPES, ...customSeg])));

    const customFam = getLearnedItems(user.id, 'subtype', 'familiar');
    setLearnedFamiliarSubtypes(Array.from(new Set([...DEFAULT_FAMILIAR_SUBTYPES, ...customFam])));

    // Lookup memory for this house number
    const memory = lookupAddressMemory(user.id, street.name, houseNumber);
    if (memory && (memory.lastReceiverName || memory.lastReceiverCategory)) {
      setMemoryRecord(memory);
      if (memory.lastReceiverCategory) setCategory(memory.lastReceiverCategory);
      if (memory.lastReceiverSubtype) setSubtype(memory.lastReceiverSubtype);
      if (memory.lastReceiverName) setReceiverName(memory.lastReceiverName);

      const desc = buildReceiverFullDescription(
        memory.lastReceiverCategory,
        memory.lastReceiverSubtype,
        memory.lastReceiverName,
        'Morador'
      );
      setMemorySuggestion(desc);
    } else {
      setMemoryRecord(null);
      setCategory('portaria');
      setSubtype('Porteiro');
      setReceiverName('');
      setMemorySuggestion(null);
    }
  }, [user.id, street.name, houseNumber]);

  const handleApplyMemory = (mem: AddressMemoryRecord) => {
    if (mem.lastReceiverCategory) setCategory(mem.lastReceiverCategory);
    if (mem.lastReceiverSubtype) setSubtype(mem.lastReceiverSubtype);
    if (mem.lastReceiverName) setReceiverName(mem.lastReceiverName);
  };

  const handleSelectCategory = (cat: ReceiverCategory) => {
    setCategory(cat);
    if (cat === 'portaria') {
      setSubtype('Porteiro');
      if (frequentPorteiros.length > 0 && !receiverName) setReceiverName(frequentPorteiros[0]);
    } else if (cat === 'seguranca') {
      setSubtype('Vigilante');
      if (frequentSeguranca.length > 0 && !receiverName) setReceiverName(frequentSeguranca[0]);
    } else if (cat === 'familiar') {
      setSubtype('Mãe');
      if (frequentFamiliars.length > 0 && !receiverName) setReceiverName(frequentFamiliars[0]);
    } else {
      setSubtype('');
    }
  };

  const currentReceiverDesc = buildReceiverFullDescription(category, subtype, receiverName, 'Condomínio');

  const previewText = formatGroupDeliveryWhatsAppMessage(
    user.name,
    street.name,
    houseNumber,
    packagesToDeliver,
    currentReceiverDesc
  );

  const handleCopyOnly = async () => {
    const success = await copyToClipboard(previewText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirm = async (andOpenZap: boolean = false) => {
    const cleanRecName = receiverName.trim();
    const cleanSubtype = subtype.trim();

    try {
      if (cleanRecName) {
        learnItem(user.id, category, cleanRecName, cleanSubtype || undefined);
      }
      if (cleanSubtype && (category === 'portaria' || category === 'seguranca' || category === 'familiar')) {
        learnItem(user.id, 'subtype', cleanSubtype, category);
      }

      rememberAddress(user.id, {
        streetName: street.name,
        houseNumber: houseNumber,
        receiverCategory: category,
        receiverSubtype: cleanSubtype || undefined,
        receiverName: cleanRecName,
      });

      // Salva cada pacote selecionado na memória da rua
      packagesToDeliver.forEach((p) => {
        saveAddressToStreetMemory(
          user.id,
          street.name,
          p.houseNumber,
          p.complement,
          p.recipientName,
          {
            category,
            subtype: cleanSubtype || undefined,
            receiverName: cleanRecName || undefined,
            isDelivered: true,
          }
        );
      });

      // Dispara celebração sonora e visual de dinheiro
      playCashChime();
      triggerMoneyConfetti();

      // Confirmação da baixa
      onConfirmGroupDelivery(
        {
          category,
          subtype: cleanSubtype || undefined,
          receiverName: cleanRecName || undefined,
          deliveredTo: currentReceiverDesc,
        },
        andOpenZap,
        Array.from(selectedIds)
      );
    } catch (err) {
      console.error('Erro na confirmação do lote portaria:', err);
      onConfirmGroupDelivery(
        {
          category,
          subtype: cleanSubtype || undefined,
          receiverName: cleanRecName || undefined,
          deliveredTo: currentReceiverDesc,
        },
        andOpenZap,
        Array.from(selectedIds)
      );
    } finally {
      onClose();
    }

    try {
      await copyToClipboard(previewText);
      if (andOpenZap) {
        openWhatsApp(previewText, defaultWhatsAppPhone);
      }
    } catch (zapErr) {
      console.warn('Aviso ao copiar/abrir WhatsApp portaria:', zapErr);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex flex-col items-center justify-center font-black shrink-0 shadow-sm">
              <span className="text-[9px] uppercase tracking-wider text-slate-900 leading-none">Nº</span>
              <span className="text-base truncate max-w-[44px]">{houseNumber}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Zap Único • Portaria
                </span>
                <span className="text-xs font-bold text-slate-300">
                  {packagesToDeliver.length} de {packages.length} selecionados
                </span>
              </div>
              <h3 className="font-black text-base sm:text-lg leading-tight mt-0.5 truncate text-white">
                Entregar na Portaria / Condomínio
              </h3>
              <p className="text-xs text-slate-300 truncate">
                📍 {street.name}, Nº {houseNumber}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* 1-Click Memory Suggestion */}
          {memoryRecord && memorySuggestion && (
            <div className="p-3 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 flex items-center justify-between gap-2 animate-fadeIn shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 block">
                    Recebedor Frequente deste local:
                  </span>
                  <strong className="text-slate-900 text-xs font-black truncate block">
                    {memorySuggestion}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleApplyMemory(memoryRecord)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Zap className="w-3 h-3" />
                <span>1 Toque</span>
              </button>
            </div>
          )}

          {/* Quem Recebeu os Pacotes */}
          <div className="space-y-2">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700">
              Quem recebeu todos os pacotes?
            </label>

            {/* Categorias de Recebedor */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'portaria', label: 'Portaria / Prédio', icon: Building2 },
                { id: 'seguranca', label: 'Segurança / Guarita', icon: Shield },
                { id: 'proprio', label: 'Próprio Morador', icon: User },
                { id: 'familiar', label: 'Familiar', icon: Users },
                { id: 'vizinho', label: 'Vizinho', icon: Home },
                { id: 'comercio', label: 'Comércio / Ponto', icon: Store },
              ].map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.id as ReceiverCategory)}
                    className={`p-2.5 rounded-2xl border-2 font-black text-[11px] flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <span className="leading-tight">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subtipo de Portaria / Função */}
          {category === 'portaria' && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="block text-[11px] font-bold uppercase text-slate-600">
                Função na Portaria:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {learnedPortariaSubtypes.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSubtype(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      subtype === st
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nome de quem pegou (Porteiro / Zelador / Morador) */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase text-slate-600">
              Nome de quem recebeu na portaria:
            </label>
            <input
              type="text"
              placeholder="Ex: Marcos, Seu Jorge, Dona Ivone..."
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 font-bold text-sm text-slate-900 outline-none focus:border-emerald-600"
              autoFocus
            />

            {/* Sugestões Frequentes de Porteiros */}
            {category === 'portaria' && frequentPorteiros.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-[10px] font-bold text-slate-400">Frequentes:</span>
                {frequentPorteiros.slice(0, 4).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setReceiverName(name)}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Relação de Pacotes Inclusos no Lote com Checkboxes para Selecionar/Desmarcar */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between text-slate-700">
              <div>
                <span className="font-black text-[11px] uppercase tracking-wider block">
                  Pacotes deste Endereço ({packagesToDeliver.length} de {packages.length}):
                </span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Desmarque os que o porteiro recusar ou que não existirem
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-slate-50 border border-slate-200">
              {packages.map((pkg, idx) => {
                const isChecked = selectedIds.has(pkg.id);
                return (
                  <div
                    key={pkg.id}
                    onClick={() => togglePackageSelection(pkg.id)}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none ${
                      isChecked
                        ? 'bg-white border-emerald-300 shadow-2xs'
                        : 'bg-slate-100/80 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox customizado */}
                      <div
                        className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                          isChecked
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white border-slate-300'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-black truncate ${
                              isChecked ? 'text-slate-900' : 'text-slate-500 line-through'
                            }`}
                          >
                            {pkg.recipientName || 'Morador'}
                          </span>
                          {pkg.complement && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${
                                isChecked
                                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                                  : 'bg-slate-200 text-slate-400 border-slate-300'
                              }`}
                            >
                              {pkg.complement}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 block">
                          {pkg.code
                            ? pkg.code.startsWith('#')
                              ? pkg.code
                              : `#${pkg.code}`
                            : `#${pkg.id.replace(/\D/g, '').slice(-4) || `${idx + 101}`}`}
                        </span>
                      </div>
                    </div>

                    <div>
                      {isChecked ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Incluído no Zap
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">
                          Não aceito / Desmarcado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
          {packagesToDeliver.length === 0 ? (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-center font-bold text-xs">
              ⚠️ Selecione ao menos 1 pacote acima para confirmar a entrega
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyOnly}
                className={`p-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  copied
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
                title="Copiar mensagem do Zap Único"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar Zap'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleConfirm(false)}
                className="flex-1 py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <PackageCheck className="w-4 h-4 text-emerald-400" />
                <span>Baixar ({packagesToDeliver.length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleConfirm(true)}
                className="flex-1 py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>Baixar + Abrir Zap ({packagesToDeliver.length})</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
