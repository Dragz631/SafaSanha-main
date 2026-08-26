import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import {
  Package,
  Truck,
  QrCode,
  Camera,
  Edit3,
  CheckCircle2,
  Building2,
  Home,
  ShieldAlert,
  Search,
  UserCheck,
  Plus,
  AlertTriangle,
  Sparkles,
  MapPin,
  Clock,
  ArrowRight,
  X,
  FileCheck2,
  RefreshCw,
  Layers,
  Users,
  ChevronDown,
  ChevronUp,
  Check,
  Zap,
  Key
} from 'lucide-react';

let tesseractWorkerPromise: Promise<any> | null = null;

async function getLocalOcrWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      try {
        const worker = await createWorker('por');
        return worker;
      } catch (_e) {
        try {
          const worker = await createWorker('eng');
          return worker;
        } catch (err) {
          console.warn('Falha ao inicializar Tesseract Worker:', err);
          return null;
        }
      }
    })();
  }
  return tesseractWorkerPromise;
}

/**
 * Aplica Binarização de Imagem via Adaptive Thresholding (Bradley-Roth) no recorte central (ROI) da etiqueta.
 * Transforma texto em preto absoluto (0,0,0) e fundo em branco absoluto (255,255,255).
 */
async function processBinarizedRoi(
  imageSource: string | HTMLCanvasElement,
  cropRatioX = 0.05,
  cropRatioY = 0.1,
  cropRatioW = 0.9,
  cropRatioH = 0.8
): Promise<string> {
  return new Promise((resolve) => {
    const processCanvas = (sourceCanvas: HTMLCanvasElement) => {
      try {
        const fullW = sourceCanvas.width;
        const fullH = sourceCanvas.height;

        const cropX = Math.floor(fullW * cropRatioX);
        const cropY = Math.floor(fullH * cropRatioY);
        const cropW = Math.max(50, Math.floor(fullW * cropRatioW));
        const cropH = Math.max(50, Math.floor(fullH * cropRatioH));

        const roiCanvas = document.createElement('canvas');
        roiCanvas.width = cropW;
        roiCanvas.height = cropH;

        const ctx = roiCanvas.getContext('2d');
        if (!ctx) return resolve(typeof imageSource === 'string' ? imageSource : sourceCanvas.toDataURL('image/png'));

        // 1. Recorte da caixa central (ROI)
        ctx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // 2. Binarização - Adaptive Thresholding com Integral Image
        const imgData = ctx.getImageData(0, 0, cropW, cropH);
        const data = imgData.data;
        const numPixels = cropW * cropH;

        const grayscale = new Uint8Array(numPixels);
        const integral = new Uint32Array(numPixels);

        for (let y = 0, i = 0; y < cropH; y++) {
          let rowSum = 0;
          for (let x = 0; x < cropW; x++, i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
            grayscale[i] = gray;
            rowSum += gray;
            if (y === 0) {
              integral[i] = rowSum;
            } else {
              integral[i] = integral[(y - 1) * cropW + x] + rowSum;
            }
          }
        }

        const windowSize = 15;
        const s = Math.floor(windowSize / 2);
        const t = 0.85; // 15% threshold de contraste adaptativo

        for (let x = 0; x < cropW; x++) {
          for (let y = 0; y < cropH; y++) {
            const idx = y * cropW + x;

            const x1 = Math.max(x - s, 0);
            const x2 = Math.min(x + s, cropW - 1);
            const y1 = Math.max(y - s, 0);
            const y2 = Math.min(y + s, cropH - 1);

            const count = (x2 - x1 + 1) * (y2 - y1 + 1);

            let sum = integral[y2 * cropW + x2];
            if (x1 > 0) sum -= integral[y2 * cropW + (x1 - 1)];
            if (y1 > 0) sum -= integral[(y1 - 1) * cropW + x2];
            if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * cropW + (x1 - 1)];

            if (grayscale[idx] * count < sum * t) {
              // Preto Absoluto para o Texto
              data[idx * 4] = 0;
              data[idx * 4 + 1] = 0;
              data[idx * 4 + 2] = 0;
            } else {
              // Branco Absoluto para o Fundo
              data[idx * 4] = 255;
              data[idx * 4 + 1] = 255;
              data[idx * 4 + 2] = 255;
            }
            data[idx * 4 + 3] = 255;
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(roiCanvas.toDataURL('image/png'));
      } catch (_e) {
        resolve(typeof imageSource === 'string' ? imageSource : sourceCanvas.toDataURL('image/png'));
      }
    };

    if (typeof imageSource === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const cx = c.getContext('2d');
        if (cx) cx.drawImage(img, 0, 0);
        processCanvas(c);
      };
      img.onerror = () => resolve(imageSource);
      img.src = imageSource;
    } else {
      processCanvas(imageSource);
    }
  });
}

