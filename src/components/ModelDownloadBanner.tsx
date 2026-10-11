import React from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { ModelProgressInfo } from '../types/model';

interface ModelDownloadBannerProps {
  progressInfo: ModelProgressInfo;
  onRetry: () => void;
  isSunlightMode: boolean;
}

export const ModelDownloadBanner: React.FC<ModelDownloadBannerProps> = ({
  progressInfo,
  onRetry,
  isSunlightMode: _isSunlightMode,
}) => {
  if (progressInfo.status === 'idle') {
    return null;
  }

  if (progressInfo.status === 'ready') {
    return (
      <div className="p-3.5 rounded-lg border border-[#3D8B40]/30 bg-[#3D8B40]/10 text-[#241B12] mb-5 text-xs flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#3D8B40] shrink-0" />
          <span>BirdNET v2.4 cached on-device. 100% offline audio identification ready (6,522 species).</span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider text-[#3D8B40]">Offline Active</span>
      </div>
    );
  }

  if (progressInfo.status === 'loading') {
    const loadedMB = progressInfo.loadedBytes ? (progressInfo.loadedBytes / (1024 * 1024)).toFixed(1) : null;
    const totalMB = progressInfo.totalBytes ? (progressInfo.totalBytes / (1024 * 1024)).toFixed(1) : null;

    return (
      <div className="p-5 rounded-lg border border-[#E5E0D8] bg-white text-[#241B12] mb-5 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 text-sm font-bold font-serif">
            <RefreshCw className="w-4 h-4 animate-spin text-[#D73C30]" />
            <span>Downloading On-Device BirdNET v2.4 Model (~47MB)...</span>
          </div>
          <span className="text-xs font-mono font-bold text-[#D73C30]">{progressInfo.progress}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full overflow-hidden bg-[#F0ECE6]">
          <div
            className="h-full transition-all duration-300 rounded-full bg-[#D73C30]"
            style={{ width: `${Math.max(5, progressInfo.progress)}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2.5 text-[11px] text-[#736B63]">
          <span>{progressInfo.file ? `Weights: ${progressInfo.file.split('/').pop()}` : 'Initializing ONNX runtime...'}</span>
          {loadedMB && totalMB ? <span>{loadedMB}MB / {totalMB}MB</span> : <span>One-time download</span>}
        </div>
      </div>
    );
  }

  if (progressInfo.status === 'error') {
    return (
      <div className="p-5 rounded-lg border border-red-300 bg-red-50 text-red-950 mb-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-sm mb-1 font-serif">Model Loading Error</h4>
            <p className="mb-3 leading-relaxed">{progressInfo.errorMessage || 'Unable to download model files. Check connection to prime cache.'}</p>
            <button
              type="button"
              onClick={onRetry}
              className="px-5 py-2 font-bold uppercase tracking-wider text-xs rounded-full inline-flex items-center gap-2 transition-all text-white bg-[#D73C30] hover:bg-[#C23328] shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Download</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
