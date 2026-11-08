import type { NameItem } from '../data/defaultNames';
import type { BatchTranslationItem } from './chapterSplitter';
import { quickTranslateOneMeaningForBatch, type QuickTranslatorPortOptions } from './quickTranslatorPort';

type TranslationInput = Pick<BatchTranslationItem, 'id' | 'rawTitle' | 'content'>;
type TranslationResult = { id: string; title: string; content: string };
type StartMessage = { type: 'start'; runId: number; chapters: TranslationInput[]; names: NameItem[]; vietphrase: Record<string, string>; options: QuickTranslatorPortOptions };
type ControlMessage = { type: 'pause'; runId: number; paused: boolean } | { type: 'cancel'; runId: number };

let activeRun = 0;
let paused = false;
let cancelled = false;
let resume: (() => void) | undefined;

const yieldToEvents = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const waitWhilePaused = async () => {
  while (paused && !cancelled) await new Promise<void>(resolve => { resume = resolve; });
};

async function translateBatch(message: StartMessage) {
  activeRun = message.runId;
  paused = false;
  cancelled = false;
  const chunkSize = 6;
  try {
    for (let start = 0; start < message.chapters.length; start += chunkSize) {
      await waitWhilePaused();
      if (cancelled || activeRun !== message.runId) break;
      const rows: TranslationResult[] = [];
      for (const chapter of message.chapters.slice(start, start + chunkSize)) {
        if (cancelled || activeRun !== message.runId) break;
        rows.push({
          id: chapter.id,
          title: quickTranslateOneMeaningForBatch(chapter.rawTitle, message.names, message.vietphrase, message.options) || chapter.rawTitle,
          content: quickTranslateOneMeaningForBatch(chapter.content, message.names, message.vietphrase, message.options) || chapter.content,
        });
      }
      if (rows.length) self.postMessage({ type: 'chunk', runId: message.runId, rows });
      // Handle pause/cancel and keep the worker responsive between small chunks.
      await yieldToEvents();
    }
    self.postMessage({ type: 'complete', runId: message.runId, cancelled });
  } catch (error) {
    self.postMessage({ type: 'error', runId: message.runId, message: error instanceof Error ? error.message : String(error) });
  }
}

self.onmessage = ({ data }: MessageEvent<StartMessage | ControlMessage>) => {
  if (data.type === 'start') void translateBatch(data);
  else if (data.runId === activeRun && data.type === 'pause') {
    paused = data.paused;
    if (!paused) { resume?.(); resume = undefined; }
  } else if (data.runId === activeRun && data.type === 'cancel') {
    cancelled = true;
    paused = false;
    resume?.(); resume = undefined;
  }
};
