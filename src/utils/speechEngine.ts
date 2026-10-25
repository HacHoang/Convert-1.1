/**
 * Trình đọc giọng nói Text-To-Speech (TTS) tiếng Việt
 * Tận dụng Web Speech API có sẵn trên trình duyệt và thiết bị Android
 */

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isPausedState: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public getVietnameseVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices();
    // Ưu tiên voice tiếng Việt
    const viVoice = voices.find(v => v.lang.startsWith('vi') || v.lang.includes('VIE'));
    return viVoice || voices[0] || null;
  }

  public speak(
    text: string,
    rate: number = 1.0,
    pitch: number = 1.0,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: unknown) => void;
    }
  ) {
    if (!this.synth) {
      callbacks?.onError?.('Trình duyệt không hỗ trợ Web Speech API.');
      return;
    }

    this.stop();

    if (!text || !text.trim()) return;

    // Giới hạn độ dài mỗi lượt đọc nếu text quá dài
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.getVietnameseVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'vi-VN';
    }

    utterance.rate = Math.max(0.5, Math.min(2.0, rate));
    utterance.pitch = Math.max(0.5, Math.min(1.5, pitch));

    utterance.onstart = () => {
      this.isPausedState = false;
      callbacks?.onStart?.();
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      this.isPausedState = false;
      callbacks?.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.currentUtterance = null;
      this.isPausedState = false;
      callbacks?.onError?.(e);
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  public pause() {
    if (this.synth && this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
      this.isPausedState = true;
    }
  }

  public resume() {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
      this.isPausedState = false;
    }
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
      this.isPausedState = false;
    }
  }

  public isSpeaking(): boolean {
    return !!(this.synth && this.synth.speaking);
  }

  public isPaused(): boolean {
    return this.isPausedState;
  }
}

export const speechService = new SpeechService();
