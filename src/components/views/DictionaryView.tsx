import { loadReferenceDictionary } from '../../utils/referenceDictionary';
import { DictionaryPagination } from '../DictionaryPagination';
import { useBackgroundTasks } from '../../context/BackgroundTasks';
import { DictionaryGroups } from '../DictionaryGroups';
import { readTextFile } from '../../utils/textFile';
import { STYLE_LABELS, STYLE_PHRASES, stylePhraseDictionary, type TranslationStyle } from '../../utils/translationStyle';
/**
 * Tab Cơ Sở Dữ Liệu & Từ Điển (Unified Database View)
 * Trung tâm hợp nhất toàn bộ dữ liệu từ điển của Quick Translator:
 * - Vietphrase (từ vựng thông dụng & truyện)
 * - Names Chính (danh xưng & địa danh gốc)
 * - Names Phụ / Cá Nhân (tên nhân vật theo truyện)
 * - Phiên Âm Hán Việt (12.5k ký tự chuẩn)
 * - Luật Nhân (228 quy tắc ngữ pháp)
 * - Đại Từ & Cụm Bỏ Qua (Pronouns & Ignored Phrases)
 * 
 * Hỗ trợ Import/Export từng file riêng lẻ hoặc TOÀN BỘ cùng một lúc.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp, DictCategoryType } from '../../context/AppContext';
import { NameItem } from '../../data/defaultNames';
import { importDictionaryInBackground } from '../../utils/backgroundDictionaryImport';
import { readAppValue, writeAppValue } from '../../utils/indexedDbStorage';
import { MeaningStyleEditor, meaningRows } from '../MeaningStyleEditor';
import { meaningStyleSnapshot, meaningStyleFallback, type MeaningKind } from '../../utils/meaningStyles';
import { parseVietphraseMeanings } from '../../utils/translatorEngine';
import { 
  Database, 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Upload, 
  Download, 
  RotateCcw, 
  Check, 
  X,
  Sparkles,
  FileText,
  Layers,
  Archive,
  RefreshCw
} from 'lucide-react';


type UnifiedTab = 'vietphrase' | 'names_main' | 'names_custom' | 'phienam' | 'luatnhan' | 'pronouns' | 'vietphrase_merged' | 'lacviet' | 'thieuchuu' | 'babylon' | 'ignored_chinese';

const REFERENCE_TABS = {
  vietphrase_merged: { label: 'VietPhrase file gộp', file: 'Vietphrase_cho_file_g_p_ef2c75e8.txt' },
  lacviet: { label: 'Từ điển Lạc Việt', file: 'LacViet_724c32ac.txt' },
  thieuchuu: { label: 'Từ điển Thiều Chửu', file: 'ThieuChuu_0a3529be.txt' },
  babylon: { label: 'Từ điển Babylon', file: 'Babylon_bcaa6311.txt' },
  ignored_chinese: { label: 'Ignored Chinese Phrases', file: 'IgnoredChinesePhrases_771ed2c0.txt' },
} as const;
type ReferenceTab = keyof typeof REFERENCE_TABS;
type DictionaryRow = { chinese: string; vietnamese: string };
// Tiện ích tải file về máy
function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const DictionaryView: React.FC = () => {
  const {
    namesList,
    deleteName,
    updateName,
    addName,
    namesMainMap,
    phienAmMap,
    vietphraseMap,
    addVietphrase,
    deleteVietphrase,
    luatNhanMap,
    pronounsMap,
    ignoredPhrasesList,
    replaceIgnoredPhrases,
    deletePhrase,
    updatePhrase,
    deleteMultiplePhrases,
    exportSingleTxt,
    importSingleTxt,
    importDictionaryFile,
    clearSpecificStore,
    deleteDictionaryEntries,
    loadAllQuickTranslatorAssets,
    exportAllDatabasesJson,
    importAllDatabasesJson,
    resetDictionaries,
    settings,
    dictionaryStyleRevision,
  } = useApp();

  const [activeTab, setActiveTab] = useState<UnifiedTab>('vietphrase');
  const [referenceData, setReferenceData] = useState<Partial<Record<ReferenceTab, DictionaryRow[]>>>({});
  const [referenceError, setReferenceError] = useState('');
  const referenceTab = activeTab in REFERENCE_TABS && activeTab !== 'ignored_chinese' ? activeTab as ReferenceTab : null;
  const isReadOnly = referenceTab !== null && referenceTab !== 'vietphrase_merged';
  const tableLoading = !!referenceTab && !referenceData[referenceTab];
  useEffect(() => {
    if (!referenceTab || referenceData[referenceTab]) return;
    let mounted = true;
    setReferenceError('');
    (async () => {
      if (referenceTab === 'vietphrase_merged') {
        const saved = await readAppValue<DictionaryRow[]>('dictionaryReference:vietphrase_merged');
        if (saved !== undefined) return saved;
      }
      return loadReferenceDictionary(REFERENCE_TABS[referenceTab].file);
    })().then(rows => {
      if (mounted) setReferenceData(previous => ({ ...previous, [referenceTab]: rows }));
      showToast(`Đã mở ${REFERENCE_TABS[referenceTab].label}: ${rows.length.toLocaleString()} mục.`);
    }).catch(error => { if (mounted) setReferenceError(error.message); showToast(error.message, true); });
    return () => { mounted = false; };
  }, [referenceTab, referenceData]);
  const saveMergedRows = async (rows: DictionaryRow[]) => {
    await writeAppValue('dictionaryReference:vietphrase_merged', rows);
    setReferenceData(previous => ({ ...previous, vietphrase_merged: rows }));
  };
  const [phraseStyle, setPhraseStyle] = useState<TranslationStyle | 'all' | 'unclassified'>('all');
  const meaningKind: MeaningKind | null = activeTab === 'vietphrase' ? 'vietphrase' : activeTab === 'names_main' ? 'names_main' : activeTab === 'names_custom' ? 'names' : null;
  const [styleEditor, setStyleEditor] = useState<{ kind: MeaningKind; chinese: string; raw: string } | null>(null);
  const defaultNeutral = meaningStyleFallback() === 'neutral';
  const currentMeaningStyles = useMemo(() => {
    const entries = meaningKind ? meaningStyleSnapshot()[meaningKind] || {} : {};
    const names = meaningKind === 'names' ? new Map(namesList.map(row => [row.chinese, row.vietnamese])) : null;
    return Object.fromEntries(Object.entries(entries).map(([key, rows]) => {
      const raw = meaningKind === 'names' ? names?.get(key) : (meaningKind === 'names_main' ? namesMainMap : vietphraseMap)[key];
      const meanings = raw === undefined ? null : parseVietphraseMeanings(raw);
      const parsed = meanings ? [meanings.primary, ...meanings.alternatives] : [];
      return [key, rows.filter(row => parsed.includes(row.meaning))];
    }));
  }, [meaningKind, dictionaryStyleRevision, namesList, namesMainMap, vietphraseMap]);
  const classifiedKeys = useMemo(() => {
    const keys = new Set(meaningKind === 'vietphrase' ? (Object.keys(STYLE_PHRASES) as TranslationStyle[]).flatMap(style => Object.keys(stylePhraseDictionary(style))) : []);
    for (const [key, rows] of Object.entries(currentMeaningStyles)) {
      if (rows.some(row => row.styles.length)) keys.add(key); else keys.delete(key);
    }
    return keys;
  }, [meaningKind, dictionaryStyleRevision, currentMeaningStyles]);
  const selectedStylePhrases = useMemo(() => {
    const result = phraseStyle === 'all' || phraseStyle === 'unclassified' || meaningKind !== 'vietphrase' ? {} : stylePhraseDictionary(phraseStyle);
    if (phraseStyle !== 'all' && phraseStyle !== 'unclassified' && meaningKind) {
      for (const [key, rows] of Object.entries(currentMeaningStyles)) {
        const selected = rows.find(row => row.styles.includes(phraseStyle));
        if (selected) result[key] = selected.meaning; else delete result[key];
      }
    }
    return result;
  }, [meaningKind, phraseStyle, dictionaryStyleRevision, currentMeaningStyles]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortRule, setSortRule] = useState('original');
  const [sortResult, setSortResult] = useState<{ source: typeof filteredData; rule: string; indexes: Uint32Array } | null>(null);
  const listRef = useRef<HTMLFieldSetElement>(null);

  // Status & Notification Toast
  const background = useBackgroundTasks();
  const isProcessing = background.running;
  const showToast = background.notify;
  const setProcessingStatus = (detail: string) => background.progress({ detail });
  const setProcessingPercent = (percent: number) => background.progress({ percent });

  // Ref cho các input file ẩn
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const allJsonFileInputRef = useRef<HTMLInputElement>(null);

  // Modal thêm mục mới
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [newCategory, setNewCategory] = useState<NameItem['category']>('Nhân vật');

  // Edit inline cả từ tiếng Trung và nghĩa tiếng Việt (2-way editable)
  const [editingItem, setEditingItem] = useState<{
    originalChinese: string;
    editChinese: string;
    editViet: string;
    id?: string;
  } | null>(null);

  // Chọn nhiều từ để xóa 1 lần
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Hộp thoại xác nhận tùy biến trước khi xóa từ điển
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    items: string[];
    count: number;
    sampleTitle?: string;
  } | null>(null);

  // Chuyển tab và reset trang
  const handleTabChange = (tab: UnifiedTab) => {
    if (isDeleting) return;
    setActiveTab(tab);
    setSearchTerm('');
    setSelectedCategory('all');
    setCurrentPage(1);
    setEditingItem(null);
    setSelectedKeys(new Set());
  };

  // 1. Dữ liệu Vietphrase gộp (DEFAULT + User)
  const fullVietphrase = useMemo(() => {
    const map = vietphraseMap;
    return Object.entries(map).map(([chinese, vietnamese]) => ({
      chinese,
      vietnamese,
    }));
  }, [vietphraseMap]);

  // 2. Dữ liệu Names Chính (namesMainMap)
  const fullNamesMain = useMemo(() => {
    return Object.entries(namesMainMap).map(([chinese, vietnamese]) => ({
      chinese,
      vietnamese,
    }));
  }, [namesMainMap]);

  // 3. Dữ liệu Luật Nhân
  const fullLuatNhan = useMemo(() => {
    return Object.entries(luatNhanMap).map(([pattern, translation]) => ({
      chinese: pattern,
      vietnamese: translation,
    }));
  }, [luatNhanMap]);

  // 4. Dữ liệu Phiên Âm Hán Việt (12.5k từ)
  const fullPhienAm = useMemo(() => {
    return Object.entries(phienAmMap).map(([chinese, phienam]) => ({
      chinese,
      vietnamese: phienam,
    }));
  }, [phienAmMap]);

  // 5. Dữ liệu Đại Từ & Cụm Bỏ Qua
  const fullPronouns = useMemo(() => {
    return Object.entries(pronounsMap).map(([chinese, vietnamese]) => ({
      chinese,
      vietnamese,
      type: 'Đại từ'
    }));
  }, [pronounsMap]);

  const fullIgnored = useMemo(() => {
    return ignoredPhrasesList.map(phrase => ({
      chinese: phrase,
      vietnamese: '(Lọc bỏ watermark/quảng cáo)',
      type: 'Cụm bỏ qua'
    }));
  }, [ignoredPhrasesList]);

  // Lọc dữ liệu theo tab và từ khóa
  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const matchesStyle = (item: { chinese: string }) => {
      if (phraseStyle === 'all') return true;
      const rows = currentMeaningStyles[item.chinese];
      if (defaultNeutral) {
        if (!rows?.length) return phraseStyle === 'neutral';
        return phraseStyle === 'unclassified' ? !rows.some(row => row.styles.length) : rows.some(row => row.styles.includes(phraseStyle));
      }
      return phraseStyle === 'unclassified' ? !classifiedKeys.has(item.chinese) : Object.hasOwn(selectedStylePhrases, item.chinese);
    };
    if (referenceTab) return (referenceData[referenceTab] ?? []).filter(item => !term || item.chinese.toLowerCase().includes(term) || item.vietnamese.toLowerCase().includes(term));

    switch (activeTab) {
      case 'vietphrase': {
        const scoped = phraseStyle === 'all' ? fullVietphrase : fullVietphrase.filter(matchesStyle);
        if (!term) return scoped;
        return scoped.filter(item =>
          item.chinese.toLowerCase().includes(term) || item.vietnamese.toLowerCase().includes(term)
        );
      }
      case 'names_main': {
        return fullNamesMain.filter(item => matchesStyle(item)
          && (!term || item.chinese.toLowerCase().includes(term) || item.vietnamese.toLowerCase().includes(term)));
      }
      case 'names_custom': {
        return namesList.filter(item => {
          const matchesTerm = !term ||
            item.chinese.toLowerCase().includes(term) ||
            item.vietnamese.toLowerCase().includes(term) ||
            (item.note && item.note.toLowerCase().includes(term));
          const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
          return matchesTerm && matchesCat && matchesStyle(item);
        }).map(item => ({
          chinese: item.chinese,
          vietnamese: item.vietnamese,
          category: item.category,
          id: item.id,
          note: item.note
        }));
      }
      case 'phienam': {
        if (!term) return fullPhienAm;
        return fullPhienAm.filter(item =>
          item.chinese.toLowerCase().includes(term) || item.vietnamese.toLowerCase().includes(term)
        );
      }
      case 'luatnhan': {
        if (!term) return fullLuatNhan;
        return fullLuatNhan.filter(item =>
          item.chinese.toLowerCase().includes(term) || item.vietnamese.toLowerCase().includes(term)
        );
      }
      case 'pronouns': {
        const combined = fullPronouns;
        if (!term) return combined;
        return combined.filter(item =>
          item.chinese.toLowerCase().includes(term) || item.vietnamese.toLowerCase().includes(term)
        );
      }
      case 'ignored_chinese':
        return fullIgnored.filter(item => !term || item.chinese.toLowerCase().includes(term));
      default:
        return [];
    }
  }, [referenceTab, referenceData, activeTab, searchTerm, selectedCategory, phraseStyle, classifiedKeys, selectedStylePhrases, currentMeaningStyles, defaultNeutral, fullVietphrase, fullNamesMain, namesList, fullPhienAm, fullLuatNhan, fullPronouns, fullIgnored]);

  // Phân trang
  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  useEffect(() => {
    if (sortRule === 'original') return;
    const worker = new Worker(new URL('../../utils/dictionarySort.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => setSortResult({ source: filteredData, rule: sortRule, indexes: data });
    worker.onerror = () => { showToast('Không sắp xếp được dữ liệu. Đã giữ thứ tự gốc.', true); setSortRule('original'); };
    worker.postMessage({ keys: filteredData.map(row => sortRule.startsWith('meaning') ? row.vietnamese : row.chinese), rule: sortRule });
    return () => worker.terminate();
  }, [filteredData, sortRule]);
  const sorting = sortRule !== 'original' && (sortResult?.source !== filteredData || sortResult.rule !== sortRule);
  const paginatedData = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    if (sortRule === 'original' || sorting) return filteredData.slice(start, start + pageSize);
    return Array.from(sortResult!.indexes.slice(start, start + pageSize), index => filteredData[index]);
  }, [filteredData, safeCurrentPage, pageSize, sortRule, sorting, sortResult]);
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [safeCurrentPage, pageSize, sortRule, activeTab]);

  // ------------------- CÁC THAO TÁC XUẤT / NHẬP HÀNG LOẠT -------------------

  // Nạp 1-click toàn bộ dữ liệu gốc QuickTranslator từ các file asset
  const handleLoadAllDefaults = async () => {
    setProcessingStatus('Đang khởi động nạp dữ liệu...');
    setProcessingPercent(10);

    try {
      const res = await loadAllQuickTranslatorAssets((msg, pct) => {
        setProcessingStatus(msg);
        setProcessingPercent(pct);
      });

      if (res.success) {
        background.reportResult('Đã khôi phục bộ từ điển mặc định của Hermes!');
      } else {
        background.reportResult(res.message, true);
      }
    } catch (err: any) {
      background.reportResult(err.message || 'Lỗi khi nạp dữ liệu', true);
    } finally {
      setProcessingPercent(0);
    }
  };

  // Xuất toàn bộ tất cả database ra file JSON tổng hợp
  const handleExportAllJson = async () => {
    try {
      setProcessingStatus('Đang đóng gói toàn bộ cơ sở dữ liệu...');
      const json = await exportAllDatabasesJson();
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadTextFile(`hermes_backup_${dateStr}.json`, json);
      background.reportResult('Đã xuất toàn bộ cơ sở dữ liệu thành công!');
    } catch (err: any) {
      background.reportResult(err.message || 'Lỗi khi xuất dữ liệu', true);
    }
  };

  // Nhập toàn bộ tất cả database từ file JSON
  const handleImportAllJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingStatus('Đang khôi phục toàn bộ dữ liệu từ tệp sao lưu...');
    try {
      const text = await readTextFile(file);
      const res = await importAllDatabasesJson(text);
      if (res.success) {
        background.reportResult('Khôi phục toàn bộ cơ sở dữ liệu thành công!');
      } else {
        background.reportResult(res.message, true);
      }
    } catch (err: any) {
      background.reportResult('Tệp sao lưu không hợp lệ: ' + (err.message || ''), true);
    } finally {
      if (allJsonFileInputRef.current) allJsonFileInputRef.current.value = '';
    }
  };

  // ------------------- CÁC THAO TÁC XUẤT / NHẬP TỪNG FILE -------------------

  // Xuất tệp TXT cho tab hiện tại theo cú pháp QuickTranslator
  const handleExportCurrentTab = () => {
    if (referenceTab) {
      const rows = referenceData[referenceTab];
      if (!rows) return;
      downloadTextFile(REFERENCE_TABS[referenceTab].file.replace(/_[a-f0-9]+(?=\.txt$)/, ''), rows.map(row => referenceTab === 'ignored_chinese' ? row.chinese : `${row.chinese}=${row.vietnamese}`).join('\n'));
      showToast('Đã xuất tệp từ điển');
      return;
    }
    let dictType: DictCategoryType = 'vietphrase';
    let filename = 'VietPhrase.txt';

    switch (activeTab) {
      case 'vietphrase':
        dictType = 'vietphrase';
        filename = 'VietPhrase.txt';
        break;
      case 'names_main':
        dictType = 'names_main';
        filename = 'Names.txt';
        break;
      case 'names_custom':
        dictType = 'names';
        filename = 'Names2.txt';
        break;
      case 'phienam':
        dictType = 'phienam';
        filename = 'ChinesePhienAmWords.txt';
        break;
      case 'luatnhan':
        dictType = 'luatnhan';
        filename = 'LuatNhan.txt';
        break;
      case 'pronouns':
        dictType = 'pronouns';
        filename = 'Pronouns.txt';
        break;
      case 'ignored_chinese': dictType = 'ignored'; filename = 'IgnoredChinesePhrases.txt'; break;
    }

    const content = exportSingleTxt(dictType);
    downloadTextFile(filename, content);
    showToast(`Đã xuất tệp ${filename} (${content.split('\n').length} dòng)`);
  };

  // Nhập tệp TXT cho tab hiện tại
  const handleImportCurrentTab = async (file: File) => {

    let dictType: DictCategoryType = 'vietphrase';
    switch (activeTab) {
      case 'vietphrase': dictType = 'vietphrase'; break;
      case 'names_main': dictType = 'names_main'; break;
      case 'names_custom': dictType = 'names'; break;
      case 'phienam': dictType = 'phienam'; break;
      case 'luatnhan': dictType = 'luatnhan'; break;
      case 'pronouns': dictType = 'pronouns'; break;
      case 'ignored_chinese': dictType = 'ignored'; break;
    }

    setProcessingStatus(`Đang đọc tệp ${file.name}...`);
    let committedCount = 0;
    try {
      if (activeTab === 'vietphrase_merged') {
        const rows = new Map((referenceData.vietphrase_merged || []).map(row => [row.chinese, row.vietnamese]));
        await importDictionaryInBackground(file, (count, percent) => { setProcessingStatus(`Đã xử lý ${count.toLocaleString()} dòng`); setProcessingPercent(percent); }, async entries => {
          for (const entry of entries) rows.set(entry.chinese, entry.vietnamese);
        });
        await saveMergedRows(Array.from(rows, ([chinese, vietnamese]) => ({ chinese, vietnamese })));
        background.reportResult('Đã nhập VietPhrase file gộp.');
        return;
      }
      committedCount = await importDictionaryFile(dictType, file, (count, pct) => {
          setProcessingStatus(pct >= 96 ? 'Đang cập nhật từ điển trong app…' : pct >= 92 ? 'Đang lưu từ điển…' : `Đã đọc ${count.toLocaleString()} dòng`);
          setProcessingPercent(pct);
        });
        background.reportResult(`Đã nhập thành công ${committedCount.toLocaleString()} mục vào ${dictType}!`);
    } catch (err: any) {
      background.reportResult(`Lỗi khi nhập tệp: ` + (err.message || ''), true);
    } finally {
      setProcessingPercent(0);
      if (singleFileInputRef.current) singleFileInputRef.current.value = '';
    }
  };

  // Xóa trắng dữ liệu của bảng hiện tại
  const handleClearCurrentTab = async () => {
    if (isProcessing || tableLoading) return;
    if (isReadOnly) return;

    let dictType: DictCategoryType = 'vietphrase';
    let label = 'Vietphrase';

    switch (activeTab) {
      case 'vietphrase': dictType = 'vietphrase'; label = 'Vietphrase'; break;
      case 'names_main': dictType = 'names_main'; label = 'Names Chính'; break;
      case 'names_custom': dictType = 'names'; label = 'Names Phụ / Cá Nhân'; break;
      case 'luatnhan': dictType = 'luatnhan'; label = 'Luật Nhân'; break;
      case 'pronouns': dictType = 'pronouns'; label = 'Đại Từ'; break;
      case 'phienam': dictType = 'phienam'; label = 'Phiên âm Hán Việt'; break;
      case 'ignored_chinese': dictType = 'ignored'; label = 'Ignored Chinese Phrases'; break;
      case 'vietphrase_merged': label = 'VietPhrase file gộp'; break;
    }

    if (isDeleting || !window.confirm(`Xóa toàn bộ dữ liệu trong bảng ${label}, trên tất cả các trang, kể cả mục không khớp tìm kiếm/bộ lọc? Thao tác không thể hoàn tác.`)) return;
    setIsDeleting(true);
    try {
      if (activeTab === 'vietphrase_merged') await saveMergedRows([]);
      else await clearSpecificStore(dictType);
      setSelectedKeys(new Set());
      setCurrentPage(1);
      setEditingItem(null);
      showToast(`Đã xóa toàn bộ bảng ${label}.`);
    } catch {
      showToast('Không xóa được dữ liệu. Vui lòng thử lại.', true);
    } finally { setIsDeleting(false); }
  };

  // Thêm mục mới
  const handleAddNewEntry = async () => {
    if (isProcessing || tableLoading) return;
    if (!newKey.trim() || activeTab !== 'ignored_chinese' && !newVal.trim()) {
      showToast('Vui lòng điền đủ từ gốc và nghĩa tiếng Việt', true);
      return;
    }

    const cn = newKey.trim();
    const vn = newVal.trim();

    if (activeTab === 'vietphrase_merged' || activeTab === 'ignored_chinese') {
      try {
        if (activeTab === 'vietphrase_merged') await saveMergedRows([
          ...(referenceData.vietphrase_merged || []).filter(row => row.chinese !== cn), { chinese: cn, vietnamese: vn },
        ]);
        else await replaceIgnoredPhrases([...ignoredPhrasesList, cn]);
        setNewKey(''); setNewVal(''); setIsAddModalOpen(false);
        showToast('Đã thêm mục.');
      } catch { showToast('Không lưu được dữ liệu. Vui lòng thử lại.', true); }
      return;
    }
    if (activeTab === 'names_custom') {
      addName(cn, vn, newCategory);
      showToast(`Đã thêm tên riêng: ${cn} = ${vn}`);
    } else if (activeTab === 'vietphrase') {
      addVietphrase(cn, vn);
      showToast(`Đã thêm Vietphrase: ${cn} = ${vn}`);
    } else {
      await importSingleTxt(activeTab === 'names_main' ? 'names_main' : activeTab === 'luatnhan' ? 'luatnhan' : activeTab === 'phienam' ? 'phienam' : 'pronouns', `${cn}=${vn}`);
      showToast(`Đã thêm mục: ${cn} = ${vn}`);
    }

    setNewKey('');
    setNewVal('');
    setIsAddModalOpen(false);
  };

  // Chọn hoặc bỏ chọn 1 từ
  const toggleSelectKey = (chinese: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(chinese)) next.delete(chinese);
      else next.add(chinese);
      return next;
    });
  };

  // Selection spans every page of the current search/filter results.
  const handleToggleSelectAll = (currentPageItems: Array<{ chinese: string }>) => {
    const allSelected = currentPageItems.length > 0 && currentPageItems.every(i => selectedKeys.has(i.chinese));
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (allSelected) {
        currentPageItems.forEach(i => next.delete(i.chinese));
      } else {
        currentPageItems.forEach(i => next.add(i.chinese));
      }
      return next;
    });
  };

  // Lưu sửa đổi 2 chiều cả từ tiếng Trung và nghĩa tiếng Việt
  const handleSaveEdit = async () => {
    if (isProcessing) return;
    if (isReadOnly) return;
    if (!editingItem) return;
    const { originalChinese, editChinese, editViet, id } = editingItem;
    const cleanCn = editChinese.trim();
    const cleanVn = editViet.trim();

    if (!cleanCn || activeTab !== 'ignored_chinese' && !cleanVn) {
      showToast('Từ tiếng Trung và nghĩa tiếng Việt không được để trống!', true);
      return;
    }

    if (activeTab === 'vietphrase_merged' || activeTab === 'ignored_chinese') {
      try {
        if (activeTab === 'vietphrase_merged') await saveMergedRows([
          ...(referenceData.vietphrase_merged || []).filter(row => row.chinese !== originalChinese && row.chinese !== cleanCn),
          { chinese: cleanCn, vietnamese: cleanVn },
        ]);
        else await replaceIgnoredPhrases(ignoredPhrasesList.map(phrase => phrase === originalChinese ? cleanCn : phrase));
        setEditingItem(null); showToast('Đã lưu cập nhật.');
      } catch { showToast('Không lưu được dữ liệu. Vui lòng thử lại.', true); }
      return;
    }
    if (activeTab === 'names_custom') {
      updatePhrase(originalChinese, cleanCn, cleanVn, 'name');
    } else if (activeTab === 'vietphrase') {
      updatePhrase(originalChinese, cleanCn, cleanVn, 'vietphrase');
    } else {
      const dictType = activeTab === 'names_main' ? 'names_main' : activeTab === 'luatnhan' ? 'luatnhan' : activeTab === 'phienam' ? 'phienam' : 'pronouns';
      await importSingleTxt(dictType, `${cleanCn}=${cleanVn}`);
      if (originalChinese !== cleanCn) await deleteDictionaryEntries(dictType, [originalChinese]);
    }

    setEditingItem(null);
    showToast(`Đã lưu cập nhật: ${cleanCn} = ${cleanVn}`);
  };

  // Yêu cầu xóa 1 từ (kích hoạt hộp thoại xác nhận)
  const handleRequestDeleteItem = (chineseKey: string) => {
    setDeleteConfirmModal({
      isOpen: true,
      items: [chineseKey],
      count: 1,
      sampleTitle: chineseKey
    });
  };

  // Yêu cầu xóa hàng loạt các từ đã chọn (kích hoạt hộp thoại xác nhận với số lượng)
  const handleRequestBulkDelete = () => {
    if (selectedKeys.size === 0) return;
    setDeleteConfirmModal({
      isOpen: true,
      items: Array.from(selectedKeys),
      count: selectedKeys.size
    });
  };

  // Xác nhận thực hiện xóa sau khi người dùng bấm đồng ý trên Modal
  const handleConfirmDelete = async () => {
    if (isProcessing) return;
    if (isReadOnly) return;

    if (isDeleting || !deleteConfirmModal || deleteConfirmModal.items.length === 0) return;
    const items = deleteConfirmModal.items;
    const count = items.length;

    const dictType = activeTab === 'names_custom' ? 'names' : activeTab === 'ignored_chinese' ? 'ignored' : activeTab as DictCategoryType;
    const allRows = activeTab === 'vietphrase' ? fullVietphrase : activeTab === 'names_custom' ? namesList
      : activeTab === 'names_main' ? fullNamesMain : activeTab === 'phienam' ? fullPhienAm : activeTab === 'luatnhan' ? fullLuatNhan : activeTab === 'ignored_chinese' ? fullIgnored : fullPronouns;
    const keys = new Set(items);
    setIsDeleting(true);
    try {
      if (activeTab === 'vietphrase_merged') await saveMergedRows((referenceData.vietphrase_merged || []).filter(row => !keys.has(row.chinese)));
      else if (allRows.length > 0 && allRows.every(row => keys.has(row.chinese))) await clearSpecificStore(dictType);
      else await deleteDictionaryEntries(dictType, items);
    } catch {
      showToast('Không xóa được dữ liệu. Vui lòng thử lại.', true);
      return;
    } finally { setIsDeleting(false); }

    setSelectedKeys(prev => {
      const next = new Set(prev);
      items.forEach(k => next.delete(k));
      return next;
    });

    setDeleteConfirmModal(null);
    showToast(`Đã xóa thành công ${count} từ khỏi từ điển!`);
  };

  const isLight = settings.theme === 'light';
  const isSepia = settings.theme === 'sepia';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {styleEditor && <MeaningStyleEditor {...styleEditor} onClose={() => setStyleEditor(null)} />}
      {/* Hidden file inputs */}
      <input 
        ref={singleFileInputRef} 
        type="file" 
        accept=".txt,.config" 
        className="hidden" 
        onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) background.run(`Nạp ${file.name}`, () => handleImportCurrentTab(file)); }} 
      />
      <input 
        ref={allJsonFileInputRef} 
        type="file" 
        accept=".json" 
        className="hidden" 
        onChange={event => { background.run('Khôi phục dữ liệu', () => handleImportAllJson(event)); }} 
      />

      {/* HEADER: TIÊU ĐỀ & THANH THAO TÁC TOÀN CỤC (GLOBAL BATCH ACTIONS) */}
      <div className={`px-4 py-3.5 border-b shrink-0 flex flex-wrap items-center justify-between gap-3 ${
        isLight ? 'bg-canvas/80 border-line text-main' : isSepia ? 'bg-surface border-line text-main' : 'bg-surface border-line text-main'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/20 text-accent flex items-center justify-center border border-accent/30">
            <Database size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight flex items-center gap-2">
              Cơ Sở Dữ Liệu & Từ Điển
            </h1>
          </div>
        </div>

        {/* Global Batch Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            disabled={isProcessing} onClick={() => { if (window.confirm('Khôi phục toàn bộ từ điển về bộ mặc định đi kèm Hermes? Các chỉnh sửa từ điển hiện tại sẽ được thay thế.')) background.run('Nạp từ điển mặc định', handleLoadAllDefaults); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-xs font-medium text-main hover:bg-raised disabled:opacity-40"
            title="Khôi phục bộ từ điển mặc định đi kèm Hermes"
          >
            <Sparkles size={13} />
            <span>Nạp mặc định</span>
          </button>

          <button
            disabled={isProcessing} onClick={() => background.run('Xuất bản sao lưu', handleExportAllJson)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${
              isLight ? 'bg-surface border-line hover:bg-raised text-main' : isSepia ? 'bg-surface border-line hover:bg-surface text-main' : 'bg-surface border-line hover:bg-hover text-main'
            }`}
            title="Xuất toàn bộ tất cả bảng từ điển ra tệp JSON sao lưu"
          >
            <Download size={13} />
            <span>Xuất Hết</span>
          </button>

          <button
            disabled={isProcessing} onClick={() => allJsonFileInputRef.current?.click()}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${
              isLight ? 'bg-surface border-line hover:bg-raised text-main' : isSepia ? 'bg-surface border-line hover:bg-surface text-main' : 'bg-surface border-line hover:bg-hover text-main'
            }`}
            title="Nhập khôi phục toàn bộ từ tệp JSON sao lưu"
          >
            <Upload size={13} />
            <span>Nhập Hết</span>
          </button>
        </div>
      </div>

      <DictionaryGroups value={activeTab} onChange={handleTabChange} counts={{ vietphrase: fullVietphrase.length, names_main: fullNamesMain.length, names_custom: namesList.length, phienam: fullPhienAm.length, luatnhan: fullLuatNhan.length, pronouns: fullPronouns.length, ignored_chinese: ignoredPhrasesList.length, ...Object.fromEntries(Object.entries(referenceData).map(([key, rows]) => [key, rows?.length])) }} />

      {/* PER-TAB ACTION TOOLBAR: TÌM KIẾM, IMPORT/EXPORT FILE TXT VÀ THÊM MỚI */}
      <div className={`px-4 py-2.5 border-b shrink-0 flex flex-wrap items-center justify-between gap-2 text-xs ${
        isLight ? 'bg-surface border-line' : isSepia ? 'bg-surface border-line' : 'bg-surface border-line'
      }`}>
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap basis-full @min-[768px]/app:basis-auto">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 min-w-[100px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder={`Tìm trong ${activeTab === 'vietphrase' ? 'Vietphrase' : activeTab === 'names_main' ? 'Names chính' : activeTab === 'names_custom' ? 'Names cá nhân' : 'bảng hiện tại'}...`}
              className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs outline-none transition-colors ${
                isLight ? 'bg-raised border-line focus:border-accent' : isSepia ? 'bg-surface border-line focus:border-accent text-main' : 'bg-surface border-line focus:border-accent text-main'
              }`}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Phân loại danh mục (chỉ khi xem Names cá nhân) */}
          {meaningKind && <select aria-label="Lọc từ điển theo văn phong" title="Văn phong" value={phraseStyle} onChange={event => { setPhraseStyle(event.target.value as typeof phraseStyle); setCurrentPage(1); }} className="max-w-[150px] rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-main">
            <option value="all">Mọi văn phong</option><option value="unclassified">Chưa phân loại</option>
            {Object.entries(STYLE_LABELS).filter(([key]) => key !== 'auto').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>}
          {activeTab === 'names_custom' && (
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
              className={`px-2 py-1.5 rounded-lg border text-xs outline-none cursor-pointer ${
                isLight ? 'bg-raised border-line' : isSepia ? 'bg-surface border-line text-main' : 'bg-surface border-line text-main'
              }`}
            >
              <option value="all">Tất cả loại</option>
              <option value="Nhân vật">Nhân vật</option>
              <option value="Địa danh">Địa danh</option>
              <option value="Tông môn">Tông môn</option>
              <option value="Binh khí">Binh khí</option>
              <option value="Công pháp">Công pháp</option>
              <option value="Khác">Khác</option>
            </select>
          )}
        </div>

        {/* Nút hành động riêng cho tệp hiện tại */}
        <select aria-label="Sắp xếp từ điển" value={sortRule} onChange={event => { setSortRule(event.target.value); setCurrentPage(1); }} className="min-w-0 max-w-[96px] @min-[768px]/app:max-w-[180px] rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-main">
          <option value="original">Thứ tự gốc</option><option value="source-asc">Từ gốc: tăng dần</option><option value="source-desc">Từ gốc: giảm dần</option><option value="length-desc">Từ dài trước</option><option value="length-asc">Từ ngắn trước</option><option value="meaning-asc">Nghĩa Việt: A–Z</option><option value="meaning-desc">Nghĩa Việt: Z–A</option>
        </select>
        {sorting && <span role="status" className="text-xs text-muted">Đang sắp xếp…</span>}
        <div className="flex items-center gap-1.5">
          <button
            aria-label="Nhập TXT" disabled={isReadOnly || isProcessing || tableLoading} onClick={() => singleFileInputRef.current?.click()}
            className={`flex items-center gap-1 px-1.5 @min-[768px]/app:px-2.5 py-1.5 rounded-lg border cursor-pointer hover:border-accent/50 transition-colors ${
              isLight ? 'bg-canvas border-line text-main' : isSepia ? 'bg-surface border-line text-main' : 'bg-surface border-line text-main'
            }`}
            title="Nhập tệp .txt riêng cho bảng này"
          >
            <Upload size={12} />
            <span>Nhập<span className="hidden @min-[768px]/app:inline"> TXT</span></span>
          </button>

          <button
            aria-label="Xuất TXT" onClick={handleExportCurrentTab}
            className={`flex items-center gap-1 px-1.5 @min-[768px]/app:px-2.5 py-1.5 rounded-lg border cursor-pointer hover:border-accent/50 transition-colors ${
              isLight ? 'bg-canvas border-line text-main' : isSepia ? 'bg-surface border-line text-main' : 'bg-surface border-line text-main'
            }`}
            title="Xuất tệp .txt chuẩn QuickTranslator cho bảng này"
          >
            <Download size={12} />
            <span>Xuất<span className="hidden @min-[768px]/app:inline"> TXT</span></span>
          </button>

          <button
            disabled={isReadOnly || isProcessing || tableLoading} onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1 px-1.5 @min-[768px]/app:px-2.5 py-1.5 rounded-lg bg-accent hover:bg-accent text-main font-medium cursor-pointer shadow-xs transition-colors"
          >
            <Plus size={13} />
            <span>Thêm</span>
          </button>

          {!isReadOnly && (
            <button
              onClick={handleClearCurrentTab}
              disabled={isDeleting || isProcessing || tableLoading}
              className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
              title="Xóa trắng bảng này"
              aria-label="Xóa toàn bộ bảng từ điển"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {referenceTab && <p className="px-4 py-2 text-xs text-muted">{referenceTab === 'vietphrase_merged' ? 'Bản file gộp lưu riêng trên thiết bị • Có thể sửa, xóa và xuất .txt. Nhập vào bảng Vietphrase nếu muốn dùng để dịch.' : 'Tệp tham khảo gốc • Chỉ đọc, tìm kiếm và xuất .txt.'}</p>}
      {activeTab === 'ignored_chinese' && <p className="px-4 py-2 text-xs text-muted">Các cụm đang được bỏ qua khi dịch • Sửa hoặc xóa sẽ cập nhật danh sách trên thiết bị.</p>}
      {/* BULK ACTION BAR KHI ĐANG CHỌN NHIỀU TỪ */}
      {selectedKeys.size > 0 && (
        <div className="px-4 py-2 bg-accent-soft/90 border-b border-accent/80 text-accent text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-main">Đã chọn {selectedKeys.size} từ</span>
            <span className="text-[11px] opacity-75">trong bảng {activeTab}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedKeys(new Set())}
              className="px-2.5 py-1 rounded-md bg-accent-soft/60 hover:bg-accent-soft text-accent text-xs cursor-pointer transition-colors"
            >
              Bỏ chọn tất cả
            </button>
            <button
              onClick={handleRequestBulkDelete}
              disabled={isDeleting || isProcessing}
              className="px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-main font-semibold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Trash2 size={13} />
              <span>Xóa {selectedKeys.size} từ đã chọn</span>
            </button>
          </div>
        </div>
      )}

      {/* DATA GRID / BẢNG DỮ LIỆU HIỂN THỊ */}
      <fieldset disabled={isProcessing} ref={listRef} className="flex-1 min-h-0 min-w-0 overflow-y-auto px-3 py-2">
        {paginatedData.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 opacity-50 text-xs">
            <Archive size={28} />
            <p>{referenceTab && !referenceData[referenceTab] ? referenceError || 'Đang tải từ điển…' : 'Không tìm thấy mục nào phù hợp'}</p>
          </div>
        ) : (
          <div className="text-xs font-mono">
            {/* Table Header: Cột Chọn tất cả, Từ tiếng Trung, Nghĩa tiếng Việt, Thao tác */}
            <div className={`flex items-center gap-2.5 py-1.5 px-2 border-b text-[11px] font-semibold opacity-70 ${
              isLight ? 'border-line text-main' : isSepia ? 'border-line text-main' : 'border-line text-muted'
            }`}>
              <input 
                type="checkbox"
                ref={element => {
                  if (element) element.indeterminate = filteredData.some(item => selectedKeys.has(item.chinese)) && !filteredData.every(item => selectedKeys.has(item.chinese));
                }}
                checked={filteredData.length > 0 && filteredData.every(i => selectedKeys.has(i.chinese))}
                onChange={() => handleToggleSelectAll(filteredData)}
                disabled={isReadOnly || isDeleting}
                className="rounded border-line bg-raised text-accent w-3.5 h-3.5 cursor-pointer shrink-0"
                title={`Chọn hoặc bỏ chọn tất cả ${filteredData.length} mục khớp bộ lọc trên mọi trang`}
                aria-label="Chọn tất cả kết quả trên mọi trang"
              />
              <span className="w-1/3 min-w-[120px]">Từ Gốc Tiếng Trung (Bên trái)</span>
              <span className="flex-1">Nghĩa Tiếng Việt</span>
              {meaningKind && <span className="hidden w-60 shrink-0 @min-[768px]/app:block">Văn phong theo nghĩa</span>}
              <span className="w-16 text-right">Thao tác</span>
            </div>

            <div className="divide-y divide-neutral-800/40">
              {paginatedData.map((item, idx) => {
                const isEditing = editingItem?.originalChinese === item.chinese;
                const isChecked = selectedKeys.has(item.chinese);
                const rowMeanings = meaningKind ? meaningRows(meaningKind, item.chinese, item.vietnamese) : [];

                return (
                  <div 
                    key={`${item.chinese}-${idx}`}
                    className={`py-2 px-2 flex flex-wrap items-center justify-between gap-3 transition-colors rounded-lg group ${
                      isChecked 
                        ? 'bg-accent-soft/30' 
                        : isLight ? 'hover:bg-raised' : isSepia ? 'hover:bg-surface/40' : 'hover:bg-raised/30'
                    }`}
                  >
                    {/* Checkbox chọn dòng */}
                    <input 
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelectKey(item.chinese)}
                      disabled={isReadOnly || isDeleting}
                      aria-label={`Chọn ${item.chinese}`}
                      className="rounded border-line bg-raised text-accent w-3.5 h-3.5 cursor-pointer shrink-0"
                    />

                    {/* Cột Từ Gốc Tiếng Trung (Bên trái) - Có thể sửa khi bấm nút Sửa */}
                    <div className="w-1/3 min-w-[120px] break-words whitespace-normal flex flex-wrap items-center gap-2 font-sans font-medium text-sm">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingItem.editChinese}
                          onChange={(e) => setEditingItem({ ...editingItem, editChinese: e.target.value })}
                          className="w-full px-2 py-1 rounded bg-surface border border-accent text-xs text-accent font-serif outline-none"
                          placeholder="Từ tiếng Trung"
                        />
                      ) : (
                        <>
                          <span className="text-accent font-semibold">{item.chinese}</span>
                          {(item as any).isCustom && (
                            <span className="text-[10px] text-amber-400 font-normal px-1 py-0.2 rounded bg-amber-950/50 border border-amber-800/40">
                              Cá nhân
                            </span>
                          )}
                          {(item as any).category && (
                            <span className="text-[10px] opacity-60 font-normal">
                              · {(item as any).category}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Cột Nghĩa Tiếng Việt / Bản Dịch - Có thể sửa khi bấm nút Sửa */}
                    <div className="flex-1 min-w-0 font-sans">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingItem.editViet}
                            disabled={activeTab === 'ignored_chinese'}
                            onChange={(e) => setEditingItem({ ...editingItem, editViet: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                            className="flex-1 px-2 py-1 rounded bg-surface border border-accent text-xs text-main outline-none"
                            placeholder="Nghĩa tiếng Việt"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveEdit}
                            className="p-1 rounded bg-accent text-main hover:bg-accent cursor-pointer"
                            title="Lưu thay đổi cả tiếng Trung và tiếng Việt"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => setEditingItem(null)}
                            className="p-1 rounded bg-hover text-main hover:bg-hover cursor-pointer"
                            title="Hủy"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className={isLight ? 'text-main' : isSepia ? 'text-main' : 'text-main'}>
                          {(activeTab === 'vietphrase' && selectedStylePhrases[item.chinese] ? selectedStylePhrases[item.chinese] : item.vietnamese) || <span className="opacity-40 italic">(Lược bỏ / rỗng)</span>}
                        </span>
                      )}
                    </div>

                    {meaningKind && <div className="order-last w-full min-w-0 shrink-0 font-sans @min-[768px]/app:order-none @min-[768px]/app:w-60">
                      <button type="button" aria-label={`Phân loại văn phong cho ${item.chinese}`} onClick={() => setStyleEditor({ kind: meaningKind, chinese: item.chinese, raw: item.vietnamese })} className="w-full rounded-lg border border-line/70 px-2 py-1.5 text-left text-[11px] text-muted hover:bg-raised hover:text-main">
                        {rowMeanings.slice(0, 2).map(row => <span key={row.meaning} className="mb-1 flex min-w-0 flex-wrap items-center gap-1 last:mb-0"><span className="max-w-full truncate font-medium text-main">{row.meaning || '(Lược bỏ)'}</span>{row.styles.length ? row.styles.slice(0, 2).map(style => <span key={style} className="rounded border border-line bg-raised px-1.5 py-0.5 text-accent">{STYLE_LABELS[style]}</span>) : <span>· Gắn văn phong</span>}{row.styles.length > 2 && <span>+{row.styles.length - 2}</span>}</span>)}
                        {rowMeanings.length > 2 && <span className="mt-1 block text-accent">Xem tất cả {rowMeanings.length} nghĩa</span>}
                      </button>
                    </div>}
                    {/* Cột Nút Hành Động (Sửa cả 2 từ / Xóa có xác nhận) */}
                    <div className="flex items-center gap-1 opacity-100 @min-[768px]/app:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0 w-16 justify-end">
                      {!isEditing && !isReadOnly && (
                        <button
                          onClick={() => {
                            setEditingItem({
                              originalChinese: item.chinese,
                              editChinese: item.chinese,
                              editViet: item.vietnamese,
                              id: (item as any).id
                            });
                          }}
                          className="p-1 text-muted hover:text-accent hover:bg-raised rounded cursor-pointer"
                          title="Sửa từ tiếng Trung bên trái và nghĩa tiếng Việt"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}

                      {!isReadOnly && (
                        <button
                          onClick={() => handleRequestDeleteItem(item.chinese)}
                          className="p-1 text-muted hover:text-red-400 hover:bg-raised rounded cursor-pointer"
                          title="Xóa mục này (kèm xác nhận)"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </fieldset>

      <DictionaryPagination totalItems={totalItems} pageSize={pageSize} setPageSize={value => { setPageSize(value); setCurrentPage(1); }} page={safeCurrentPage} totalPages={totalPages} setPage={setCurrentPage} />

      {/* MODAL: THÊM MỤC MỚI VÀO BẢNG ĐANG CHỌN */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-5 rounded-2xl shadow-2xl border text-sm space-y-4 animate-in zoom-in-95 duration-150 ${
            isLight ? 'bg-surface border-line text-main' : isSepia ? 'bg-surface border-line text-main' : 'bg-surface border-line text-main'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-line">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Plus size={16} className="text-accent" />
                Thêm Mục Mới Vào {activeTab === 'vietphrase' ? 'Vietphrase' : activeTab === 'names_custom' ? 'Names Cá Nhân' : activeTab === 'luatnhan' ? 'Luật Nhân' : 'Từ Điển'}
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                className="p-1 text-muted hover:text-main rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium opacity-70 mb-1">Từ gốc tiếng Trung / Cấu trúc:</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder={activeTab === 'luatnhan' ? 'Ví dụ: 在{0}的面前' : 'Ví dụ: 萧炎 hoặc 了'}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${
                    isLight ? 'bg-raised border-line' : isSepia ? 'bg-surface border-line' : 'bg-surface border-line text-main'
                  }`}
                  autoFocus
                />
              </div>

              {activeTab !== 'ignored_chinese' && <div>
                <label className="block text-xs font-medium opacity-70 mb-1">Nghĩa tiếng Việt / Mẫu dịch:</label>
                <input
                  type="text"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  placeholder={activeTab === 'luatnhan' ? 'Ví dụ: trước mặt {0}' : 'Ví dụ: Tiêu Viêm hoặc /liễu/rồi'}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${
                    isLight ? 'bg-raised border-line' : isSepia ? 'bg-surface border-line' : 'bg-surface border-line text-main'
                  }`}
                />
                <p className="text-[11px] opacity-50 mt-1">
                  Phân tách các nghĩa bằng dấu gạch chéo <code>/</code> (vd: <code>/liễu/rồi</code>)
                </p>
              </div>}

              {activeTab === 'names_custom' && (
                <div>
                  <label className="block text-xs font-medium opacity-70 mb-1">Phân loại tên riêng:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none cursor-pointer ${
                      isLight ? 'bg-raised border-line' : isSepia ? 'bg-surface border-line' : 'bg-surface border-line text-main'
                    }`}
                  >
                    <option value="Nhân vật">Nhân vật</option>
                    <option value="Địa danh">Địa danh</option>
                    <option value="Môn phái">Môn phái</option>
                    <option value="Vũ khí / Pháp bảo">Vũ khí / Pháp bảo</option>
                    <option value="Công pháp / Chiêu thức">Công pháp / Chiêu thức</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-line hover:bg-raised text-xs font-medium cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleAddNewEntry}
                className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent text-main text-xs font-semibold cursor-pointer shadow-sm"
              >
                Lưu vào Từ Điển
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA TỪ ĐIỂN TÙY BIẾN KÈM SỐ LƯỢNG */}
      {deleteConfirmModal && deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-surface border border-line p-5 text-main shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-main">Xác Nhận Xóa Từ Điển</h3>
                <p className="text-xs text-muted mt-0.5">
                  {deleteConfirmModal.count > 1 ? `Xóa ${deleteConfirmModal.count} từ đã chọn` : 'Xóa 1 từ khỏi từ điển'}
                </p>
              </div>
            </div>

            <div className="text-xs text-main leading-relaxed bg-canvas/80 p-3 rounded-xl border border-line">
              {deleteConfirmModal.count === 1 ? (
                <p>
                  Bạn có chắc chắn muốn xóa từ <strong className="text-accent font-bold">"{deleteConfirmModal.sampleTitle}"</strong> khỏi từ điển không?
                </p>
              ) : (
                <p>
                  Bạn có chắc chắn muốn xóa toàn bộ <strong className="text-rose-400 font-bold">{deleteConfirmModal.count}</strong> từ đã chọn khỏi từ điển không? Thao tác này sẽ cập nhật cơ sở dữ liệu và không thể hoàn tác.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className="px-4 py-2 bg-raised hover:bg-hover text-main rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting || isProcessing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-main rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Xác nhận xóa {deleteConfirmModal.count > 1 ? `(${deleteConfirmModal.count})` : ''}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
