// Typed schema for the OHRR Supabase backend.
//
// HAND-AUTHORED to mirror supabase/migrations/20260627052536_hopshop_backend.sql
// (the schema already applied to the live project). The Supabase CLI's
// `gen types` needs the project ref + an access token, which aren't in the repo;
// once those are available, regenerate with `npm run gen:types` and replace this
// file so it stays authoritative. Keep it in sync with the migration until then.

export type MembershipRole = 'owner' | 'admin' | 'staff'
export type MembershipStatus = 'active' | 'disabled'
export type InviteKind = 'master' | 'worker'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      memberships: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: MembershipRole
          status: MembershipStatus
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          role?: MembershipRole
          status?: MembershipStatus
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          role?: MembershipRole
          status?: MembershipStatus
          created_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: { key: string; area: string; description: string }
        Insert: { key: string; area: string; description: string }
        Update: { key?: string; area?: string; description?: string }
        Relationships: []
      }
      membership_permissions: {
        Row: {
          membership_id: string
          permission_key: string
          granted_by: string | null
          granted_at: string
        }
        Insert: {
          membership_id: string
          permission_key: string
          granted_by?: string | null
          granted_at?: string
        }
        Update: {
          membership_id?: string
          permission_key?: string
          granted_by?: string | null
          granted_at?: string
        }
        Relationships: []
      }
      permission_presets: {
        Row: { preset: string; permission_key: string }
        Insert: { preset: string; permission_key: string }
        Update: { preset?: string; permission_key?: string }
        Relationships: []
      }
      invite_codes: {
        Row: {
          id: string
          code: string
          org_id: string
          kind: InviteKind
          role: MembershipRole
          capabilities: string[]
          preset: string | null
          max_uses: number
          used_count: number
          expires_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          org_id: string
          kind?: InviteKind
          role?: MembershipRole
          capabilities?: string[]
          preset?: string | null
          max_uses?: number
          used_count?: number
          expires_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          org_id?: string
          kind?: InviteKind
          role?: MembershipRole
          capabilities?: string[]
          preset?: string | null
          max_uses?: number
          used_count?: number
          expires_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          org_id: string | null
          actor_user_id: string | null
          action: string
          target_type: string | null
          target_id: string | null
          detail: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          actor_user_id?: string | null
          action: string
          target_type?: string | null
          target_id?: string | null
          detail?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string | null
          actor_user_id?: string | null
          action?: string
          target_type?: string | null
          target_id?: string | null
          detail?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          id: string
          org_id: string
          title: string
          body: string
          is_published: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          title: string
          body: string
          is_published?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          title?: string
          body?: string
          is_published?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      raffle_items: {
        Row: {
          id: string
          org_id: string
          event_slug: string
          title: string
          description: string | null
          donated_by: string | null
          value_cents: number | null
          photo_url: string | null
          session: string
          closes_at: string | null
          status: string
          is_published: boolean
          sort_order: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          event_slug?: string
          title: string
          description?: string | null
          donated_by?: string | null
          value_cents?: number | null
          photo_url?: string | null
          session?: string
          closes_at?: string | null
          status?: string
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          event_slug?: string
          title?: string
          description?: string | null
          donated_by?: string | null
          value_cents?: number | null
          photo_url?: string | null
          session?: string
          closes_at?: string | null
          status?: string
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      volunteer_opportunities: {
        Row: {
          id: string
          org_id: string
          category: string
          title: string
          detail: string | null
          when_text: string | null
          where_text: string | null
          spots: string | null
          is_published: boolean
          sort_order: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          category: string
          title: string
          detail?: string | null
          when_text?: string | null
          where_text?: string | null
          spots?: string | null
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          category?: string
          title?: string
          detail?: string | null
          when_text?: string | null
          where_text?: string | null
          spots?: string | null
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      care_articles: {
        Row: {
          id: string
          org_id: string
          slug: string
          title: string
          icon: string
          summary: string
          body: string
          tip: string | null
          sort_order: number
          is_published: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          slug: string
          title: string
          icon?: string
          summary?: string
          body?: string
          tip?: string | null
          sort_order?: number
          is_published?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          slug?: string
          title?: string
          icon?: string
          summary?: string
          body?: string
          tip?: string | null
          sort_order?: number
          is_published?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      rabbits: {
        Row: {
          id: string
          org_id: string
          name: string
          status: string
          sex: string | null
          age: string | null
          breed: string | null
          size: string | null
          spayed_neutered: boolean
          house_trained: boolean
          bonded: boolean
          description: string | null
          tags: string[]
          photos: string[]
          sort_order: number
          is_published: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          status?: string
          sex?: string | null
          age?: string | null
          breed?: string | null
          size?: string | null
          spayed_neutered?: boolean
          house_trained?: boolean
          bonded?: boolean
          description?: string | null
          tags?: string[]
          photos?: string[]
          sort_order?: number
          is_published?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          status?: string
          sex?: string | null
          age?: string | null
          breed?: string | null
          size?: string | null
          spayed_neutered?: boolean
          house_trained?: boolean
          bonded?: boolean
          description?: string | null
          tags?: string[]
          photos?: string[]
          sort_order?: number
          is_published?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hopshop_products: {
        Row: {
          id: string
          org_id: string
          name: string
          description: string | null
          price_cents: number
          sku: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          description?: string | null
          price_cents?: number
          sku?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          description?: string | null
          price_cents?: number
          sku?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hopshop_inventory: {
        Row: {
          product_id: string
          org_id: string
          quantity: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          product_id: string
          org_id: string
          quantity?: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          product_id?: string
          org_id?: string
          quantity?: number
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_org_member: {
        Args: { p_org: string }
        Returns: boolean
      }
      has_permission: {
        Args: { p_org: string; p_key: string }
        Returns: boolean
      }
      redeem_master_code: {
        Args: { p_code: string }
        Returns: string
      }
      create_invite_code: {
        Args: {
          p_org: string
          p_role: MembershipRole
          p_capabilities: string[]
          p_preset: string | null
          p_max_uses?: number
          p_expires_at?: string
        }
        Returns: string
      }
      redeem_invite_code: {
        Args: { p_code: string }
        Returns: string
      }
      set_membership_permission: {
        Args: { p_membership: string; p_key: string; p_grant: boolean }
        Returns: undefined
      }
      set_membership_status: {
        Args: { p_membership: string; p_status: MembershipStatus }
        Returns: undefined
      }
      list_org_members: {
        Args: { p_org: string }
        Returns: {
          membership_id: string
          user_id: string
          email: string
          role: MembershipRole
          status: MembershipStatus
          created_at: string
        }[]
      }
      set_rabbit_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
    }
    Enums: {
      membership_role: MembershipRole
      membership_status: MembershipStatus
      invite_kind: InviteKind
    }
    CompositeTypes: Record<string, never>
  }
}
