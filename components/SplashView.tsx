import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";

type SplashViewProps = {
  onLayout: (event: LayoutChangeEvent) => void;
  onFinish: () => void;
};

const HOLD_DURATION_MS = 900;
const FADE_DURATION_MS = 300;
const SPLASH_BACKGROUND_COLOR = "#F5F5F5";

export const SplashView = ({ onLayout, onFinish }: SplashViewProps) => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, HOLD_DURATION_MS);

    return () => clearTimeout(timer);
  }, [onFinish, opacity]);

  return (
    <View onLayout={onLayout} style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
        <Image
          source={require("../assets/images/splash-icon-baited-v2.png")}
          resizeMode="contain"
          style={styles.image}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPLASH_BACKGROUND_COLOR,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
