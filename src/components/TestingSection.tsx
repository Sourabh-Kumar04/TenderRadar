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
  isSunlightMode: _isSunlightMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[#E5E0D8] bg-white text-[#241B12] shadow-sm transition-all overflow-hidden">
      {/* Collapsible Trigger Header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full p-4 sm:p-5 flex items-center justify-between text-left transition-colors hover:bg-[#F7F5F2] cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2 rounded-full bg-[#E67E22]/15 text-[#E67E22] flex items-center justify-center">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-base sm:text-lg text-[#241B12] tracking-tight">
                Field Testing & Audio Simulation
              </span>
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#F7F5F2] border border-[#E5E0D8] text-[#736B63]">
                For Testing Only
              </span>
            </div>
            <p className="text-xs text-[#736B63] mt-0.5">
              Simulate live field audio using real pre-bundled xeno-canto recordings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-xs font-semibold text-[#736B63] hidden sm:inline">
            {isOpen ? 'Collapse' : 'Expand (4 Clips)'}
          </span>
          <div className="p-1 rounded-full text-[#736B63]">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expanded Testing Content */}
      {isOpen && (
        <div className="p-5 pt-3 border-t border-[#E5E0D8] bg-[#F7F5F2] animate-fade-in">
          <div className="p-3.5 rounded-lg text-xs mb-4 flex items-start gap-2.5 bg-white border border-[#E5E0D8] text-[#332A22]">
            <Music className="w-4 h-4 shrink-0 text-[#E67E22] mt-0.5" />
            <p className="leading-relaxed text-xs">
              <strong>Offline QA & Testing:</strong> Tap any sample to feed a 3-second 48kHz audio snippet directly into the BirdNET v2.4 ONNX inference worker and verify real-time classification, checklist updates, and confidence scoring.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SAMPLE_AUDIO_LIST.map((sample) => {
              const isSelected = selectedSample?.id === sample.id;
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => onSelectSample(sample)}
                  disabled={isProcessing}
                  className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? 'bg-[#D73C30] border-[#D73C30] text-white font-bold ring-2 ring-[#D73C30]/40'
                      : 'bg-white border-[#E5E0D8] hover:border-[#D73C30] text-[#241B12]'
                  }`}
                >
                  <div className="overflow-hidden pr-2">
                    <div className="font-bold text-xs truncate font-sans">{sample.speciesName}</div>
                    <div
                      className={`text-[11px] truncate font-serif italic ${
                        isSelected ? 'text-white/80' : 'text-[#736B63]'
                      }`}
                    >
                      {sample.scientificName}
                    </div>
                  </div>
                  {isSelected ? (
                    <Check className="w-4 h-4 shrink-0 text-white" />
                  ) : (
                    <Play className="w-3.5 h-3.5 shrink-0 text-[#E67E22]" />
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
