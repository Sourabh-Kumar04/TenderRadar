import React from 'react';
import { History, Mic, Music } from 'lucide-react';
import { SurveyRecordingEvent } from '../types/journal';

interface RecordingTimelineProps {
  events: SurveyRecordingEvent[];
  isSunlightMode: boolean;
}

export const RecordingTimeline: React.FC<RecordingTimelineProps> = ({
  events,
  isSunlightMode: _isSunlightMode,
}) => {
  if (events.length === 0) return null;

  return (
    <div className="p-5 sm:p-6 rounded-xl border border-[#E5E0D8] bg-white text-[#241B12] shadow-sm transition-all">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E5E0D8]">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#D73C30]" />
          <h3 className="font-serif font-bold text-base text-[#241B12] tracking-tight">
            Recording History Timeline
          </h3>
        </div>
        <span className="text-[10px] font-sans font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#F7F5F2] border border-[#E5E0D8] text-[#736B63]">
          {events.length} {events.length === 1 ? 'recording' : 'recordings'} logged
        </span>
      </div>

      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {events.map((ev, idx) => {
          const time = new Date(ev.timestamp).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          return (
            <div
              key={ev.id || idx}
              className="p-3 rounded-lg border border-[#E5E0D8] bg-[#F7F5F2] text-xs flex items-center justify-between gap-3 transition-all hover:border-[#D73C30]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="p-2 rounded-full bg-white text-[#D73C30] border border-[#E5E0D8] shrink-0">
                  {ev.source === 'live_mic' ? (
                    <Mic className="w-3 h-3" />
                  ) : (
                    <Music className="w-3 h-3" />
                  )}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans font-bold text-xs text-[#241B12] truncate">{ev.speciesName}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded-full ${
                        ev.confidence >= 0.25
                          ? 'bg-[#3D8B40]/15 text-[#3D8B40]'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {Math.round(ev.confidence * 100)}%
                    </span>
                  </div>
                  <div className="text-[11px] font-serif italic text-[#736B63] truncate">
                    {ev.scientificName}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-mono text-[10px] text-[#736B63]">{time}</div>
                <div className="text-[10px] text-[#736B63]">
                  {ev.durationSeconds}s clip
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
