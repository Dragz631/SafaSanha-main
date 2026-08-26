import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Package, MapPin, Hash, User, Mic, MicOff, Check, ArrowRight, Tag } from 'lucide-react';
import { DeliveryData } from '../types';

interface ManualPackageModalProps {
  isOpen: boolean;
  activeStreet: string;
  initialDelivery?: DeliveryData | null;
  onClose: () => void;
  onSave: (delivery: DeliveryData) => void;
}

const COMMON_COMPLEMENT_SUGGESTIONS = [
  'Apto',
  'Bloco',
  'Casa 2',
  'Fundos',
  'Sobrado',
  'Loja',
  'Galpão',
  'Vila'
];

export const ManualPackageModal: React.FC<ManualPackageModalProps> = ({
  isOpen,
  activeStreet,
  initialDelivery,
  onClose,
  onSave,
}) => {
  const [houseNumber, setHouseNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [packageCode, setPackageCode] = useState('');
  const [street, setStreet] = useState(activeStreet || 'Rua Carlos Seidl');
  const [complement, setComplement] = useState('');
  const [keepOpenForNext, setKeepOpenForNext] = useState(true);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Voz (Web Speech API)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const numberInputRef = useRef<HTMLInputElement | null>(null);
  const complementInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialDelivery) {
        setHouseNumber(initialDelivery.numero_casa || initialDelivery.endereco_numero || '');
        setClientName(initialDelivery.nome_destinatario || initialDelivery.recebedor_detalhes || '');
        setPackageCode(initialDelivery.codigo_pacote || '');
        setStreet(initialDelivery.endereco_rua || initialDelivery.endereco_completo?.split(',')[0] || activeStreet);
        setComplement(initialDelivery.complemento || initialDelivery.endereco_complemento || '');
        setKeepOpenForNext(false);
      } else {
        setHouseNumber('');
        setClientName('');
        setPackageCode(`#${Math.floor(1000 + Math.random() * 9000)}`);
        setStreet(activeStreet || 'Rua Carlos Seidl');
        setComplement('');
        setKeepOpenForNext(true);
      }
      setSavedSuccessMsg(null);
      setTimeout(() => {
        numberInputRef.current?.focus();
      }, 100);
    }
  }, [initialDelivery, activeStreet, isOpen]);

  // Inicializa reconhecimento de voz
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        parseSpokenText(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert('Reconhecimento de voz não suportado neste navegador. Digite no teclado.');
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

  const parseSpokenText = (text: string) => {
    // Ex: "Casa 563 Diego Vicente" ou "Número 48 Kely apartamento 102"
    let working = text;
    let extractedComp = '';

    const compMatch = working.match(/(?:apto|apartamento|bloco|casa|fundos|loja)\s*[\d\w]+/i);
    if (compMatch) {
      extractedComp = compMatch[0];
      setComplement(extractedComp);
      working = working.replace(compMatch[0], '').trim();
    }

    const match = working.match(/(?:casa|número|numero)?\s*(\d+[a-zA-Z]?)\s*(.*)/i);
    if (match) {
      setHouseNumber(match[1]);
      if (match[2]?.trim()) {
        setClientName(match[2].trim());
      }
    } else {
      const nums = working.match(/\d+/);
      if (nums) {
        setHouseNumber(nums[0]);
      } else {
        setClientName(working);
      }
    }
  };

  const handleSuggestionClick = (sug: string) => {
    if (!complement) {
      setComplement(sug.endsWith(' ') ? sug : `${sug} `);
    } else if (!complement.toLowerCase().includes(sug.toLowerCase())) {
      setComplement(`${complement} ${sug} `);
    }
    complementInputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!houseNumber.trim() && !clientName.trim()) {
      alert('Informe o número da casa.');
      return;
    }

    const formattedCode = packageCode.trim().startsWith('#')
      ? packageCode.trim()
      : `#${packageCode.trim() || Math.floor(1000 + Math.random() * 9000)}`;

    const houseNum = houseNumber.trim() || 'S/N';
    const client = clientName.trim() || 'Morador';

    const delivery: DeliveryData = {
      id_entrega: initialDelivery?.id_entrega || `del_${Date.now()}`,
      codigo_pacote: formattedCode,
      nome_destinatario: client,
      recebedor_detalhes: client,
      recebedor_tipo: 'proprio_morador',
      endereco_rua: street.trim(),
      numero_casa: houseNum,
      endereco_numero: houseNum,
      endereco_completo: `${street.trim()}, ${houseNum}${complement.trim() ? ` (${complement.trim()})` : ''}`,
      complemento: complement.trim() || undefined,
      foto_pacote_path: initialDelivery?.foto_pacote_path || '',
      foto_local_path: initialDelivery?.foto_local_path || '',
      data_hora: initialDelivery?.data_hora || new Date().toISOString(),
      status: initialDelivery?.status || 'aguardando_rua',
      origem_leitura: 'manual',
    };

    onSave(delivery);

    if (keepOpenForNext && !initialDelivery) {
      setSavedSuccessMsg(`✅ Pacote salvo: Nº ${houseNum} ${complement.trim() ? `(${complement.trim()})` : ''} - ${client}`);
      setHouseNumber('');
      setClientName('');
      setComplement('');
      setPackageCode(`#${Math.floor(1000 + Math.random() * 9000)}`);
      numberInputRef.current?.focus();
      setTimeout(() => setSavedSuccessMsg(null), 2500);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] pb-safe">
        
        {/* Cabeçalho */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-sm text-white">
                {initialDelivery ? 'Editar Pacote' : 'Registrar Novo Pacote'}
              </h2>
              <p className="text-[11px] text-emerald-400 font-bold">{street}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback de sucesso contínuo */}
        {savedSuccessMsg && (
          <div className="bg-emerald-500 text-slate-950 px-4 py-2 text-xs font-black text-center animate-bounce">
            {savedSuccessMsg}
          </div>
        )}

        {/* Formulário Mobile */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          
          {/* Botão de Ditado por Voz */}
          <button
            type="button"
            onClick={toggleVoice}
            className={`w-full py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isListening
                ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {isListening ? (
              <>
                <Mic className="w-4 h-4 animate-bounce" />
                <span>Ouvindo... Fale: "Casa 563 Diego Apto 101"</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-emerald-600" />
                <span>Falar por Voz (Ex: "563 Diego Apto 2")</span>
              </>
            )}
          </button>

          {/* Número da Casa com destaque GIGANTE */}
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
              🏠 Número da Casa *
            </label>
            <input
              ref={numberInputRef}
              type="text"
              inputMode="numeric"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              placeholder="Ex: 563"
              className="w-full px-4 py-3 bg-slate-50 border-2 border-emerald-500 focus:border-emerald-600 rounded-2xl text-2xl font-black text-slate-900 focus:outline-none placeholder-slate-400 text-center tracking-wider"
              autoFocus
              required
            />
          </div>

          {/* BARRA DE TEXTO DEDICADA PARA COMPLEMENTO DO ENDEREÇO */}
          <div className="space-y-1 bg-amber-50/60 p-2.5 rounded-2xl border border-amber-200/80">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-amber-950 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                <span>Complemento do Endereço (Barra de Texto):</span>
              </label>
              <span className="text-[9px] font-bold text-amber-700 bg-amber-200/60 px-1.5 py-0.2 rounded">
                Opcional
              </span>
            </div>
            
            <input
              ref={complementInputRef}
              type="text"
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
              placeholder="Ex: Apto 302, Bloco B, Casa 2, Fundos, Loja..."
              className="w-full px-3 py-2 bg-white border-2 border-amber-300 focus:border-amber-500 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none shadow-xs"
            />

            {/* Sugestões Rápidas de Complemento */}
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <span className="text-[10px] font-bold text-amber-800 mr-0.5">Sugestões:</span>
              {COMMON_COMPLEMENT_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleSuggestionClick(sug)}
                  className="px-2 py-0.8 bg-white hover:bg-amber-100/80 text-slate-700 border border-amber-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                >
                  +{sug}
                </button>
              ))}
            </div>
          </div>

          {/* Nome do Destinatário */}
          <div>
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">
              👤 Nome do Cliente / Morador (Opcional)
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: Diego Vicente, Kely Marinho"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none placeholder-slate-400"
            />
          </div>

          {/* Código do Pacote */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              📦 Código do Pacote / Rastreio
            </label>
            <input
              type="text"
              value={packageCode}
              onChange={(e) => setPackageCode(e.target.value)}
              placeholder="Ex: #0003"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
            />
          </div>

          {/* Checkbox de cadastro contínuo sem fechar modal */}
          {!initialDelivery && (
            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepOpenForNext}
                onChange={(e) => setKeepOpenForNext(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs font-bold text-slate-700">
                ⚡ Continuar cadastrando o próximo pacote
              </span>
            </label>
          )}

          {/* Botões */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer"
            >
              {initialDelivery ? 'Cancelar' : 'Finalizar'}
            </button>
            <button
              type="submit"
              className="flex-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{initialDelivery ? 'Salvar Alterações' : 'Salvar Pacote (Enter)'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
