import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Users, Plus, Share2, Copy, Check, Trash2, Mic, ListPlus, Building, Minus } from 'lucide-react';
import {
  buildAssociationWhatsAppMessage,
  shareOrOpenWhatsApp,
  copyTextToClipboard,
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
      return localStorage.getItem(ASSOC_NAME_KEY) || '';
    } catch (_e) {
      return '';
    }
  });

  const [responsavelName, setResponsavelName] = useState<string>('');
  const [showConfig, setShowConfig] = useState(false);

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

  /** Adiciona ou AGRUPA nome automaticamente caso já exista */
  const addOrIncrementName = (rawName: string) => {
    const clean = rawName.trim();
    if (!clean) return;
    const lower = clean.toLowerCase();

    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.name.toLowerCase() === lower);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], count: updated[existingIndex].count + 1 };
        return updated;
      }
      return [...prev, { id: `assoc_${Date.now()}_${Math.random()}`, name: clean, count: 1 }];
    });

    setInputName('');
    inputRef.current?.focus();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) addOrIncrementName(inputName);
  };

  const handleBatchAdd = () => {
    if (!batchText.trim()) return;
    batchText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((name) => addOrIncrementName(name));
    setBatchText('');
    setIsBatchOpen(false);
  };

  const handleIncrement = (id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, count: it.count + 1 } : it)));
  };

  const handleDecrement = (id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, count: it.count - 1 } : it)).filter((it) => it.count > 0));
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
    return buildAssociationWhatsAppMessage(associationName || 'Associação de Moradores', items, {
      responsavel: responsavelName || undefined,
    });
  }, [associationName, items, responsavelName]);

  const handleShareWhatsApp = async () => {
    const res = await shareOrOpenWhatsApp(currentMessage);
    if (res.method === 'share') setShareFeedback('Abrindo WhatsApp...');
    else if (res.method === 'whatsapp') setShareFeedback('Abrindo WhatsApp com a lista de nomes...');
    else setShareFeedback('Lista copiada para a área de transferência!');
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
    <div className="space-y-3 pb-24">
      {/* 1. CABEÇALHO — mesma linguagem visual do painel de controle das Ruas */}
      <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80 shadow-md space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black shrink-0 shadow-sm border bg-amber-400/20 text-amber-300 border-amber-400/30">
              <Building className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Associação de Moradores
              </span>
              <h1 className="text-lg font-black text-slate-100 leading-snug tracking-tight truncate">
                {associationName || 'Nome não definido'}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowConfig((v) => !v)}
            className="h-10 px-3 bg-slate-800 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all active:scale-95 touch-manipulation"
          >
            {showConfig ? 'Ocultar' : 'Editar'}
          </button>
        </div>

        {/* Métricas compactas, no mesmo estilo da barra de progresso da rua */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-extrabold text-slate-100">{totalNames}</span>
            <span>{totalNames === 1 ? 'destinatário' : 'destinatários'}</span>
          </div>
          <div className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-slate-700/50">
            {totalPackages} {totalPackages === 1 ? 'pacote' : 'pacotes'}
          </div>
        </div>

        {showConfig && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-fadeIn">
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Nome do Local / Associação</label>
              <input
                type="text"
                value={associationName}
                onChange={(e) => setAssociationName(e.target.value)}
                placeholder="Ex: Associação do Cremate"
                className="w-full h-10 px-3 bg-slate-950 text-white placeholder-slate-500 border border-slate-700/80 rounded-xl text-xs font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">A/C Responsável</label>
              <input
                type="text"
                value={responsavelName}
                onChange={(e) => setResponsavelName(e.target.value)}
                placeholder="Ex: Dona Maria"
                className="w-full h-10 px-3 bg-slate-950 text-white placeholder-slate-500 border border-slate-700/80 rounded-xl text-xs font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. ENTRADA RÁPIDA DE NOMES (COM AGRUPAMENTO AUTOMÁTICO) */}
      <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl p-3.5 border border-slate-800/90 shadow-md space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black tracking-wide text-slate-200">Adicionar Morador</span>
          <button
            type="button"
            onClick={() => setIsBatchOpen(!isBatchOpen)}
            className="h-8 px-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all border border-slate-700/70"
          >
            <ListPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>{isBatchOpen ? 'Fechar Lote' : 'Colar Vários'}</span>
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            placeholder="Nome do morador (ex: Diego Vicente)"
            className="flex-1 h-12 px-3.5 bg-slate-950 text-white placeholder-slate-500 border border-slate-700/80 rounded-xl text-sm font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={toggleVoice}
            className={`w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all shrink-0 ${
              isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/80'
            }`}
            title="Ditar nome por voz"
          >
            <Mic className="w-5 h-5" />
          </button>
          <button
            type="submit"
            className="h-12 px-5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-sm rounded-xl shadow-md cursor-pointer shrink-0 flex items-center gap-1.5 transition-all touch-manipulation"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>Add</span>
          </button>
        </form>

        {isBatchOpen && (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2 animate-fadeIn">
            <p className="text-[11px] font-bold text-slate-400">
              Cole os nomes dos moradores (um por linha ou separados por vírgula):
            </p>
            <textarea
              rows={3}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={'Diego Vicente\nMaria Silva\nRafael Santos'}
              className="w-full p-2.5 bg-slate-950 text-white placeholder-slate-500 border border-slate-700/80 rounded-lg font-bold text-xs focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleBatchAdd}
              className="w-full h-10 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-lg cursor-pointer"
            >
              Processar e Agrupar Todos os Nomes
            </button>
          </div>
        )}
      </div>

      {/* 3. LISTA DE NOMES DA ASSOCIAÇÃO */}
      <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl p-3.5 border border-slate-800/80 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-xs text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-400" />
            <span>Relação ({totalNames})</span>
          </h3>
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          )}
        </div>

        {items.length > 0 ? (
          <div className="space-y-1.5">
            {items.map((it) => (
              <div
                key={it.id}
                className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="font-black text-sm text-slate-100 block truncate">{it.name}</span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {it.count} {it.count === 1 ? 'pacote' : 'pacotes'}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleDecrement(it.id)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-black flex items-center justify-center cursor-pointer touch-manipulation"
                    title="Diminuir pacotes"
                    aria-label="Diminuir pacotes"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center font-black text-sm text-slate-100">{it.count}</span>
                  <button
                    onClick={() => handleIncrement(it.id)}
                    className="w-8 h-8 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-black flex items-center justify-center cursor-pointer touch-manipulation"
                    title="Aumentar pacotes"
                    aria-label="Aumentar pacotes"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(it.id)}
                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 cursor-pointer touch-manipulation ml-0.5"
                    title="Remover morador"
                    aria-label="Remover morador"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 space-y-1">
            <p className="text-xs font-bold text-slate-400">Nenhum nome cadastrado na lista.</p>
            <p className="text-[11px] text-slate-500">Digite os nomes acima para gerar a lista da associação.</p>
          </div>
        )}
      </div>

      {/* 4. PREVIEW DO ZAP & BOTÃO PRINCIPAL DE ENVIO */}
      {items.length > 0 && (
        <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl p-3.5 border border-slate-800/80 shadow-md space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Texto que será gerado
            </span>
            <button
              onClick={handleCopyList}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer touch-manipulation ${
                copied ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700/60'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>

          <pre className="font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800 select-all max-h-48 overflow-y-auto">
            {currentMessage}
          </pre>

          {shareFeedback && (
            <div className="p-2 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-xl text-center text-xs font-bold animate-fadeIn">
              {shareFeedback}
            </div>
          )}

          <button
            onClick={handleShareWhatsApp}
            className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation"
          >
            <Share2 className="w-5 h-5" />
            <span>Enviar Lista ({totalPackages} pacotes)</span>
          </button>
        </div>
      )}
    </div>
  );
};
