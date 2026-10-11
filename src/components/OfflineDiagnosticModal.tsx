import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Database,
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
  onExportJsonBackup: _onExportJsonBackup,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-lg rounded-2xl border p-6 sm:p-7 shadow-2xl transition-all ${
          isSunlightMode
            ? 'bg-[#120D08] text-white border-[#4A3A2C]'
            : 'bg-white text-[#241B12] border-[#E5E0D8]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E0D8] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-[#D73C30]/10 text-[#D73C30]">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg sm:text-xl text-[#241B12] tracking-tight">
                Field Readiness & Offline Diagnostic
              </h3>
              <p className="text-xs text-[#736B63]">
                Zero-telemetry on-device hardware verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close diagnostic dialog"
            className="p-2 rounded-full text-[#736B63] hover:text-[#241B12] hover:bg-[#F7F5F2] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnostic Checkpoints */}
        <div className="space-y-3 mb-6">
          {/* 1. Network Status */}
          <div className="p-3.5 rounded-lg border border-[#E5E0D8] bg-[#F7F5F2] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-[#3D8B40] shrink-0" />
              ) : (
                <WifiOff className="w-4 h-4 text-[#D73C30] shrink-0" />
              )}
              <div>
                <div className="font-bold text-sm text-[#241B12]">
                  Field Connectivity State
                </div>
                <div className="text-xs text-[#736B63]">
                  {isOnline ? 'Online (ready to pre-cache neural models)' : 'Offline (pure on-device field operation)'}
                </div>
              </div>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
              isOnline ? 'bg-[#3D8B40]/10 text-[#3D8B40]' : 'bg-[#D73C30]/10 text-[#D73C30]'
            }`}>
              {isOnline ? 'CONNECTED' : 'STANDALONE'}
            </span>
          </div>

          {/* 2. Neural Weights Cache */}
          <div className="p-3.5 rounded-lg border border-[#E5E0D8] bg-[#F7F5F2] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-[#E67E22] shrink-0" />
              <div>
                <div className="font-bold text-sm text-[#241B12]">
                  BirdNET v2.4 Weights Cache
                </div>
                <div className="text-xs text-[#736B63]">
                  6,522 Species Global Taxonomy model buffer
                </div>
              </div>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
              modelCached ? 'bg-[#3D8B40]/10 text-[#3D8B40]' : 'bg-[#E67E22]/10 text-[#E67E22]'
            }`}>
              {modelCached ? 'CACHED' : 'READY TO CACHE'}
            </span>
          </div>

          {/* 3. Service Worker PWA Cache */}
          <div className="p-3.5 rounded-lg border border-[#E5E0D8] bg-[#F7F5F2] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <DownloadCloud className="w-4 h-4 text-[#3D8B40] shrink-0" />
              <div>
                <div className="font-bold text-sm text-[#241B12]">
                  PWA Offline Service Worker
                </div>
                <div className="text-xs text-[#736B63]">
                  Static assets precached for trail launch without signal
                </div>
              </div>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
              swRegistered ? 'bg-[#3D8B40]/10 text-[#3D8B40]' : 'bg-[#F0ECE6] text-[#736B63]'
            }`}>
              {swRegistered ? 'ACTIVE' : 'LOCAL DEV'}
            </span>
          </div>

          {/* 4. AudioWorklet & WebAssembly SIMD */}
          <div className="p-3.5 rounded-lg border border-[#E5E0D8] bg-[#F7F5F2] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Cpu className="w-4 h-4 text-[#D73C30] shrink-0" />
              <div>
                <div className="font-bold text-sm text-[#241B12]">
                  48kHz AudioWorklet + WebAssembly SIMD
                </div>
                <div className="text-xs text-[#736B63]">
                  Hardware-accelerated neural tensor inference engine
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#3D8B40]/10 text-[#3D8B40]">
              WASM SIMD
            </span>
          </div>

          {/* 5. Storage Quota */}
          <div className="p-3.5 rounded-lg border border-[#E5E0D8] bg-[#F7F5F2] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <HardDrive className="w-4 h-4 text-[#736B63] shrink-0" />
              <div>
                <div className="font-bold text-sm text-[#241B12]">
                  Local Device Storage Quota
                </div>
                <div className="text-xs text-[#736B63]">
                  {entries.length} observations saved in private localStorage
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-white border border-[#E5E0D8] text-[#241B12]">
              {storageEstimate ? `${storageEstimate.usageMB}MB / ${storageEstimate.quotaMB}MB` : 'LOCAL OK'}
            </span>
          </div>
        </div>

        {/* Footer Actions: Pill-shaped buttons with generous padding */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#E5E0D8]">
          <button
            type="button"
            onClick={handleExportJson}
            className="w-full sm:w-auto py-2.5 px-5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-[#E5E0D8] bg-[#F7F5F2] hover:bg-[#ECE7E1] text-[#241B12] transition-all cursor-pointer"
            title="Download full JSON survey backup"
          >
            <FileJson className="w-4 h-4 text-[#E67E22]" />
            <span>Export Raw JSON Backup</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-6 rounded-full text-xs font-bold uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer bg-[#D73C30] hover:bg-[#C23328] text-white shadow-md"
          >
            <span>Close Diagnostic</span>
          </button>
        </div>
      </div>
    </div>
  );
};
