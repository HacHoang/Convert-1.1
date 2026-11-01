import React, { useEffect, useState } from 'react';
import type { NovelBook, SavedChapter } from '../context/AppContext';
import { localReadingDay, summarizeReadingStats, type ReadingStats } from '../utils/readingStats';

const number = (value: number) => value.toLocaleString('vi-VN');
const duration = (seconds: number) => seconds >= 3600 ? `${(seconds / 3600).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}h` : `${Math.floor(seconds / 60)}p`;
export function ReadingStatsMetrics({ stats, novels, chapters, expanded }: {
  stats: ReadingStats; novels: NovelBook[]; chapters: SavedChapter[]; expanded: boolean;
}) {
  const [today, setToday] = useState(localReadingDay);
  const [description, setDescription] = useState('');
  useEffect(() => {
    const refresh = () => setToday(localReadingDay());
    const timer = setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const summary = summarizeReadingStats(stats, today);
  const metrics = [
    [number(novels.length), 'Truyện đã lưu', 'Số bộ truyện hiện có trong Thư viện. Xóa truyện sẽ giảm chỉ số này.'],
    [number(stats.totalReadBooks), 'Truyện đã đọc', 'Số truyện khác nhau đã đọc ít nhất 30 giây trong Thư viện; không có nghĩa là đã đọc hết truyện.'],
    [duration(stats.totalReadMinutes * 60), 'Thời gian đọc', 'Thời gian đọc trong Thư viện khi cửa sổ đang hiển thị và có tiêu điểm. Tạm dừng sau 3 phút không tương tác; không tính tải hoặc dịch truyện.'],
    [number(chapters.length), 'Chương đã lưu', 'Số chương hiện được lưu trong Thư viện, kể cả chương chưa mở đọc.'],
    [duration(summary.todaySeconds), 'Đọc hôm nay', 'Thời gian đọc hôm nay theo ngày địa phương trên thiết bị.'],
    [`${number(summary.currentStreak)} ngày`, 'Chuỗi ngày đọc', 'Mỗi ngày đọc ít nhất 1 phút. Nếu hôm nay chưa đủ 1 phút, chuỗi tới hôm qua vẫn được giữ trong hôm nay.'],
    [number(summary.completedChapters), 'Chương đọc hết', 'Chương khác nhau đã đọc ít nhất 30 giây và đã tới 90% nội dung trở lên. Đọc lại không cộng trùng.'],
    [duration(summary.weekSeconds), '7 ngày gần đây', 'Tổng thời gian đọc của hôm nay và 6 ngày trước theo lịch địa phương.'],
    [`${number(summary.activeDays)} ngày`, 'Ngày có đọc', 'Tổng số ngày đã đọc ít nhất 1 phút kể từ lần bắt đầu ghi nhận hoặc xóa thống kê.'],
    [`${number(summary.longestStreak)} ngày`, 'Chuỗi dài nhất', 'Kỷ lục số ngày liên tiếp đọc ít nhất 1 phút mỗi ngày.'],
    [duration(summary.longestDaySeconds), 'Ngày đọc nhiều nhất', 'Thời gian đọc cao nhất ghi nhận trong một ngày địa phương.'],
    [number(novels.filter(novel => novel.isFavorite).length), 'Truyện yêu thích', 'Số bộ truyện hiện được đánh dấu yêu thích trong Thư viện.'],
  ];
  return <div id="drawer-reading-metrics" className="max-h-[min(19rem,38dvh)] overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
    <div className="grid grid-cols-3 gap-x-2 gap-y-3 py-1">
      {metrics.slice(0, expanded ? metrics.length : 6).map(([value, label, explanation]) => <button type="button" key={label} title={explanation} aria-label={`${label}: ${value}. ${explanation}`} aria-pressed={description === explanation} onClick={() => setDescription(previous => previous === explanation ? '' : explanation)} className="min-w-0 rounded-md px-0.5 py-1 text-center transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent">
        <div className="text-sm font-semibold tabular-nums leading-5 text-accent">{value}</div>
        <div className="mt-0.5 text-[10px] leading-4 text-muted">{label}</div>
      </button>)}
    </div>
    {description && <p role="status" className="mt-2 rounded-lg bg-raised p-2 text-[10px] leading-relaxed text-muted">{description}</p>}
  </div>;
}
