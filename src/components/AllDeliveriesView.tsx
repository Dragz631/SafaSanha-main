import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Home,
  User,
  MapPin,
  Plus,
  RotateCcw,
  Check,
  Mic,
  MicOff,
  Layers,
  ArrowUpDown,
  Camera,
  List,
  ChevronDown,
  Building2,
  Trash2,
  Copy,
  AlertTriangle,
  BookOpen,
  Coins,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, UserStreet, StreetPackage, ReceiverCategory } from '../types';
import {
  formatDeliveryWhatsAppMessage,
  formatFailureWhatsAppMessage,
  openWhatsApp,
  copyToClipboard,
  saveAddressToStreetMemory,
  getStreetSavedAddresses,
} from '../lib/userStorage';
import {
  learnItem,
  getLearnedItems,
  getSessionPreferences,
  saveSessionPreferences,
} from '../lib/memoryEngine';
import { DeliveryConfirmModal } from './DeliveryConfirmModal';
import { BulkStreetImportModal } from './BulkStreetImportModal';
import { ScannerModal } from './ScannerModal';
import { GroupedHouseCard } from './GroupedHouseCard';
import { GroupPortariaConfirmModal } from './GroupPortariaConfirmModal';
import { StreetMemoryModal } from './StreetMemoryModal';
import { MoneyCelebrationToast, MoneyCelebrationEvent } from './MoneyCelebrationToast';

interface AllDeliveriesViewProps {
  user: UserProfile;
  streets: UserStreet[];
  activeStreetId?: string;
  whatsappPhone?: string;
  onUpdateStreet: (updatedStreet: UserStreet) => void;
  onAddStreet: (newStreet: UserStreet) => void;
  onSelectStreet: (street: UserStreet) => void;
  onOpenNewStreetModal?: () => void;
}

// 8 Fast 1-Touch Shortcuts for Complement
const SHORTCUT_TAGS = [
  '+Compl',
  'Apto',
  'Bloco A',
  'Bloco B',
  'Casa 2',
  'Fundos',
  'Sobrado',
  'Loja',
];

