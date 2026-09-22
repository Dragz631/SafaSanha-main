import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users,
  Plus,
  Share2,
  Copy,
  Check,
  Trash2,
  Mic,
  ListPlus,
  Sparkles,
  Home,
  CheckCircle2,
  Building,
  UserCheck
} from 'lucide-react';
import {
  buildAssociationWhatsAppMessage,
  shareOrOpenWhatsApp,
  copyTextToClipboard,
  getFormattedCurrentDate,
  getFormattedCurrentTime
} from '../utils/whatsappHelper';

interface AssociationItem {
  id: string;
  name: string;
  count: number;
  codes?: string[];
}

const STORAGE_KEY = 'logiscan_association_list_v2';
const ASSOC_NAME_KEY = 'logiscan_assoc_name_v2';

/** Lista fictícia que a versão anterior injetava (nomes/códigos fixos). Só é descartada se for EXATAMENTE ela. */
const NOMES_DEMO = ['Diego Vicente', 'Maria de Lourdes', 'Rafael Santos'];
const CODIGOS_DEMO = ['#1021,#1025', '#1022', '#1023,#1024,#1026'];
function ehListaDemo(lista: Array<{ name?: string; codes?: string[] }>): boolean {
  return (
    lista.length === NOMES_DEMO.length &&
    lista.every((it, i) => it.name === NOMES_DEMO[i] && (it.codes ?? []).join(',') === CODIGOS_DEMO[i])
  );
}

