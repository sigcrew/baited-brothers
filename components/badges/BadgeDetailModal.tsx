import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";

import { FieldBadgeAsset } from "@/components/badges/FieldBadgeAsset";
import { FieldBadgeBackAsset } from "@/components/badges/FieldBadgeBackAsset";
import {
  getBadgeProgress,
  type BadgeDefinition,
  type BadgeUnlockContext,
} from "@/src/data/badges";
import {
  FIELD_COLORS,
  monoFont,
} from "@/src/theme/fieldJournal";

type BadgeDetailModalProps = {
  badge: BadgeDefinition;
  badgeNumber: number;
  context: BadgeUnlockContext;
  unlocked: boolean;
  visible: boolean;
  onClose: () => void;
};

const INERTIA_START_VELOCITY = 0.55;
const INERTIA_VELOCITY_GAIN = 2.4;
const MAX_ANGULAR_VELOCITY = 5.2;

export const BadgeDetailModal = ({
  badge,
  badgeNumber,
  context,
  unlocked,
  visible,
  onClose,
}: BadgeDetailModalProps) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const rotation = useRef(new Animated.Value(0)).current;
  const dragStartRotation = useRef(0);
  const isFlippedRef = useRef(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const progress = getBadgeProgress(badge.id, context);
  const markNumber = `MRK-${String(badgeNumber).padStart(3, "0")}`;
  const acquiredAt = context.acquiredAt[badge.id];
  const acquiredDate = acquiredAt
    ? new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(acquiredAt))
    : "기록 없음";
  const compactAcquiredDate = acquiredDate.replace(/\s/g, "");

  useEffect(() => {
    if (!visible) {
      bottomSheetRef.current?.dismiss();
      return;
    }

    isFlippedRef.current = false;
    setIsFlipped(false);
    dragStartRotation.current = 0;
    rotation.setValue(0);
    bottomSheetRef.current?.present();
  }, [rotation, visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.76}
        pressBehavior="close"
      />
    ),
    []
  );

  const dismiss = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const settleRotation = useCallback((currentRotation: number) => {
    const targetRotation = Math.round(currentRotation / 180) * 180;
    const normalizedTarget = ((targetRotation % 360) + 360) % 360;
    const nextFlipped = normalizedTarget === 180;
    isFlippedRef.current = nextFlipped;
    setIsFlipped(nextFlipped);
    Animated.timing(rotation, {
      toValue: targetRotation,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => {
      if (!finished) return;
      dragStartRotation.current = normalizedTarget;
      rotation.setValue(normalizedTarget);
    });
  }, [rotation]);

  const flip = useCallback(() => {
    rotation.stopAnimation((currentRotation) => {
      settleRotation(currentRotation + 180);
    });
  }, [rotation, settleRotation]);

  const badgeGesture = useMemo(() => {
    const panGesture = Gesture.Pan()
      .activeOffsetX([-8, 8])
      .failOffsetY([-8, 8])
      .runOnJS(true)
      .onBegin(() => {
        rotation.stopAnimation((currentRotation) => {
          dragStartRotation.current = currentRotation;
        });
      })
      .onUpdate((event) => {
        rotation.setValue(
          dragStartRotation.current + event.translationX * 0.9
        );
      })
      .onEnd((event) => {
        const releaseSpeed = Math.abs(event.velocityX) / 1000;
        if (releaseSpeed < INERTIA_START_VELOCITY) {
          rotation.stopAnimation(settleRotation);
          return;
        }

        const angularVelocity = Math.sign(event.velocityX) * Math.min(
          (releaseSpeed - INERTIA_START_VELOCITY) * INERTIA_VELOCITY_GAIN,
          MAX_ANGULAR_VELOCITY
        );

        Animated.decay(rotation, {
          velocity: angularVelocity,
          deceleration: 0.995,
          useNativeDriver: Platform.OS !== "web",
        }).start(() => {
          rotation.stopAnimation(settleRotation);
        });
      })
      .onFinalize((_, success) => {
        if (success) return;
        rotation.stopAnimation(settleRotation);
      });

    const tapGesture = Gesture.Tap()
      .maxDistance(8)
      .runOnJS(true)
      .onEnd((_, success) => {
        if (success) flip();
      });

    return Gesture.Exclusive(panGesture, tapGesture);
  }, [flip, rotation, settleRotation]);

  const frontStyle = {
    transform: [
      { perspective: 1100 },
      { rotateY: rotation.interpolate({ inputRange: [-720, 0, 720], outputRange: ["-720deg", "0deg", "720deg"] }) },
    ],
  };
  const backStyle = {
    transform: [
      { perspective: 1100 },
      { rotateY: rotation.interpolate({ inputRange: [-720, 0, 720], outputRange: ["-540deg", "180deg", "900deg"] }) },
    ],
  };

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      accessibilityViewIsModal
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      enableDynamicSizing
      enablePanDownToClose
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      maxDynamicContentSize={560}
      onDismiss={onClose}
      style={styles.sheet}
    >
      <BottomSheetView className="px-5 pb-6">
        <View className="flex-row items-center justify-between border-b pb-3" style={{ borderColor: FIELD_COLORS.rule }}>
          <Text className="text-[11px] tracking-[1.8px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
            FIELD MARK · {badge.category}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="배지 상세 닫기"
            onPress={dismiss}
            className="h-10 w-10 items-center justify-center"
          >
            <FontAwesome name="times" size={22} color={FIELD_COLORS.ink} />
          </TouchableOpacity>
        </View>

        <View className="mt-4 h-[332px] border bg-white px-5" style={{ borderColor: FIELD_COLORS.rule }}>
          <Text className="absolute left-4 top-4 text-[10px] tracking-[1.4px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
            {markNumber}
          </Text>

          <View className="flex-1 items-center justify-center">
            <GestureDetector gesture={badgeGesture}>
              <View
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${badge.title} 배지, 탭하거나 좌우로 밀어 ${isFlipped ? "앞면" : "뒷면"} 보기`}
                accessibilityActions={[{ name: "activate", label: "배지 뒤집기" }]}
                onAccessibilityAction={flip}
                className="h-[284px] w-[284px]"
                style={{ touchAction: "pan-y" }}
              >
                <Animated.View
                  accessibilityElementsHidden={isFlipped}
                  importantForAccessibility={isFlipped ? "no-hide-descendants" : "yes"}
                  className="items-center justify-center"
                  style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden", pointerEvents: "none" }, frontStyle]}
                >
                  <FieldBadgeAsset badgeId={badge.id} unlocked={unlocked} label={badge.title} size={276} />
                </Animated.View>

                <Animated.View
                  accessibilityElementsHidden={!isFlipped}
                  importantForAccessibility={!isFlipped ? "no-hide-descendants" : "yes"}
                  className="items-center justify-center"
                  style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden", pointerEvents: "none" }, backStyle]}
                >
                  <FieldBadgeBackAsset
                    acquiredDate={compactAcquiredDate}
                    badgeId={badge.id}
                    progressCurrent={progress.current}
                    progressLabel={progress.label}
                    progressTarget={progress.target}
                    requirement={badge.requirement}
                    size={276}
                  />
                </Animated.View>
              </View>
            </GestureDetector>
          </View>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  handle: {
    height: 20,
    paddingVertical: 8,
  },
  handleIndicator: {
    backgroundColor: FIELD_COLORS.rule,
    height: 4,
    width: 48,
  },
  sheet: {
    alignSelf: "center",
    maxWidth: 480,
    width: "100%",
  },
  sheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
});
