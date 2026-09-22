// Typed schema for the OHRR Supabase backend.
//
// HAND-AUTHORED to mirror the migrations under supabase/migrations/ (hopshop
// backend, announcements, volunteer_opportunities, care_articles, rabbits,
// events, vets, hero_slides, raffle_items/auction_settings, sponsors, app_settings)
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
          // Team profile (supabase/migrations/20260922140000_volunteers_and_event_content.sql)
          display_name: string | null
          title: string | null
          photo_url: string | null
          show_on_about: boolean
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
          // Who it was meant for (20260922140000_*.sql)
          invitee_name: string | null
          invitee_email: string | null
          invitee_phone: string | null
          position_note: string | null
          note: string | null
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
          invitee_name?: string | null
          invitee_email?: string | null
          invitee_phone?: string | null
          position_note?: string | null
          note?: string | null
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
          invitee_name?: string | null
          invitee_email?: string | null
          invitee_phone?: string | null
          position_note?: string | null
          note?: string | null
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
          // supabase/migrations/20260917160000_announcements_image.sql
          image_url: string | null
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
          image_url?: string | null
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
          image_url?: string | null
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
          status?: string
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      auction_settings: {
        Row: {
          org_id: string
          event_slug: string
          morning_closes_at: string | null
          afternoon_closes_at: string | null
          intro_text: string | null
          raffle_ticket_price_cents: number | null
          raffle_bundle_qty: number | null
          raffle_bundle_price_cents: number | null
          raffle_details: string | null
          updated_at: string
        }
        Insert: {
          org_id: string
          event_slug?: string
          morning_closes_at?: string | null
          afternoon_closes_at?: string | null
          intro_text?: string | null
          raffle_ticket_price_cents?: number | null
          raffle_bundle_qty?: number | null
          raffle_bundle_price_cents?: number | null
          raffle_details?: string | null
          updated_at?: string
        }
        Update: {
          org_id?: string
          event_slug?: string
          morning_closes_at?: string | null
          afternoon_closes_at?: string | null
          intro_text?: string | null
          raffle_ticket_price_cents?: number | null
          raffle_bundle_qty?: number | null
          raffle_bundle_price_cents?: number | null
          raffle_details?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          org_id: string
          key: string
          value: Json
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          org_id: string
          key: string
          value?: Json
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          org_id?: string
          key?: string
          value?: Json
          updated_by?: string | null
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
          // How many can take it on (supabase/migrations/20260922140000_*.sql)
          limit_kind: 'none' | 'people' | 'hours'
          limit_people: number | null
          limit_hours: number | null
          filled_people: number
          filled_hours: number
          contact_email: string | null
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
          limit_kind?: 'none' | 'people' | 'hours'
          limit_people?: number | null
          limit_hours?: number | null
          filled_people?: number
          filled_hours?: number
          contact_email?: string | null
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
          limit_kind?: 'none' | 'people' | 'hours'
          limit_people?: number | null
          limit_hours?: number | null
          filled_people?: number
          filled_hours?: number
          contact_email?: string | null
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
          /** 'care' (Learn) | 'give' | 'about' | 'adopt' — absent until 20260921120000_site_pages.sql runs */
          section?: 'care' | 'give' | 'about' | 'adopt' | 'volunteer'
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
          section?: 'care' | 'give' | 'about' | 'adopt' | 'volunteer'
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
          section?: 'care' | 'give' | 'about' | 'adopt' | 'volunteer'
          sort_order?: number
          is_published?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      // Bunny Help topics — mirrors supabase/migrations/20260917140000_care_topics.sql
      care_topics: {
        Row: {
          id: string
          org_id: string
          slug: string
          title: string
          aliases: string[]
          category: string
          urgency: string
          summary: string
          what_to_do: string
          article_slug: string | null
          show_vets: boolean
          hopshop_note: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          is_published: boolean
          sort_order: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          slug: string
          title: string
          aliases?: string[]
          category: string
          urgency: string
          summary?: string
          what_to_do?: string
          article_slug?: string | null
          show_vets?: boolean
          hopshop_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          slug?: string
          title?: string
          aliases?: string[]
          category?: string
          urgency?: string
          summary?: string
          what_to_do?: string
          article_slug?: string | null
          show_vets?: boolean
          hopshop_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          is_published?: boolean
          sort_order?: number
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
      events: {
        Row: {
          id: string
          org_id: string
          slug: string
          title: string
          starts_at: string
          ends_at: string | null
          venue: string | null
          address: string | null
          city: string | null
          summary: string | null
          body: string | null
          theme: string | null
          // Picture + the per-year facts, out of the code (20260922140000_*.sql)
          image_url: string | null
          info: Json
          url: string | null
          is_published: boolean
          sort_order: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          slug: string
          title: string
          starts_at: string
          ends_at?: string | null
          venue?: string | null
          address?: string | null
          city?: string | null
          summary?: string | null
          body?: string | null
          theme?: string | null
          image_url?: string | null
          info?: Json
          url?: string | null
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          slug?: string
          title?: string
          starts_at?: string
          ends_at?: string | null
          venue?: string | null
          address?: string | null
          city?: string | null
          summary?: string | null
          body?: string | null
          theme?: string | null
          image_url?: string | null
          info?: Json
          url?: string | null
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      vets: {
        Row: {
          id: string
          org_id: string
          name: string
          doctors: string | null
          address: string | null
          city: string | null
          region: string
          phone: string | null
          phone2: string | null
          email: string | null
          website: string | null
          notes: string | null
          is_emergency: boolean
          is_low_cost_spay: boolean
          is_published: boolean
          sort_order: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          doctors?: string | null
          address?: string | null
          city?: string | null
          region: string
          phone?: string | null
          phone2?: string | null
          email?: string | null
          website?: string | null
          notes?: string | null
          is_emergency?: boolean
          is_low_cost_spay?: boolean
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          doctors?: string | null
          address?: string | null
          city?: string | null
          region?: string
          phone?: string | null
          phone2?: string | null
          email?: string | null
          website?: string | null
          notes?: string | null
          is_emergency?: boolean
          is_low_cost_spay?: boolean
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hero_slides: {
        Row: {
          id: string
          org_id: string
          placement: string
          headline: string
          subline: string | null
          image_url: string | null
          cta_label: string | null
          cta_url: string | null
          starts_at: string | null
          ends_at: string | null
          is_published: boolean
          sort_order: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          placement?: string
          headline: string
          subline?: string | null
          image_url?: string | null
          cta_label?: string | null
          cta_url?: string | null
          starts_at?: string | null
          ends_at?: string | null
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          placement?: string
          headline?: string
          subline?: string | null
          image_url?: string | null
          cta_label?: string | null
          cta_url?: string | null
          starts_at?: string | null
          ends_at?: string | null
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      // --- Sponsors (mirrors supabase/migrations/20260917150000_sponsors.sql) ---
      sponsors: {
        Row: {
          id: string
          org_id: string
          name: string
          tier: string
          blurb: string | null
          logo_url: string | null
          website: string | null
          perk_title: string | null
          perk_detail: string | null
          perk_code: string | null
          term_start: string | null
          term_end: string | null
          /** Warn staff this many days before term_end. */
          remind_days: number
          is_active: boolean
          sort_order: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          tier?: string
          blurb?: string | null
          logo_url?: string | null
          website?: string | null
          perk_title?: string | null
          perk_detail?: string | null
          perk_code?: string | null
          term_start?: string | null
          term_end?: string | null
          remind_days?: number
          is_active?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          tier?: string
          blurb?: string | null
          logo_url?: string | null
          website?: string | null
          perk_title?: string | null
          perk_detail?: string | null
          perk_code?: string | null
          term_start?: string | null
          term_end?: string | null
          remind_days?: number
          is_active?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sponsor_placements: {
        Row: {
          id: string
          org_id: string
          sponsor_id: string
          surface: string
          starts_at: string | null
          ends_at: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          sponsor_id: string
          surface: string
          starts_at?: string | null
          ends_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          sponsor_id?: string
          surface?: string
          starts_at?: string | null
          ends_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      // --- end Sponsors ---
      hopshop_products: {
        Row: {
          id: string
          org_id: string
          name: string
          description: string | null
          price_cents: number
          sku: string | null
          is_active: boolean
          photo_url: string | null
          // Stock card (supabase/migrations/20260922110000_hopshop_suppliers.sql)
          supplier_id: string | null
          supplier_sku: string | null
          cost_cents: number | null
          unit: string | null
          category: string | null
          shelf: string | null
          reorder_point: number | null
          reorder_qty: number | null
          on_order_qty: number
          ordered_at: string | null
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
          photo_url?: string | null
          supplier_id?: string | null
          supplier_sku?: string | null
          cost_cents?: number | null
          unit?: string | null
          category?: string | null
          shelf?: string | null
          reorder_point?: number | null
          reorder_qty?: number | null
          on_order_qty?: number
          ordered_at?: string | null
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
          photo_url?: string | null
          supplier_id?: string | null
          supplier_sku?: string | null
          cost_cents?: number | null
          unit?: string | null
          category?: string | null
          shelf?: string | null
          reorder_point?: number | null
          reorder_qty?: number | null
          on_order_qty?: number
          ordered_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      // Suppliers and BunFest vendors, one list (supabase/migrations/20260922110000_hopshop_suppliers.sql)
      suppliers: {
        Row: {
          id: string
          org_id: string
          name: string
          is_supplier: boolean
          is_vendor: boolean
          contact_name: string | null
          email: string | null
          phone: string | null
          website: string | null
          address: string | null
          account_number: string | null
          order_how: 'website' | 'email' | 'phone' | 'rep' | 'in_person' | null
          order_notes: string | null
          lead_days: number | null
          min_order: string | null
          notes: string | null
          is_active: boolean
          // The BunFest booth (supabase/migrations/20260922120000_bunfest_content.sql)
          vendor_category: string | null
          vendor_blurb: string | null
          vendor_booth: string | null
          vendor_room: 'burgundy' | 'emerald' | null
          vendor_tables: number
          vendor_published: boolean
          vendor_sort: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          is_supplier?: boolean
          is_vendor?: boolean
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          website?: string | null
          address?: string | null
          account_number?: string | null
          order_how?: 'website' | 'email' | 'phone' | 'rep' | 'in_person' | null
          order_notes?: string | null
          lead_days?: number | null
          min_order?: string | null
          notes?: string | null
          is_active?: boolean
          vendor_category?: string | null
          vendor_blurb?: string | null
          vendor_booth?: string | null
          vendor_room?: 'burgundy' | 'emerald' | null
          vendor_tables?: number
          vendor_published?: boolean
          vendor_sort?: number
          created_by?: string | null
        }
        Update: {
          name?: string
          is_supplier?: boolean
          is_vendor?: boolean
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          website?: string | null
          address?: string | null
          account_number?: string | null
          order_how?: 'website' | 'email' | 'phone' | 'rep' | 'in_person' | null
          order_notes?: string | null
          lead_days?: number | null
          min_order?: string | null
          notes?: string | null
          is_active?: boolean
          vendor_category?: string | null
          vendor_blurb?: string | null
          vendor_booth?: string | null
          vendor_room?: 'burgundy' | 'emerald' | null
          vendor_tables?: number
          vendor_published?: boolean
          vendor_sort?: number
        }
        Relationships: []
      }
      // Midwest BunFest content staff edit (supabase/migrations/20260922120000_bunfest_content.sql)
      bunfest_sessions: {
        Row: {
          id: string
          org_id: string
          year: number
          start_time: string
          end_time: string | null
          title: string
          presenter: string | null
          description: string | null
          room: string | null
          kind: 'session' | 'break' | 'activity'
          is_published: boolean
          sort_order: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          year?: number
          start_time: string
          end_time?: string | null
          title: string
          presenter?: string | null
          description?: string | null
          room?: string | null
          kind?: 'session' | 'break' | 'activity'
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
        }
        Update: {
          year?: number
          start_time?: string
          end_time?: string | null
          title?: string
          presenter?: string | null
          description?: string | null
          room?: string | null
          kind?: 'session' | 'break' | 'activity'
          is_published?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      rescue_partners: {
        Row: {
          id: string
          org_id: string
          name: string
          location: string | null
          city: string | null
          state: string | null
          region: 'Midwest' | 'Northeast' | 'South' | 'West' | null
          phone: string | null
          email: string | null
          address: string | null
          website: string | null
          blurb: string | null
          is_host: boolean
          at_bunfest: boolean
          is_published: boolean
          sort_order: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          location?: string | null
          city?: string | null
          state?: string | null
          region?: 'Midwest' | 'Northeast' | 'South' | 'West' | null
          phone?: string | null
          email?: string | null
          address?: string | null
          website?: string | null
          blurb?: string | null
          is_host?: boolean
          at_bunfest?: boolean
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
        }
        Update: {
          name?: string
          location?: string | null
          city?: string | null
          state?: string | null
          region?: 'Midwest' | 'Northeast' | 'South' | 'West' | null
          phone?: string | null
          email?: string | null
          address?: string | null
          website?: string | null
          blurb?: string | null
          is_host?: boolean
          at_bunfest?: boolean
          is_published?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      // The volunteer roster (supabase/migrations/20260922140000_volunteers_and_event_content.sql)
      volunteers: {
        Row: {
          id: string
          org_id: string
          name: string
          email: string | null
          phone: string | null
          status: 'prospect' | 'active' | 'paused' | 'former'
          roles: string[]
          started_on: string | null
          orientation_on: string | null
          notes: string | null
          photo_url: string | null
          access_token: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          email?: string | null
          phone?: string | null
          status?: 'prospect' | 'active' | 'paused' | 'former'
          roles?: string[]
          started_on?: string | null
          orientation_on?: string | null
          notes?: string | null
          photo_url?: string | null
          created_by?: string | null
        }
        Update: {
          name?: string
          email?: string | null
          phone?: string | null
          status?: 'prospect' | 'active' | 'paused' | 'former'
          roles?: string[]
          started_on?: string | null
          orientation_on?: string | null
          notes?: string | null
          photo_url?: string | null
        }
        Relationships: []
      }
      // The "at the festival" cards, per event and year
      event_features: {
        Row: {
          id: string
          org_id: string
          event_slug: string
          year: number
          title: string
          blurb: string | null
          icon: string | null
          link_url: string | null
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
          year?: number
          title: string
          blurb?: string | null
          icon?: string | null
          link_url?: string | null
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
        }
        Update: {
          event_slug?: string
          year?: number
          title?: string
          blurb?: string | null
          icon?: string | null
          link_url?: string | null
          is_published?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      // Published adoption stories (supabase/migrations/20260922130000_tails_uploads_profile.sql)
      happy_tails: {
        Row: {
          id: string
          org_id: string
          bunny: string
          family: string | null
          status: 'looking' | 'just-adopted' | 'settling-in' | 'going-strong' | 'forever-loved'
          since: string | null
          summary: string
          story: string | null
          photo_url: string | null
          is_published: boolean
          sort_order: number
          request_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          bunny: string
          family?: string | null
          status?: 'looking' | 'just-adopted' | 'settling-in' | 'going-strong' | 'forever-loved'
          since?: string | null
          summary: string
          story?: string | null
          photo_url?: string | null
          is_published?: boolean
          sort_order?: number
          request_id?: string | null
          created_by?: string | null
        }
        Update: {
          bunny?: string
          family?: string | null
          status?: 'looking' | 'just-adopted' | 'settling-in' | 'going-strong' | 'forever-loved'
          since?: string | null
          summary?: string
          story?: string | null
          photo_url?: string | null
          is_published?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      // Raffle tickets (supabase/migrations/20260921170000_raffle_tickets.sql).
      // The app reads these through the RPCs below; the rows are typed for staff selects.
      raffle_ticket_orders: {
        Row: {
          id: string
          org_id: string
          event_slug: string
          name: string
          phone: string | null
          email: string | null
          qty: number
          amount_cents: number | null
          status: 'reserved' | 'paid' | 'void'
          source: 'app' | 'table'
          claim_token: string
          paid_at: string | null
          paid_by: string | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: { org_id: string; event_slug: string; name: string; qty: number }
        Update: { note?: string | null }
        Relationships: []
      }
      raffle_tickets: {
        Row: {
          id: string
          org_id: string
          event_slug: string
          order_id: string
          ticket_no: number
          prize_id: string | null
          drawn_at: string | null
          drawn_by: string | null
        }
        Insert: { org_id: string; event_slug: string; order_id: string; ticket_no: number }
        Update: { prize_id?: string | null }
        Relationships: []
      }
      // Ticket-raffle prizes — same shape as raffle_items minus the session
      // (supabase/migrations/20260920100000_item_tags.sql).
      raffle_prizes: {
        Row: {
          id: string
          org_id: string
          event_slug: string
          title: string
          description: string | null
          donated_by: string | null
          value_cents: number | null
          photo_url: string | null
          status: 'available' | 'drawn'
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
          status?: 'available' | 'drawn'
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
          status?: 'available' | 'drawn'
          is_published?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      // The scan registry: one code → one auction item / raffle prize / product.
      item_tags: {
        Row: {
          id: string
          org_id: string
          code: string
          kind: 'auction' | 'raffle' | 'stock'
          raffle_item_id: string | null
          raffle_prize_id: string | null
          product_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          code: string
          kind: 'auction' | 'raffle' | 'stock'
          raffle_item_id?: string | null
          raffle_prize_id?: string | null
          product_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          code?: string
          kind?: 'auction' | 'raffle' | 'stock'
          raffle_item_id?: string | null
          raffle_prize_id?: string | null
          product_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          id: string
          org_id: string
          kind: string
          name: string | null
          email: string | null
          phone: string | null
          subject: string | null
          payload: Json
          status: 'new' | 'in_progress' | 'done' | 'archived'
          staff_notes: string | null
          source: string | null
          handled_by: string | null
          handled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: {
          status?: 'new' | 'in_progress' | 'done' | 'archived'
          staff_notes?: string | null
        }
        Relationships: []
      }
      // Bookings (20260921110000_bookings.sql)
      booking_types: {
        Row: {
          id: string
          org_id: string
          slug: string
          name: string
          kind: 'shift' | 'appointment'
          description: string | null
          requirements: string | null
          location: string | null
          duration_min: number
          capacity: number
          max_party: number
          min_lead_hours: number
          max_per_month: number | null
          confirm_mode: 'auto' | 'staff'
          ask_reason: string | null
          attest_text: string | null
          is_published: boolean
          sort_order: number
          // Weekly schedule (supabase/migrations/20260922100000_booking_schedule.sql)
          weekly: Json
          auto_weeks: number
          slots_filled_on: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          slug: string
          name: string
          kind?: 'shift' | 'appointment'
          description?: string | null
          requirements?: string | null
          location?: string | null
          duration_min?: number
          capacity?: number
          max_party?: number
          min_lead_hours?: number
          max_per_month?: number | null
          confirm_mode?: 'auto' | 'staff'
          ask_reason?: string | null
          attest_text?: string | null
          is_published?: boolean
          sort_order?: number
          weekly?: Json
          auto_weeks?: number
        }
        Update: {
          slug?: string
          name?: string
          kind?: 'shift' | 'appointment'
          description?: string | null
          requirements?: string | null
          location?: string | null
          duration_min?: number
          capacity?: number
          max_party?: number
          min_lead_hours?: number
          max_per_month?: number | null
          confirm_mode?: 'auto' | 'staff'
          ask_reason?: string | null
          attest_text?: string | null
          is_published?: boolean
          sort_order?: number
          weekly?: Json
          auto_weeks?: number
        }
        Relationships: []
      }
      booking_slots: {
        Row: {
          id: string
          org_id: string
          type_id: string
          starts_at: string
          ends_at: string
          capacity: number
          note: string | null
          is_open: boolean
          auto: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          type_id: string
          starts_at: string
          ends_at: string
          capacity?: number
          note?: string | null
          is_open?: boolean
          auto?: boolean
          created_by?: string | null
        }
        Update: {
          starts_at?: string
          ends_at?: string
          capacity?: number
          note?: string | null
          is_open?: boolean
        }
        Relationships: []
      }
      bookings: {
        Row: {
          id: string
          org_id: string
          slot_id: string
          type_id: string
          name: string
          email: string
          phone: string | null
          party_size: number
          answer: string | null
          notes: string | null
          attested: boolean
          status: 'requested' | 'confirmed' | 'cancelled' | 'checked_in' | 'no_show'
          cancel_token: string
          source: string | null
          confirmed_by: string | null
          checked_in_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: {
          status?: 'requested' | 'confirmed' | 'cancelled' | 'checked_in' | 'no_show'
          notes?: string | null
        }
        Relationships: []
      }
      // Post queue (20260921130000_social_posts.sql)
      social_posts: {
        Row: {
          id: string
          org_id: string
          title: string
          caption: string
          image_url: string | null
          image_alt: string | null
          platforms: string[]
          scheduled_for: string | null
          status: 'draft' | 'approved' | 'posted' | 'archived'
          source: string | null
          notes: string | null
          created_by: string | null
          approved_by: string | null
          approved_at: string | null
          posted_by: string | null
          posted_at: string | null
          posted_to: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          title: string
          caption?: string
          image_url?: string | null
          image_alt?: string | null
          platforms?: string[]
          scheduled_for?: string | null
          status?: 'draft' | 'approved' | 'posted' | 'archived'
          source?: string | null
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          title?: string
          caption?: string
          image_url?: string | null
          image_alt?: string | null
          platforms?: string[]
          scheduled_for?: string | null
          notes?: string | null
          source?: string | null
        }
        Relationships: []
      }
      // Volunteer hours + impact (20260921150000_hours_impact.sql)
      volunteer_hours_entries: {
        Row: {
          id: string
          org_id: string
          email: string
          name: string | null
          on_date: string
          hours: number
          activity: string
          // Whose, who said so, and whether staff confirmed it (20260922140000_*.sql)
          volunteer_id: string | null
          status: 'logged' | 'confirmed'
          source: 'self' | 'staff' | 'checkin'
          note: string | null
          added_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          email: string
          name?: string | null
          on_date: string
          hours: number
          activity: string
          volunteer_id?: string | null
          status?: 'logged' | 'confirmed'
          source?: 'self' | 'staff' | 'checkin'
          note?: string | null
          added_by?: string | null
        }
        Update: {
          email?: string
          name?: string | null
          on_date?: string
          hours?: number
          activity?: string
          volunteer_id?: string | null
          status?: 'logged' | 'confirmed'
          source?: 'self' | 'staff' | 'checkin'
          note?: string | null
        }
        Relationships: []
      }
      impact_years: {
        Row: {
          org_id: string
          year: number
          adopted: number | null
          taken_in: number | null
          spay_neuter: number | null
          vet_care_cents: number | null
          volunteer_hours: number | null
          fosters: number | null
          bunfest_attendance: number | null
          highlights: string[]
          note: string | null
          is_published: boolean
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          org_id: string
          year: number
          adopted?: number | null
          taken_in?: number | null
          spay_neuter?: number | null
          vet_care_cents?: number | null
          volunteer_hours?: number | null
          fosters?: number | null
          bunfest_attendance?: number | null
          highlights?: string[]
          note?: string | null
          is_published?: boolean
          updated_by?: string | null
        }
        Update: {
          adopted?: number | null
          taken_in?: number | null
          spay_neuter?: number | null
          vet_care_cents?: number | null
          volunteer_hours?: number | null
          fosters?: number | null
          bunfest_attendance?: number | null
          highlights?: string[]
          note?: string | null
          is_published?: boolean
          updated_by?: string | null
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
      // "Scan an item" (20260920100000_item_tags.sql). All return the uniform
      // tagged-item JSON (src/features/scan/types.ts TaggedItem) or null.
      item_by_code: {
        Args: { p_org: string; p_code: string }
        Returns: Json
      }
      list_tagged_items: {
        Args: { p_org: string; p_kind?: string | null }
        Returns: Json[]
      }
      save_scanned_item: {
        Args: {
          p_org: string
          p_code: string
          p_kind: string
          p_title: string
          p_description?: string | null
          p_donated_by?: string | null
          p_value_cents?: number | null
          p_photo_url?: string | null
          p_price_cents?: number | null
          p_quantity?: number | null
          p_session?: string | null
        }
        Returns: Json
      }
      adjust_stock_by_code: {
        Args: { p_org: string; p_code: string; p_delta: number }
        Returns: Json
      }
      set_item_status_by_code: {
        Args: { p_org: string; p_code: string; p_status: string }
        Returns: Json
      }
      set_item_published_by_code: {
        Args: { p_org: string; p_code: string; p_published: boolean }
        Returns: Json
      }
      delete_item_by_code: {
        Args: { p_org: string; p_code: string }
        Returns: undefined
      }
      // The Inbox (20260921100000_requests.sql)
      submit_request: {
        Args: {
          p_kind: string
          p_name: string | null
          p_email: string | null
          p_phone: string | null
          p_subject: string
          p_payload: Json
          p_source?: string | null
        }
        Returns: string
      }
      set_request_status: {
        Args: { p_id: string; p_status: string; p_notes?: string | null }
        Returns: undefined
      }
      count_new_requests: {
        Args: { p_org: string }
        Returns: number
      }
      // Bookings (20260921110000_bookings.sql)
      booking_slots_open: {
        Args: { p_slug: string; p_from?: string; p_to?: string }
        Returns: { slot_id: string; starts_at: string; ends_at: string; capacity: number; taken: number; note: string | null }[]
      }
      book_slot: {
        Args: {
          p_slot_id: string
          p_name: string
          p_email: string
          p_phone: string | null
          p_party?: number
          p_answer?: string | null
          p_notes?: string | null
          p_attested?: boolean
          p_source?: string | null
        }
        Returns: Json
      }
      booking_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      cancel_booking: {
        Args: { p_token: string }
        Returns: Json
      }
      generate_booking_slots: {
        Args: {
          p_type_id: string
          p_from: string
          p_to: string
          p_weekdays: number[]
          p_start: string
          p_end: string
          p_capacity?: number | null
          p_note?: string | null
        }
        Returns: number
      }
      booking_roster: {
        Args: { p_org: string; p_from: string; p_to: string }
        Returns: {
          booking_id: string
          status: string
          name: string
          email: string
          phone: string | null
          party_size: number
          answer: string | null
          notes: string | null
          attested: boolean
          created_at: string
          slot_id: string
          starts_at: string
          ends_at: string
          capacity: number
          type_id: string
          type_name: string
          type_slug: string
          kind: string
          confirm_mode: string
        }[]
      }
      set_booking_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      count_pending_bookings: {
        Args: { p_org: string }
        Returns: number
      }
      // Post queue
      set_social_post_status: {
        Args: { p_id: string; p_status: string; p_posted_to?: string[] | null }
        Returns: undefined
      }
      count_ready_posts: {
        Args: { p_org: string }
        Returns: number
      }
      // Volunteer hours
      volunteer_history: {
        Args: { p_org: string; p_email: string; p_from: string; p_to: string }
        Returns: { source: string; on_date: string; hours: number; activity: string; ref_id: string }[]
      }
      volunteer_hours_summary: {
        Args: { p_org: string; p_from: string; p_to: string }
        Returns: { email: string; name: string | null; total_hours: number; shifts: number; last_date: string }[]
      }
      volunteer_hours_total: {
        Args: { p_org: string; p_year: number }
        Returns: number
      }
      // Raffle tickets (supabase/migrations/20260921170000_raffle_tickets.sql)
      reserve_raffle_tickets: {
        Args: { p_event: string; p_qty: number; p_name: string; p_phone: string; p_email?: string | null }
        Returns: Json
      }
      raffle_order_by_token: { Args: { p_token: string }; Returns: Json }
      sell_raffle_tickets_at_table: {
        Args: { p_org: string; p_event: string; p_qty: number; p_name: string; p_phone?: string | null; p_amount_cents?: number | null }
        Returns: Json
      }
      set_raffle_order_status: { Args: { p_id: string; p_status: 'reserved' | 'paid' | 'void' }; Returns: Json }
      draw_raffle_ticket: { Args: { p_org: string; p_event: string; p_prize_id?: string | null }; Returns: Json }
      record_bucket_draw: { Args: { p_org: string; p_event: string; p_ticket_no: number; p_prize_id?: string | null }; Returns: Json }
      undo_raffle_draw: { Args: { p_ticket_id: string }; Returns: undefined }
      raffle_desk: { Args: { p_org: string; p_event: string; p_query?: string | null }; Returns: Json }
      raffle_winners: { Args: { p_org: string; p_event: string }; Returns: Json }
      raffle_desk_summary: { Args: { p_org: string; p_event: string }; Returns: Json }
      delete_own_account: { Args: Record<string, never>; Returns: undefined }
      // Public Hop Shop shelf (supabase/migrations/20260921160000_public_shop.sql)
      hopshop_public_products: {
        Args: Record<string, never>
        Returns: { id: string; name: string; description: string | null; price_cents: number; photo_url: string | null; in_stock: boolean }[]
      }
      // Weekly booking schedule (supabase/migrations/20260922100000_booking_schedule.sql)
      fill_booking_slots: { Args: { p_type_id: string; p_force?: boolean }; Returns: number }
      // Hop Shop stock cards, suppliers and the reorder list (supabase/migrations/20260922110000_hopshop_suppliers.sql)
      list_products_admin: { Args: { p_org: string }; Returns: Json }
      save_product: {
        Args: {
          p_org: string
          p_id: string | null
          p_name: string
          p_price_cents: number
          p_description?: string | null
          p_sku?: string | null
          p_photo_url?: string | null
          p_is_active?: boolean
          p_supplier_id?: string | null
          p_supplier_sku?: string | null
          p_cost_cents?: number | null
          p_unit?: string | null
          p_category?: string | null
          p_shelf?: string | null
          p_reorder_point?: number | null
          p_reorder_qty?: number | null
          p_quantity?: number | null
        }
        Returns: Json
      }
      hopshop_reorder: { Args: { p_org: string }; Returns: Json }
      // Volunteers, hours and event content (supabase/migrations/20260922140000_*.sql)
      my_volunteer_record: { Args: { p_token: string }; Returns: Json }
      log_my_hours: {
        Args: { p_token: string; p_on_date: string; p_hours: number; p_activity: string; p_note?: string | null }
        Returns: string
      }
      delete_my_hours: { Args: { p_token: string; p_entry: string }; Returns: undefined }
      set_hours_status: { Args: { p_entry: string; p_status: 'logged' | 'confirmed' }; Returns: undefined }
      link_volunteer_hours: { Args: { p_volunteer: string }; Returns: number }
      sponsors_expiring: { Args: { p_org: string }; Returns: Json }
      set_invite_details: {
        Args: {
          p_code: string
          p_name?: string | null
          p_email?: string | null
          p_phone?: string | null
          p_position?: string | null
          p_note?: string | null
        }
        Returns: undefined
      }
      open_invites: { Args: { p_org: string }; Returns: Json }
      revoke_invite: { Args: { p_code: string }; Returns: undefined }
      save_member_profile: {
        Args: {
          p_membership: string
          p_display_name?: string | null
          p_title?: string | null
          p_photo_url?: string | null
          p_show_on_about?: boolean | null
        }
        Returns: undefined
      }
      // BunFest content + Happy Tails (supabase/migrations/2026092212/13*.sql)
      bunfest_vendors_public: {
        Args: Record<string, never>
        Returns: {
          id: string
          name: string
          category: string | null
          blurb: string | null
          website: string | null
          booth: string | null
          room: 'burgundy' | 'emerald' | null
          tables: number
        }[]
      }
      save_vendor_details: {
        Args: {
          p_id: string
          p_category?: string | null
          p_blurb?: string | null
          p_booth?: string | null
          p_room?: string | null
          p_tables?: number
          p_published?: boolean
          p_sort?: number
        }
        Returns: undefined
      }
      publish_happy_tail: {
        Args: {
          p_request_id: string
          p_bunny: string
          p_summary: string
          p_family?: string | null
          p_status?: string
          p_since?: string | null
          p_story?: string | null
          p_photo_url?: string | null
        }
        Returns: string
      }
      hopshop_set_order: { Args: { p_product_id: string; p_action: 'ordered' | 'received' | 'clear'; p_qty?: number | null }; Returns: Json }
    }
    Enums: {
      membership_role: MembershipRole
      membership_status: MembershipStatus
      invite_kind: InviteKind
    }
    CompositeTypes: Record<string, never>
  }
}
