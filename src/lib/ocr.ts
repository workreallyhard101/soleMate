import { createWorker } from 'tesseract.js';
import type { OcrResult } from '../types';
import { getWeekEndingSunday, toDateString } from './deadlineUtils';

export async function extractTextFromImage(file: File): Promise<string> {
  const worker = await createWorker('eng');
  const imageUrl = URL.createObjectURL(file);
  try {
    const { data } = await worker.recognize(imageUrl);
    return data.text;
  } finally {
    URL.revokeObjectURL(imageUrl);
    await worker.terminate();
  }
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: { str?: string }) => item.str || '')
      .join(' ');
    fullText += pageText + '\n';
  }

  if (fullText.trim().length < 20) {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
    const imageFile = new File([blob], 'page.png', { type: 'image/png' });
    fullText = await extractTextFromImage(imageFile);
  }

  return fullText;
}

function extractStepCount(text: string): number | null {
  const normalized = text.toLowerCase().replace(/,/g, '');

  const patterns = [
    /total\s+steps[:\s]+(\d{3,7})/,
    /steps[:\s]+(\d{3,7})/,
    /(\d{3,7})\s+steps/,
    /step\s+count[:\s]+(\d{3,7})/,
    /(\d{3,7})\s+step/,
    /walked[:\s]+(\d{3,7})/,
    /daily\s+total[:\s]+(\d{3,7})/,
    /weekly\s+total[:\s]+(\d{3,7})/,
    /total[:\s]+(\d{3,7})/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const steps = parseInt(match[1]);
      if (steps >= 100 && steps <= 500000) {
        return steps;
      }
    }
  }

  const allNumbers = normalized.match(/\b(\d{4,7})\b/g);
  if (allNumbers) {
    const candidates = allNumbers
      .map(Number)
      .filter((n) => n >= 1000 && n <= 500000)
      .sort((a, b) => b - a);
    if (candidates.length > 0) {
      return candidates[0];
    }
  }

  return null;
}

function extractDateRange(text: string): string | null {
  const datePatterns = [
    /([A-Za-z]+ \d{1,2}(?:,? \d{4})?\s*[-–—]\s*[A-Za-z]+ \d{1,2}(?:,? \d{4})?)/,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s*[-–—]\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?(?:,? \d{4})?)/,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?/i,
    /week\s+of\s+([A-Za-z]+\s+\d{1,2}(?:,?\s+\d{4})?)/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  return null;
}

function computeConfidence(steps: number | null, dateRange: string | null): import('../types').OcrConfidence {
  if (steps !== null && dateRange !== null) return 'high';
  if (steps !== null || dateRange !== null) return 'medium';
  return 'low';
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDateWithCurrentYear(matchStr: string): Date | null {
  const currentYear = new Date().getFullYear();

  const numericWithYear = matchStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (numericWithYear) {
    let year = parseInt(numericWithYear[3]);
    if (year < 100) year += 2000;
    const month = parseInt(numericWithYear[1]) - 1;
    const day = parseInt(numericWithYear[2]);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const monthNameMatch = matchStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i);
  if (monthNameMatch) {
    const month = MONTH_NAMES[monthNameMatch[1].toLowerCase().slice(0, 3)];
    const day = parseInt(monthNameMatch[2]);
    const year = monthNameMatch[3] ? parseInt(monthNameMatch[3]) : currentYear;
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function inferWeekEndingSunday(dateRange: string | null): Date | null {
  if (!dateRange) return null;

  const numericDateRe = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g;
  const monthNameDateRe = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/gi;

  const foundDates: Date[] = [];

  for (const match of dateRange.matchAll(numericDateRe)) {
    const d = parseDateWithCurrentYear(match[0]);
    if (d) foundDates.push(d);
  }

  for (const match of dateRange.matchAll(monthNameDateRe)) {
    const d = parseDateWithCurrentYear(match[0]);
    if (d) foundDates.push(d);
  }

  if (foundDates.length > 0) {
    const latest = foundDates.sort((a, b) => b.getTime() - a.getTime())[0];
    return getWeekEndingSunday(latest);
  }

  return null;
}

export async function processFile(file: File): Promise<OcrResult> {
  let rawText = '';

  if (file.type === 'application/pdf') {
    rawText = await extractTextFromPdf(file);
  } else {
    rawText = await extractTextFromImage(file);
  }

  const detectedSteps = extractStepCount(rawText);
  const detectedDateRange = extractDateRange(rawText);
  const confidence = computeConfidence(detectedSteps, detectedDateRange);
  const weekEndingSunday = inferWeekEndingSunday(detectedDateRange);

  return {
    rawText,
    detectedSteps,
    detectedDateRange,
    confidence,
    weekEndingSunday,
  };
}

export function validateFile(file: File): string | null {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const maxSize = 10 * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    return 'Only JPG, PNG, WEBP, and PDF files are allowed.';
  }

  if (file.size > maxSize) {
    return 'File must be smaller than 10MB.';
  }

  return null;
}

export { toDateString };
