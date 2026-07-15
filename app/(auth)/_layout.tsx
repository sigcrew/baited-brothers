import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";

const AuthLayout = () => {
  const { session } = useAuth();

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
};

export default AuthLayout;
