import React, { useState } from 'react';
import { Bird, CheckCircle2, Search, Sparkles, MapPin } from 'lucide-react';
import { SurveyChecklistItem } from '../types/journal';

interface AreaSpeciesChecklistProps {
  checklist: SurveyChecklistItem[];
  locationName: string;
  isSunlightMode: boolean;
  onRunSampleDemo?: () => void;
}

export const AreaSpeciesChecklist: React.FC<AreaSpeciesChecklistProps> = ({
  checklist,
  locationName,
  isSunlightMode,
  onRunSampleDemo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = checklist.filter((item) =>
    item.commonName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.scientificName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className={`p-6 sm:p-7 rounded-xl border flex flex-col h-full transition-all duration-300 relative ${
        isSunlightMode
          ? 'bg-[#120D08] border-[#4A3A2C] text-white shadow-xl'
          : 'bg-white border-[#E5E0D8] text-[#241B12] shadow-sm'
      }`}
    >
      {/* Top Accent Bar */}
      <div className="absolute top-0 left-6 right-6 h-1 rounded-full bg-[#D73C30]" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-[#E5E0D8]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-[#D73C30]/10 text-[#D73C30]">
              <Bird className="w-4 h-4" />
            </div>
            <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#241B12] tracking-tight">
              Area species checklist
            </h2>
            <span className="text-xs uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full bg-[#F7F5F2] border border-[#E5E0D8] text-[#736B63]">
              {checklist.length} species
            </span>
          </div>
          <p className="text-xs text-[#736B63] mt-1">
            Live census tally for <strong className="text-[#241B12]">{locationName}</strong>
          </p>
        </div>

        {checklist.length > 2 && (
          <div className="relative w-40 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#736B63]" />
            <input
              type="text"
              placeholder="Filter species..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full border border-[#E5E0D8] bg-[#F7F5F2] text-[#241B12] placeholder-[#736B63] focus:border-[#D73C30] outline-none"
            />
          </div>
        )}
      </div>

      {/* Checklist Content */}
      {checklist.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center rounded-lg border border-[#E5E0D8] bg-[#F7F5F2] text-[#241B12]">
          {/* Animated Sonar Radar Visualizer */}
          <div className="relative mb-4 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-md bg-[#D73C30] text-white">
              <Bird className="w-8 h-8" />
            </div>
            <div className="absolute -inset-2 rounded-full border-2 border-[#D73C30]/30 animate-ping opacity-40 pointer-events-none" />
            <div className="absolute -inset-4 rounded-full border border-[#E5E0D8] pointer-events-none" />
          </div>

          <h3 className="font-serif font-bold text-lg mb-1 tracking-tight text-[#241B12]">
            Census Station Active
          </h3>
          <p className="text-xs sm:text-sm max-w-sm mb-5 leading-relaxed text-[#736B63]">
            Listening for avian bioacoustics in <strong className="text-[#241B12]">{locationName}</strong>. Tap Record Call in the header to log bird calls detected at this transect.
          </p>

          {/* Expected Taxa in Habitat Preview */}
          <div className="w-full max-w-md p-3.5 rounded-lg border border-[#E5E0D8] bg-white mb-5 text-left">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="text-[#736B63]">Expected regional taxa:</span>
              <span className="text-[11px] font-normal text-[#736B63]">4 common families</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: 'Turdidae (Thrushes)', status: 'LC' },
                { name: 'Passerellidae (Sparrows)', status: 'LC' },
                { name: 'Columbidae (Doves)', status: 'LC' },
                { name: 'Tytonidae (Owls)', status: 'LC' },
              ].map((taxa, i) => (
                <span
                  key={i}
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F7F5F2] border border-[#E5E0D8] text-[#241B12] flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3D8B40]" />
                  <span>{taxa.name}</span>
                </span>
              ))}
            </div>
          </div>

          {onRunSampleDemo && (
            <button
              type="button"
              onClick={onRunSampleDemo}
              className="py-3 px-6 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-[#D73C30] hover:bg-[#C23328] shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>Simulate American Robin Call</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-[480px] pr-1">
          {filtered.map((item) => {
            const lastTime = new Date(item.lastDetectedTime).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              /* (5) SPECIES CARD: white, thin light border, ~8px rounded corners (rounded-lg) */
              <div
                key={item.speciesId}
                className="p-4 sm:p-5 rounded-lg border border-[#E5E0D8] bg-white transition-all duration-200 hover:border-[#D73C30] shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Bold common name (sans 18px) */}
                      <h4 className="font-sans font-bold text-[18px] text-[#241B12] tracking-tight truncate">
                        {item.commonName}
                      </h4>
                      <span className="text-xs uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-[#F7F5F2] border border-[#E5E0D8] text-[#736B63]">
                        {item.detectionCount}x heard
                      </span>
                      {item.iucnStatus && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3D8B40]/10 text-[#3D8B40]">
                          {item.iucnStatus}
                        </span>
                      )}
                    </div>
                    {/* Italic gray scientific name (15px) below */}
                    <div className="font-sans italic text-[15px] text-[#736B63] mt-0.5">
                      {item.scientificName}
                      {item.family && (
                        <span className="not-italic font-sans opacity-75 ml-2 text-xs">
                          • {item.family}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono text-sm font-bold text-[#D73C30]">
                      {Math.round(item.maxConfidence * 100)}% peak
                    </span>
                    <div className="text-[11px] font-sans text-[#736B63] mt-0.5">
                      last {lastTime}
                    </div>
                  </div>
                </div>

                {/* Confidence Bar */}
                <div className="w-full h-1.5 rounded-full overflow-hidden mb-3 bg-[#F0ECE6]">
                  <div
                    className="h-full rounded-full transition-all duration-300 bg-[#3D8B40]"
                    style={{ width: `${Math.round(item.maxConfidence * 100)}%` }}
                  />
                </div>

                {/* Habitat tag & survey indicator */}
                <div className="flex items-center justify-between text-xs pt-2.5 border-t border-[#E5E0D8] text-[#736B63]">
                  <span className="flex items-center gap-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-[#D73C30] shrink-0" />
                    <span>{item.habitat}</span>
                  </span>
                  <span className="text-xs font-semibold flex items-center gap-1 text-[#3D8B40]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Logged to Transect</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
