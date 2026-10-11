import React, { useState } from 'react';
import { FlaskConical, Play, Check, ChevronDown, ChevronUp, Music } from 'lucide-react';
import { SAMPLE_AUDIO_LIST, SampleAudioItem } from '../data/sampleAudio';

interface TestingSectionProps {
  onSelectSample: (sample: SampleAudioItem) => void;
  selectedSample: SampleAudioItem | null;
  isProcessing: boolean;
  isSunlightMode: boolean;
}

export const TestingSection: React.FC<TestingSectionProps> = ({
  onSelectSample,
  selectedSample,
  isProcessing,
  isSunlightMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`rounded-xl border transition-all ${
        isSunlightMode
          ? 'bg-[#06140b] border border-emerald-800/80 text-white shadow-xl'
          : 'bg-white border border-[#d4e2d4] text-[#1a2b1e] shadow-sm'
      }`}
    >
      {/* Collapsible Trigger Header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full p-3 sm:p-3.5 flex items-center justify-between text-left transition-colors ${
          isSunlightMode ? 'hover:bg-emerald-950/40' : 'hover:bg-[#faf9f6]'
        }`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`p-1.5 rounded-lg flex items-center justify-center ${
              isSunlightMode
                ? 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold tracking-tight ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
                Field testing & audio simulation
              </span>
              <span
                className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${
                  isSunlightMode
                    ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                    : 'bg-[#eef4ee] border border-[#d4e2d4] text-[#2d5a37]'
                }`}
              >
                For testing only
              </span>
            </div>
            <p className={`text-[11px] mt-0.5 ${isSunlightMode ? 'text-emerald-400/80' : 'text-[#4a5d4e]'}`}>
              Simulate live field audio using real pre-bundled xeno-canto recordings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className={`text-[11px] font-semibold hidden sm:inline ${
            isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'
          }`}>
            {isOpen ? 'Collapse' : 'Expand (4 Clips)'}
          </span>
          <div
            className={`p-1 rounded-lg ${
              isSunlightMode ? 'bg-emerald-950 text-emerald-300' : 'bg-[#faf9f6] text-[#4a5d4e]'
            }`}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expanded Testing Content */}
      {isOpen && (
        <div className={`p-3.5 pt-2 border-t ${
          isSunlightMode ? 'border-emerald-800/40' : 'border-[#eef4ee]'
        } animate-fade-in`}>
          <div className={`p-2.5 rounded-lg text-xs mb-3 flex items-start gap-2 ${
            isSunlightMode
              ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-200'
              : 'bg-[#faf9f6] border border-[#d4e2d4] text-[#1a2b1e]'
          }`}>
            <Music className={`w-4 h-4 shrink-0 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'} mt-0.5`} />
            <p className="leading-relaxed text-[11px]">
              <strong>Offline QA & Testing:</strong> Tap any sample to feed a 3-second 48kHz audio snippet directly into the BirdNET v2.4 ONNX inference worker and verify real-time classification, checklist updates, and confidence scoring.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {SAMPLE_AUDIO_LIST.map((sample) => {
              const isSelected = selectedSample?.id === sample.id;
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => onSelectSample(sample)}
                  disabled={isProcessing}
                  className={`p-2.5 rounded-xl border text-left min-h-[52px] flex items-center justify-between transition-all ${
                    isSelected
                      ? isSunlightMode
                        ? 'bg-emerald-800 border-emerald-500 text-white font-bold ring-2 ring-emerald-400'
                        : 'bg-[#2d5a37] border-[#2d5a37] text-white font-bold ring-2 ring-[#7a9e7e]'
                      : isSunlightMode
                        ? 'bg-[#06120a] border-emerald-900/80 hover:bg-emerald-950/60 text-white'
                        : 'bg-[#faf9f6] border-[#d4e2d4] hover:border-[#7a9e7e] text-[#1a2b1e]'
                  }`}
                >
                  <div className="overflow-hidden pr-1">
                    <div className="font-semibold text-xs truncate">{sample.speciesName}</div>
                    <div
                      className={`text-[10px] truncate ${
                        isSelected
                          ? 'text-white/80'
                          : isSunlightMode
                            ? 'text-emerald-400/70'
                            : 'text-[#4a5d4e]'
                      }`}
                    >
                      {sample.scientificName}
                    </div>
                  </div>
                  {isSelected ? (
                    <Check className="w-4 h-4 shrink-0 text-white" />
                  ) : (
                    <Play className={`w-3.5 h-3.5 shrink-0 opacity-70 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
