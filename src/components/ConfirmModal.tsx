import React, { useState } from 'react';
import { Check, X, MapPin, Search, Feather, Loader2, Navigation } from 'lucide-react';
import { PredictionResult, GeoLocation, JournalEntry } from '../types/journal';
import { BIRD_SPECIES_DATABASE } from '../data/birdDatabase';
import { getCurrentCoordinates } from '../services/geolocation';

interface ConfirmModalProps {
  prediction: PredictionResult;
  allPredictions: PredictionResult[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
  audioDuration: number;
  source: 'live_mic' | 'sample_audio';
  isSunlightMode: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  prediction,
  allPredictions,
  isOpen,
  onClose,
  onSave,
  audioDuration,
  source,
  isSunlightMode,
}) => {
  const [selectedCommonName, setSelectedCommonName] = useState(prediction.commonName);
  const [selectedScientificName, setSelectedScientificName] = useState(prediction.scientificName);
  const [confidence, setConfidence] = useState(prediction.confidence);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [showSearchSpecies, setShowSearchSpecies] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCustomSpecies, setIsCustomSpecies] = useState(false);
  const [customName, setCustomName] = useState('');

  if (!isOpen) return null;

  const handleCaptureGps = async () => {
    setIsGettingGps(true);
    try {
      const coords = await getCurrentCoordinates(6000);
      if (coords) {
        setLocation(coords);
      } else {
        alert('GPS location unavailable or permission denied. Note will be saved without GPS.');
      }
    } finally {
      setIsGettingGps(false);
    }
  };

  const handlePickPrediction = (p: PredictionResult) => {
    setSelectedCommonName(p.commonName);
    setSelectedScientificName(p.scientificName);
    setConfidence(p.confidence);
    setIsCustomSpecies(false);
  };

  const handleSelectFromDb = (sp: typeof BIRD_SPECIES_DATABASE[0]) => {
    setSelectedCommonName(sp.commonName);
    setSelectedScientificName(sp.scientificName);
    setConfidence(0.95); // User manual identification
    setIsCustomSpecies(false);
    setShowSearchSpecies(false);
  };

  const handleSave = () => {
    const finalCommonName = isCustomSpecies && customName.trim() ? customName.trim() : selectedCommonName;
    const finalScientificName = isCustomSpecies ? 'Custom field observation' : selectedScientificName;

    onSave({
      commonName: finalCommonName,
      scientificName: finalScientificName,
      confidence,
      notes: notes.trim(),
      location,
      audioDurationSeconds: audioDuration,
      source,
      confirmedByUser: true,
    });
    onClose();
  };

  const filteredSpecies = BIRD_SPECIES_DATABASE.filter((b) =>
    b.commonName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.scientificName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className={`w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 transition-all shadow-2xl ${
        isSunlightMode ? 'bg-[#06140b] text-white border border-emerald-800/80' : 'bg-white text-[#1a2b1e] border border-[#d4e2d4]'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between pb-4 border-b mb-4 ${
          isSunlightMode ? 'border-emerald-900/60' : 'border-[#eef4ee]'
        }`}>
          <div className="flex items-center gap-2">
            <Feather className={`w-5 h-5 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
            <h3 className={`font-extrabold text-lg tracking-tight font-sans ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
              Confirm Field Observation
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className={`p-2 min-w-[40px] min-h-[40px] rounded-lg transition-colors cursor-pointer ${
              isSunlightMode ? 'hover:bg-emerald-900 text-neutral-400 hover:text-white' : 'hover:bg-[#faf9f6] text-[#4a5d4e] hover:text-[#1a2b1e]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Bird Summary */}
        <div className={`p-4 rounded-xl border mb-4 transition-all ${
          isSunlightMode ? 'bg-[#040e07] border-emerald-900/80' : 'bg-[#faf9f6] border-[#d4e2d4]'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <div className={`text-xl sm:text-2xl font-black tracking-tight ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
                {isCustomSpecies && customName ? customName : selectedCommonName}
              </div>
              <div className={`text-xs italic mt-0.5 ${isSunlightMode ? 'text-emerald-300/80' : 'text-[#4a5d4e]'}`}>
                {isCustomSpecies ? 'Manual identification' : selectedScientificName}
              </div>
            </div>
            <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
              isSunlightMode ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border-[#d4e2d4]'
            }`}>
              {Math.round(confidence * 100)}% match
            </span>
          </div>
        </div>

        {/* Alternate top predictions selector */}
        <div className="mb-4">
          <label className={`block text-xs font-semibold mb-2 ${
            isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'
          }`}>
            Classified candidates:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {allPredictions.map((p) => {
              const isSelected = !isCustomSpecies && selectedCommonName === p.commonName;
              return (
                <button
                  key={p.speciesId}
                  type="button"
                  onClick={() => handlePickPrediction(p)}
                  className={`p-2 rounded-xl border text-xs min-h-[48px] text-left transition-all cursor-pointer ${
                    isSelected
                      ? isSunlightMode
                        ? 'bg-emerald-700 border-emerald-400 text-white font-bold ring-2 ring-emerald-400/40 shadow-sm'
                        : 'bg-[#2d5a37] border-[#2d5a37] text-white font-bold ring-2 ring-[#7a9e7e] shadow-sm'
                      : isSunlightMode
                        ? 'bg-[#040e07] border-emerald-900/60 text-emerald-200 hover:border-emerald-700'
                        : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e] hover:border-[#7a9e7e]'
                  }`}
                >
                  <div className="font-bold line-clamp-1">{p.commonName}</div>
                  <div className="text-[10px] opacity-80 font-mono">{Math.round(p.confidence * 100)}%</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Correction / Search button */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowSearchSpecies(!showSearchSpecies)}
            className={`w-full py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all min-h-[44px] cursor-pointer ${
              isSunlightMode
                ? 'bg-emerald-950 border-emerald-800/80 text-emerald-200 hover:bg-emerald-900'
                : 'bg-[#faf9f6] border-[#d4e2d4] text-[#2d5a37] hover:bg-[#f0ede6]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{showSearchSpecies ? 'Hide Species Database' : 'Search All Species / Correct Entry'}</span>
          </button>

          {showSearchSpecies && (
            <div className={`mt-2 p-3 rounded-xl border ${
              isSunlightMode ? 'bg-[#040e07] border-emerald-900/80' : 'bg-[#faf9f6] border-[#d4e2d4]'
            }`}>
              <input
                type="text"
                placeholder="Search bird name (e.g. Chickadee, Blue Jay)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full p-2 rounded-lg text-xs mb-2 border outline-none ${
                  isSunlightMode ? 'bg-[#06140b] border-emerald-800 text-white focus:border-emerald-500' : 'bg-white border-[#d4e2d4] text-[#1a2b1e] focus:border-[#7a9e7e]'
                }`}
              />

              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {filteredSpecies.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => handleSelectFromDb(sp)}
                    className={`w-full text-left p-1.5 rounded text-xs flex justify-between transition-colors cursor-pointer ${
                      isSunlightMode ? 'hover:bg-emerald-900/60 text-emerald-100' : 'hover:bg-[#eef4ee] text-[#1a2b1e]'
                    }`}
                  >
                    <span className="font-medium">{sp.commonName}</span>
                    <span className="text-[10px] opacity-70 italic">{sp.scientificName}</span>
                  </button>
                ))}
              </div>

              {/* Custom Bird Input */}
              <div className={`pt-2 mt-2 border-t ${isSunlightMode ? 'border-emerald-900/60' : 'border-[#eef4ee]'}`}>
                <label className="text-[11px] block font-semibold mb-1">Or enter custom unlisted bird:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter custom species..."
                    value={customName}
                    onChange={(e) => {
                      setCustomName(e.target.value);
                      setIsCustomSpecies(true);
                    }}
                    className={`flex-1 p-2 rounded-lg text-xs border outline-none ${
                      isSunlightMode ? 'bg-[#06140b] border-emerald-800 text-white' : 'bg-white border-[#d4e2d4] text-[#1a2b1e]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customName.trim()) {
                        setIsCustomSpecies(true);
                        setShowSearchSpecies(false);
                      }
                    }}
                    className={`px-3 py-1 font-bold rounded-lg text-xs cursor-pointer text-white ${
                      isSunlightMode ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-[#2d5a37] hover:bg-[#23472b]'
                    }`}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Field Notes */}
        <div className="mb-4">
          <label className={`block text-xs font-semibold mb-1.5 ${
            isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'
          }`}>
            Field notes / trail context:
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Sighted singing in white pine canopy, 20m off trail."
            className={`w-full p-2.5 rounded-xl text-xs border resize-none min-h-[48px] outline-none ${
              isSunlightMode 
                ? 'bg-[#040e07] border-emerald-900 text-emerald-100 placeholder-emerald-700/60 focus:border-emerald-500' 
                : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e] focus:border-[#7a9e7e] placeholder-[#4a5d4e]/60'
            }`}
          />
        </div>

        {/* GPS Capture */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className={`w-4 h-4 ${location ? (isSunlightMode ? 'text-emerald-400' : 'text-[#2d5a37]') : (isSunlightMode ? 'text-neutral-500' : 'text-[#7a9e7e]')}`} />
            <div className="text-xs">
              {location ? (
                <span className={`font-mono font-semibold ${isSunlightMode ? 'text-emerald-400' : 'text-[#2d5a37]'}`}>
                  {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}° (±{location.accuracy}m)
                </span>
              ) : (
                <span className={isSunlightMode ? 'text-emerald-400/60' : 'text-[#4a5d4e]'}>
                  Offline GPS coordinates optional
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCaptureGps}
            disabled={isGettingGps}
            className={`px-3 py-1.5 min-h-[40px] text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
              location
                ? isSunlightMode
                  ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
                  : 'bg-[#eef4ee] border-[#d4e2d4] text-[#2d5a37]'
                : isSunlightMode
                  ? 'bg-emerald-950 border-emerald-800 text-emerald-300 hover:bg-emerald-900'
                  : 'bg-[#faf9f6] border-[#d4e2d4] text-[#2d5a37] hover:bg-[#f0ede6]'
            }`}
          >
            {isGettingGps ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Fixing...</span>
              </>
            ) : location ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>GPS Fixed</span>
              </>
            ) : (
              <>
                <Navigation className="w-3.5 h-3.5" />
                <span>Attach GPS</span>
              </>
            )}
          </button>
        </div>

        {/* Action Buttons (Large touch target) */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-3 min-h-[48px] rounded-xl font-bold text-sm border transition-all cursor-pointer ${
              isSunlightMode
                ? 'bg-emerald-950 border-emerald-800 text-emerald-200 hover:bg-emerald-900'
                : 'bg-[#faf9f6] border-[#d4e2d4] text-[#4a5d4e] hover:bg-[#f0ede6]'
            }`}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className={`flex-1 py-3 min-h-[48px] rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
              isSunlightMode
                ? 'bg-emerald-800 hover:bg-emerald-700 text-white shadow-md'
                : 'bg-[#2d5a37] hover:bg-[#23472b] text-white shadow-sm'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Save to Journal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
