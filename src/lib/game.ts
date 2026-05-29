import { supabase } from "@/integrations/supabase/client";
import { MASCOT_ORDER, LANE_COUNT, TRACK_LENGTH, type MascotName } from "./characters";

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
export async function createGame(teamNames: string[], questions: QuestionInput[]): Promise<Game> {
  let code = generateGameCode();
  // ensure uniqueness (best effort)
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase.from("games").select("id").eq("game_code", code).maybeSingle();
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
  const { error: tErr } = await supabase.from("teams").insert(teamNames.map((name) => ({ game_id: gameId, name })));
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
  const { data } = await supabase.from("games").select("*").eq("game_code", code.trim().toUpperCase()).maybeSingle();
  return (data as Game) ?? null;
}

export function normalizeCode(input: string): string {
  let c = input.trim().toUpperCase();
  if (c && !c.startsWith("DASH-") && /^\d{4}$/.test(c)) c = `DASH-${c}`;
  return c;
}

// ─────────────────────────────────────────────
// ACTION CARD types & helpers
// ─────────────────────────────────────────────

export interface ActionCard {
  id: string;
  game_id: string;
  owner_team_id: string | null;
  target_mascot_id: string;
  card_type: string;
  is_in_deck: boolean;
  is_revealed: boolean;
  reveal_order: number | null;
  linked_question_id: string | null;
}

/** Seed action cards for a team based on how many questions they got right */
export async function grantActionCards(
  gameId: string,
  teamId: string,
  mascotIds: string[],
  count: number,
): Promise<void> {
  const types = [
    "FORWARD_1",
    "FORWARD_1",
    "FORWARD_2",
    "FORWARD_2",
    "FORWARD_3",
    "FALL_DOWN",
    "FALL_DOWN",
    "TURN_AROUND",
    "SWERVE",
    "STAR",
  ];
  const cards = [];
  for (let i = 0; i < count; i++) {
    const card_type = types[i % types.length];
    const target_mascot_id = mascotIds[Math.floor(Math.random() * mascotIds.length)];
    cards.push({ game_id: gameId, owner_team_id: teamId, target_mascot_id, card_type });
  }
  const { error } = await supabase.from("action_cards").insert(cards);
  if (error) throw error;
}

/** Put a card into the shared race deck */
export async function addCardToDeck(cardId: string, questionId: string | null): Promise<void> {
  const { error } = await supabase
    .from("action_cards")
    .update({ is_in_deck: true, linked_question_id: questionId })
    .eq("id", cardId);
  if (error) throw error;
}

