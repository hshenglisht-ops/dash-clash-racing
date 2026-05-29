import { CHARACTERS, TRACK_LENGTH, LANE_COUNT, MASCOT_ORDER } from "@/lib/characters";
import type { Mascot } from "@/lib/game";

export function HostTrack({ mascots }: { mascots: Mascot[] }) {
  const byLane: Record<number, Mascot[]> = {};
  for (const m of mascots) {
    (byLane[m.lane] ??= []).push(m);
  }
  // Ensure 4 lanes exist even before data loads
  const lanes = Array.from({ length: LANE_COUNT }, (_, i) => i);
  const cells = Array.from({ length: TRACK_LENGTH + 1 }, (_, i) => i);

  return (
    <div className="overflow-x-auto rounded-2xl border-4 border-track bg-track-field p-3">
      <div className="min-w-[700px] space-y-2">
        {lanes.map((lane) => (
          <div
            key={lane}
            className="relative grid items-center gap-0 border-b-2 border-dashed border-white/30 pb-1"
            style={{ gridTemplateColumns: `repeat(${TRACK_LENGTH + 1}, minmax(0,1fr))` }}
          >
            {cells.map((cell) => (
              <div
                key={cell}
                className={`relative flex h-16 items-center justify-center ${
                  cell === TRACK_LENGTH ? "bg-checker rounded-r-lg" : ""
                }`}
              >
                {cell !== TRACK_LENGTH && (
                  <span className="text-xs text-white/40">{cell}</span>
                )}
                {(byLane[lane] ?? [])
                  .filter((m) => Math.min(m.position, TRACK_LENGTH) === cell && !m.is_eliminated)
                  .map((m) => (
                    <img
                      key={m.id}
                      src={CHARACTERS[m.name].image}
                      alt={m.name}
                      className="absolute h-14 w-14 object-contain drop-shadow-lg transition-all duration-500"
                      style={{
                        transform: `${m.is_fallen ? "rotate(90deg)" : ""} ${
                          m.direction === "backward" ? "scaleX(-1)" : ""
                        }`,
                      }}
                    />
                  ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* eliminated row */}
      <div className="mt-3 flex flex-wrap gap-2">
        {mascots
          .filter((m) => m.is_eliminated)
          .map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-xs text-white/70"
            >
              <img
                src={CHARACTERS[m.name].image}
                alt={m.name}
                className="h-6 w-6 animate-fly-out"
              />
              실격
            </div>
          ))}
      </div>
      {/* legend */}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/70">
        {MASCOT_ORDER.map((mn) => (
          <span key={mn} className="flex items-center gap-1">
            <img src={CHARACTERS[mn].image} className="h-5 w-5" alt={mn} />
            {mn}
          </span>
        ))}
      </div>
    </div>
  );
}
