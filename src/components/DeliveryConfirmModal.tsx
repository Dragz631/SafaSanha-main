import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  User,
  Users,
  Home,
  Building2,
  Shield,
  Store,
  Sparkles,
  Copy,
  Send,
  Zap,
} from 'lucide-react';
import { UserProfile, UserStreet, StreetPackage, ReceiverCategory, AddressMemoryRecord } from '../types';
import {
  lookupAddressMemory,
  rememberAddress,
  saveAddressToStreetMemory,
  buildReceiverFullDescription,
  formatDeliveryWhatsAppMessage,
  copyToClipboard,
  openWhatsApp,
  getFrequentReceiversForCategory,
} from '../lib/userStorage';
import { learnItem, getLearnedItems } from '../lib/memoryEngine';
import { playCashChime, triggerMoneyConfetti } from '../lib/audioCelebration';

interface DeliveryConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  street: UserStreet;
  pkg: StreetPackage | null;
  defaultWhatsAppPhone?: string;
  onConfirm: (updatedPkg: StreetPackage) => void;
}

const DEFAULT_FAMILIAR_SUBTYPES = [
  'Mãe',
  'Pai',
  'Filho(a)',
  'Irmão/Irmã',
  'Esposa/Marido',
  'Sogra/Sogro',
  'Tio(a)',
  'Primo(a)',
];

const DEFAULT_PORTARIA_SUBTYPES = ['Porteiro', 'Zelador', 'Recepção', 'Guarita'];
const DEFAULT_SEGURANCA_SUBTYPES = ['Segurança da Rua', 'Vigilante', 'Guarita'];

