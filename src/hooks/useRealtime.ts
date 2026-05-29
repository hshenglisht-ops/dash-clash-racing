import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to postgres changes on a table filtered by game_id and run a callback.
 * The callback typically re-fetches the relevant data.
 */
export function useRealtime(
  table: string,
  gameId: string | null | undefined,
  onChange: () => void,
) {
  useEffect(() => {
    if (!gameId) return;
    const channel = supabase
      .channel(`rt-${table}-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `game_id=eq.${gameId}`,
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
