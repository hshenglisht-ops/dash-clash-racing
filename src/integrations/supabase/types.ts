export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      action_cards: {
        Row: {
          card_type: string;
          game_id: string;
          id: string;
          is_in_deck: boolean;
          is_revealed: boolean;
          linked_question_id: string | null;
          owner_team_id: string | null;
          reveal_order: number | null;
          target_mascot_id: string | null;
        };
        Insert: {
          card_type: string;
          game_id: string;
          id?: string;
          is_in_deck?: boolean;
          is_revealed?: boolean;
          linked_question_id?: string | null;
          owner_team_id?: string | null;
          reveal_order?: number | null;
          target_mascot_id?: string | null;
        };
        Update: {
          card_type?: string;
          game_id?: string;
          id?: string;
          is_in_deck?: boolean;
          is_revealed?: boolean;
          linked_question_id?: string | null;
          owner_team_id?: string | null;
          reveal_order?: number | null;
          target_mascot_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "action_cards_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "action_cards_linked_question_id_fkey";
            columns: ["linked_question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "action_cards_owner_team_id_fkey";
            columns: ["owner_team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "action_cards_target_mascot_id_fkey";
            columns: ["target_mascot_id"];
            isOneToOne: false;
            referencedRelation: "mascots";
            referencedColumns: ["id"];
          },
        ];
      };
      betting_cards: {
        Row: {
          game_id: string;
          id: string;
          is_resolved: boolean;
          is_risky: boolean;
          mascot_id: string;
          payout: number | null;
          target_rank: number;
          team_id: string | null;
        };
        Insert: {
          game_id: string;
          id?: string;
          is_resolved?: boolean;
          is_risky: boolean;
          mascot_id: string;
          payout?: number | null;
          target_rank: number;
          team_id?: string | null;
        };
        Update: {
          game_id?: string;
          id?: string;
          is_resolved?: boolean;
          is_risky?: boolean;
          mascot_id?: string;
          payout?: number | null;
          target_rank?: number;
          team_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "betting_cards_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "betting_cards_mascot_id_fkey";
            columns: ["mascot_id"];
            isOneToOne: false;
            referencedRelation: "mascots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "betting_cards_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      buzzer_events: {
        Row: {
          buzzed_at: string;
          game_id: string;
          id: string;
          is_correct: boolean | null;
          question_id: string;
          selected_answer: string | null;
          team_id: string;
        };
        Insert: {
          buzzed_at?: string;
          game_id: string;
          id?: string;
          is_correct?: boolean | null;
          question_id: string;
          selected_answer?: string | null;
          team_id: string;
        };
        Update: {
          buzzed_at?: string;
          game_id?: string;
          id?: string;
          is_correct?: boolean | null;
          question_id?: string;
          selected_answer?: string | null;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "buzzer_events_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buzzer_events_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buzzer_events_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      games: {
        Row: {
          active_question_id: string | null;
          created_at: string;
          current_turn_team_id: string | null;
          game_code: string;
          id: string;
          phase: number;
          status: string;
        };
        Insert: {
          active_question_id?: string | null;
          created_at?: string;
          current_turn_team_id?: string | null;
          game_code: string;
          id?: string;
          phase?: number;
          status?: string;
        };
        Update: {
          active_question_id?: string | null;
          created_at?: string;
          current_turn_team_id?: string | null;
          game_code?: string;
          id?: string;
          phase?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "games_current_turn_team_fk";
            columns: ["current_turn_team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      mascots: {
        Row: {
          direction: string;
          final_rank: number | null;
          game_id: string;
          id: string;
          is_eliminated: boolean;
          is_fallen: boolean;
          lane: number;
          name: string;
          position: number;
        };
        Insert: {
          direction?: string;
          final_rank?: number | null;
          game_id: string;
          id?: string;
          is_eliminated?: boolean;
          is_fallen?: boolean;
          lane?: number;
          name: string;
          position?: number;
        };
        Update: {
          direction?: string;
          final_rank?: number | null;
          game_id?: string;
          id?: string;
          is_eliminated?: boolean;
          is_fallen?: boolean;
          lane?: number;
          name?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "mascots_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          choice_a: string;
          choice_b: string;
          choice_c: string;
          choice_d: string;
          correct_answer: string;
          game_id: string;
          id: string;
          is_used: boolean;
          phase: number;
          question_text: string;
        };
        Insert: {
          choice_a: string;
          choice_b: string;
          choice_c: string;
          choice_d: string;
          correct_answer: string;
          game_id: string;
          id?: string;
          is_used?: boolean;
          phase?: number;
          question_text: string;
        };
        Update: {
          choice_a?: string;
          choice_b?: string;
          choice_c?: string;
          choice_d?: string;
          correct_answer?: string;
          game_id?: string;
          id?: string;
          is_used?: boolean;
          phase?: number;
          question_text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          created_at: string;
          game_id: string;
          id: string;
          money: number;
          name: string;
        };
        Insert: {
          created_at?: string;
          game_id: string;
          id?: string;
          money?: number;
          name: string;
        };
        Update: {
          created_at?: string;
          game_id?: string;
          id?: string;
          money?: number;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
