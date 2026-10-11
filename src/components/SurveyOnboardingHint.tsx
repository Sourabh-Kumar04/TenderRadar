import React, { useState } from 'react';
import { MapPin, Mic, Bird, FileSpreadsheet, X, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface SurveyOnboardingHintProps {
  isSunlightMode: boolean;
}

export const SurveyOnboardingHint: React.FC<SurveyOnboardingHintProps> = ({ isSunlightMode: _isSunlightMode }) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return localStorage.getItem('trailwhistle_survey_hint_dismissed') === 'true';
  });
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('trailwhistle_survey_hint_dismissed', 'true');
  };

  const handleToggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  if (isDismissed) {
    return (
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => {
            setIsDismissed(false);
            localStorage.removeItem('trailwhistle_survey_hint_dismissed');
            setIsExpanded(true);
          }}
          className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#E5E0D8] bg-white text-[#D73C30] hover:bg-[#F7F5F2] shadow-xs transition-all cursor-pointer"
          title="View 4-step survey guide"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Survey Workflow Guide</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-[#E5E0D8] bg-[#F7F5F2] text-[#241B12] shadow-xs mb-6 transition-all">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 font-serif font-bold text-sm sm:text-base tracking-tight text-[#241B12]">
          <HelpCircle className="w-4 h-4 text-[#D73C30] shrink-0" />
          <span>Survey Protocol • 4-Step Avian Census Workflow</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleExpand}
            className="px-3 py-1 rounded-full text-xs font-bold text-[#D73C30] hover:bg-white flex items-center gap-1 transition-all cursor-pointer"
            title={isExpanded ? 'Collapse guide' : 'Expand full 4-step details'}
          >
            <span>{isExpanded ? 'Hide Steps' : 'View Protocol'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-full text-[#736B63] hover:text-[#241B12] hover:bg-white transition-all cursor-pointer"
            aria-label="Dismiss survey guide"
            title="Dismiss guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isExpanded && (
        <div className="text-xs font-semibold text-[#736B63] flex items-center gap-2 pl-6">
          <span>1. Arrive</span>
          <span className="opacity-40">→</span>
          <span>2. Sample</span>
          <span className="opacity-40">→</span>
          <span>3. Tally</span>
          <span className="opacity-40">→</span>
          <span>4. Export</span>
        </div>
      )}

      {isExpanded && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
          <div className="p-3.5 rounded-lg border border-[#E5E0D8] bg-white text-[#241B12]">
            <div className="font-bold text-[#D73C30] flex items-center gap-1.5 mb-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>1. Arrive</span>
            </div>
            <div className="text-[#736B63] leading-relaxed text-[11px]">
              Designate survey transect & acquire GPS fix.
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-[#E5E0D8] bg-white text-[#241B12]">
            <div className="font-bold text-[#D73C30] flex items-center gap-1.5 mb-1">
              <Mic className="w-3.5 h-3.5 shrink-0" />
              <span>2. Sample</span>
            </div>
            <div className="text-[#736B63] leading-relaxed text-[11px]">
              Capture 3-second rapid acoustic calls across the site.
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-[#E5E0D8] bg-white text-[#241B12]">
            <div className="font-bold text-[#D73C30] flex items-center gap-1.5 mb-1">
              <Bird className="w-3.5 h-3.5 shrink-0" />
              <span>3. Tally</span>
            </div>
            <div className="text-[#736B63] leading-relaxed text-[11px]">
              BirdNET v2.4 tallies species frequency & peak confidence.
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-[#E5E0D8] bg-white text-[#241B12]">
            <div className="font-bold text-[#D73C30] flex items-center gap-1.5 mb-1">
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>4. Export</span>
            </div>
            <div className="text-[#736B63] leading-relaxed text-[11px]">
              1-click RFC 4180 CSV export for scientific logs.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
