import { supabase } from "@/integrations/supabase/client";
import { MASCOT_ORDER, type MascotName } from "./characters";

export interface Game {
  id: string;
  game_code: string;
  phase: number;
  status: string;
  current_turn_team_id: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  game_id: string;
  name: string;
  money: number;
  created_at: string;
}

export interface Mascot {
  id: string;
  game_id: string;
  name: MascotName;
  position: number;
  lane: number;
  direction: string;
  is_fallen: boolean;
  is_eliminated: boolean;
  final_rank: number | null;
}

export interface Question {
  id: string;
  game_id: string;
  phase: number;
  question_text: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_answer: string;
  is_used: boolean;
}

export interface BettingCard {
  id: string;
  game_id: string;
  team_id: string | null;
  mascot_id: string;
  target_rank: number;
  is_risky: boolean;
  is_resolved: boolean;
  payout: number | null;
}

export interface QuestionInput {
  question_text: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_answer: string;
  phase?: number;
}

export function generateGameCode(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `DASH-${n}`;
}

/**
 * Creates a game with teams, mascots, betting cards and seeded questions.
 * Returns the created game row.
 */
export async function createGame(
  teamNames: string[],
  questions: QuestionInput[],
): Promise<Game> {
  let code = generateGameCode();
  // ensure uniqueness (best effort)
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from("games")
      .select("id")
      .eq("game_code", code)
      .maybeSingle();
    if (!existing) break;
    code = generateGameCode();
  }

  const { data: game, error: gErr } = await supabase
    .from("games")
    .insert({ game_code: code, phase: 1, status: "waiting" })
    .select()
    .single();
  if (gErr || !game) throw gErr ?? new Error("게임 생성 실패");

  const gameId = game.id;

  // Teams
  const { error: tErr } = await supabase
    .from("teams")
    .insert(teamNames.map((name) => ({ game_id: gameId, name })));
  if (tErr) throw tErr;

  // Mascots
  const { data: mascots, error: mErr } = await supabase
    .from("mascots")
    .insert(
      MASCOT_ORDER.map((name, i) => ({
        game_id: gameId,
        name,
        position: 0,
        lane: i,
      })),
    )
    .select();
  if (mErr || !mascots) throw mErr ?? new Error("마스코트 생성 실패");

  // Betting cards: 4 mascots × 4 ranks × SAFE/RISKY = 32
  const betting: Array<{
    game_id: string;
    mascot_id: string;
    target_rank: number;
    is_risky: boolean;
  }> = [];
  for (const m of mascots) {
    for (let rank = 1; rank <= 4; rank++) {
      for (const risky of [false, true]) {
        betting.push({
          game_id: gameId,
          mascot_id: m.id,
          target_rank: rank,
          is_risky: risky,
        });
      }
    }
  }
  const { error: bErr } = await supabase.from("betting_cards").insert(betting);
  if (bErr) throw bErr;

  // Questions
  if (questions.length > 0) {
    const { error: qErr } = await supabase.from("questions").insert(
      questions.map((q) => ({
        game_id: gameId,
        phase: q.phase ?? 1,
        question_text: q.question_text,
        choice_a: q.choice_a,
        choice_b: q.choice_b,
        choice_c: q.choice_c,
        choice_d: q.choice_d,
        correct_answer: q.correct_answer.toUpperCase(),
      })),
    );
    if (qErr) throw qErr;
  }

  return game as Game;
}

export async function getGameByCode(code: string): Promise<Game | null> {
  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("game_code", code.trim().toUpperCase())
    .maybeSingle();
  return (data as Game) ?? null;
}

export function normalizeCode(input: string): string {
  let c = input.trim().toUpperCase();
  if (c && !c.startsWith("DASH-") && /^\d{4}$/.test(c)) c = `DASH-${c}`;
  return c;
}
