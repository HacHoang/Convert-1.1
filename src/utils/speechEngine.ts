/** Vietnamese reader with paragraph navigation and cancellation protection. */
type SpeechCallbacks = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
  onParagraphChange?: (index: number) => void;
};

export function splitSpeechChunks(text: string, limit = 220): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    const head = rest.slice(0, limit);
    const boundary = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '), head.lastIndexOf('; '));
    const space = head.lastIndexOf(' ');
    const end = boundary >= limit / 3 ? boundary + 1 : space > 0 ? space : limit;
    chunks.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export class SpeechService {
  private synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  private generation = 0;
  private paragraphs: { index: number; chunks: string[] }[] = [];
  private paragraph = 0;
  private chunk = 0;
  private rate = 1;
  private voice: SpeechSynthesisVoice | null = null;
  private callbacks: SpeechCallbacks = {};
  private state: 'idle' | 'playing' | 'paused' = 'idle';
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private pending = false;
  private clearVoiceWait: (() => void) | null = null;

  public getVietnameseVoice(): SpeechSynthesisVoice | null {
    return this.synth?.getVoices().find(voice => /^vi(?:-|_|$)/i.test(voice.lang) || /VIE/i.test(voice.lang)) || null;
  }

  public speak(text: string, rate = 1, callbacks: SpeechCallbacks = {}) {
    this.speakParagraphs([text], rate, callbacks);
  }

  public speakParagraphs(paragraphs: string[], rate = 1, callbacks: SpeechCallbacks = {}, startIndex = 0) {
    this.stop();
    if (!this.synth) {
      callbacks.onError?.('Trình duyệt không hỗ trợ đọc giọng nói.');
      return;
    }
    this.rate = Number.isFinite(rate) ? Math.max(0.5, Math.min(2, rate)) : 1;
    this.paragraphs = paragraphs.map((text, index) => ({ index, chunks: splitSpeechChunks(text, Math.floor(180 * Math.min(1, this.rate))) })).filter(p => p.chunks.length > 0);
    if (!this.paragraphs.length) return;
    this.callbacks = callbacks;
    this.paragraph = Math.max(0, this.paragraphs.findIndex(p => p.index >= startIndex));
    this.chunk = 0;
    this.state = 'playing';
    callbacks.onStart?.();
    const generation = this.generation;
    const ready = () => {
      if (generation !== this.generation) return;
      this.voice = this.getVietnameseVoice();
      if (!this.voice) {
        this.fail('Thiết bị chưa có giọng tiếng Việt. Hãy cài giọng tiếng Việt trong hệ điều hành rồi thử lại.');
        return;
      }
      this.readChunk();
    };
    if (this.getVietnameseVoice()) ready();
    else {
      const changed = () => { if (this.getVietnameseVoice()) { cleanup(); ready(); } };
      const timer = setTimeout(() => { cleanup(); ready(); }, 1500);
      const cleanup = () => {
        clearTimeout(timer);
        this.synth?.removeEventListener('voiceschanged', changed);
        this.clearVoiceWait = null;
      };
      this.clearVoiceWait = cleanup;
      this.synth.addEventListener('voiceschanged', changed);
    }
  }

  private readChunk() {
    if (this.state === 'idle') return;
    if (this.state === 'paused') { this.pending = true; return; }
    const paragraph = this.paragraphs[this.paragraph];
    if (!paragraph) {
      const onEnd = this.callbacks.onEnd;
      this.stop();
      onEnd?.();
      return;
    }
    this.pending = false;
    const generation = this.generation;
    const utterance = new SpeechSynthesisUtterance(paragraph.chunks[this.chunk]);
    utterance.voice = this.voice;
    utterance.lang = 'vi-VN';
    utterance.rate = this.rate;
    utterance.pitch = 1;
    this.currentUtterance = utterance;
    if (this.chunk === 0) this.callbacks.onParagraphChange?.(paragraph.index);
    utterance.onend = () => {
      if (generation !== this.generation || this.currentUtterance !== utterance) return;
      this.currentUtterance = null;
      this.chunk++;
      if (this.chunk >= paragraph.chunks.length) { this.paragraph++; this.chunk = 0; }
      this.readChunk();
    };
    utterance.onerror = event => {
      if (generation === this.generation && this.currentUtterance === utterance) this.fail(`Không đọc được văn bản (${event.error}). Vui lòng thử lại.`);
    };
    try { this.synth?.speak(utterance); }
    catch (error) { this.fail(error); }
  }

  private fail(error: unknown) {
    const onError = this.callbacks.onError;
    this.stop();
    onError?.(error);
  }

  public seekParagraph(index: number) {
    const target = this.paragraphs.findIndex(p => p.index === index);
    if (this.state === 'idle' || target < 0 || !this.voice) return;
    this.generation++;
    this.currentUtterance = null;
    this.synth?.cancel();
    this.paragraph = target;
    this.chunk = 0;
    this.callbacks.onParagraphChange?.(index);
    this.pending = true;
    if (this.state === 'playing') { this.synth?.resume(); this.readChunk(); }
  }

  public pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.synth?.pause();
  }

  public resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.synth?.resume();
    if (this.pending) this.readChunk();
  }

  public stop() {
    this.generation++;
    this.clearVoiceWait?.();
    this.state = 'idle';
    this.currentUtterance = null;
    this.pending = false;
    this.voice = null;
    this.callbacks = {};
    this.synth?.cancel();
  }

  public isSpeaking() { return this.state !== 'idle'; }
  public isPaused() { return this.state === 'paused'; }
}

export const speechService = new SpeechService();
