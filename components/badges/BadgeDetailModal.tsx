import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
    if (!visible) return;
    isFlippedRef.current = false;
    setIsFlipped(false);
    dragStartRotation.current = 0;
    rotation.setValue(0);
  }, [rotation, visible]);

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

  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => (
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy)
      ),
      onPanResponderGrant: () => {
        rotation.stopAnimation((currentRotation) => {
          dragStartRotation.current = currentRotation;
        });
      },
      onPanResponderMove: (_, gesture) => {
        rotation.setValue(dragStartRotation.current + gesture.dx * 0.9);
      },
      onPanResponderRelease: (_, gesture) => {
        const releaseSpeed = Math.abs(gesture.vx);
        if (releaseSpeed < INERTIA_START_VELOCITY) {
          rotation.stopAnimation(settleRotation);
          return;
        }

        const angularVelocity = Math.sign(gesture.vx) * Math.min(
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
      },
      onPanResponderTerminate: () => {
        rotation.stopAnimation(settleRotation);
      },
    }),
    [rotation, settleRotation]
  );

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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        className="flex-1 items-center justify-center px-5"
        style={{ backgroundColor: "rgba(5, 22, 28, 0.76)" }}
        accessibilityViewIsModal
      >
        <View className="w-full max-w-[390px] bg-white px-5 pb-5 pt-4">
          <View className="flex-row items-center justify-between border-b pb-3" style={{ borderColor: FIELD_COLORS.rule }}>
            <Text className="text-[11px] tracking-[1.8px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
              FIELD MARK · {badge.category}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="배지 상세 닫기"
              onPress={onClose}
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
              <View
                {...panResponder.panHandlers}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${badge.title} 배지, 좌우로 밀어 ${isFlipped ? "앞면" : "뒷면"} 보기`}
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
            </View>
          </View>

        </View>
      </View>
    </Modal>
  );
};
