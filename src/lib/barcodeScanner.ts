import { MultiFormatReader, BarcodeFormat, RGBLuminanceSource, BinaryBitmap, HybridBinarizer } from '@zxing/library';
import jsQR from 'jsqr';
import { BarcodeScanResult } from '../types';

/**
 * Enhanced client-side barcode and QR code scanner
 * Tries ZXing multi-format reader on original and pre-processed (contrast-enhanced) image,
 * with jsQR fallback for QR codes.
 */
export async function decodeBarcodeFromImage(imageSrc: string): Promise<BarcodeScanResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({ success: false, code: null, message: 'Falha ao inicializar o contexto de imagem.' });
        }

        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        ctx.drawImage(img, 0, 0);

        // 1. Try ZXing on direct image canvas
        const resultDirect = scanCanvasWithZXing(canvas, ctx);
        if (resultDirect.success) {
          return resolve(resultDirect);
        }

        // 2. Try jsQR on direct image canvas
        const resultJsQR = scanCanvasWithJsQR(ctx, canvas.width, canvas.height);
        if (resultJsQR.success) {
          return resolve(resultJsQR);
        }

        // 3. Preprocess canvas (Grayscale + High Contrast) to catch faint or dim barcodes
        enhanceCanvasContrast(ctx, canvas.width, canvas.height);

        const resultEnhanced = scanCanvasWithZXing(canvas, ctx);
        if (resultEnhanced.success) {
          return resolve(resultEnhanced);
        }

        const resultEnhancedJsQR = scanCanvasWithJsQR(ctx, canvas.width, canvas.height);
        if (resultEnhancedJsQR.success) {
          return resolve(resultEnhancedJsQR);
        }

        // 4. Try pattern regex search on image name/metadata or common tracking patterns as last fallback
        // Return failure so driver can enter code manually or send to review
        resolve({
          success: false,
          code: null,
          message: 'Não foi possível ler o código automaticamente. A imagem pode estar desfocada ou escura.',
        });
      } catch (err) {
        console.error('Erro na análise da imagem:', err);
        resolve({
          success: false,
          code: null,
          message: 'Erro no processamento de visão computacional.',
        });
      }
    };

    img.onerror = () => {
      resolve({
        success: false,
        code: null,
        message: 'Falha ao carregar o arquivo de imagem para leitura.',
      });
    };

    img.src = imageSrc;
  });
}

function scanCanvasWithZXing(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): BarcodeScanResult {
  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const luminanceSource = new RGBLuminanceSource(
      new Uint8ClampedArray(imageData.data.buffer),
      canvas.width,
      canvas.height
    );
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

    const reader = new MultiFormatReader();
    // Enable hints for fast scan
    const result = reader.decode(binaryBitmap);

    if (result && result.getText()) {
      const code = result.getText().trim();
      const formatStr = result.getBarcodeFormat() ? String(result.getBarcodeFormat()) : 'Desconhecido';
      return {
        success: true,
        code: code,
        format: formatStr,
        message: 'Código lido com sucesso!',
      };
    }
  } catch (_e) {
    // ZXing throws NotFoundException when no code is found, which is normal
  }

  return { success: false, code: null };
}

function scanCanvasWithJsQR(ctx: CanvasRenderingContext2D, width: number, height: number): BarcodeScanResult {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const qrCode = jsQR(imageData.data, width, height);
    if (qrCode && qrCode.data) {
      return {
        success: true,
        code: qrCode.data.trim(),
        format: 'QR_CODE',
        message: 'QR Code lido com sucesso!',
      };
    }
  } catch (_e) {
    // ignore
  }
  return { success: false, code: null };
}

function enhanceCanvasContrast(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Contrast enhancement and thresholding for barcode optimization
  const factor = 1.8; // contrast multiplier
  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    
    // Contrast adjustment
    let contrastGray = factor * (gray - 128) + 128;
    contrastGray = Math.max(0, Math.min(255, contrastGray));

    data[i] = contrastGray;     // Red
    data[i + 1] = contrastGray; // Green
    data[i + 2] = contrastGray; // Blue
  }
  ctx.putImageData(imageData, 0, 0);
}
