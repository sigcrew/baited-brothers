import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";

import {
  ShareCatchCard,
  type ShareCardVariant,
} from "@/components/share/ShareCatchCard";
import { useFieldNotice } from "@/src/contexts/FieldNoticeContext";
import { trackAnalyticsEvent } from "@/src/lib/analytics";
import type { ShareCatchData } from "@/src/lib/shareCard";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
} from "@/src/theme/fieldJournal";

type ShareCatchCardModalProps = {
  item: ShareCatchData | null;
  visible: boolean;
  onClose: () => void;
  source: "completion" | "archive" | "preview";
  initialShowRegion?: boolean;
  cardVariant?: ShareCardVariant;
};

export const ShareCatchCardModal = ({
  item,
  visible,
  onClose,
  source,
  initialShowRegion = false,
  cardVariant = "mobile",
}: ShareCatchCardModalProps) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { alert } = useFieldNotice();
  const viewShotRef = useRef<ViewShot>(null);
  const [showRegion, setShowRegion] = useState(initialShowRegion);
  const [isSharing, setIsSharing] = useState(false);
  const cardWidth = Math.min(windowWidth - 32, 380);

  useEffect(() => {
    if (!visible) return;
    setShowRegion(initialShowRegion);
    void trackAnalyticsEvent("share_card_previewed", {
      source,
      has_region_option: Boolean(item?.regionLabel),
    });
  }, [initialShowRegion, item?.id, item?.regionLabel, source, visible]);

  if (!item) return null;

  const chooseLocationMode = (nextShowRegion: boolean) => {
    setShowRegion(nextShowRegion);
    void trackAnalyticsEvent("share_card_location_changed", {
      source,
      region_visible: nextShowRegion,
    });
  };

  const shareCard = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("이 기기에서는 공유 기능을 사용할 수 없습니다.");
      }
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) throw new Error("카드 이미지를 만들지 못했습니다.");
      void trackAnalyticsEvent("share_sheet_opened", {
        source,
        region_visible: showRegion,
      });
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: "조과 카드 공유",
      });
    } catch (error) {
      void trackAnalyticsEvent("share_card_failed", { source });
      void alert({
        eyebrow: "SHARE CARD · ERROR",
        title: "공유할 수 없어요",
        message:
          error instanceof Error
            ? error.message
            : "잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: FIELD_COLORS.foam }}>
        <View
          style={{
            paddingTop: insets.top + 9,
            paddingHorizontal: 16,
            paddingBottom: 9,
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: FIELD_COLORS.rule,
          }}
        >
          <View style={{ width: 42 }} />
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              color: FIELD_COLORS.ink,
              fontFamily: bodyExtraBoldFont,
              fontSize: 19,
            }}
          >
            공유 카드 만들기
          </Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="공유 카드 닫기"
            style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center" }}
          >
            <FontAwesome name="close" size={21} color={FIELD_COLORS.ink} />
          </TouchableOpacity>
        </View>

        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ alignItems: "center", padding: 16, paddingBottom: insets.bottom + 108 }}
        >
          <Text
            style={{ alignSelf: "flex-start", color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont, fontSize: 14 }}
          >
            위치 표시
          </Text>
          <View
            style={{
              width: "100%",
              marginTop: 8,
              marginBottom: 14,
              padding: 3,
              flexDirection: "row",
              borderWidth: 1,
              borderColor: FIELD_COLORS.rule,
              backgroundColor: "#FFFFFF",
            }}
          >
            {[
              { label: "위치 숨김", value: false, disabled: false },
              { label: "지역만 표시", value: true, disabled: !item.regionLabel },
            ].map((option) => {
              const selected = showRegion === option.value;
              return (
                <TouchableOpacity
                  key={option.label}
                  disabled={option.disabled}
                  onPress={() => chooseLocationMode(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: option.disabled }}
                  style={{
                    flex: 1,
                    minHeight: 39,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selected ? FIELD_COLORS.teal : "transparent",
                    opacity: option.disabled ? 0.42 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? "#FFFFFF" : FIELD_COLORS.ink,
                      fontFamily: bodyExtraBoldFont,
                      fontSize: 13,
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 1, result: "tmpfile" }}
            style={{ width: cardWidth }}
          >
            <ShareCatchCard
              item={item}
              width={cardWidth}
              showRegion={showRegion}
              variant={cardVariant}
            />
          </ViewShot>
          <Text
            style={{ marginTop: 12, color: FIELD_COLORS.muted, fontFamily: bodyFont, fontSize: 12 }}
          >
            상세 포인트와 좌표는 카드에 포함하지 않습니다.
          </Text>
        </ScrollView>

        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom + 8, 18),
            borderTopWidth: 1,
            borderTopColor: FIELD_COLORS.rule,
            backgroundColor: FIELD_COLORS.foam,
          }}
        >
          <TouchableOpacity
            onPress={shareCard}
            disabled={isSharing}
            accessibilityRole="button"
            accessibilityLabel="이미지로 공유하기"
            style={{
              minHeight: 52,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: FIELD_COLORS.teal,
              opacity: isSharing ? 0.7 : 1,
            }}
          >
            {isSharing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <FontAwesome name="share-alt" size={17} color="#FFFFFF" />
            )}
            <Text style={{ marginLeft: 9, color: "#FFFFFF", fontFamily: bodyExtraBoldFont, fontSize: 17 }}>
              이미지로 공유하기
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
