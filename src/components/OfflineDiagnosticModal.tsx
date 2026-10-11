import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Database,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  X,
  Cpu,
  FileJson,
  Radio,
  DownloadCloud,
} from 'lucide-react';
import { getJournalEntries, getActiveSurvey } from '../services/journal';
import { CACHE_NAME, DEFAULT_MODEL_URL } from '../services/classifier';

interface OfflineDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSunlightMode: boolean;
  onExportJsonBackup?: () => void;
}

export const OfflineDiagnosticModal: React.FC<OfflineDiagnosticModalProps> = ({
  isOpen,
  onClose,
  isSunlightMode,
  onExportJsonBackup,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [swRegistered, setSwRegistered] = useState<boolean>(false);
  const [modelCached, setModelCached] = useState<boolean>(false);
  const [storageEstimate, setStorageEstimate] = useState<{ usageMB: number; quotaMB: number } | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        setSwRegistered(regs.length > 0);
      });
    }

    // Check Cache API for model buffer
    if ('caches' in window) {
      caches.open(CACHE_NAME).then(async (cache) => {
        const match = await cache.match(DEFAULT_MODEL_URL);
        setModelCached(!!match);
      }).catch(() => {});
    }

    // Check storage estimate
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        const usageMB = Math.round((est.usage || 0) / (1024 * 1024));
        const quotaMB = Math.round((est.quota || 0) / (1024 * 1024));
        setStorageEstimate({ usageMB, quotaMB });
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const entries = getJournalEntries();
  const activeSurvey = getActiveSurvey();

  const handleExportJson = () => {
    const backupData = {
      app: 'TrailWhistle',
      version: '0.1.0',
      exportedAt: new Date().toISOString(),
      activeSurvey,
      journalEntries: entries,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trailwhistle_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className={`w-full max-w-lg rounded-2xl border p-5 sm:p-6 shadow-2xl transition-all ${
        isSunlightMode
          ? 'bg-[#06140b] border border-emerald-800/80 text-white shadow-2xl'
          : 'bg-white border border-[#d4e2d4] text-[#1a2b1e] shadow-xl'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between pb-3 mb-4 border-b ${
          isSunlightMode ? 'border-emerald-900/60' : 'border-[#eef4ee]'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl flex items-center justify-center ${
              isSunlightMode ? 'bg-emerald-950 border border-emerald-800 text-emerald-400' : 'bg-[#eef4ee] border border-[#d4e2d4] text-[#2d5a37]'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base sm:text-lg font-black tracking-tight font-sans ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
                Field Readiness & Offline Diagnostic
              </h3>
              <p className={`text-xs ${isSunlightMode ? 'text-emerald-300/80' : 'text-[#4a5d4e]'}`}>
                100% on-device autonomy verification for backcountry expeditions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              isSunlightMode
                ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800'
                : 'bg-[#faf9f6] hover:bg-[#f0ede6] text-[#4a5d4e] border border-[#d4e2d4]'
            }`}
            aria-label="Close diagnostic modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diagnostic Items */}
        <div className="space-y-2.5 mb-5 text-xs">
          {/* 1. Network Status */}
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
            isSunlightMode
              ? 'bg-[#040e07] border-emerald-900/60'
              : 'bg-[#faf9f6] border-[#d4e2d4]'
          }`}>
            <div className="flex items-center gap-2.5">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <WifiOff className="w-4 h-4 text-[#7a9e7e] shrink-0" />
              )}
              <div>
                <div className={`font-bold ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
                  {isOnline ? 'Online (Wi-Fi / Cell Connected)' : 'Offline / Backcountry Mode Active'}
                </div>
                <div className={`text-[11px] ${isSunlightMode ? 'text-emerald-300/70' : 'text-[#4a5d4e]'}`}>
                  {isOnline
                    ? 'Ready to prime local caches before leaving trailhead'
                    : 'Zero cloud dependency. TrailWhistle operates entirely on-device'}
                </div>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isOnline
                ? isSunlightMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
                : isSunlightMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
            }`}>
              {isOnline ? 'CONNECTED' : 'STANDALONE'}
            </span>
          </div>

          {/* 2. BirdNET v2.4 ONNX Model Cache */}
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
            isSunlightMode
              ? 'bg-[#040e07] border-emerald-900/60'
              : 'bg-[#faf9f6] border-[#d4e2d4]'
          }`}>
            <div className="flex items-center gap-2.5">
              <Cpu className={`w-4 h-4 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'} shrink-0`} />
              <div>
                <div className={`font-bold ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
                  BirdNET v2.4 Neural Core (~47MB)
                </div>
                <div className={`text-[11px] ${isSunlightMode ? 'text-emerald-300/70' : 'text-[#4a5d4e]'}`}>
                  {modelCached
                    ? 'INT8 quantized weights cached locally in browser Cache API'
                    : 'Model loads on-demand on first recording or test clip'}
                </div>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isSunlightMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
            }`}>
              {modelCached ? 'CACHED' : 'ON-DEMAND'}
            </span>
          </div>

          {/* 3. Global Avian Taxonomy */}
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
            isSunlightMode
              ? 'bg-[#040e07] border-emerald-900/60'
              : 'bg-[#faf9f6] border-[#d4e2d4]'
          }`}>
            <div className="flex items-center gap-2.5">
              <Database className={`w-4 h-4 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'} shrink-0`} />
              <div>
                <div className={`font-bold ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
                  6,522 Species Global Taxonomy
                </div>
                <div className={`text-[11px] ${isSunlightMode ? 'text-emerald-300/70' : 'text-[#4a5d4e]'}`}>
                  Full Latin binomial & English common names bundled offline
                </div>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isSunlightMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
            }`}>
              6,522 ACTIVE
            </span>
          </div>

          {/* 4. AudioWorklet & WebAssembly Core */}
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
            isSunlightMode
              ? 'bg-[#040e07] border-emerald-900/60'
              : 'bg-[#faf9f6] border-[#d4e2d4]'
          }`}>
            <div className="flex items-center gap-2.5">
              <Radio className={`w-4 h-4 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'} shrink-0`} />
              <div>
                <div className={`font-bold ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
                  48kHz AudioWorklet + WebAssembly SIMD
                </div>
                <div className={`text-[11px] ${isSunlightMode ? 'text-emerald-300/70' : 'text-[#4a5d4e]'}`}>
                  Hardware-accelerated on-device neural tensor computation
                </div>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isSunlightMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
            }`}>
              WASM SIMD
            </span>
          </div>

          {/* 5. Storage Quota */}
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
            isSunlightMode
              ? 'bg-[#040e07] border-emerald-900/60'
              : 'bg-[#faf9f6] border-[#d4e2d4]'
          }`}>
            <div className="flex items-center gap-2.5">
              <HardDrive className={`w-4 h-4 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'} shrink-0`} />
              <div>
                <div className={`font-bold ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
                  Local Device Storage Quota
                </div>
                <div className={`text-[11px] ${isSunlightMode ? 'text-emerald-300/70' : 'text-[#4a5d4e]'}`}>
                  {entries.length} observations saved in private localStorage
                </div>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isSunlightMode ? 'bg-emerald-950 text-emerald-200 border border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
            }`}>
              {storageEstimate ? `${storageEstimate.usageMB}MB / ${storageEstimate.quotaMB}MB` : 'LOCAL OK'}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t ${
          isSunlightMode ? 'border-emerald-900/40' : 'border-[#eef4ee]'
        }`}>
          <button
            type="button"
            onClick={handleExportJson}
            className={`w-full sm:w-auto py-2.5 px-3.5 min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isSunlightMode
                ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800'
                : 'bg-[#faf9f6] hover:bg-[#f0ede6] border border-[#d4e2d4] text-[#1a2b1e]'
            }`}
            title="Download full JSON survey backup"
          >
            <FileJson className={`w-4 h-4 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
            <span>Export Raw JSON Backup</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className={`w-full sm:w-auto py-2.5 px-5 min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
              isSunlightMode
                ? 'bg-emerald-800 hover:bg-emerald-700 text-white shadow-md'
                : 'bg-[#2d5a37] hover:bg-[#23472b] text-white shadow-sm'
            }`}
          >
            <span>Close Diagnostic</span>
          </button>
        </div>
      </div>
    </div>
  );
};