export const AllDeliveriesView: React.FC<AllDeliveriesViewProps> = ({
  user,
  streets,
  activeStreetId,
  whatsappPhone,
  onUpdateStreet,
  onAddStreet,
  onSelectStreet,
  onOpenNewStreetModal,
}) => {
  // Load saved session preferences
  const savedPrefs = useMemo(() => getSessionPreferences(user.id), [user.id]);

  // Active Street Selection
  const [currentStreetId, setCurrentStreetId] = useState<string>(
    activeStreetId || savedPrefs.activeStreetId || (streets.length > 0 ? streets[0].id : '')
  );

  // Keep currentStreetId synchronized with activeStreetId prop
  useEffect(() => {
    if (activeStreetId) {
      setCurrentStreetId(activeStreetId);
    }
  }, [activeStreetId]);

  const activeStreet = useMemo(() => {
    return streets.find((s) => s.id === currentStreetId) || streets[0] || null;
  }, [streets, currentStreetId]);

  // Quick 1-Touch Registration Fields
  const [houseNumber, setHouseNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showSwitchStreetSelect, setShowSwitchStreetSelect] = useState(false);
  const [showStreetMemoryModal, setShowStreetMemoryModal] = useState(false);

  // Money celebration toast state
  const [moneyToastEvent, setMoneyToastEvent] = useState<MoneyCelebrationEvent | null>(null);

  // Search, Filter & Sort from saved session preferences
  const [searchTerm, setSearchTerm] = useState(savedPrefs.searchTerm || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'delivered' | 'failed'>(
    savedPrefs.statusFilter || 'all'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'insertion'>(
    savedPrefs.sortOrder || 'asc'
  );
  const [viewMode, setViewMode] = useState<'grouped' | 'all'>(
    savedPrefs.viewMode || 'grouped'
  );

  // Delivery Modal State
  const [confirmModalPkg, setConfirmModalPkg] = useState<StreetPackage | null>(null);
  const [groupPortariaModalData, setGroupPortariaModalData] = useState<{
    houseNum: string;
    packages: StreetPackage[];
  } | null>(null);

  // Failure Modal State
  const [failedModalPkg, setFailedModalPkg] = useState<StreetPackage | null>(null);
  const [failReason, setFailReason] = useState('Morador Ausente / Ninguém Atende');
  const [learnedReasons, setLearnedReasons] = useState<string[]>([]);

  // Saved Addresses from Memory for this street
  const savedStreetAddresses = useMemo(() => {
    if (!activeStreet) return [];
    return getStreetSavedAddresses(user.id, activeStreet.name);
  }, [user.id, activeStreet, showStreetMemoryModal]);

  // Suggestions while typing house number
  const suggestedSavedAddresses = useMemo(() => {
    if (!houseNumber.trim() || !savedStreetAddresses.length) return [];
    const term = houseNumber.trim().toLowerCase();
    const list: { houseNumber: string; complement?: string; residentName: string }[] = [];
    savedStreetAddresses.forEach((addr) => {
      if (addr.houseNumber.toLowerCase().includes(term)) {
        addr.residents.forEach((r) => {
          list.push({
            houseNumber: addr.houseNumber,
            complement: r.complement,
            residentName: r.recipientName,
          });
        });
      }
    });
    return list;
  }, [savedStreetAddresses, houseNumber]);

  // Update session preferences whenever filter, sort or viewMode change
  const handleUpdateFilter = (filter: 'all' | 'pending' | 'delivered' | 'failed') => {
    setStatusFilter(filter);
    saveSessionPreferences(user.id, { statusFilter: filter });
  };

  const handleUpdateSort = (order: 'asc' | 'desc' | 'insertion') => {
    setSortOrder(order);
    saveSessionPreferences(user.id, { sortOrder: order });
  };

  const handleUpdateViewMode = (mode: 'grouped' | 'all') => {
    setViewMode(mode);
    saveSessionPreferences(user.id, { viewMode: mode });
  };

  const handleUpdateSearch = (term: string) => {
    setSearchTerm(term);
    saveSessionPreferences(user.id, { searchTerm: term });
  };


  // Speech Recognition Setup (Web Speech API)
  const recognitionRef = useRef<any>(null);

  const toggleVoiceRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Reconhecimento de voz não suportado neste navegador. Digite os números pelo teclado.');
      return;
    }

    if (isListeningVoice) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListeningVoice(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = 'pt-BR';
      rec.continuous = false;
      rec.interimResults = false;

      rec.onstart = () => setIsListeningVoice(true);
      rec.onend = () => setIsListeningVoice(false);
      rec.onerror = () => setIsListeningVoice(false);

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const numMatch = transcript.match(/\d+/);
        if (numMatch) {
          setHouseNumber(numMatch[0]);
          const remaining = transcript.replace(numMatch[0], '').trim();
          if (remaining) {
            setComplement(remaining);
          }
        } else {
          setRecipientName(transcript);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn('Erro voz:', err);
      setIsListeningVoice(false);
    }
  };

  // Handle Quick Add Package (Immediately saves to street memory)
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStreet) return;
    if (!houseNumber.trim()) return;

    const cleanNum = houseNumber.trim();
    const cleanComp = complement.trim() || undefined;
    const cleanRec = recipientName.trim() || 'Morador';

    const newPkg: StreetPackage = {
      id: `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      houseNumber: cleanNum,
      complement: cleanComp,
      recipientName: cleanRec,
      status: 'pending',
    };

    // Immediately save to persistent street address memory!
    saveAddressToStreetMemory(user.id, activeStreet.name, cleanNum, cleanComp, cleanRec);

    const updatedPackages = [...activeStreet.packages, newPkg];
    onUpdateStreet({
      ...activeStreet,
      packages: updatedPackages,
      isCompleted: false,
    });

    setHouseNumber('');
    setComplement('');
    setRecipientName('');
  };

  // Handle Shortcut Tag Click
  const handleShortcutTag = (tag: string) => {
    if (tag === '+Compl') {
      const el = document.getElementById('input-complement');
      if (el) el.focus();
    } else {
      setComplement((prev) => (prev ? `${prev} ${tag}` : tag));
    }
  };

  // Metrics for Active Street
  const streetPackages = activeStreet ? activeStreet.packages : [];
  const totalInStreet = streetPackages.length;
  const deliveredInStreet = streetPackages.filter((p) => p.status === 'delivered').length;
  const failedInStreet = streetPackages.filter((p) => p.status === 'failed').length;
  const pendingInStreet = totalInStreet - deliveredInStreet - failedInStreet;

  // Filter and Sort Packages
  const filteredPackages = useMemo(() => {
    let list = [...streetPackages];

    if (statusFilter === 'pending') {
      list = list.filter((p) => p.status === 'pending');
    } else if (statusFilter === 'delivered') {
      list = list.filter((p) => p.status === 'delivered');
    } else if (statusFilter === 'failed') {
      list = list.filter((p) => p.status === 'failed');
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (p) =>
          p.houseNumber.toLowerCase().includes(term) ||
          p.recipientName?.toLowerCase().includes(term) ||
          p.complement?.toLowerCase().includes(term) ||
          p.code?.toLowerCase().includes(term)
      );
    }

    // Sort Numbers correctly (both numeric and alphanumeric like 12A, 12B, S/N)
    if (sortOrder === 'asc') {
      list.sort((a, b) => {
        const numA = parseInt(a.houseNumber.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.houseNumber.replace(/\D/g, '')) || 0;
        if (numA !== numB) return numA - numB;
        return a.houseNumber.localeCompare(b.houseNumber, undefined, { numeric: true });
      });
    } else if (sortOrder === 'desc') {
      list.sort((a, b) => {
        const numA = parseInt(a.houseNumber.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.houseNumber.replace(/\D/g, '')) || 0;
        if (numA !== numB) return numB - numA;
        return b.houseNumber.localeCompare(a.houseNumber, undefined, { numeric: true });
      });
    }

    return list;
  }, [streetPackages, statusFilter, searchTerm, sortOrder]);

  // Grouped by House Number if viewMode === 'grouped' (Preserves EXACT sort order using Map)
  const groupedPackageList = useMemo(() => {
    const groupMap = new Map<string, StreetPackage[]>();
    filteredPackages.forEach((p) => {
      const key = p.houseNumber.trim() || 'S/N';
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(p);
    });
    return Array.from(groupMap.entries());
  }, [filteredPackages]);

  // Count groups with more than 1 package (for top tab indicator)
  const multiPackageGroupsCount = useMemo(() => {
    return groupedPackageList.filter(([_, pkgs]) => pkgs.length > 1).length;
  }, [groupedPackageList]);

  // Confirm single delivery handler
  const handleConfirmPackageDelivery = (updatedPkg: StreetPackage) => {
    if (!activeStreet) return;
    const updatedPackages = activeStreet.packages.map((p) =>
      p.id === updatedPkg.id ? updatedPkg : p
    );
    const allDone =
      updatedPackages.length > 0 && updatedPackages.every((p) => p.status === 'delivered');

    onUpdateStreet({
      ...activeStreet,
      packages: updatedPackages,
      isCompleted: allDone,
    });

    // Explicitly dismiss confirm modal
    setConfirmModalPkg(null);

    // Save to street memory
    saveAddressToStreetMemory(
      user.id,
      activeStreet.name,
      updatedPkg.houseNumber,
      updatedPkg.complement,
      updatedPkg.recipientName,
      {
        category: updatedPkg.receiverCategory,
        subtype: updatedPkg.receiverSubtype,
        receiverName: updatedPkg.receiverName,
        isDelivered: true,
      }
    );

    // Trigger visual money celebration toast!
    setMoneyToastEvent({
      id: `money_${Date.now()}`,
      houseNumber: updatedPkg.houseNumber,
      recipientName: updatedPkg.recipientName,
      packageCount: 1,
      streetName: activeStreet.name,
    });

    if (allDone) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }
  };

  // Confirm Batch Group Delivery (Portaria / Condominium / Mesma Casa)
  const handleBatchDeliverGroup = (
    receiverData: {
      category: ReceiverCategory;
      subtype?: string;
      receiverName?: string;
      deliveredTo: string;
    },
    andOpenZap: boolean,
    selectedPackageIds?: string[]
  ) => {
    if (!activeStreet || !groupPortariaModalData) return;
    const targetIds = new Set(
      selectedPackageIds && selectedPackageIds.length > 0
        ? selectedPackageIds
        : groupPortariaModalData.packages.map((p) => p.id)
    );
    const now = new Date().toISOString();

    const updatedPackages = activeStreet.packages.map((p) => {
      if (targetIds.has(p.id)) {
        return {
          ...p,
          status: 'delivered' as const,
          receiverCategory: receiverData.category,
          receiverSubtype: receiverData.subtype,
          receiverName: receiverData.receiverName,
          deliveredTo: receiverData.deliveredTo,
          deliveredAt: now,
        };
      }
      return p;
    });

    const allDone =
      updatedPackages.length > 0 && updatedPackages.every((p) => p.status === 'delivered');

    onUpdateStreet({
      ...activeStreet,
      packages: updatedPackages,
      isCompleted: allDone,
    });

    const savedHouseNum = groupPortariaModalData.houseNum;
    const deliveredCount = targetIds.size;

    // Explicitly dismiss group modal
    setGroupPortariaModalData(null);

    // Trigger visual money celebration toast for batch!
    setMoneyToastEvent({
      id: `money_batch_${Date.now()}`,
      houseNumber: savedHouseNum,
      recipientName: receiverData.deliveredTo,
      packageCount: deliveredCount,
      streetName: activeStreet.name,
    });

    if (allDone) {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    }
  };

  // Confirm Insucesso / Falha
  const handleConfirmFailed = () => {
    if (!activeStreet || !failedModalPkg) return;

    const finalReason = failReason.trim() || 'Morador Ausente';

    // Learn failure reason dynamically
    learnItem(user.id, 'failure_reason', finalReason);

    const updatedPkg: StreetPackage = {
      ...failedModalPkg,
      status: 'failed',
      failureReason: finalReason,
      deliveredAt: new Date().toISOString(),
    };

    const updatedPackages = activeStreet.packages.map((p) =>
      p.id === failedModalPkg.id ? updatedPkg : p
    );

    onUpdateStreet({
      ...activeStreet,
      packages: updatedPackages,
      isCompleted: false,
    });

    setFailedModalPkg(null);
  };

  // Open failure modal with dynamic learned reasons
  const handleOpenFailureModal = (pkg: StreetPackage) => {
    setFailedModalPkg(pkg);
    const learned = getLearnedItems(user.id, 'failure_reason');
    setLearnedReasons(learned);
    setFailReason(learned[0] || 'Morador Ausente / Ninguém Atende');
  };

  // Handle scanned package from Camera/OCR Scanner
  const handlePackageScanned = (scannedData: {
    houseNumber: string;
    complement?: string;
    recipientName?: string;
    code?: string;
  }) => {
    if (!activeStreet) return;

    const newPkg: StreetPackage = {
      id: `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      houseNumber: scannedData.houseNumber,
      complement: scannedData.complement,
      recipientName: scannedData.recipientName || '',
      code: scannedData.code,
      status: 'pending',
    };

    // Save to street memory
    saveAddressToStreetMemory(
      user.id,
      activeStreet.name,
      scannedData.houseNumber,
      scannedData.complement,
      scannedData.recipientName
    );

    const updatedPackages = [...activeStreet.packages, newPkg];
    onUpdateStreet({
      ...activeStreet,
      packages: updatedPackages,
      isCompleted: false,
    });

    confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
  };


  // Reopen / Reset package to pending
  const handleResetPackage = (pkgId: string) => {
    if (!activeStreet) return;
    const updatedPackages = activeStreet.packages.map((p) =>
      p.id === pkgId
        ? {
            ...p,
            status: 'pending' as const,
            deliveredTo: undefined,
            receiverCategory: undefined,
            receiverSubtype: undefined,
            receiverName: undefined,
            failureReason: undefined,
            deliveredAt: undefined,
          }
        : p
    );
    onUpdateStreet({
      ...activeStreet,
      packages: updatedPackages,
      isCompleted: false,
    });
  };

  // Delete Package
  const handleDeletePackage = (pkgId: string) => {
    if (!activeStreet) return;
    const updatedPackages = activeStreet.packages.filter((p) => p.id !== pkgId);
    onUpdateStreet({
      ...activeStreet,
      packages: updatedPackages,
    });
  };

  // Bulk Insert from LOTE modal
  const handleBulkInsertPackages = (lines: string[]) => {
    if (!activeStreet) return;
    const newPkgs: StreetPackage[] = lines.map((line, idx) => {
      const parts = line.split(/[-,;/]/).map((s) => s.trim());
      const house = parts[0] || `${idx + 1}`;
      const comp = parts[1] || undefined;
      const rec = parts[2] || undefined;

      // Save each to street memory
      saveAddressToStreetMemory(
        user.id,
        activeStreet.name,
        house,
        comp,
        rec
      );

      return {
        id: `pkg_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        houseNumber: house,
        complement: comp,
        recipientName: rec,
        status: 'pending' as const,
      };
    });

    onUpdateStreet({
      ...activeStreet,
      packages: [...activeStreet.packages, ...newPkgs],
      isCompleted: false,
    });
    setShowBatchModal(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 space-y-3 animate-fadeIn pb-24">
      {/* 1. Faixa de Atendimento & Seleção de Rua */}
      <div className="bg-slate-950 text-white p-3 sm:p-4 rounded-3xl border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0 border border-emerald-400/30">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              Rua em Atendimento:
            </span>
            <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
              {activeStreet ? activeStreet.name : 'Nenhuma rua cadastrada'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão Memória da Rua (Casas Salvas) */}
          {activeStreet && (
            <button
              type="button"
              onClick={() => setShowStreetMemoryModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-xs cursor-pointer active:scale-95"
              title="Abrir memória de casas e moradores desta rua"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-950" />
              <span>Casas Salvas ({savedStreetAddresses.length})</span>
            </button>
          )}

          {/* Trocar Rua Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setShowSwitchStreetSelect(!showSwitchStreetSelect)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all cursor-pointer"
            >
              <span>Trocar Rua</span>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
            </button>

            {showSwitchStreetSelect && (
              <div className="absolute right-0 mt-1 w-60 bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-fadeIn">
                <div className="text-[11px] font-bold text-slate-500 uppercase px-2 py-1 border-b border-slate-100">
                  Selecionar Rua Ativa:
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 mt-1">
                  {streets.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => {
                        setCurrentStreetId(st.id);
                        onSelectStreet(st);
                        setShowSwitchStreetSelect(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                        st.id === activeStreet?.id
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="truncate">{st.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 font-bold">
                        {st.packages.length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* + Rua Global Button */}
          <button
            onClick={() => {
              if (onOpenNewStreetModal) {
                onOpenNewStreetModal();
              }
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Rua</span>
          </button>
        </div>
      </div>

      {/* 2. Painel da Rua Selecionada & Carrossel */}
      {activeStreet && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3.5">
          {/* Street Header & 4 Numeric Indicators */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-900">{activeStreet.name}</h3>
                {activeStreet.isCompleted && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                    100% Concluída
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Entregador: <strong className="text-slate-800">{user.name}</strong>
              </p>
            </div>

            {/* 4 Blocos Numéricos com Valor em Dinheiro */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-center min-w-[65px]">
                <div className="text-sm font-black text-slate-900">{totalInStreet}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">Total</div>
              </div>

              <div className="px-3 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-center min-w-[65px]">
                <div className="text-sm font-black text-amber-700">{pendingInStreet}</div>
                <div className="text-[10px] font-bold text-amber-600 uppercase">Pendentes</div>
              </div>

              <div className="px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-center min-w-[65px]">
                <div className="text-sm font-black text-emerald-700">{deliveredInStreet}</div>
                <div className="text-[10px] font-bold text-emerald-600 uppercase">Entregas</div>
              </div>

              {/* Bloco de Dinheiro / Ganhos do Dia */}
              <div className="px-3.5 py-2 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-500 border border-yellow-300 text-slate-950 text-center min-w-[85px] shadow-xs">
                <div className="text-sm font-black tracking-tight">
                  R$ {(deliveredInStreet * 4.5).toFixed(2).replace('.', ',')}
                </div>
                <div className="text-[9px] font-black uppercase text-amber-950 flex items-center justify-center gap-0.5">
                  <Coins className="w-2.5 h-2.5" />
                  <span>Dinheiro</span>
                </div>
              </div>

              {failedInStreet > 0 && (
                <div className="px-3 py-2 rounded-2xl bg-red-50 border border-red-200 text-center min-w-[65px]">
                  <div className="text-sm font-black text-red-700">{failedInStreet}</div>
                  <div className="text-[10px] font-bold text-red-600 uppercase">Falhas</div>
                </div>
              )}
            </div>
          </div>

          {/* Carrossel de Ruas Cadastradas */}
          {streets.length > 1 && (
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {streets.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      setCurrentStreetId(st.id);
                      onSelectStreet(st);
                    }}
                    className={`shrink-0 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                      st.id === activeStreet.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{st.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                        st.id === activeStreet.id ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {st.packages.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Módulo de 'Cadastro Rápido (1 Toque)' (Seção Verde) */}
      {activeStreet && (
        <div className="bg-emerald-600 text-white p-4 sm:p-5 rounded-3xl shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <h3 className="font-black text-sm uppercase tracking-wide">
                Cadastro Rápido (1 Toque)
              </h3>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowStreetMemoryModal(true)}
                className="text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                title="Ver lista de casas e moradores já salvos nesta rua"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-950" />
                <span>Casas Salvas ({savedStreetAddresses.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1"
              >
                <List className="w-3.5 h-3.5" />
                <span>Lote</span>
              </button>
            </div>
          </div>

          {/* Form Inputs: Nº Casa, Compl., Morador, Mic, + Adicionar */}
          <form onSubmit={handleQuickAdd} className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              {/* Nº Casa */}
              <div className="sm:col-span-3">
                <input
                  type="text"
                  required
                  placeholder="Nº Casa *"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white text-slate-900 font-black text-sm placeholder-slate-400 outline-none border-2 border-transparent focus:border-amber-400 shadow-inner"
                  autoFocus
                />
              </div>

              {/* Complemento */}
              <div className="sm:col-span-4">
                <input
                  id="input-complement"
                  type="text"
                  placeholder="Compl. (Apto, Casa 2...)"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white text-slate-900 font-bold text-sm placeholder-slate-400 outline-none border-2 border-transparent focus:border-amber-400 shadow-inner"
                />
              </div>

              {/* Morador */}
              <div className="sm:col-span-3">
                <input
                  type="text"
                  placeholder="Morador (Opcional)"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white text-slate-900 font-bold text-sm placeholder-slate-400 outline-none border-2 border-transparent focus:border-amber-400 shadow-inner"
                />
              </div>

              {/* Mic & Botão Amarelo + Adicionar */}
              <div className="sm:col-span-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleVoiceRecognition}
                  className={`p-2.5 rounded-2xl font-black text-xs flex items-center justify-center transition-all cursor-pointer ${
                    isListeningVoice
                      ? 'bg-red-500 text-white animate-bounce ring-4 ring-white/50'
                      : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                  title="Falar número por voz"
                >
                  {isListeningVoice ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  type="submit"
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>

            {/* Pílulas de Sugestões de Endereços Salvos ao digitar número */}
            {suggestedSavedAddresses.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 animate-fadeIn">
                <span className="text-[10px] font-black uppercase text-amber-200 shrink-0 flex items-center gap-0.5">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  Salvos:
                </span>
                {suggestedSavedAddresses.slice(0, 5).map((s, idx) => (
                  <button
                    key={`${s.houseNumber}_${idx}_${s.residentName}`}
                    type="button"
                    onClick={() => {
                      setHouseNumber(s.houseNumber);
                      if (s.complement) setComplement(s.complement);
                      if (s.residentName) setRecipientName(s.residentName);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shrink-0 shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                    title="Clique para preencher número e morador"
                  >
                    <span>Nº {s.houseNumber}</span>
                    {s.complement && <span className="text-[10px] font-bold text-amber-900">({s.complement})</span>}
                    <span className="text-[11px] text-amber-950 font-bold">• {s.residentName}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Tags de Atalhos Rápidos */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] font-bold text-emerald-100 uppercase mr-1">
                Atalhos:
              </span>
              {SHORTCUT_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleShortcutTag(tag)}
                  className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-[11px] transition-all cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </form>
        </div>
      )}

      {/* 4. Filtros e Busca de Pacotes */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        {/* Barra de Pesquisa */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por Nº casa, morador ou pacote..."
            value={searchTerm}
            onChange={(e) => handleUpdateSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-2xl border border-slate-300 focus:border-emerald-600 outline-none text-xs font-bold text-slate-900"
          />
        </div>

        {/* Abas de Filtragem e Ordenação */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => handleUpdateFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({totalInStreet})
            </button>
            <button
              onClick={() => handleUpdateFilter('pending')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pendentes ({pendingInStreet})
            </button>
            <button
              onClick={() => handleUpdateFilter('delivered')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusFilter === 'delivered'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Entregas ({deliveredInStreet})
            </button>
            {failedInStreet > 0 && (
              <button
                onClick={() => handleUpdateFilter('failed')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  statusFilter === 'failed'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-red-700 hover:text-red-900'
                }`}
              >
                Insucessos ({failedInStreet})
              </button>
            )}
          </div>

          {/* Menu Ordenação */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700">
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600" />
            <select
              value={sortOrder}
              onChange={(e) => handleUpdateSort(e.target.value as any)}
              className="bg-transparent outline-none font-bold text-slate-900 cursor-pointer"
            >
              <option value="asc">Nº Casa: 1 – 100 (Subindo)</option>
              <option value="desc">Nº Casa: 100 – 1 (Descendo)</option>
              <option value="insertion">Ordem de Inserção</option>
            </select>
          </div>
        </div>

        {/* 5. Visões de Listagem: Agrupado vs Todos */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-2 text-xs font-black">
          <button
            onClick={() => handleUpdateViewMode('grouped')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl transition-all cursor-pointer ${
              viewMode === 'grouped'
                ? 'bg-slate-950 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Building2 className={`w-3.5 h-3.5 ${viewMode === 'grouped' ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span>Agrupado p/ Casas / Portaria ({multiPackageGroupsCount})</span>
            {multiPackageGroupsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] ml-1">
                {multiPackageGroupsCount} com +1 pacote
              </span>
            )}
          </button>

          <button
            onClick={() => handleUpdateViewMode('all')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl transition-all cursor-pointer ${
              viewMode === 'all'
                ? 'bg-slate-950 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className={`w-3.5 h-3.5 ${viewMode === 'all' ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span>Todos os Pacotes ({filteredPackages.length})</span>
          </button>
        </div>
      </div>

      {/* 5. Lista de Pacotes / Estado Vazio (Empty State) */}
      {filteredPackages.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-10 text-center border border-slate-200 shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Home className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-slate-900 text-base">
              Nenhum pacote cadastrado na rua
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Digite o número da casa acima na barra verde, use o cadastro em lote ou bipe com a câmera
              na <strong>{activeStreet?.name || 'sua rua'}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              onClick={() => setShowBatchModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-xs cursor-pointer"
            >
              Inserir Vários em Lote
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('input-complement');
                if (el) el.focus();
              }}
              className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-xs cursor-pointer"
            >
              + Formulário Completo
            </button>
            <button
              onClick={() => setShowScannerModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Camera className="w-4 h-4" />
              <span>Bipar com Câmera / OCR</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {viewMode === 'grouped' ? (
            /* Grouped View: Only houses with >1 package get the GroupedHouseCard, single packages remain standard */
            groupedPackageList.map(([houseNum, pkgs]) => {
              if (pkgs.length > 1) {
                return (
                  <GroupedHouseCard
                    key={houseNum}
                    houseNum={houseNum}
                    packages={pkgs}
                    user={user}
                    street={activeStreet!}
                    onDeliverPackage={(pkg) => setConfirmModalPkg(pkg)}
                    onDeliverAllInGroup={(hNum, pList) =>
                      setGroupPortariaModalData({ houseNum: hNum, packages: pList })
                    }
                    onFailPackage={(pkg) => handleOpenFailureModal(pkg)}
                    onResetPackage={(pkgId) => handleResetPackage(pkgId)}
                    onDeletePackage={(pkgId) => handleDeletePackage(pkgId)}
                    whatsappPhone={whatsappPhone}
                  />
                );
              }

              const singlePkg = pkgs[0];
              return (
                <PackageCardItem
                  key={singlePkg.id}
                  pkg={singlePkg}
                  user={user}
                  street={activeStreet!}
                  onDeliver={() => setConfirmModalPkg(singlePkg)}
                  onFail={() => handleOpenFailureModal(singlePkg)}
                  onReset={() => handleResetPackage(singlePkg.id)}
                  onDelete={() => handleDeletePackage(singlePkg.id)}
                  whatsappPhone={whatsappPhone}
                />
              );
            })
          ) : (
            /* Flat List of all packages */
            filteredPackages.map((pkg) => (
              <PackageCardItem
                key={pkg.id}
                pkg={pkg}
                user={user}
                street={activeStreet!}
                onDeliver={() => setConfirmModalPkg(pkg)}
                onFail={() => handleOpenFailureModal(pkg)}
                onReset={() => handleResetPackage(pkg.id)}
                onDelete={() => handleDeletePackage(pkg.id)}
                whatsappPhone={whatsappPhone}
              />
            ))
          )}
        </div>
      )}

      {/* 6. Barra de Ações Inferior (Fixa) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 shadow-lg">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-2.5">
          {/* LOTE (Laranja) */}
          <button
            onClick={() => setShowBatchModal(true)}
            className="py-3 px-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <List className="w-5 h-5" />
            <span>LOTE</span>
          </button>

          {/* MANUAL (Preto) */}
          <button
            onClick={() => {
              window.scrollTo({ top: 120, behavior: 'smooth' });
              const el = document.getElementById('input-complement');
              if (el) el.focus();
            }}
            className="py-3 px-2 rounded-2xl bg-slate-950 hover:bg-slate-900 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5 text-emerald-400" />
            <span>MANUAL</span>
          </button>

          {/* BIPAR (Verde) */}
          <button
            onClick={() => setShowScannerModal(true)}
            className="py-3 px-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Camera className="w-5 h-5" />
            <span>BIPAR</span>
          </button>
        </div>
      </div>

      {/* Delivery Confirmation Modal with Hierarchical Options */}
      {confirmModalPkg && activeStreet && (
        <DeliveryConfirmModal
          isOpen={!!confirmModalPkg}
          onClose={() => setConfirmModalPkg(null)}
          user={user}
          street={activeStreet}
          pkg={confirmModalPkg}
          defaultWhatsAppPhone={whatsappPhone}
          onConfirm={handleConfirmPackageDelivery}
        />
      )}

      {/* Group / Condominium / Portaria Delivery Modal */}
      {groupPortariaModalData && activeStreet && (
        <GroupPortariaConfirmModal
          isOpen={!!groupPortariaModalData}
          onClose={() => setGroupPortariaModalData(null)}
          user={user}
          street={activeStreet}
          houseNumber={groupPortariaModalData.houseNum}
          packages={groupPortariaModalData.packages}
          defaultWhatsAppPhone={whatsappPhone}
          onConfirmGroupDelivery={handleBatchDeliverGroup}
        />
      )}

      {/* Street Memory Modal (Caderno de Casas & Moradores Salvos) */}
      {showStreetMemoryModal && activeStreet && (
        <StreetMemoryModal
          isOpen={showStreetMemoryModal}
          onClose={() => setShowStreetMemoryModal(false)}
          user={user}
          street={activeStreet}
          onAddPackagesToStreet={(newPkgs) => {
            onUpdateStreet({
              ...activeStreet,
              packages: [...activeStreet.packages, ...newPkgs],
              isCompleted: false,
            });
          }}
        />
      )}

      {/* Money Reward Celebration Toast ("Dinheiro na Conta!") */}
      <MoneyCelebrationToast
        event={moneyToastEvent}
        onDismiss={() => setMoneyToastEvent(null)}
      />

      {/* Failure Reason Modal */}
      {failedModalPkg && activeStreet && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg">Registrar Insucesso</h3>
                <p className="text-xs text-red-100">
                  Nº {failedModalPkg.houseNumber}
                  {failedModalPkg.complement ? ` (${failedModalPkg.complement})` : ''} • {activeStreet.name}
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Selecione o Motivo:
                </label>
                <div className="space-y-2">
                  {Array.from(
                    new Set([
                      ...learnedReasons,
                      'Morador Ausente / Ninguém Atende',
                      'Endereço Não Localizado / Nº Inexistente',
                      'Encomenda Recusada pelo Morador',
                      'Sem Acesso ao Portão / Cão Bravo',
                    ])
                  )
                    .slice(0, 6)
                    .map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setFailReason(reason)}
                        className={`w-full p-3 rounded-2xl border-2 font-bold text-xs text-left cursor-pointer transition-all ${
                          failReason === reason
                            ? 'border-red-600 bg-red-50 text-red-900 shadow-xs'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Ou digite outro motivo:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Chuva forte, portão trancado..."
                  value={failReason}
                  onChange={(e) => setFailReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 font-bold text-xs text-slate-900 outline-none focus:border-red-600"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFailedModalPkg(null)}
                className="flex-1 py-3 px-4 rounded-2xl border border-slate-300 font-bold text-slate-700 text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmFailed}
                className="flex-1 py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm shadow-md cursor-pointer"
              >
                Salvar Insucesso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Insert Numbers Modal */}
      {showBatchModal && (
        <BatchNumbersModal
          isOpen={showBatchModal}
          onClose={() => setShowBatchModal(false)}
          streetName={activeStreet?.name || 'Rua'}
          onConfirm={handleBulkInsertPackages}
        />
      )}

      {/* Camera Barcode & AI OCR Scanner Modal */}
      {showScannerModal && activeStreet && (
        <ScannerModal
          isOpen={showScannerModal}
          onClose={() => setShowScannerModal(false)}
          streetName={activeStreet.name}
          onPackageScanned={handlePackageScanned}
        />
      )}
    </div>
  );
};


// Helper button to copy individual delivery or failure text
const CopyDeliveryButton: React.FC<{ userName: string; streetName: string; pkg: StreetPackage }> = ({
  userName,
  streetName,
  pkg,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text =
      pkg.status === 'failed'
        ? formatFailureWhatsAppMessage(userName, streetName, pkg)
        : formatDeliveryWhatsAppMessage(userName, streetName, pkg);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isFailed = pkg.status === 'failed';

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-2xs transition-all cursor-pointer ${
        copied
          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
          : isFailed
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
      }`}
      title="Copiar texto formatado"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{copied ? 'Copiado!' : isFailed ? 'Copiar Insucesso' : 'Copiar'}</span>
    </button>
  );
};

// Component for Individual Package Card
interface PackageCardItemProps {
  pkg: StreetPackage;
  user: UserProfile;
  street: UserStreet;
  onDeliver: () => void;
  onFail: () => void;
  onReset: () => void;
  onDelete: () => void;
  whatsappPhone?: string;
}

const PackageCardItem: React.FC<PackageCardItemProps> = ({
  pkg,
  user,
  street,
  onDeliver,
  onFail,
  onReset,
  onDelete,
  whatsappPhone,
}) => {
  const isDelivered = pkg.status === 'delivered';
  const isFailed = pkg.status === 'failed';

  return (
    <div
      className={`p-3.5 rounded-2xl border-2 transition-all flex flex-wrap items-center justify-between gap-3 ${
        isDelivered
          ? 'bg-emerald-50/70 border-emerald-300'
          : isFailed
          ? 'bg-red-50/70 border-red-300'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 ${
            isDelivered
              ? 'bg-emerald-600 text-white'
              : isFailed
              ? 'bg-red-600 text-white'
              : 'bg-slate-900 text-white'
          }`}
        >
          <span className="text-[9px] uppercase text-white/80 leading-none">Nº</span>
          <span className="text-xs font-black truncate max-w-[40px] text-center">
            {pkg.houseNumber}
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-black text-slate-900 text-sm truncate">
              {pkg.recipientName || 'Morador'}
            </h4>
            {pkg.complement && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                {pkg.complement}
              </span>
            )}

            {isDelivered && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Entregue
              </span>
            )}

            {isFailed && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-200 text-red-900 border border-red-300 flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                {pkg.failureReason || 'Ausente'}
              </span>
            )}
          </div>

          {isDelivered && pkg.deliveredTo && (
            <p className="text-xs text-emerald-800 font-bold mt-0.5">
              🤝 {pkg.deliveredTo}
            </p>
          )}

          {isFailed && (
            <p className="text-xs text-red-800 font-bold mt-0.5">
              ⚠️ {pkg.failureReason || 'Morador Ausente'}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {!isDelivered && !isFailed ? (
          <>
            <button
              onClick={onDeliver}
              className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Entregar</span>
            </button>

            <button
              onClick={onFail}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-all cursor-pointer"
              title="Registrar Ausente / Insucesso"
            >
              <XCircle className="w-4 h-4" />
              <span>Insucesso</span>
            </button>
          </>
        ) : (
          <>
            <CopyDeliveryButton
              userName={user.name}
              streetName={street.name}
              pkg={pkg}
            />
            <button
              onClick={() => {
                const message =
                  pkg.status === 'failed'
                    ? formatFailureWhatsAppMessage(user.name, street.name, pkg)
                    : formatDeliveryWhatsAppMessage(user.name, street.name, pkg);
                openWhatsApp(message, whatsappPhone);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-xs shadow-2xs cursor-pointer"
              title="Abrir no WhatsApp"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Zap</span>
            </button>
            <button
              onClick={onReset}
              className="p-1.5 rounded-xl border border-slate-300 text-slate-500 hover:bg-slate-100 cursor-pointer"
              title="Desfazer e voltar para pendente"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        <button
          onClick={onDelete}
          className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
          title="Excluir"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// Batch Numbers Input Modal
interface BatchNumbersModalProps {
  isOpen: boolean;
  onClose: () => void;
  streetName: string;
  onConfirm: (lines: string[]) => void;
}

const BatchNumbersModal: React.FC<BatchNumbersModalProps> = ({
  isOpen,
  onClose,
  streetName,
  onConfirm,
}) => {
  const [text, setText] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;
    onConfirm(lines);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 p-5">
          <h3 className="font-black text-lg flex items-center gap-2">
            <List className="w-5 h-5" />
            Inserir Vários Números em Lote
          </h3>
          <p className="text-xs font-bold text-amber-950/80">
            Adicionando na rua: <strong>{streetName}</strong>
          </p>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-600">
            Cole ou digite um número por linha. Você pode adicionar complemento e nome separados por
            vírgula ou hífen:
          </p>

          <div className="bg-slate-100 p-2.5 rounded-xl text-[11px] font-mono text-slate-700 space-y-0.5">
            <div>142 - Apto 302 - João Silva</div>
            <div>48 - Casa 2 - Maria</div>
            <div>560 - Fundos</div>
            <div>12</div>
          </div>

          <textarea
            rows={7}
            placeholder="142&#10;148 - Casa 2&#10;150 - Apto 101 - Carlos"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full p-3.5 rounded-2xl border border-slate-300 font-mono text-xs text-slate-900 outline-none focus:border-amber-500"
            autoFocus
          />
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
          >
            Adicionar à Rua
          </button>
        </div>
      </div>
    </div>
  );
};
