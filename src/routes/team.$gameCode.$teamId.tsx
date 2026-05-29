import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import {
  getGameByCode,
  addCardToDeck,
  type ActionCard,
  type Game,
  type Team,
  type Question,
  type BettingCard,
  type Mascot,
} from "@/lib/game";
import { CHARACTERS, MASCOT_ORDER, ACTION_CARD_INFO, type MascotName, type ActionCardType } from "@/lib/characters";

export const Route = createFileRoute("/team/$gameCode/$teamId")({
  head: () => ({ meta: [{ title: "조별 화면 — DASH & CLASH" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { gameCode, teamId } = Route.useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [mascots, setMascots] = useState<Mascot[]>([]);
  const [betting, setBetting] = useState<BettingCard[]>([]);
  const [actionCards, setActionCards] = useState<ActionCard[]>([]);
  const [buzzed, setBuzzed] = useState(false);
  const [isFastest, setIsFastest] = useState(false);
  // phase3: which card this team has selected (waiting for host to show quiz)
  const [selectedCard, setSelectedCard] = useState<ActionCard | null>(null);

  const refreshGame = useCallback(async () => {
    const g = await getGameByCode(gameCode);
    setGame(g);
  }, [gameCode]);

  const refreshTeam = useCallback(async () => {
    const { data } = await supabase.from("teams").select("*").eq("id", teamId).maybeSingle();
    setTeam((data as Team) ?? null);
  }, [teamId]);

  const refreshAux = useCallback(async (gameId: string) => {
    const [{ data: q }, { data: m }, { data: b }, { data: a }] = await Promise.all([
      supabase.from("questions").select("*").eq("game_id", gameId),
      supabase.from("mascots").select("*").eq("game_id", gameId),
      supabase.from("betting_cards").select("*").eq("game_id", gameId),
      supabase.from("action_cards").select("*").eq("game_id", gameId),
    ]);
    setQuestions((q as Question[]) ?? []);
    setMascots((m as Mascot[]) ?? []);
    setBetting((b as BettingCard[]) ?? []);
    setActionCards((a as ActionCard[]) ?? []);
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
  useRealtime("action_cards", game?.id, () => game && refreshAux(game.id));

  // Get the current active question from what host selected
  const activeQ = questions.find((q) => q.id === game?.active_question_id) ?? null;

  const checkFastest = useCallback(async () => {
    if (!activeQ) return;
    const { data } = await supabase
      .from("buzzer_events")
      .select("team_id, is_correct")
      .eq("question_id", activeQ.id)
      .order("buzzed_at", { ascending: true })
      .limit(1);
    const top = (data as { team_id: string; is_correct: boolean | null }[])?.[0];
    setIsFastest(!!top && top.team_id === teamId);
  }, [activeQ, teamId]);

  useEffect(() => {
    checkFastest();
  }, [checkFastest]);
  useRealtime("buzzer_events", game?.id, checkFastest);

  useEffect(() => {
    setBuzzed(false);
    setIsFastest(false);
  }, [activeQ?.id]);

  async function buzz() {
    if (!game || !activeQ || buzzed) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(200);
    setBuzzed(true);
    const { error } = await supabase.from("buzzer_events").insert({
      game_id: game.id,
      team_id: teamId,
      question_id: activeQ.id,
    });
    if (error) {
      toast.error("버저 실패");
      setBuzzed(false);
    }
  }

  async function claimBetting(card: BettingCard) {
    const { error } = await supabase
      .from("betting_cards")
      .update({ team_id: teamId })
      .eq("id", card.id)
      .is("team_id", null);
    if (error) toast.error("이미 선점된 카드입니다");
    else toast.success("베팅카드 선점!");
  }

  // Phase 2: add an action card to the shared deck
  async function addToDeck(card: ActionCard) {
    if (!game) return;
    // pick an unused question to link
    const unusedQ = questions.find((q) => !q.is_used) ?? null;
    await addCardToDeck(card.id, unusedQ?.id ?? null);
    toast.success("덱에 추가!");
    refreshAux(game.id);
  }

  // Phase 3: select a card → notify host via supabase update
  async function selectDeckCard(card: ActionCard) {
    if (!game || game.current_turn_team_id !== teamId) return;
    // We store the selected card in action_cards with a temp flag
    // Host polls action_cards for pending cards
    // Simple approach: update linked_question_id and host refreshes
    setSelectedCard(card);
    // Find an unused question to assign
    const unusedQ = questions.find((q) => !q.is_used) ?? null;
    if (!unusedQ) {
      toast.error("남은 문제가 없습니다");
      return;
    }
    await supabase.from("action_cards").update({ linked_question_id: unusedQ.id }).eq("id", card.id);
    // Signal host by updating game with the pending card id (use current_turn_team_id to keep it simple)
    await supabase.from("games").update({ current_turn_team_id: teamId }).eq("id", game.id);
    toast.success("카드 선택! 선생님이 퀴즈를 냅니다.");
  }

  const mascotName = (id: string): MascotName => (mascots.find((m) => m.id === id)?.name as MascotName) ?? "CHILI";

  const isMyTurn = game?.current_turn_team_id === teamId;
  const myCards = actionCards.filter((c) => c.owner_team_id === teamId && !c.is_in_deck);
  const deckCards = actionCards.filter((c) => c.is_in_deck && !c.is_revealed);

  if (!game || !team) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">불러오는 중...</div>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 pb-40 pt-6">
      {/* header */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <span className="font-display text-2xl text-primary">{team.name}</span>
        <span className="text-sm">💰 {team.money}</span>
        <span className="rounded bg-secondary px-2 py-1 text-xs">{game.status}</span>
      </div>

      {/* ── WAITING ── */}
      {game.status === "waiting" && (
        <Center>
          <p className="font-display text-3xl text-primary">대기 중</p>
          <p className="text-muted-foreground">선생님이 게임을 시작할 때까지 기다리세요.</p>
        </Center>
      )}

      {/* ── PHASE 1 ── */}
      {game.status === "phase1" && (
        <div className="mt-4 flex-1">
          {activeQ ? (
            <div className="rounded-2xl border-2 border-primary bg-card p-5">
              <p className="mb-1 text-xs text-muted-foreground">문제</p>
              <p className="font-display text-2xl">{activeQ.question_text}</p>
              {activeQ.choice_a && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(["a", "b", "c", "d"] as const).map((k) => (
                    <div key={k} className="rounded-lg bg-secondary px-3 py-2 text-sm">
                      <span className="font-display text-primary">{k.toUpperCase()}.</span>{" "}
                      {activeQ[`choice_${k}` as keyof Question] as string}
                    </div>
                  ))}
                </div>
              )}
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
          <h3 className="mt-6 font-display text-xl">🃏 베팅카드 선점</h3>
          <p className="mb-2 text-xs text-muted-foreground">퀴즈를 맞힌 후 원하는 카드를 선점하세요</p>
          <div className="space-y-2">
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
                        {c.target_rank}등 {c.is_risky ? "🔥RISKY" : "🛡️SAFE"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* My betting cards */}
          {betting.filter((b) => b.team_id === teamId).length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-card p-3">
              <p className="mb-2 font-display text-sm text-primary">✅ 내 베팅카드</p>
              <div className="flex flex-wrap gap-1">
                {betting
                  .filter((b) => b.team_id === teamId)
                  .map((c) => (
                    <div key={c.id} className="rounded-md bg-primary/20 px-2 py-1 text-xs font-bold text-primary">
                      {mascotName(c.mascot_id)} {c.target_rank}등 {c.is_risky ? "RISKY" : "SAFE"}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PHASE 2 ── */}
      {game.status === "phase2" && (
        <div className="mt-4 flex-1">
          <h3 className="font-display text-2xl text-primary">페이즈2 — 덱 빌딩</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            선생님이 문제를 낼 때 정답을 맞히면 액션카드를 받습니다. 획득한 카드를 전략적으로 덱에 추가하세요!
          </p>

          {/* My action cards */}
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-display text-lg">🃏 내 액션카드 ({myCards.length}장)</p>
            {myCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">선생님의 퀴즈를 맞혀서 카드를 획득하세요!</p>
            ) : (
              myCards.map((c) => {
                const info = ACTION_CARD_INFO[c.card_type as ActionCardType];
                const mn = mascotName(c.target_mascot_id);
                return (
                  <div
                    key={c.id}
                    className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-secondary p-3"
                  >
                    <span className="text-2xl">{info?.emoji}</span>
                    <div className="flex-1">
                      <p className="font-bold">{info?.label}</p>
                      <p className="text-xs text-muted-foreground">{info?.desc}</p>
                      <p className="text-xs font-bold" style={{ color: CHARACTERS[mn].color }}>
                        대상: {mn}
                      </p>
                    </div>
                    <button
                      onClick={() => addToDeck(c)}
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-80"
                    >
                      덱에 추가
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Cards already in deck */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-display text-lg">
              🎴 내가 넣은 카드 ({actionCards.filter((c) => c.owner_team_id === teamId && c.is_in_deck).length}장)
            </p>
            <div className="flex flex-wrap gap-2">
              {actionCards
                .filter((c) => c.owner_team_id === teamId && c.is_in_deck)
                .map((c) => {
                  const info = ACTION_CARD_INFO[c.card_type as ActionCardType];
                  const mn = mascotName(c.target_mascot_id);
                  return (
                    <div key={c.id} className="rounded-lg bg-secondary px-2 py-1 text-xs">
                      {info?.emoji} {info?.label}{" "}
                      <span className="font-bold" style={{ color: CHARACTERS[mn].color }}>
                        {mn}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── PHASE 3 ── */}
      {game.status === "phase3" && (
        <div className="mt-4 flex-1">
          {isMyTurn ? (
            <div>
              <div className="mb-4 rounded-2xl bg-primary/20 p-4 text-center ring-2 ring-primary">
                <p className="font-display text-3xl text-primary">🎯 우리 팀 턴!</p>
                <p className="text-sm text-muted-foreground">덱에서 카드를 골라 퀴즈에 도전하세요</p>
              </div>

              <p className="mb-2 font-display text-lg">🎴 레이스 덱 ({deckCards.length}장)</p>
              {deckCards.length === 0 ? (
                <p className="text-muted-foreground">덱에 카드가 없습니다.</p>
              ) : (
                deckCards.map((c) => {
                  const info = ACTION_CARD_INFO[c.card_type as ActionCardType];
                  const mn = mascotName(c.target_mascot_id);
                  const isPending = selectedCard?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`mb-3 flex items-center gap-3 rounded-xl border-2 p-4 transition ${isPending ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"}`}
                    >
                      <span className="text-3xl">{info?.emoji}</span>
                      <div className="flex-1">
                        <p className="font-display text-lg">{info?.label}</p>
                        <p className="text-sm text-muted-foreground">{info?.desc}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <img src={CHARACTERS[mn].image} className="h-5 w-5" alt={mn} />
                          <span className="text-sm font-bold" style={{ color: CHARACTERS[mn].color }}>
                            {mn}
                          </span>
                        </div>
                      </div>
                      {isPending ? (
                        <span className="rounded-lg bg-primary/20 px-3 py-2 text-sm font-bold text-primary">
                          퀴즈 대기 중...
                        </span>
                      ) : (
                        <button
                          onClick={() => selectDeckCard(c)}
                          className="rounded-lg bg-primary px-4 py-3 font-display text-lg text-primary-foreground shadow-[0_4px_0_0_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                          선택!
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div>
              <Center>
                <p className="font-display text-2xl">다른 팀의 턴입니다</p>
                <p className="text-sm text-muted-foreground">잠시 기다려 주세요...</p>
              </Center>
              {/* Live track standings */}
              <div className="mt-4 rounded-xl border border-border bg-card p-4">
                <p className="mb-2 font-display text-lg">현재 순위</p>
                {[...mascots]
                  .sort((a, b) => b.position - a.position)
                  .map((m, i) => (
                    <div key={m.id} className="flex items-center gap-2 py-1 text-sm">
                      <span className="font-display w-4">{i + 1}</span>
                      <img src={CHARACTERS[m.name].image} className="h-6 w-6" alt={m.name} />
                      <span style={{ color: CHARACTERS[m.name].color }}>{m.name}</span>
                      {m.is_fallen && <span className="text-xs text-yellow-400">넘어짐</span>}
                      {m.direction === "backward" && <span className="text-xs text-red-400">역주행</span>}
                      <span className="ml-auto text-muted-foreground">
                        {m.is_eliminated ? "💀실격" : `${m.position}칸`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FINISHED ── */}
      {game.status === "finished" && (
        <Center>
          <p className="font-display text-4xl text-primary">🏁 게임 종료!</p>
          <p className="text-muted-foreground">최종 자금: 💰 {team.money}</p>
          <div className="mt-4 w-full rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-display text-lg">내 베팅 결과</p>
            {betting
              .filter((b) => b.team_id === teamId && b.is_resolved)
              .map((b) => (
                <div key={b.id} className="flex items-center gap-2 py-1 text-sm">
                  <img src={CHARACTERS[mascotName(b.mascot_id)].image} className="h-5 w-5" alt="" />
                  <span>
                    {mascotName(b.mascot_id)} {b.target_rank}등 {b.is_risky ? "RISKY" : "SAFE"}
                  </span>
                  <span
                    className={`ml-auto font-bold ${(b.payout ?? 0) > 0 ? "text-green-400" : (b.payout ?? 0) < 0 ? "text-red-400" : "text-muted-foreground"}`}
                  >
                    {(b.payout ?? 0) > 0 ? `+${b.payout}` : (b.payout ?? 0)}
                  </span>
                </div>
              ))}
          </div>
        </Center>
      )}

      {/* BUZZER — fixed bottom (phase1 only) */}
      {game.status === "phase1" && activeQ && !activeQ.is_used && (
        <button
          onClick={buzz}
          disabled={buzzed}
          className={`fixed inset-x-0 bottom-0 z-20 h-28 font-display text-5xl text-white transition-transform active:scale-95 ${buzzed ? "bg-secondary text-muted-foreground" : "bg-chili"}`}
          style={{ boxShadow: "0 -6px 24px rgba(0,0,0,0.5)" }}
        >
          {buzzed ? "⏳ 버저 완료!" : "🔴 BUZZ!"}
        </button>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center">{children}</div>;
}
