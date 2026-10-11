import React from 'react';
import { GeoLocation } from '../types/journal';

interface SurveyStatsBarProps {
  speciesCount: number;
  totalRecordings: number;
  startTime: string;
  location?: GeoLocation | null;
  locationName: string;
  isSunlightMode: boolean;
  sitesCount?: number;
}

export const SurveyStatsBar: React.FC<SurveyStatsBarProps> = ({
  speciesCount,
  totalRecordings,
  startTime,
  location,
  locationName: _locationName,
  isSunlightMode,
  sitesCount = 4,
}) => {
  const startMs = new Date(startTime).getTime();
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - startMs) / 60000));
  const surveyTimeDisplay = elapsedMinutes < 60 ? `${elapsedMinutes}m` : `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`;

  return (
    <div
      className={`w-full transition-all duration-200 border rounded-xl overflow-hidden shadow-sm ${
        isSunlightMode
          ? 'bg-[#120D08] border-[#4A3A2C] text-white shadow-xl'
          : 'bg-[#1C150E] border-[#3D2E20] text-white shadow-md'
      }`}
    >
      {/* 4 Columns Separated by Thin Vertical Dividers */}
      <div className={`grid grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x ${
        isSunlightMode ? 'divide-[#4A3A2C]' : 'divide-[#3D2E20]'
      }`}>
        {/* Column 1: Species Found */}
        <div className="p-4 sm:p-6 flex flex-col items-center justify-center text-center">
          <div className="text-3xl sm:text-4xl lg:text-5xl font-bold font-sans tracking-tight leading-none text-white">
            {speciesCount}
          </div>
          <div className="text-xs uppercase tracking-wider font-semibold text-[#A89B8C] mt-2">
            Species Found
          </div>
        </div>

        {/* Column 2: Recordings */}
        <div className="p-4 sm:p-6 flex flex-col items-center justify-center text-center">
          <div className="text-3xl sm:text-4xl lg:text-5xl font-bold font-sans tracking-tight leading-none text-white">
            {totalRecordings}
          </div>
          <div className="text-xs uppercase tracking-wider font-semibold text-[#A89B8C] mt-2">
            Recordings
          </div>
        </div>

        {/* Column 3: Total Field Time */}
        <div
          className="p-4 sm:p-6 flex flex-col items-center justify-center text-center group cursor-help"
          title="Total Field Time (all sessions): Cumulative bioacoustic survey time across all sessions. Resets when starting a new survey transect."
        >
          <div className="text-3xl sm:text-4xl lg:text-5xl font-bold font-sans tracking-tight leading-none text-white">
            {surveyTimeDisplay}
          </div>
          <div className="text-xs uppercase tracking-wider font-semibold text-[#A89B8C] mt-2 flex items-center justify-center gap-1">
            <span>Total Field Time</span>
            <span className="text-[10px] text-[#D8CDC2] font-mono font-normal">ⓘ</span>
          </div>
          <div className="text-[10px] text-[#A89B8C]/80 font-medium mt-0.5">
            (all sessions)
          </div>
        </div>

        {/* Column 4: Sites */}
        <div className="p-4 sm:p-6 flex flex-col items-center justify-center text-center">
          <div className="text-3xl sm:text-4xl lg:text-5xl font-bold font-sans tracking-tight leading-none text-white">
            {sitesCount}
          </div>
          <div className="text-xs uppercase tracking-wider font-semibold text-[#A89B8C] mt-2 flex items-center justify-center gap-1">
            <span>Sites</span>
            {location && (
              <span className="text-[10px] text-[#48A54C] font-mono font-normal">
                (±{location.accuracy || 10}m)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
