import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { Database } from "@/src/types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY가 .env에 설정되어 있는지 확인하세요."
  );
}

const storageAdapter =
  Platform.OS === "web"
    ? {
        getItem: (key: string) =>
          Promise.resolve(
            typeof localStorage !== "undefined" ? localStorage.getItem(key) : null
          ),
        setItem: (key: string, value: string) => {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(key, value);
          }
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem(key);
          }
          return Promise.resolve();
        },
      }
    : {
        getItem: (key: string) => AsyncStorage.getItem(key),
        setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
        removeItem: (key: string) => AsyncStorage.removeItem(key),
      };

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
