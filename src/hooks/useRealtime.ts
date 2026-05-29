import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to postgres changes on a table filtered by game_id and run a callback.
 * For the 'games' table itself, filters by id instead of game_id.
 */
export function useRealtime(table: string, gameId: string | null | undefined, onChange: () => void) {
  useEffect(() => {
    if (!gameId) return;

    // 'games' 테이블은 game_id 컬럼이 없고 id가 PK이므로 별도 처리
    const filter = table === "games" ? `id=eq.${gameId}` : `game_id=eq.${gameId}`;

    const channel = supabase
      .channel(`rt-${table}-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter,
        },
        () => onChange(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, gameId]);
}
