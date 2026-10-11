import React, { useState } from 'react';
import { MapPin, Mic, Bird, FileSpreadsheet, X, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface SurveyOnboardingHintProps {
  isSunlightMode: boolean;
}

export const SurveyOnboardingHint: React.FC<SurveyOnboardingHintProps> = ({ isSunlightMode }) => {
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
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setIsDismissed(false);
            localStorage.removeItem('trailwhistle_survey_hint_dismissed');
            setIsExpanded(true);
          }}
          className={`text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all ${
            isSunlightMode
              ? 'bg-[#06140b] border-emerald-800 text-emerald-300'
              : 'bg-white border-[#d4e2d4] text-[#2d5a37] shadow-sm'
          }`}
          title="View 4-step survey guide"
        >
          <HelpCircle className={`w-3 h-3 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
          <span>Survey Workflow Guide</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`p-3 sm:p-3.5 rounded-xl border text-xs transition-all ${
        isSunlightMode
          ? 'bg-[#06140b] border-emerald-800/80 text-white shadow-xl'
          : 'bg-white border-[#d4e2d4] text-[#1a2b1e] shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 font-bold tracking-tight">
          <HelpCircle className={`w-4 h-4 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'} shrink-0`} />
          <span>Survey Protocol • 4-Step Avian Census Workflow</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleExpand}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
              isSunlightMode ? 'text-emerald-300 hover:text-white' : 'text-[#2d5a37] hover:bg-[#eef4ee]'
            }`}
            title={isExpanded ? 'Collapse guide' : 'Expand full 4-step details'}
          >
            <span>{isExpanded ? 'Hide Steps' : 'View Protocol'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className={`p-1 rounded opacity-70 hover:opacity-100 ${
              isSunlightMode ? 'text-emerald-400 hover:text-white' : 'text-[#4a5d4e] hover:text-[#1a2b1e]'
            }`}
            aria-label="Dismiss survey guide"
            title="Dismiss guide"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!isExpanded && (
        <div className={`text-[11px] flex items-center gap-2 pl-5 ${
          isSunlightMode ? 'text-emerald-400/80' : 'text-[#4a5d4e]'
        }`}>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
          <div
            className={`p-2.5 rounded-lg border transition-all ${
              isSunlightMode ? 'bg-[#040e07] border-emerald-900/60 text-white' : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e]'
            }`}
          >
            <div className={`font-bold ${isSunlightMode ? 'text-emerald-400' : 'text-[#2d5a37]'} flex items-center gap-1 mb-0.5`}>
              <MapPin className="w-3 h-3 shrink-0" />
              <span>1. Arrive</span>
            </div>
            <div className={`leading-tight ${isSunlightMode ? 'text-emerald-300/80' : 'text-[#4a5d4e]'}`}>
              Designate survey transect & acquire GPS fix.
            </div>
          </div>

          <div
            className={`p-2.5 rounded-lg border transition-all ${
              isSunlightMode ? 'bg-[#040e07] border-emerald-900/60 text-white' : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e]'
            }`}
          >
            <div className={`font-bold ${isSunlightMode ? 'text-emerald-400' : 'text-[#2d5a37]'} flex items-center gap-1 mb-0.5`}>
              <Mic className="w-3 h-3 shrink-0" />
              <span>2. Sample</span>
            </div>
            <div className={`leading-tight ${isSunlightMode ? 'text-emerald-300/80' : 'text-[#4a5d4e]'}`}>
              Capture 3-second rapid acoustic calls across the site.
            </div>
          </div>

          <div
            className={`p-2.5 rounded-lg border transition-all ${
              isSunlightMode ? 'bg-[#040e07] border-emerald-900/60 text-white' : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e]'
            }`}
          >
            <div className={`font-bold ${isSunlightMode ? 'text-emerald-400' : 'text-[#2d5a37]'} flex items-center gap-1 mb-0.5`}>
              <Bird className="w-3 h-3 shrink-0" />
              <span>3. Tally</span>
            </div>
            <div className={`leading-tight ${isSunlightMode ? 'text-emerald-300/80' : 'text-[#4a5d4e]'}`}>
              BirdNET v2.4 tallies species frequency & peak confidence.
            </div>
          </div>

          <div
            className={`p-2.5 rounded-lg border transition-all ${
              isSunlightMode ? 'bg-[#040e07] border-emerald-900/60 text-white' : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e]'
            }`}
          >
            <div className={`font-bold ${isSunlightMode ? 'text-emerald-400' : 'text-[#2d5a37]'} flex items-center gap-1 mb-0.5`}>
              <FileSpreadsheet className="w-3 h-3 shrink-0" />
              <span>4. Export</span>
            </div>
            <div className={`leading-tight ${isSunlightMode ? 'text-emerald-300/80' : 'text-[#4a5d4e]'}`}>
              1-click RFC 4180 CSV export for scientific logs.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
