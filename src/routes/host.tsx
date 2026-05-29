import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import {
  createGame,
  type Game,
  type Team,
  type Question,
  type BettingCard,
  type Mascot,
  type QuestionInput,
} from "@/lib/game";
import { CHARACTERS, MASCOT_ORDER, TEAM_COLORS, type MascotName } from "@/lib/characters";
import { HostTrack } from "@/components/game/HostTrack";

export const Route = createFileRoute("/host")({
  head: () => ({
    meta: [{ title: "호스트 화면 — DASH & CLASH" }],
  }),
  component: HostPage,
});

function HostPage() {
  const [game, setGame] = useState<Game | null>(null);
  return game ? (
    <HostControl game={game} setGame={setGame} />
  ) : (
    <HostSetup onCreated={setGame} />
  );
}

/* ------------------------------------------------------------------ */
/* SETUP                                                               */
/* ------------------------------------------------------------------ */

const EMPTY_Q: QuestionInput = {
  question_text: "",
  choice_a: "",
  choice_b: "",
  choice_c: "",
  choice_d: "",
  correct_answer: "A",
};

function HostSetup({ onCreated }: { onCreated: (g: Game) => void }) {
  const [teamCount, setTeamCount] = useState(4);
  const [teamNames, setTeamNames] = useState<string[]>(
    Array.from({ length: 4 }, (_, i) => `${i + 1}조`),
  );
  const [questions, setQuestions] = useState<QuestionInput[]>([]);
  const [draft, setDraft] = useState<QuestionInput>({ ...EMPTY_Q });
  const [tab, setTab] = useState<"direct" | "csv" | "excel">("direct");
  const [creating, setCreating] = useState(false);

  function setCount(n: number) {
    setTeamCount(n);
    setTeamNames((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(`${next.length + 1}조`);
      next.length = n;
      return next;
    });
  }

  function addDraft() {
    if (!draft.question_text.trim()) {
      toast.error("문제를 입력하세요");
      return;
    }
    setQuestions((q) => [...q, { ...draft }]);
    setDraft({ ...EMPTY_Q });
  }

  function ingestRows(rows: Record<string, unknown>[]) {
    const parsed: QuestionInput[] = [];
    for (const r of rows) {
      const get = (k: string) =>
        String(
          r[k] ?? r[k.toUpperCase()] ?? r[k[0].toUpperCase() + k.slice(1)] ?? "",
        ).trim();
      const q = get("question");
      if (!q) continue;
      parsed.push({
        question_text: q,
        choice_a: get("a"),
        choice_b: get("b"),
        choice_c: get("c"),
        choice_d: get("d"),
        correct_answer: (get("answer") || "A").toUpperCase().slice(0, 1),
      });
    }
    if (parsed.length === 0) {
      toast.error("문제를 찾지 못했습니다. 컬럼: question,a,b,c,d,answer");
      return;
    }
    setQuestions((prev) => [...prev, ...parsed]);
    toast.success(`${parsed.length}개 문제 추가됨`);
  }

  function onCsv(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => ingestRows(res.data as Record<string, unknown>[]),
      error: () => toast.error("CSV 파싱 실패"),
    });
  }

  function onExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        ingestRows(rows);
      } catch {
        toast.error("엑셀 파싱 실패");
      }
    };
    reader.readAsBinaryString(file);
  }

  async function handleCreate() {
    if (teamNames.some((n) => !n.trim())) {
      toast.error("모든 팀 이름을 입력하세요");
      return;
    }
    if (questions.length === 0) {
      toast.error("문제를 최소 1개 추가하세요");
      return;
    }
    setCreating(true);
    try {
      const g = await createGame(teamNames, questions);
      toast.success(`게임 생성! 코드: ${g.game_code}`);
      onCreated(g);
    } catch (err) {
      console.error(err);
      toast.error("게임 생성 실패");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-5xl text-stroke-dark">
        <span className="text-chili">게임</span> 설정
      </h1>
      <p className="mt-1 text-muted-foreground">팀과 문제를 설정하고 게임을 생성하세요.</p>

      {/* TEAM SETUP */}
      <Section title="① 팀 설정">
        <label className="mb-3 block text-sm text-muted-foreground">
          팀 수: <span className="font-display text-lg text-primary">{teamCount}</span>
        </label>
        <input
          type="range"
          min={2}
          max={6}
          value={teamCount}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
        />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {teamNames.map((name, i) => (
            <input
              key={i}
              value={name}
              onChange={(e) =>
                setTeamNames((p) => p.map((v, j) => (j === i ? e.target.value : v)))
              }
              className="rounded-lg border-2 border-border bg-input px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              style={{ borderColor: TEAM_COLORS[i] }}
            />
          ))}
        </div>
      </Section>

      {/* QUESTIONS */}
      <Section title="② 문제 입력">
        <div className="mb-4 flex gap-2">
          {(["direct", "csv", "excel"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {t === "direct" ? "직접 입력" : t === "csv" ? "CSV 업로드" : "엑셀 업로드"}
            </button>
          ))}
        </div>

        {tab === "direct" && (
          <div className="space-y-2">
            <input
              placeholder="문제 (question)"
              value={draft.question_text}
              onChange={(e) => setDraft({ ...draft, question_text: e.target.value })}
              className="w-full rounded-lg border-2 border-border bg-input px-3 py-2 outline-none focus:border-primary"
            />
            <div className="grid grid-cols-2 gap-2">
              {(["a", "b", "c", "d"] as const).map((k) => (
                <input
                  key={k}
                  placeholder={`보기 ${k.toUpperCase()}`}
                  value={draft[`choice_${k}` as keyof QuestionInput] as string}
                  onChange={(e) =>
                    setDraft({ ...draft, [`choice_${k}`]: e.target.value })
                  }
                  className="rounded-lg border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">정답:</span>
              {(["A", "B", "C", "D"] as const).map((ans) => (
                <button
                  key={ans}
                  onClick={() => setDraft({ ...draft, correct_answer: ans })}
                  className={`h-9 w-9 rounded-lg font-display text-lg ${
                    draft.correct_answer === ans
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary"
                  }`}
                >
                  {ans}
                </button>
              ))}
              <button
                onClick={addDraft}
                className="ml-auto rounded-lg bg-frosty px-4 py-2 text-sm font-bold text-white"
              >
                문제 추가
              </button>
            </div>
          </div>
        )}

        {tab === "csv" && (
          <FileDrop accept=".csv" label="CSV 파일 선택 (question,a,b,c,d,answer)" onFile={onCsv} />
        )}
        {tab === "excel" && (
          <FileDrop
            accept=".xlsx,.xls"
            label="엑셀 파일 선택 (question,a,b,c,d,answer)"
            onFile={onExcel}
          />
        )}

        {questions.length > 0 && (
          <div className="mt-4 max-h-52 overflow-auto rounded-lg border border-border">
            {questions.map((q, i) => (
              <div
                key={i}
                className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-0"
              >
                <span className="font-display text-primary">{i + 1}</span>
                <span className="flex-1 truncate">{q.question_text}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                  정답 {q.correct_answer}
                </span>
                <button
                  onClick={() => setQuestions((p) => p.filter((_, j) => j !== i))}
                  className="text-destructive"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          등록된 문제: <span className="font-bold text-foreground">{questions.length}</span>개
        </p>
      </Section>

      <button
        disabled={creating}
        onClick={handleCreate}
        className="mt-6 w-full rounded-2xl bg-primary py-5 font-display text-3xl tracking-wide text-primary-foreground shadow-[0_8px_0_0_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60"
      >
        {creating ? "생성 중..." : "게임 생성 & 코드 발급"}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 font-display text-2xl tracking-wide text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function FileDrop({
  accept,
  label,
  onFile,
}: {
  accept: string;
  label: string;
  onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      onClick={() => ref.current?.click()}
      className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-input/50 px-4 py-8 text-muted-foreground hover:border-primary"
    >
      <span className="text-3xl">📄</span>
      <span className="text-sm">{label}</span>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* CONTROL                                                             */
/* ------------------------------------------------------------------ */

function HostControl({
  game,
  setGame,
}: {
  game: Game;
  setGame: (g: Game) => void;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [mascots, setMascots] = useState<Mascot[]>([]);
  const [betting, setBetting] = useState<BettingCard[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQ, setActiveQ] = useState<Question | null>(null);
  const [buzzers, setBuzzers] = useState<
    { team_id: string; buzzed_at: string }[]
  >([]);

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${game.game_code}`
      : "";

  const refreshGame = useCallback(async () => {
    const { data } = await supabase.from("games").select("*").eq("id", game.id).single();
    if (data) setGame(data as Game);
  }, [game.id, setGame]);

  const refreshTeams = useCallback(async () => {
    const { data } = await supabase
      .from("teams")
      .select("*")
      .eq("game_id", game.id)
      .order("created_at");
    setTeams((data as Team[]) ?? []);
  }, [game.id]);

  const refreshMascots = useCallback(async () => {
    const { data } = await supabase.from("mascots").select("*").eq("game_id", game.id);
    setMascots((data as Mascot[]) ?? []);
  }, [game.id]);

  const refreshBetting = useCallback(async () => {
    const { data } = await supabase.from("betting_cards").select("*").eq("game_id", game.id);
    setBetting((data as BettingCard[]) ?? []);
  }, [game.id]);

  const refreshQuestions = useCallback(async () => {
    const { data } = await supabase.from("questions").select("*").eq("game_id", game.id);
    setQuestions((data as Question[]) ?? []);
  }, [game.id]);

  const refreshBuzzers = useCallback(async () => {
    if (!activeQ) {
      setBuzzers([]);
      return;
    }
    const { data } = await supabase
      .from("buzzer_events")
      .select("team_id, buzzed_at")
      .eq("question_id", activeQ.id)
      .order("buzzed_at", { ascending: true });
    setBuzzers((data as { team_id: string; buzzed_at: string }[]) ?? []);
  }, [activeQ]);

  useEffect(() => {
    refreshTeams();
    refreshMascots();
    refreshBetting();
    refreshQuestions();
  }, [refreshTeams, refreshMascots, refreshBetting, refreshQuestions]);

  useEffect(() => {
    refreshBuzzers();
  }, [refreshBuzzers]);

  useRealtime("teams", game.id, refreshTeams);
  useRealtime("mascots", game.id, refreshMascots);
  useRealtime("betting_cards", game.id, refreshBetting);
  useRealtime("buzzer_events", game.id, refreshBuzzers);
  useRealtime("games", game.id, refreshGame);

  async function setStatus(status: string, phase: number) {
    await supabase.from("games").update({ status, phase }).eq("id", game.id);
    refreshGame();
    toast.success(`상태: ${status}`);
  }

  async function markAnswer(correct: boolean) {
    if (!activeQ || buzzers.length === 0) return;
    await supabase
      .from("buzzer_events")
      .update({ is_correct: correct })
      .eq("question_id", activeQ.id)
      .eq("team_id", buzzers[0].team_id);
    toast.success(correct ? "정답 처리!" : "오답 처리");
  }

  const teamColor = (id: string) => {
    const idx = teams.findIndex((t) => t.id === id);
    return TEAM_COLORS[idx] ?? "#888";
  };
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <p className="text-sm text-muted-foreground">게임 코드</p>
          <p className="font-display text-5xl tracking-widest text-primary">
            {game.game_code}
          </p>
        </div>
        <div className="rounded-xl bg-white p-2">
          <QRCodeSVG value={joinUrl} size={88} />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">참가 링크</p>
          <p className="break-all text-xs text-frosty">{joinUrl}</p>
          <p className="mt-2 text-sm">
            상태: <span className="font-display text-lg text-primary">{game.status}</span> /
            페이즈 {game.phase}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PhaseBtn onClick={() => setStatus("phase1", 1)}>페이즈1 (베팅)</PhaseBtn>
          <PhaseBtn onClick={() => setStatus("phase2", 2)}>페이즈2 (덱)</PhaseBtn>
          <PhaseBtn onClick={() => setStatus("phase3", 3)}>페이즈3 (레이싱)</PhaseBtn>
          <PhaseBtn onClick={() => setStatus("finished", 3)}>종료</PhaseBtn>
        </div>
      </div>

      {/* TEAMS live */}
      <div className="mt-4 flex flex-wrap gap-3">
        {teams.map((t, i) => (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded-xl border-2 bg-card px-4 py-2"
            style={{ borderColor: TEAM_COLORS[i] }}
          >
            <span className="font-display text-lg" style={{ color: TEAM_COLORS[i] }}>
              {t.name}
            </span>
            <span className="rounded bg-secondary px-2 py-0.5 text-sm">💰 {t.money}</span>
          </div>
        ))}
      </div>

      {game.status === "waiting" && (
        <p className="mt-8 text-center text-muted-foreground">
          학생들이 코드로 입장하면 위에 팀이 표시됩니다. 준비되면{" "}
          <span className="text-primary">[페이즈1]</span>로 시작하세요.
        </p>
      )}

      {/* PHASE 1 */}
      {game.status === "phase1" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 font-display text-2xl">문제 선택</h3>
            <div className="mb-4 flex flex-wrap gap-2">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={async () => {
                    setActiveQ(q);
                    await supabase
                      .from("games")
                      .update({ status: "phase1" })
                      .eq("id", game.id);
                  }}
                  className={`h-9 w-9 rounded-lg font-display ${
                    activeQ?.id === q.id
                      ? "bg-primary text-primary-foreground"
                      : q.is_used
                        ? "bg-secondary/50 text-muted-foreground"
                        : "bg-secondary"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {activeQ ? (
              <QuestionCard q={activeQ} />
            ) : (
              <p className="text-muted-foreground">문제 번호를 눌러 출제하세요.</p>
            )}

            {activeQ && (
              <>
                <h4 className="mt-4 font-display text-xl">버저 현황</h4>
                <div className="mt-2 space-y-1">
                  {buzzers.length === 0 && (
                    <p className="text-sm text-muted-foreground">대기 중...</p>
                  )}
                  {buzzers.map((b, i) => (
                    <div
                      key={b.team_id}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                        i === 0 ? "bg-primary/20 ring-2 ring-primary" : "bg-secondary"
                      }`}
                    >
                      <span className="font-display text-lg">{i + 1}위</span>
                      <span style={{ color: teamColor(b.team_id) }} className="font-bold">
                        {teamName(b.team_id)}
                      </span>
                      {i === 0 && <span className="ml-auto text-xs text-primary">⚡ FASTEST</span>}
                    </div>
                  ))}
                </div>
                {buzzers.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => markAnswer(true)}
                      className="flex-1 rounded-xl bg-track py-3 font-display text-xl text-white"
                    >
                      ⭕ 정답
                    </button>
                    <button
                      onClick={() => markAnswer(false)}
                      className="flex-1 rounded-xl bg-destructive py-3 font-display text-xl text-white"
                    >
                      ❌ 오답
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Betting grid */}
          <div>
            <h3 className="mb-2 font-display text-2xl">베팅카드 현황</h3>
            <BettingGrid betting={betting} mascots={mascots} teamColor={teamColor} />
          </div>
        </div>
      )}

      {/* PHASE 2 */}
      {game.status === "phase2" && (
        <div className="mt-6">
          <h3 className="font-display text-2xl">페이즈2 — 덱 빌딩</h3>
          <p className="text-muted-foreground">
            팀이 액션카드를 획득하고 공용 덱에 삽입합니다.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {teams.map((t, i) => (
              <div
                key={t.id}
                className="rounded-xl border-2 bg-card p-4 text-center"
                style={{ borderColor: TEAM_COLORS[i] }}
              >
                <p className="font-display text-lg" style={{ color: TEAM_COLORS[i] }}>
                  {t.name}
                </p>
                <p className="text-sm text-muted-foreground">자금 💰 {t.money}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PHASE 3 / finished */}
      {(game.status === "phase3" || game.status === "finished") && (
        <div className="mt-6">
          <h3 className="mb-3 font-display text-2xl">
            {game.status === "finished" ? "🏁 경주 종료" : "페이즈3 — 레이싱"}
          </h3>
          <HostTrack mascots={mascots} />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Panel title="팀 자금 & 순위">
              {[...teams]
                .sort((a, b) => b.money - a.money)
                .map((t, i) => (
                  <div key={t.id} className="flex justify-between py-1 text-sm">
                    <span>
                      {i + 1}. {t.name}
                    </span>
                    <span className="text-primary">💰 {t.money}</span>
                  </div>
                ))}
            </Panel>
            <Panel title="캐릭터 순위">
              {[...mascots]
                .sort((a, b) => b.position - a.position)
                .map((m) => (
                  <div key={m.id} className="flex items-center gap-2 py-1 text-sm">
                    <img src={CHARACTERS[m.name].image} className="h-6 w-6" alt={m.name} />
                    <span style={{ color: CHARACTERS[m.name].color }}>{m.name}</span>
                    <span className="ml-auto text-muted-foreground">
                      {m.is_eliminated ? "실격" : `${m.position}칸`}
                    </span>
                  </div>
                ))}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg bg-secondary px-3 py-2 text-sm font-bold transition hover:bg-primary hover:text-primary-foreground"
    >
      {children}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="mb-2 font-display text-lg">{title}</h4>
      {children}
    </div>
  );
}

function QuestionCard({ q }: { q: Question }) {
  return (
    <div className="rounded-2xl border-2 border-primary bg-card p-5">
      <p className="font-display text-2xl">{q.question_text}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["a", "b", "c", "d"] as const).map((k) => (
          <div key={k} className="rounded-lg bg-secondary px-3 py-2">
            <span className="font-display text-primary">{k.toUpperCase()}.</span>{" "}
            {q[`choice_${k}` as keyof Question] as string}
          </div>
        ))}
      </div>
    </div>
  );
}

function BettingGrid({
  betting,
  mascots,
  teamColor,
}: {
  betting: BettingCard[];
  mascots: Mascot[];
  teamColor: (id: string) => string;
}) {
  const mascotName = (id: string): MascotName =>
    (mascots.find((m) => m.id === id)?.name as MascotName) ?? "CHILI";
  return (
    <div className="space-y-3">
      {MASCOT_ORDER.map((mn) => {
        const cards = betting
          .filter((b) => mascotName(b.mascot_id) === mn)
          .sort((a, b) => a.target_rank - b.target_rank || Number(a.is_risky) - Number(b.is_risky));
        return (
          <div key={mn} className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <img src={CHARACTERS[mn].image} className="h-7 w-7" alt={mn} />
              <span className="font-display" style={{ color: CHARACTERS[mn].color }}>
                {mn}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {cards.map((c) => (
                <div
                  key={c.id}
                  className="rounded-md px-1 py-1 text-center text-[10px] font-bold"
                  style={{
                    backgroundColor: c.team_id ? teamColor(c.team_id) : "var(--secondary)",
                    color: c.team_id ? "#000" : "var(--muted-foreground)",
                  }}
                >
                  {c.target_rank}등<br />
                  {c.is_risky ? "RISK" : "SAFE"}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
