-- GAMES
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_code text UNIQUE NOT NULL,
  phase int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'waiting',
  current_turn_team_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TEAMS
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  name text NOT NULL,
  money int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.games
  ADD CONSTRAINT games_current_turn_team_fk
  FOREIGN KEY (current_turn_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

-- QUESTIONS
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  phase int NOT NULL DEFAULT 1,
  question_text text NOT NULL,
  choice_a text NOT NULL,
  choice_b text NOT NULL,
  choice_c text NOT NULL,
  choice_d text NOT NULL,
  correct_answer text NOT NULL,
  is_used boolean NOT NULL DEFAULT false
);

-- MASCOTS
CREATE TABLE public.mascots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  lane int NOT NULL DEFAULT 0,
  direction text NOT NULL DEFAULT 'forward',
  is_fallen boolean NOT NULL DEFAULT false,
  is_eliminated boolean NOT NULL DEFAULT false,
  final_rank int
);

-- BETTING CARDS
CREATE TABLE public.betting_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  mascot_id uuid NOT NULL REFERENCES public.mascots(id) ON DELETE CASCADE,
  target_rank int NOT NULL,
  is_risky boolean NOT NULL,
  is_resolved boolean NOT NULL DEFAULT false,
  payout int
);

-- ACTION CARDS
CREATE TABLE public.action_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  owner_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  target_mascot_id uuid REFERENCES public.mascots(id) ON DELETE CASCADE,
  card_type text NOT NULL,
  is_in_deck boolean NOT NULL DEFAULT false,
  is_revealed boolean NOT NULL DEFAULT false,
  reveal_order int,
  linked_question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL
);

-- BUZZER EVENTS
CREATE TABLE public.buzzer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  buzzed_at timestamptz NOT NULL DEFAULT now(),
  is_correct boolean
);

-- GRANTS (public classroom game, anon access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mascots TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.betting_cards TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_cards TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buzzer_events TO anon, authenticated;
GRANT ALL ON public.games, public.teams, public.questions, public.mascots, public.betting_cards, public.action_cards, public.buzzer_events TO service_role;

-- RLS: enable + open policies (no login; gated by knowing the game code)
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mascots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.betting_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buzzer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all_games" ON public.games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_teams" ON public.teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_questions" ON public.questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_mascots" ON public.mascots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_betting_cards" ON public.betting_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_action_cards" ON public.action_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_buzzer_events" ON public.buzzer_events FOR ALL USING (true) WITH CHECK (true);

-- REALTIME
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.teams REPLICA IDENTITY FULL;
ALTER TABLE public.mascots REPLICA IDENTITY FULL;
ALTER TABLE public.betting_cards REPLICA IDENTITY FULL;
ALTER TABLE public.action_cards REPLICA IDENTITY FULL;
ALTER TABLE public.buzzer_events REPLICA IDENTITY FULL;
ALTER TABLE public.questions REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mascots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.betting_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.action_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.buzzer_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.questions;