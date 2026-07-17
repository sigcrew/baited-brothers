import "../global.css";

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import 'react-native-reanimated';

import { SplashView } from '@/components/SplashView';
import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { BlackHanSans_400Regular } from '@expo-google-fonts/black-han-sans';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import { DoHyeon_400Regular } from '@expo-google-fonts/do-hyeon';
import {
  NotoSansKR_400Regular,
  NotoSansKR_600SemiBold,
  NotoSansKR_800ExtraBold,
} from '@expo-google-fonts/noto-sans-kr';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const RootLayout = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    BlackHanSans: BlackHanSans_400Regular,
    Anton: Anton_400Regular,
    DoHyeon: DoHyeon_400Regular,
    NotoSansKR: NotoSansKR_400Regular,
    NotoSansKR_600SemiBold,
    NotoSansKR_800ExtraBold,
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  const handleSplashLayout = useCallback(() => {
    SplashScreen.hideAsync();
  }, []);

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (!loaded) {
    return null;
  }

  if (showSplash) {
    return (
      <SplashView
        onLayout={handleSplashLayout}
        onFinish={handleSplashFinish}
      />
    );
  }

  return <RootLayoutNav />;
};

const RootLayoutNav = () => {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="record" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="trips/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="fishes/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default RootLayout;
