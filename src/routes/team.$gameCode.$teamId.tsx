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
import {
  CHARACTERS,
  MASCOT_ORDER,
  ACTION_CARD_INFO,
  type MascotName,
  type ActionCardType,
} from "@/lib/characters";

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
  // 이번 문제에 이미 답했는지
  const [answeredQuestionId, setAnsweredQuestionId] = useState<string | null>(null);
  // 내 답변이 정답인지
  const [myAnswerCorrect, setMyAnswerCorrect] = useState<boolean | null>(null);
  // 내 정답 순위 (1등이면 먼저 베팅)
  const [myRank, setMyRank] = useState<number | null>(null);
  // 베팅 선택 중인지
  const [bettingMode, setBettingMode] = useState(false);
  // phase3 선택 카드
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

  useEffect(() => { refreshGame(); refreshTeam(); }, [refreshGame, refreshTeam]);
  useEffect(() => { if (game?.id) refreshAux(game.id); }, [game?.id, refreshAux]);

  useRealtime("games", game?.id, refreshGame);
  useRealtime("teams", game?.id, refreshTeam);
  useRealtime("betting_cards", game?.id, () => game && refreshAux(game.id));
  useRealtime("mascots", game?.id, () => game && refreshAux(game.id));
  useRealtime("action_cards", game?.id, () => game && refreshAux(game.id));

  // active question
  const activeQ = questions.find((q) => q.id === game?.active_question_id) ?? null;

  // 문제 바뀌면 상태 리셋
  useEffect(() => {
    setAnsweredQuestionId(null);
    setMyAnswerCorrect(null);
    setMyRank(null);
    setBettingMode(false);
  }, [activeQ?.id]);

  // 내 순위 확인 (buzzer_events에서 정답자 순위)
  const checkMyRank = useCallback(async () => {
    if (!activeQ || !game) return;
    const { data } = await supabase
      .from("buzzer_events")
      .select("team_id, buzzed_at, is_correct")
      .eq("question_id", activeQ.id)
      .eq("is_correct", true)
      .order("buzzed_at", { ascending: true });
    if (!data) return;
    const rank = (data as { team_id: string }[]).findIndex((b) => b.team_id === teamId);
    if (rank !== -1) setMyRank(rank + 1);
  }, [activeQ, game, teamId]);

  useEffect(() => { checkMyRank(); }, [checkMyRank]);
  useRealtime("buzzer_events", game?.id, checkMyRank);

  async function submitAnswer(answer: string) {
    if (!game || !activeQ || answeredQuestionId === activeQ.id) return;
    setAnsweredQuestionId(activeQ.id);
    const correct = answer === activeQ.correct_answer;
    setMyAnswerCorrect(correct);

    await supabase.from("buzzer_events").insert({
      game_id: game.id,
      team_id: teamId,
      question_id: activeQ.id,
      selected_answer: answer,
      is_correct: correct,
    });

    if (correct) {
      toast.success("✅ 정답!");
    } else {
      toast.error("❌ 오답");
    }
    checkMyRank();
  }

  async function claimBetting(card: BettingCard) {
    const { error } = await supabase
      .from("betting_cards")
      .update({ team_id: teamId })
      .eq("id", card.id)
      .is("team_id", null);
    if (error) toast.error("이미 선점된 카드입니다");
    else {
      toast.success("베팅카드 선점!");
      setBettingMode(false);
    }
  }

  async function addToDeck(card: ActionCard) {
    if (!game) return;
    const unusedQ = questions.find((q) => !q.is_used) ?? null;
    await addCardToDeck(card.id, unusedQ?.id ?? null);
    toast.success("덱에 추가!");
    refreshAux(game.id);
  }

  async function selectDeckCard(card: ActionCard) {
    if (!game || game.current_turn_team_id !== teamId) return;
    setSelectedCard(card);
    const unusedQ = questions.find((q) => !q.is_used) ?? null;
    if (!unusedQ) { toast.error("남은 문제가 없습니다"); return; }
    await supabase.from("action_cards").update({ linked_question_id: unusedQ.id }).eq("id", card.id);
    await supabase.from("games").update({ current_turn_team_id: teamId }).eq("id", game.id);
    toast.success("카드 선택! 선생님이 퀴즈를 냅니다.");
  }

  const mascotName = (id: string): MascotName =>
    (mascots.find((m) => m.id === id)?.name as MascotName) ?? "CHILI";
  const isMyTurn = game?.current_turn_team_id === teamId;
  const myCards = actionCards.filter((c) => c.owner_team_id === teamId && !c.is_in_deck);
  const deckCards = actionCards.filter((c) => c.is_in_deck && !c.is_revealed);
  const alreadyAnswered = activeQ && answeredQuestionId === activeQ.id;
  const canBet = myAnswerCorrect === true; // 정답자만 베팅 가능

  if (!game || !team) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 pb-10 pt-6">
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
          {/* 문제 없을 때 */}
          {!activeQ && (
            <Center>
              <p className="font-display text-2xl text-muted-foreground">문제를 기다리는 중...</p>
            </Center>
          )}

          {/* 문제 있을 때 */}
          {activeQ && !activeQ.is_used && (
            <div>
              <div className="mb-4 rounded-2xl border-2 border-primary bg-card p-5">
                <p className="mb-1 text-xs text-muted-foreground">문제</p>
                <p className="font-display text-2xl">{activeQ.question_text}</p>
              </div>

              {/* 아직 답 안 했을 때 → 4지선다 */}
              {!alreadyAnswered && (
                <div className="grid grid-cols-2 gap-3">
                  {(["A", "B", "C", "D"] as const).map((ans) => {
                    const choiceKey = `choice_${ans.toLowerCase()}` as keyof Question;
                    const choiceText = activeQ[choiceKey] as string;
                    const colors = { A: "bg-blue-600", B: "bg-orange-500", C: "bg-green-600", D: "bg-red-600" };
                    return (
                      <button key={ans} onClick={() => submitAnswer(ans)}
                        className={`${colors[ans]} rounded-2xl p-5 font-display text-xl text-white shadow-[0_6px_0_0_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5`}>
                        <span className="block text-sm opacity-70">{ans}</span>
                        {choiceText}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 답한 후 */}
              {alreadyAnswered && (
                <div className={`rounded-2xl border-2 p-6 text-center ${myAnswerCorrect ? "border-green-500 bg-green-500/20" : "border-red-500 bg-red-500/20"}`}>
                  <p className="font-display text-4xl">
                    {myAnswerCorrect ? "✅ 정답!" : "❌ 오답"}
                  </p>
                  {myAnswerCorrect && myRank && (
                    <p className="mt-2 font-display text-2xl text-primary">
                      정답 {myRank}등!
                    </p>
                  )}
                  {myAnswerCorrect && (
                    <p className="mt-1 text-sm text-muted-foreground">베팅카드를 선점하세요!</p>
                  )}
                  {!myAnswerCorrect && (
                    <p className="mt-2 text-sm text-muted-foreground">이번 문제는 베팅할 수 없어요.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 문제가 이미 사용됨 */}
          {activeQ && activeQ.is_used && (
            <Center>
              <p className="font-display text-2xl text-muted-foreground">다음 문제를 기다리는 중...</p>
            </Center>
          )}

          {/* 베팅카드 선점 — 정답자만 */}
          {canBet && (
            <div className="mt-6">
              <h3 className="font-display text-xl">🃏 베팅카드 선점</h3>
              <p className="mb-2 text-xs text-muted-foreground">정답을 맞혔어요! 원하는 카드를 선점하세요.</p>
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
                        <span className="font-display" style={{ color: CHARACTERS[mn].color }}>{mn}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {cards.map((c) => (
                          <button key={c.id} onClick={() => claimBetting(c)}
                            className="rounded-md bg-secondary px-2 py-1 text-xs font-bold transition hover:bg-primary hover:text-primary-foreground">
                            {c.target_rank}등 {c.is_risky ? "🔥RISKY" : "🛡️SAFE"}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 내 베팅카드 현황 */}
          {betting.filter((b) => b.team_id === teamId).length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-card p-3">
              <p className="mb-2 font-display text-sm text-primary">✅ 내 베팅카드</p>
              <div className="flex flex-wrap gap-1">
                {betting.filter((b) => b.team_id === teamId).map((c) => (
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
          <p className="mb-4 text-sm text-muted-foreground">선생님이 문제를 낼 때 정답을 맞히면 액션카드를 받습니다!</p>
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-display text-lg">🃏 내 액션카드 ({myCards.length}장)</p>
            {myCards.length === 0
              ? <p className="text-sm text-muted-foreground">선생님의 퀴즈를 맞혀서 카드를 획득하세요!</p>
              : myCards.map((c) => {
                const info = ACTION_CARD_INFO[c.card_type as ActionCardType];
                const mn = mascotName(c.target_mascot_id);
                return (
                  <div key={c.id} className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-secondary p-3">
                    <span className="text-2xl">{info?.emoji}</span>
                    <div className="flex-1">
                      <p className="font-bold">{info?.label}</p>
                      <p className="text-xs text-muted-foreground">{info?.desc}</p>
                      <p className="text-xs font-bold" style={{ color: CHARACTERS[mn].color }}>대상: {mn}</p>
                    </div>
                    <button onClick={() => addToDeck(c)}
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-80">
                      덱에 추가
                    </button>
                  </div>
                );
              })}
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-display text-lg">🎴 내가 넣은 카드 ({actionCards.filter((c) => c.owner_team_id === teamId && c.is_in_deck).length}장)</p>
            <div className="flex flex-wrap gap-2">
              {actionCards.filter((c) => c.owner_team_id === teamId && c.is_in_deck).map((c) => {
                const info = ACTION_CARD_INFO[c.card_type as ActionCardType];
                const mn = mascotName(c.target_mascot_id);
                return (
                  <div key={c.id} className="rounded-lg bg-secondary px-2 py-1 text-xs">
                    {info?.emoji} {info?.label} <span className="font-bold" style={{ color: CHARACTERS[mn].color }}>{mn}</span>
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
              {deckCards.length === 0
                ? <p className="text-muted-foreground">덱에 카드가 없습니다.</p>
                : deckCards.map((c) => {
                  const info = ACTION_CARD_INFO[c.card_type as ActionCardType];
                  const mn = mascotName(c.target_mascot_id);
                  const isPending = selectedCard?.id === c.id;
                  return (
                    <div key={c.id}
                      className={`mb-3 flex items-center gap-3 rounded-xl border-2 p-4 transition ${isPending ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"}`}>
                      <span className="text-3xl">{info?.emoji}</span>
                      <div className="flex-1">
                        <p className="font-display text-lg">{info?.label}</p>
                        <p className="text-sm text-muted-foreground">{info?.desc}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <img src={CHARACTERS[mn].image} className="h-5 w-5" alt={mn} />
                          <span className="text-sm font-bold" style={{ color: CHARACTERS[mn].color }}>{mn}</span>
                        </div>
                      </div>
                      {isPending
                        ? <span className="rounded-lg bg-primary/20 px-3 py-2 text-sm font-bold text-primary">퀴즈 대기 중...</span>
                        : (
                          <button onClick={() => selectDeckCard(c)}
                            className="rounded-lg bg-primary px-4 py-3 font-display text-lg text-primary-foreground shadow-[0_4px_0_0_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5 active:translate-y-0">
                            선택!
                          </button>
                        )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <div>
              <Center>
                <p className="font-display text-2xl">다른 팀의 턴입니다</p>
                <p className="text-sm text-muted-foreground">잠시 기다려 주세요...</p>
              </Center>
              <div className="mt-4 rounded-xl border border-border bg-card p-4">
                <p className="mb-2 font-display text-lg">현재 순위</p>
                {[...mascots].sort((a, b) => b.position - a.position).map((m, i) => (
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
            {betting.filter((b) => b.team_id === teamId && b.is_resolved).map((b) => (
              <div key={b.id} className="flex items-center gap-2 py-1 text-sm">
                <img src={CHARACTERS[mascotName(b.mascot_id)].image} className="h-5 w-5" alt="" />
                <span>{mascotName(b.mascot_id)} {b.target_rank}등 {b.is_risky ? "RISKY" : "SAFE"}</span>
                <span className={`ml-auto font-bold ${(b.payout ?? 0) > 0 ? "text-green-400" : (b.payout ?? 0) < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                  {(b.payout ?? 0) > 0 ? `+${b.payout}` : b.payout ?? 0}
                </span>
              </div>
            ))}
          </div>
        </Center>
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
