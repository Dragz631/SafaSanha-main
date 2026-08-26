import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  X,
  FlipHorizontal,
  Zap,
  CheckCircle2,
  AlertCircle,
  Plus,
  Package,
  MapPin,
  Sparkles,
  Upload,
  Loader2,
  Image as ImageIcon,
  Mic,
  ArrowRight
} from 'lucide-react';
import { DeliveryData } from '../types';

interface QuickPackageScannerModalProps {
  isOpen: boolean;
  activeStreet: string;
  onClose: () => void;
  onPackageScanned?: (delivery: DeliveryData) => void;
  onSavePackage?: (delivery: DeliveryData) => void;
}

export const QuickPackageScannerModal: React.FC<QuickPackageScannerModalProps> = ({
  isOpen,
  activeStreet,
  onClose,
  onPackageScanned,
  onSavePackage,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const numberInputRef = useRef<HTMLInputElement | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  
  // Dados do formulário
  const [scannedCode, setScannedCode] = useState<string>('');
  const [houseNumber, setHouseNumber] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [complement, setComplement] = useState<string>('');
  const [lockComplementForBatch, setLockComplementForBatch] = useState<boolean>(false);
  const [street, setStreet] = useState<string>(activeStreet || 'Rua Carlos Seidl');

  const [isReadingLabel, setIsReadingLabel] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Voz
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  const isScanningRef = useRef<boolean>(false);
  const saveCallback = onPackageScanned || onSavePackage;

  useEffect(() => {
    if (isOpen) {
      setStreet(activeStreet || 'Rua Carlos Seidl');
      setScannedCode(`#${Math.floor(1000 + Math.random() * 9000)}`);
      setHouseNumber('');
      setClientName('');
      setComplement('');
      setSuccessToast(null);
      startCamera();
      setTimeout(() => {
        numberInputRef.current?.focus();
      }, 300);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [facingMode, isOpen, activeStreet]);

  // Reconhecimento de voz
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const match = transcript.match(/(?:casa|número|numero)?\s*(\d+[a-zA-Z]?)\s*(.*)/i);
        if (match) {
          setHouseNumber(match[1]);
          if (match[2]?.trim()) setClientName(match[2].trim());
        } else {
          const nums = transcript.match(/\d+/);
          if (nums) setHouseNumber(nums[0]);
          else setClientName(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert('Voz não suportada neste dispositivo.');
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

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCamera(false);
        setCameraError('Câmera não suportada neste dispositivo.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setHasCamera(true);
        isScanningRef.current = true;
        scanLoop();
      }
    } catch (err: any) {
      console.warn('Erro ao abrir câmera:', err);
      setHasCamera(false);
      setCameraError('Permissão da câmera negada ou câmera ocupada.');
    }
  };

  const stopCamera = () => {
    isScanningRef.current = false;
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Loop contínuo de detecção de código de barras
  const scanLoop = async () => {
    if (!isScanningRef.current) return;

    if (
      'BarcodeDetector' in window &&
      videoRef.current &&
      videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
    ) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'itf', 'data_matrix'],
        });
        const barcodes = await barcodeDetector.detect(videoRef.current);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          const raw = barcodes[0].rawValue.trim();
          if (raw && isScanningRef.current) {
            handleBarcodeFound(raw);
          }
        }
      } catch (_e) {}
    }

    if (isScanningRef.current) {
      requestAnimationFrame(scanLoop);
    }
  };

  const handleBarcodeFound = (code: string) => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(80);
      }
    } catch (_e) {}

    const cleanCode = code.length > 4 ? `#${code.slice(-4)}` : `#${code}`;
    setScannedCode(cleanCode);
  };

  // Captura o frame da câmera ou arquivo e extrai via IA
  const handleCaptureAndReadAI = async (base64Image?: string) => {
    let imageToProcess = base64Image;

    if (!imageToProcess) {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      imageToProcess = canvas.toDataURL('image/jpeg', 0.85);
    }

    setIsReadingLabel(true);
    setSuccessToast(null);

    try {
      const res = await fetch('/api/ocr-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageToProcess,
          knownCode: scannedCode.replace('#', ''),
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const { nome_destinatario, numero_casa, codigo_pacote, complemento: comp } = json.data;

        if (nome_destinatario) setClientName(nome_destinatario);
        if (numero_casa) setHouseNumber(numero_casa);
        if (comp) setComplement(comp);
        if (codigo_pacote) {
          setScannedCode(codigo_pacote.startsWith('#') ? codigo_pacote : `#${codigo_pacote.slice(-4)}`);
        }

        try {
          if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
        } catch (_e) {}

        setSuccessToast(
          `Etiqueta: Nº ${numero_casa || 'S/N'}${nome_destinatario ? ` • ${nome_destinatario}` : ''}`
        );
      } else {
        setSuccessToast('Etiqueta lida. Verifique o número abaixo.');
      }
    } catch (err) {
      console.warn('Erro OCR:', err);
    } finally {
      setIsReadingLabel(false);
      setTimeout(() => setSuccessToast(null), 3000);
    }
  };

  // Upload de foto da galeria
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        handleCaptureAndReadAI(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Salva o pacote instantaneamente
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!houseNumber.trim()) {
      alert('Por favor, digite o número da casa.');
      return;
    }

    const code = scannedCode.trim() || `#${Math.floor(1000 + Math.random() * 9000)}`;
    const houseNum = houseNumber.trim() || 'S/N';
    const client = clientName.trim() || 'Morador';

    const newDelivery: DeliveryData = {
      id_entrega: `del_${Date.now()}`,
      codigo_pacote: code,
      nome_destinatario: client,
      recebedor_detalhes: client,
      recebedor_tipo: 'proprio_morador',
      endereco_rua: street.trim(),
      numero_casa: houseNum,
      endereco_numero: houseNum,
      complemento: complement.trim(),
      endereco_completo: `${street.trim()}, ${houseNum}${complement.trim() ? ` (${complement.trim()})` : ''}`,
      foto_pacote_path: '',
      foto_local_path: '',
      data_hora: new Date().toISOString(),
      status: 'aguardando_rua',
      origem_leitura: 'manual',
    };

    if (saveCallback) {
      saveCallback(newDelivery);
    }

    try {
      if ('vibrate' in navigator) navigator.vibrate(50);
    } catch (_e) {}

    setSuccessToast(`✅ Pacote salvo: Nº ${houseNum} (${client})!`);

    // Limpa campos para o próximo pacote imediatamente
    setScannedCode(`#${Math.floor(1000 + Math.random() * 9000)}`);
    setHouseNumber('');
    setClientName('');
    // Se não estiver travado para lote, limpa o complemento
    if (!lockComplementForBatch) {
      setComplement('');
    }
    numberInputRef.current?.focus();

    setTimeout(() => {
      setSuccessToast(null);
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xs flex flex-col justify-between animate-fadeIn pb-safe">
      
      {/* Topo / Header da Câmera */}
      <div className="bg-slate-900 text-white p-3 flex items-center justify-between z-10 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-black text-sm text-white">Leitor & Entrada Rápida</h2>
            <p className="text-[10px] text-emerald-400 font-bold">{street}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Botão de Voz */}
          <button
            type="button"
            onClick={toggleVoice}
            className={`p-2 rounded-xl text-slate-200 cursor-pointer ${
              isListening ? 'bg-rose-600 animate-pulse' : 'bg-slate-800 hover:bg-slate-700'
            }`}
            title="Falar por voz"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Botão de Galeria */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            title="Carregar foto da galeria"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          {hasCamera && (
            <button
              type="button"
              onClick={handleFlipCamera}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              title="Inverter Câmera"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Visor da Câmera com Enquadramento */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[160px]">
        {hasCamera ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover opacity-80"
            playsInline
            muted
          />
        ) : (
          <div className="p-4 text-center text-slate-400 space-y-1">
            <AlertCircle className="w-8 h-8 mx-auto text-amber-400" />
            <p className="text-xs font-bold">Digite o número da casa no teclado abaixo.</p>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        {/* Retângulo de Enquadramento */}
        {hasCamera && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
            <div className="w-64 h-32 border-2 border-emerald-400/80 rounded-2xl relative shadow-lg">
              <div className="absolute -top-1 -left-1 w-3 h-3 border-t-3 border-l-3 border-emerald-400" />
              <div className="absolute -top-1 -right-1 w-3 h-3 border-t-3 border-r-3 border-emerald-400" />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-3 border-l-3 border-emerald-400" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-3 border-r-3 border-emerald-400" />
              
              <span className="absolute bottom-1 inset-x-0 text-center text-[10px] font-black text-emerald-300 drop-shadow">
                Auto-leitor de código ativo
              </span>
            </div>
          </div>
        )}

        {/* Botão de IA opcional se quiser tentar */}
        {hasCamera && (
          <div className="absolute bottom-2 right-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => handleCaptureAndReadAI()}
              disabled={isReadingLabel}
              className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-[11px] rounded-full shadow-lg flex items-center gap-1.5 cursor-pointer border border-white"
            >
              {isReadingLabel ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Lendo...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                  <span>Ler Foto com IA</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Toast Flutuante de Sucesso */}
        {successToast && (
          <div className="absolute top-3 bg-emerald-500 text-slate-950 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-lg flex items-center gap-1.5 animate-bounce z-20">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successToast}</span>
          </div>
        )}
      </div>

      {/* PAINEL INFERIOR DE DIGITAÇÃO SUPER INTUITIVA */}
      <div className="bg-white p-3.5 border-t border-slate-200 z-10 space-y-2.5">
        <form onSubmit={handleSave} className="space-y-2">
          
          <div className="grid grid-cols-3 gap-2 items-center">
            {/* Número da Casa - ENTRADA PRINCIPAL GIGANTE */}
            <div className="col-span-1">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-0.5">
                🏠 Nº Casa *
              </label>
              <input
                ref={numberInputRef}
                type="text"
                inputMode="numeric"
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value)}
                placeholder="563"
                className="w-full px-2 py-2 bg-slate-50 border-2 border-emerald-500 focus:border-emerald-600 rounded-xl text-xl font-black text-slate-900 focus:outline-none text-center"
                required
                autoFocus
              />
            </div>

            {/* Nome do Destinatário */}
            <div className="col-span-2">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-0.5">
                👤 Nome do Destinatário (Opcional)
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Diego Vicente"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* BARRA DE TEXTO DEDICADA PARA COMPLEMENTO DO ENDEREÇO COM FIXAÇÃO PARA LOTE */}
          <div className="space-y-1 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200">
            <div className="flex items-center justify-between gap-1">
              <label className="text-[10px] font-black text-amber-950 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-600" />
                <span>Complemento do Endereço:</span>
              </label>

              {/* Botão de Travar Complemento para Bipagem em Lote */}
              <button
                type="button"
                onClick={() => setLockComplementForBatch(!lockComplementForBatch)}
                className={`px-2 py-0.5 rounded-md text-[9px] font-black flex items-center gap-1 cursor-pointer transition-all ${
                  lockComplementForBatch
                    ? 'bg-amber-500 text-slate-950 ring-1 ring-amber-600'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
                title="Mantém este complemento preenchido automaticamente para todos os próximos pacotes do lote"
              >
                <span>{lockComplementForBatch ? '🔒 Fixo p/ Lote' : '🔓 Fixar no Lote'}</span>
              </button>
            </div>

            <input
              type="text"
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
              placeholder="Ex: Apto 302, Bloco B, Casa 2, Fundos, Loja..."
              className="w-full px-2.5 py-1.5 bg-white border border-amber-300 focus:border-amber-500 rounded-lg text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none shadow-2xs"
            />

            {/* Chips rápidos de 1 toque */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
              {['Apto ', 'Bloco A', 'Bloco B', 'Casa 2', 'Fundos', 'Sobrado', 'Loja '].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    if (!complement) setComplement(sug);
                    else if (!complement.toLowerCase().includes(sug.trim().toLowerCase())) setComplement(`${complement} ${sug}`);
                  }}
                  className="px-1.5 py-0.5 bg-white hover:bg-amber-100 text-slate-700 border border-amber-200 rounded text-[9px] font-bold cursor-pointer active:scale-95 shrink-0"
                >
                  +{sug.trim()}
                </button>
              ))}
              {complement && (
                <button
                  type="button"
                  onClick={() => setComplement('')}
                  className="px-1.5 py-0.5 text-[9px] font-bold text-rose-600 hover:bg-rose-50 rounded shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
              📦 Código / Rastreio
            </label>
            <input
              type="text"
              value={scannedCode}
              onChange={(e) => setScannedCode(e.target.value)}
              placeholder="#0001"
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer"
            >
              Concluir
            </button>

            <button
              type="submit"
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Salvar Pacote (Enter)</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};
