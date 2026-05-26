// ─────────────────────────────────────────────────────────────────────────────
// THE BOARDROOM BRIEF — Supabase Database types
//
// Reflects the schema defined in supabase/migrations/.
// Re-generate after schema changes with:
//   npx supabase gen types typescript --project-id otvjntgoeypqvvapmwbk > app/lib/supabase/types.ts
//
// NOTE: @supabase/supabase-js ≥2.49 requires `Relationships: []` on every
// table — without it Row/Insert types resolve to `never`.
// ─────────────────────────────────────────────────────────────────────────────

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id:                     string
          email:                  string
          display_name:           string | null
          plan:                   string
          country_code:           string | null
          created_at:             string
          stripe_customer_id:     string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          id:                      string
          email:                   string
          display_name?:           string | null
          plan?:                   string
          country_code?:           string | null
          created_at?:             string
          stripe_customer_id?:     string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          id?:                     string
          email?:                  string
          display_name?:           string | null
          plan?:                   string
          country_code?:           string | null
          created_at?:             string
          stripe_customer_id?:     string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          id: string
          email: string
          confirmed: boolean
          confirmation_token: string | null
          plan: string
          segments: string[] | null
          source: string | null
          subscribed_at: string
          unsubscribed_at: string | null
        }
        Insert: {
          id?: string
          email: string
          confirmed?: boolean
          confirmation_token?: string | null
          plan?: string
          segments?: string[] | null
          source?: string | null
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          confirmed?: boolean
          confirmation_token?: string | null
          plan?: string
          segments?: string[] | null
          source?: string | null
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      article_views: {
        Row: {
          id: string
          article_sanity_id: string
          user_id: string | null
          session_id: string | null
          read_pct: number | null
          created_at: string
        }
        Insert: {
          id?: string
          article_sanity_id: string
          user_id?: string | null
          session_id?: string | null
          read_pct?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          article_sanity_id?: string
          user_id?: string | null
          session_id?: string | null
          read_pct?: number | null
          created_at?: string
        }
        Relationships: []
      }
      market_cache: {
        Row: {
          id: string
          symbol: string
          name: string
          price: number | null
          change_pct: number | null
          economy_id: string | null
          sparkline_7d: number[] | null
          pulled_at: string
        }
        Insert: {
          id?: string
          symbol: string
          name: string
          price?: number | null
          change_pct?: number | null
          economy_id?: string | null
          sparkline_7d?: number[] | null
          pulled_at?: string
        }
        Update: {
          id?: string
          symbol?: string
          name?: string
          price?: number | null
          change_pct?: number | null
          economy_id?: string | null
          sparkline_7d?: number[] | null
          pulled_at?: string
        }
        Relationships: []
      }
      newsletter_sends: {
        Row: {
          id:               string
          sent_at:          string
          edition_date:     string
          article_ids:      string[]
          subscriber_count: number
          success_count:    number
          failure_count:    number
        }
        Insert: {
          id?:               string
          sent_at?:          string
          edition_date:      string
          article_ids?:      string[]
          subscriber_count?: number
          success_count?:    number
          failure_count?:    number
        }
        Update: {
          id?:               string
          sent_at?:          string
          edition_date?:     string
          article_ids?:      string[]
          subscriber_count?: number
          success_count?:    number
          failure_count?:    number
        }
        Relationships: []
      }
      claude_usage: {
        Row: {
          id:             string
          called_from:    string
          model:          string
          input_tokens:   number
          output_tokens:  number
          estimated_cost: number
          created_at:     string
        }
        Insert: {
          id?:             string
          called_from:     string
          model:           string
          input_tokens?:   number
          output_tokens?:  number
          estimated_cost?: number
          created_at?:     string
        }
        Update: {
          id?:             string
          called_from?:    string
          model?:          string
          input_tokens?:   number
          output_tokens?:  number
          estimated_cost?: number
          created_at?:     string
        }
        Relationships: []
      }
      social_queue: {
        Row: {
          id:             string
          article_id:     string
          platform:       string
          content:        string
          scheduled_for:  string
          posted_at:      string | null
          buffer_post_id: string | null
          created_at:     string
        }
        Insert: {
          id?:             string
          article_id:      string
          platform:        string
          content:         string
          scheduled_for:   string
          posted_at?:      string | null
          buffer_post_id?: string | null
          created_at?:     string
        }
        Update: {
          id?:             string
          article_id?:     string
          platform?:       string
          content?:        string
          scheduled_for?:  string
          posted_at?:      string | null
          buffer_post_id?: string | null
          created_at?:     string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          id:         string
          name:       string
          email:      string
          subject:    string
          message:    string
          ip_hash:    string
          replied_at: string | null
          created_at: string
        }
        Insert: {
          id?:         string
          name:        string
          email:       string
          subject:     string
          message:     string
          ip_hash?:    string
          replied_at?: string | null
          created_at?: string
        }
        Update: {
          id?:         string
          name?:       string
          email?:      string
          subject?:    string
          message?:    string
          ip_hash?:    string
          replied_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views:          { [_ in never]: never }
    Functions:      { [_ in never]: never }
    Enums:          { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
