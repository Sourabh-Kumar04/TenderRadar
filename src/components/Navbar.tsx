import React, { useState, useEffect } from 'react';
import { Compass, Feather, BookOpen, Sun, Moon, WifiOff, Trees, Download, X } from 'lucide-react';
import { OfflineDiagnosticModal } from './OfflineDiagnosticModal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface NavbarProps {
  activeTab: 'identify' | 'journal';
  onTabChange: (tab: 'identify' | 'journal') => void;
  isSunlightMode: boolean;
  onToggleSunlightMode: () => void;
  journalCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  isSunlightMode,
  onToggleSunlightMode,
  journalCount,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallDismissed, setIsInstallDismissed] = useState<boolean>(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState<boolean>(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

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
    <header className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-all duration-200 ${
      isSunlightMode 
        ? 'bg-[#061009]/95 border-emerald-900/60 text-white shadow-xl' 
        : 'bg-[#faf9f6]/95 border-[#d4e2d4] text-[#1a2b1e] shadow-xs'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-all ${
            isSunlightMode 
              ? 'bg-emerald-900 text-white border border-emerald-700/60' 
              : 'bg-[#eef4ee] border border-[#d4e2d4] text-[#2d5a37]'
          }`}>
            <Feather className="w-5 h-5 transition-transform hover:rotate-12" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className={`font-extrabold text-base sm:text-lg tracking-tight font-sans truncate ${
                isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'
              }`}>TrailWhistle</span>
              <button
                type="button"
                onClick={() => setIsDiagnosticOpen(true)}
                title="Inspect on-device offline cache & field readiness"
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 shrink-0 ${
                  isSunlightMode 
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 hover:text-white' 
                    : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4] hover:bg-[#d4e2d4]'
                }`}
              >
                <WifiOff className="w-2.5 h-2.5" />
                <span>Offline</span>
              </button>
              <span className={`hidden md:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                isSunlightMode 
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                  : 'bg-[#f4f7f4] text-[#4a5d4e] border border-[#d4e2d4]'
              }`}>
                BirdNET v2.4 • 6,522 Species
              </span>
            </div>
            <p className={`text-[11px] font-medium flex items-center gap-1 truncate ${
              isSunlightMode ? 'text-emerald-300/80' : 'text-[#4a5d4e]'
            }`}>
              <Trees className={`w-3 h-3 shrink-0 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
              <span className="truncate">Area Biodiversity Survey & Acoustic Census</span>
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Desktop/Tablet Segmented Switcher */}
          <nav className={`hidden sm:flex items-center p-1 rounded-xl border ${
            isSunlightMode
              ? 'bg-[#0d1f14] border-emerald-900/60'
              : 'bg-[#f4f7f4] border-[#d4e2d4]'
          }`}>
            <button
              type="button"
              onClick={() => onTabChange('identify')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'identify'
                  ? isSunlightMode
                    ? 'bg-emerald-700 text-white shadow-sm border border-emerald-500/40'
                    : 'bg-white text-[#1a2b1e] shadow-sm border border-[#d4e2d4]'
                  : isSunlightMode
                    ? 'text-emerald-300/70 hover:text-white'
                    : 'text-[#4a5d4e] hover:text-[#1a2b1e]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Identify</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('journal')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'journal'
                  ? isSunlightMode
                    ? 'bg-emerald-700 text-white shadow-sm border border-emerald-500/40'
                    : 'bg-white text-[#1a2b1e] shadow-sm border border-[#d4e2d4]'
                  : isSunlightMode
                    ? 'text-emerald-300/70 hover:text-white'
                    : 'text-[#4a5d4e] hover:text-[#1a2b1e]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Journal</span>
              {journalCount > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  activeTab === 'journal'
                    ? isSunlightMode ? 'bg-white text-emerald-950' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
                    : isSunlightMode ? 'bg-forest-800 text-emerald-300' : 'bg-[#eef4ee] text-[#4a5d4e]'
                }`}>
                  {journalCount}
                </span>
              )}
            </button>
          </nav>

          {/* Tiny Dismissible PWA Install Chip */}
          {deferredPrompt && !isInstallDismissed && (
            <div
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isSunlightMode
                  ? 'bg-emerald-900 text-white border-emerald-800'
                  : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
              }`}
            >
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1 hover:underline cursor-pointer"
                title="Install TrailWhistle for offline field use"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Install</span>
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

          {/* Sunlight Mode Toggle */}
          <button
            type="button"
            onClick={onToggleSunlightMode}
            title={isSunlightMode ? 'Switch to light & airy iNaturalist theme' : 'Switch to outdoor high-contrast dark theme'}
            className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isSunlightMode
                ? 'bg-[#0d1f14] text-white border border-[#346c43] hover:bg-[#142a1c]'
                : 'bg-[#f4f7f4] text-[#1a2b1e] border border-[#d4e2d4] hover:bg-[#eef4ee]'
            }`}
            aria-label="Toggle outdoor sunlight contrast mode"
          >
            {isSunlightMode ? <Sun className="w-4 h-4 text-[#f59e0b]" /> : <Moon className="w-4 h-4 text-[#4a5d4e]" />}
          </button>
        </div>
      </div>

      {/* Mobile Tab Navigation Strip (Compact & Clean) */}
      <div className={`sm:hidden border-t ${
        isSunlightMode ? 'border-emerald-950 bg-[#061009]/95' : 'border-[#d4e2d4] bg-[#faf9f6]/95'
      }`}>
        <div className="grid grid-cols-2 p-1 gap-1">
          <button
            type="button"
            onClick={() => onTabChange('identify')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'identify'
                ? isSunlightMode
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-[#1a2b1e] shadow-sm border border-[#d4e2d4]'
                : isSunlightMode
                  ? 'text-emerald-300/70'
                  : 'text-[#4a5d4e]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Identify</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('journal')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'journal'
                ? isSunlightMode
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-[#1a2b1e] shadow-sm border border-[#d4e2d4]'
                : isSunlightMode
                  ? 'text-emerald-300/70'
                  : 'text-[#4a5d4e]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Journal</span>
            {journalCount > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                activeTab === 'journal'
                  ? isSunlightMode ? 'bg-white text-emerald-950' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
                  : isSunlightMode ? 'bg-forest-800 text-emerald-300' : 'bg-[#eef4ee] text-[#4a5d4e]'
              }`}>
                {journalCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Offline Field Readiness & Diagnostic Modal */}
      <OfflineDiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
        isSunlightMode={isSunlightMode}
      />
    </header>
  );
};
