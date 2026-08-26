/**
 * Utility for HTML5 Canvas Image Compression
 * - Max width: 1024px (maintains aspect ratio)
 * - Output format: image/jpeg with quality 0.6 (60%)
 * - Target payload size: < 300KB base64 string
 * - Prevents mobile browser crashes due to RAM exhaustion during consecutive photo captures
 */

export async function compressImageCanvas(
  sourceUrl: string,
  maxWidth: number = 1024,
  initialQuality: number = 0.6,
  maxSizeBytes: number = 300 * 1024
): Promise<string> {
  if (!sourceUrl) return '';

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width || 1024;
        let height = img.naturalHeight || img.height || 768;

        // Resize if width > maxWidth
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(sourceUrl);
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        let quality = initialQuality;
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Approximate base64 payload size calculation: byteLength = (length * 3) / 4
        let base64Length = compressedDataUrl.length - (compressedDataUrl.indexOf(',') + 1);
        let sizeInBytes = Math.ceil((base64Length * 3) / 4);

        // Iterative compression if size exceeds maxSizeBytes (300KB)
        let attempts = 0;
        while (sizeInBytes > maxSizeBytes && quality > 0.15 && attempts < 5) {
          quality -= 0.1;
          attempts++;
          compressedDataUrl = canvas.toDataURL('image/jpeg', Math.max(0.15, quality));
          base64Length = compressedDataUrl.length - (compressedDataUrl.indexOf(',') + 1);
          sizeInBytes = Math.ceil((base64Length * 3) / 4);
        }

        // If still large, scale canvas resolution further
        if (sizeInBytes > maxSizeBytes) {
          const scaleCanvas = document.createElement('canvas');
          scaleCanvas.width = Math.round(width * 0.7);
          scaleCanvas.height = Math.round(height * 0.7);
          const scaleCtx = scaleCanvas.getContext('2d');
          if (scaleCtx) {
            scaleCtx.drawImage(canvas, 0, 0, scaleCanvas.width, scaleCanvas.height);
            compressedDataUrl = scaleCanvas.toDataURL('image/jpeg', 0.5);
          }
        }

        resolve(compressedDataUrl);
      } catch (err) {
        console.error('Error compressing image canvas:', err);
        resolve(sourceUrl);
      }
    };

    img.onerror = () => {
      console.warn('Could not load image for compression, returning original');
      resolve(sourceUrl);
    };

    img.src = sourceUrl;
  });
}

/**
 * Reads a File object, compresses it via HTML5 Canvas, and returns base64 dataUrl
 */
export async function compressFileCanvas(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        resolve('');
        return;
      }
      const compressed = await compressImageCanvas(dataUrl);
      resolve(compressed);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
