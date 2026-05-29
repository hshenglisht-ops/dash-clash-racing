import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getGameByCode, normalizeCode, type Game, type Team } from "@/lib/game";
import { TEAM_COLORS } from "@/lib/characters";

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : "",
  }),
  head: () => ({ meta: [{ title: "게임 참가 — DASH & CLASH" }] }),
  component: JoinPage,
});

function JoinPage() {
  const { code: initialCode } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState(initialCode ?? "");
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  async function lookup(c: string) {
    const nc = normalizeCode(c);
    if (!nc) return;
    setLoading(true);
    const g = await getGameByCode(nc);
    if (!g) {
      toast.error("게임을 찾을 수 없습니다");
      setLoading(false);
      return;
    }
    setGame(g);
    const { data } = await supabase
      .from("teams")
      .select("*")
      .eq("game_id", g.id)
      .order("created_at");
    setTeams((data as Team[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (initialCode) lookup(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-center font-display text-6xl text-stroke-dark">
        <span className="text-frosty">JOIN</span>
      </h1>
      <p className="mb-6 text-center text-muted-foreground">게임 코드를 입력하세요</p>

      {!game ? (
        <div className="space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="DASH-0000"
            className="w-full rounded-xl border-2 border-frosty bg-input px-4 py-4 text-center font-display text-3xl tracking-widest outline-none"
          />
          <button
            disabled={loading}
            onClick={() => lookup(code)}
            className="w-full rounded-xl bg-frosty py-4 font-display text-2xl text-white disabled:opacity-60"
          >
            {loading ? "찾는 중..." : "게임 찾기"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            <span className="font-display text-lg text-primary">{game.game_code}</span> — 팀을
            선택하세요
          </p>
          {teams.map((t, i) => (
            <button
              key={t.id}
              onClick={() =>
                navigate({
                  to: "/team/$gameCode/$teamId",
                  params: { gameCode: game.game_code, teamId: t.id },
                })
              }
              className="w-full rounded-xl border-2 bg-card py-4 font-display text-2xl transition-transform hover:-translate-y-0.5"
              style={{ borderColor: TEAM_COLORS[i], color: TEAM_COLORS[i] }}
            >
              {t.name}
            </button>
          ))}
          <button
            onClick={() => setGame(null)}
            className="w-full py-2 text-sm text-muted-foreground"
          >
            ← 다른 코드 입력
          </button>
        </div>
      )}
    </div>
  );
}
