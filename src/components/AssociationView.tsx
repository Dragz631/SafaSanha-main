import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Share2,
  CheckCircle2,
  Trash2,
  Home,
  User,
  MapPin,
  Check,
  Sparkles,
  Phone,
  Search,
  Copy,
  List,
  Edit3,
  CheckCheck,
  Send,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { UserProfile, UserStreet, AssociationDelivery, AssociationSettings } from '../types';
import {
  openWhatsApp,
  copyToClipboard,
  getAssociationSettings,
  saveAssociationSettings,
  formatAssociationListWhatsAppMessage,
} from '../lib/userStorage';
import { learnItem, getLearnedItems } from '../lib/memoryEngine';

interface AssociationViewProps {
  user: UserProfile;
  streets: UserStreet[];
  associationDeliveries: AssociationDelivery[];
  whatsappPhone?: string;
  onAddAssociationDelivery: (delivery: AssociationDelivery) => void;
  onDeleteAssociationDelivery: (id: string) => void;
  onClearAssociationDeliveries?: () => void;
  onBatchAddAssociationDeliveries?: (deliveries: AssociationDelivery[]) => void;
}

export const AssociationView: React.FC<AssociationViewProps> = ({
  user,
  streets,
  associationDeliveries,
  whatsappPhone,
  onAddAssociationDelivery,
  onDeleteAssociationDelivery,
  onClearAssociationDeliveries,
  onBatchAddAssociationDeliveries,
}) => {
  // Association Sede Settings
  const [assocName, setAssocName] = useState('');
  const [attendantName, setAttendantName] = useState('');
  const [attendantPhone, setAttendantPhone] = useState('');
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  // Form State
  const [addMode, setAddMode] = useState<'single' | 'batch'>('single');
  const [selectedStreet, setSelectedStreet] = useState(streets[0]?.name || '');
  const [customStreet, setCustomStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');

  // Batch Form State
  const [batchText, setBatchText] = useState('');

  // Search & Copy State
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedList, setCopiedList] = useState(false);
  const [copiedItemIndex, setCopiedItemIndex] = useState<number | null>(null);

  // Learned Association and Attendant Suggestions
  const [learnedAssocNames, setLearnedAssocNames] = useState<string[]>([]);
  const [learnedAttendants, setLearnedAttendants] = useState<string[]>([]);

  // Load saved settings & learned items on mount
  useEffect(() => {
    const savedSettings = getAssociationSettings(user.id);
    if (savedSettings.name) setAssocName(savedSettings.name);
    if (savedSettings.attendant) setAttendantName(savedSettings.attendant);
    if (savedSettings.phone) setAttendantPhone(savedSettings.phone);

    const assocList = getLearnedItems(user.id, 'association');
    setLearnedAssocNames(assocList);

    const attList = getLearnedItems(user.id, 'association_attendant');
    setLearnedAttendants(attList);

    if (!savedSettings.name && assocList.length > 0) {
      setAssocName(assocList[0]);
    }
    if (!savedSettings.attendant && attList.length > 0) {
      setAttendantName(attList[0]);
    }
  }, [user.id]);

  // Save Settings
  const handleSaveSettings = () => {
    const cleanName = assocName.trim() || 'Associação de Moradores';
    const cleanAttendant = attendantName.trim();
    const cleanPhone = attendantPhone.trim();

    saveAssociationSettings(user.id, {
      name: cleanName,
      attendant: cleanAttendant,
      phone: cleanPhone,
    });

    if (cleanName) learnItem(user.id, 'association', cleanName);
    if (cleanAttendant) learnItem(user.id, 'association_attendant', cleanAttendant);

    setIsEditingSettings(false);
  };

  // Add Single Resident Package
  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() && !houseNumber.trim()) return;

    const street = (customStreet.trim() || selectedStreet || 'Associação / Sede').trim();
    const finalAttendant = attendantName.trim() || 'Mulher da Associação';

    const newDelivery: AssociationDelivery = {
      id: `assoc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      associationName: assocName.trim() || 'Associação de Moradores',
      streetName: street,
      houseNumber: houseNumber.trim() || 'S/N',
      complement: complement.trim() || undefined,
      recipientName: recipientName.trim() || 'Morador',
      code: code.trim() || undefined,
      notes: notes.trim() || undefined,
      receivedBy: finalAttendant,
      deliveredAt: new Date().toISOString(),
    };

    onAddAssociationDelivery(newDelivery);

    // Clear package fields (keep street selected)
    setRecipientName('');
    setHouseNumber('');
    setComplement('');
    setCode('');
    setNotes('');

    // Focus recipient name field for next entry
    const el = document.getElementById('input-assoc-recipient');
    if (el) el.focus();
  };

  // Add Batch Packages (e.g. from pasted lines)
  const handleAddBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchText.trim()) return;

    const lines = batchText.split('\n').map((l) => l.trim()).filter(Boolean);
    const newItems: AssociationDelivery[] = [];
    const finalAttendant = attendantName.trim() || 'Mulher da Associação';
    const defaultStreet = selectedStreet || 'Rua Principal';

    lines.forEach((line) => {
      // Formats supported:
      // 1) "Nome - Rua - Numero"
      // 2) "Nome, Numero"
      // 3) "Numero - Nome"
      // 4) "Nome"
      let pName = 'Morador';
      let pStreet = defaultStreet;
      let pNumber = 'S/N';
      let pCode = '';

      if (line.includes('-')) {
        const parts = line.split('-').map((p) => p.trim());
        if (parts.length >= 3) {
          pName = parts[0];
          pStreet = parts[1];
          pNumber = parts[2];
        } else if (parts.length === 2) {
          // Check if first part is number
          if (/^\d+/.test(parts[0])) {
            pNumber = parts[0];
            pName = parts[1];
          } else {
            pName = parts[0];
            pNumber = parts[1];
          }
        }
      } else if (line.includes(',')) {
        const parts = line.split(',').map((p) => p.trim());
        pName = parts[0];
        pNumber = parts[1] || 'S/N';
      } else {
        pName = line;
      }

      newItems.push({
        id: `assoc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        associationName: assocName.trim() || 'Associação de Moradores',
        streetName: pStreet,
        houseNumber: pNumber,
        recipientName: pName,
        receivedBy: finalAttendant,
        deliveredAt: new Date().toISOString(),
      });
    });

    if (newItems.length > 0) {
      if (onBatchAddAssociationDeliveries) {
        onBatchAddAssociationDeliveries(newItems);
      } else {
        newItems.forEach((item) => onAddAssociationDelivery(item));
      }
      setBatchText('');
      setAddMode('single');
    }
  };

  // Filter deliveries by search term
  const filteredDeliveries = useMemo(() => {
    if (!searchTerm.trim()) return associationDeliveries;
    const term = searchTerm.toLowerCase();
    return associationDeliveries.filter(
      (d) =>
        d.recipientName.toLowerCase().includes(term) ||
        d.streetName.toLowerCase().includes(term) ||
        d.houseNumber.toLowerCase().includes(term) ||
        (d.complement && d.complement.toLowerCase().includes(term)) ||
        (d.code && d.code.toLowerCase().includes(term))
    );
  }, [associationDeliveries, searchTerm]);

  // Send WhatsApp Report to Association Attendant
  const handleSendWhatsAppToAttendant = () => {
    const message = formatAssociationListWhatsAppMessage(
      user.name,
      assocName.trim() || 'Associação de Moradores',
      attendantName.trim() || 'Responsável na Sede',
      associationDeliveries
    );

    // Send to attendant phone if set, otherwise to default whatsapp
    const targetPhone = attendantPhone.trim() || whatsappPhone;
    openWhatsApp(message, targetPhone);
  };

  // Copy Full List to Clipboard
  const handleCopyFullList = async () => {
    const message = formatAssociationListWhatsAppMessage(
      user.name,
      assocName.trim() || 'Associação de Moradores',
      attendantName.trim() || 'Responsável na Sede',
      associationDeliveries
    );
    const ok = await copyToClipboard(message);
    if (ok) {
      setCopiedList(true);
      setTimeout(() => setCopiedList(false), 2500);
    }
  };

  // Copy Individual Resident Item
  const handleCopySingleItem = async (item: AssociationDelivery, idx: number) => {
    const compl = item.complement ? ` (${item.complement})` : '';
    const text = `📦 *ENCOMENDA NA ASSOCIAÇÃO*\n👤 *Morador:* ${item.recipientName}\n📍 *Endereço:* ${item.streetName}, Nº ${item.houseNumber}${compl}\n🤝 *Deixado com:* ${item.receivedBy || attendantName || 'Associação'}\n📅 ${new Date(item.deliveredAt).toLocaleDateString('pt-BR')} às ${new Date(item.deliveredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedItemIndex(idx);
      setTimeout(() => setCopiedItemIndex(null), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 space-y-5 animate-fadeIn">
      {/* 1. Card de Identificação da Associação & Mulher da Associação */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white p-5 sm:p-6 rounded-3xl shadow-md border border-slate-700/60 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                Ponto Central de Apoio & Becos
              </span>
              <h2 className="font-black text-lg sm:text-xl text-white leading-tight">
                {assocName || 'Nome da Associação de Moradores'}
              </h2>
              <p className="text-xs text-slate-300">
                {attendantName
                  ? `Responsável: ${attendantName}${attendantPhone ? ` • Zap: ${attendantPhone}` : ''}`
                  : 'Defina a mulher / responsável que recebe a lista'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEditingSettings(!isEditingSettings)}
            className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isEditingSettings ? 'Fechar' : 'Alterar Associação / Responsável'}</span>
          </button>
        </div>

        {/* Form para editar Nome da Associação e Nome da Mulher da Associação */}
        {isEditingSettings && (
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-700/80 space-y-3.5 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Nome da Associação */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-emerald-400 mb-1">
                  Nome da Associação / Sede:
                </label>
                {learnedAssocNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {learnedAssocNames.slice(0, 3).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setAssocName(name)}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/20 text-emerald-200 cursor-pointer"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Ex: Associação do Morro da Paz"
                  value={assocName}
                  onChange={(e) => setAssocName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-900 text-white font-bold text-xs outline-none focus:border-emerald-500"
                />
              </div>

              {/* Mulher / Responsável da Associação */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-emerald-400 mb-1">
                  Mulher / Pessoa da Associação:
                </label>
                {learnedAttendants.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {learnedAttendants.slice(0, 3).map((att) => (
                      <button
                        key={att}
                        type="button"
                        onClick={() => setAttendantName(att)}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/20 text-emerald-200 cursor-pointer"
                      >
                        {att}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Ex: Dona Maria, Ana, Francisca..."
                  value={attendantName}
                  onChange={(e) => setAttendantName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-900 text-white font-bold text-xs outline-none focus:border-emerald-500"
                />
              </div>

              {/* Telefone / WhatsApp da Responsável */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-emerald-400 mb-1">
                  WhatsApp da Responsável:
                </label>
                <div className="relative mt-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    placeholder="Ex: 21999998888"
                    value={attendantPhone}
                    onChange={(e) => setAttendantPhone(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-600 bg-slate-900 text-white font-bold text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Para enviar a lista com 1 toque no zap dela.
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Dados da Associação</span>
              </button>
            </div>
          </div>
        )}

        {/* Barra de Ações Rápidas de Envio */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              📦 {associationDeliveries.length} {associationDeliveries.length === 1 ? 'Morador / Pacote' : 'Moradores na Lista'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {associationDeliveries.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopyFullList}
                  className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Copiar lista pronta para colar"
                >
                  {copiedList ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedList ? 'Lista Copiada!' : 'Copiar Lista'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendWhatsAppToAttendant}
                  className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Passar Lista p/ {attendantName || 'Mulher da Associação'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Formulário para Adicionar Pessoas / Moradores à Lista */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-600" />
            <h3 className="font-black text-sm sm:text-base text-slate-900">
              Adicionar Morador e Encomenda para a Associação
            </h3>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-black">
            <button
              type="button"
              onClick={() => setAddMode('single')}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                addMode === 'single'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              + Individual
            </button>
            <button
              type="button"
              onClick={() => setAddMode('batch')}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                addMode === 'batch'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Colar Vários
            </button>
          </div>
        </div>

        {/* Modo Individual */}
        {addMode === 'single' ? (
          <form onSubmit={handleAddSingle} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Nome do Morador */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Nome do Morador / Destinatário *
                </label>
                <input
                  id="input-assoc-recipient"
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva, Dona Neide..."
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 font-bold text-sm text-slate-900 outline-none focus:border-emerald-600"
                  autoFocus
                />
              </div>

              {/* Rua de Destino / Beco */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Rua / Beco / Travessa *
                </label>
                <div className="space-y-1.5">
                  {streets.length > 0 ? (
                    <select
                      value={selectedStreet}
                      onChange={(e) => {
                        setSelectedStreet(e.target.value);
                        setCustomStreet('');
                      }}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 font-bold text-xs text-slate-900 bg-white"
                    >
                      {streets.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                      <option value="OUTRA">-- Digitar outra rua/beco --</option>
                    </select>
                  ) : null}

                  {(!streets.length || selectedStreet === 'OUTRA') && (
                    <input
                      type="text"
                      placeholder="Nome da rua ou beco..."
                      value={customStreet}
                      onChange={(e) => setCustomStreet(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-900 outline-none focus:border-emerald-600"
                    />
                  )}
                </div>
              </div>

              {/* Nº da Casa e Complemento */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Nº da Casa *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 48, 12-B"
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 font-bold text-sm text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Compl. / Bloco
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Fundos"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 font-bold text-sm text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Código / Observação e Botão de Adicionar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Código do Pacote / Rastreio (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: BR9823487 ou #102"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Observação / Referência (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Pacote Grande, Caixa Azul..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-5 h-5" />
                <span>+ Adicionar à Lista</span>
              </button>
            </div>
          </form>
        ) : (
          /* Modo em Lote / Colar Vários */
          <form onSubmit={handleAddBatch} className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Cole a lista de moradores (um por linha):
              </label>
              <textarea
                rows={4}
                placeholder="Exemplo:&#10;Carlos Silva - Rua Principal - 48&#10;Dona Neide - Beco 2 - 14&#10;Jéssica - Travessa da Paz - 102"
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                className="w-full p-3.5 rounded-2xl border border-slate-300 font-bold text-xs text-slate-900 outline-none focus:border-emerald-600"
              />
              <span className="text-[11px] text-slate-500 block mt-1">
                Formato aceito: <code>Nome - Rua - Número</code> ou <code>Nome, Número</code>
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddMode('single')}
                className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <List className="w-4 h-4" />
                <span>Cadastrar Todos na Lista</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 3. Lista de Moradores da Associação */}
      <div className="space-y-3">
        {/* Barra de Pesquisa na Lista */}
        {associationDeliveries.length > 0 && (
          <div className="bg-white p-3.5 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                placeholder="Buscar morador, rua ou nº na lista da associação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 rounded-2xl border border-slate-300 focus:border-emerald-600 outline-none text-xs font-bold text-slate-900"
              />
            </div>

            {onClearAssociationDeliveries && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Deseja limpar a lista de entregas da associação para um novo dia?')) {
                    onClearAssociationDeliveries();
                  }
                }}
                className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs cursor-pointer transition-all"
              >
                Limpar Lista do Dia
              </button>
            )}
          </div>
        )}

        {/* Empty State */}
        {filteredDeliveries.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-10 text-center border border-slate-200 shadow-xs space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-slate-900 text-base">
                {associationDeliveries.length === 0
                  ? 'Nenhum morador na lista da associação ainda'
                  : 'Nenhum morador encontrado com esse filtro'}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Cadastre acima os moradores cujos pacotes você deixou na{' '}
                <strong>{assocName || 'Associação'}</strong> para gerar a lista e passar para a{' '}
                <strong>{attendantName || 'mulher da associação'}</strong>.
              </p>
            </div>
          </div>
        ) : (
          /* Cards dos Moradores Numerados */
          <div className="space-y-2.5">
            {filteredDeliveries.map((item, idx) => {
              const compl = item.complement ? ` (${item.complement})` : '';
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-3xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-2xs hover:border-emerald-300 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center font-black shrink-0 shadow-xs">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 leading-none">
                        Nº
                      </span>
                      <span className="text-xs">{idx + 1}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-slate-900 text-sm sm:text-base truncate">
                          {item.recipientName || 'Morador'}
                        </h4>
                        <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg shrink-0">
                          Casa {item.houseNumber}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 font-medium mt-0.5 truncate">
                        📍 {item.streetName}{compl}
                        {item.code ? ` • 🏷️ Cód: ${item.code}` : ''}
                      </p>

                      {item.notes && (
                        <p className="text-[11px] text-amber-800 font-bold mt-0.5">
                          📝 {item.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopySingleItem(item, idx)}
                      className={`p-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        copiedItemIndex === idx
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      title="Copiar dados deste morador"
                    >
                      {copiedItemIndex === idx ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteAssociationDelivery(item.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                      title="Remover morador da lista"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

