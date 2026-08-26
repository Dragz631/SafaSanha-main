import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, Upload, ShieldAlert } from 'lucide-react';
import { compressImageCanvas } from '../lib/imageCompression';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  title: string;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => console.warn('Erro ao reproduzir feed da câmera:', err));
    }
  }, [stream]);

  const startCamera = async () => {
    setError(null);
    stopCamera();

    if (!navigator || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      const msg = 'Recurso de câmera indisponível neste navegador ou ambiente (navigator.mediaDevices.getUserMedia ausente).';
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
            // Tentativa 3: Qualquer dispositivo de vídeo
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
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;

      const compressed = await compressImageCanvas(rawDataUrl, 1024, 0.6, 300 * 1024);
      onCapture(compressed);
      stopCamera();
      onClose();
    };
    reader.readAsDataURL(file);
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleTakeSnap = async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    let width = video.videoWidth || 1024;
    let height = video.videoHeight || 768;

    if (width > 1024) {
      const ratio = 1024 / width;
      width = 1024;
      height = Math.round(height * ratio);
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.6);
      const compressed = await compressImageCanvas(rawDataUrl, 1024, 0.6, 300 * 1024);
      onCapture(compressed);
      stopCamera();
      onClose();
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-between p-4">
      {/* Top Header */}
      <div className="w-full max-w-md flex items-center justify-between text-white py-2">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-400" />
          <span>{title}</span>
        </h3>
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="p-2 rounded-full bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera Viewport */}
      <div className="relative w-full max-w-md aspect-[3/4] bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center shadow-2xl">
        {error ? (
          <div className="p-6 text-center text-red-400 text-sm flex flex-col items-center justify-center gap-3">
            <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl border border-red-500/30">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <p className="font-extrabold text-white text-base mb-1">Câmera Indisponível</p>
              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                {error.includes('Permission') || error.includes('permissõ') || error.includes('bloqueado')
                  ? 'Permissão de câmera negada. Conceda permissão no navegador ou escolha uma imagem salva no dispositivo.'
                  : error}
              </p>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={startCamera}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tentar Novamente</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Escolher Foto do Dispositivo</span>
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

            {/* Target Reticle / Frame Guide */}
            <div className="absolute inset-8 border-2 border-blue-400/80 border-dashed rounded-xl pointer-events-none flex flex-col justify-between p-3">
              <div className="flex justify-between text-[10px] text-blue-300 font-mono bg-slate-900/80 px-2.5 py-1 rounded self-start border border-blue-400/30">
                <span>ENQUADRAR FOTO AQUI</span>
              </div>
              <div className="text-center text-xs text-white/90 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg self-center border border-white/10">
                Centralize o pacote ou fachada no quadro
              </div>
            </div>
          </>
        )}
      </div>

      {/* Controls Bar */}
      <div className="w-full max-w-md flex items-center justify-around py-4">
        <button
          onClick={toggleFacingMode}
          className="p-3.5 rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
          title="Alternar Câmera (Frontal/Traseira)"
        >
          <RefreshCw className="w-6 h-6" />
        </button>

        {/* Shutter Button */}
        <button
          onClick={handleTakeSnap}
          disabled={!!error}
          className="w-20 h-20 rounded-full bg-blue-600 border-4 border-white text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform disabled:opacity-50 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full border-2 border-white/60 flex items-center justify-center">
            <Check className="w-8 h-8 font-black" />
          </div>
        </button>

        <div className="w-12 h-12" /> {/* Spacer */}
      </div>
    </div>
  );
};