export const DeliveryConfirmModal: React.FC<DeliveryConfirmModalProps> = ({
  isOpen,
  onClose,
  user,
  street,
  pkg,
  defaultWhatsAppPhone,
  onConfirm,
}) => {
  if (!isOpen || !pkg) return null;

  const [category, setCategory] = useState<ReceiverCategory>('proprio');
  const [subtype, setSubtype] = useState<string>('');
  const [receiverName, setReceiverName] = useState<string>('');
  const [recipientNameState, setRecipientNameState] = useState<string>(pkg.recipientName || '');
  const [memoryRecord, setMemoryRecord] = useState<AddressMemoryRecord | null>(null);
  const [memorySuggestion, setMemorySuggestion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Frequent receivers by category
  const [frequentPorteiros, setFrequentPorteiros] = useState<string[]>([]);
  const [frequentFamiliars, setFrequentFamiliars] = useState<string[]>([]);
  const [frequentSeguranca, setFrequentSeguranca] = useState<string[]>([]);
  const [frequentVizinhos, setFrequentVizinhos] = useState<string[]>([]);
  const [frequentComercio, setFrequentComercio] = useState<string[]>([]);

  // Learned subtypes
  const [learnedPortariaSubtypes, setLearnedPortariaSubtypes] = useState<string[]>(DEFAULT_PORTARIA_SUBTYPES);
  const [learnedFamiliarSubtypes, setLearnedFamiliarSubtypes] = useState<string[]>(DEFAULT_FAMILIAR_SUBTYPES);
  const [learnedSegurancaSubtypes, setLearnedSegurancaSubtypes] = useState<string[]>(DEFAULT_SEGURANCA_SUBTYPES);

  // Look up memory when opening modal
  useEffect(() => {
    setRecipientNameState(pkg.recipientName || '');
    setFrequentPorteiros(getFrequentReceiversForCategory(user.id, 'portaria'));
    setFrequentFamiliars(getFrequentReceiversForCategory(user.id, 'familiar'));
    setFrequentSeguranca(getFrequentReceiversForCategory(user.id, 'seguranca'));
    setFrequentVizinhos(getFrequentReceiversForCategory(user.id, 'vizinho'));
    setFrequentComercio(getFrequentReceiversForCategory(user.id, 'comercio'));

    // Load custom learned subtypes
    const customPort = getLearnedItems(user.id, 'subtype', 'portaria');
    setLearnedPortariaSubtypes(Array.from(new Set([...DEFAULT_PORTARIA_SUBTYPES, ...customPort])));

    const customFam = getLearnedItems(user.id, 'subtype', 'familiar');
    setLearnedFamiliarSubtypes(Array.from(new Set([...DEFAULT_FAMILIAR_SUBTYPES, ...customFam])));

    const customSeg = getLearnedItems(user.id, 'subtype', 'seguranca');
    setLearnedSegurancaSubtypes(Array.from(new Set([...DEFAULT_SEGURANCA_SUBTYPES, ...customSeg])));

    const memory = lookupAddressMemory(user.id, street.name, pkg.houseNumber, pkg.complement);
    if (memory && (memory.lastReceiverName || memory.lastReceiverCategory)) {
      setMemoryRecord(memory);
      if (memory.lastReceiverCategory) {
        setCategory(memory.lastReceiverCategory);
      }
      if (memory.lastReceiverSubtype) {
        setSubtype(memory.lastReceiverSubtype);
      }
      if (memory.lastReceiverName) {
        setReceiverName(memory.lastReceiverName);
      }
      if (memory.recipientName && !pkg.recipientName) {
        setRecipientNameState(memory.recipientName);
      }
      const desc = buildReceiverFullDescription(
        memory.lastReceiverCategory,
        memory.lastReceiverSubtype,
        memory.lastReceiverName,
        memory.recipientName || pkg.recipientName
      );
      setMemorySuggestion(desc);
    } else {
      setMemoryRecord(null);
      setCategory('proprio');
      setSubtype('');
      setReceiverName(pkg.recipientName || '');
      setMemorySuggestion(null);
    }
  }, [user.id, street.name, pkg]);


  const handleApplyMemory = (mem: AddressMemoryRecord) => {
    if (mem.lastReceiverCategory) setCategory(mem.lastReceiverCategory);
    if (mem.lastReceiverSubtype) setSubtype(mem.lastReceiverSubtype);
    if (mem.lastReceiverName) setReceiverName(mem.lastReceiverName);
    if (mem.recipientName && !recipientNameState) setRecipientNameState(mem.recipientName);
  };

  const handleSelectCategory = (cat: ReceiverCategory) => {
    setCategory(cat);
    if (cat === 'proprio') {
      setSubtype('');
      setReceiverName(recipientNameState || '');
    } else if (cat === 'familiar') {
      if (frequentFamiliars.length > 0 && !receiverName) {
        setReceiverName(frequentFamiliars[0]);
      }
    } else if (cat === 'portaria') {
      if (!subtype) setSubtype('Porteiro');
      if (frequentPorteiros.length > 0 && !receiverName) {
        setReceiverName(frequentPorteiros[0]);
      }
    } else if (cat === 'seguranca') {
      if (!subtype) setSubtype('Segurança da Rua');
      if (frequentSeguranca.length > 0 && !receiverName) {
        setReceiverName(frequentSeguranca[0]);
      }
    }
  };

  // Build current package object for preview
  const currentReceiverDesc = buildReceiverFullDescription(
    category,
    subtype,
    receiverName,
    recipientNameState
  );

  const previewPkg: StreetPackage = {
    ...pkg,
    recipientName: recipientNameState,
    status: 'delivered',
    receiverCategory: category,
    receiverSubtype: subtype || undefined,
    receiverName: receiverName.trim() || undefined,
    deliveredTo: currentReceiverDesc,
    deliveredAt: new Date().toISOString(),
  };

  const previewText = formatDeliveryWhatsAppMessage(user.name, street.name, previewPkg);

  // Copy text handler
  const handleCopyOnly = async () => {
    const success = await copyToClipboard(previewText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Confirm Delivery
  const handleConfirm = async (andOpenZap: boolean = false) => {
    const cleanRecName = receiverName.trim();
    const cleanSubtype = subtype.trim();

    try {
      // Dynamically learn receiver and custom subtype
      if (cleanRecName) {
        learnItem(user.id, category, cleanRecName, cleanSubtype || undefined);
      }
      if (cleanSubtype && (category === 'portaria' || category === 'familiar' || category === 'seguranca')) {
        learnItem(user.id, 'subtype', cleanSubtype, category);
      }

      // Save into address memory for future visits to this house
      rememberAddress(user.id, {
        streetName: street.name,
        houseNumber: pkg.houseNumber,
        complement: pkg.complement,
        recipientName: recipientNameState,
        receiverCategory: category,
        receiverSubtype: cleanSubtype || undefined,
        receiverName: cleanRecName,
      });

      // Save into street saved addresses catalog
      saveAddressToStreetMemory(
        user.id,
        street.name,
        pkg.houseNumber,
        pkg.complement,
        recipientNameState,
        {
          category,
          subtype: cleanSubtype || undefined,
          receiverName: cleanRecName || undefined,
          isDelivered: true,
        }
      );

      // Trigger audio & visual cash celebration
      playCashChime();
      triggerMoneyConfetti();

      // Confirm the delivery state immediately
      onConfirm(previewPkg);
    } catch (err) {
      console.error('Erro ao processar baixa de entrega:', err);
      onConfirm(previewPkg);
    } finally {
      onClose();
    }

    // Auto copy text and open WhatsApp in background
    try {
      await copyToClipboard(previewText);
      if (andOpenZap) {
        openWhatsApp(previewText, defaultWhatsAppPhone);
      }
    } catch (zapErr) {
      console.warn('Aviso ao copiar ou abrir WhatsApp:', zapErr);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex flex-col items-center justify-center font-black shrink-0">
              <span className="text-[9px] uppercase tracking-wider text-emerald-100 leading-none">
                Nº
              </span>
              <span className="text-base truncate max-w-[40px]">{pkg.houseNumber}</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-lg leading-tight">Confirmar Entrega</h3>
              <p className="text-xs text-emerald-100 truncate">
                {recipientNameState || 'Cliente'}
                {pkg.complement ? ` (${pkg.complement})` : ''} • {street.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
          {/* 1-Click Action Button for Remembered Receiver */}
          {memoryRecord && memorySuggestion && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 flex flex-wrap items-center justify-between gap-2 shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                    Recebedor Frequente deste endereço:
                  </span>
                  <strong className="text-slate-900 text-sm font-black truncate block">
                    {memorySuggestion}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleApplyMemory(memoryRecord)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Usar 1 Toque</span>
              </button>
            </div>
          )}

          {/* Nome do Cliente/Morador Editável */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
              Nome do Cliente / Morador:
            </label>
            <input
              type="text"
              placeholder="Ex: joao, maria..."
              value={recipientNameState}
              onChange={(e) => setRecipientNameState(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-sm text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>

          {/* Receiver Category Buttons */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1.5">
              Quem recebeu a encomenda?
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectCategory('proprio')}
                className={`p-2.5 rounded-xl border-2 font-black text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                  category === 'proprio'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Próprio Morador</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCategory('familiar')}
                className={`p-2.5 rounded-xl border-2 font-black text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                  category === 'familiar'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Familiar</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCategory('portaria')}
                className={`p-2.5 rounded-xl border-2 font-black text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                  category === 'portaria'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>Portaria / Prédio</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCategory('vizinho')}
                className={`p-2.5 rounded-xl border-2 font-black text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                  category === 'vizinho'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Home className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Vizinho</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCategory('seguranca')}
                className={`p-2.5 rounded-xl border-2 font-black text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                  category === 'seguranca'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Segurança</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCategory('comercio')}
                className={`p-2.5 rounded-xl border-2 font-black text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                  category === 'comercio'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Store className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Comércio</span>
              </button>
            </div>
          </div>

          {/* Sub-options for Portaria (with 1-click Porter chips) */}
          {category === 'portaria' && (
            <div className="space-y-2.5 p-3.5 rounded-2xl bg-purple-50/80 border border-purple-200 animate-fadeIn">
              <label className="block text-[11px] font-bold text-purple-900 uppercase">
                Função:
              </label>
              <div className="flex flex-wrap gap-1">
                {learnedPortariaSubtypes.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubtype(sub)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      subtype === sub
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>

              {/* Quick Clickable Chips for Saved Porteiros */}
              {frequentPorteiros.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-black text-purple-900 uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-600" />
                    Porteiros Salvos (1 Toque):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {frequentPorteiros.map((pName) => (
                      <button
                        key={pName}
                        type="button"
                        onClick={() => setReceiverName(pName)}
                        className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          receiverName.trim().toLowerCase() === pName.toLowerCase()
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-white text-purple-900 border border-purple-300 hover:bg-purple-100'
                        }`}
                      >
                        {pName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-purple-900 uppercase mt-1 mb-0.5">
                  Nome do Porteiro / Recepcionista:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Jorge, Marcos, Seu José..."
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-purple-300 focus:border-purple-600 outline-none text-sm font-bold text-slate-900 bg-white"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Sub-options for Familiar */}
          {category === 'familiar' && (
            <div className="space-y-2.5 p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 animate-fadeIn">
              <label className="block text-[11px] font-bold text-blue-900 uppercase">
                Parentesco (Opcional):
              </label>
              <div className="flex flex-wrap gap-1">
                {learnedFamiliarSubtypes.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubtype(sub === subtype ? '' : sub)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      subtype === sub
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>

              {/* Quick Clickable Chips for Saved Familiars */}
              {frequentFamiliars.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-black text-blue-900 uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    Familiares Recentes (1 Toque):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {frequentFamiliars.map((fName) => (
                      <button
                        key={fName}
                        type="button"
                        onClick={() => setReceiverName(fName)}
                        className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          receiverName.trim().toLowerCase() === fName.toLowerCase()
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-blue-900 border border-blue-300 hover:bg-blue-100'
                        }`}
                      >
                        {fName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-blue-900 uppercase mt-1 mb-0.5">
                  Nome do Familiar (ex: pedro, dona maria...):
                </label>
                <input
                  type="text"
                  placeholder="Ex: pedro"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-blue-300 focus:border-blue-600 outline-none text-sm font-bold text-slate-900 bg-white"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Sub-options for Segurança */}
          {category === 'seguranca' && (
            <div className="space-y-2.5 p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 animate-fadeIn">
              <label className="block text-[11px] font-bold text-indigo-900 uppercase">
                Função:
              </label>
              <div className="flex flex-wrap gap-1">
                {learnedSegurancaSubtypes.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubtype(sub)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      subtype === sub
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>

              {/* Quick Clickable Chips for Saved Security */}
              {frequentSeguranca.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-black text-indigo-900 uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    Vigilantes Salvos (1 Toque):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {frequentSeguranca.map((sName) => (
                      <button
                        key={sName}
                        type="button"
                        onClick={() => setReceiverName(sName)}
                        className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          receiverName.trim().toLowerCase() === sName.toLowerCase()
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-indigo-900 border border-indigo-300 hover:bg-indigo-100'
                        }`}
                      >
                        {sName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-indigo-900 uppercase mt-1 mb-0.5">
                  Nome do Segurança:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Jorge, Marcos..."
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-indigo-300 focus:border-indigo-600 outline-none text-sm font-bold text-slate-900 bg-white"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Fields for Vizinho */}
          {category === 'vizinho' && (
            <div className="space-y-2 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 animate-fadeIn">
              {frequentVizinhos.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-amber-900 uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    Vizinhos Frequentes (1 Toque):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {frequentVizinhos.map((vName) => (
                      <button
                        key={vName}
                        type="button"
                        onClick={() => setReceiverName(vName)}
                        className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          receiverName.trim().toLowerCase() === vName.toLowerCase()
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100'
                        }`}
                      >
                        {vName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-amber-900 uppercase mb-0.5">
                  Nº da Casa do Vizinho / Nome:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Casa 144 - Carlos"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 focus:border-amber-600 outline-none text-sm font-bold text-slate-900 bg-white"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Fields for Comércio */}
          {category === 'comercio' && (
            <div className="space-y-2 p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200 animate-fadeIn">
              {frequentComercio.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-teal-900 uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-teal-600" />
                    Comércios Salvos (1 Toque):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {frequentComercio.map((cName) => (
                      <button
                        key={cName}
                        type="button"
                        onClick={() => setReceiverName(cName)}
                        className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          receiverName.trim().toLowerCase() === cName.toLowerCase()
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-white text-teal-900 border border-teal-300 hover:bg-teal-100'
                        }`}
                      >
                        {cName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-teal-900 uppercase mb-0.5">
                  Nome do Estabelecimento / Atendente:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Padaria do Bairro, Farmácia..."
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-teal-300 focus:border-teal-600 outline-none text-sm font-bold text-slate-900 bg-white"
                  autoFocus
                />
              </div>
            </div>
          )}


          {/* Live Preview Box */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Texto Gerado:</span>
              <button
                type="button"
                onClick={handleCopyOnly}
                className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-bold cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>

            <pre className="p-3 rounded-2xl bg-slate-900 text-emerald-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all border border-slate-800 shadow-inner">
              {previewText}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 text-xs hover:bg-slate-200/70 cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => handleConfirm(false)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Confirmar & Copiar Texto</span>
          </button>

          <button
            type="button"
            onClick={() => handleConfirm(true)}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 font-black text-xs shadow-sm flex items-center justify-center gap-1 cursor-pointer"
            title="Confirmar e abrir no WhatsApp"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
