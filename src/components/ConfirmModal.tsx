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
    setConfidence(0.95);
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
      <div
        className={`w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 transition-all shadow-2xl border ${
          isSunlightMode
            ? 'bg-[#120D08] text-white border-[#4A3A2C]'
            : 'bg-white text-[#241B12] border-[#E5E0D8]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E0D8] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-[#D73C30]/10 text-[#D73C30]">
              <Feather className="w-5 h-5" />
            </div>
            <h3 className="font-serif font-bold text-xl text-[#241B12] tracking-tight">
              Confirm Field Observation
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 rounded-full text-[#736B63] hover:text-[#241B12] hover:bg-[#F7F5F2] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Bird Summary */}
        <div className="p-4 rounded-lg border border-[#E5E0D8] bg-[#F7F5F2] mb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-sans font-bold text-xl sm:text-2xl text-[#241B12] tracking-tight">
                {isCustomSpecies && customName ? customName : selectedCommonName}
              </div>
              <div className="font-sans italic text-sm text-[#736B63] mt-0.5">
                {isCustomSpecies ? 'Manual identification' : selectedScientificName}
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#D73C30]/10 text-[#D73C30] border border-[#D73C30]/20">
              {Math.round(confidence * 100)}% match
            </span>
          </div>
        </div>

        {/* Alternate top predictions selector */}
        <div className="mb-5">
          <label className="block text-xs uppercase tracking-wider font-semibold text-[#736B63] mb-2">
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
                  className={`p-2.5 rounded-lg border text-xs min-h-[50px] text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#241B12] border-[#241B12] text-white font-bold shadow-sm'
                      : 'bg-white border-[#E5E0D8] text-[#241B12] hover:border-[#D73C30]'
                  }`}
                >
                  <div className="font-bold line-clamp-1">{p.commonName}</div>
                  <div className="text-[10px] opacity-75 font-mono">{Math.round(p.confidence * 100)}%</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Correction / Search button */}
        <div className="mb-5">
          <button
            type="button"
            onClick={() => setShowSearchSpecies(!showSearchSpecies)}
            className="w-full py-2.5 px-4 text-xs font-bold uppercase tracking-wider rounded-full border border-[#E5E0D8] bg-[#F7F5F2] hover:bg-[#ECE7E1] text-[#241B12] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-[#D73C30]" />
            <span>{showSearchSpecies ? 'Hide Species Database' : 'Search All Species / Correct Entry'}</span>
          </button>

          {showSearchSpecies && (
            <div className="mt-3 p-3.5 rounded-lg border border-[#E5E0D8] bg-[#F7F5F2]">
              <input
                type="text"
                placeholder="Search bird name (e.g. Chickadee, Blue Jay)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2.5 rounded-full text-xs mb-2 border border-[#E5E0D8] bg-white text-[#241B12] focus:border-[#D73C30] outline-none"
              />

              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {filteredSpecies.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => handleSelectFromDb(sp)}
                    className="w-full text-left p-2 rounded-lg text-xs flex justify-between transition-colors cursor-pointer hover:bg-white text-[#241B12]"
                  >
                    <span className="font-medium">{sp.commonName}</span>
                    <span className="text-[10px] opacity-70 italic font-serif">{sp.scientificName}</span>
                  </button>
                ))}
              </div>

              {/* Custom Bird Input */}
              <div className="pt-2 mt-2 border-t border-[#E5E0D8]">
                <label className="text-[11px] block font-semibold text-[#736B63] mb-1">Or enter custom unlisted bird:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter custom species..."
                    value={customName}
                    onChange={(e) => {
                      setCustomName(e.target.value);
                      setIsCustomSpecies(true);
                    }}
                    className="flex-1 p-2 rounded-full text-xs border border-[#E5E0D8] bg-white text-[#241B12] outline-none focus:border-[#D73C30]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customName.trim()) {
                        setIsCustomSpecies(true);
                        setShowSearchSpecies(false);
                      }
                    }}
                    className="px-4 py-1.5 font-bold uppercase tracking-wider rounded-full text-xs cursor-pointer text-white bg-[#D73C30] hover:bg-[#C23328]"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Field Notes */}
        <div className="mb-5">
          <label className="block text-xs uppercase tracking-wider font-semibold text-[#736B63] mb-1.5">
            Field notes / trail context:
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Sighted singing in white pine canopy, 20m off trail."
            className="w-full p-3 rounded-lg text-xs border border-[#E5E0D8] bg-[#F7F5F2] text-[#241B12] focus:border-[#D73C30] outline-none resize-none"
          />
        </div>

        {/* GPS Capture */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className={`w-4 h-4 ${location ? 'text-[#3D8B40]' : 'text-[#736B63]'}`} />
            <div className="text-xs">
              {location ? (
                <span className="font-mono font-semibold text-[#3D8B40]">
                  {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}° (±{location.accuracy}m)
                </span>
              ) : (
                <span className="text-[#736B63] italic">
                  Offline GPS coordinates optional
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCaptureGps}
            disabled={isGettingGps}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full border border-[#E5E0D8] bg-[#F7F5F2] hover:bg-[#ECE7E1] text-[#241B12] flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {isGettingGps ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D73C30]" />
                <span>Fixing...</span>
              </>
            ) : location ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#3D8B40]" />
                <span>GPS Fixed</span>
              </>
            ) : (
              <>
                <Navigation className="w-3.5 h-3.5 text-[#D73C30]" />
                <span>Attach GPS</span>
              </>
            )}
          </button>
        </div>

        {/* Action Buttons: Pill-shaped, generous padding */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-5 rounded-full font-bold text-xs uppercase tracking-wider border border-[#E5E0D8] bg-[#F7F5F2] hover:bg-[#ECE7E1] text-[#736B63] transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 px-5 rounded-full font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md bg-[#3D8B40] hover:bg-[#2E7D32] text-white transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 text-white" />
            <span>Save to Field Log</span>
          </button>
        </div>
      </div>
    </div>
  );
};
