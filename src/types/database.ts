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
      fishes: {
        Row: {
          category: Database["public"]["Enums"]["fish_category"]
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          min_size_cm: number | null
          name: string
          name_ko: string | null
          updated_at: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["fish_category"]
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          min_size_cm?: number | null
          name: string
          name_ko?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["fish_category"]
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          min_size_cm?: number | null
          name?: string
          name_ko?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_catches: {
        Row: {
          caught_at: string
          candidate_fish_ids: string[]
          capture_method: Database["public"]["Enums"]["capture_method"] | null
          created_at: string | null
          fish_id: string
          id: string
          image_url: string | null
          id_method: Database["public"]["Enums"]["catch_id_method"] | null
          location_lat: number | null
          location_lng: number | null
          location_captured_at: string | null
          location_name: string | null
          memo: string | null
          size_cm: number | null
          trip_id: string | null
          updated_at: string | null
          user_id: string
          verification_reason: string | null
          verification_status: Database["public"]["Enums"]["catch_verification_status"]
        }
        Insert: {
          caught_at?: string
          candidate_fish_ids?: string[]
          capture_method?: Database["public"]["Enums"]["capture_method"] | null
          created_at?: string | null
          fish_id: string
          id?: string
          image_url?: string | null
          id_method?: Database["public"]["Enums"]["catch_id_method"] | null
          location_lat?: number | null
          location_lng?: number | null
          location_captured_at?: string | null
          location_name?: string | null
          memo?: string | null
          size_cm?: number | null
          trip_id?: string | null
          updated_at?: string | null
          user_id: string
          verification_reason?: string | null
          verification_status?: Database["public"]["Enums"]["catch_verification_status"]
        }
        Update: {
          caught_at?: string
          candidate_fish_ids?: string[]
          capture_method?: Database["public"]["Enums"]["capture_method"] | null
          created_at?: string | null
          fish_id?: string
          id?: string
          image_url?: string | null
          id_method?: Database["public"]["Enums"]["catch_id_method"] | null
          location_lat?: number | null
          location_lng?: number | null
          location_captured_at?: string | null
          location_name?: string | null
          memo?: string | null
          size_cm?: number | null
          trip_id?: string | null
          updated_at?: string | null
          user_id?: string
          verification_reason?: string | null
          verification_status?: Database["public"]["Enums"]["catch_verification_status"]
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
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fishing_trips: {
        Row: {
          cover_image_path: string | null
          cover_image_url: string | null
          id: string
          user_id: string
          spot_name: string
          scheduled_at: string
          memo: string | null
          status: Database["public"]["Enums"]["trip_status"]
          completed_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          cover_image_path?: string | null
          cover_image_url?: string | null
          id?: string
          user_id: string
          spot_name: string
          scheduled_at: string
          memo?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          completed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          cover_image_path?: string | null
          cover_image_url?: string | null
          id?: string
          user_id?: string
          spot_name?: string
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
    Functions: { [_ in never]: never }
    Enums: {
      fish_category: "flatfish" | "rockfish" | "seabass" | "mackerel" | "bream" | "mullet" | "cutlassfish" | "eel" | "pufferfish" | "other"
      trip_status: "planned" | "done" | "canceled"
      capture_method: "live_camera"
      catch_id_method: "closed_set_candidates" | "fallback_catalog"
      catch_verification_status: "verified" | "unverified"
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
