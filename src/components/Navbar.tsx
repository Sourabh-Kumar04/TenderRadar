import React, { useState, useEffect } from 'react';
import { Feather, Sun, Moon, WifiOff, Download, X, Search, Radio } from 'lucide-react';
import { OfflineDiagnosticModal } from './OfflineDiagnosticModal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface NavbarProps {
  activeTab: 'identify' | 'journal' | 'species';
  onTabChange: (tab: 'identify' | 'journal' | 'species') => void;
  isSunlightMode: boolean;
  onToggleSunlightMode: () => void;
  journalCount: number;
  onStartSurvey?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  isSunlightMode,
  onToggleSunlightMode,
  journalCount,
  onStartSurvey,
  searchQuery = '',
  onSearchChange,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallDismissed, setIsInstallDismissed] = useState<boolean>(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState<boolean>(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value);
    if (onSearchChange) {
      onSearchChange(e.target.value);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstallDismissed(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#241B12] text-white border-b border-[#3D2E20] shadow-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-3 sm:gap-6">
        
        {/* (1) LEFT: Logo Wordmark (Serif, Cornell Lab Birds of the World style) */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            type="button"
            onClick={() => onTabChange('identify')}
            className="flex items-center space-x-2.5 sm:space-x-3 text-left group cursor-pointer focus:outline-none"
            title="TrailWhistle Home & Bioacoustic Census"
          >
            <div className="w-10 h-10 rounded-full bg-[#D73C30] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform shrink-0">
              <Feather className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif font-bold text-xl sm:text-2xl tracking-tight text-white group-hover:text-[#F7F5F2] transition-colors leading-none">
                TrailWhistle
              </span>
              <span className="text-[10px] font-sans uppercase tracking-widest text-[#B8ACA0] font-semibold mt-1">
                Birds of the World • Bioacoustics
              </span>
            </div>
          </button>
        </div>

        {/* (2) CENTER: Pill Search Field */}
        <div className="flex-1 max-w-md hidden md:block">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (onSearchChange) onSearchChange(localSearch);
              onTabChange('species');
            }}
            className="relative flex items-center"
          >
            <button
              type="submit"
              className="absolute left-3 text-[#B8ACA0] hover:text-white transition-colors cursor-pointer p-0.5 focus:outline-none"
              title="Filter species catalog"
              aria-label="Filter species catalog"
            >
              <Search className="w-4 h-4 text-[#B8ACA0] hover:text-white" />
            </button>
            <input
              type="text"
              value={localSearch}
              onChange={handleSearchInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (onSearchChange) onSearchChange(localSearch);
                  onTabChange('species');
                }
              }}
              placeholder="Search species, calls, or families... (Press Enter)"
              aria-label="Search species catalog"
              className="w-full bg-[#36291E] hover:bg-[#3D2E22] focus:bg-[#443326] text-white placeholder-[#B8ACA0] text-sm rounded-full pl-10 pr-9 py-2 border border-[#4E3A2B] focus:border-[#D73C30] outline-none transition-all shadow-inner"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  if (onSearchChange) onSearchChange('');
                }}
                className="absolute right-3 text-[#B8ACA0] hover:text-white cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>

        {/* (3) RIGHT: Text Nav Links (Survey, Species, Journal) + Coral-Red Pill Buttons (#D73C30) */}
        <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
          <nav className="flex items-center space-x-1 sm:space-x-3 font-sans">
            {/* Nav Item: Survey */}
            <button
              type="button"
              onClick={() => onTabChange('identify')}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'identify'
                  ? 'text-white bg-[#3D2E22] border border-[#523F2F] shadow-inner font-bold'
                  : 'text-[#E7E2DC] hover:text-white hover:bg-[#36291E]/60'
              }`}
            >
              Survey
            </button>

            {/* Nav Item: Species */}
            <button
              type="button"
              onClick={() => onTabChange('species')}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'species'
                  ? 'text-white bg-[#3D2E22] border border-[#523F2F] shadow-inner font-bold'
                  : 'text-[#E7E2DC] hover:text-white hover:bg-[#36291E]/60'
              }`}
            >
              Species
            </button>

            {/* Nav Item: Journal */}
            <button
              type="button"
              onClick={() => onTabChange('journal')}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'journal'
                  ? 'text-white bg-[#3D2E22] border border-[#523F2F] shadow-inner font-bold'
                  : 'text-[#E7E2DC] hover:text-white hover:bg-[#36291E]/60'
              }`}
            >
              <span>Journal</span>
              {journalCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#D73C30] text-white">
                  {journalCount}
                </span>
              )}
            </button>
          </nav>

          {/* Coral-Red Pill Button (#D73C30) */}
          <button
            type="button"
            onClick={onStartSurvey}
            className="hidden sm:inline-flex items-center gap-1.5 bg-[#D73C30] hover:bg-[#C23328] text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Start new area survey station"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Start Survey</span>
          </button>

          {/* Offline Diagnostic Pill */}
          <button
            type="button"
            onClick={() => setIsDiagnosticOpen(true)}
            title="Inspect on-device offline cache & field readiness"
            className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 bg-[#36291E] hover:bg-[#433325] text-[#D8CDC2] hover:text-white border border-[#4E3A2B] cursor-pointer transition-all shrink-0"
          >
            <WifiOff className="w-3 h-3 text-[#E67E22]" />
            <span className="hidden xs:inline">Offline</span>
          </button>

          {/* PWA Install Button (if prompt active) */}
          {deferredPrompt && !isInstallDismissed && (
            <div className="flex items-center gap-1 px-3 py-1 bg-[#36291E] border border-[#4E3A2B] rounded-full text-xs font-semibold text-white">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#E67E22]" />
                <span className="hidden sm:inline">Install</span>
              </button>
              <button
                type="button"
                onClick={() => setIsInstallDismissed(true)}
                className="p-0.5 ml-1 opacity-70 hover:opacity-100 cursor-pointer"
                aria-label="Dismiss install chip"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Sunlight Mode Contrast Toggle */}
          <button
            type="button"
            onClick={onToggleSunlightMode}
            title={isSunlightMode ? 'Switch to Birds of the World warm theme' : 'Switch to outdoor high-contrast dark theme'}
            className="p-2 rounded-full bg-[#36291E] hover:bg-[#433325] text-[#D8CDC2] hover:text-white border border-[#4E3A2B] transition-all cursor-pointer"
            aria-label="Toggle outdoor sunlight contrast mode"
          >
            {isSunlightMode ? <Sun className="w-4 h-4 text-[#E67E22]" /> : <Moon className="w-4 h-4 text-[#D8CDC2]" />}
          </button>
        </div>
      </div>

      {/* Mobile Search Bar Strip */}
      <div className="md:hidden px-4 pb-2.5">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[#B8ACA0] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={localSearch}
            onChange={handleSearchInput}
            placeholder="Search species, calls, or surveys..."
            className="w-full bg-[#36291E] text-white placeholder-[#B8ACA0] text-xs rounded-full pl-9 pr-4 py-1.5 border border-[#4E3A2B] focus:border-[#D73C30] outline-none"
          />
        </div>
      </div>

      {/* Offline Diagnostic Modal */}
      <OfflineDiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
        isSunlightMode={isSunlightMode}
      />
    </header>
  );
};
