// src/utils/billOcr.js
// Runs in the browser, so the bill photo stays on this device. The engine and language files
// download on first use, which needs internet; the library is loaded only when someone scans.
const MIN_WIDTH = 2000;

// Small receipt text reads far better once enlarged and turned grey.
const prepareImage = async (file) => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(1, MIN_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  context.filter = 'grayscale(1) contrast(1.3)';
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
};

// mode is the OCR page layout: 3 reads most bills best, 4 can recover lines that 3 could not.
export const readBillText = async (file, onProgress, mode = '3') => {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: ({ status, progress }) => {
      if (status === 'recognizing text') onProgress(Math.round(progress * 100));
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: mode });
    const { data } = await worker.recognize(await prepareImage(file));
    return data.text;
  } finally {
    await worker.terminate();
  }
};
