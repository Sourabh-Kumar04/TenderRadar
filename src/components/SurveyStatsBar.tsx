import React from 'react';
import { Bird, Mic, Clock, Navigation, CheckCircle2 } from 'lucide-react';
import { GeoLocation } from '../types/journal';

interface SurveyStatsBarProps {
  speciesCount: number;
  totalRecordings: number;
  startTime: string;
  location?: GeoLocation | null;
  locationName: string;
  isSunlightMode: boolean;
}

export const SurveyStatsBar: React.FC<SurveyStatsBarProps> = ({
  speciesCount,
  totalRecordings,
  startTime,
  location,
  locationName,
  isSunlightMode,
}) => {
  const startMs = new Date(startTime).getTime();
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - startMs) / 60000));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {/* Card 1: Species Life Count */}
      <div
        className={`p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
          isSunlightMode
            ? 'bg-[#06140b] border-emerald-900/80 text-white shadow-xl'
            : 'bg-white border-[#d4e2d4] text-[#1a2b1e] shadow-sm hover:shadow-md'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold ${
            isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'
          }`}>
            Species Life Count
          </span>
          <div className={`p-2 rounded-xl shadow-xs ${
            isSunlightMode ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
          }`}>
            <Bird className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className={`text-2xl sm:text-3xl font-black tracking-tight font-sans ${
            isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'
          }`}>
            {speciesCount} <span className={`text-sm font-semibold tracking-normal ${isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'}`}>{speciesCount === 1 ? 'taxon' : 'species'}</span>
          </div>
          <div className={`text-xs font-medium mt-0.5 ${
            isSunlightMode ? 'text-emerald-300/70' : 'text-[#4a5d4e]'
          }`}>
            Distinct avian taxa detected
          </div>
        </div>
      </div>

      {/* Card 2: Acoustic Census */}
      <div
        className={`p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
          isSunlightMode
            ? 'bg-[#06140b] border-emerald-900/80 text-white shadow-xl'
            : 'bg-white border-[#d4e2d4] text-[#1a2b1e] shadow-sm hover:shadow-md'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold ${
            isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'
          }`}>
            Acoustic Census
          </span>
          <div className={`p-2 rounded-xl shadow-xs ${
            isSunlightMode ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
          }`}>
            <Mic className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className={`text-2xl sm:text-3xl font-black tracking-tight font-sans flex items-baseline gap-1.5 ${
            isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'
          }`}>
            <span>{totalRecordings}</span>
            <span className={`text-xs font-semibold ${isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'}`}>
              {totalRecordings === 1 ? 'recording' : 'recordings'}
            </span>
          </div>
          <div className={`text-xs font-medium mt-0.5 ${
            isSunlightMode ? 'text-emerald-300/70' : 'text-[#4a5d4e]'
          }`}>
            Inference passes processed
          </div>
        </div>
      </div>

      {/* Card 3: Survey Elapsed */}
      <div
        className={`p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
          isSunlightMode
            ? 'bg-[#06140b] border-emerald-900/80 text-white shadow-xl'
            : 'bg-white border-[#d4e2d4] text-[#1a2b1e] shadow-sm hover:shadow-md'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold ${
            isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'
          }`}>
            Survey Elapsed
          </span>
          <div className={`p-2 rounded-xl shadow-xs ${
            isSunlightMode ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
          }`}>
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className={`text-2xl sm:text-3xl font-black tracking-tight font-sans flex items-baseline gap-1.5 ${
            isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'
          }`}>
            <span>{elapsedMinutes}</span>
            <span className={`text-xs font-semibold ${isSunlightMode ? 'text-emerald-300' : 'text-[#16351d]'}`}>min active</span>
          </div>
          <div className={`text-xs font-medium mt-0.5 ${
            isSunlightMode ? 'text-emerald-300/70' : 'text-[#4a5d4e]'
          }`}>
            Continuous field observation
          </div>
        </div>
      </div>

      {/* Card 4: Transect Coverage */}
      <div
        className={`p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
          isSunlightMode
            ? 'bg-[#06140b] border-emerald-900/80 text-white shadow-xl'
            : 'bg-white border-[#d4e2d4] text-[#1a2b1e] shadow-sm hover:shadow-md'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold ${
            isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'
          }`}>
            Transect Coverage
          </span>
          <div className={`p-2 rounded-xl shadow-xs ${
            isSunlightMode ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
          }`}>
            {location ? <CheckCircle2 className="w-4 h-4" /> : <Navigation className="w-4 h-4" />}
          </div>
        </div>
        <div>
          <div className={`text-lg sm:text-xl font-bold tracking-tight font-sans truncate ${
            isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'
          }`}>
            {location ? `±${location.accuracy || 10}m GPS` : 'Transect Fixed'}
          </div>
          <div className={`text-xs font-medium truncate mt-0.5 ${
            isSunlightMode ? 'text-emerald-300/70' : 'text-[#4a5d4e]'
          }`}>
            {location ? 'Satellite position fix' : locationName}
          </div>
        </div>
      </div>
    </div>
  );
};