export const AssociationTab: React.FC = () => {
  const [associationName, setAssociationName] = useState<string>(() => {
    try {
      return localStorage.getItem(ASSOC_NAME_KEY) || 'Associação de Moradores';
    } catch (_e) {
      return 'Associação de Moradores';
    }
  });

  const [responsavelName, setResponsavelName] = useState<string>('Responsável da Associação');

  // Itens da associação
  const [items, setItems] = useState<AssociationItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // A versão antiga gravava uma lista de demonstração no primeiro uso; ela não é dado real.
        if (Array.isArray(parsed)) return ehListaDemo(parsed) ? [] : parsed;
      }
    } catch (_e) {}
    return [];
  });

  // Salva no LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (_e) {}
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(ASSOC_NAME_KEY, associationName);
    } catch (_e) {}
  }, [associationName]);

  // Input rápido
  const [inputName, setInputName] = useState<string>('');
  const [isBatchOpen, setIsBatchOpen] = useState<boolean>(false);
  const [batchText, setBatchText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reconhecimento de Voz
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'pt-BR';
      rec.continuous = false;
      rec.interimResults = false;

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          addOrIncrementName(transcript.trim());
        }
        setIsListening(false);
      };

      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert('Voz não suportada neste navegador.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (_e) {
        setIsListening(false);
      }
    }
  };

  /**
   * Adiciona ou AGRUPA nome automaticamente caso já exista
   */
  const addOrIncrementName = (rawName: string) => {
    const clean = rawName.trim();
    if (!clean) return;

    // Normaliza para comparar (ex: "diego vicente")
    const lower = clean.toLowerCase();

    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.name.toLowerCase() === lower);
      if (existingIndex >= 0) {
        // Se já existe, AGRUPA e incrementa a quantidade de pacotes desse mesmo nome
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          count: updated[existingIndex].count + 1,
        };
        return updated;
      } else {
        // Adiciona novo nome
        return [
          ...prev,
          {
            id: `assoc_${Date.now()}_${Math.random()}`,
            name: clean,
            count: 1,
          },
        ];
      }
    });

    setInputName('');
    inputRef.current?.focus();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) {
      addOrIncrementName(inputName);
    }
  };

  const handleBatchAdd = () => {
    if (!batchText.trim()) return;
    const lines = batchText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    lines.forEach((name) => {
      addOrIncrementName(name);
    });

    setBatchText('');
    setIsBatchOpen(false);
  };

  const handleIncrement = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, count: it.count + 1 } : it))
    );
  };

  const handleDecrement = (id: string) => {
    setItems((prev) =>
      prev
        .map((it) => (it.id === id ? { ...it, count: it.count - 1 } : it))
        .filter((it) => it.count > 0)
    );
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleClearAll = () => {
    if (window.confirm('Limpar toda a lista da associação para começar uma nova?')) {
      setItems([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const totalPackages = items.reduce((acc, it) => acc + it.count, 0);
  const totalNames = items.length;

  const currentMessage = useMemo(() => {
    return buildAssociationWhatsAppMessage(associationName, items, {
      responsavel: responsavelName,
    });
  }, [associationName, items, responsavelName]);

  const handleShareWhatsApp = async () => {
    const res = await shareOrOpenWhatsApp(currentMessage);
    if (res.method === 'share') {
      setShareFeedback('Abrindo WhatsApp...');
    } else if (res.method === 'whatsapp') {
      setShareFeedback('Abrindo WhatsApp com a lista de nomes...');
    } else {
      setShareFeedback('Lista copiada para a área de transferência!');
    }
    setTimeout(() => setShareFeedback(null), 3000);
  };

  const handleCopyList = async () => {
    const ok = await copyTextToClipboard(currentMessage);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-3.5 pt-3 pb-24 space-y-3.5">
      
      {/* 1. CABEÇALHO DA ASSOCIAÇÃO */}
      <div className="bg-gradient-to-r from-teal-700 to-emerald-800 text-white rounded-3xl p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white leading-tight">
                Modo Associação (Lista de Nomes)
              </h2>
              <p className="text-[11px] text-teal-100">
                Agrupamento automático por nome para a responsável
              </p>
            </div>
          </div>

          <div className="text-right bg-white/15 px-2.5 py-1 rounded-xl border border-white/20">
            <span className="text-base font-black text-amber-300 block leading-none">
              {totalPackages} pacotes
            </span>
            <span className="text-[9px] uppercase tracking-wider text-teal-100 font-bold">
              {totalNames} nomes
            </span>
          </div>
        </div>

        {/* Inputs de Configuração da Associação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-[10px] font-bold text-teal-200 block mb-0.5">
              Nome do Local / Associação:
            </label>
            <input
              type="text"
              value={associationName}
              onChange={(e) => setAssociationName(e.target.value)}
              placeholder="Ex: Associação do Cremate"
              className="w-full px-2.5 py-1.5 bg-white/90 focus:bg-white text-slate-900 font-bold text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-teal-200 block mb-0.5">
              A/C Responsável:
            </label>
            <input
              type="text"
              value={responsavelName}
              onChange={(e) => setResponsavelName(e.target.value)}
              placeholder="Ex: Dona Maria / Mulher da Associação"
              className="w-full px-2.5 py-1.5 bg-white/90 focus:bg-white text-slate-900 font-bold text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
        </div>
      </div>

      {/* 2. ENTRADA RÁPIDA DE NOMES (COM AGRUPAMENTO AUTOMÁTICO) */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>Adicionar Nome (Agrupa nomes iguais automaticamente)</span>
          </label>

          <button
            type="button"
            onClick={() => setIsBatchOpen(!isBatchOpen)}
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200"
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>{isBatchOpen ? 'Fechar Lote' : 'Colar Vários'}</span>
          </button>
        </div>

        {/* Formulário Rápido */}
        <form onSubmit={handleFormSubmit} className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            placeholder="Digite o nome do morador (ex: Diego Vicente)..."
            className="flex-1 px-3 py-2.5 bg-slate-50 border-2 border-emerald-400 rounded-xl text-xs font-black text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
          />

          <button
            type="button"
            onClick={toggleVoice}
            className={`p-2.5 rounded-xl text-white cursor-pointer transition-all ${
              isListening ? 'bg-rose-500 animate-pulse' : 'bg-slate-800 hover:bg-slate-700'
            }`}
            title="Ditar nome por voz"
          >
            <Mic className="w-4 h-4" />
          </button>

          <button
            type="submit"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-sm cursor-pointer shrink-0 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar</span>
          </button>
        </form>

        {/* Modal / Área de Colar Vários Nomes em Lote */}
        {isBatchOpen && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 animate-fadeIn text-xs">
            <p className="font-extrabold text-slate-700 text-[11px]">
              Cole os nomes dos moradores (separados por vírgula ou uma linha por nome):
            </p>
            <textarea
              rows={3}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder="Exemplo:&#10;Diego Vicente&#10;Maria Silva&#10;Diego Vicente&#10;Rafael Santos"
              className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 text-xs focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleBatchAdd}
              className="w-full py-2 bg-emerald-600 text-white font-black text-xs rounded-lg shadow-xs cursor-pointer hover:bg-emerald-500"
            >
              Processar e Agrupar Todos os Nomes
            </button>
          </div>
        )}
      </div>

      {/* 3. LISTA DE NOMES DA ASSOCIAÇÃO COM AGRUPAMENTO */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Relação de Destinatários ({totalNames})</span>
          </h3>

          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Lista</span>
            </button>
          )}
        </div>

        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div
                key={it.id}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2 transition-all hover:bg-white"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>

                  <div className="min-w-0">
                    <span className="font-black text-xs sm:text-sm text-slate-900 block truncate">
                      {it.name}
                    </span>
                    {it.count > 1 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-md mt-0.5">
                        📦 {it.count} pacotes agrupados
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500">
                        1 pacote
                      </span>
                    )}
                  </div>
                </div>

                {/* Controles de Quantidade (+ / -) e Excluir */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleDecrement(it.id)}
                    className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-xs flex items-center justify-center cursor-pointer"
                    title="Diminuir pacotes"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-black text-xs text-slate-900">
                    {it.count}
                  </span>
                  <button
                    onClick={() => handleIncrement(it.id)}
                    className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-black text-xs flex items-center justify-center cursor-pointer"
                    title="Aumentar pacotes deste morador"
                  >
                    +
                  </button>
                  <button
                    onClick={() => handleDelete(it.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer ml-1"
                    title="Remover morador da lista"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 space-y-1">
            <p className="text-xs font-bold">Nenhum nome cadastrado na lista.</p>
            <p className="text-[11px]">Digite os nomes acima para gerar a lista da associação.</p>
          </div>
        )}
      </div>

      {/* 4. PREVIEW DO ZAP & BOTÃO PRINCIPAL DE ENVIO */}
      {items.length > 0 && (
        <div className="border-2 rounded-2xl p-3.5 bg-emerald-50/70 border-emerald-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 border text-emerald-800 bg-emerald-100 border-emerald-300">
              <Sparkles className="w-3 h-3" />
              Mensagem Pronta para a Mulher da Associação
            </span>

            <button
              onClick={handleCopyList}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-xs'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>

          <div className="bg-white rounded-xl p-3 border border-slate-200 font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap select-all shadow-xs max-h-48 overflow-y-auto">
            {currentMessage}
          </div>

          {shareFeedback && (
            <div className="p-2 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-center text-xs font-bold animate-pulse">
              {shareFeedback}
            </div>
          )}

          <button
            onClick={handleShareWhatsApp}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Share2 className="w-5 h-5 text-white" />
            <span>📲 Enviar Lista para a Mulher da Associação ({totalPackages} pacotes)</span>
          </button>
        </div>
      )}

    </div>
  );
};
