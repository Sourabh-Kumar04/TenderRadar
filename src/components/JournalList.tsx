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
  Layers,
  Sparkles,
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
      alert('Your field journal is empty. Make an observation first!');
      return;
    }
    exportJournalToCsvFile(filteredEntries.length > 0 ? filteredEntries : entries);
  };

  const handleExportJson = () => {
    if (entries.length === 0) {
      alert('Your field journal is empty. Make an observation first!');
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
    if (confirm('Are you sure you want to clear your local field journal? This cannot be undone.')) {
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
    // Default expanded unless explicitly set to false
    return expandedLocations[loc] !== false;
  };

  return (
    <div className="space-y-5">
      {/* Field Survey Log Header */}
      <div className={`p-5 sm:p-6 rounded-2xl border transition-all ${
        isSunlightMode 
          ? 'bg-[#06140b] border-emerald-800/80 text-white shadow-xl' 
          : 'bg-white border-[#d4e2d4] text-[#1a2b1e] shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                isSunlightMode ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
              }`}>
                <Trees className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight font-sans">Field Survey Log</h2>
                <p className={`text-xs mt-0.5 ${isSunlightMode ? 'text-emerald-400/80' : 'text-[#4a5d4e]'}`}>
                  {entries.length} {entries.length === 1 ? 'observation' : 'observations'} across {locationGroups.length} {locationGroups.length === 1 ? 'survey site' : 'survey sites'}
                </p>
              </div>
            </div>
          </div>

          {/* Top Actions: Export CSV, Backup JSON, Restore JSON, Clear */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Upload backup JSON file"
            />

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={entries.length === 0}
              className={`py-2 px-3.5 min-h-[42px] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                entries.length === 0
                  ? isSunlightMode 
                    ? 'opacity-40 cursor-not-allowed bg-emerald-950/40 text-emerald-500/50 border border-emerald-900/40' 
                    : 'opacity-40 cursor-not-allowed bg-neutral-100 text-neutral-400 border border-[#d4e2d4]'
                  : isSunlightMode
                    ? 'bg-emerald-800 hover:bg-emerald-700 text-white border border-emerald-600 shadow-md'
                    : 'bg-[#2d5a37] hover:bg-[#23472b] text-white shadow-sm'
              }`}
              title="Export all observations as standard CSV file"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={entries.length === 0}
              className={`py-2 px-3.5 min-h-[42px] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                entries.length === 0
                  ? isSunlightMode 
                    ? 'opacity-40 cursor-not-allowed bg-emerald-950/40 text-emerald-500/50 border border-emerald-900/40' 
                    : 'opacity-40 cursor-not-allowed bg-neutral-100 text-neutral-400 border border-[#d4e2d4]'
                  : isSunlightMode
                    ? 'bg-[#06120a] hover:bg-[#0a1a0f] text-emerald-200 border border-emerald-800'
                    : 'bg-[#faf9f6] text-[#1a2b1e] hover:bg-[#f0ede6] border border-[#d4e2d4]'
              }`}
              title="Download raw JSON backup file"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Backup JSON</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerImport}
              className={`py-2 px-3.5 min-h-[42px] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                isSunlightMode
                  ? 'bg-[#06120a] hover:bg-[#0a1a0f] text-emerald-200 border border-emerald-800'
                  : 'bg-[#faf9f6] text-[#1a2b1e] hover:bg-[#f0ede6] border border-[#d4e2d4]'
              }`}
              title="Restore observations from a JSON backup file"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restore</span>
            </button>

            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className={`py-2 px-3 min-h-[42px] rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isSunlightMode
                    ? 'border-red-900/60 text-red-400 hover:bg-red-950/60'
                    : 'border-red-200 text-red-700 hover:bg-red-50'
                }`}
                title="Clear all journal records"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Survey Overview Stats Bar with Distinct Icons & Micro-Hierarchy */}
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t ${
          isSunlightMode ? 'border-emerald-800/40' : 'border-[#eef4ee]'
        }`}>
          <div className={`p-3 rounded-xl border relative overflow-hidden transition-all ${
            isSunlightMode ? 'bg-emerald-950/40 border-emerald-800/60 text-white' : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e]'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-semibold ${isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'}`}>
                Survey Sites
              </span>
              <Trees className={`w-3.5 h-3.5 opacity-80 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
            </div>
            <div className="text-xl font-black">{locationGroups.length}</div>
          </div>

          <div className={`p-3 rounded-xl border relative overflow-hidden transition-all ${
            isSunlightMode ? 'bg-emerald-950/30 border-emerald-800/50 text-white' : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e]'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-semibold ${isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'}`}>
                Species Life List
              </span>
              <Bird className={`w-3.5 h-3.5 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
            </div>
            <div className={`text-xl font-black ${isSunlightMode ? 'text-emerald-300' : 'text-[#1a2b1e]'}`}>
              {totalUniqueSpecies}
            </div>
          </div>

          <div className={`p-3 rounded-xl border relative overflow-hidden transition-all ${
            isSunlightMode ? 'bg-[#081a14] border-emerald-800/50 text-white' : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e]'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-semibold ${isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'}`}>
                Total Detections
              </span>
              <CheckCircle2 className={`w-3.5 h-3.5 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
            </div>
            <div className={`text-xl font-black ${isSunlightMode ? 'text-emerald-300' : 'text-[#2d5a37]'}`}>
              {entries.length}
            </div>
          </div>

          <div className={`p-3 rounded-xl border relative overflow-hidden transition-all ${
            isSunlightMode ? 'bg-[#051520] border-emerald-800/50 text-white' : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e]'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-semibold ${isSunlightMode ? 'text-emerald-300' : 'text-[#4a5d4e]'}`}>
                GPS Waypoints
              </span>
              <MapPin className={`w-3.5 h-3.5 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
            </div>
            <div className={`text-xl font-black ${isSunlightMode ? 'text-emerald-300' : 'text-[#1a2b1e]'}`}>
              {totalGpsFixed}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3.5 mt-3 border-t ${
          isSunlightMode ? 'border-emerald-800/40' : 'border-[#eef4ee]'
        }`}>
          {/* Search Query */}
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3 top-3.5 ${isSunlightMode ? 'text-gray-400' : 'text-[#7a9e7e]'}`} />
            <input
              type="text"
              placeholder="Search species, notes, or site..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 min-h-[44px] rounded-xl text-xs border outline-none ${
                isSunlightMode
                  ? 'bg-[#06120a] border-emerald-900/80 text-white placeholder-emerald-600 focus:border-emerald-500'
                  : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e] placeholder-[#4a5d4e]/60 focus:border-[#7a9e7e]'
              }`}
            />
          </div>

          {/* Location Group Filter */}
          <div className="relative">
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className={`w-full px-3 py-2 min-h-[44px] rounded-xl text-xs border appearance-none pr-8 cursor-pointer ${
                isSunlightMode
                  ? 'bg-[#06120a] border-emerald-900/80 text-white'
                  : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e]'
              }`}
            >
              <option value="all">All Survey Sites ({locationGroups.length})</option>
              {allLocations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-60">▼</span>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Calendar className={`w-4 h-4 absolute left-3 top-3.5 ${isSunlightMode ? 'text-gray-400' : 'text-[#7a9e7e]'} pointer-events-none`} />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 min-h-[44px] rounded-xl text-xs border outline-none ${
                  isSunlightMode
                    ? 'bg-[#06120a] border-emerald-900/80 text-white'
                    : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e]'
                }`}
              />
            </div>
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className="px-2.5 py-1.5 text-xs font-bold underline opacity-70 cursor-pointer text-[#2d5a37]"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Location Grouped Survey Logs */}
      {filteredEntries.length === 0 ? (
        <div className={`p-8 sm:p-12 rounded-2xl border text-center transition-all ${
          isSunlightMode
            ? 'bg-[#06140b] border border-emerald-800/80 shadow-xl text-white'
            : 'bg-white border border-[#d4e2d4] shadow-sm text-[#1a2b1e]'
        }`}>
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-all ${
            isSunlightMode
              ? 'bg-emerald-950/70 border border-emerald-800/60 text-emerald-400 shadow-inner'
              : 'bg-[#eef4ee] border border-[#d4e2d4] text-[#2d5a37]'
          }`}>
            <Feather className="w-8 h-8" />
          </div>
          <h3 className={`text-base font-bold mb-1 tracking-tight ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
            {entries.length === 0 ? 'No Observations Yet' : 'No Matching Observations'}
          </h3>
          <p className={`text-xs max-w-sm mx-auto mb-6 leading-relaxed ${
            isSunlightMode ? 'text-emerald-300/80' : 'text-[#4a5d4e]'
          }`}>
            {entries.length === 0
              ? 'Arrive at your local trail or park. Tap Record to identify bird calls offline and build your first area biodiversity survey.'
              : 'Try clearing your search query, location filter, or date filter.'}
          </p>
          {entries.length === 0 && (
            <button
              type="button"
              onClick={onGoToIdentify}
              className={`px-5 py-2.5 min-h-[46px] rounded-xl font-bold text-xs inline-flex items-center gap-2 transition-all cursor-pointer ${
                isSunlightMode
                  ? 'bg-emerald-800 hover:bg-emerald-700 text-white shadow-md'
                  : 'bg-[#2d5a37] hover:bg-[#23472b] text-white shadow-sm'
              }`}
            >
              <Bird className="w-4 h-4 text-white" />
              <span>Record a Bird Call</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
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
                className={`rounded-2xl border overflow-hidden transition-all shadow-sm ${
                  isSunlightMode
                    ? 'bg-[#06140b] border border-emerald-800/80 text-white shadow-xl'
                    : 'bg-white border border-[#d4e2d4] text-[#1a2b1e]'
                }`}
              >
                {/* Location Group Header Banner */}
                <div className={`p-4 sm:p-5 border-b transition-colors ${
                  isSunlightMode
                    ? 'bg-[#040e07] border-emerald-900/60'
                    : 'bg-[#faf9f6] border-[#eef4ee]'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        isSunlightMode
                          ? 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                          : 'bg-[#eef4ee] border border-[#d4e2d4] text-[#2d5a37]'
                      }`}>
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-lg font-black tracking-tight ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
                            {group.locationName}
                          </h3>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            isSunlightMode
                              ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                              : 'bg-[#2d5a37] text-white'
                          }`}>
                            {group.speciesCount} {group.speciesCount === 1 ? 'Species' : 'Species'}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            isSunlightMode
                              ? 'bg-emerald-900/50 border border-emerald-700/50 text-emerald-300'
                              : 'bg-[#eef4ee] border border-[#d4e2d4] text-[#2d5a37]'
                          }`}>
                            {group.totalDetections} {group.totalDetections === 1 ? 'Detection' : 'Detections'}
                          </span>
                        </div>

                        <div className={`text-xs mt-1 flex items-center gap-3 flex-wrap ${
                          isSunlightMode ? 'text-emerald-400/80' : 'text-[#4a5d4e]'
                        }`}>
                          <span>{dateStr}</span>
                          {group.hasGps && group.representativeGps && (
                            <span className={`font-mono text-[11px] ${isSunlightMode ? 'text-emerald-300' : 'text-[#2d5a37]'}`}>
                              {group.representativeGps.latitude.toFixed(4)}°, {group.representativeGps.longitude.toFixed(4)}°
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Export Location CSV + Toggle Collapse */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleExportLocationCsv(group.locationName, group.entries)}
                        className={`py-1.5 px-3 min-h-[38px] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSunlightMode
                            ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800'
                            : 'bg-white hover:bg-[#f0ede6] text-[#2d5a37] border border-[#d4e2d4]'
                        }`}
                        title={`Export CSV survey report for ${group.locationName}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Site CSV</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleLocationExpand(group.locationName)}
                        className={`p-2 min-w-[38px] min-h-[38px] rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                          isSunlightMode
                            ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800'
                            : 'bg-white hover:bg-[#f0ede6] text-[#1a2b1e] border border-[#d4e2d4]'
                        }`}
                        aria-label={isExpanded ? 'Collapse location entries' : 'Expand location entries'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Species checklist chips for this location */}
                  <div className={`flex flex-wrap gap-1.5 mt-3 pt-3 border-t ${
                    isSunlightMode ? 'border-emerald-900/30' : 'border-[#eef4ee]'
                  }`}>
                    {group.distinctSpecies.map((sp) => (
                      <span
                        key={sp.commonName}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                          isSunlightMode
                            ? 'bg-[#06120a] border-emerald-900/80 text-emerald-100'
                            : 'bg-white border-[#d4e2d4] text-[#1a2b1e] shadow-2xs'
                        }`}
                      >
                        <Bird className={`w-3 h-3 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
                        <span className="font-semibold">{sp.count}x {sp.commonName}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Expanded Individual Observations */}
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
                          className={`p-4 rounded-xl border transition-all ${
                            isSunlightMode
                              ? 'bg-[#06120a] border-emerald-900/60 text-white hover:border-emerald-700/80'
                              : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e] hover:border-[#7a9e7e] shadow-xs'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className={`font-bold text-base ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
                                  {entry.commonName}
                                </h4>
                                {entry.confirmedByUser && (
                                  <span title="Confirmed observation">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  </span>
                                )}
                              </div>
                              <div className={`text-xs italic ${isSunlightMode ? 'text-emerald-400/70' : 'text-[#4a5d4e]'}`}>
                                {entry.scientificName}
                              </div>
                            </div>

                            <div className="text-right">
                              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                                isSunlightMode
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                                  : 'bg-[#eef4ee] text-[#2d5a37] border-[#d4e2d4]'
                              }`}>
                                {Math.round(entry.confidence * 100)}%
                              </span>
                              <div className={`text-[10px] mt-1 ${isSunlightMode ? 'text-emerald-400/60' : 'text-[#4a5d4e]'}`}>
                                {formattedTime}
                              </div>
                            </div>
                          </div>

                          {/* Notes */}
                          {entry.notes && (
                            <p className={`text-xs p-2.5 rounded-lg mb-2 ${
                              isSunlightMode
                                ? 'bg-[#040c06] border border-emerald-950 text-neutral-300'
                                : 'bg-white border border-[#d4e2d4] text-[#1a2b1e]'
                            }`}>
                              {entry.notes}
                            </p>
                          )}

                          {/* Footer details: GPS & Delete */}
                          <div className={`flex items-center justify-between text-[11px] pt-2 border-t ${
                            isSunlightMode ? 'border-emerald-900/40 text-neutral-400' : 'border-[#eef4ee] text-[#4a5d4e]'
                          }`}>
                            <div className="flex items-center gap-3">
                              {entry.location ? (
                                <span className={`flex items-center gap-1 font-mono ${
                                  isSunlightMode ? 'text-emerald-400' : 'text-[#2d5a37]'
                                }`}>
                                  <MapPin className={`w-3 h-3 shrink-0 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
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
                              className={`p-1 min-w-[36px] min-h-[36px] flex items-center justify-center rounded transition-colors cursor-pointer ${
                                isSunlightMode
                                  ? 'text-neutral-500 hover:text-red-400 hover:bg-red-950/40'
                                  : 'text-[#4a5d4e] hover:text-red-700 hover:bg-red-50'
                              }`}
                              title="Delete entry"
                              aria-label={`Delete observation for ${entry.commonName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
