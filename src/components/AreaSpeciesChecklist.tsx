import React, { useState } from 'react';
import { Bird, CheckCircle2, ChevronRight, Search, Sparkles, MapPin, Activity } from 'lucide-react';
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
    <div className={`p-5 sm:p-6 rounded-2xl border flex flex-col h-full transition-all duration-300 relative ${
      isSunlightMode
        ? 'bg-[#06140b] border-emerald-900/80 text-white shadow-xl'
        : 'bg-white border-[#d4e2d4] text-[#1a2b1e] shadow-sm'
    }`}>
      {/* Visual Accent Top Bar */}
      <div className={`absolute top-0 left-6 right-6 h-0.5 rounded-full ${
        isSunlightMode ? 'bg-emerald-400' : 'bg-[#7a9e7e]'
      }`} />

      {/* Header */}
      <div className={`flex items-center justify-between gap-2 pb-3.5 mb-4 border-b ${
        isSunlightMode ? 'border-emerald-900/60' : 'border-[#eef4ee]'
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${
              isSunlightMode ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
            }`}>
              <Bird className="w-4 h-4" />
            </div>
            <h2 className={`text-base font-bold font-sans tracking-tight ${
              isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'
            }`}>
              Area species checklist
            </h2>
            <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
              checklist.length > 0
                ? isSunlightMode ? 'bg-emerald-700 text-white shadow-sm' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
                : isSunlightMode ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-[#f4f7f4] text-[#4a5d4e] border border-[#d4e2d4]'
            }`}>
              {checklist.length} {checklist.length === 1 ? 'species' : 'species'}
            </span>
          </div>
          <p className={`text-[11px] mt-1 ${isSunlightMode ? 'text-emerald-300/80' : 'text-[#4a5d4e]'}`}>
            Live tally for <strong className={isSunlightMode ? 'text-emerald-200' : 'text-[#1a2b1e]'}>{locationName}</strong>
          </p>
        </div>

        {checklist.length > 3 && (
          <div className="relative w-36 sm:w-44">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter species..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border outline-none ${
                isSunlightMode
                  ? 'bg-[#06120a] border-emerald-800 text-white placeholder-emerald-600 focus:border-emerald-400'
                  : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e] placeholder-[#4a5d4e]/60 focus:border-[#7a9e7e]'
              }`}
            />
          </div>
        )}
      </div>

      {/* Checklist Content */}
      {checklist.length === 0 ? (
        <div className="space-y-3">
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
            isSunlightMode ? 'bg-[#06120a] border-emerald-900/60' : 'bg-[#faf9f6] border-[#d4e2d4]'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isSunlightMode ? 'bg-emerald-400' : 'bg-[#7a9e7e]'}`} />
              <div>
                <h3 className={`text-xs font-bold ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
                  Census Station Active
                </h3>
                <p className={`text-[11px] ${isSunlightMode ? 'text-emerald-300/80' : 'text-[#4a5d4e]'}`}>
                  Habitat Reference Checklist ({locationName})
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
              isSunlightMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
            }`}>
              4 Reference Examples
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[460px] pr-1">
            {[
              {
                id: 'american-robin',
                commonName: 'American Robin',
                scientificName: 'Turdus migratorius',
                family: 'Turdidae (Thrushes)',
                iucnStatus: 'LC',
                image: '/images/american-robin.svg',
                callType: 'Melodic Caroled Whistles (2.5 – 4.5 kHz)',
              },
              {
                id: 'song-sparrow',
                commonName: 'Song Sparrow',
                scientificName: 'Melospiza melodia',
                family: 'Passerellidae (Sparrows)',
                iucnStatus: 'LC',
                image: '/images/song-sparrow.svg',
                callType: 'Crisp Trills & Chants (3.5 – 6.0 kHz)',
              },
              {
                id: 'mourning-dove',
                commonName: 'Mourning Dove',
                scientificName: 'Zenaida macroura',
                family: 'Columbidae (Doves)',
                iucnStatus: 'LC',
                image: '/images/mourning-dove.svg',
                callType: 'Soft Low Cooing (400 – 700 Hz)',
              },
              {
                id: 'barn-owl',
                commonName: 'Barn Owl',
                scientificName: 'Tyto alba',
                family: 'Tytonidae (Barn Owls)',
                iucnStatus: 'LC',
                image: '/images/barn-owl.svg',
                callType: 'Raspy Hissing Shriek (2.0 – 5.0 kHz)',
              },
            ].map((bird) => (
              <div
                key={bird.id}
                className={`p-3 sm:p-3.5 rounded-xl border transition-all ${
                  isSunlightMode
                    ? 'bg-[#06120a] border-emerald-900/60 hover:border-emerald-700 text-white'
                    : 'bg-[#faf9f6] border-[#d4e2d4] hover:border-[#7a9e7e] text-[#1a2b1e]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={bird.image}
                      alt={bird.commonName}
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover shrink-0 border-2 shadow-xs ${
                        isSunlightMode ? 'border-emerald-700 bg-emerald-950' : 'border-[#d4e2d4] bg-[#eef4ee]'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className={`font-extrabold text-sm sm:text-base tracking-tight font-sans truncate ${
                          isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'
                        }`}>
                          {bird.commonName}
                        </h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          isSunlightMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
                        }`}>
                          Example
                        </span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                          isSunlightMode ? 'bg-emerald-900/70 text-emerald-300' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {bird.iucnStatus}
                        </span>
                      </div>
                      <p className={`text-xs italic truncate ${isSunlightMode ? 'text-emerald-300/80' : 'text-[#4a5d4e]'}`}>
                        {bird.scientificName} • <span className="not-italic font-medium">{bird.family}</span>
                      </p>
                      <p className={`text-[10px] truncate mt-0.5 ${isSunlightMode ? 'text-emerald-400/60' : 'text-[#4a5d4e]/80'}`}>
                        {bird.callType}
                      </p>
                    </div>
                  </div>

                  {onRunSampleDemo && (
                    <button
                      type="button"
                      onClick={onRunSampleDemo}
                      className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSunlightMode
                          ? 'bg-emerald-800 hover:bg-emerald-700 text-white border border-emerald-600'
                          : 'bg-[#7a9e7e] hover:bg-[#688f6c] text-white shadow-xs'
                      }`}
                      title={`Simulate audio sample for ${bird.commonName}`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{bird.id === 'american-robin' ? 'Simulate American Robin Call' : 'Simulate Call'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-[480px] pr-1">
          {filtered.map((item) => {
            const lastTime = new Date(item.lastDetectedTime).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={item.speciesId}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 hover:scale-[1.01] ${
                  isSunlightMode
                    ? 'bg-[#06120a] border-emerald-900/60 hover:border-emerald-600 text-white shadow-md'
                    : 'bg-[#faf9f6] border-[#d4e2d4] hover:border-[#7a9e7e] text-[#1a2b1e] shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`font-extrabold text-sm sm:text-base tracking-tight truncate font-sans ${
                        isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'
                      }`}>
                        {item.commonName}
                      </h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSunlightMode
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                          : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
                      }`}>
                        {item.detectionCount}x heard
                      </span>
                      {item.iucnStatus && (
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                          isSunlightMode 
                            ? 'bg-emerald-900 text-emerald-200 border border-emerald-700' 
                            : 'bg-white text-[#2d5a37] border border-[#d4e2d4]'
                        }`}>
                          {item.iucnStatus}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs italic font-serif mt-0.5 ${
                      isSunlightMode ? 'text-emerald-300/80' : 'text-[#4a5d4e]'
                    }`}>
                      {item.scientificName}
                      {item.family && (
                        <span className="not-italic font-sans opacity-70 ml-1.5 text-[10px]">
                          • {item.family}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`font-mono text-sm font-black ${
                      isSunlightMode ? 'text-emerald-300' : 'text-[#2d5a37]'
                    }`}>
                      {Math.round(item.maxConfidence * 100)}% peak
                    </span>
                    <div className={`text-[10px] font-medium ${
                      isSunlightMode ? 'text-emerald-400/80' : 'text-[#4a5d4e]'
                    }`}>
                      last {lastTime}
                    </div>
                  </div>
                </div>

                {/* Progress bar of peak confidence */}
                <div className={`w-full h-1.5 rounded-full overflow-hidden mb-2.5 ${
                  isSunlightMode ? 'bg-[#050e08]' : 'bg-[#eef4ee]'
                }`}>
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isSunlightMode 
                        ? 'bg-emerald-400 shadow-sm' 
                        : 'bg-[#7a9e7e]'
                    }`}
                    style={{ width: `${Math.round(item.maxConfidence * 100)}%` }}
                  />
                </div>

                {/* Habitat tag & bio details */}
                <div className={`flex items-center justify-between text-[11px] pt-2 border-t ${
                  isSunlightMode ? 'border-emerald-950/80 text-emerald-300/70' : 'border-[#d4e2d4] text-[#4a5d4e]'
                }`}>
                  <span className="flex items-center gap-1 font-medium">
                    <MapPin className={`w-3 h-3 shrink-0 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
                    <span>{item.habitat}</span>
                  </span>
                  <span className={`text-[10px] font-medium flex items-center gap-1 ${
                    isSunlightMode ? 'text-emerald-400 font-semibold' : 'text-[#2d5a37] font-semibold'
                  }`}>
                    <CheckCircle2 className="w-3 h-3" />
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
