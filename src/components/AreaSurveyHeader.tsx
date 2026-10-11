import React, { useState } from 'react';
import { MapPin, Trees, Clock, Plus, Download, Edit2, Check, Sparkles, Database } from 'lucide-react';
import { SurveySession } from '../types/journal';
import { DEFAULT_SURVEY_LOCATIONS, HABITAT_TAGS } from '../services/journal';

interface AreaSurveyHeaderProps {
  survey: SurveySession;
  onUpdateSurvey: (survey: SurveySession) => void;
  onNewSurvey: () => void;
  onExportCsv: () => void;
  speciesCount: number;
  totalRecordings: number;
  isSunlightMode: boolean;
}

export const AreaSurveyHeader: React.FC<AreaSurveyHeaderProps> = ({
  survey,
  onUpdateSurvey,
  onNewSurvey,
  onExportCsv,
  speciesCount,
  totalRecordings,
  isSunlightMode,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(survey.locationName);

  // Compute elapsed time
  const startTime = new Date(survey.startTime).getTime();
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - startTime) / 60000));

  const handleSaveName = () => {
    if (tempName.trim()) {
      onUpdateSurvey({ ...survey, locationName: tempName.trim() });
    }
    setIsEditingName(false);
  };

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val) {
      setTempName(val);
      onUpdateSurvey({ ...survey, locationName: val });
    }
  };

  const handleSelectHabitat = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSurvey({ ...survey, habitatTag: e.target.value });
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border transition-all mb-4 ${
      isSunlightMode
        ? 'bg-[#06140b] border-emerald-800/80 text-white shadow-xl'
        : 'bg-white border-[#d4e2d4] text-[#1a2b1e] shadow-sm'
    }`}>
      {/* Headline Feature: BirdNET v2.4 6,522 Species Headline */}
      <div className={`flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b ${
        isSunlightMode ? 'border-emerald-900/60' : 'border-[#eef4ee]'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xs ${
            isSunlightMode
              ? 'bg-emerald-900 text-white border border-emerald-700'
              : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
          }`}>
            <Sparkles className={`w-3.5 h-3.5 ${isSunlightMode ? 'text-feather-yellow' : 'text-[#7a9e7e]'}`} />
            <span>Area biodiversity survey</span>
          </span>
          <span className={`text-xs font-medium hidden md:inline-flex items-center gap-1.5 ${
            isSunlightMode ? 'text-emerald-200' : 'text-[#4a5d4e]'
          }`}>
            <Database className={`w-3.5 h-3.5 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
            <strong className={`font-semibold ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>BirdNET v2.4 Neural Core</strong> • 6,522 Species Global Taxonomy
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Survey Pulse indicator */}
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
            isSunlightMode
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
              : 'bg-[#e5eee6] text-[#16351d] border border-[#b8ceb9] shadow-xs'
          }`}>
            <span className={`w-2 h-2 rounded-full animate-ping shrink-0 ${isSunlightMode ? 'bg-emerald-400' : 'bg-[#23532c]'}`} />
            <Clock className={`w-3 h-3 ${isSunlightMode ? 'text-emerald-300' : 'text-[#16351d]'}`} />
            <span className={isSunlightMode ? 'text-emerald-200' : 'text-[#16351d] font-bold'}>{elapsedMinutes}m active</span>
          </span>

          {/* New Survey Button */}
          <button
            type="button"
            onClick={onNewSurvey}
            className={`px-3 py-1.5 min-h-[36px] text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              isSunlightMode
                ? 'bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 hover:text-white border border-emerald-700/60 shadow-sm'
                : 'bg-[#f4f7f4] hover:bg-[#eef4ee] text-[#1a2b1e] border border-[#d4e2d4]'
            }`}
            title="Start a new area survey session at another site"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Site</span>
          </button>
        </div>
      </div>

      {/* Survey Site & Transect Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Location & Habitat */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`p-1.5 rounded-lg shrink-0 ${
              isSunlightMode
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
            }`}>
              <MapPin className="w-4 h-4" />
            </div>
            {isEditingName ? (
              <div className="flex items-center gap-1.5 flex-1 max-w-md">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className={`px-3 py-1.5 text-sm font-bold rounded-lg border flex-1 outline-none ${
                    isSunlightMode
                      ? 'bg-[#061009] border-emerald-700 text-white focus:border-emerald-400'
                      : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e] focus:border-[#7a9e7e]'
                  }`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="p-2 bg-[#7a9e7e] hover:bg-[#688f6c] text-white rounded-lg cursor-pointer"
                  title="Save site name"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className={`text-xl sm:text-2xl font-black tracking-tight font-sans ${
                  isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'
                }`}>{survey.locationName}</h1>
                <button
                  type="button"
                  onClick={() => {
                    setTempName(survey.locationName);
                    setIsEditingName(true);
                  }}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isSunlightMode
                      ? 'text-emerald-400/80 hover:text-white hover:bg-emerald-900/50'
                      : 'text-[#4a5d4e] hover:text-[#1a2b1e] hover:bg-[#eef4ee]'
                  }`}
                  title="Rename survey site"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                {/* Hero indicator bird thumbnails next to headline */}
                <div className="flex items-center gap-2 pl-1 sm:pl-2">
                  <div
                    className="relative group cursor-pointer"
                    title="American Robin (Turdus migratorius) - Site indicator species"
                  >
                    <img
                      src="/images/american-robin.svg"
                      alt="American Robin"
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border-2 shadow-sm transition-transform group-hover:scale-105 ${
                        isSunlightMode
                          ? 'border-emerald-700 bg-emerald-950'
                          : 'border-[#b8ceb9] bg-[#eef4ee]'
                      }`}
                    />
                    <span className="sr-only">American Robin</span>
                  </div>

                  <div
                    className="relative group cursor-pointer"
                    title="Song Sparrow (Melospiza melodia) - Riparian indicator species"
                  >
                    <img
                      src="/images/song-sparrow.svg"
                      alt="Song Sparrow"
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border-2 shadow-sm transition-transform group-hover:scale-105 ${
                        isSunlightMode
                          ? 'border-emerald-700 bg-emerald-950'
                          : 'border-[#b8ceb9] bg-[#eef4ee]'
                      }`}
                    />
                    <span className="sr-only">Song Sparrow</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Preset Selector & Habitat Tag */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Location Quick Switcher */}
            <div className="relative">
              <select
                value={DEFAULT_SURVEY_LOCATIONS.includes(survey.locationName) ? survey.locationName : ''}
                onChange={handleSelectPreset}
                className={`text-xs font-semibold py-1.5 px-3 rounded-lg border appearance-none pr-8 cursor-pointer transition-all ${
                  isSunlightMode
                    ? 'bg-[#06120a] border-emerald-800/80 text-emerald-200 hover:border-emerald-600'
                    : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e] hover:border-[#7a9e7e]'
                }`}
              >
                <option value="" disabled>Trail Presets...</option>
                {DEFAULT_SURVEY_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] opacity-60">▼</span>
            </div>

            {/* Habitat Selector */}
            <div className="relative flex items-center">
              <select
                value={survey.habitatTag || 'Mixed Woodland'}
                onChange={handleSelectHabitat}
                className={`text-xs font-semibold py-1.5 pl-7 pr-8 rounded-lg border appearance-none cursor-pointer transition-all ${
                  isSunlightMode
                    ? 'bg-[#06120a] border-emerald-800/80 text-emerald-200 hover:border-emerald-600'
                    : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e] hover:border-[#7a9e7e]'
                }`}
              >
                {HABITAT_TAGS.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              <Trees className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
                isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'
              }`} />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] opacity-60">▼</span>
            </div>
          </div>
        </div>

        {/* Survey Action: Export CSV */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onExportCsv}
            disabled={totalRecordings === 0}
            className={`py-2.5 px-4 min-h-[44px] rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
              totalRecordings === 0
                ? isSunlightMode 
                  ? 'opacity-40 cursor-not-allowed bg-emerald-950/40 text-emerald-500/50 border border-emerald-900/40' 
                  : 'opacity-40 cursor-not-allowed bg-[#f4f7f4] text-[#4a5d4e] border border-[#d4e2d4]'
                : isSunlightMode
                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500/50 shadow-md hover:scale-[1.02] active:scale-95'
                  : 'bg-[#7a9e7e] hover:bg-[#688f6c] text-white shadow-sm hover:scale-[1.02] active:scale-95'
            }`}
            title="Download CSV report of current area biodiversity survey"
          >
            <Download className="w-4 h-4" />
            <span>Export Area Survey CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
