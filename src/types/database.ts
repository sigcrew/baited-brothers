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
      analytics_events: {
        Row: {
          app_version: string
          build_number: string | null
          event_name: string
          id: string
          occurred_at: string
          platform: string
          properties: Json
          session_id: string
          user_id: string
        }
        Insert: {
          app_version: string
          build_number?: string | null
          event_name: string
          id?: string
          occurred_at?: string
          platform: string
          properties?: Json
          session_id: string
          user_id?: string
        }
        Update: {
          app_version?: string
          build_number?: string | null
          event_name?: string
          id?: string
          occurred_at?: string
          platform?: string
          properties?: Json
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_daily: {
        Row: {
          app_version: string
          build_number: string
          event_count: number
          event_name: string
          metric_date: string
          platform: string
          refreshed_at: string
          user_count: number
        }
        Insert: {
          app_version: string
          build_number: string
          event_count: number
          event_name: string
          metric_date: string
          platform: string
          refreshed_at?: string
          user_count: number
        }
        Update: {
          app_version?: string
          build_number?: string
          event_count?: number
          event_name?: string
          metric_date?: string
          platform?: string
          refreshed_at?: string
          user_count?: number
        }
        Relationships: []
      }
      analytics_monthly: {
        Row: {
          metric_name: string
          metric_value: number
          month_start: string
          refreshed_at: string
        }
        Insert: {
          metric_name: string
          metric_value: number
          month_start: string
          refreshed_at?: string
        }
        Update: {
          metric_name?: string
          metric_value?: number
          month_start?: string
          refreshed_at?: string
        }
        Relationships: []
      }
      analytics_cohort_monthly: {
        Row: {
          activity_month: string
          cohort_month: string
          cohort_size: number
          refreshed_at: string
          retained_users: number
          retention_rate: number
        }
        Insert: {
          activity_month: string
          cohort_month: string
          cohort_size: number
          refreshed_at?: string
          retained_users: number
          retention_rate: number
        }
        Update: {
          activity_month?: string
          cohort_month?: string
          cohort_size?: number
          refreshed_at?: string
          retained_users?: number
          retention_rate?: number
        }
        Relationships: []
      }
      fishes: {
        Row: {
          aliases: string[]
          average_size_cm: number | null
          catalog_sort_order: number | null
          catalog_status: string
          catalog_version: string | null
          category: Database["public"]["Enums"]["fish_category"]
          collection_group: string
          created_at: string | null
          description: string | null
          depth_zone: string | null
          discovery_difficulty: number | null
          fishing_methods: string[]
          guide_reviewed_at: string | null
          guide_source_urls: string[]
          guide_status: string
          habitat_environment: string | null
          habitat_regions: string[]
          handling_cautions: string | null
          id: string
          identification_features: string | null
          image_attribution: string | null
          image_license: string | null
          image_source_url: string | null
          image_url: string | null
          inclusion_reason: string | null
          min_size_cm: number | null
          max_size_cm: number | null
          name: string
          name_ko: string | null
          peak_seasons: number[]
          rarity: number | null
          recommended_baits: string[]
          scientific_synonyms: string[]
          similar_species_notes: string | null
          source_name: string | null
          source_species_id: string | null
          toxicity: string | null
          updated_at: string | null
        }
        Insert: {
          aliases?: string[]
          average_size_cm?: number | null
          catalog_sort_order?: number | null
          catalog_status?: string
          catalog_version?: string | null
          category?: Database["public"]["Enums"]["fish_category"]
          collection_group?: string
          created_at?: string | null
          description?: string | null
          depth_zone?: string | null
          discovery_difficulty?: number | null
          fishing_methods?: string[]
          guide_reviewed_at?: string | null
          guide_source_urls?: string[]
          guide_status?: string
          habitat_environment?: string | null
          habitat_regions?: string[]
          handling_cautions?: string | null
          id?: string
          identification_features?: string | null
          image_attribution?: string | null
          image_license?: string | null
          image_source_url?: string | null
          image_url?: string | null
          inclusion_reason?: string | null
          min_size_cm?: number | null
          max_size_cm?: number | null
          name: string
          name_ko?: string | null
          peak_seasons?: number[]
          rarity?: number | null
          recommended_baits?: string[]
          scientific_synonyms?: string[]
          similar_species_notes?: string | null
          source_name?: string | null
          source_species_id?: string | null
          toxicity?: string | null
          updated_at?: string | null
        }
        Update: {
          aliases?: string[]
          average_size_cm?: number | null
          catalog_sort_order?: number | null
          catalog_status?: string
          catalog_version?: string | null
          category?: Database["public"]["Enums"]["fish_category"]
          collection_group?: string
          created_at?: string | null
          description?: string | null
          depth_zone?: string | null
          discovery_difficulty?: number | null
          fishing_methods?: string[]
          guide_reviewed_at?: string | null
          guide_source_urls?: string[]
          guide_status?: string
          habitat_environment?: string | null
          habitat_regions?: string[]
          handling_cautions?: string | null
          id?: string
          identification_features?: string | null
          image_attribution?: string | null
          image_license?: string | null
          image_source_url?: string | null
          image_url?: string | null
          inclusion_reason?: string | null
          min_size_cm?: number | null
          max_size_cm?: number | null
          name?: string
          name_ko?: string | null
          peak_seasons?: number[]
          rarity?: number | null
          recommended_baits?: string[]
          scientific_synonyms?: string[]
          similar_species_notes?: string | null
          source_name?: string | null
          source_species_id?: string | null
          toxicity?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fish_regulations: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          fish_id: string
          id: string
          jurisdiction: string
          measurement_method: string | null
          min_size_cm: number | null
          min_weight_g: number | null
          prohibited_from: string | null
          prohibited_to: string | null
          regulation_type: string
          rule_text: string
          source_name: string
          source_url: string
          verified_at: string
        }
        Insert: {
          created_at?: string
          effective_from: string
          effective_to?: string | null
          fish_id: string
          id?: string
          jurisdiction?: string
          measurement_method?: string | null
          min_size_cm?: number | null
          min_weight_g?: number | null
          prohibited_from?: string | null
          prohibited_to?: string | null
          regulation_type: string
          rule_text: string
          source_name: string
          source_url: string
          verified_at?: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          fish_id?: string
          id?: string
          jurisdiction?: string
          measurement_method?: string | null
          min_size_cm?: number | null
          min_weight_g?: number | null
          prohibited_from?: string | null
          prohibited_to?: string | null
          regulation_type?: string
          rule_text?: string
          source_name?: string
          source_url?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fish_regulations_fish_id_fkey"
            columns: ["fish_id"]
            isOneToOne: false
            referencedRelation: "fishes"
            referencedColumns: ["id"]
          }
        ]
      }
      user_catches: {
        Row: {
          captured_at: string | null
          collection_eligible: boolean
          conditions_snapshot: Json | null
          caught_at: string
          candidate_fish_ids: string[]
          capture_method: Database["public"]["Enums"]["capture_method"] | null
          client_request_id: string | null
          created_at: string | null
          custom_species_name: string | null
          fish_id: string | null
          id: string
          image_path: string | null
          image_url: string | null
          id_method: Database["public"]["Enums"]["catch_id_method"] | null
          image_hash: string | null
          location_lat: number | null
          location_accuracy_m: number | null
          location_lng: number | null
          location_captured_at: string | null
          location_name: string | null
          memo: string | null
          original_custom_species_name: string | null
          original_fish_id: string | null
          ranking_eligible: boolean
          size_cm: number | null
          species_corrected_at: string | null
          trip_id: string | null
          thumbnail_path: string | null
          updated_at: string | null
          uploaded_at: string
          user_id: string
          verification_reason: string | null
          verification_status: Database["public"]["Enums"]["catch_verification_status"]
          verification_version: number | null
          verified_at: string | null
        }
        Insert: {
          captured_at?: string | null
          collection_eligible?: boolean
          conditions_snapshot?: Json | null
          caught_at?: string
          candidate_fish_ids?: string[]
          capture_method?: Database["public"]["Enums"]["capture_method"] | null
          client_request_id?: string | null
          created_at?: string | null
          custom_species_name?: string | null
          fish_id?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          id_method?: Database["public"]["Enums"]["catch_id_method"] | null
          image_hash?: string | null
          location_lat?: number | null
          location_accuracy_m?: number | null
          location_lng?: number | null
          location_captured_at?: string | null
          location_name?: string | null
          memo?: string | null
          original_custom_species_name?: string | null
          original_fish_id?: string | null
          ranking_eligible?: boolean
          size_cm?: number | null
          species_corrected_at?: string | null
          trip_id?: string | null
          thumbnail_path?: string | null
          updated_at?: string | null
          uploaded_at?: string
          user_id: string
          verification_reason?: string | null
          verification_status?: Database["public"]["Enums"]["catch_verification_status"]
          verification_version?: number | null
          verified_at?: string | null
        }
        Update: {
          captured_at?: string | null
          collection_eligible?: boolean
          conditions_snapshot?: Json | null
          caught_at?: string
          candidate_fish_ids?: string[]
          capture_method?: Database["public"]["Enums"]["capture_method"] | null
          client_request_id?: string | null
          created_at?: string | null
          custom_species_name?: string | null
          fish_id?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          id_method?: Database["public"]["Enums"]["catch_id_method"] | null
          image_hash?: string | null
          location_lat?: number | null
          location_accuracy_m?: number | null
          location_lng?: number | null
          location_captured_at?: string | null
          location_name?: string | null
          memo?: string | null
          original_custom_species_name?: string | null
          original_fish_id?: string | null
          ranking_eligible?: boolean
          size_cm?: number | null
          species_corrected_at?: string | null
          trip_id?: string | null
          thumbnail_path?: string | null
          updated_at?: string | null
          uploaded_at?: string
          user_id?: string
          verification_reason?: string | null
          verification_status?: Database["public"]["Enums"]["catch_verification_status"]
          verification_version?: number | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_catches_fish_id_fkey"
            columns: ["fish_id"]
            isOneToOne: false
            referencedRelation: "fishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_catches_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "fishing_trips"
            referencedColumns: ["id"]
          }
        ]
      }
      user_feedback: {
        Row: {
          app_version: string
          build_number: string | null
          category: string
          created_at: string
          id: string
          message: string
          platform: string
          user_id: string
        }
        Insert: {
          app_version: string
          build_number?: string | null
          category: string
          created_at?: string
          id?: string
          message: string
          platform: string
          user_id: string
        }
        Update: {
          app_version?: string
          build_number?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          analytics_excluded: boolean
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          analytics_excluded?: boolean
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          analytics_excluded?: boolean
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      favorite_fishing_spots: {
        Row: {
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      fishing_trips: {
        Row: {
          cover_image_path: string | null
          cover_thumbnail_path: string | null
          cover_image_url: string | null
          id: string
          user_id: string
          spot_name: string
          spot_lat: number | null
          spot_lng: number | null
          scheduled_at: string
          memo: string | null
          status: Database["public"]["Enums"]["trip_status"]
          completed_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          cover_image_path?: string | null
          cover_thumbnail_path?: string | null
          cover_image_url?: string | null
          id?: string
          user_id: string
          spot_name: string
          spot_lat?: number | null
          spot_lng?: number | null
          scheduled_at: string
          memo?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          completed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          cover_image_path?: string | null
          cover_thumbnail_path?: string | null
          cover_image_url?: string | null
          id?: string
          user_id?: string
          spot_name?: string
          spot_lat?: number | null
          spot_lng?: number | null
          scheduled_at?: string
          memo?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          completed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      consume_ai_identification_quota: {
        Args: Record<PropertyKey, never>
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string | null
        }[]
      }
    }
    Enums: {
      fish_category: "flatfish" | "rockfish" | "seabass" | "mackerel" | "bream" | "mullet" | "cutlassfish" | "eel" | "pufferfish" | "other"
      trip_status: "planned" | "done" | "canceled"
      capture_method: "live_camera" | "photo_library" | "development_upload"
      catch_id_method: "closed_set_candidates" | "fallback_catalog"
      catch_verification_status:
        | "verified"
        | "unverified"
        | "pending"
        | "field_verified"
        | "metadata_verified"
        | "general_record"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]
