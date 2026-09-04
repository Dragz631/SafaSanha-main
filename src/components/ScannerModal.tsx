import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Camera,
  Barcode,
  Sparkles,
  Check,
  RotateCcw,
  Upload,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';
import jsQR from 'jsqr';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  streetName: string;
  onPackageScanned: (data: {
    houseNumber: string;
    complement?: string;
    recipientName?: string;
    code?: string;
  }) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  streetName,
  onPackageScanned,
}) => {
  const [mode, setMode] = useState<'camera_barcode' | 'ai_ocr'>('camera_barcode');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  // OCR state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState<{
    houseNumber: string;
    complement: string;
    recipientName: string;
    code: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Play audio beep on scan
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // AudioContext not allowed without interaction or not supported
    }
  };

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch {}
      codeReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Fallback jsQR scanning on canvas frames
  const scanCanvasFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (qrCode && qrCode.data) {
        const raw = qrCode.data.trim();
        if (raw) {
          playBeep();
          setLastScannedCode(raw);
          stopCamera();
          setOcrResult({
            houseNumber: '',
            complement: '',
            recipientName: '',
            code: raw,
          });
          setMode('ai_ocr');
          return;
        }
      }
    }

    if (isScanning) {
      animationFrameId.current = requestAnimationFrame(scanCanvasFrame);
    }
  }, [isScanning, stopCamera]);

  // Start Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setIsScanning(true);

      // Initialize ZXing barcode reader
      const reader = new BrowserMultiFormatReader();
      codeReaderRef.current = reader;

      if (videoRef.current) {
        (reader as any).decodeContinuously?.(videoRef.current, (result: any) => {
          if (result) {
            const text = result.getText().trim();
            if (text) {
              playBeep();
              setLastScannedCode(text);
              stopCamera();
              setOcrResult({
                houseNumber: '',
                complement: '',
                recipientName: '',
                code: text,
              });
              setMode('ai_ocr');
            }
          }
        });
      }


      // Also trigger frame-by-frame scanner for QR
      animationFrameId.current = requestAnimationFrame(scanCanvasFrame);
    } catch (err: any) {
      console.warn('Erro ao abrir câmera:', err);
      setCameraError(
        'Não foi possível acessar a câmera traseira. Verifique as permissões de câmera do seu celular ou utilize o envio de foto.'
      );
      setIsScanning(false);
    }
  }, [scanCanvasFrame, stopCamera]);

  useEffect(() => {
    if (isOpen && mode === 'camera_barcode') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, mode, startCamera, stopCamera]);

  // Capture snapshot from video for Gemini OCR
  const captureSnapshotForOcr = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    setCapturedImage(base64);
    await processWithGeminiOcr(base64, lastScannedCode || undefined);
  };

  // Handle image file upload (gallery/camera file)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setCapturedImage(base64);
      await processWithGeminiOcr(base64, lastScannedCode || undefined);
    };
    reader.readAsDataURL(file);
  };

  // Call Gemini Vision OCR
  const processWithGeminiOcr = async (imageBase64: string, knownCode?: string) => {
    setIsProcessingOcr(true);
    setMode('ai_ocr');
    try {
      const res = await fetch('/api/ocr-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, knownCode }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        setOcrResult({
          houseNumber: data.data.numero_casa || '',
          complement: data.data.complemento || '',
          recipientName: data.data.nome_destinatario || '',
          code: data.data.codigo_pacote || knownCode || '',
        });
      } else {
        setOcrResult({
          houseNumber: '',
          complement: '',
          recipientName: '',
          code: knownCode || '',
        });
      }
    } catch (err) {
      console.warn('Erro ao chamar OCR:', err);
      setOcrResult({
        houseNumber: '',
        complement: '',
        recipientName: '',
        code: knownCode || '',
      });
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // Confirm and Add to Street
  const handleConfirmAdd = () => {
    if (!ocrResult || !ocrResult.houseNumber.trim()) {
      alert('Por favor, informe ao menos o Número da Casa.');
      return;
    }

    onPackageScanned({
      houseNumber: ocrResult.houseNumber.trim(),
      complement: ocrResult.complement.trim() || undefined,
      recipientName: ocrResult.recipientName.trim() || undefined,
      code: ocrResult.code.trim() || undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <Barcode className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg">Scanner & Bipagem de Pacotes</h3>
              <p className="text-xs text-emerald-100 font-medium truncate max-w-[240px] sm:max-w-none">
                Adicionando na rua: <strong>{streetName}</strong>
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

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-slate-100 p-1">
          <button
            onClick={() => {
              setMode('camera_barcode');
              setCapturedImage(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'camera_barcode'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Câmera / Código de Barras</span>
          </button>

          <button
            onClick={() => {
              setMode('ai_ocr');
              stopCamera();
            }}
            className={`flex-1 py-2 px-3 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'ai_ocr'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>IA Leitora de Etiqueta</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {mode === 'camera_barcode' && (
            <div className="space-y-3">
              {/* Video Viewport */}
              <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Laser Overlay Guide */}
                <div className="absolute inset-x-8 inset-y-12 border-2 border-emerald-400/80 rounded-2xl pointer-events-none flex items-center justify-center">
                  <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
                </div>

                <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-950/80 text-emerald-300">
                    Aponte para o código de barras ou QR
                  </span>
                </div>
              </div>

              {cameraError && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs">{cameraError}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={captureSnapshotForOcr}
                  className="py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Ler Etiqueta Completa</span>
                </button>

                <label className="py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer text-center">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Galeria / Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {mode === 'ai_ocr' && (
            <div className="space-y-3.5">
              {isProcessingOcr ? (
                <div className="text-center py-8 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-spin">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-slate-900 text-sm">
                    Lendo dados da etiqueta com IA...
                  </h4>
                  <p className="text-xs text-slate-500">
                    Extraindo destinatário, número da casa e código do pacote.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Photo Preview if available */}
                  {capturedImage && (
                    <div className="relative w-full h-28 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                      <img
                        src={capturedImage}
                        alt="Etiqueta"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-950/80 text-white">
                        Foto Capturada
                      </span>
                    </div>
                  )}

                  {/* Form to Confirm Data */}
                  <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <h4 className="font-black text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Dados Identificados:
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-0.5">
                          Nº Casa *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: 142, 48"
                          value={ocrResult?.houseNumber || ''}
                          onChange={(e) =>
                            setOcrResult((prev) => ({
                              ...(prev || { complement: '', recipientName: '', code: '' }),
                              houseNumber: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-sm text-slate-900 bg-white"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-0.5">
                          Complemento (Apto, Casa 2...)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Apto 302"
                          value={ocrResult?.complement || ''}
                          onChange={(e) =>
                            setOcrResult((prev) => ({
                              ...(prev || { houseNumber: '', recipientName: '', code: '' }),
                              complement: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-sm text-slate-900 bg-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-0.5">
                          Nome do Morador / Cliente
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Carlos Silva"
                          value={ocrResult?.recipientName || ''}
                          onChange={(e) =>
                            setOcrResult((prev) => ({
                              ...(prev || { houseNumber: '', complement: '', code: '' }),
                              recipientName: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-sm text-slate-900 bg-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-0.5">
                          Código do Pacote / Rastreio
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 999881543324883"
                          value={ocrResult?.code || ''}
                          onChange={(e) =>
                            setOcrResult((prev) => ({
                              ...(prev || { houseNumber: '', complement: '', recipientName: '' }),
                              code: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('camera_barcode');
                        setCapturedImage(null);
                        setOcrResult(null);
                      }}
                      className="flex-1 py-3 px-3 rounded-2xl border border-slate-300 font-bold text-xs text-slate-700 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Voltar p/ Câmera</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmAdd}
                      className="flex-1 py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Salvar Pacote na Rua</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