/** Apply card effect to a mascot and handle collisions/elimination */
export async function applyCardEffect(
  gameId: string,
  cardId: string,
  mascot: Mascot,
  allMascots: Mascot[],
): Promise<{ message: string }> {
  // mark card as revealed
  const { data: cardData } = await supabase.from("action_cards").select("card_type").eq("id", cardId).single();
  if (!cardData) return { message: "카드 없음" };

  const cardType = cardData.card_type as string;
  let newPos = mascot.position;
  let newDirection = mascot.direction;
  let newLane = mascot.lane;
  let isFallen = mascot.is_fallen;
  let message = "";

  const moveAmount = mascot.is_fallen ? 1 : undefined;

  switch (cardType) {
    case "FORWARD_1": {
      const dist = moveAmount ?? 1;
      newPos = mascot.direction === "backward" ? mascot.position - dist : mascot.position + dist;
      message = `${mascot.name} ${dist}칸 전진!`;
      break;
    }
    case "FORWARD_2": {
      const dist = moveAmount ?? 2;
      newPos = mascot.direction === "backward" ? mascot.position - dist : mascot.position + dist;
      message = `${mascot.name} ${dist}칸 전진!`;
      break;
    }
    case "FORWARD_3": {
      const dist = moveAmount ?? 3;
      newPos = mascot.direction === "backward" ? mascot.position - dist : mascot.position + dist;
      message = `${mascot.name} ${dist}칸 전진!`;
      break;
    }
    case "FALL_DOWN":
      isFallen = true;
      message = `${mascot.name} 넘어짐! 💥`;
      break;
    case "TURN_AROUND":
      newDirection = mascot.direction === "forward" ? "backward" : "forward";
      message = `${mascot.name} 180도 방향전환! 🔄`;
      break;
    case "SWERVE": {
      const nextLane = (mascot.lane + 1) % LANE_COUNT;
      newLane = nextLane;
      message = `${mascot.name} 차선 변경! ↔️`;
      break;
    }
    case "STAR": {
      const isGreen = false; // individual card, not green multi
      newPos = isGreen ? mascot.position : TRACK_LENGTH - 1;
      message = `${mascot.name} 결승선 직전으로 순간이동! ⭐`;
      break;
    }
  }

  // Check elimination: off track
  let isEliminated = mascot.is_eliminated;
  if (newPos < 0) {
    isEliminated = true;
    message += " → 트랙 밖으로 실격!";
  }

  // Check collision with other mascots at newPos/newLane
  const collided = allMascots.find(
    (m) =>
      m.id !== mascot.id && !m.is_eliminated && m.position === newPos && m.lane === newLane && cardType !== "FALL_DOWN",
  );

  if (collided && !isEliminated) {
    if (collided.is_fallen) {
      // double fall = eliminate collided
      await supabase.from("mascots").update({ is_eliminated: true }).eq("id", collided.id);
      message += ` / ${collided.name} 충돌 실격!`;
    } else {
      // knock them down
      await supabase.from("mascots").update({ is_fallen: true }).eq("id", collided.id);
      message += ` / ${collided.name} 쓰러짐!`;
    }
  }

  // Clamp position
  if (newPos > TRACK_LENGTH) newPos = TRACK_LENGTH;

  // Update mascot
  await supabase
    .from("mascots")
    .update({
      position: newPos,
      direction: newDirection,
      lane: newLane,
      is_fallen: isFallen,
      is_eliminated: isEliminated,
    })
    .eq("id", mascot.id);

  // Mark card revealed
  await supabase.from("action_cards").update({ is_revealed: true }).eq("id", cardId);

  return { message };
}

/** Check if race is over: 3+ mascots finished or eliminated */
export function isRaceOver(mascots: Mascot[]): boolean {
  const done = mascots.filter((m) => m.is_eliminated || m.position >= TRACK_LENGTH).length;
  return done >= mascots.length - 1;
}

/** Advance turn to next team */
export async function advanceTurn(gameId: string, teams: Team[], currentTeamId: string | null): Promise<void> {
  const idx = teams.findIndex((t) => t.id === currentTeamId);
  const next = teams[(idx + 1) % teams.length];
  await supabase.from("games").update({ current_turn_team_id: next.id }).eq("id", gameId);
}

/** Resolve betting cards and pay out teams */
export async function resolveBetting(gameId: string, mascots: Mascot[]): Promise<void> {
  const { data: cards } = await supabase
    .from("betting_cards")
    .select("*")
    .eq("game_id", gameId)
    .eq("is_resolved", false)
    .not("team_id", "is", null);

  if (!cards) return;

  // Build rank map: sort by position desc (eliminated = last)
  const ranked = [...mascots].filter((m) => !m.is_eliminated).sort((a, b) => b.position - a.position);

  const rankMap: Record<string, number> = {};
  ranked.forEach((m, i) => {
    rankMap[m.id] = i + 1;
  });
  mascots
    .filter((m) => m.is_eliminated)
    .forEach((m) => {
      rankMap[m.id] = 4;
    });

  const SAFE_PAYOUTS = [10, 5, 2, 0];
  const RISKY_PAYOUTS = [15, 8, 3, 0];

  for (const card of cards as BettingCard[]) {
    const actualRank = rankMap[card.mascot_id] ?? 4;
    const correct = actualRank === card.target_rank;
    const payouts = card.is_risky ? RISKY_PAYOUTS : SAFE_PAYOUTS;
    const payout = correct ? payouts[card.target_rank - 1] : card.is_risky ? -3 : 0;

    await supabase.from("betting_cards").update({ is_resolved: true, payout }).eq("id", card.id);

    if (payout !== 0 && card.team_id) {
      const { data: teamData } = await supabase.from("teams").select("money").eq("id", card.team_id).single();
      if (teamData) {
        await supabase
          .from("teams")
          .update({ money: Math.max(0, teamData.money + payout) })
          .eq("id", card.team_id);
      }
    }
  }
}
