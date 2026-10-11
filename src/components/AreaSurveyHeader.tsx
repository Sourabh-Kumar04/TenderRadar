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
  speciesCount: _speciesCount,
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
    <div
      className={`p-6 sm:p-7 rounded-xl border transition-all mb-6 ${
        isSunlightMode
          ? 'bg-[#120D08] border-[#4A3A2C] text-white shadow-xl'
          : 'bg-white border-[#E5E0D8] text-[#241B12] shadow-sm'
      }`}
    >
      {/* Top Meta Headline */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-[#E5E0D8]">
        <div className="flex items-center gap-2.5">
          <span className="text-xs uppercase tracking-wider font-bold px-3 py-1 rounded-full bg-[#D73C30]/10 text-[#D73C30] border border-[#D73C30]/20 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Area biodiversity survey</span>
          </span>
          <span className="text-xs font-sans text-[#736B63] hidden md:inline-flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#E67E22]" />
            <strong className="font-bold text-[#241B12]">BirdNET v2.4 Core</strong> • 6,522 Species Global Taxonomy
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Active Survey Pulse indicator */}
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#F7F5F2] border border-[#E5E0D8] text-[#736B63]">
            <span className="w-2 h-2 rounded-full bg-[#3D8B40] animate-ping shrink-0" />
            <Clock className="w-3.5 h-3.5 text-[#736B63]" />
            <span>{elapsedMinutes}m active</span>
          </span>

          {/* New Survey Pill Button */}
          <button
            type="button"
            onClick={onNewSurvey}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full bg-[#F7F5F2] hover:bg-[#ECE7E1] text-[#241B12] border border-[#E5E0D8] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Start a new area survey session at another site"
          >
            <Plus className="w-3.5 h-3.5 text-[#D73C30]" />
            <span>New Site</span>
          </button>
        </div>
      </div>

      {/* Survey Site & Transect Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Location & Habitat */}
        <div className="flex-1 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-[#D73C30]/10 text-[#D73C30] shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            {isEditingName ? (
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="px-3.5 py-1.5 text-sm font-bold rounded-full border border-[#D73C30] flex-1 outline-none bg-[#F7F5F2] text-[#241B12]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="p-2 bg-[#3D8B40] hover:bg-[#2E7D32] text-white rounded-full cursor-pointer"
                  title="Save site name"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#241B12] tracking-tight">
                  {survey.locationName}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setTempName(survey.locationName);
                    setIsEditingName(true);
                  }}
                  className="p-1.5 rounded-full text-[#736B63] hover:text-[#241B12] hover:bg-[#F7F5F2] transition-colors cursor-pointer"
                  title="Rename survey site"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Preset Selector & Habitat Tag */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Location Quick Switcher */}
            <div className="relative">
              <select
                value={DEFAULT_SURVEY_LOCATIONS.includes(survey.locationName) ? survey.locationName : ''}
                onChange={handleSelectPreset}
                className="text-xs font-semibold py-1.5 px-3.5 rounded-full border border-[#E5E0D8] bg-[#F7F5F2] text-[#241B12] appearance-none pr-8 cursor-pointer hover:border-[#D73C30] transition-colors outline-none"
              >
                <option value="" disabled>Trail Presets...</option>
                {DEFAULT_SURVEY_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#736B63]">▼</span>
            </div>

            {/* Habitat Selector */}
            <div className="relative flex items-center">
              <select
                value={survey.habitatTag || 'Mixed Woodland'}
                onChange={handleSelectHabitat}
                className="text-xs font-semibold py-1.5 pl-8 pr-8 rounded-full border border-[#E5E0D8] bg-[#F7F5F2] text-[#241B12] appearance-none cursor-pointer hover:border-[#D73C30] transition-colors outline-none"
              >
                {HABITAT_TAGS.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              <Trees className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#3D8B40]" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#736B63]">▼</span>
            </div>
          </div>
        </div>

        {/* Action: Export CSV Button (Pill button with generous padding) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onExportCsv}
            disabled={totalRecordings === 0}
            className={`py-3 px-6 rounded-full font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
              totalRecordings === 0
                ? 'opacity-40 cursor-not-allowed bg-[#F7F5F2] text-[#736B63] border border-[#E5E0D8]'
                : 'bg-[#3D8B40] hover:bg-[#2E7D32] text-white shadow-md hover:scale-102 active:scale-95'
            }`}
            title="Download CSV report of current area biodiversity survey"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Export Area Survey CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
