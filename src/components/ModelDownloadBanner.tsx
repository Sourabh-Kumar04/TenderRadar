import React from 'react';
import { DownloadCloud, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { ModelProgressInfo } from '../types/model';

interface ModelDownloadBannerProps {
  progressInfo: ModelProgressInfo;
  onRetry: () => void;
  isSunlightMode: boolean;
}

export const ModelDownloadBanner: React.FC<ModelDownloadBannerProps> = ({
  progressInfo,
  onRetry,
  isSunlightMode,
}) => {
  if (progressInfo.status === 'idle') {
    return null;
  }

  if (progressInfo.status === 'ready') {
    return (
      <div className={`p-3 rounded-xl border mb-4 text-xs flex items-center justify-between ${
        isSunlightMode 
          ? 'bg-[#06140b] border-emerald-800 text-emerald-300 font-bold' 
          : 'bg-[#eef4ee] border-[#d4e2d4] text-[#2d5a37]'
      }`}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>BirdNET v2.4 cached locally. 100% offline audio identification ready (6,522 species).</span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">Offline Active</span>
      </div>
    );
  }

  if (progressInfo.status === 'loading') {
    const loadedMB = progressInfo.loadedBytes ? (progressInfo.loadedBytes / (1024 * 1024)).toFixed(1) : null;
    const totalMB = progressInfo.totalBytes ? (progressInfo.totalBytes / (1024 * 1024)).toFixed(1) : null;

    return (
      <div className={`p-4 rounded-xl border mb-4 shadow-sm ${
        isSunlightMode 
          ? 'bg-[#06140b] border-emerald-800 text-white' 
          : 'bg-white border-[#d4e2d4] text-[#1a2b1e]'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <RefreshCw className={`w-4 h-4 animate-spin ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
            <span>Downloading On-Device BirdNET v2.4 Model (~47MB)...</span>
          </div>
          <span className="text-xs font-mono font-bold">{progressInfo.progress}%</span>
        </div>

        {/* Progress Bar */}
        <div className={`w-full h-2.5 rounded-full overflow-hidden ${
          isSunlightMode ? 'bg-emerald-950' : 'bg-[#eef4ee]'
        }`}>
          <div
            className={`h-full transition-all duration-300 ${
              isSunlightMode ? 'bg-emerald-400' : 'bg-[#2d5a37]'
            }`}
            style={{ width: `${Math.max(5, progressInfo.progress)}%` }}
          />
        </div>

        <div className={`flex items-center justify-between mt-2 text-[11px] ${
          isSunlightMode ? 'text-emerald-400/80' : 'text-[#4a5d4e]'
        }`}>
          <span>{progressInfo.file ? `Weights: ${progressInfo.file.split('/').pop()}` : 'Initializing ONNX runtime...'}</span>
          {loadedMB && totalMB ? <span>{loadedMB}MB / {totalMB}MB</span> : <span>One-time download</span>}
        </div>
      </div>
    );
  }

  if (progressInfo.status === 'error') {
    return (
      <div className={`p-4 rounded-xl border mb-4 ${
        isSunlightMode 
          ? 'bg-red-950/80 border-red-700/80 text-red-200' 
          : 'bg-red-50 border-red-200 text-red-800'
      }`}>
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-sm mb-1">Model Loading Error</h4>
            <p className="mb-2 leading-relaxed">{progressInfo.errorMessage || 'Unable to download model files. Check connection to prime cache.'}</p>
            <button
              type="button"
              onClick={onRetry}
              className={`px-3 py-1.5 min-h-[36px] font-bold text-xs rounded-lg inline-flex items-center gap-1.5 transition-all text-white ${
                isSunlightMode
                  ? 'bg-red-800 hover:bg-red-700'
                  : 'bg-red-700 hover:bg-red-800'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Download
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
