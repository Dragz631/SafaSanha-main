import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Package,
  Home,
  UserCheck,
  Camera,
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  User,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { DeliveryData, ReceiverType, BarcodeScanResult } from '../types';
import { decodeBarcodeFromImage } from '../lib/barcodeScanner';
import { compressImageCanvas, compressFileCanvas } from '../lib/imageCompression';
import { BarcodeStatusBadge } from './BarcodeStatusBadge';
import { CameraModal } from './CameraModal';

interface DeliveryWizardProps {
  onSaveDelivery: (delivery: DeliveryData) => void;
}

export const DeliveryWizard: React.FC<DeliveryWizardProps> = ({ onSaveDelivery }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 State: Package Photo & Barcode
  const [packagePhoto, setPackagePhoto] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string>('');
  const [scanResult, setScanResult] = useState<BarcodeScanResult | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isAiOcrLoading, setIsAiOcrLoading] = useState<boolean>(false);

  // Step 2 State: Location Photo
  const [locationPhoto, setLocationPhoto] = useState<string | null>(null);

  // Step 3 State: Receiver Details & Address
  const [receiverType, setReceiverType] = useState<ReceiverType>('proprio_morador');
  const [neighborName, setNeighborName] = useState<string>('');
  const [houseNumber, setHouseNumber] = useState<string>('');
  const [placeName, setPlaceName] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');

  // Address & Label extraction fields for OCR Visão Computacional (Passo 1, 2, 3)
  const [recipientName, setRecipientName] = useState<string>('');
  const [streetName, setStreetName] = useState<string>('');
  const [streetNumber, setStreetNumber] = useState<string>('');
  const [apartmentComplement, setApartmentComplement] = useState<string>('');
  const [bairro, setBairro] = useState<string>('');

  // Camera Modal State
  const [cameraModalOpen, setCameraModalOpen] = useState<boolean>(false);
  const [cameraTarget, setCameraTarget] = useState<'package' | 'location'>('package');

  // Hidden File Input Refs
  const packageFileRef = useRef<HTMLInputElement>(null);
  const locationFileRef = useRef<HTMLInputElement>(null);

  const runBackgroundGeminiOcrForPhoto = async (imageBase64: string) => {
    setIsAiOcrLoading(true);
    try {
      const response = await fetch('/api/ocr-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });

      const resData = await response.json();
      if (resData.success) {
        if (resData.code && !barcode) {
          setBarcode(resData.code);
        }

        if (resData.data) {
          if (resData.data.nome_destinatario) setRecipientName(resData.data.nome_destinatario);
          if (resData.data.endereco_completo) setStreetName(resData.data.endereco_completo);
          if (resData.data.numero_casa) setStreetNumber(resData.data.numero_casa);
          if (resData.data.complemento) setApartmentComplement(resData.data.complemento);
          if (resData.data.bairro) setBairro(resData.data.bairro);
        }
      }
    } catch (err) {
      console.warn('Erro na extração em segundo plano por IA:', err);
    } finally {
      setIsAiOcrLoading(false);
    }
  };

  // Handle Photo Analysis for Package Barcode
  const processPackagePhoto = async (photoDataUrl: string) => {
    const compressedPhoto = await compressImageCanvas(photoDataUrl, 1024, 0.6, 300 * 1024);
    setPackagePhoto(compressedPhoto);
    setIsScanning(true);
    setScanResult(null);

    const result = await decodeBarcodeFromImage(compressedPhoto);
    setIsScanning(false);
    setScanResult(result);

    if (result.success && result.code) {
      setBarcode(result.code);
    }

    // Auto-trigger background label extraction
    runBackgroundGeminiOcrForPhoto(compressedPhoto);
  };

  // AI Gemini Vision Fallback (Extração completa da etiqueta)
  const handleGeminiOcr = async () => {
    if (!packagePhoto) return;
    setIsAiOcrLoading(true);

    try {
      const response = await fetch('/api/ocr-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: packagePhoto }),
      });

      const resData = await response.json();
      if (resData.success && resData.code) {
        setBarcode(resData.code);

        // Auto-fill extracted label fields if provided
        if (resData.data) {
          if (resData.data.nome_destinatario) setRecipientName(resData.data.nome_destinatario);
          if (resData.data.endereco_completo) setStreetName(resData.data.endereco_completo);
          if (resData.data.numero_casa) setStreetNumber(resData.data.numero_casa);
          if (resData.data.complemento) setApartmentComplement(resData.data.complemento);
          if (resData.data.bairro) setBairro(resData.data.bairro);
        }

        setScanResult({
          success: true,
          code: resData.code,
          format: 'GEMINI_VISION_AI',
          message: 'Etiqueta e código lidos via IA com sucesso!',
        });
      } else {
        alert(resData.message || 'A IA não conseguiu identificar os dados da etiqueta na foto.');
      }
    } catch (err) {
      console.error('Erro na chamada Gemini OCR:', err);
      alert('Falha ao conectar ao serviço de leitura por IA.');
    } finally {
      setIsAiOcrLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'package' | 'location') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const compressed = await compressFileCanvas(file);
    if (target === 'package') {
      processPackagePhoto(compressed);
    } else {
      setLocationPhoto(compressed);
    }
  };

  const openCameraFor = (target: 'package' | 'location') => {
    setCameraTarget(target);
    setCameraModalOpen(true);
  };

  const handleCameraCapture = (imageDataUrl: string) => {
    if (cameraTarget === 'package') {
      processPackagePhoto(imageDataUrl);
    } else {
      setLocationPhoto(imageDataUrl);
    }
  };

  // Format Receiver Details string according to requirements
  const getReceiverDetails = (): string => {
    if (receiverType === 'proprio_morador') {
      return 'Próprio Morador (Titular)';
    } else if (receiverType === 'vizinho') {
      const name = neighborName.trim() || 'Vizinho/Parente';
      const num = houseNumber.trim() ? ` - Casa/Apto ${houseNumber.trim()}` : '';
      return `${name}${num}`;
    } else if (receiverType === 'estabelecimento') {
      const place = placeName.trim() || 'Estabelecimento';
      const contact = contactName.trim() ? ` (${contactName.trim()})` : '';
      return `${place}${contact}`;
    }
    return 'Entregue no local';
  };

  const handleFinalizeDelivery = () => {
    if (!packagePhoto || !locationPhoto || !barcode.trim()) {
      alert('Por favor, preencha as fotos e o código do pacote antes de finalizar.');
      return;
    }

    if (!streetName.trim() || !bairro.trim()) {
      alert('⚠️ CADASTRO BLOQUEADO: Os campos "Nome da Rua" e "Bairro" são OBRIGATÓRIOS para registrar o pacote!');
      return;
    }

    const receiverDetailsStr = getReceiverDetails();
    const isAutoSuccess = scanResult?.success === true;
    const hasValidDetails = Boolean(barcode.trim().length >= 3 && (recipientName.trim() || streetName.trim() || receiverDetailsStr));

    // Output JSON matching exact prompt structure
    const now = new Date();
    const formattedDateTime = now.toISOString().replace('T', ' ').substring(0, 19);

    const deliveryPayload: DeliveryData = {
      id_entrega: `del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      codigo_pacote: barcode.trim().toUpperCase(),
      recebedor_tipo: receiverType,
      recebedor_detalhes: receiverDetailsStr,
      foto_pacote_path: packagePhoto,
      foto_local_path: locationPhoto,
      data_hora: formattedDateTime,
      status: (isAutoSuccess || hasValidDetails) ? 'pendente_baixa' : 'em_revisao',
      origem_leitura: scanResult?.format === 'GEMINI_VISION_AI' ? 'ocr_ai' : isAutoSuccess ? 'auto' : 'manual',
      nome_destinatario: recipientName.trim() || undefined,
      endereco_completo: streetName.trim() || undefined,
      numero_casa: streetNumber.trim() || undefined,
      complemento: apartmentComplement.trim() || undefined,
      bairro: bairro.trim() || undefined,
      endereco_rua: streetName.trim() || undefined,
      endereco_numero: streetNumber.trim() || undefined,
      endereco_complemento: apartmentComplement.trim() || undefined,
    };

    // Trigger celebratory confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });

    onSaveDelivery(deliveryPayload);
  };

  const handleResetForm = () => {
    setStep(1);
    setPackagePhoto(null);
    setLocationPhoto(null);
    setBarcode('');
    setScanResult(null);
    setReceiverType('proprio_morador');
    setNeighborName('');
    setHouseNumber('');
    setPlaceName('');
    setContactName('');
    setRecipientName('');
    setStreetName('');
    setStreetNumber('');
    setApartmentComplement('');
    setBairro('');
  };


  return (
    <div className="max-w-xl mx-auto px-3 py-4 sm:p-6">
      {/* Visual Step Progress Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Passo {step} de 3
          </span>
          <span className="text-xs font-bold text-slate-600">
            {step === 1 && 'Foto do Pacote'}
            {step === 2 && 'Foto do Local'}
            {step === 3 && 'Identificação do Recebedor'}
          </span>
        </div>

        {/* Progress Bar Line */}
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
          <div
            className="bg-blue-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Step Indicator Icons */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-slate-100 text-center">
          <button
            onClick={() => setStep(1)}
            className={`flex flex-col items-center gap-1 text-xs font-semibold py-1.5 rounded-xl transition-colors ${
              step === 1 ? 'text-blue-700 font-extrabold bg-blue-50' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>1. Pacote</span>
          </button>

          <button
            onClick={() => packagePhoto && barcode && setStep(2)}
            disabled={!packagePhoto || !barcode}
            className={`flex flex-col items-center gap-1 text-xs font-semibold py-1.5 rounded-xl transition-colors ${
              step === 2
                ? 'text-blue-700 font-extrabold bg-blue-50'
                : 'text-slate-500 hover:text-slate-800 disabled:opacity-40'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>2. Local</span>
          </button>

          <button
            onClick={() => packagePhoto && locationPhoto && barcode && setStep(3)}
            disabled={!packagePhoto || !locationPhoto || !barcode}
            className={`flex flex-col items-center gap-1 text-xs font-semibold py-1.5 rounded-xl transition-colors ${
              step === 3
                ? 'text-blue-700 font-extrabold bg-blue-50'
                : 'text-slate-500 hover:text-slate-800 disabled:opacity-40'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>3. Recebedor</span>
          </button>
        </div>
      </div>

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={packageFileRef}
        onChange={(e) => handleFileUpload(e, 'package')}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={locationFileRef}
        onChange={(e) => handleFileUpload(e, 'location')}
        accept="image/*"
        className="hidden"
      />

      {/* Camera Capture Modal */}
      <CameraModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        title={cameraTarget === 'package' ? 'Capturar Foto do Pacote' : 'Capturar Foto do Local'}
      />

      {/* ========================================================================= */}
      {/* STEP 1: FOTO DO PACOTE & CÓDIGO DE BARRAS                                 */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              <span>Etapa A: Foto do Pacote & Leitura</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Capture a foto da etiqueta do pacote para identificação automática do código de barras / QR Code.
            </p>
          </div>

          {/* Photo Capture Area */}
          {!packagePhoto ? (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50/80 hover:bg-slate-100/80 transition-all space-y-4">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
                <Package className="w-8 h-8" />
              </div>

              <div>
                <p className="font-bold text-sm text-slate-900">
                  Nenhuma foto do pacote registrada
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Escolha uma das opções abaixo para capturar
                </p>
              </div>

              {/* Large Touch-Friendly Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => openCameraFor('package')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Camera className="w-5 h-5" />
                  <span>📷 Tirar Foto (Câmera)</span>
                </button>

                <button
                  type="button"
                  onClick={() => packageFileRef.current?.click()}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 px-4 rounded-xl shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Upload className="w-5 h-5" />
                  <span>📁 Upload de Arquivo</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Photo Preview Card */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 aspect-[4/3] flex items-center justify-center group shadow-xs">
                <img
                  src={packagePhoto}
                  alt="Foto do Pacote"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={() => openCameraFor('package')}
                    className="bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg backdrop-blur border border-white/20 flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Nova Foto</span>
                  </button>
                </div>
              </div>

              {/* Barcode Scanner Result Badge */}
              <BarcodeStatusBadge
                code={barcode}
                success={scanResult?.success ?? null}
                scanning={isScanning}
                onCodeChange={(newCode) => {
                  setBarcode(newCode);
                  if (!scanResult?.success) {
                    setScanResult({ success: true, code: newCode, message: 'Inserido manualmente' });
                  }
                }}
                onRetryScan={() => packagePhoto && processPackagePhoto(packagePhoto)}
              />
            </div>
          )}

          {/* Action Button to Step 2 */}
          <button
            type="button"
            disabled={!packagePhoto || !barcode.trim() || isScanning}
            onClick={() => setStep(2)}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-base py-4 px-6 rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Avançar para Foto do Local</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: FOTO DO LOCAL DA ENTREGA                                         */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Home className="w-5 h-5 text-blue-600" />
              <span>Etapa B: Foto do Local da Entrega</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Registre uma foto clara da fachada, número da casa, porta ou balcão da entrega.
            </p>
          </div>

          {!locationPhoto ? (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50/80 hover:bg-slate-100/80 transition-all space-y-4">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
                <Home className="w-8 h-8" />
              </div>

              <div>
                <p className="font-bold text-sm text-slate-900">
                  Nenhuma foto do local registrada
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Capture a fachada, portão ou recepção do local
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => openCameraFor('location')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Camera className="w-5 h-5" />
                  <span>📷 Tirar Foto do Local</span>
                </button>

                <button
                  type="button"
                  onClick={() => locationFileRef.current?.click()}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 px-4 rounded-xl shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Upload className="w-5 h-5" />
                  <span>📁 Upload de Arquivo</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 aspect-[4/3] flex items-center justify-center shadow-xs">
                <img
                  src={locationPhoto}
                  alt="Foto do Local"
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={() => openCameraFor('location')}
                  className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg backdrop-blur border border-white/20 flex items-center gap-1"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Nova Foto</span>
                </button>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-emerald-900 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Foto do local confirmada e vinculada à entrega.</span>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-1.5 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>

            <button
              type="button"
              disabled={!locationPhoto}
              onClick={() => setStep(3)}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 px-4 rounded-2xl shadow-xs flex items-center justify-center gap-1.5 transition-all text-sm"
            >
              <span>Avançar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: IDENTIFICAÇÃO DO RECEBEDOR                                        */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <span>Etapa C: Identificação do Recebedor</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Quem recebeu a encomenda neste endereço?
            </p>
          </div>

          {/* Receiver Option Cards */}
          <div className="space-y-3">
            {/* Option 1: Próprio Morador */}
            <label
              className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                receiverType === 'proprio_morador'
                  ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <input
                type="radio"
                name="receiverType"
                value="proprio_morador"
                checked={receiverType === 'proprio_morador'}
                onChange={() => setReceiverType('proprio_morador')}
                className="mt-1 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-sm text-slate-900">Próprio Morador</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full ml-auto">
                    Padrão
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Entregue diretamente ao titular destinatário.
                </p>
              </div>
            </label>

            {/* Option 2: Vizinho / Parente */}
            <label
              className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                receiverType === 'vizinho'
                  ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <input
                type="radio"
                name="receiverType"
                value="vizinho"
                checked={receiverType === 'vizinho'}
                onChange={() => setReceiverType('vizinho')}
                className="mt-1 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-sm text-slate-900">Vizinho / Parente</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deixado com vizinho próximo ou parente no local.
                </p>

                {receiverType === 'vizinho' && (
                  <div className="mt-3.5 space-y-2.5 pt-3 border-t border-blue-200/60 animate-fadeIn">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome do Recebedor:
                      </label>
                      <input
                        type="text"
                        value={neighborName}
                        onChange={(e) => setNeighborName(e.target.value)}
                        placeholder="Ex: Seu Zé, D. Maria"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nº da Casa / Apto:
                      </label>
                      <input
                        type="text"
                        value={houseNumber}
                        onChange={(e) => setHouseNumber(e.target.value)}
                        placeholder="Ex: Casa 52, Apto 101"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </label>

            {/* Option 3: Estabelecimento / Bar */}
            <label
              className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                receiverType === 'estabelecimento'
                  ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <input
                type="radio"
                name="receiverType"
                value="estabelecimento"
                checked={receiverType === 'estabelecimento'}
                onChange={() => setReceiverType('estabelecimento')}
                className="mt-1 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-sm text-slate-900">Estabelecimento / Bar</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comércio, portaria, recepção ou associação.
                </p>

                {receiverType === 'estabelecimento' && (
                  <div className="mt-3.5 space-y-2.5 pt-3 border-t border-blue-200/60 animate-fadeIn">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome do Local / Estabelecimento:
                      </label>
                      <input
                        type="text"
                        value={placeName}
                        onChange={(e) => setPlaceName(e.target.value)}
                        placeholder="Ex: Bar do Chiquinho, Mercado Sol"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome da Pessoa Responsável:
                      </label>
                      <input
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Ex: Atendente Marcos"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Address Fields for Geofencing & Street Grouping */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <Home className="w-3.5 h-3.5 text-blue-600" />
              <span>Endereço de Entrega (Para Cerca Virtual & Associação)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Rua / Logradouro:
                </label>
                <input
                  type="text"
                  value={streetName}
                  onChange={(e) => setStreetName(e.target.value)}
                  placeholder="Ex: Rua Carlos Seidl"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Número:
                </label>
                <input
                  type="text"
                  value={streetNumber}
                  onChange={(e) => setStreetNumber(e.target.value)}
                  placeholder="Ex: 82"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Complemento / Bloco / Apto (Opcional):
              </label>
              <input
                type="text"
                value={apartmentComplement}
                onChange={(e) => setApartmentComplement(e.target.value)}
                placeholder="Ex: Bloco B Apto 302"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Delivery Overview Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-1.5">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2 text-slate-600">
              📋 Resumo da Entrega para Envio:
            </h4>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Código do Pacote:</span>
              <span className="font-mono font-bold text-slate-900">{barcode || '---'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Tipo de Recebedor:</span>
              <span className="font-bold text-slate-900">
                {receiverType === 'proprio_morador' && 'Próprio Morador'}
                {receiverType === 'vizinho' && 'Vizinho / Parente'}
                {receiverType === 'estabelecimento' && 'Estabelecimento / Bar'}
              </span>
            </div>
            {streetName && (
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Endereço:</span>
                <span className="font-bold text-slate-900">
                  {streetName}{streetNumber ? `, ${streetNumber}` : ''} {apartmentComplement ? `(${apartmentComplement})` : ''}
                </span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Detalhes:</span>
              <span className="font-medium text-slate-900">{getReceiverDetails()}</span>
            </div>
          </div>


          {/* Final Submission Buttons */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-4 px-3 rounded-2xl flex items-center justify-center gap-1 transition-colors text-xs sm:text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>

            <button
              type="button"
              onClick={handleFinalizeDelivery}
              className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm sm:text-base py-4 px-4 rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5 text-blue-200" />
              <span>FINALIZAR ENTREGA</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
