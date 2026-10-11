import React from 'react';
import { Check, Edit3, Bird, Sparkles, MapPin, Info, HelpCircle, ShieldCheck, Activity, Music } from 'lucide-react';
import { PredictionResult } from '../types/journal';

interface PredictionCardProps {
  predictions: PredictionResult[];
  onConfirm: (prediction: PredictionResult) => void;
  onOpenEditModal: (prediction: PredictionResult) => void;
  isSunlightMode: boolean;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({
  predictions,
  onConfirm,
  onOpenEditModal,
  isSunlightMode,
}) => {
  if (!predictions || predictions.length === 0) return null;

  const topPrediction = predictions[0];
  const isUnknown = topPrediction.speciesId === 'unknown' || topPrediction.confidence < 0.25;
  const runnersUp = isUnknown ? [] : predictions.slice(1, 3);

  return (
    <div className="space-y-3.5 mt-4 animate-fade-in">
      {/* Top Prediction Banner */}
      <div className={`p-5 sm:p-6 rounded-2xl border transition-all ${
        isSunlightMode
          ? isUnknown
            ? 'bg-[#180e05] border border-amber-600/60 text-amber-50 shadow-xl'
            : 'bg-[#06140b] border border-emerald-700/80 text-white shadow-xl'
          : 'bg-white border-[#d4e2d4] text-[#1a2b1e] shadow-sm'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[11px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
            isSunlightMode
              ? isUnknown
                ? 'bg-amber-950 text-amber-300 border border-amber-600/60'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
              : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
          }`}>
            {isUnknown ? (
              <>
                <HelpCircle className={`w-3.5 h-3.5 ${isSunlightMode ? 'text-amber-400' : 'text-[#7a9e7e]'}`} />
                <span>Inconclusive Audio (&lt;25%)</span>
              </>
            ) : (
              <>
                <Sparkles className={`w-3.5 h-3.5 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
                <span>Top Bioacoustic Match</span>
              </>
            )}
          </span>

          <span className={`font-mono text-xs sm:text-sm font-extrabold ${
            isSunlightMode
              ? isUnknown ? 'text-amber-400' : 'text-emerald-300'
              : 'text-[#2d5a37]'
          }`}>
            {Math.round(topPrediction.confidence * 100)}% Confidence
          </span>
        </div>

        {/* Confidence Gauge Bar */}
        <div className={`w-full h-2 rounded-full overflow-hidden mb-4 ${
          isSunlightMode ? 'bg-black/60 border border-emerald-950' : 'bg-[#eef4ee]'
        }`}>
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isSunlightMode
                ? isUnknown
                  ? 'bg-amber-500'
                  : 'bg-emerald-400'
                : 'bg-[#7a9e7e]'
            }`}
            style={{ width: `${Math.max(8, Math.round(topPrediction.confidence * 100))}%` }}
          />
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h3 className={`text-2xl sm:text-3xl font-black tracking-tight ${
              isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'
            }`}>{topPrediction.commonName}</h3>
            {topPrediction.iucnStatus && !isUnknown && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                isSunlightMode
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-[#f4f7f4] border border-[#d4e2d4] text-[#2d5a37]'
              }`}>
                <ShieldCheck className={`w-3 h-3 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
                <span>{topPrediction.iucnStatus}</span>
              </span>
            )}
          </div>
          <p className={`text-xs italic ${isSunlightMode ? 'text-emerald-300/80' : 'text-[#4a5d4e]'}`}>
            {topPrediction.scientificName}
            {topPrediction.family && (
              <span className="not-italic font-sans opacity-90 ml-2 text-[11px] font-medium">
                • {topPrediction.family}
              </span>
            )}
          </p>
        </div>

        {/* Habitat & Acoustic Details */}
        <div className={`p-3.5 rounded-xl text-xs mb-4 space-y-2 border ${
          isSunlightMode
            ? isUnknown
              ? 'bg-[#1a0e05]/80 border-amber-900/60 text-amber-100'
              : 'bg-[#040e07] border-emerald-900/80 text-emerald-100'
            : 'bg-[#faf9f6] border border-[#d4e2d4] text-[#4a5d4e]'
        }`}>
          {isUnknown ? (
            <div className="flex items-start gap-2">
              <Info className={`w-4 h-4 shrink-0 mt-0.5 ${isSunlightMode ? 'text-amber-400' : 'text-[#7a9e7e]'}`} />
              <span className="leading-relaxed">
                <strong className={`font-bold ${isSunlightMode ? 'text-amber-300' : 'text-[#1a2b1e]'}`}>Honest Detection:</strong> Signal confidence is below the 25% threshold. We never invent fake species. Try recording closer to the bird or during a louder call.
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <MapPin className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
                <span><strong className={`font-bold ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>Habitat:</strong> {topPrediction.habitat}</span>
              </div>
              {topPrediction.callType && (
                <div className="flex items-start gap-2">
                  <Music className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
                  <span><strong className={`font-bold ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>Acoustic Vocalization:</strong> {topPrediction.callType}</span>
                </div>
              )}
              {topPrediction.frequencyBandHz && (
                <div className="flex items-start gap-2">
                  <Activity className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isSunlightMode ? 'text-teal-400' : 'text-[#7a9e7e]'}`} />
                  <span><strong className={`font-bold ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>Bioacoustic Frequency:</strong> {topPrediction.frequencyBandHz}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onConfirm(topPrediction)}
            className={`py-3 min-h-[48px] px-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer ${
              isSunlightMode
                ? isUnknown
                  ? 'bg-amber-800 hover:bg-amber-700 text-white border border-amber-600/80'
                  : 'bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500/50'
                : 'bg-[#7a9e7e] hover:bg-[#688f6c] text-white shadow-sm'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{isUnknown ? 'Log as Unknown' : 'Quick Confirm'}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenEditModal(topPrediction)}
            className={`py-3 min-h-[48px] px-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer ${
              isSunlightMode
                ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800'
                : 'bg-[#f4f7f4] hover:bg-[#eef4ee] text-[#1a2b1e] border border-[#d4e2d4]'
            }`}
          >
            <Edit3 className={`w-4 h-4 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
            <span>Add Notes / GPS</span>
          </button>
        </div>
      </div>

      {/* Runner-up Candidates (Only shown for valid real matches >= 25%, never padded) */}
      {runnersUp.length > 0 && (
        <div className={`p-4 rounded-2xl border transition-all ${
          isSunlightMode
            ? 'bg-[#06140b] border-emerald-900/70 shadow-lg text-white'
            : 'bg-white border-[#d4e2d4] shadow-sm text-[#1a2b1e]'
        }`}>
          <div className={`text-xs font-semibold mb-2.5 flex items-center gap-1.5 ${
            isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'
          }`}>
            <Bird className={`w-3.5 h-3.5 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
            <span>Alternate probable taxa:</span>
          </div>

          <div className="space-y-2">
            {runnersUp.map((candidate, idx) => (
              <div
                key={candidate.speciesId || idx}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  isSunlightMode
                    ? 'bg-[#040e07] border-emerald-900/80 text-white'
                    : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e]'
                }`}
              >
                <div className="flex-1 pr-3">
                  <div className="font-bold text-xs sm:text-sm">{candidate.commonName}</div>
                  <div className={`text-[10px] italic ${isSunlightMode ? 'text-emerald-400/70' : 'text-[#4a5d4e]'}`}>
                    {candidate.scientificName}
                  </div>
                  {/* Miniature confidence bar */}
                  <div className={`w-32 h-1.5 rounded-full mt-2 overflow-hidden ${
                    isSunlightMode ? 'bg-black/60 border border-emerald-950' : 'bg-[#eef4ee]'
                  }`}>
                    <div
                      className={`h-full rounded-full ${
                        isSunlightMode ? 'bg-emerald-400' : 'bg-[#7a9e7e]'
                      }`}
                      style={{ width: `${Math.round(candidate.confidence * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className={`font-mono text-xs font-bold ${
                    isSunlightMode ? 'text-emerald-300' : 'text-[#2d5a37]'
                  }`}>
                    {Math.round(candidate.confidence * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenEditModal(candidate)}
                    className={`py-1.5 px-3 min-h-[38px] rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                      isSunlightMode
                        ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800'
                        : 'bg-white hover:bg-[#eef4ee] text-[#1a2b1e] border border-[#d4e2d4] shadow-xs'
                    }`}
                    title="Select this candidate instead"
                  >
                    Select
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
