import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import {
  getGameByCode,
  type Game,
  type Team,
  type Question,
  type BettingCard,
  type Mascot,
} from "@/lib/game";
import { CHARACTERS, MASCOT_ORDER, type MascotName } from "@/lib/characters";

export const Route = createFileRoute("/team/$gameCode/$teamId")({
  head: () => ({ meta: [{ title: "조별 화면 — DASH & CLASH" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { gameCode, teamId } = Route.useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [mascots, setMascots] = useState<Mascot[]>([]);
  const [betting, setBetting] = useState<BettingCard[]>([]);
  const [buzzed, setBuzzed] = useState(false);
  const [isFastest, setIsFastest] = useState(false);

  const refreshGame = useCallback(async () => {
    const g = await getGameByCode(gameCode);
    setGame(g);
  }, [gameCode]);

  const refreshTeam = useCallback(async () => {
    const { data } = await supabase.from("teams").select("*").eq("id", teamId).maybeSingle();
    setTeam((data as Team) ?? null);
  }, [teamId]);

  const refreshAux = useCallback(async (gameId: string) => {
    const [{ data: q }, { data: m }, { data: b }] = await Promise.all([
      supabase
        .from("questions")
        .select("*")
        .eq("game_id", gameId)
        .order("is_used")
        .limit(1),
      supabase.from("mascots").select("*").eq("game_id", gameId),
      supabase.from("betting_cards").select("*").eq("game_id", gameId),
    ]);
    setQuestion(((q as Question[]) ?? [])[0] ?? null);
    setMascots((m as Mascot[]) ?? []);
    setBetting((b as BettingCard[]) ?? []);
  }, []);

  useEffect(() => {
    refreshGame();
    refreshTeam();
  }, [refreshGame, refreshTeam]);

  useEffect(() => {
    if (game?.id) refreshAux(game.id);
  }, [game?.id, refreshAux]);

  useRealtime("games", game?.id, refreshGame);
  useRealtime("teams", game?.id, refreshTeam);
  useRealtime("betting_cards", game?.id, () => game && refreshAux(game.id));
  useRealtime("mascots", game?.id, () => game && refreshAux(game.id));

  // track fastest buzzer for current question
  const checkFastest = useCallback(async () => {
    if (!question) return;
    const { data } = await supabase
      .from("buzzer_events")
      .select("team_id, is_correct")
      .eq("question_id", question.id)
      .order("buzzed_at", { ascending: true })
      .limit(1);
    const top = (data as { team_id: string; is_correct: boolean | null }[])?.[0];
    setIsFastest(!!top && top.team_id === teamId);
  }, [question, teamId]);

  useEffect(() => {
    checkFastest();
  }, [checkFastest]);
  useRealtime("buzzer_events", game?.id, checkFastest);

  async function buzz() {
    if (!game || !question || buzzed) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(200);
    setBuzzed(true);
    const { error } = await supabase.from("buzzer_events").insert({
      game_id: game.id,
      team_id: teamId,
      question_id: question.id,
      // buzzed_at uses server-side default now()
    });
    if (error) {
      toast.error("버저 실패");
      setBuzzed(false);
    }
  }

  // reset buzz when question changes
  useEffect(() => {
    setBuzzed(false);
    setIsFastest(false);
  }, [question?.id]);

  async function claimBetting(card: BettingCard) {
    const { error } = await supabase
      .from("betting_cards")
      .update({ team_id: teamId })
      .eq("id", card.id)
      .is("team_id", null);
    if (error) toast.error("선점 실패");
    else toast.success("베팅카드 선점!");
  }

  if (!game || !team) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  const mascotName = (id: string): MascotName =>
    (mascots.find((m) => m.id === id)?.name as MascotName) ?? "CHILI";

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 pb-40 pt-6">
      {/* header */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <span className="font-display text-2xl text-primary">{team.name}</span>
        <span className="text-sm">💰 {team.money}</span>
        <span className="rounded bg-secondary px-2 py-1 text-xs">{game.status}</span>
      </div>

      {/* WAITING */}
      {game.status === "waiting" && (
        <Center>
          <p className="font-display text-3xl text-primary">대기 중</p>
          <p className="text-muted-foreground">선생님이 게임을 시작할 때까지 기다리세요.</p>
        </Center>
      )}

      {/* PHASE 1 */}
      {game.status === "phase1" && (
        <div className="mt-4 flex-1">
          {question ? (
            <div className="rounded-2xl border-2 border-primary bg-card p-5">
              <p className="font-display text-2xl">{question.question_text}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">문제를 기다리는 중...</p>
          )}

          {isFastest && (
            <div className="mt-4 rounded-2xl border-2 border-track bg-track/20 p-4 text-center">
              <p className="font-display text-2xl text-track">⚡ 가장 빠른 버저!</p>
              <p className="text-sm text-muted-foreground">선생님의 판정을 기다리세요.</p>
            </div>
          )}

          {/* betting selection */}
          <h3 className="mt-6 font-display text-xl">베팅카드 선점 (정답 시)</h3>
          <div className="mt-2 space-y-2">
            {MASCOT_ORDER.map((mn) => {
              const cards = betting
                .filter((b) => mascotName(b.mascot_id) === mn && !b.team_id)
                .sort((a, b) => a.target_rank - b.target_rank);
              if (cards.length === 0) return null;
              return (
                <div key={mn} className="rounded-xl border border-border bg-card p-2">
                  <div className="mb-1 flex items-center gap-2">
                    <img src={CHARACTERS[mn].image} className="h-6 w-6" alt={mn} />
                    <span className="font-display" style={{ color: CHARACTERS[mn].color }}>
                      {mn}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {cards.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => claimBetting(c)}
                        className="rounded-md bg-secondary px-2 py-1 text-xs font-bold transition hover:bg-primary hover:text-primary-foreground"
                      >
                        {c.target_rank}등 {c.is_risky ? "RISKY" : "SAFE"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PHASE 2 */}
      {game.status === "phase2" && (
        <Center>
          <p className="font-display text-3xl text-primary">페이즈2 — 덱 빌딩</p>
          <p className="text-muted-foreground">획득한 액션카드를 공용 덱에 삽입하세요.</p>
        </Center>
      )}

      {/* PHASE 3 */}
      {game.status === "phase3" && (
        <div className="mt-4 flex-1">
          {game.current_turn_team_id === teamId ? (
            <Center>
              <p className="font-display text-3xl text-primary">우리 팀 턴!</p>
              <p className="text-muted-foreground">덱에서 카드를 선택하세요.</p>
            </Center>
          ) : (
            <Center>
              <p className="font-display text-2xl">다른 팀의 턴입니다</p>
              <div className="mt-4 w-full space-y-1">
                {[...mascots]
                  .sort((a, b) => b.position - a.position)
                  .map((m, i) => (
                    <div key={m.id} className="flex items-center gap-2 text-sm">
                      <span className="font-display">{i + 1}</span>
                      <img src={CHARACTERS[m.name].image} className="h-6 w-6" alt={m.name} />
                      <span style={{ color: CHARACTERS[m.name].color }}>{m.name}</span>
                      <span className="ml-auto text-muted-foreground">
                        {m.is_eliminated ? "실격" : `${m.position}칸`}
                      </span>
                    </div>
                  ))}
              </div>
            </Center>
          )}
        </div>
      )}

      {game.status === "finished" && (
        <Center>
          <p className="font-display text-4xl text-primary">🏁 게임 종료</p>
          <p className="text-muted-foreground">최종 자금: 💰 {team.money}</p>
        </Center>
      )}

      {/* BUZZER fixed bottom (phase1 only) */}
      {game.status === "phase1" && question && (
        <button
          onClick={buzz}
          disabled={buzzed}
          className={`fixed inset-x-0 bottom-0 z-20 h-28 font-display text-5xl text-white transition-transform active:scale-95 ${
            buzzed ? "bg-secondary text-muted-foreground" : "bg-chili"
          }`}
          style={{ boxShadow: "0 -6px 24px rgba(0,0,0,0.5)" }}
        >
          {buzzed ? "버저 완료!" : "🔴 BUZZ!"}
        </button>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center">
      {children}
    </div>
  );
}
