import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Zap, Check, Volume2, CheckCircle2, Layers, ShieldAlert, Upload } from 'lucide-react';
import { decodeBarcodeFromImage } from '../lib/barcodeScanner';

export interface OcrFeedbackNotice {
  code: string;
  status: 'loading' | 'success' | 'error';
  text: string;
  timestamp: number;
}

interface ContinuousScannerModalProps {
  isOpen: boolean;
  isPaused?: boolean;
  isProcessing?: boolean;
  onClose: () => void;
  onScanCode: (code: string, photoDataUrl?: string) => Promise<boolean | void> | boolean | void;
  modoContinuo?: boolean;
  title?: string;
  ocrNotice?: OcrFeedbackNotice | null;
  existingCodes?: string[];
}

export function playBeepSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    console.warn('Sinal sonoro não suportado ou bloqueado pelo navegador:', e);
  }
}

export const ContinuousScannerModal: React.FC<ContinuousScannerModalProps> = ({
  isOpen,
  isPaused = false,
  isProcessing = false,
  onClose,
  onScanCode,
  modoContinuo = true,
  title = 'Modo Bipagem Contínua ("Metralhadora")',
  ocrNotice = null,
  existingCodes = [],
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const [isContinuo, setIsContinuo] = useState<boolean>(modoContinuo);
  const [scannedList, setScannedList] = useState<string[]>([]);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [isCooldown, setIsCooldown] = useState<boolean>(false);
  const [manualInputCode, setManualInputCode] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const lastScanTimeRef = useRef<number>(0);
  const scannedSetRef = useRef<Set<string>>(new Set());

  const existingCodesSet = React.useMemo(() => {
    return new Set((existingCodes || []).map((c) => c.trim().toUpperCase()));
  }, [existingCodes]);

  useEffect(() => {
    setIsContinuo(modoContinuo);
  }, [modoContinuo]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScannedList([]);
      setLastScannedCode(null);
      setDuplicateNotice(null);
      scannedSetRef.current.clear();
      return;
    }

    scannedSetRef.current.clear();
    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => console.warn('Erro ao dar play no feed da câmera:', err));
    }
  }, [stream]);

  useEffect(() => {
    if (ocrNotice?.status === 'error' && ocrNotice.code) {
      scannedSetRef.current.delete(ocrNotice.code.trim().toUpperCase());
    }
  }, [ocrNotice]);

  // Frame processing interval loop with strict CADENCE LOCK
  useEffect(() => {
    if (!isOpen || !stream || isPaused || isProcessing) return;

    const scanInterval = setInterval(async () => {
      if (isScanningRef.current || isProcessing || isPaused) return;
      const now = Date.now();

      // 800ms debounce/throttle check para alta carga (Metralhadora)
      if (now - lastScanTimeRef.current < 800) {
        setIsCooldown(true);
        return;
      }
      setIsCooldown(false);

      if (!videoRef.current || videoRef.current.readyState < 2) return;

      try {
        isScanningRef.current = true;
        const video = videoRef.current;
        let detectedCode: string | null = null;

        // 1. GATILHO INSTANTÂNEO DE BIPAGEM: Detecção nativa via BarcodeDetector (< 100ms)
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'ean_8', 'itf', 'pdf417'],
            });
            const detectedBarcodes = await detector.detect(video);
            if (detectedBarcodes && detectedBarcodes.length > 0 && detectedBarcodes[0].rawValue) {
              detectedCode = detectedBarcodes[0].rawValue;
            }
          } catch (_e) {
            // Fallback para biblioteca local ZXing
          }
        }

        // 2. PRESERVAÇÃO DA FOTO ORIGINAL COMPLETA DO PACOTE (frame em alta resolução)
        let fullWidth = video.videoWidth || 1280;
        let fullHeight = video.videoHeight || 720;

        let canvas = canvasRef.current;
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvasRef.current = canvas;
        }
        canvas.width = fullWidth;
        canvas.height = fullHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, fullWidth, fullHeight);
          // Foto Original Completa em alta definição (JPEG 0.8)
          const originalFramePhoto = canvas.toDataURL('image/jpeg', 0.8);

          // Se a detecção nativa não retornou, decodifica via biblioteca local no frame original
          if (!detectedCode) {
            const result = await decodeBarcodeFromImage(originalFramePhoto);
            if (result.success && result.code) {
              detectedCode = result.code;
            }
          }

          if (detectedCode) {
            const cleanCode = detectedCode.trim().toUpperCase();

            // 1. DUPLICATE CHECK: Interrompe se o código já existir no Inventário Geral ou na sessão
            const isAlreadyInGlobal = existingCodesSet.has(cleanCode);
            const isAlreadyInSession = scannedSetRef.current.has(cleanCode);

            if (isAlreadyInGlobal || isAlreadyInSession) {
              lastScanTimeRef.current = Date.now();
              setIsCooldown(true);
              setDuplicateNotice('⚠️ Pacote já cadastrado no inventário!');
              playBeepSound();
              setTimeout(() => setDuplicateNotice(null), 2000);
              return;
            }

            // 2. NEW CODE ACCEPTED WITH THROTTLE LOCK
            scannedSetRef.current.add(cleanCode);
            setDuplicateNotice(null);

            // Await processing & local OCR validation logic from parent
            const ocrApproved = await onScanCode(cleanCode, originalFramePhoto);

            if (ocrApproved !== false) {
              // SUCESSO: BIPE VERDE, VIBRAÇÃO HÁTICA E CADÊNCIA
              lastScanTimeRef.current = Date.now();
              setIsCooldown(true);

              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                try {
                  navigator.vibrate([80]);
                } catch (_e) {
                  // ignore
                }
              }
              playBeepSound();

              setLastScannedCode(cleanCode);
              setScannedList((prev) => [cleanCode, ...prev]);

              if (!isContinuo) {
                stopCamera();
                onClose();
              }
            } else {
              // FALHA (TEXTO ILEGÍVEL / AGUARDANDO_FOCO):
              // Libera a trava para tentar novamente no próximo frame focado
              scannedSetRef.current.delete(cleanCode);
              lastScanTimeRef.current = Date.now() - 500; // Cooldown mínimo (300ms) para recalibrar foco
            }
          }
        }
      } catch (err) {
        console.error('Erro na varredura do frame:', err);
      } finally {
        isScanningRef.current = false;
      }
    }, 150);

    return () => clearInterval(scanInterval);
  }, [isOpen, stream, isContinuo, isPaused, isProcessing]);

  const startCamera = async () => {
    setError(null);
    stopCamera();

    if (!navigator || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      const msg = 'Câmera indisponível neste navegador ou ambiente (navigator.mediaDevices.getUserMedia ausente).';
      console.warn(msg);
      setError(msg);
      return;
    }

    let mediaStream: MediaStream | null = null;
    let lastError: any = null;

    const isPermissionError = (err: any) =>
      err?.name === 'NotAllowedError' ||
      err?.name === 'PermissionDeniedError' ||
      err?.name === 'SecurityError' ||
      String(err?.message || '').toLowerCase().includes('permission');

    // Tentativa 1: facingMode ideal + resolução
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (err1: any) {
      lastError = err1;
      console.warn('Tentativa 1 da câmera falhou:', err1?.name || err1);

      if (!isPermissionError(err1)) {
        // Tentativa 2: facingMode exato
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode },
            audio: false,
          });
        } catch (err2: any) {
          lastError = err2;
          console.warn('Tentativa 2 da câmera falhou:', err2?.name || err2);
          if (!isPermissionError(err2)) {
            // Tentativa 3: Qualquer vídeo
            try {
              mediaStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });
            } catch (err3: any) {
              lastError = err3;
              console.warn('Tentativa 3 da câmera falhou:', err3?.name || err3);
            }
          }
        }
      }
    }

    if (mediaStream) {
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch((e) => console.warn('Play exception:', e));
      }
    } else {
      const errName = lastError?.name || 'Erro';
      const errMsg = lastError?.message || 'Verifique as permissões de acesso do navegador';
      setError(`Acesso à câmera bloqueado ou indisponível (${errName}: ${errMsg}).`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const scanResult = await decodeBarcodeFromImage(dataUrl);
      if (scanResult.success && scanResult.code) {
        await onScanCode(scanResult.code, dataUrl);
      } else {
        const fallbackCode = 'PKG-' + Date.now().toString().slice(-6);
        await onScanCode(fallbackCode, dataUrl);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInputCode.trim()) return;
    const clean = manualInputCode.trim().toUpperCase();
    await onScanCode(clean);
    setManualInputCode('');
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleCloseModal = () => {
    stopCamera();
    onClose();
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-4">
      {/* Top Bar Header */}
      <div className="w-full max-w-lg flex items-center justify-between text-white py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-white">{title}</h3>
            <p className="text-[11px] text-slate-400">
              {isContinuo ? 'Modo Metralhadora Ativo (Câmera permanece aberta)' : 'Modo Leitura Única'}
            </p>
          </div>
        </div>

        <button
          onClick={handleCloseModal}
          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1 cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Concluir / Fechar</span>
        </button>
      </div>

      {/* Mode Switch & Controls */}
      <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 my-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-300">Modo Bipagem:</span>
          <button
            onClick={() => setIsContinuo(!isContinuo)}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isContinuo
                ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isContinuo ? 'Contínuo (Metralhadora)' : 'Único (1 Bip)'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFacingMode}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            title="Alternar Câmera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Camera Stream Viewport */}
      <div className="relative w-full max-w-lg aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center shadow-2xl my-auto">
        {error ? (
          <div className="p-5 text-center text-red-400 text-sm max-w-md flex flex-col items-center justify-center gap-3">
            <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl border border-red-500/30">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <p className="font-extrabold text-white text-base mb-1">Acesso à Câmera Negado / Indisponível</p>
              <p className="text-xs text-slate-300 leading-relaxed mb-2">
                {error.includes('Permission') || error.includes('permissõ') || error.includes('bloqueado')
                  ? 'Permissão de câmera bloqueada pelo navegador. Conceda a permissão na barra de endereços do navegador ou utilize as opções abaixo.'
                  : error}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full mt-1">
              <button
                onClick={startCamera}
                className="w-full sm:w-auto flex-1 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tentar Novamente</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto flex-1 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Enviar Foto do Pacote</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            <form onSubmit={handleManualSubmit} className="w-full mt-2 pt-3 border-t border-slate-800/80 flex gap-2">
              <input
                type="text"
                placeholder="Ou digite o código do pacote..."
                value={manualInputCode}
                onChange={(e) => setManualInputCode(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 uppercase font-mono"
              />
              <button
                type="submit"
                disabled={!manualInputCode.trim()}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl disabled:opacity-50 cursor-pointer"
              >
                Bipar
              </button>
            </form>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  videoRef.current.play().catch((e) => console.warn('Play exception onLoadedMetadata:', e));
                }
              }}
              className="w-full h-full object-cover"
            />

            {/* Laser scanning line animation */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-4/5 h-44 border-2 border-amber-400/80 rounded-2xl relative overflow-hidden bg-amber-400/5 backdrop-contrast-125">
                {/* Red Laser Scanning Beam */}
                <div className="w-full h-1 bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse relative top-1/2 -translate-y-1/2" />
                
                <div className="absolute top-2 left-2 bg-slate-950/80 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded border border-amber-400/30">
                  {isProcessing || (ocrNotice && ocrNotice.status === 'loading')
                    ? '⏳ PROCESSANDO ETIQUETA...'
                    : isPaused
                    ? '⏸️ PAUSADO'
                    : isCooldown
                    ? '⏳ Cooldown 1.5s...'
                    : '🟢 LENDO BARRAS / QR'}
                </div>
              </div>
            </div>

            {/* Processing Indicator / Cadence Lock Overlay */}
            {(isProcessing || (ocrNotice && ocrNotice.status === 'loading')) && (
              <div className="absolute top-3 inset-x-3 bg-purple-950/95 backdrop-blur-md border-2 border-purple-400/80 text-white rounded-2xl p-3 flex items-center gap-3 shadow-2xl z-30 animate-pulse">
                <div className="w-5 h-5 border-2 border-purple-300 border-t-transparent rounded-full animate-spin shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 block">
                    🔍 IA Lendo Dados da Etiqueta
                  </span>
                  <p className="text-xs font-black text-purple-100 truncate">
                    🔍 Lendo dados da etiqueta... {ocrNotice?.code ? `(${ocrNotice.code})` : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Paused Camera Overlay */}
            {isPaused && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-20 text-center">
                <div className="p-3 bg-amber-500/20 text-amber-300 rounded-2xl border border-amber-500/30 mb-2">
                  <Zap className="w-8 h-8 animate-pulse" />
                </div>
                <p className="font-extrabold text-white text-sm">⏸️ Leitura Pausada</p>
                <p className="text-xs text-slate-300 max-w-xs mt-1">
                  Janela de edição ou comprovante aberta. O scanner voltará automaticamente quando você fechar a janela.
                </p>
              </div>
            )}

            {/* Duplicate scanned warning overlay */}
            {duplicateNotice && (
              <div className="absolute top-3 inset-x-4 bg-amber-500/95 backdrop-blur border border-white/20 text-slate-950 rounded-xl p-2.5 flex items-center gap-2 shadow-xl z-20 animate-bounce font-bold text-xs">
                <span className="text-base shrink-0">⚠️</span>
                <span className="font-mono">{duplicateNotice}</span>
              </div>
            )}

            {/* Real-time AI Label Extraction Feedback Toast ("Feedback da Metralhadora") */}
            {ocrNotice && ocrNotice.status === 'success' && (
              <div className="absolute top-3 inset-x-3 bg-emerald-650/95 bg-emerald-700 backdrop-blur-md border-2 border-emerald-300 text-white rounded-2xl p-3 flex items-center gap-3 shadow-2xl z-30 animate-bounce">
                <div className="p-1.5 bg-emerald-500 text-white rounded-xl shrink-0 shadow-inner">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200">
                      ✅ Etiqueta Extraída via IA
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-900/80 px-2 py-0.5 rounded-md font-extrabold text-emerald-100 border border-emerald-400/40">
                      {ocrNotice.code}
                    </span>
                  </div>
                  <p className="text-xs font-black text-white truncate mt-0.5">
                    {ocrNotice.text}
                  </p>
                </div>
              </div>
            )}

            {/* Last scanned banner overlay fallback */}
            {lastScannedCode && (!ocrNotice || ocrNotice.status === 'error') && (
              <div className="absolute top-3 inset-x-4 bg-emerald-600/90 backdrop-blur border border-white/20 text-white rounded-xl p-2.5 flex items-center justify-between shadow-lg animate-bounce">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider block">Último Código Lido</span>
                    <span className="font-mono font-extrabold text-sm">{lastScannedCode}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] bg-emerald-950/50 px-2 py-1 rounded-lg">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Bip + Vibração</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Scanned Items Footer counter list */}
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-3 mt-2 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span className="font-extrabold flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Pacotes Bipados nesta sessão:</span>
          </span>
          <span className="font-mono font-black bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
            {scannedList.length} pacotes
          </span>
        </div>

        {/* List preview chips */}
        {scannedList.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pt-1">
            {scannedList.map((code, idx) => (
              <span
                key={`${code}-${idx}`}
                className="bg-slate-800 border border-slate-700 text-amber-300 text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"
              >
                <Check className="w-3 h-3 text-emerald-400" />
                <span>{code}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic text-center py-1">
            Aproxime a etiqueta do leitor. Os pacotes lidos aparecerão aqui em sequência sem fechar a câmera.
          </p>
        )}

        {/* Big Complete Button */}
        <button
          onClick={handleCloseModal}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm py-3 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span>Concluir Bipagem ({scannedList.length} Pacotes)</span>
        </button>
      </div>
    </div>
  );
};
