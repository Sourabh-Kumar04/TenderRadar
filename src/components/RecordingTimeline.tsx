import React from 'react';
import { History, Mic, Music, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { SurveyRecordingEvent } from '../types/journal';

interface RecordingTimelineProps {
  events: SurveyRecordingEvent[];
  isSunlightMode: boolean;
}

export const RecordingTimeline: React.FC<RecordingTimelineProps> = ({
  events,
  isSunlightMode,
}) => {
  if (events.length === 0) return null;

  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      isSunlightMode
        ? 'bg-[#06140b] border border-emerald-800/80 text-white shadow-xl'
        : 'bg-white border border-[#d4e2d4] text-[#1a2b1e] shadow-sm'
    }`}>
      <div className={`flex items-center justify-between pb-2 mb-3 border-b ${
        isSunlightMode ? 'border-emerald-800/40' : 'border-[#eef4ee]'
      }`}>
        <div className="flex items-center gap-2">
          <History className={`w-4 h-4 ${isSunlightMode ? 'text-emerald-400' : 'text-[#7a9e7e]'}`} />
          <h3 className={`font-bold text-sm tracking-tight ${isSunlightMode ? 'text-white' : 'text-[#1a2b1e]'}`}>
            Recording History Timeline
          </h3>
        </div>
        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
          isSunlightMode ? 'bg-emerald-950 border border-emerald-800 text-emerald-300' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
        }`}>
          {events.length} {events.length === 1 ? 'recording' : 'recordings'} logged
        </span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {events.map((ev, idx) => {
          const time = new Date(ev.timestamp).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          return (
            <div
              key={ev.id || idx}
              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                isSunlightMode
                  ? 'bg-[#06120a] border-emerald-900/60 text-white'
                  : 'bg-[#faf9f6] border-[#d4e2d4] text-[#1a2b1e]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`p-1.5 rounded-lg shrink-0 ${
                  isSunlightMode ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
                }`}>
                  {ev.source === 'live_mic' ? (
                    <Mic className="w-3 h-3" />
                  ) : (
                    <Music className="w-3 h-3" />
                  )}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold truncate">{ev.speciesName}</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      ev.confidence >= 0.25
                        ? isSunlightMode ? 'bg-emerald-950 border border-emerald-800 text-emerald-300' : 'bg-[#eef4ee] text-[#2d5a37] border border-[#d4e2d4]'
                        : isSunlightMode ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {Math.round(ev.confidence * 100)}%
                    </span>
                  </div>
                  <div className={`text-[10px] truncate ${isSunlightMode ? 'text-emerald-400/70' : 'text-[#4a5d4e]'}`}>
                    {ev.scientificName}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-mono text-[10px] opacity-75">{time}</div>
                <div className={`text-[9px] ${isSunlightMode ? 'text-emerald-400/60' : 'text-[#4a5d4e]'}`}>
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
