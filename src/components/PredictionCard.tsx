import React from 'react';
import { Check, Edit3, Bird, Sparkles, MapPin, Info, HelpCircle, ShieldCheck, Activity, Music } from 'lucide-react';
import { PredictionResult } from '../types/journal';

interface PredictionCardProps {
  predictions: PredictionResult[];
  onConfirm: (prediction: PredictionResult) => void;
  onOpenEditModal: (prediction: PredictionResult) => void;
  isSunlightMode: boolean;
  embeddedInHero?: boolean;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({
  predictions,
  onConfirm,
  onOpenEditModal,
  isSunlightMode,
  embeddedInHero: _embeddedInHero = false,
}) => {
  if (!predictions || predictions.length === 0) return null;

  const topPrediction = predictions[0];
  const isUnknown = topPrediction.speciesId === 'unknown' || topPrediction.confidence < 0.25;
  const runnersUp = isUnknown ? [] : predictions.slice(1, 3);

  return (
    <div className="space-y-4 mt-4 animate-fade-in">
      {/* (5) TOP SPECIES CARD: white, thin light border, ~8px rounded corners (rounded-lg) */}
      <div
        className={`p-6 rounded-lg border transition-all ${
          isSunlightMode
            ? isUnknown
              ? 'bg-[#180E05] border-[#E67E22] text-white shadow-xl'
              : 'bg-[#120D08] border-[#4A3A2C] text-white shadow-xl'
            : 'bg-white border-[#E5E0D8] text-[#241B12] shadow-sm'
        }`}
      >
        {/* Top Header Badge */}
        <div className="flex items-center justify-between mb-3.5">
          <span
            className={`text-xs uppercase tracking-wider font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 ${
              isUnknown
                ? 'bg-[#E67E22]/15 text-[#E67E22]'
                : 'bg-[#3D8B40]/15 text-[#3D8B40]'
            }`}
          >
            {isUnknown ? (
              <>
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Inconclusive Audio (&lt;25%)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#D73C30]" />
                <span>Top Bioacoustic Match</span>
              </>
            )}
          </span>

          <span className="font-mono text-sm font-bold text-[#D73C30]">
            {Math.round(topPrediction.confidence * 100)}% Confidence
          </span>
        </div>

        {/* Confidence Gauge Bar */}
        <div className="w-full h-2 rounded-full overflow-hidden mb-4 bg-[#F0ECE6]">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isUnknown ? 'bg-[#E67E22]' : 'bg-[#D73C30]'
            }`}
            style={{ width: `${Math.max(8, Math.round(topPrediction.confidence * 100))}%` }}
          />
        </div>

        {/* (5) TYPOGRAPHY: bold common name (sans 18px), italic gray scientific name (15px) below */}
        <div className="mb-4">
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h3 className="font-sans font-bold text-[18px] text-[#241B12] leading-snug">
              {topPrediction.commonName}
            </h3>
            {topPrediction.iucnStatus && !isUnknown && (
              <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-[#F7F5F2] border border-[#E5E0D8] text-[#736B63] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#3D8B40]" />
                <span>{topPrediction.iucnStatus}</span>
              </span>
            )}
          </div>
          <p className="font-sans italic text-[15px] text-[#736B63]">
            {topPrediction.scientificName}
            {topPrediction.family && (
              <span className="not-italic font-sans opacity-80 ml-2 text-xs">
                • {topPrediction.family}
              </span>
            )}
          </p>
        </div>

        {/* Habitat & Acoustic Bio Details */}
        <div className="p-4 rounded-lg text-sm mb-5 space-y-2.5 bg-[#F7F5F2] border border-[#E5E0D8] text-[#332A22]">
          {isUnknown ? (
            <div className="flex items-start gap-2 text-xs">
              <Info className="w-4 h-4 shrink-0 text-[#E67E22] mt-0.5" />
              <span className="leading-relaxed">
                <strong className="font-bold text-[#241B12]">Honest Detection:</strong> Signal confidence is below the 25% threshold. We never invent fake species. Try recording closer to the bird or during a louder call.
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 text-xs">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-[#D73C30] mt-0.5" />
                <span>
                  <strong className="font-bold text-[#241B12]">Habitat:</strong> {topPrediction.habitat}
                </span>
              </div>
              {topPrediction.callType && (
                <div className="flex items-start gap-2 text-xs">
                  <Music className="w-3.5 h-3.5 shrink-0 text-[#E67E22] mt-0.5" />
                  <span>
                    <strong className="font-bold text-[#241B12]">Acoustic Vocalization:</strong> {topPrediction.callType}
                  </span>
                </div>
              )}
              {topPrediction.frequencyBandHz && (
                <div className="flex items-start gap-2 text-xs">
                  <Activity className="w-3.5 h-3.5 shrink-0 text-[#3D8B40] mt-0.5" />
                  <span>
                    <strong className="font-bold text-[#241B12]">Bioacoustic Frequency:</strong> {topPrediction.frequencyBandHz}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* (6) BUTTONS: pill-shaped (fully rounded), solid fill, white bold text, generous padding */}
        <div className="grid grid-cols-2 gap-3">
          {/* Primary / Success button: Leaf Green (#3D8B40) or Coral-red (#D73C30) */}
          <button
            type="button"
            onClick={() => onConfirm(topPrediction)}
            className={`py-3 px-5 rounded-full font-bold text-xs uppercase tracking-wider text-white flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-102 active:scale-98 cursor-pointer ${
              isUnknown
                ? 'bg-[#E67E22] hover:bg-[#D35400]'
                : 'bg-[#3D8B40] hover:bg-[#2E7D32]'
            }`}
          >
            <Check className="w-4 h-4 text-white" />
            <span>{isUnknown ? 'Log as Unknown' : 'Quick Confirm'}</span>
          </button>

          {/* Secondary button: Pumpkin Orange (#E67E22) */}
          <button
            type="button"
            onClick={() => onOpenEditModal(topPrediction)}
            className="py-3 px-5 rounded-full font-bold text-xs uppercase tracking-wider text-white bg-[#E67E22] hover:bg-[#D35400] flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-102 active:scale-98 cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-white" />
            <span>Add Notes / GPS</span>
          </button>
        </div>
      </div>

      {/* Runner-up Candidates (Species Card style) */}
      {runnersUp.length > 0 && (
        <div className="p-5 rounded-lg border bg-white border-[#E5E0D8] shadow-sm text-[#241B12]">
          <div className="text-xs uppercase tracking-wider font-semibold text-[#736B63] mb-3 flex items-center gap-1.5">
            <Bird className="w-3.5 h-3.5 text-[#D73C30]" />
            <span>Alternate probable taxa:</span>
          </div>

          <div className="space-y-2.5">
            {runnersUp.map((candidate, idx) => (
              <div
                key={candidate.speciesId || idx}
                className="p-3.5 rounded-lg border border-[#E5E0D8] bg-[#F7F5F2] flex items-center justify-between transition-all hover:border-[#D73C30]"
              >
                <div className="flex-1 pr-3">
                  <div className="font-sans font-bold text-[16px] text-[#241B12]">
                    {candidate.commonName}
                  </div>
                  <div className="font-sans italic text-[14px] text-[#736B63]">
                    {candidate.scientificName}
                  </div>
                  {/* Miniature confidence gauge */}
                  <div className="w-32 h-1.5 rounded-full mt-2 overflow-hidden bg-[#E5E0D8]">
                    <div
                      className="h-full rounded-full bg-[#E67E22]"
                      style={{ width: `${Math.round(candidate.confidence * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-[#D73C30]">
                    {Math.round(candidate.confidence * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenEditModal(candidate)}
                    className="py-1.5 px-4 rounded-full text-xs font-bold text-white bg-[#D73C30] hover:bg-[#C23328] shadow-sm transition-all cursor-pointer"
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
