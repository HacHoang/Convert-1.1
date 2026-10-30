import React from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';

export function SpeechTransport({ speaking, paused, canRead, previousDisabled, nextDisabled, onToggle, onSeek }: {
  speaking: boolean; paused: boolean; canRead: boolean; previousDisabled: boolean; nextDisabled: boolean;
  onToggle: () => void; onSeek: (direction: -1 | 1) => void;
}) {
  return <div role="group" aria-label="Điều khiển giọng đọc" className="tts-transport">
    <button type="button" onClick={() => onSeek(-1)} disabled={previousDisabled} title="Đoạn trước" aria-label="Đọc đoạn trước" className="tts-transport-skip"><SkipBack size={16} fill="currentColor" strokeWidth={2} /></button>
    <button type="button" onClick={onToggle} disabled={!canRead} aria-label={speaking ? paused ? 'Tiếp tục đọc' : 'Tạm dừng đọc' : 'Đọc bản dịch'} title="Đọc giọng nói" className="tts-transport-play">{speaking && !paused ? <Pause size={16} fill="currentColor" strokeWidth={0} /> : <Play size={16} fill="currentColor" strokeWidth={0} className="translate-x-px" />}</button>
    <button type="button" onClick={() => onSeek(1)} disabled={nextDisabled} title="Đoạn tiếp theo" aria-label="Đọc đoạn tiếp theo" className="tts-transport-skip"><SkipForward size={16} fill="currentColor" strokeWidth={2} /></button>
  </div>;
}
