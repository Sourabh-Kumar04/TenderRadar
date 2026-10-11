import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Sparkles, Volume2, AlertCircle, Radio, FlaskConical } from 'lucide-react';
import { recordMicAudio } from '../services/audio';
import { SAMPLE_AUDIO_LIST, SampleAudioItem } from '../data/sampleAudio';

interface AudioRecorderProps {
  onAudioCaptured: (audioData: Float32Array, wavBlob: Blob, source: 'live_mic' | 'sample_audio') => void;
  isProcessing: boolean;
  isSunlightMode: boolean;
  onSelectSample?: (sample: SampleAudioItem) => void;
  selectedSample?: SampleAudioItem | null;
  embeddedInHero?: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onAudioCaptured,
  isProcessing,
  isSunlightMode,
  onSelectSample,
  selectedSample,
  embeddedInHero = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(3.0);
  const [volume, setVolume] = useState(0);
  const [recordedWavUrl, setRecordedWavUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (recordedWavUrl) URL.revokeObjectURL(recordedWavUrl);
    };
  }, [recordedWavUrl]);

  // Handle 3-second live microphone capture
  const handleStartRecording = async () => {
    if (isRecording || isProcessing) return;

    setErrorMessage(null);
    setRecordedWavUrl(null);
    setIsRecording(true);
    setCountdown(3.0);
    setVolume(0.1);

    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, 3.0 - elapsed);
      setCountdown(Number(remaining.toFixed(1)));
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 100);

    try {
      const { rawAudio, wavBlob } = await recordMicAudio(3.0, (vol) => {
        setVolume(vol);
      });

      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsRecording(false);
      setVolume(0);

      const blobUrl = URL.createObjectURL(wavBlob);
      setRecordedWavUrl(blobUrl);

      onAudioCaptured(rawAudio, wavBlob, 'live_mic');
    } catch (err: unknown) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsRecording(false);
      setVolume(0);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    }
  };

  const handleTogglePreview = () => {
    if (!audioPreviewRef.current || !recordedWavUrl) return;

    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioPreviewRef.current.currentTime = 0;
      audioPreviewRef.current.play().catch(() => {});
      setIsPlayingPreview(true);
    }
  };

  return (
    <div
      className={`transition-all duration-300 relative overflow-hidden ${
        embeddedInHero
          ? 'bg-transparent text-white'
          : `p-6 sm:p-7 rounded-2xl border ${
              isSunlightMode
                ? 'bg-[#120D08] border-[#4A3A2C] text-white shadow-xl'
                : 'bg-white border-[#E5E0D8] text-[#241B12] shadow-sm'
            }`
      }`}
    >
      {/* Header Info Bar */}
      <div
        className={`flex items-center justify-between pb-3.5 mb-5 border-b relative z-10 ${
          embeddedInHero
            ? 'border-white/15'
            : isSunlightMode
              ? 'border-[#4A3A2C]'
              : 'border-[#E5E0D8]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-full ${
              embeddedInHero
                ? 'bg-white/15 text-white'
                : isSunlightMode
                  ? 'bg-[#241B12] text-[#E67E22] border border-[#4A3A2C]'
                  : 'bg-[#F7F5F2] text-[#D73C30] border border-[#E5E0D8]'
            }`}
          >
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2
              className={`text-sm font-bold font-serif ${
                embeddedInHero ? 'text-white' : isSunlightMode ? 'text-white' : 'text-[#241B12]'
              }`}
            >
              Acoustic field recorder
            </h2>
            <p
              className={`text-xs ${
                embeddedInHero ? 'text-[#EAE4DC]' : isSunlightMode ? 'text-[#B8ACA0]' : 'text-[#736B63]'
              }`}
            >
              Real-time on-device bioacoustic sensor
            </p>
          </div>
        </div>
        <span
          className={`text-[11px] font-sans font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 ${
            embeddedInHero
              ? 'bg-white/15 text-white border border-white/20'
              : isSunlightMode
                ? 'bg-[#241B12] text-[#EAE4DC] border border-[#4A3A2C]'
                : 'bg-[#F7F5F2] text-[#332A22] border border-[#E5E0D8]'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#3D8B40]" />
          <span>48kHz Worklet</span>
        </span>
      </div>

      {/* Capture Section */}
      <div className="flex flex-col items-center justify-center text-center relative z-10">
        <h3
          className={`text-lg sm:text-xl font-serif font-bold tracking-tight mb-1.5 ${
            embeddedInHero ? 'text-white' : isSunlightMode ? 'text-white' : 'text-[#241B12]'
          }`}
        >
          {isRecording
            ? 'Sampling Canopy Acoustics...'
            : isProcessing
              ? 'Classifying with BirdNET Neural Core...'
              : 'Record 3 Seconds of Birdsong'}
        </h3>
        <p
          className={`text-xs sm:text-sm mb-6 max-w-md leading-relaxed ${
            embeddedInHero ? 'text-[#EAE4DC]' : isSunlightMode ? 'text-[#B8ACA0]' : 'text-[#736B63]'
          }`}
        >
          Point microphone toward singing birds. Analyzed on-device with BirdNET v2.4 (6,522 species) in 100% offline isolation.
        </p>

        {/* PROMINENT RECORD BUTTON (Coral-red #D73C30, Pill or Circular Sonar, Generous Padding) */}
        <div className="relative mb-6 flex flex-col items-center justify-center group">
          {/* Subtle outer halo in idle */}
          {!isRecording && !isProcessing && (
            <div className="absolute w-36 h-36 rounded-full bg-[#D73C30]/20 blur-xl transition-all duration-700 group-hover:scale-125" />
          )}

          {/* Dynamic Sonar Rings when recording */}
          {isRecording && (
            <>
              <div
                className="absolute w-44 h-44 rounded-full border-2 border-[#D73C30]/50 animate-ping"
                style={{ transform: `scale(${1.1 + volume * 0.5})` }}
              />
              <div
                className="absolute w-36 h-36 rounded-full border-2 border-[#E67E22]/60 animate-pulse"
                style={{ transform: `scale(${1 + volume * 0.3})` }}
              />
            </>
          )}

          {/* The Prominent Coral-Red Pill / Sonar Button */}
          <button
            type="button"
            onClick={handleStartRecording}
            disabled={isRecording || isProcessing}
            aria-label={isRecording ? 'Recording in progress' : 'Record 3 seconds of bird call'}
            className={`min-w-[180px] sm:min-w-[220px] py-4 px-8 rounded-full flex items-center justify-center gap-3 transition-all duration-300 transform active:scale-95 shadow-xl select-none relative z-10 cursor-pointer ${
              isRecording
                ? 'bg-[#D73C30] text-white ring-8 ring-[#D73C30]/30 shadow-[0_0_40px_rgba(215,60,48,0.6)] animate-pulse'
                : isProcessing
                  ? 'bg-[#36291E] text-white cursor-not-allowed border-2 border-[#523F2F] opacity-90'
                  : 'bg-[#D73C30] hover:bg-[#C23328] text-white border-2 border-white/20 hover:scale-105 shadow-lg shadow-[#D73C30]/30'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-5 h-5 fill-current" />
                <span className="font-mono font-bold text-base tracking-wider">{countdown.toFixed(1)}s Recording</span>
              </>
            ) : isProcessing ? (
              <>
                <Sparkles className="w-5 h-5 animate-spin text-white" />
                <span className="font-sans font-bold text-sm text-white">Classifying Call...</span>
              </>
            ) : (
              <>
                <div className="p-2 rounded-full bg-white/20">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <span className="font-sans font-bold text-base tracking-wide text-white">Record Call</span>
              </>
            )}
          </button>
        </div>

        {/* Live Audio Visualizer / Bioacoustic Spectrum Meter */}
        {isRecording && (
          <div
            className={`w-72 mb-5 space-y-2.5 animate-fade-in p-4 rounded-xl border ${
              embeddedInHero
                ? 'bg-[#241B12]/80 border-white/20 text-white backdrop-blur-md'
                : isSunlightMode
                  ? 'bg-black/60 border-[#4A3A2C] text-white'
                  : 'bg-[#F7F5F2] border-[#E5E0D8] text-[#241B12]'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 font-bold text-[#D73C30]">
                <Volume2 className="w-4 h-4" />
                <span>Bioacoustic Level</span>
              </span>
              <span className="font-bold">{Math.round(volume * 100)}% RMS</span>
            </div>

            {/* Primary RMS Level Bar */}
            <div className="w-full h-2 rounded-full overflow-hidden bg-black/20">
              <div
                className="h-full transition-all duration-75 rounded-full bg-[#D73C30]"
                style={{ width: `${Math.min(100, Math.max(6, volume * 100))}%` }}
              />
            </div>

            {/* 4 Bioacoustic Frequency Bands */}
            <div className="flex items-center justify-between gap-1.5 pt-1">
              {[
                { label: '0.5-1.5k', height: Math.min(100, Math.max(12, volume * 80 + 10)) },
                { label: '1.5-3.0k', height: Math.min(100, Math.max(15, volume * 110 + 15)) },
                { label: '3.0-6.0k', height: Math.min(100, Math.max(18, volume * 95 + 12)) },
                { label: '6.0k+', height: Math.min(100, Math.max(10, volume * 65 + 8)) },
              ].map((band, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-6 rounded overflow-hidden flex items-end bg-black/20">
                    <div
                      className="w-full transition-all duration-100 rounded-t bg-[#E67E22]"
                      style={{ height: `${band.height}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-[#736B63]">{band.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Playback preview for last captured audio */}
        {recordedWavUrl && !isRecording && (
          <div className="mb-5 flex items-center gap-2">
            <audio
              ref={audioPreviewRef}
              src={recordedWavUrl}
              onEnded={() => setIsPlayingPreview(false)}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleTogglePreview}
              className={`px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm border ${
                embeddedInHero
                  ? 'bg-white/20 hover:bg-white/30 text-white border-white/30'
                  : isSunlightMode
                    ? 'bg-[#1C150E] hover:bg-[#241B12] text-white border-[#4A3A2C]'
                    : 'bg-[#F7F5F2] hover:bg-[#ECE7E1] text-[#241B12] border-[#E5E0D8]'
              }`}
            >
              <Play className={`w-3.5 h-3.5 text-[#D73C30] ${isPlayingPreview ? 'fill-current' : ''}`} />
              <span>{isPlayingPreview ? 'Replaying Audio...' : 'Replay 3s Audio Recording'}</span>
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl text-xs flex items-center gap-2.5 mb-4 w-full text-left bg-red-950/80 border border-red-700 text-red-100">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Quick Field Simulation Pills */}
        {onSelectSample && (
          <div
            className={`w-full pt-4 mt-2 border-t ${
              isSunlightMode
                ? 'border-[#4A3A2C]'
                : 'border-[#E5E0D8]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-xs font-serif font-bold flex items-center gap-1.5 ${
                  embeddedInHero ? 'text-white' : isSunlightMode ? 'text-white' : 'text-[#241B12]'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5 text-[#E67E22]" />
                <span>Simulate field bird call:</span>
              </span>
              <span
                className={`text-[10px] font-sans uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  embeddedInHero
                    ? 'bg-white/15 text-[#EAE4DC]'
                    : isSunlightMode
                      ? 'bg-[#241B12] text-[#B8ACA0] border border-[#4A3A2C]'
                      : 'bg-[#F7F5F2] text-[#736B63] border border-[#E5E0D8]'
                }`}
              >
                48kHz xeno-canto
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 w-full">
              {SAMPLE_AUDIO_LIST.map((sample) => {
                const isSelected = selectedSample?.id === sample.id;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => onSelectSample(sample)}
                    disabled={isRecording || isProcessing}
                    className={`p-3 rounded-full text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer group border ${
                      isSelected
                        ? 'bg-[#D73C30] text-white border-[#D73C30] shadow-md'
                        : embeddedInHero
                          ? 'bg-black/30 hover:bg-black/50 text-white border-white/20'
                          : isSunlightMode
                            ? 'bg-[#1C150E] hover:bg-[#241B12] text-white border-[#4A3A2C]'
                            : 'bg-[#FFFFFF] hover:bg-[#F7F5F2] text-[#241B12] border-[#E5E0D8]'
                    }`}
                    title={`Run on-device BirdNET inference on ${sample.speciesName}`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate font-sans font-bold text-xs">{sample.speciesName}</div>
                      <div className="text-[10px] italic text-[#B8ACA0] truncate font-serif">
                        {sample.scientificName}
                      </div>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                        isSelected
                          ? 'bg-white text-[#D73C30]'
                          : 'bg-[#E67E22] text-white'
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
