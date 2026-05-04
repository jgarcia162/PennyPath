export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_cache: {
        Row: {
          bill_calendar: Json | null
          bill_calendar_columns: Json | null
          payoff_plan_at: string | null
          payoff_plan_fingerprint: string | null
          payoff_plan_text: string | null
          payoff_plan_truncated: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bill_calendar?: Json | null
          bill_calendar_columns?: Json | null
          payoff_plan_at?: string | null
          payoff_plan_fingerprint?: string | null
          payoff_plan_text?: string | null
          payoff_plan_truncated?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bill_calendar?: Json | null
          bill_calendar_columns?: Json | null
          payoff_plan_at?: string | null
          payoff_plan_fingerprint?: string | null
          payoff_plan_text?: string | null
          payoff_plan_truncated?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          created_at: string | null
          date: string
          id: string
          note: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id: string
          note?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          note?: string
          user_id?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          apr_pct: number
          current: number
          deferred_amount: number
          deferred_expires_on: string
          deferred_months_remaining: number
          id: string
          ledger_status: string
          name: string
          paid_off: number
          user_id: string
        }
        Insert: {
          apr_pct?: number
          current?: number
          deferred_amount?: number
          deferred_expires_on?: string
          deferred_months_remaining?: number
          id: string
          ledger_status?: string
          name?: string
          paid_off?: number
          user_id: string
        }
        Update: {
          apr_pct?: number
          current?: number
          deferred_amount?: number
          deferred_expires_on?: string
          deferred_months_remaining?: number
          id?: string
          ledger_status?: string
          name?: string
          paid_off?: number
          user_id?: string
        }
        Relationships: []
      }
      deposit_history: {
        Row: {
          account_id: string
          amount: number
          at: string
          id: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          at: string
          id: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_plans: {
        Row: {
          cc_apr: number
          dashboard_view_month_ym: string
          debt_free_by: string
          debts_editor_sort: string
          debts_paid_off_lifetime_count: number
          debts_progress_sort: string
          efund_months: number
          fun_budget: number
          goal_hysa: number
          hysa_apy: number
          hysa_balance: number
          hysa_goal_by: string
          hysa_goal_by_ym: string
          interest_note: Json
          jose_savings: number
          labels: Json
          monthly_fixed_expenses: number
          monthly_take_home: number
          months_debt_payoff: number
          months_hysa_build: number
          months_to_debt_free: number
          months_to_hysa_goal: number
          net_worth_goal_k: number
          paycheck_amount: number
          paychecks_per_month: number
          phase1: Json
          phase2: Json
          phase2_hysa_result_k: number
          sherlyna_savings: number
          timeline_start: string | null
          updated_at: string | null
          user_id: string
          working_month_ym: string
        }
        Insert: {
          cc_apr?: number
          dashboard_view_month_ym?: string
          debt_free_by?: string
          debts_editor_sort?: string
          debts_paid_off_lifetime_count?: number
          debts_progress_sort?: string
          efund_months?: number
          fun_budget?: number
          goal_hysa?: number
          hysa_apy?: number
          hysa_balance?: number
          hysa_goal_by?: string
          hysa_goal_by_ym?: string
          interest_note?: Json
          jose_savings?: number
          labels?: Json
          monthly_fixed_expenses?: number
          monthly_take_home?: number
          months_debt_payoff?: number
          months_hysa_build?: number
          months_to_debt_free?: number
          months_to_hysa_goal?: number
          net_worth_goal_k?: number
          paycheck_amount?: number
          paychecks_per_month?: number
          phase1?: Json
          phase2?: Json
          phase2_hysa_result_k?: number
          sherlyna_savings?: number
          timeline_start?: string | null
          updated_at?: string | null
          user_id: string
          working_month_ym?: string
        }
        Update: {
          cc_apr?: number
          dashboard_view_month_ym?: string
          debt_free_by?: string
          debts_editor_sort?: string
          debts_paid_off_lifetime_count?: number
          debts_progress_sort?: string
          efund_months?: number
          fun_budget?: number
          goal_hysa?: number
          hysa_apy?: number
          hysa_balance?: number
          hysa_goal_by?: string
          hysa_goal_by_ym?: string
          interest_note?: Json
          jose_savings?: number
          labels?: Json
          monthly_fixed_expenses?: number
          monthly_take_home?: number
          months_debt_payoff?: number
          months_hysa_build?: number
          months_to_debt_free?: number
          months_to_hysa_goal?: number
          net_worth_goal_k?: number
          paycheck_amount?: number
          paychecks_per_month?: number
          phase1?: Json
          phase2?: Json
          phase2_hysa_result_k?: number
          sherlyna_savings?: number
          timeline_start?: string | null
          updated_at?: string | null
          user_id?: string
          working_month_ym?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number
          at: string
          debt_id: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          at: string
          debt_id: string
          id: string
          user_id: string
        }
        Update: {
          amount?: number
          at?: string
          debt_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_accounts: {
        Row: {
          apy_pct: number
          count_towards_goal: boolean
          current: number
          goal_ids: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          apy_pct?: number
          count_towards_goal?: boolean
          current?: number
          goal_ids?: Json
          id: string
          name?: string
          user_id: string
        }
        Update: {
          apy_pct?: number
          count_towards_goal?: boolean
          current?: number
          goal_ids?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          goal_by_ym: string
          id: string
          name: string
          target_amount: number
          user_id: string
        }
        Insert: {
          goal_by_ym?: string
          id: string
          name: string
          target_amount?: number
          user_id: string
        }
        Update: {
          goal_by_ym?: string
          id?: string
          name?: string
          target_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      financial_plan_state: {
        Row: {
          badges: Json
          month_wrap_archives: Json
          month_wrap_rollback: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          badges?: Json
          month_wrap_archives?: Json
          month_wrap_rollback?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          badges?: Json
          month_wrap_archives?: Json
          month_wrap_rollback?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