function parseLocalOcrText(rawText: string) {
  if (!rawText) return { extractedName: '', extractedStreet: '', extractedNum: '', extractedComp: '', extractedBairro: '' };

  const lines = rawText
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);

  let extractedName = '';
  let extractedStreet = '';
  let extractedNum = '';
  let extractedComp = '';
  let extractedBairro = '';

  const streetRegex = /(?:RUA|R\.|AVENIDA|AV\.|ALAMEDA|AL\.|TRAVESSA|TV\.|ESTRADA|EST\.|PRAÇA|PÇA|SERVIDÃO|SITIO|SÍTIO)\s+[A-Z0-9\sªº\.\-\'\`]+/i;
  const numRegex = /(?:Nº|N°|NUMERO|NUM|N|NR)\s*[:\.-]?\s*(\d+[A-Z]?)/i;
  const bairroRegex = /(?:BAIRRO|BAIR|BR)\s*[:\.-]?\s*([A-Z0-9\s\.\-]+)/i;
  const compRegex = /(?:APTO|APT|AP|BLOCO|BL|CASA|SOBRADO|FUNDOS)\s*[:\.-]?\s*([A-Z0-9\s]+)/i;
  const destRegex = /(?:DESTINATÁRIO|DESTINATARIO|DEST|RECEBEDOR|NOME|PARA)\s*[:\.-]?\s*([A-Z\s\.\']+)/i;

  for (const line of lines) {
    if (!extractedName) {
      const matchDest = line.match(destRegex);
      if (matchDest && matchDest[1] && matchDest[1].trim().length >= 3) {
        extractedName = matchDest[1].trim();
      }
    }

    if (!extractedStreet) {
      const matchStreet = line.match(streetRegex);
      if (matchStreet) {
        extractedStreet = matchStreet[0].trim();
      }
    }

    if (!extractedNum) {
      const matchNum = line.match(numRegex);
      if (matchNum && matchNum[1]) {
        extractedNum = matchNum[1].trim();
      }
    }

    if (!extractedBairro) {
      const matchBairro = line.match(bairroRegex);
      if (matchBairro && matchBairro[1]) {
        extractedBairro = matchBairro[1].trim();
      }
    }

    if (!extractedComp) {
      const matchComp = line.match(compRegex);
      if (matchComp) {
        extractedComp = matchComp[0].trim();
      }
    }
  }

  // Fallbacks
  if (!extractedStreet) {
    for (const line of lines) {
      if (/\b(rua|av|avenida|alameda|travessa|estrada|praça)\b/i.test(line)) {
        extractedStreet = line.trim();
        break;
      }
    }
  }

  if (!extractedName) {
    for (const line of lines) {
      const clean = line.replace(/[^a-zA-Z\s]/g, '').trim();
      if (clean.length >= 5 && !/rua|avenida|bairro|cidade|cep|pedido|pacote/i.test(clean)) {
        extractedName = clean;
        break;
      }
    }
  }

  return {
    extractedName,
    extractedStreet,
    extractedNum,
    extractedComp,
    extractedBairro,
  };
}
import { DeliveryData, AssociationArea, AssociationMemoryRecord } from '../types';
import { ContinuousScannerModal, OcrFeedbackNotice } from './ContinuousScannerModal';
import { compressFileCanvas, compressImageCanvas } from '../lib/imageCompression';
import { decodeBarcodeFromImage } from '../lib/barcodeScanner';
import { matchDeliveryToAssociation, createMemoryRecord } from '../lib/associationEngine';
import { AssociationManagerModal } from './AssociationManagerModal';

interface HelperInventoryViewProps {
  deliveries: DeliveryData[];
  associations: AssociationArea[];
  memoryRecords?: AssociationMemoryRecord[];
  onAddDelivery: (delivery: DeliveryData) => void;
  onUpdateDelivery: (delivery: DeliveryData) => void;
  onUpdateDeliveriesBatch?: (deliveries: DeliveryData[]) => void;
  onAddAssociation?: (newAssoc: AssociationArea) => void;
  onUpdateAssociation?: (updatedAssoc: AssociationArea) => void;
  onDeleteAssociation?: (id: string) => void;
  onAddMemoryRecord?: (record: AssociationMemoryRecord) => void;
  onDeleteMemoryRecord?: (id: string) => void;
  onOpenAssociationsTab?: () => void;
  onSelectDeliveryForReceipt?: (delivery: DeliveryData) => void;
}

const HELPER_PRESETS = [
  'Ajudante 1 (Carlos)',
  'Ajudante 2 (Marcos)',
  'Entregador 3 (Roberto)',
  'Ajudante 4 (Fernanda)',
];

export const HelperInventoryView: React.FC<HelperInventoryViewProps> = ({
  deliveries,
  associations,
  memoryRecords = [],
  onAddDelivery,
  onUpdateDelivery,
  onUpdateDeliveriesBatch = (_batch: DeliveryData[]) => {},
  onAddAssociation = () => {},
  onUpdateAssociation = () => {},
  onDeleteAssociation = () => {},
  onAddMemoryRecord = (_record: AssociationMemoryRecord) => {},
  onDeleteMemoryRecord = () => {},
  onOpenAssociationsTab = () => {},
  onSelectDeliveryForReceipt,
}) => {
  // Association Manager Modal State
  const [isAssocModalOpen, setIsAssocModalOpen] = useState(false);
  // Active helper state
  const [selectedHelper, setSelectedHelper] = useState<string>('Ajudante 1 (Carlos)');
  const [customHelperName, setCustomHelperName] = useState<string>('');
  const [isAddingNewHelper, setIsAddingNewHelper] = useState<boolean>(false);

  // Scanning / Input state for Top Panel
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [packagePhoto, setPackagePhoto] = useState<string | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  // Accordion / Collapsible states for groups
  const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({});

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Continuous Scanner ("Metralhadora") Modal State & OCR Feedback Banner
  const [isContinuousScannerOpen, setIsContinuousScannerOpen] = useState<boolean>(false);
  const [activeOcrNotice, setActiveOcrNotice] = useState<OcrFeedbackNotice | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);

  // Manual Quick Edit Form State (Pre-filled on partial OCR or manual trigger)
  const [showQuickEditModal, setShowQuickEditModal] = useState<boolean>(false);
  const [isPartialOcrModal, setIsPartialOcrModal] = useState<boolean>(false);
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [manualRecipient, setManualRecipient] = useState<string>('');
  const [manualStreet, setManualStreet] = useState<string>('');
  const [manualNumber, setManualNumber] = useState<string>('');
  const [manualComplement, setManualComplement] = useState<string>('');
  const [manualBairro, setManualBairro] = useState<string>('');
  const [manualIsBuilding, setManualIsBuilding] = useState<boolean>(false);

  // Photo Location Capture Modal for Delivery Completion
  const [activeDeliveryToComplete, setActiveDeliveryToComplete] = useState<DeliveryData | null>(null);
  const [locationPhoto, setLocationPhoto] = useState<string | null>(null);
  const [completionPackagePhoto, setCompletionPackagePhoto] = useState<string | null>(null);
  const [receiverType, setReceiverType] = useState<string>('proprio_morador');
  const [receiverDetails, setReceiverDetails] = useState<string>('');
  const [isPinMode, setIsPinMode] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  const openDeliveryCompletionModal = (item: DeliveryData) => {
    const street = (item.endereco_rua || item.endereco_completo || '').trim();
    const bairro = (item.bairro || '').trim();

    // BLOQUEIO ABSOLUTO DE BAIXA SEM RUA E BAIRRO (Requirement 2)
    if (!street || !bairro) {
      setScanMessage({
        type: 'error',
        text: '⚠️ Preencha a Rua e o Bairro do pacote antes de confirmar a entrega!',
      });
      // Abre DIRETO a tela de EDIÇÃO RÁPIDA com a foto no topo para digitar Rua e Bairro
      setPackagePhoto(
        item.foto_pacote_path && !item.foto_pacote_path.includes('unsplash')
          ? item.foto_pacote_path
          : null
      );
      setManualCode(item.codigo_pacote);
      setManualRecipient(item.nome_destinatario || item.recebedor_detalhes || '');
      setManualStreet(street);
      setManualNumber(item.numero_casa || item.endereco_numero || '');
      setManualComplement(item.complemento || item.endereco_complemento || '');
      setManualBairro(bairro);
      setManualIsBuilding(Boolean(item.eh_predio));
      setIsPartialOcrModal(true);
      setFormValidationError(
        '⚠️ Preencha a Rua e o Bairro do pacote antes de confirmar a entrega!'
      );
      setShowQuickEditModal(true);
      setTimeout(() => setScanMessage(null), 5000);
      return;
    }

    setActiveDeliveryToComplete(item);
    setLocationPhoto(item.foto_local_path && !item.foto_local_path.includes('unsplash') ? item.foto_local_path : null);
    setCompletionPackagePhoto(item.foto_pacote_path && !item.foto_pacote_path.includes('unsplash') ? item.foto_pacote_path : null);
    setReceiverDetails(item.recebedor_detalhes || item.nome_destinatario || '');
    setReceiverType(item.recebedor_tipo || 'proprio_morador');
    setIsPinMode(item.status === 'aguardando_pin' || Boolean(item.palavra_chave));
    setPinInput(item.palavra_chave || '');
    setPinError(null);
  };

  // Association Manifest Modal State
  const [showAssocManifestModal, setShowAssocManifestModal] = useState<boolean>(false);
  const [selectedAssocForManifest, setSelectedAssocForManifest] = useState<string>('Associação Comunitária');

  // Insucesso / Failure Delivery Modal State
  const [activeDeliveryForInsucesso, setActiveDeliveryForInsucesso] = useState<DeliveryData | null>(null);
  const [insucessoReason, setInsucessoReason] = useState<string>('Cliente Ausente (Ninguém atendeu)');
  const [insucessoPhoto, setInsucessoPhoto] = useState<string | null>(null);
  const [insucessoPhotoError, setInsucessoPhotoError] = useState<string | null>(null);

  // Transfer / Repasse Modal State
  const [transferPackageModal, setTransferPackageModal] = useState<DeliveryData | null>(null);
  const [transferTargetHelper, setTransferTargetHelper] = useState<string>('');
  const [transferCustomHelper, setTransferCustomHelper] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');

  // Bulk Saca Transfer State
  const [bulkSacaAssocName, setBulkSacaAssocName] = useState<string | null>(null);
  const [bulkSacaTargetHelper, setBulkSacaTargetHelper] = useState<string>(HELPER_PRESETS[0]);

  // Bulk Street / Building Repasse State
  const [bulkStreetName, setBulkStreetName] = useState<string | null>(null);
  const [bulkStreetTargetHelper, setBulkStreetTargetHelper] = useState<string>(HELPER_PRESETS[0]);
  const [bulkStreetCustomHelper, setBulkStreetCustomHelper] = useState<string>('');

  // Surgical Saca Repasse: Only transfers pending packages of current helper
  const handleExecuteBulkSacaTransfer = (assocName: string, targetHelper: string) => {
    if (!targetHelper || targetHelper === selectedHelper) {
      alert('Selecione um ajudante de destino diferente do atual.');
      return;
    }

    const sacaDeliveriesToTransfer = helperDeliveries.filter((d) => {
      const isThisAssoc = d.associacao_nome === assocName || (d.recebedor_tipo === 'associacao' && d.associacao_nome?.includes(assocName));
      const isPending = d.status !== 'entregue' && d.status !== 'concluido' && d.status !== 'processado_jt' && d.status !== 'insucesso';
      return isThisAssoc && isPending;
    });

    if (sacaDeliveriesToTransfer.length === 0) {
      alert(`Nenhum pacote PENDENTE encontrado para repasse na Saca "${assocName}".\n(Os pacotes já entregues permanecem intactos no histórico de ${selectedHelper}).`);
      setBulkSacaAssocName(null);
      return;
    }

    const nowStr = new Date().toLocaleString('pt-BR');
    const updatedBatch = sacaDeliveriesToTransfer.map((item) => ({
      ...item,
      ajudante_nome: targetHelper,
      historico_transferencia: [
        ...(typeof item.historico_transferencia === 'object' && Array.isArray(item.historico_transferencia) ? item.historico_transferencia : []),
        `🔄 Repasse em Bloco (Saca ${assocName}): De '${item.ajudante_nome || selectedHelper}' para '${targetHelper}' em ${nowStr}`,
      ],
    }));

    onUpdateDeliveriesBatch(updatedBatch);
    setBulkSacaAssocName(null);
    setScanMessage({
      type: 'success',
      text: `📦 Repasse Seletivo: ${sacaDeliveriesToTransfer.length} pacote(s) pendente(s) da Saca "${assocName}" foram repassados para ${targetHelper}!`,
    });
    setTimeout(() => setScanMessage(null), 5000);
  };

  // Surgical Street Repasse: Only transfers pending packages of current helper on this street/building
  const handleExecuteBulkStreetTransfer = (streetKey: string, targetHelperName: string) => {
    const targetHelper = (targetHelperName === 'OUTRO' ? bulkStreetCustomHelper : targetHelperName).trim();
    if (!targetHelper || targetHelper === selectedHelper) {
      alert('Selecione um ajudante de destino diferente do atual.');
      return;
    }

    const pendingStreetItems = helperDeliveries.filter((d) => {
      const isStreetMatch =
        (d.endereco_completo || d.endereco_rua) === streetKey ||
        `${d.endereco_completo || d.endereco_rua || 'Rua Principal'}, Nº ${d.numero_casa || d.endereco_numero || 'S/N'}` === streetKey ||
        d.endereco_rua === streetKey;
      const isPending =
        d.status !== 'entregue' &&
        d.status !== 'concluido' &&
        d.status !== 'processado_jt' &&
        d.status !== 'insucesso';
      return isStreetMatch && isPending;
    });

    if (pendingStreetItems.length === 0) {
      alert(`Nenhum pacote PENDENTE encontrado para repasse no local "${streetKey}".\n(Os pacotes já entregues permanecem intactos no histórico de ${selectedHelper}).`);
      setBulkStreetName(null);
      return;
    }

    const nowStr = new Date().toLocaleString('pt-BR');
    const updatedBatch = pendingStreetItems.map((item) => ({
      ...item,
      ajudante_nome: targetHelper,
      historico_transferencia: [
        ...(typeof item.historico_transferencia === 'object' && Array.isArray(item.historico_transferencia) ? item.historico_transferencia : []),
        `🔄 Repasse em Bloco (Rua ${streetKey}): De '${item.ajudante_nome || selectedHelper}' para '${targetHelper}' em ${nowStr}`,
      ],
    }));

    onUpdateDeliveriesBatch(updatedBatch);
    setBulkStreetName(null);
    setBulkStreetCustomHelper('');
    setScanMessage({
      type: 'success',
      text: `🚚 Repasse Seletivo: ${pendingStreetItems.length} pacote(s) pendente(s) da Rua "${streetKey}" foram repassados para ${targetHelper}!`,
    });
    setTimeout(() => setScanMessage(null), 5000);
  };

  // Filter deliveries belonging to selected helper
  const helperDeliveries = deliveries.filter((d) => {
    if (!d.ajudante_nome) return selectedHelper === HELPER_PRESETS[0];
    return d.ajudante_nome === selectedHelper;
  });

  // Stats
  const totalCount = helperDeliveries.length;
  const completedCount = helperDeliveries.filter((d) => d.status === 'entregue' || d.status === 'processado_jt' || d.status === 'concluido').length;
  const pinPendingCount = helperDeliveries.filter((d) => d.status === 'aguardando_pin').length;
  const insucessoCount = helperDeliveries.filter((d) => d.status === 'insucesso').length;
  const pendingCount = helperDeliveries.filter((d) => d.status === 'aguardando_rua' || (!['concluido', 'entregue', 'processado_jt', 'aguardando_pin', 'insucesso'].includes(d.status))).length;
  const progressPercent = totalCount > 0 ? Math.round(((completedCount + pinPendingCount) / totalCount) * 100) : 0;

  // Helper to add delivery with geofence check
  const createAndSaveDelivery = (
    code: string,
    recipient: string,
    street: string,
    number: string,
    complement: string,
    bairro: string,
    photoPath?: string,
    origin: 'ocr_ai' | 'manual' | 'auto' = 'auto',
    isBuildingFlag?: boolean
  ) => {
    let deliveryObj: DeliveryData = {
      id_entrega: 'del_ajudante_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      codigo_pacote: code.trim().toUpperCase(),
      recebedor_tipo: 'proprio_morador',
      recebedor_detalhes: recipient.trim() || '',
      nome_destinatario: recipient.trim() || undefined,
      endereco_completo: street.trim(),
      numero_casa: number.trim() || undefined,
      complemento: complement.trim() || undefined,
      bairro: bairro.trim(),
      endereco_rua: street.trim(),
      endereco_numero: number.trim() || undefined,
      endereco_complemento: complement.trim() || undefined,
      foto_pacote_path: photoPath || packagePhoto || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
      foto_local_path: '',
      data_hora: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'aguardando_rua',
      origem_leitura: origin,
      ajudante_nome: selectedHelper,
      eh_predio: isBuildingFlag || Boolean(complement && (complement.toLowerCase().includes('apto') || complement.toLowerCase().includes('bloco'))),
    };
    (deliveryObj as any).fotoOriginal = photoPath || packagePhoto || deliveryObj.foto_pacote_path;

    // Association matching using multi-layered Association Engine (Moradores, Ruas, Bairro, Geofence, Memória)
    const matchResult = matchDeliveryToAssociation(deliveryObj, associations, memoryRecords);
    if (matchResult.matched && matchResult.association) {
      deliveryObj = {
        ...deliveryObj,
        associacao_id: matchResult.association.id,
        associacao_nome: matchResult.association.nome,
        recebedor_tipo: 'associacao',
        recebedor_detalhes: matchResult.association.recebedor_padrao,
      };

      // Save learned memory relationship if matched by name + street
      if (deliveryObj.nome_destinatario && (deliveryObj.endereco_rua || deliveryObj.endereco_completo)) {
        const newRecord = createMemoryRecord(
          deliveryObj.nome_destinatario,
          deliveryObj.endereco_rua || deliveryObj.endereco_completo || '',
          matchResult.association.id,
          matchResult.association.nome,
          deliveryObj.bairro,
          'ia'
        );
        onAddMemoryRecord(newRecord);
      }
    } else {
      // REGRA DE OURO (FALLBACK OBRIGATÓRIO): Se o endereço lido não corresponder a NENHUMA regra ativa de Associação,
      // DEVE OBRIGATORIAMENTE ser classificado como Rua Comum e agrupado pelo nome de sua própria rua.
      deliveryObj = {
        ...deliveryObj,
        associacao_id: undefined,
        associacao_nome: undefined,
        recebedor_tipo: deliveryObj.recebedor_tipo === 'associacao' ? 'proprio_morador' : deliveryObj.recebedor_tipo,
      };
    }

    onAddDelivery(deliveryObj);
    return deliveryObj;
  };

  // Handle Barcode Scan
  const handleScanBarcode = () => {
    if (!barcodeInput.trim()) return;
    const cleanCode = barcodeInput.trim().toUpperCase();

    // Check if package already exists in global system inventory
    const existing = deliveries.find((d) => d.codigo_pacote.toUpperCase() === cleanCode);

    if (existing) {
      setScanMessage({
        type: 'error',
        text: `⚠️ Pacote ${cleanCode} já cadastrado no inventário!`,
      });
      setBarcodeInput('');
      setTimeout(() => setScanMessage(null), 4000);
      return;
    }

    // Automatically add or open quick edit pre-filled
    const newDel = createAndSaveDelivery(
      cleanCode,
      '',
      '',
      '',
      '',
      '',
      undefined,
      'auto'
    );
    setScanMessage({
      type: 'success',
      text: `📦 Pacote ${cleanCode} bipado e adicionado ao inventário do ${selectedHelper}!`,
    });
    setBarcodeInput('');
    setTimeout(() => setScanMessage(null), 5000);
  };

  // Processa OCR/Visão por IA em segundo plano para extrair Nome, Rua, Número, Bairro e Complemento da etiqueta
  const runBackgroundGeminiOcr = async (deliveryObj: DeliveryData, imageBase64: string) => {
    // Exibe notificação de leitura em andamento na tela da câmera metralhadora
    setActiveOcrNotice({
      code: deliveryObj.codigo_pacote,
      status: 'loading',
      text: '🔍 Lendo dados da etiqueta com IA...',
      timestamp: Date.now(),
    });

    try {
      const response = await fetch('/api/ocr-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          knownCode: deliveryObj.codigo_pacote,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        const name = (resData.data.nome_destinatario || '').trim();
        const street = (resData.data.endereco_completo || '').trim();
        const num = (resData.data.numero_casa || '').trim();
        const comp = (resData.data.complemento || '').trim();
        const bairro = (resData.data.bairro || '').trim();

        let updated: DeliveryData = { ...deliveryObj };
        let hasChanges = false;

        if (name) {
          updated.nome_destinatario = name;
          updated.recebedor_detalhes = name;
          hasChanges = true;
        }

        if (street) {
          updated.endereco_completo = street;
          updated.endereco_rua = street;
          hasChanges = true;
        }

        if (num) {
          updated.numero_casa = num;
          updated.endereco_numero = num;
          hasChanges = true;
        }

        if (comp) {
          updated.complemento = comp;
          updated.endereco_complemento = comp;
          updated.eh_predio = Boolean(
            comp.toLowerCase().includes('apto') || comp.toLowerCase().includes('bloco')
          );
          hasChanges = true;
        }

        if (bairro) {
          updated.bairro = bairro;
          hasChanges = true;
        }

        // Mapeamento automático de associação/bairro por cerca virtual e memória
        const matchResult = matchDeliveryToAssociation(updated, associations, memoryRecords);
        if (matchResult.matched && matchResult.association) {
          updated.associacao_id = matchResult.association.id;
          updated.associacao_nome = matchResult.association.nome;
          updated.recebedor_tipo = 'associacao';
          updated.recebedor_detalhes = matchResult.association.recebedor_padrao;
          hasChanges = true;

          // Save learned memory relationship
          if (updated.nome_destinatario && (updated.endereco_rua || updated.endereco_completo)) {
            const newRecord = createMemoryRecord(
              updated.nome_destinatario,
              updated.endereco_rua || updated.endereco_completo || '',
              matchResult.association.id,
              matchResult.association.nome,
              updated.bairro,
              'ia'
            );
            onAddMemoryRecord(newRecord);
          }
        } else {
          // Re-checagem estrita: Se o endereço extraído não corresponde a NENHUMA associação ativa,
          // força classificação como Rua Comum
          if (updated.associacao_id || updated.recebedor_tipo === 'associacao') {
            updated.associacao_id = undefined;
            updated.associacao_nome = undefined;
            updated.recebedor_tipo = 'proprio_morador';
            updated.recebedor_detalhes = updated.nome_destinatario || '';
            hasChanges = true;
          }
        }

        if (hasChanges) {
          updated.origem_leitura = 'ocr_ai';
          // REGRA 1: FIM DOS FALSOS POSITIVOS DE ILEGIBILIDADE
          // Quando a IA extrai destinatário ou rua, o pacote está completo/válido e NÃO deve ficar em revisão
          if (updated.status === 'em_revisao') {
            updated.status = 'aguardando_rua';
          }
          // ATUALIZAÇÃO REATIVA DO ESTADO DO PACOTE NO INVENTÁRIO IMEDIATAMENTE
          onUpdateDelivery(updated);
        }

        // REQUISITO 1: Se a IA em segundo plano não encontrar a Rua ou Bairro, abre a tela de Edição Rápida
        if (!street.trim() || !bairro.trim()) {
          setPackagePhoto(imageBase64);
          setManualCode(deliveryObj.codigo_pacote);
          setManualRecipient(updated.nome_destinatario || name || '');
          setManualStreet(updated.endereco_rua || street || '');
          setManualNumber(updated.numero_casa || num || '');
          setManualComplement(updated.complemento || comp || '');
          setManualBairro(updated.bairro || bairro || '');
          setManualIsBuilding(Boolean((updated.complemento || comp) && (updated.complemento || comp).toLowerCase().includes('apto')));
          setIsPartialOcrModal(true);
          setFormValidationError(`⚠️ A IA leu a etiqueta do pacote ${deliveryObj.codigo_pacote}, mas a Rua ou Bairro não foram identificados. Preencha abaixo:`);
          setShowQuickEditModal(true);
        }

        // Monta o resumo em texto para o toast/card em verde no scanner ("Feedback da Metralhadora")
        const summaryParts: string[] = [];
        if (name) summaryParts.push(name);
        if (street) summaryParts.push(`${street}${num ? ', Nº ' + num : ''}`);
        if (bairro) summaryParts.push(`(${bairro})`);

        const summaryText = summaryParts.length > 0
          ? summaryParts.join(' — ')
          : `Pacote ${deliveryObj.codigo_pacote} registrado com foto`;

        // Exibe o card verde de confirmação na câmera por 3.5 segundos
        setActiveOcrNotice({
          code: deliveryObj.codigo_pacote,
          status: 'success',
          text: summaryText,
          timestamp: Date.now(),
        });

        setTimeout(() => {
          setActiveOcrNotice((prev) => (prev?.code === deliveryObj.codigo_pacote ? null : prev));
        }, 3500);
      } else {
        setActiveOcrNotice({
          code: deliveryObj.codigo_pacote,
          status: 'error',
          text: `Foto registrada para o pacote ${deliveryObj.codigo_pacote}`,
          timestamp: Date.now(),
        });
        setTimeout(() => {
          setActiveOcrNotice((prev) => (prev?.code === deliveryObj.codigo_pacote ? null : prev));
        }, 2500);
      }
    } catch (err) {
      console.warn('Erro ao extrair etiqueta por IA em segundo plano:', err);
      setActiveOcrNotice({
        code: deliveryObj.codigo_pacote,
        status: 'error',
        text: `Foto e código ${deliveryObj.codigo_pacote} registrados`,
        timestamp: Date.now(),
      });
      setTimeout(() => {
        setActiveOcrNotice((prev) => (prev?.code === deliveryObj.codigo_pacote ? null : prev));
      }, 2500);
    }
  };

  // Handle Continuous Scanner Code Emission (Metralhadora com OCR Local 100% em Thread Paralela)
  const handleContinuousScanCode = async (code: string, photoDataUrl?: string): Promise<boolean> => {
    const scanStartTime = performance.now();
    const cleanCode = code.trim().toUpperCase();
    const existing = deliveries.find((d) => d.codigo_pacote.toUpperCase() === cleanCode);

    if (existing) {
      setScanMessage({
        type: 'error',
        text: `⚠️ Pacote ${cleanCode} já cadastrado no inventário!`,
      });
      setTimeout(() => setScanMessage(null), 4000);
      return false;
    }

    // 1. SINALIZA PROCESSAMENTO DE ETIQUETA
    setIsOcrProcessing(true);
    setActiveOcrNotice({
      code: cleanCode,
      status: 'loading',
      text: '⏳ Processando etiqueta (OCR Local)...',
      timestamp: Date.now(),
    });

    // 2. BINARIZAÇÃO E CROP DO ROI DA ETIQUETA VIA CANVAS (PRETO E BRANCO PURA)
    let binarizedRoi = photoDataUrl || '';
    if (photoDataUrl && photoDataUrl.startsWith('data:image')) {
      try {
        binarizedRoi = await processBinarizedRoi(photoDataUrl);
      } catch (_e) {
        binarizedRoi = photoDataUrl;
      }
    }

    let extractedName = '';
    let extractedStreet = '';
    let extractedNum = '';
    let extractedComp = '';
    let extractedBairro = '';

    // 3. EXECUÇÃO DE OCR LOCAL EM WEB WORKER (THREAD PARALELA - SEM APIS EXTERNAS)
    if (binarizedRoi) {
      try {
        const worker = await getLocalOcrWorker();
        if (worker) {
          const res = await worker.recognize(binarizedRoi);
          const rawText = res?.data?.text || '';
          const parsed = parseLocalOcrText(rawText);
          extractedName = parsed.extractedName;
          extractedStreet = parsed.extractedStreet;
          extractedNum = parsed.extractedNum;
          extractedComp = parsed.extractedComp;
          extractedBairro = parsed.extractedBairro;
        }
      } catch (err) {
        console.warn('Erro ao executar OCR local em Web Worker:', err);
      }
    }

    const tempoMs = Math.round(performance.now() - scanStartTime);
    const sucesso = Boolean(extractedStreet || extractedName);

    // 4. LOG DE AUDITORIA NO CONSOLE (FORMATO EXATO EXIGIDO)
    console.log(`[LogiScan Engine Local] OCR Local Processado em ${tempoMs}ms | Status: ${sucesso ? 'APROVADO' : 'AGUARDANDO_FOCO'}`);

    if (sucesso) {
      // SUCESSO: Registra o pacote no inventário vinculando a FOTO ORIGINAL INTEIRA DO PACOTE (photoDataUrl)
      createAndSaveDelivery(
        cleanCode,
        extractedName,
        extractedStreet,
        extractedNum,
        extractedComp,
        extractedBairro,
        photoDataUrl, // Preserva FOTO ORIGINAL INTEIRA DO PACOTE
        'ocr_ai'
      );

      const successMsg = `✅ Etiqueta Extraída: ${extractedName || 'Destinatário'} - ${extractedStreet || extractedBairro || 'Rua Identificada'}`;
      setActiveOcrNotice({
        code: cleanCode,
        status: 'success',
        text: successMsg,
        timestamp: Date.now(),
      });

      setTimeout(() => {
        setActiveOcrNotice((prev) => (prev?.code === cleanCode ? null : prev));
      }, 3000);

      setIsOcrProcessing(false);
      return true;
    } else {
      // FALHA (TEXTO ILEGÍVEL / AGUARDANDO_FOCO): NÃO cria pacote pendente nem cartão de erro
      setActiveOcrNotice({
        code: cleanCode,
        status: 'error',
        text: '🔍 Aguardando foco na etiqueta...',
        timestamp: Date.now(),
      });

      setTimeout(() => {
        setActiveOcrNotice((prev) => (prev?.code === cleanCode ? null : prev));
      }, 2000);

      setIsOcrProcessing(false);
      return false;
    }
  };

  // Handle Camera Photo Upload & Barcode Decoding
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(true);
    setScanMessage(null);

    try {
      const compressedBase64 = await compressFileCanvas(file);
      setPackagePhoto(compressedBase64);

      // Decodifica o código de barras real diretamente da imagem
      const scanResult = await decodeBarcodeFromImage(compressedBase64);

      if (scanResult.success && scanResult.code) {
        const cleanCode = scanResult.code.trim().toUpperCase();
        if (deliveries.some((d) => d.codigo_pacote.toUpperCase() === cleanCode)) {
          setScanMessage({
            type: 'error',
            text: `⚠️ Pacote ${cleanCode} já cadastrado no inventário!`,
          });
          setIsOcrLoading(false);
          setTimeout(() => setScanMessage(null), 4000);
          return;
        }

        const newDel = createAndSaveDelivery(cleanCode, '', '', '', '', '', compressedBase64, 'auto');
        setScanMessage({
          type: 'success',
          text: `⚡ Código ${cleanCode} lido com sucesso! Extraindo dados da etiqueta em segundo plano...`,
        });
        runBackgroundGeminiOcr(newDel, compressedBase64);
      } else {
        // Envia foto para a IA Gemini Vision se o scanner de código de barras não achou o código
        const response = await fetch('/api/ocr-gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: compressedBase64 }),
        });

        const resData = await response.json();
        if (resData.success && resData.data) {
          const code = (resData.data.codigo_pacote || resData.code || '').trim().toUpperCase();
          const name = (resData.data.nome_destinatario || '').trim();
          const street = (resData.data.endereco_completo || '').trim();
          const num = (resData.data.numero_casa || '').trim();
          const comp = (resData.data.complemento || '').trim();
          const bairro = (resData.data.bairro || '').trim();

          if (code) {
            if (deliveries.some((d) => d.codigo_pacote.toUpperCase() === code)) {
              setScanMessage({
                type: 'error',
                text: `⚠️ Pacote ${code} já cadastrado no inventário!`,
              });
              setIsOcrLoading(false);
              setTimeout(() => setScanMessage(null), 4000);
              return;
            }

            createAndSaveDelivery(code, name, street, num, comp, bairro, compressedBase64, 'ocr_ai');

            // REQUISITO 1: Se a IA extrair o pacote mas faltar Rua ou Bairro, abre DIRETO a tela de Edição Rápida com a foto da etiqueta
            if (!street || !bairro) {
              setPackagePhoto(compressedBase64);
              setManualCode(code);
              setManualRecipient(name);
              setManualStreet(street);
              setManualNumber(num);
              setManualComplement(comp);
              setManualBairro(bairro);
              setManualIsBuilding(Boolean(comp && (comp.toLowerCase().includes('apto') || comp.toLowerCase().includes('bloco'))));
              setIsPartialOcrModal(true);
              setFormValidationError('⚠️ A IA leu o pacote, mas a Rua ou Bairro não foram identificados. Digite a localização para cadastrar:');
              setShowQuickEditModal(true);
            } else {
              setScanMessage({
                type: 'success',
                text: `✨ IA leu o código ${code} e extraiu os dados da etiqueta com sucesso!`,
              });
            }
          } else {
            // Código de barras não localizado -> Abre formulário com foto no topo preenchendo textos lidos
            setPackagePhoto(compressedBase64);
            setManualCode('');
            setManualRecipient(name);
            setManualStreet(street);
            setManualNumber(num);
            setManualComplement(comp);
            setManualBairro(bairro);
            setManualIsBuilding(Boolean(comp && (comp.toLowerCase().includes('apto') || comp.toLowerCase().includes('bloco'))));
            setIsPartialOcrModal(true);
            setFormValidationError(null);
            setShowQuickEditModal(true);
          }
        } else {
          setPackagePhoto(compressedBase64);
          setManualCode('');
          setManualRecipient('');
          setManualStreet('');
          setManualNumber('');
          setManualComplement('');
          setManualBairro('');
          setIsPartialOcrModal(false);
          setFormValidationError(null);
          setShowQuickEditModal(true);
        }
      }
    } catch (err) {
      console.error('Erro na leitura da imagem:', err);
      setManualCode('');
      setManualRecipient('');
      setManualStreet('');
      setManualNumber('');
      setManualComplement('');
      setManualBairro('');
      setIsPartialOcrModal(false);
      setFormValidationError(null);
      setShowQuickEditModal(true);
    } finally {
      setIsOcrLoading(false);
    }
  };

  // Save Manual Quick Edit with Strict Address Validation
  const handleSaveQuickEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationError(null);

    const cleanStreet = manualStreet.trim();
    const cleanBairro = manualBairro.trim();
    const cleanCode = manualCode.trim();

    // STRICT VALIDATION (Requirement 3): Block submission if Rua or Bairro are empty or whitespace
    if (!cleanStreet || !cleanBairro) {
      setFormValidationError(
        '⚠️ CADASTRO BLOQUEADO: Os campos "Nome da Rua" e "Bairro" são OBRIGATÓRIOS e não podem conter apenas espaços! Preencha a localização completa para cadastrar.'
      );
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch (_e) {
          // ignore
        }
      }
      return;
    }

    if (!cleanCode) {
      setFormValidationError('⚠️ Informe o código do pacote.');
      return;
    }

    const upperCode = cleanCode.toUpperCase();
    const existingPkg = deliveries.find((d) => d.codigo_pacote.toUpperCase() === upperCode);

    if (existingPkg) {
      // Re-checagem estrita de Associação pelo motor de regras
      const candidateObj: Partial<DeliveryData> = {
        nome_destinatario: manualRecipient || existingPkg.nome_destinatario,
        endereco_completo: cleanStreet,
        endereco_rua: cleanStreet,
        bairro: cleanBairro,
      };
      const matchResult = matchDeliveryToAssociation(candidateObj, associations, memoryRecords);
      const matchedAssoc = matchResult.matched ? matchResult.association : undefined;

      const updated: DeliveryData = {
        ...existingPkg,
        nome_destinatario: manualRecipient || existingPkg.nome_destinatario,
        recebedor_detalhes: matchedAssoc ? matchedAssoc.recebedor_padrao : (manualRecipient || existingPkg.recebedor_detalhes),
        endereco_completo: cleanStreet,
        endereco_rua: cleanStreet,
        numero_casa: manualNumber,
        endereco_numero: manualNumber,
        complemento: manualComplement,
        endereco_complemento: manualComplement,
        bairro: cleanBairro,
        eh_predio: manualIsBuilding,
        foto_pacote_path: packagePhoto || existingPkg.foto_pacote_path,
        associacao_id: matchedAssoc ? matchedAssoc.id : undefined,
        associacao_nome: matchedAssoc ? matchedAssoc.nome : undefined,
        recebedor_tipo: matchedAssoc ? 'associacao' : 'proprio_morador',
        status: existingPkg.status === 'em_revisao' || existingPkg.status === 'aguardando_rua' ? 'pendente_baixa' : existingPkg.status,
      };
      onUpdateDelivery(updated);
    } else {
      createAndSaveDelivery(
        cleanCode,
        manualRecipient,
        cleanStreet,
        manualNumber,
        manualComplement,
        cleanBairro,
        packagePhoto || undefined,
        'manual',
        manualIsBuilding
      );
    }

    setShowQuickEditModal(false);
    setIsPartialOcrModal(false);
    setPackagePhoto(null);
    setFormValidationError(null);

    setScanMessage({
      type: 'success',
      text: `✅ Pacote ${cleanCode.toUpperCase()} adicionado com sucesso ao inventário de ${selectedHelper}!`,
    });

    // Reset form
    setManualCode('');
    setManualRecipient('');
    setManualStreet('');
    setManualNumber('');
    setManualComplement('');
    setManualBairro('');
    setManualIsBuilding(false);

    setTimeout(() => setScanMessage(null), 5000);
  };

  // Confirm Location Photo & Package Photo & Complete Delivery
  const handleConfirmDeliveryCompletion = () => {
    if (!activeDeliveryToComplete) return;

    const street = (activeDeliveryToComplete.endereco_rua || activeDeliveryToComplete.endereco_completo || '').trim();
    const bairro = (activeDeliveryToComplete.bairro || '').trim();

    if (!street || !bairro) {
      setScanMessage({
        type: 'error',
        text: '⚠️ Preencha a Rua e o Bairro do pacote antes de confirmar a entrega!',
      });
      return;
    }

    const finalPkgPhoto = completionPackagePhoto || activeDeliveryToComplete.foto_pacote_path;
    const finalLocPhoto = locationPhoto || activeDeliveryToComplete.foto_local_path;
    const finalRecipient = receiverDetails.trim() || activeDeliveryToComplete.nome_destinatario || '';

    const hasPkg = Boolean(finalPkgPhoto && finalPkgPhoto.trim().length > 0 && !finalPkgPhoto.includes('unsplash'));
    const hasLoc = Boolean(finalLocPhoto && finalLocPhoto.trim().length > 0 && !finalLocPhoto.includes('unsplash'));
    const hasRec = Boolean(finalRecipient && finalRecipient.trim().length > 0);

    if (!hasPkg || !hasLoc || !hasRec) {
      setPinError('⚠️ OBRIGATÓRIO: É necessário capturar as 2 FOTOS (1. Pacote/Fachada + 2. Pacote na Mão do Recebedor) e o Nome do Recebedor para confirmar a entrega!');
      return;
    }

    // Validação de PIN se o modo PIN estiver ativado ou o pacote requerer PIN
    const cleanPin = pinInput.trim();
    const requiresPin = isPinMode || activeDeliveryToComplete.status === 'aguardando_pin' || Boolean(activeDeliveryToComplete.palavra_chave);

    if (requiresPin) {
      if (!cleanPin) {
        setPinError('⚠️ O código numérico (PIN) é OBRIGATÓRIO para confirmar esta baixa!');
        return;
      }
      if (
        activeDeliveryToComplete.palavra_chave &&
        activeDeliveryToComplete.palavra_chave.trim().toUpperCase() !== cleanPin.toUpperCase()
      ) {
        setPinError(`⚠️ PIN INCORRETO! O PIN digitado ("${cleanPin}") não coincide com a palavra-chave cadastrada do cliente.`);
        return;
      }
    }

    const recipientDetailsFormatted = cleanPin
      ? `${finalRecipient} (✅ PIN Validado: ${cleanPin})`
      : finalRecipient;

    const updated: DeliveryData = {
      ...activeDeliveryToComplete,
      foto_pacote_path: finalPkgPhoto,
      foto_local_path: finalLocPhoto,
      status: 'entregue',
      recebedor_tipo: receiverType as any,
      recebedor_detalhes: recipientDetailsFormatted,
      nome_destinatario: activeDeliveryToComplete.nome_destinatario || finalRecipient,
      palavra_chave: cleanPin || activeDeliveryToComplete.palavra_chave,
      data_hora: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    onUpdateDelivery(updated);
    setActiveDeliveryToComplete(null);
    setLocationPhoto(null);
    setCompletionPackagePhoto(null);
    setReceiverDetails('');
    setPinInput('');
    setIsPinMode(false);
    setPinError(null);

    setScanMessage({
      type: 'success',
      text: `🎉 Baixa realizada! Entrega ${updated.codigo_pacote} concluída ${cleanPin ? 'com ✅ PIN Validado' : 'com sucesso'} e enviada à Esteira J&T.`,
    });
    setTimeout(() => setScanMessage(null), 5000);
  };

  // Move Delivery to Status "Aguardando PIN" (Sem Burlar a Baixa)
  const handleMarkWaitingPin = () => {
    if (!activeDeliveryToComplete) return;

    const finalPkgPhoto = completionPackagePhoto || activeDeliveryToComplete.foto_pacote_path;
    const finalLocPhoto = locationPhoto || activeDeliveryToComplete.foto_local_path;
    const finalRecipient = receiverDetails.trim() || activeDeliveryToComplete.nome_destinatario || 'Cliente na Rua';

    const hasPkg = Boolean(finalPkgPhoto && finalPkgPhoto.trim().length > 0 && !finalPkgPhoto.includes('unsplash'));
    const hasLoc = Boolean(finalLocPhoto && finalLocPhoto.trim().length > 0 && !finalLocPhoto.includes('unsplash'));
    const hasRec = Boolean(finalRecipient && finalRecipient.trim().length > 0);

    if (!hasPkg || !hasLoc || !hasRec) {
      setPinError('⚠️ OBRIGATÓRIO PARA ENTREGUE (AGUARDANDO PIN): É necessário capturar as 2 FOTOS (1. Pacote/Local + 2. Pacote na Mão do Recebedor) e o Nome do Recebedor!');
      return;
    }

    const updated: DeliveryData = {
      ...activeDeliveryToComplete,
      foto_pacote_path: finalPkgPhoto,
      foto_local_path: finalLocPhoto,
      status: 'aguardando_pin',
      recebedor_tipo: receiverType as any,
      recebedor_detalhes: finalRecipient,
      nome_destinatario: activeDeliveryToComplete.nome_destinatario || finalRecipient,
      ajudante_nome: selectedHelper || activeDeliveryToComplete.ajudante_nome || 'Ajudante',
      palavra_chave: pinInput.trim() || activeDeliveryToComplete.palavra_chave,
      data_hora: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    onUpdateDelivery(updated);
    setActiveDeliveryToComplete(null);
    setLocationPhoto(null);
    setCompletionPackagePhoto(null);
    setReceiverDetails('');
    setPinInput('');
    setIsPinMode(false);
    setPinError(null);

    setScanMessage({
      type: 'warning',
      text: `🟡 Registrado como "Entregue (Aguardando PIN)"! 2 fotos de prova e dados de ${selectedHelper || 'Ajudante'} salvos no histórico. Pacote aguarda a Palavra-Chave.`,
    });
    setTimeout(() => setScanMessage(null), 6000);
  };

  // Grouping today's deliveries into 3 categories:
  // 1. Associações Comunitárias (Cerca Virtual)
  // 2. Prédios e Condomínios (Verticalizados)
  // 3. Ruas e Logradouros (Casas)

  const associationDeliveries = helperDeliveries.filter((d) => Boolean(d.associacao_id || d.recebedor_tipo === 'associacao'));
  const nonAssocDeliveries = helperDeliveries.filter((d) => !d.associacao_id && d.recebedor_tipo !== 'associacao');

  // Building deliveries
  const buildingDeliveries = nonAssocDeliveries.filter(
    (d) => d.eh_predio || (d.complemento && (d.complemento.toLowerCase().includes('apto') || d.complemento.toLowerCase().includes('bloco')))
  );

  // Group buildings by Street + Number
  const buildingGroups: { [key: string]: DeliveryData[] } = {};
  buildingDeliveries.forEach((d) => {
    const key = `${d.endereco_completo || d.endereco_rua || 'Rua Principal'}, Nº ${d.numero_casa || d.endereco_numero || 'S/N'}`;
    if (!buildingGroups[key]) buildingGroups[key] = [];
    buildingGroups[key].push(d);
  });

  // Street deliveries (Casas / Sobrados / Ruas normais)
  const streetDeliveries = nonAssocDeliveries.filter(
    (d) => !buildingDeliveries.includes(d)
  );

  // Group streets by Street Name
  const streetGroups: { [key: string]: DeliveryData[] } = {};
  streetDeliveries.forEach((d) => {
    const key = d.endereco_completo || d.endereco_rua || 'Ruas Gerais';
    if (!streetGroups[key]) streetGroups[key] = [];
    streetGroups[key].push(d);
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-12 space-y-6">
      {/* HEADER PRINCIPAL: SELEÇÃO DE AJUDANTE & BARRA DE PROGRESSO */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Helper Title & Active Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
                <Truck className="w-6 h-6" />
              </span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-950/80 px-2.5 py-0.5 rounded-full border border-blue-700/50">
                  INVENTÁRIO & PAINEL DE BIPAGEM
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  Gestão de Carga & Entregas do Ajudante
                </h2>
              </div>
            </div>

            {/* Helper Selector Dropdown */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 rounded-2xl px-3.5 py-2 text-xs">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-slate-400 font-bold">Ajudante Atual:</span>
                <select
                  value={selectedHelper}
                  onChange={(e) => {
                    if (e.target.value === 'NEW') {
                      setIsAddingNewHelper(true);
                    } else {
                      setSelectedHelper(e.target.value);
                      setIsAddingNewHelper(false);
                    }
                  }}
                  className="bg-transparent text-white font-black text-sm focus:outline-none cursor-pointer pr-2"
                >
                  {HELPER_PRESETS.map((preset) => (
                    <option key={preset} value={preset} className="bg-slate-900 text-white">
                      {preset}
                    </option>
                  ))}
                  {customHelperName && (
                    <option value={customHelperName} className="bg-slate-900 text-white">
                      {customHelperName}
                    </option>
                  )}
                  <option value="NEW" className="bg-blue-900 text-white font-bold">
                    + Cadastrar Novo Ajudante...
                  </option>
                </select>
              </div>

              {isAddingNewHelper && (
                <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-blue-500">
                  <input
                    type="text"
                    placeholder="Nome do novo ajudante..."
                    value={customHelperName}
                    onChange={(e) => setCustomHelperName(e.target.value)}
                    className="bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg focus:outline-none border border-slate-700"
                  />
                  <button
                    onClick={() => {
                      if (customHelperName.trim()) {
                        setSelectedHelper(customHelperName.trim());
                        setIsAddingNewHelper(false);
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              )}

              <span className="text-xs font-bold text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/50 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Turno: {new Date().toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
        </div>

        {/* 5-METRIC RESPONSIVE SUMMARY GRID */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. TOTAL */}
          <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80 flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block truncate">
                TOTAL
              </span>
              <span className="text-lg font-black text-white">{totalCount}</span>
            </div>
          </div>

          {/* 2. A ENTREGAR */}
          <div className="bg-slate-800/90 p-3 rounded-2xl border border-indigo-500/40 flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-300 block truncate">
                A ENTREGAR
              </span>
              <span className="text-lg font-black text-indigo-200">{pendingCount}</span>
            </div>
          </div>

          {/* 3. 🔑 PIN PENDENTE */}
          <div className="bg-slate-800/90 p-3 rounded-2xl border border-amber-500/50 flex items-center gap-3 shadow-2xs">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-amber-400 block truncate">
                🔑 PIN PENDENTE
              </span>
              <span className="text-lg font-black text-amber-300">{pinPendingCount}</span>
            </div>
          </div>

          {/* 4. ⚠️ INSUCESSOS */}
          <div className="bg-slate-800/90 p-3 rounded-2xl border border-rose-500/50 flex items-center gap-3">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-rose-400 block truncate">
                ⚠️ INSUCESSOS
              </span>
              <span className="text-lg font-black text-rose-300">{insucessoCount}</span>
            </div>
          </div>

          {/* 5. ✅ CONCLUÍDAS */}
          <div className="bg-slate-800/90 p-3 rounded-2xl border border-emerald-500/50 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-400 block truncate">
                ✅ CONCLUÍDAS
              </span>
              <span className="text-lg font-black text-emerald-300">{completedCount}</span>
            </div>
          </div>
        </div>

        {/* BARRA DE PROGRESSO DE ACOMPANHAMENTO DO ENTREGADOR */}
        <div className="mt-5 pt-4 border-t border-slate-800/90 space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-extrabold text-slate-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Progresso do Turno de {selectedHelper}:
            </span>
            <span className="font-black text-emerald-400 bg-emerald-950/90 px-3 py-0.5 rounded-full border border-emerald-800">
              {completedCount} de {totalCount} Concluídas ({progressPercent}%)
            </span>
          </div>

          {/* Progress Bar Visual */}
          <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden border border-slate-700/80 relative">
            <div
              className="bg-gradient-to-r from-blue-500 via-emerald-400 to-emerald-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* FEEDBACK TOAST / MESSAGE BANNER */}
      {scanMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-black flex items-center justify-between shadow-xs transition-all ${
            scanMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : scanMessage.type === 'warning'
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          <span className="flex items-center gap-2">{scanMessage.text}</span>
          <button onClick={() => setScanMessage(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PAINEL FIXO UNIFICADO DE BIPAGEM & ADIÇÃO DE PACOTES NO TOPO */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-700 rounded-xl">
                <QrCode className="w-5 h-5" />
              </span>
              📷 Bipar / Adicionar Novo Pacote ao Inventário
            </h3>
            <p className="text-xs text-slate-500">
              Bipe o código de barras ou tire foto da etiqueta. O leitor registra o pacote e salva a foto capturada no inventário.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsContinuousScannerOpen(true)}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>⚡ Modo Bipagem Contínua ("Metralhadora")</span>
            </button>

            <button
              onClick={() => {
                setManualCode('');
                setManualRecipient('');
                setManualStreet('');
                setManualNumber('');
                setManualComplement('');
                setManualBairro('');
                setIsPartialOcrModal(false);
                setFormValidationError(null);
                setShowQuickEditModal(true);
              }}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
            >
              <Edit3 className="w-4 h-4" />
              <span>Editar Manualmente</span>
            </button>
          </div>
        </div>

        {/* Unified Scanner / Camera Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Scanner / Barcode Input */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
            <label className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-blue-600" />
              1. Leitor de Código de Barras / Digitação Rápida
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanBarcode()}
                placeholder="Digite ou bipe o código (ex: JT100200300BR)..."
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
              />
              <button
                onClick={handleScanBarcode}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-5 rounded-xl cursor-pointer transition-all shadow-2xs"
              >
                Bipar
              </button>
            </div>
          </div>

          {/* Camera Upload / Gemini OCR */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
            <label className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-purple-600" />
              2. Captura de Foto da Etiqueta / Anexo de Imagem
            </label>
            <label className="flex items-center justify-center gap-2 bg-white border-2 border-dashed border-purple-300 hover:border-purple-500 rounded-xl p-2.5 cursor-pointer text-xs font-bold text-purple-700 transition-all shadow-2xs">
              {isOcrLoading ? (
                <span className="flex items-center gap-2 text-purple-600 animate-pulse font-extrabold">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Lendo Código de Barras na Foto...
                </span>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-purple-600" />
                  <span>Anexar / Fotografar Etiqueta do Pacote</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                disabled={isOcrLoading}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* CARDS SANFONADOS E AGRUPADOS DAS ENTREGAS DO DIA */}
      <div className="space-y-6">
        {/* BLOCO 1: 🏢 PRÉDIOS E CONDOMÍNIOS (ENTREGAS VERTICALIZADAS) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  🏢 Prédios & Condomínios (Entregas Verticalizadas)
                </h3>
                <p className="text-xs text-slate-500">
                  Agrupados por Edifício para entrega concentrada na mesma portaria/endereço.
                </p>
              </div>
            </div>
            <span className="text-xs font-black bg-indigo-50 text-indigo-800 px-3 py-1 rounded-full border border-indigo-200">
              {buildingDeliveries.length} Pacotes
            </span>
          </div>

          {Object.keys(buildingGroups).length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center italic">
              Nenhum pacote em edifícios/condomínios no inventário ainda. Bipe uma etiqueta acima.
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(buildingGroups).map(([bldKey, bldItems]) => {
                const bldCompleted = bldItems.filter((i) => i.status === 'concluido').length;
                const isAllDone = bldCompleted === bldItems.length;
                const isCollapsed = collapsedGroups[`bld_${bldKey}`];

                return (
                  <div
                    key={bldKey}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isAllDone
                        ? 'bg-emerald-50/50 border-emerald-300'
                        : 'bg-indigo-50/40 border-indigo-200'
                    }`}
                  >
                    {/* Collapsible Card Header */}
                    <div
                      onClick={() => toggleGroupCollapse(`bld_${bldKey}`)}
                      className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-black/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Building2 className="w-5 h-5 text-indigo-600 shrink-0" />
                        <div className="min-w-0">
                          <h4 className="font-black text-sm text-slate-900 truncate">
                            {bldKey}
                          </h4>
                          <span className="text-[11px] font-bold text-indigo-700">
                            {bldItems.length} apartamento(s) neste prédio
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                            isAllDone
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {bldCompleted}/{bldItems.length} Feito
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBulkStreetName(bldKey);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                          title={`Repassar todos os pacotes pendentes do prédio ${bldKey}`}
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Repassar Prédio</span>
                        </button>
                        {isCollapsed ? (
                          <ChevronDown className="w-5 h-5 text-slate-500" />
                        ) : (
                          <ChevronUp className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                    </div>

                    {/* Accordion Content */}
                    {!isCollapsed && (
                      <div className="p-4 pt-0 border-t border-indigo-100/80 space-y-2 mt-2">
                        {[...bldItems]
                          .sort((a, b) => {
                            if (a.status === 'aguardando_pin' && b.status !== 'aguardando_pin') return -1;
                            if (a.status !== 'aguardando_pin' && b.status === 'aguardando_pin') return 1;
                            return 0;
                          })
                          .map((item) => (
                          <div
                            key={item.id_entrega}
                            className={`${
                              item.status === 'aguardando_pin'
                                ? 'bg-amber-50/90 border-2 border-amber-400 shadow-md'
                                : 'bg-white border-slate-200 shadow-2xs'
                            } p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md">
                                  {item.complemento || item.endereco_complemento || 'Apto'}
                                </span>
                                <span className="font-bold text-slate-900">
                                  {item.nome_destinatario || item.recebedor_detalhes}
                                </span>
                                {item.status === 'aguardando_pin' && (
                                  <span className="text-[10px] font-black bg-amber-100 text-amber-950 px-2.5 py-0.5 rounded-full border border-amber-400 flex items-center gap-1 shadow-2xs">
                                    <CheckCircle2 className="w-3 h-3 text-amber-700 shrink-0" />
                                    <span>✅ Entregue na Rua (PIN Pendente)</span>
                                  </span>
                                )}
                                {item.palavra_chave && (
                                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-full border border-emerald-400 flex items-center gap-1 shadow-2xs">
                                    <Key className="w-3 h-3 text-emerald-700 shrink-0" />
                                    🔑 PIN Registrado: {item.palavra_chave}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[10px] text-slate-400 block">
                                  Cód: {item.codigo_pacote}
                                </span>
                                {(item.origem_leitura === 'ocr_ai' || Boolean(item.nome_destinatario && (item.endereco_completo || item.endereco_rua))) && (
                                  <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" /> ✅ Confirmado via Visão Computacional
                                  </span>
                                )}
                              </div>
                            </div>

                            {item.status === 'concluido' || item.status === 'entregue' || item.status === 'processado_jt' ? (
                              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Entregue
                              </span>
                            ) : item.status === 'aguardando_pin' ? (
                              <span className="text-[10px] font-extrabold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-full flex items-center gap-1 border border-amber-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span>✅ Entregue na Rua (PIN Pendente)</span>
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => openDeliveryCompletionModal(item)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-2.5 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer shadow-2xs"
                                >
                                  <Camera className="w-3.5 h-3.5" /> Dar Baixa
                                </button>
                                <button
                                  onClick={() => {
                                    setTransferPackageModal(item);
                                    setTransferTargetHelper('');
                                    setTransferCustomHelper('');
                                    setTransferNote('');
                                  }}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-2 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer border border-slate-300 transition-all"
                                  title="Passar pacote para outro ajudante"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Passar</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BLOCO 2: 🏠 RUAS E LOGRADOUROS (ENTREGAS CASA A CASA) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  🏠 Ruas & Logradouros (Entregas Casa a Casa)
                </h3>
                <p className="text-xs text-slate-500">
                  Sequência de entregas organizadas por rua para residências térreas e sobrados.
                </p>
              </div>
            </div>
            <span className="text-xs font-black bg-blue-50 text-blue-800 px-3 py-1 rounded-full border border-blue-200">
              {streetDeliveries.length} Pacotes
            </span>
          </div>

          {Object.keys(streetGroups).length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center italic">
              Nenhum pacote de rua cadastrado no inventário ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(streetGroups).map(([stKey, stItems]) => {
                const stCompleted = stItems.filter((i) => i.status === 'concluido').length;
                const isAllDone = stCompleted === stItems.length;
                const isCollapsed = collapsedGroups[`st_${stKey}`];

                return (
                  <div key={stKey} className="bg-slate-50/80 rounded-2xl border border-slate-200 overflow-hidden">
                    {/* Collapsible Header */}
                    <div
                      onClick={() => toggleGroupCollapse(`st_${stKey}`)}
                      className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
                        <div className="min-w-0">
                          <h4 className="font-black text-sm text-slate-900 truncate">
                            {stKey}
                          </h4>
                          <span className="text-[11px] font-bold text-blue-700">
                            {stItems.length} entrega(s) nesta rua
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                            isAllDone
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {stCompleted}/{stItems.length} Feito
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBulkStreetName(stKey);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                          title={`Repassar todos os pacotes pendentes da rua ${stKey}`}
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Repassar Rua</span>
                        </button>
                        {isCollapsed ? (
                          <ChevronDown className="w-5 h-5 text-slate-500" />
                        ) : (
                          <ChevronUp className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                    </div>

                    {/* Accordion Content */}
                    {!isCollapsed && (
                      <div className="p-4 pt-0 border-t border-slate-200 space-y-3 mt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {[...stItems]
                            .sort((a, b) => {
                              if (a.status === 'aguardando_pin' && b.status !== 'aguardando_pin') return -1;
                              if (a.status !== 'aguardando_pin' && b.status === 'aguardando_pin') return 1;
                              return 0;
                            })
                            .map((item) => (
                            <div
                              key={item.id_entrega}
                              className={`${
                                item.status === 'aguardando_pin'
                                  ? 'bg-amber-50/90 border-2 border-amber-400 shadow-md'
                                  : 'bg-white border-slate-200 shadow-xs'
                              } p-3.5 rounded-2xl border space-y-2.5`}
                            >
                              <div className="flex justify-between items-start">
                                <span className="font-black text-xs text-slate-900">
                                  Nº {item.numero_casa || item.endereco_numero || 'S/N'}
                                </span>
                                <span className="font-mono text-[10px] text-blue-700 font-extrabold bg-blue-50 px-2 py-0.5 rounded">
                                  {item.codigo_pacote}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <p className="font-black text-xs text-slate-800 truncate">
                                  {item.nome_destinatario || item.recebedor_detalhes}
                                </p>
                                {item.status === 'aguardando_pin' && (
                                  <span className="text-[10px] font-black bg-amber-100 text-amber-950 px-2.5 py-0.5 rounded-full border border-amber-400 shrink-0 flex items-center gap-1 shadow-2xs">
                                    <CheckCircle2 className="w-3 h-3 text-amber-700 shrink-0" />
                                    <span>✅ Entregue na Rua (PIN Pendente)</span>
                                  </span>
                                )}
                                {item.palavra_chave && (
                                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-full border border-emerald-400 shrink-0 flex items-center gap-1 shadow-2xs">
                                    <Key className="w-3 h-3 text-emerald-700 shrink-0" />
                                    🔑 PIN Registrado: {item.palavra_chave}
                                  </span>
                                )}
                              </div>

                              {(item.origem_leitura === 'ocr_ai' || Boolean(item.nome_destinatario && (item.endereco_completo || item.endereco_rua))) && (
                                <p className="text-[9px] font-extrabold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1 my-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" /> ✅ Confirmado via Visão Computacional
                                </p>
                              )}

                              {item.complemento && (
                                <p className="text-[11px] text-slate-500 font-medium">
                                  Ref: {item.complemento}
                                </p>
                              )}

                              <div className="pt-2 border-t border-slate-100 space-y-2">
                                {item.status === 'concluido' || item.status === 'entregue' || item.status === 'processado_jt' ? (
                                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center justify-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Entregue
                                  </span>
                                ) : item.status === 'aguardando_pin' ? (
                                  <div className="space-y-1 text-center">
                                    <span className="text-[10px] font-extrabold text-amber-900 bg-amber-100 px-2.5 py-1.5 rounded-xl flex items-center justify-center gap-1 border border-amber-300 w-full">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                      <span>✅ Entregue na Rua (PIN Pendente)</span>
                                    </span>
                                    <p className="text-[9px] font-bold text-slate-500 italic">
                                      Aguardando validação do PIN no Painel da Mãe
                                    </p>
                                  </div>
                                ) : item.status === 'insucesso' ? (
                                  <span className="text-[10px] font-extrabold text-rose-800 bg-rose-100 px-2.5 py-1 rounded-full flex items-center justify-center gap-1 border border-rose-200">
                                    ❌ Não Entregue: {item.motivo_insucesso || 'Cliente Ausente'}
                                  </span>
                                ) : (
                                  <div className="space-y-1.5">
                                    <button
                                      onClick={() => openDeliveryCompletionModal(item)}
                                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                    >
                                      <Camera className="w-3.5 h-3.5" /> Bater Foto / Dar Baixa
                                    </button>

                                    <div className="grid grid-cols-2 gap-1.5">
                                      <button
                                        onClick={() => {
                                          openDeliveryCompletionModal(item);
                                          setIsPinMode(true);
                                        }}
                                        className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold py-1 px-2 rounded-lg text-center cursor-pointer flex items-center justify-center gap-1"
                                      >
                                        <Key className="w-3 h-3 text-amber-700 shrink-0" />
                                        <span>🔒 Requer PIN</span>
                                      </button>

                                      <button
                                        onClick={() => {
                                          setActiveDeliveryForInsucesso(item);
                                          setInsucessoPhoto(null);
                                          setInsucessoPhotoError(null);
                                        }}
                                        className="bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold py-1 px-2 rounded-lg text-center cursor-pointer flex items-center justify-center gap-1"
                                      >
                                        <AlertTriangle className="w-3 h-3 text-rose-700 shrink-0" />
                                        <span>❌ Não Entregue</span>
                                      </button>
                                    </div>

                                    <button
                                      onClick={() => {
                                        setTransferPackageModal(item);
                                        setTransferTargetHelper('');
                                        setTransferCustomHelper('');
                                        setTransferNote('');
                                      }}
                                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold py-1 px-2 rounded-lg text-center cursor-pointer flex items-center justify-center gap-1 border border-slate-300 transition-all"
                                    >
                                      <RefreshCw className="w-3 h-3 text-indigo-600 shrink-0" />
                                      <span>🔄 Passar Pacote (Repasse na Rua)</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BLOCO 3: 📦 SACAS DAS ASSOCIAÇÕES (TRIAGEM DA MANHÃ) */}
        <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-purple-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-purple-800/80 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-purple-600 text-white rounded-2xl shadow-sm">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  📦 Sacas das Associações (Triagem da Manhã)
                </h3>
                <p className="text-xs text-purple-200">
                  Agrupamento automático de pacotes por Saca da Associação. Permite repasse em lote de toda a saca para entregadores.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={onOpenAssociationsTab}
                className="bg-purple-500 hover:bg-purple-400 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer active:scale-95 border border-purple-300/30"
              >
                <Plus className="w-4 h-4" />
                <span>➕ Cadastrar / Desenhar Nova Associação</span>
              </button>

              <span className="text-xs font-black bg-purple-800/60 text-purple-200 px-3.5 py-2 rounded-xl border border-purple-600/50">
                Total: {associationDeliveries.length} Pacotes Mapeados
              </span>
            </div>
          </div>

          {/* Association Manager Modal */}
          <AssociationManagerModal
            associations={associations}
            memoryRecords={memoryRecords}
            isOpen={isAssocModalOpen}
            onClose={() => setIsAssocModalOpen(false)}
            onAddAssociation={onAddAssociation}
            onUpdateAssociation={onUpdateAssociation}
            onDeleteAssociation={onDeleteAssociation}
            onAddMemoryRecord={onAddMemoryRecord}
            onDeleteMemoryRecord={onDeleteMemoryRecord}
          />

          {associationDeliveries.length === 0 ? (
            <div className="bg-purple-950/40 border border-purple-800/50 rounded-2xl p-6 text-center space-y-2">
              <p className="text-xs text-purple-300 font-medium">
                Nenhum pacote vinculado a Associação no inventário do {selectedHelper}.
              </p>
              <p className="text-[11px] text-purple-400">
                Os pacotes bipados com endereço, morador ou local dentro da cerca virtual de uma Associação aparecerão aqui agrupados em Sacas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Group associationDeliveries by association name */}
              {Array.from(new Set(associationDeliveries.map((d) => d.associacao_nome || 'Associação Comunitária'))).map((assocName) => {
                const sacaItems = associationDeliveries.filter(
                  (d) => (d.associacao_nome || 'Associação Comunitária') === assocName
                );
                const assocObj = associations.find((a) => a.nome === assocName);
                const isSacaOpen = !collapsedGroups[`saca_${assocName}`];

                return (
                  <div
                    key={assocName}
                    className="bg-slate-900/90 rounded-2xl border-2 border-purple-700/80 overflow-hidden shadow-lg space-y-3 p-4 sm:p-5"
                  >
                    {/* Saca Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-800/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">📦</span>
                        <div>
                          <h4 className="font-black text-base text-white flex items-center gap-2">
                            <span>Saca da Associação:</span>
                            <span className="text-purple-300 underline underline-offset-4">{assocName}</span>
                          </h4>
                          <p className="text-xs text-purple-200 mt-0.5 flex items-center gap-2">
                            <span> Recebedor Sede: <strong>{assocObj?.recebedor_padrao || sacaItems[0]?.recebedor_detalhes || 'Sede'}</strong></span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Bulk Repasse Button */}
                        <button
                          onClick={() => setBulkSacaAssocName(assocName)}
                          className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-purple-200" />
                          <span>🚚 Repassar Saca Inteira ({sacaItems.length})</span>
                        </button>

                        {/* Manifest Button */}
                        <button
                          onClick={() => {
                            setSelectedAssocForManifest(assocName);
                            setShowAssocManifestModal(true);
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-purple-200 font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1 cursor-pointer border border-purple-800"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>📄 Manifesto</span>
                        </button>

                        <button
                          onClick={() => toggleGroupCollapse(`saca_${assocName}`)}
                          className="text-purple-300 hover:text-white p-1"
                        >
                          {isSacaOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Saca Content / Package List */}
                    {isSacaOpen && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {sacaItems.map((item) => (
                          <div
                            key={item.id_entrega}
                            className="bg-slate-950/80 p-3.5 rounded-xl border border-purple-950 space-y-2.5 shadow-xs"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-extrabold text-xs text-white">
                                  {item.nome_destinatario || item.recebedor_detalhes || 'Morador da Associação'}
                                </h5>
                                <p className="text-[11px] text-slate-300 mt-0.5">
                                  📍 {item.endereco_completo || item.endereco_rua || item.bairro} {item.numero_casa ? `, Nº ${item.numero_casa}` : ''}
                                </p>
                              </div>
                              <span className="font-mono text-xs text-purple-300 font-black">
                                {item.codigo_pacote}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                              <span className="text-slate-400">Entregador: <strong className="text-white">{item.ajudante_nome || selectedHelper}</strong></span>
                              {item.status === 'concluido' || item.status === 'entregue' ? (
                                <span className="text-emerald-400 font-black">✅ Concluído</span>
                              ) : (
                                <button
                                  onClick={() => openDeliveryCompletionModal(item)}
                                  className="bg-purple-700 hover:bg-purple-600 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                                >
                                  <Camera className="w-3 h-3" />
                                  <span>Dar Baixa na Sede</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL BULK REPASSE DE SACA INTEIRA */}
      {bulkSacaAssocName && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-purple-300">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-800 rounded-xl">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Repassar Saca Inteira
                  </h3>
                  <p className="text-xs text-purple-700 font-bold">
                    Associação: {bulkSacaAssocName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBulkSacaAssocName(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Selecione o entregador que assumirá a responsabilidade por <strong>TODOS OS PACOTES</strong> desta Saca de Associação:
              </p>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Selecione o Novo Entregador / Ajudante:
                </label>
                <select
                  value={bulkSacaTargetHelper}
                  onChange={(e) => setBulkSacaTargetHelper(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {HELPER_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setBulkSacaAssocName(null)}
                className="bg-slate-100 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleExecuteBulkSacaTransfer(bulkSacaAssocName, bulkSacaTargetHelper)}
                className="bg-purple-700 hover:bg-purple-800 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Repasse em Bloco</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BULK REPASSE DE RUA / PRÉDIO ESPECÍFICO */}
      {bulkStreetName && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-blue-300">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Repassar Rua / Grupo Específico
                  </h3>
                  <p className="text-xs text-blue-700 font-bold">
                    Local: {bulkStreetName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setBulkStreetName(null);
                  setBulkStreetCustomHelper('');
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Selecione o ajudante que receberá <strong>EXCLUSIVAMENTE OS PACOTES PENDENTES</strong> desta rua/local:
              </p>
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 font-semibold">
                ℹ️ <strong>Isolamento Total:</strong> Pacotes já entregues nesta rua e pacotes de outras ruas permanecem intactos no inventário do ajudante atual.
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Selecione o Novo Entregador / Ajudante:
                </label>
                <select
                  value={bulkStreetTargetHelper}
                  onChange={(e) => setBulkStreetTargetHelper(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from(new Set([...HELPER_PRESETS, ...deliveries.map((d) => d.ajudante_nome).filter((n): n is string => Boolean(n && n.trim()))]))
                    .filter((h) => h !== selectedHelper)
                    .map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                  <option value="OUTRO">+ Outro Ajudante (Digitar Nome)...</option>
                </select>

                {bulkStreetTargetHelper === 'OUTRO' && (
                  <input
                    type="text"
                    value={bulkStreetCustomHelper}
                    onChange={(e) => setBulkStreetCustomHelper(e.target.value)}
                    placeholder="Digite o nome do novo ajudante..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-blue-500 mt-2"
                  />
                )}
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBulkStreetName(null);
                    setBulkStreetCustomHelper('');
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteBulkStreetTransfer(bulkStreetName, bulkStreetTargetHelper)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Confirmar Repasse de Rua</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: EDITAR ENDEREÇO / DESTINATÁRIO MANUALMENTE (PRÉ-PREENCHIDO COM IA) */}
      {showQuickEditModal && (
        <div className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Preenchimento Rápido da Etiqueta
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isPartialOcrModal
                      ? '✨ Foto lida com sucesso! Complete os campos em branco.'
                      : 'Preencha os dados identificados na etiqueta do pacote.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowQuickEditModal(false);
                  setIsPartialOcrModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Foto da Etiqueta no Topo */}
            {packagePhoto && (
              <div className="relative rounded-2xl overflow-hidden border border-slate-300 bg-slate-950 aspect-[16/9] max-h-44 flex items-center justify-center shadow-xs">
                <img src={packagePhoto} alt="Foto da Etiqueta" className="w-full h-full object-contain" />
                <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-md border border-white/20">
                  📷 Foto da Etiqueta Registrada
                </div>
              </div>
            )}

            {isPartialOcrModal && (
              <div className="bg-purple-50 border border-purple-200 p-2.5 rounded-xl text-xs text-purple-900 font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Os campos preenchidos foram extraídos da foto. Preencha apenas os campos em branco!</span>
              </div>
            )}

            {formValidationError && (
              <div className="bg-rose-50 border-2 border-rose-400 p-3 rounded-2xl text-xs font-black text-rose-900 flex items-start gap-2 shadow-sm animate-pulse">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <span>{formValidationError}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuickEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>Código do Pacote / Rastreamento *</span>
                  {!manualCode.trim() && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Em branco
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  value={manualCode}
                  onChange={(e) => {
                    setManualCode(e.target.value.toUpperCase());
                    setFormValidationError(null);
                  }}
                  placeholder="Ex: JT100200300BR"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>Nome do Destinatário (Morador/Cliente)</span>
                  {!manualRecipient.trim() && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Em branco
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={manualRecipient}
                  onChange={(e) => setManualRecipient(e.target.value)}
                  placeholder="Ex: Maria Silva Santos"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1 flex items-center justify-between">
                    <span>Nome da Rua *</span>
                    {manualStreet.trim() === '' && (
                      <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">
                        Obrigatório
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={manualStreet}
                    onChange={(e) => {
                      setManualStreet(e.target.value);
                      setFormValidationError(null);
                    }}
                    placeholder="Ex: Avenida Brasil"
                    className={`w-full bg-slate-50 border rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-none transition-all ${
                      manualStreet.trim() === ''
                        ? 'border-rose-400 focus:border-rose-600 bg-rose-50/40'
                        : 'border-slate-300 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Número da Casa / Prédio
                  </label>
                  <input
                    type="text"
                    value={manualNumber}
                    onChange={(e) => setManualNumber(e.target.value)}
                    placeholder="Ex: 120"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Complemento (Apto / Bloco)
                  </label>
                  <input
                    type="text"
                    value={manualComplement}
                    onChange={(e) => setManualComplement(e.target.value)}
                    placeholder="Ex: Apto 101"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1 flex items-center justify-between">
                    <span>Bairro *</span>
                    {manualBairro.trim() === '' && (
                      <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">
                        Obrigatório
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={manualBairro}
                    onChange={(e) => {
                      setManualBairro(e.target.value);
                      setFormValidationError(null);
                    }}
                    placeholder="Ex: Bonsucesso"
                    className={`w-full bg-slate-50 border rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-none transition-all ${
                      manualBairro.trim() === ''
                        ? 'border-rose-400 focus:border-rose-600 bg-rose-50/40'
                        : 'border-slate-300 focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* Toggle if building */}
              <label className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={manualIsBuilding}
                  onChange={(e) => setManualIsBuilding(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="font-bold text-slate-800 text-xs">
                  É um Prédio / Condomínio Verticalizado (Múltiplos apartamentos no mesmo número)?
                </span>
              </label>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickEditModal(false);
                    setIsPartialOcrModal(false);
                    setFormValidationError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={manualStreet.trim() === '' || manualBairro.trim() === '' || manualCode.trim() === ''}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Salvar e Continuar Bipando</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BATER FOTO DO LOCAL / CONCLUIR ENTREGA */}
      {activeDeliveryToComplete && (() => {
        const hasPkgPhoto = Boolean(
          completionPackagePhoto &&
          completionPackagePhoto.trim().length > 0 &&
          !completionPackagePhoto.includes('unsplash')
        );
        const hasLocPhoto = Boolean(
          locationPhoto &&
          locationPhoto.trim().length > 0 &&
          !locationPhoto.includes('unsplash')
        );
        const hasReceiverName = Boolean(
          receiverDetails.trim() ||
          (activeDeliveryToComplete.nome_destinatario && activeDeliveryToComplete.nome_destinatario.trim().length > 0)
        );
        const pinValid = !isPinMode || Boolean(pinInput.trim());
        const hasAllPhotosAndName = hasPkgPhoto && hasLocPhoto && hasReceiverName;
        const canSubmit = hasAllPhotosAndName && pinValid;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900">
                      Bater Foto & Dar Baixa (Esteira J&T)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pacote {activeDeliveryToComplete.codigo_pacote}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveDeliveryToComplete(null);
                    setCompletionPackagePhoto(null);
                    setLocationPhoto(null);
                    setPinError(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Checklist visual de liberação para Esteira */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-[11px] space-y-1.5">
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  📋 Critérios Obrigatórios para Esteira J&T:
                </p>
                <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                  <span className={`px-2 py-0.5 rounded-full border ${hasPkgPhoto ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                    {hasPkgPhoto ? '✅ Foto do Pacote' : '❌ Foto do Pacote (Falta)'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full border ${hasLocPhoto ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                    {hasLocPhoto ? '✅ Foto do Local' : '❌ Foto do Local (Falta)'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full border ${hasReceiverName ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                    {hasReceiverName ? '✅ Nome do Recebedor' : '❌ Nome do Recebedor (Falta)'}
                  </span>
                  {isPinMode && (
                    <span className={`px-2 py-0.5 rounded-full border ${pinInput.trim() ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-300'}`}>
                      {pinInput.trim() ? '✅ PIN Digitado' : '🔑 PIN Numérico Exigido'}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <p className="font-bold text-slate-700">
                    Destinatário: <strong className="text-slate-900">{activeDeliveryToComplete.nome_destinatario || activeDeliveryToComplete.recebedor_detalhes || 'A definir'}</strong>
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    📍 {activeDeliveryToComplete.endereco_completo || activeDeliveryToComplete.endereco_rua || activeDeliveryToComplete.bairro || 'Endereço Principal'}
                    {activeDeliveryToComplete.numero_casa ? `, Nº ${activeDeliveryToComplete.numero_casa}` : ''}
                    {activeDeliveryToComplete.complemento ? ` (${activeDeliveryToComplete.complemento})` : ''}
                  </p>
                </div>

                {/* SEÇÃO DE VALIDAÇÃO DE PIN / PALAVRA-CHAVE */}
                <div className="bg-amber-50/90 p-3 rounded-2xl border border-amber-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-black text-amber-950">
                      <input
                        type="checkbox"
                        checked={isPinMode}
                        onChange={(e) => {
                          setIsPinMode(e.target.checked);
                          setPinError(null);
                        }}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        <Key className="w-4 h-4 text-amber-700" />
                        🔑 Entregar com PIN / Palavra-Chave
                      </span>
                    </label>

                    {activeDeliveryToComplete.palavra_chave && (
                      <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md border border-amber-400">
                        PIN Cadastrado
                      </span>
                    )}
                  </div>

                  {isPinMode && (
                    <div className="space-y-1.5 pt-2 border-t border-amber-200">
                      <label className="block text-[11px] font-extrabold text-amber-900">
                        Digite o Código Numérico (PIN) do Cliente *:
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={pinInput}
                        onChange={(e) => {
                          setPinInput(e.target.value);
                          setPinError(null);
                        }}
                        placeholder="Ex: 4829 (somente números)..."
                        className="w-full bg-white border-2 border-amber-400 rounded-xl px-3 py-2 text-sm font-mono font-black text-amber-950 placeholder-amber-400 focus:outline-none focus:border-amber-600 shadow-inner"
                      />
                      {pinError && (
                        <p className="text-[11px] font-black text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-300">
                          {pinError}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 1. Package Photo */}
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1.5 flex items-center justify-between">
                    <span>1. Foto do Pacote no Local / Fachada *</span>
                    {hasPkgPhoto ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">✅ Capturada</span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">Exigido</span>
                    )}
                  </label>
                  {hasPkgPhoto ? (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-300">
                      <img src={completionPackagePhoto!} alt="Foto do pacote" className="w-full h-32 object-cover" />
                      <button
                        onClick={() => setCompletionPackagePhoto(null)}
                        className="absolute top-2 right-2 bg-slate-900/80 text-white px-2 py-1 rounded-md text-[10px] font-bold hover:bg-slate-900 cursor-pointer"
                      >
                        Trocar Foto
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 bg-slate-50 border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-2xl cursor-pointer text-center space-y-1">
                      <Camera className="w-6 h-6 text-indigo-600" />
                      <span className="font-bold text-indigo-700 text-xs">Capturar Foto do Pacote no Local / Fachada</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const r = new FileReader();
                            r.onload = (ev) => setCompletionPackagePhoto(ev.target?.result as string);
                            r.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* 2. Location Photo */}
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1.5 flex items-center justify-between">
                    <span>2. Foto do Pacote na Mão do Recebedor / Quem Recebeu *</span>
                    {hasLocPhoto ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">✅ Capturada</span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">Exigido</span>
                    )}
                  </label>
                  {hasLocPhoto ? (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-300">
                      <img src={locationPhoto!} alt="Foto local" className="w-full h-32 object-cover" />
                      <button
                        onClick={() => setLocationPhoto(null)}
                        className="absolute top-2 right-2 bg-slate-900/80 text-white px-2 py-1 rounded-md text-[10px] font-bold hover:bg-slate-900 cursor-pointer"
                      >
                        Trocar Foto
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 bg-slate-50 border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl cursor-pointer text-center space-y-1">
                      <Camera className="w-6 h-6 text-blue-600" />
                      <span className="font-bold text-blue-700 text-xs">Capturar Foto na Mão do Recebedor</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const r = new FileReader();
                            r.onload = (ev) => setLocationPhoto(ev.target?.result as string);
                            r.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* 3. Receiver details */}
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Quem recebeu o pacote?
                  </label>
                  <select
                    value={receiverType}
                    onChange={(e) => setReceiverType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="proprio_morador">Próprio Morador / Destinatário</option>
                    <option value="vizinho">Vizinho / Portaria do Edifício</option>
                    <option value="estabelecimento">Comércio / Estabelecimento Local</option>
                    <option value="associacao">Sede da Associação Comunitária</option>
                  </select>
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1 flex items-center justify-between">
                    <span>3. Nome do Recebedor *</span>
                    {hasReceiverName ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">✅ Preenchido</span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">Exigido</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={receiverDetails}
                    onChange={(e) => setReceiverDetails(e.target.value)}
                    placeholder={activeDeliveryToComplete.nome_destinatario || 'Ex: Porteiro Marcos / Dona Maria'}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {pinError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold rounded-xl animate-fadeIn">
                    {pinError}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex flex-wrap gap-2 justify-between items-center">
                    <div className="flex flex-col gap-1 max-w-sm">
                      <button
                        type="button"
                        disabled={!hasAllPhotosAndName || Boolean(pinInput && pinInput.trim().length > 0)}
                        onClick={handleMarkWaitingPin}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 border border-amber-600 cursor-pointer transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:shadow-none"
                        title={!hasAllPhotosAndName ? "Tire as 2 fotos e informe o recebedor para habilitar este botão." : pinInput.trim() ? "PIN já digitado no campo acima. Use 'Confirmar Entrega'." : "Registrar como entregue pendente de PIN"}
                      >
                        <Key className="w-4 h-4 text-slate-950 shrink-0" />
                        <span>🟡 Entregue ao Cliente (PIN Pendente / Envia Depois)</span>
                      </button>

                      {!hasAllPhotosAndName ? (
                        <span className="text-[10px] font-extrabold text-rose-600 italic flex items-center gap-1">
                          ❌ Para habilitar este botão, capture as 2 FOTOS e informe o Recebedor.
                        </span>
                      ) : Boolean(pinInput && pinInput.trim().length > 0) ? (
                        <span className="text-[10px] font-extrabold text-slate-500 italic flex items-center gap-1">
                          🔒 PIN digitado! Clique em "Confirmar Entrega" ao lado.
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-800 italic">
                          ⚠️ Com as 2 fotos tiradas, registrará status 🟡 'Entregue (PIN Pendente)'.
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 ml-auto items-center flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const pkgToInsucesso = activeDeliveryToComplete;
                          setActiveDeliveryToComplete(null);
                          setCompletionPackagePhoto(null);
                          setLocationPhoto(null);
                          setPinError(null);
                          if (pkgToInsucesso) {
                            setActiveDeliveryForInsucesso(pkgToInsucesso);
                            setInsucessoPhoto(null);
                            setInsucessoPhotoError(null);
                          }
                        }}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold px-3 py-2 rounded-xl border border-rose-200 cursor-pointer text-xs flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>⚠️ Registrar Insucesso</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveDeliveryToComplete(null);
                          setCompletionPackagePhoto(null);
                          setLocationPhoto(null);
                          setPinError(null);
                        }}
                        className="px-3 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 cursor-pointer text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={!canSubmit}
                        onClick={handleConfirmDeliveryCompletion}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 text-xs disabled:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmar Entrega</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 3: MANIFESTO / GERAR LISTA DA ASSOCIAÇÃO */}
      {showAssocManifestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-purple-200 space-y-5 my-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-600 text-white rounded-2xl shadow-xs">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900">
                    📄 Lista da Associação (Manifesto Oficial de Carga)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Relação formatada de clientes e volumes para protocolo na Sede da Associação.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAssocManifestModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formatted Manifest Document Box */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 font-mono text-xs space-y-3 shadow-inner">
              <div className="border-b border-slate-300 pb-2 flex justify-between items-center text-slate-700 font-bold">
                <span>🚚 TRANSPORTADORA: J&T EXPRESS / SHOPEE</span>
                <span>DATA: {new Date().toLocaleDateString('pt-BR')}</span>
              </div>

              <div className="text-slate-800 space-y-1">
                <p><strong>ENTREGADOR:</strong> {selectedHelper}</p>
                <p><strong>DESTINO:</strong> {selectedAssocForManifest}</p>
                <p><strong>TOTAL PACOTES:</strong> {associationDeliveries.length} volume(s)</p>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-2">
                <p className="font-bold text-purple-900 uppercase tracking-wide">
                  📋 RELAÇÃO DE CLIENTES & VOLUMES:
                </p>

                {associationDeliveries.length === 0 ? (
                  <p className="italic text-slate-400 text-center py-2">Nenhum pacote para esta associação hoje.</p>
                ) : (
                  <div className="space-y-2">
                    {/* Group by recipient name */}
                    {Object.entries(
                      associationDeliveries.reduce((acc: { [key: string]: DeliveryData[] }, curr) => {
                        const name = curr.nome_destinatario || curr.recebedor_detalhes || 'Morador';
                        if (!acc[name]) acc[name] = [];
                        acc[name].push(curr);
                        return acc;
                      }, {} as { [key: string]: DeliveryData[] })
                    ).map(([clientName, pkgsGroup], idx) => {
                      const pkgs = pkgsGroup as DeliveryData[];
                      return (
                        <div key={clientName} className="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                          <div>
                            <strong className="text-slate-900">{idx + 1}. {clientName}</strong>
                            <p className="text-[10px] text-slate-500 font-sans">
                              Códigos: {pkgs.map((p) => p.codigo_pacote).join(', ')}
                            </p>
                          </div>
                          <span className="bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded-md text-[11px]">
                            {pkgs.length} pct(s)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const textToCopy = `📦 MANIFESTO ASSOCIAÇÃO COMUNITÁRIA J&T\nData: ${new Date().toLocaleDateString('pt-BR')}\nEntregador: ${selectedHelper}\nTotal: ${associationDeliveries.length} pacotes\n\nClIENTES:\n` +
                    associationDeliveries.map((d, i) => `${i + 1}. ${d.nome_destinatario || 'Morador'} - Cód: ${d.codigo_pacote}`).join('\n');
                  navigator.clipboard.writeText(textToCopy);
                  alert('📋 Lista copiada com sucesso! Cole no WhatsApp da Associação.');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-xs"
              >
                📋 Copiar Texto para WhatsApp
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  🖨️ Imprimir Manifesto
                </button>
                <button
                  type="button"
                  onClick={() => setShowAssocManifestModal(false)}
                  className="bg-slate-100 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: INSUCESSO DE ENTREGA (NÃO ENTREGUE) - TRAVA DE FOTO OBRIGATÓRIA */}
      {activeDeliveryForInsucesso && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200 space-y-4 my-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-xs">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Registrar Insucesso na Entrega
                  </h3>
                  <p className="text-xs text-rose-700 font-bold font-mono">
                    Pacote: {activeDeliveryForInsucesso.codigo_pacote}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveDeliveryForInsucesso(null);
                  setInsucessoPhoto(null);
                  setInsucessoPhotoError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Recipient / Address Summary */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900">
                  Destinatário: <span className="font-normal">{activeDeliveryForInsucesso.nome_destinatario || activeDeliveryForInsucesso.recebedor_detalhes || 'Morador'}</span>
                </p>
                <p className="text-[11px] text-slate-600">
                  📍 {activeDeliveryForInsucesso.endereco_completo || activeDeliveryForInsucesso.endereco_rua || 'Endereço'} {activeDeliveryForInsucesso.numero_casa ? `, Nº ${activeDeliveryForInsucesso.numero_casa}` : ''}
                </p>
              </div>

              {/* Reason Selector */}
              <div>
                <label className="font-extrabold text-slate-800 block mb-1">
                  1. Motivo do Insucesso *
                </label>
                <select
                  value={insucessoReason}
                  onChange={(e) => setInsucessoReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                >
                  <option value="Cliente Ausente (Ninguém atendeu)">👤 Cliente Ausente (Ninguém atendeu)</option>
                  <option value="Endereço Não Localizado / Incompleto">📍 Endereço Não Localizado / Incompleto</option>
                  <option value="Área de Risco / Segurança">⚠️ Área de Risco / Segurança</option>
                  <option value="Recusado pelo Destinatário / Portaria">🚪 Recusado pelo Destinatário / Portaria</option>
                  <option value="Empresa / Estabelecimento Fechado">🏢 Empresa / Estabelecimento Fechado</option>
                  <option value="Cliente não soube/passou Palavra-Chave (PIN)">🔑 Cliente não soube/passou Palavra-Chave (PIN)</option>
                  <option value="Outro Motivo Operacional">⚠️ Outro Motivo Operacional</option>
                </select>
              </div>

              {/* Mandatory Photo Evidence Box */}
              <div>
                <label className="font-extrabold text-slate-800 block mb-1 flex items-center justify-between">
                  <span>2. Foto de Evidência (Fachada / Portão) *</span>
                  <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    Obrigatória
                  </span>
                </label>

                {insucessoPhoto ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-rose-500 shadow-sm bg-slate-900">
                    <img
                      src={insucessoPhoto}
                      alt="Evidência do Insucesso"
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setInsucessoPhoto(null)}
                        className="bg-rose-600 text-white p-1.5 rounded-xl text-xs font-bold shadow-md hover:bg-rose-700 cursor-pointer flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-slate-900/90 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-500/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Foto de Evidência Capturada</span>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-rose-300 hover:border-rose-500 bg-rose-50/50 hover:bg-rose-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center">
                    <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-black text-rose-900 text-xs block">
                        📸 Tirar / Carregar Foto de Evidência
                      </span>
                      <span className="text-[10px] text-rose-700 font-medium">
                        Fotografe a fachada, portão fechado ou numeração
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const compressed = await compressFileCanvas(file);
                          setInsucessoPhoto(compressed);
                          setInsucessoPhotoError(null);
                        } catch (err) {
                          console.error("Erro foto insucesso:", err);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                )}

                {insucessoPhotoError && (
                  <p className="text-[11px] font-bold text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200 mt-2">
                    {insucessoPhotoError}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveDeliveryForInsucesso(null);
                    setInsucessoPhoto(null);
                    setInsucessoPhotoError(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!insucessoPhoto}
                  onClick={() => {
                    if (!insucessoPhoto) {
                      setInsucessoPhotoError("📸 FOTO OBRIGATÓRIA: Tire a foto da fachada/portão para liberar este botão.");
                      return;
                    }
                    onUpdateDelivery({
                      ...activeDeliveryForInsucesso,
                      status: 'insucesso',
                      motivo_insucesso: insucessoReason,
                      foto_local_path: insucessoPhoto,
                      foto_insucesso: insucessoPhoto,
                    });
                    setActiveDeliveryForInsucesso(null);
                    setInsucessoPhoto(null);
                    setInsucessoPhotoError(null);
                    setScanMessage({
                      type: 'warning',
                      text: `❌ Insucesso do pacote ${activeDeliveryForInsucesso.codigo_pacote} registrado com foto de evidência!`,
                    });
                    setTimeout(() => setScanMessage(null), 5000);
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-black px-5 py-2.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 text-xs disabled:bg-slate-200 disabled:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirmar Insucesso</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: REPASSE DIRETO DE PACOTE NA RUA ("PASSAR PACOTE") */}
      {transferPackageModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-indigo-200 space-y-4 my-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-xs">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    🔄 Passar Pacote (Repasse na Rua)
                  </h3>
                  <p className="text-xs text-indigo-700 font-bold font-mono">
                    Código: {transferPackageModal.codigo_pacote}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setTransferPackageModal(null);
                  setTransferTargetHelper('');
                  setTransferCustomHelper('');
                  setTransferNote('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900">
                  Destinatário: <span className="font-normal">{transferPackageModal.nome_destinatario || transferPackageModal.recebedor_detalhes || 'Morador'}</span>
                </p>
                <p className="text-[11px] text-slate-600">
                  📍 {transferPackageModal.endereco_completo || transferPackageModal.endereco_rua || 'Endereço'} {transferPackageModal.numero_casa ? `, Nº ${transferPackageModal.numero_casa}` : ''}
                </p>
                <p className="text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-200">
                  🚚 Ajudante Atual: <strong className="text-indigo-900">{transferPackageModal.ajudante_nome || selectedHelper}</strong>
                </p>
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">
                  Selecione o Novo Ajudante (Destino):
                </label>
                <div className="space-y-2">
                  {Array.from(new Set([...HELPER_PRESETS, ...deliveries.map(d => d.ajudante_nome).filter((n): n is string => Boolean(n && n.trim()))]))
                    .filter((hName) => hName !== (transferPackageModal.ajudante_nome || selectedHelper))
                    .map((hName) => (
                      <label
                        key={hName}
                        onClick={() => setTransferTargetHelper(hName)}
                        className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                          transferTargetHelper === hName
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-black shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800 font-bold'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>{hName}</span>
                        </div>
                        {transferTargetHelper === hName && (
                          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        )}
                      </label>
                    ))}

                  <label
                    onClick={() => setTransferTargetHelper('OUTRO')}
                    className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                      transferTargetHelper === 'OUTRO'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-black shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800 font-bold'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Outro Ajudante (Digitar Nome)</span>
                    </div>
                    {transferTargetHelper === 'OUTRO' && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    )}
                  </label>

                  {transferTargetHelper === 'OUTRO' && (
                    <input
                      type="text"
                      value={transferCustomHelper}
                      onChange={(e) => setTransferCustomHelper(e.target.value)}
                      placeholder="Digite o nome do novo ajudante..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-indigo-500 mt-2"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">
                  Observação do Repasse (Opcional):
                </label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Ex: Entregue na esquina da R. Brasil"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTransferPackageModal(null);
                    setTransferTargetHelper('');
                    setTransferCustomHelper('');
                    setTransferNote('');
                  }}
                  className="px-4 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!transferTargetHelper || (transferTargetHelper === 'OUTRO' && !transferCustomHelper.trim())}
                  onClick={() => {
                    const finalTarget = (transferTargetHelper === 'OUTRO' ? transferCustomHelper : transferTargetHelper).trim();
                    if (!finalTarget) return;

                    const nowStr = new Date().toLocaleString('pt-BR');
                    const logEntry = `🔄 Repasse na Rua: De '${transferPackageModal.ajudante_nome || selectedHelper}' para '${finalTarget}' em ${nowStr}${transferNote ? ` (Obs: ${transferNote})` : ''}`;
                    const newHistory = [...(transferPackageModal.historico_transferencia || []), logEntry];

                    onUpdateDelivery({
                      ...transferPackageModal,
                      ajudante_nome: finalTarget,
                      historico_transferencia: newHistory,
                    });

                    setScanMessage({
                      type: 'success',
                      text: `🔄 Pacote ${transferPackageModal.codigo_pacote} transferido para ${finalTarget}!`,
                    });

                    setTransferPackageModal(null);
                    setTransferTargetHelper('');
                    setTransferCustomHelper('');
                    setTransferNote('');
                    setTimeout(() => setScanMessage(null), 4000);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 text-xs disabled:bg-slate-200 disabled:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Confirmar Transferência</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: LEITOR EM CÂMERA ABERTA (MODO BIPAGEM CONTÍNUA / METRALHADORA) */}
      <ContinuousScannerModal
        isOpen={isContinuousScannerOpen}
        isPaused={Boolean(showQuickEditModal || activeDeliveryToComplete || showAssocManifestModal || activeDeliveryForInsucesso || transferPackageModal)}
        isProcessing={isOcrProcessing}
        onClose={() => {
          setIsContinuousScannerOpen(false);
          setActiveOcrNotice(null);
          setIsOcrProcessing(false);
        }}
        onScanCode={handleContinuousScanCode}
        modoContinuo={true}
        ocrNotice={activeOcrNotice}
        existingCodes={deliveries.map((d) => d.codigo_pacote)}
      />
    </div>
  );
};
