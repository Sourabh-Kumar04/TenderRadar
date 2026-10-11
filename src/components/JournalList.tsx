import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Download,
  Trash2,
  MapPin,
  Calendar,
  CheckCircle2,
  Feather,
  FileSpreadsheet,
  FileJson,
  Upload,
  Trees,
  Bird,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { JournalEntry } from '../types/journal';
import {
  filterJournalEntries,
  exportJournalToCsvFile,
  exportAreaSurveyCsvFile,
  exportJournalToJsonFile,
  importJournalFromJson,
  groupEntriesByLocation,
} from '../services/journal';

interface JournalListProps {
  entries: JournalEntry[];
  onDeleteEntry: (id: string) => void;
  onClearJournal: () => void;
  isSunlightMode: boolean;
  onGoToIdentify: () => void;
  onJournalImported?: (count: number) => void;
}

export const JournalList: React.FC<JournalListProps> = ({
  entries,
  onDeleteEntry,
  onClearJournal,
  isSunlightMode,
  onGoToIdentify,
  onJournalImported,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [expandedLocations, setExpandedLocations] = useState<Record<string, boolean>>({});

  // Distinct locations for dropdown filter
  const allLocations = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      set.add(e.locationName?.trim() || 'General Field Observations');
    });
    return Array.from(set);
  }, [entries]);

  // Filtered flat entries
  const filteredEntries = useMemo(() => {
    return filterJournalEntries(entries, {
      query: searchQuery,
      startDate: filterDate ? `${filterDate}T00:00:00Z` : undefined,
      endDate: filterDate ? `${filterDate}T23:59:59Z` : undefined,
      confirmedOnly,
      locationFilter: locationFilter === 'all' ? undefined : locationFilter,
    });
  }, [entries, searchQuery, filterDate, confirmedOnly, locationFilter]);

  // Grouped by survey location
  const locationGroups = useMemo(() => {
    return groupEntriesByLocation(filteredEntries);
  }, [filteredEntries]);

  // Overall biodiversity stats
  const totalUniqueSpecies = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(e.commonName.toLowerCase().trim()));
    return set.size;
  }, [entries]);

  const totalGpsFixed = useMemo(() => {
    return entries.filter((e) => e.location !== null && e.location !== undefined).length;
  }, [entries]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportCsv = () => {
    if (entries.length === 0) {
      alert('Your Field Log is empty. Make an observation first!');
      return;
    }
    exportJournalToCsvFile(filteredEntries.length > 0 ? filteredEntries : entries);
  };

  const handleExportJson = () => {
    if (entries.length === 0) {
      alert('Your Field Log is empty. Make an observation first!');
      return;
    }
    exportJournalToJsonFile(entries);
  };

  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = importJournalFromJson(text);
      if (onJournalImported) {
        onJournalImported(result.importedCount);
      }
      alert(`Successfully restored ${result.importedCount} observation(s) from ${file.name}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to import backup file: ${msg}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExportLocationCsv = (locationName: string, groupEntries: JournalEntry[]) => {
    exportAreaSurveyCsvFile(locationName, groupEntries);
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear your local Field Log? This cannot be undone.')) {
      onClearJournal();
    }
  };

  const toggleLocationExpand = (loc: string) => {
    setExpandedLocations((prev) => ({
      ...prev,
      [loc]: prev[loc] === undefined ? false : !prev[loc],
    }));
  };

  const isLocExpanded = (loc: string) => {
    return expandedLocations[loc] !== false;
  };

  return (
    <div className="space-y-6">
      {/* SECTION BAND: Warm Off-White / White Panel */}
      <div
        className={`p-6 sm:p-8 rounded-xl border transition-all ${
          isSunlightMode
            ? 'bg-[#120D08] border-[#4A3A2C] text-white shadow-xl'
            : 'bg-[#F7F5F2] border-[#E5E0D8] text-[#241B12] shadow-sm'
        }`}
      >
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-[#D73C30] text-white shadow-sm shrink-0">
                <Trees className="w-5 h-5" />
              </div>
              <div>
                {/* Large Serif Heading in Sentence Case */}
                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#241B12] tracking-tight">
                  Field Log
                </h2>
                <p className="text-xs sm:text-sm text-[#736B63] mt-0.5">
                  {entries.length} {entries.length === 1 ? 'observation' : 'observations'} across {locationGroups.length} {locationGroups.length === 1 ? 'survey site' : 'survey sites'}
                </p>
              </div>
            </div>
          </div>

          {/* Top Actions: Pill-shaped buttons with generous padding */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Upload backup JSON file"
            />

            {/* Primary / Success pill button: Export CSV (#3D8B40 or #D73C30) */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={entries.length === 0}
              className={`py-2.5 px-5 rounded-full font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                entries.length === 0
                  ? 'opacity-40 cursor-not-allowed bg-[#E5E0D8] text-[#736B63]'
                  : 'bg-[#3D8B40] hover:bg-[#2E7D32] text-white shadow-md hover:scale-102 active:scale-95'
              }`}
              title="Export all observations as standard CSV file"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>Export CSV</span>
            </button>

            {/* Secondary pill button: Backup JSON (#E67E22) */}
            <button
              type="button"
              onClick={handleExportJson}
              disabled={entries.length === 0}
              className={`py-2.5 px-5 rounded-full font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                entries.length === 0
                  ? 'opacity-40 cursor-not-allowed bg-[#E5E0D8] text-[#736B63]'
                  : 'bg-[#E67E22] hover:bg-[#D35400] text-white shadow-md hover:scale-102 active:scale-95'
              }`}
              title="Download raw JSON backup file"
            >
              <FileJson className="w-4 h-4 text-white" />
              <span>Backup JSON</span>
            </button>

            {/* Tertiary pill button: Restore (#241B12) */}
            <button
              type="button"
              onClick={handleTriggerImport}
              className="py-2.5 px-5 rounded-full font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm bg-[#241B12] hover:bg-[#3D2E20] text-white transition-all cursor-pointer hover:scale-102 active:scale-95"
              title="Restore observations from a JSON backup file"
            >
              <Upload className="w-4 h-4 text-white" />
              <span>Restore</span>
            </button>

            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="p-2.5 rounded-full border border-red-200 text-red-700 hover:bg-red-50 transition-all cursor-pointer"
                title="Clear all Field Log records"
                aria-label="Clear all observations"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Survey Overview Stats Bar with 4 Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#E5E0D8]">
          <div className="p-4 rounded-lg border border-[#E5E0D8] bg-white text-center">
            <div className="text-2xl font-bold font-sans text-[#241B12]">{locationGroups.length}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#736B63] mt-1">Survey Sites</div>
          </div>

          <div className="p-4 rounded-lg border border-[#E5E0D8] bg-white text-center">
            <div className="text-2xl font-bold font-sans text-[#D73C30]">{totalUniqueSpecies}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#736B63] mt-1">Species Life List</div>
          </div>

          <div className="p-4 rounded-lg border border-[#E5E0D8] bg-white text-center">
            <div className="text-2xl font-bold font-sans text-[#3D8B40]">{entries.length}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#736B63] mt-1">Total Detections</div>
          </div>

          <div className="p-4 rounded-lg border border-[#E5E0D8] bg-white text-center">
            <div className="text-2xl font-bold font-sans text-[#E67E22]">{totalGpsFixed}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#736B63] mt-1">GPS Waypoints</div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 mt-4 border-t border-[#E5E0D8]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#736B63]" />
            <input
              type="text"
              placeholder="Search species, notes, or site..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-xs rounded-full border border-[#E5E0D8] bg-white text-[#241B12] placeholder-[#736B63] focus:border-[#D73C30] outline-none"
            />
          </div>

          <div className="relative">
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full px-4 py-2 text-xs rounded-full border border-[#E5E0D8] bg-white text-[#241B12] appearance-none pr-8 cursor-pointer focus:border-[#D73C30] outline-none"
            >
              <option value="all">All Survey Sites ({locationGroups.length})</option>
              {allLocations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#736B63]">▼</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar className="w-4 h-4 absolute left-3.5 top-3 text-[#736B63] pointer-events-none" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-xs rounded-full border border-[#E5E0D8] bg-white text-[#241B12] outline-none"
              />
            </div>
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className="px-2.5 py-1 text-xs font-bold text-[#D73C30] underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Grouped Survey Logs */}
      {filteredEntries.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-xl border border-[#E5E0D8] bg-white text-center shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-[#F7F5F2] text-[#D73C30]">
            <Feather className="w-8 h-8" />
          </div>
          <h3 className="font-serif font-bold text-xl text-[#241B12] mb-1 tracking-tight">
            {entries.length === 0 ? 'No Observations Yet' : 'No Matching Observations'}
          </h3>
          <p className="text-sm text-[#736B63] max-w-sm mx-auto mb-6 leading-relaxed">
            {entries.length === 0
              ? 'Arrive at your local trail or park. Tap Record to identify bird calls offline and build your first area biodiversity survey.'
              : 'Try clearing your search query, location filter, or date filter.'}
          </p>
          {entries.length === 0 && (
            <button
              type="button"
              onClick={onGoToIdentify}
              className="px-6 py-3 rounded-full font-bold text-xs uppercase tracking-wider text-white bg-[#D73C30] hover:bg-[#C23328] shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <Bird className="w-4 h-4 text-white" />
              <span>Record a Bird Call</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {locationGroups.map((group) => {
            const isExpanded = isLocExpanded(group.locationName);
            const dateStr = new Date(group.latestTimestamp).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div
                key={group.locationName}
                className="rounded-xl border border-[#E5E0D8] bg-white overflow-hidden shadow-sm"
              >
                {/* Location Group Header Banner */}
                <div className="p-4 sm:p-5 border-b border-[#E5E0D8] bg-[#F7F5F2]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-full bg-[#D73C30]/10 text-[#D73C30] shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-serif font-bold text-lg sm:text-xl text-[#241B12]">
                            {group.locationName}
                          </h3>
                          <span className="text-xs uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full bg-[#3D8B40] text-white">
                            {group.speciesCount} Species
                          </span>
                          <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-white border border-[#E5E0D8] text-[#736B63]">
                            {group.totalDetections} Detections
                          </span>
                        </div>

                        <div className="text-xs text-[#736B63] mt-1 flex items-center gap-3 flex-wrap">
                          <span>{dateStr}</span>
                          {group.hasGps && group.representativeGps && (
                            <span className="font-mono text-[#3D8B40]">
                              {group.representativeGps.latitude.toFixed(4)}°, {group.representativeGps.longitude.toFixed(4)}°
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Export Location CSV + Collapse */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleExportLocationCsv(group.locationName, group.entries)}
                        className="py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-wider bg-white hover:bg-[#F0ECE6] text-[#3D8B40] border border-[#E5E0D8] shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        title={`Export CSV survey report for ${group.locationName}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Site CSV</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleLocationExpand(group.locationName)}
                        className="p-2 rounded-full border border-[#E5E0D8] bg-white hover:bg-[#F0ECE6] text-[#241B12] transition-all cursor-pointer"
                        aria-label={isExpanded ? 'Collapse location entries' : 'Expand location entries'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Species checklist chips for this location */}
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#E5E0D8]">
                    {group.distinctSpecies.map((sp) => (
                      <span
                        key={sp.commonName}
                        className="text-xs font-medium px-2.5 py-1 rounded-full bg-white border border-[#E5E0D8] text-[#241B12] flex items-center gap-1.5 shadow-2xs"
                      >
                        <Bird className="w-3.5 h-3.5 text-[#D73C30]" />
                        <span className="font-semibold">{sp.count}x {sp.commonName}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* (5) Individual Observation Cards: SPECIES CARDS */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 space-y-3">
                    {group.entries.map((entry) => {
                      const date = new Date(entry.timestamp);
                      const formattedTime = date.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={entry.id}
                          className="p-4 sm:p-5 rounded-lg border border-[#E5E0D8] bg-white hover:border-[#D73C30] transition-all shadow-xs"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                {/* Bold common name (sans 18px) */}
                                <h4 className="font-sans font-bold text-[18px] text-[#241B12] tracking-tight">
                                  {entry.commonName}
                                </h4>
                                {entry.confirmedByUser && (
                                  <span title="Confirmed observation">
                                    <CheckCircle2 className="w-4 h-4 text-[#3D8B40]" />
                                  </span>
                                )}
                              </div>
                              {/* Italic gray scientific name (15px) below */}
                              <div className="font-sans italic text-[15px] text-[#736B63] mt-0.5">
                                {entry.scientificName}
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-[#F7F5F2] border border-[#E5E0D8] text-[#D73C30]">
                                {Math.round(entry.confidence * 100)}%
                              </span>
                              <div className="text-[11px] text-[#736B63] mt-1 font-sans">
                                {formattedTime}
                              </div>
                            </div>
                          </div>

                          {/* Notes */}
                          {entry.notes && (
                            <p className="text-sm p-3 rounded-lg mb-3 bg-[#F7F5F2] border border-[#E5E0D8] text-[#332A22]">
                              {entry.notes}
                            </p>
                          )}

                          {/* Footer details: GPS & Delete */}
                          <div className="flex items-center justify-between text-xs pt-2.5 border-t border-[#E5E0D8] text-[#736B63]">
                            <div className="flex items-center gap-3">
                              {entry.location ? (
                                <span className="flex items-center gap-1 font-mono text-[#3D8B40]">
                                  <MapPin className="w-3.5 h-3.5 text-[#D73C30] shrink-0" />
                                  {entry.location.latitude.toFixed(4)}°, {entry.location.longitude.toFixed(4)}°
                                  {entry.location.accuracy && ` (±${entry.location.accuracy}m)`}
                                </span>
                              ) : (
                                <span className="opacity-60 italic">No GPS attached</span>
                              )}
                              <span className="opacity-75">
                                {entry.source === 'live_mic' ? 'Live Mic' : 'Sample Song'} ({entry.audioDurationSeconds}s)
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => onDeleteEntry(entry.id)}
                              className="p-1.5 rounded-full text-[#736B63] hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete entry"
                              aria-label={`Delete observation for ${entry.commonName}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
