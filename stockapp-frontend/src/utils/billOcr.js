// src/utils/billOcr.js
// Runs in the browser, so the bill photo stays on this device. The engine and language files
// download on first use, which needs internet; the library is loaded only when someone scans.
export const readBillText = async (file, onProgress) => {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: ({ status, progress }) => {
      if (status === 'recognizing text') onProgress(Math.round(progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
};
