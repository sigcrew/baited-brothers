import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/src/contexts/AuthContext";
import { hasSeenOnboarding, resolveLaunchRoute } from "@/src/lib/onboarding";
import { FIELD_COLORS } from "@/src/theme/fieldJournal";

const Index = () => {
  const { session, isLoading } = useAuth();
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void hasSeenOnboarding().then((seen) => {
      if (!cancelled) setSeenOnboarding(seen);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading || seenOnboarding === null) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: FIELD_COLORS.foam }}>
        <ActivityIndicator size="large" color={FIELD_COLORS.teal} />
      </View>
    );
  }

  return (
    <Redirect
      href={resolveLaunchRoute({
        seenOnboarding,
        hasSession: Boolean(session),
        isDevelopment: __DEV__,
      })}
    />
  );
};

export default Index;
