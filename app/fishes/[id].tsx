import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchiveRule } from "@/components/design/ArchiveRule";
import { FishThumb } from "@/components/collection/FishThumb";
import { getCatalogGroupLabel } from "@/src/hooks/useFishes";
import { useFishDetail } from "@/src/hooks/useFishDetail";
import { getField60Illustration } from "@/src/data/field60Illustrations";
import { trackAnalyticsEvent } from "@/src/lib/analytics";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  bodySemiBoldFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value))
    : "기록 없음";

const formatNumericDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(value))
    .replace(/\. /g, ".")
    .replace(/\.$/, "");

const InfoSection = ({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) => (
  <View className="px-5 py-7">
    <View className="mb-5 flex-row items-end justify-between">
      <Text className="text-[22px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
        {title}
      </Text>
      <Text className="text-[10px] tracking-[1.4px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
        {index}
      </Text>
    </View>
    {children}
  </View>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-[10px] tracking-[1.2px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
    {children}
  </Text>
);

const Value = ({ children }: { children: React.ReactNode }) => (
  <Text className="mt-1 text-[15px] leading-6" style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>
    {children}
  </Text>
);

const Metric = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <View className="flex-1 border-r px-3 last:border-r-0" style={{ borderColor: FIELD_COLORS.rule }}>
    <Text className="text-center text-[10px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>
      {label}
    </Text>
    <Text
      className="mt-2 text-center text-[18px]"
      numberOfLines={1}
      style={{
        color: FIELD_COLORS.ink,
        fontFamily: bodyExtraBoldFont,
        letterSpacing: -0.6,
      }}
    >
      {value}
    </Text>
  </View>
);

const LockedFishDetail = ({
  outlineSource,
  catalogSortOrder,
  onBack,
  onRecord,
  topInset,
  bottomInset,
}: {
  outlineSource: ReturnType<typeof getField60Illustration>;
  catalogSortOrder: number | null;
  onBack: () => void;
  onRecord: () => void;
  topInset: number;
  bottomInset: number;
}) => (
  <View className="flex-1" style={{ backgroundColor: FIELD_COLORS.foam }}>
    <View className="bg-white px-5 pb-5" style={{ paddingTop: topInset + 12 }}>
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="도감으로 돌아가기"
          className="h-11 w-11 items-center justify-center border"
          style={{ borderColor: FIELD_COLORS.rule }}
        >
          <FontAwesome name="long-arrow-left" size={21} color={FIELD_COLORS.ink} />
        </TouchableOpacity>
        <Text
          className="text-[10px] tracking-[1.5px]"
          style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}
        >
          FIELD 60 · {String(catalogSortOrder ?? 0).padStart(2, "0")}
        </Text>
      </View>
      <View className="mt-4">
        <ArchiveRule ticks />
      </View>
    </View>

    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: bottomInset + 28,
      }}
    >
      <View className="flex-1">
        <View
          className="mt-5 h-72 w-full overflow-hidden rounded-xl border"
          style={{
            backgroundColor: FIELD_COLORS.locked,
            borderColor: FIELD_COLORS.rule,
          }}
        >
          {outlineSource ? (
            <Image
              source={outlineSource}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
              accessibilityLabel="아직 발견하지 못한 어종의 점선 실루엣"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <FontAwesome name="question" size={54} color={FIELD_COLORS.teal} />
            </View>
          )}
          <View
            className="absolute right-4 top-4 h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(5, 31, 40, 0.82)" }}
          >
            <FontAwesome name="lock" size={16} color="white" />
          </View>
        </View>

        <View className="items-center px-5 pt-8">
          <Text
            className="text-center text-[38px] leading-[46px]"
            style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}
          >
            미확인 어종
          </Text>
          <Text
            className="mt-2 text-[10px] tracking-[2px]"
            style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}
          >
            SPECIMEN LOCKED
          </Text>
          <View
            className="my-6 h-px w-20"
            style={{ backgroundColor: FIELD_COLORS.rule }}
          />
          <Text
            className="text-center text-[15px] leading-7"
            style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
          >
            현장에서 이 어종을 발견하고{"\n"}검증된 조과로 기록하면 정보가 열립니다.
          </Text>
        </View>

        <View
          className="mt-8 border-y py-5"
          style={{ borderColor: FIELD_COLORS.rule }}
        >
          {[
            ["01", "표준명 · 학명"],
            ["02", "서식지 · 주요 시즌"],
            ["03", "식별법 · 안전 정보"],
          ].map(([index, label]) => (
            <View
              key={index}
              className="flex-row items-center justify-between py-3"
            >
              <Text
                className="text-[10px] tracking-[1.4px]"
                style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}
              >
                {index}
              </Text>
              <View className="ml-5 flex-1">
                <Text
                  className="text-[14px]"
                  style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}
                >
                  {label}
                </Text>
              </View>
              <FontAwesome name="lock" size={12} color={FIELD_COLORS.muted} />
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={onRecord}
          activeOpacity={0.8}
          className="mt-8 flex-row items-center justify-between px-5 py-5"
          style={{ backgroundColor: FIELD_COLORS.teal }}
          accessibilityRole="button"
          accessibilityLabel="발견 기록하기"
        >
          <View>
            <Text
              className="text-[17px] text-white"
              style={{ fontFamily: bodyExtraBoldFont }}
            >
              발견 기록하기
            </Text>
            <Text
              className="mt-1 text-[11px] text-white/80"
              style={{ fontFamily: bodyFont }}
            >
              사진과 장소를 남겨 도감을 해제합니다
            </Text>
          </View>
          <FontAwesome name="camera" size={20} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onBack}
          className="items-center py-5"
          accessibilityRole="button"
          accessibilityLabel="도감으로 돌아가기"
        >
          <Text
            className="text-[12px]"
            style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}
          >
            도감으로 돌아가기
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  </View>
);

const FishDetailScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const fishId = typeof params.id === "string" ? params.id : "";
  const {
    fish,
    regulations,
    catches,
    discovery,
    isUnlocked,
    isLoading,
    error,
    refetch,
  } = useFishDetail(fishId);
  const trackedFishId = useRef<string | null>(null);

  useEffect(() => {
    if (!fish || trackedFishId.current === fish.id) return;
    trackedFishId.current = fish.id;
    void trackAnalyticsEvent("fish_detail_viewed", {
      unlocked: isUnlocked,
      catalog_order: fish.catalog_sort_order,
    });
  }, [fish, isUnlocked]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: FIELD_COLORS.foam }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={FIELD_COLORS.teal} />
      </View>
    );
  }

  if (error || !fish) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: FIELD_COLORS.foam }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-[28px]" style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}>도감 정보를 찾지 못했습니다</Text>
        {error ? (
          <Text className="mt-3 text-center text-xs leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
            {error.message}
          </Text>
        ) : null}
        <TouchableOpacity onPress={() => router.replace("/encyclopedia")} className="mt-6 px-6 py-3" style={{ backgroundColor: FIELD_COLORS.teal }}>
          <Text className="text-white" style={{ fontFamily: bodyExtraBoldFont }}>도감으로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isUnlocked) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LockedFishDetail
          outlineSource={getField60Illustration(
            fish.catalog_sort_order,
            "outline",
          )}
          catalogSortOrder={fish.catalog_sort_order}
          onBack={() => router.replace("/encyclopedia")}
          onRecord={() => router.push("/record")}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      </>
    );
  }

  const aliases = fish.aliases.length > 0 ? fish.aliases.join(" · ") : "등록된 통칭 없음";
  const localIllustration = getField60Illustration(fish.catalog_sort_order, "color");
  const heroImageSource = localIllustration ?? (fish.image_url ? { uri: fish.image_url } : null);
  const seasonSet = new Set(fish.peak_seasons);
  const sourceLabel = (url: string) => {
    if (url.includes("mbris.kr")) return "해양생명자원통합정보시스템";
    if (url.includes("nifs.go.kr")) return "국립수산과학원";
    if (url.includes("sealifebase")) return "SeaLifeBase 종 정보";
    if (url.includes("fishbase")) return "FishBase 종 정보";
    return "참고 자료";
  };

  return (
    <View className="flex-1" style={{ backgroundColor: FIELD_COLORS.foam }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={FIELD_COLORS.teal} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View className="bg-white px-5 pb-5" style={{ paddingTop: insets.top + 12 }}>
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.replace("/encyclopedia")}
              accessibilityRole="button"
              accessibilityLabel="도감으로 돌아가기"
              className="h-11 w-11 items-center justify-center border"
              style={{ borderColor: FIELD_COLORS.rule }}
            >
              <FontAwesome name="long-arrow-left" size={21} color={FIELD_COLORS.ink} />
            </TouchableOpacity>
            <Text className="text-[10px] tracking-[1.5px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
              FIELD 60 · {String(fish.catalog_sort_order ?? 0).padStart(2, "0")}
            </Text>
          </View>
          <View className="mt-4"><ArchiveRule ticks /></View>
        </View>

        <View className="bg-white px-5 pb-7">
          <View className="h-72 w-full overflow-hidden" style={{ backgroundColor: FIELD_COLORS.locked }}>
            {heroImageSource ? (
              <Image
                source={heroImageSource}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <FishThumb imageUrl={null} unlocked size={150} />
                <Text className="mt-5 text-[10px] tracking-[1.4px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
                  VERIFIED IMAGE PENDING
                </Text>
              </View>
            )}
          </View>
          {!localIllustration && fish.image_url ? (
            <TouchableOpacity
              disabled={!fish.image_source_url}
              onPress={() => fish.image_source_url && Linking.openURL(fish.image_source_url)}
              className="mt-2 self-end"
            >
              <Text className="text-[10px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
                {fish.image_attribution ?? "IMAGE SOURCE"} · {fish.image_license ?? "LICENSE 확인"}
              </Text>
            </TouchableOpacity>
          ) : null}
          <Text className="mt-6 text-[42px] leading-[50px]" style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}>
            {fish.name_ko ?? fish.name}
          </Text>
          <Text className="mt-2 text-[12px] italic leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
            {fish.name}
          </Text>
          <View className="mt-5 flex-row flex-wrap">
            {[getCatalogGroupLabel(fish.collection_group), ...fish.aliases].map((item) => (
              <View key={item} className="mb-2 mr-2 border px-3 py-2" style={{ borderColor: FIELD_COLORS.rule }}>
                <Text className="text-xs" style={{ color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont }}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <InfoSection index="01 · BASIC" title="기본 정보">
          <Label>표준명 · 통칭</Label>
          <Value>{fish.name_ko ?? "한국 표준명 확인 중"} · {aliases}</Value>
          {fish.scientific_synonyms.length > 0 ? (
            <View className="mt-4">
              <Label>이전 학명 · 동의어</Label>
              <Value>{fish.scientific_synonyms.join(" · ")}</Value>
            </View>
          ) : null}
          <View className="mt-5 flex-row border-y py-5" style={{ borderColor: FIELD_COLORS.rule }}>
            <Metric label="평균 크기" value={fish.average_size_cm ? `${fish.average_size_cm}cm` : "-"} />
            <Metric label="최대 크기" value={fish.max_size_cm ? `${fish.max_size_cm}cm` : "-"} />
            <Metric label="발견 난이도" value={`${fish.discovery_difficulty ?? "-"}/5`} />
          </View>
          <Text className="mt-5 text-[15px] leading-7" style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>
            {fish.description?.trim() || "기본 설명을 검토하고 있습니다."}
          </Text>
        </InfoSection>

        <View className="mx-5"><ArchiveRule /></View>

        <InfoSection index="02 · DISCOVERY" title="나의 발견 기록">
          <View className="flex-row border-y py-5" style={{ borderColor: FIELD_COLORS.rule }}>
            <Metric label="발견 횟수" value={`${discovery.count}회`} />
            <Metric label="개인 최고" value={discovery.bestSizeCm ? `${discovery.bestSizeCm}cm` : "-"} />
            <Metric
              label="첫 발견"
              value={discovery.firstCaughtAt ? formatNumericDate(discovery.firstCaughtAt) : "-"}
            />
          </View>
          <View className="mt-5">
            <Label>발견 장소</Label>
            <Value>{discovery.locations.length > 0 ? discovery.locations.join(" · ") : "아직 기록된 장소가 없습니다."}</Value>
          </View>
        </InfoSection>

        <View className="mx-5"><ArchiveRule /></View>

        <InfoSection index="03 · FIELD GUIDE" title="필드 가이드">
          <Label>주요 시즌</Label>
          <View className="mt-3 flex-row flex-wrap">
            {MONTHS.map((month, index) => {
              const active = seasonSet.has(index + 1);
              return (
                <View
                  key={month}
                  className="mb-2 mr-2 h-9 min-w-12 items-center justify-center border px-2"
                  style={{ borderColor: active ? FIELD_COLORS.teal : FIELD_COLORS.rule, backgroundColor: active ? FIELD_COLORS.teal : "transparent" }}
                >
                  <Text className="text-[11px]" style={{ color: active ? "white" : FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>{month}</Text>
                </View>
              );
            })}
          </View>
          <View className="mt-5"><Label>주요 지역 · 서식층</Label><Value>{fish.habitat_regions.join(" · ")} · {fish.depth_zone ?? "수심 정보 검토 중"}</Value></View>
          <View className="mt-5"><Label>환경</Label><Value>{fish.habitat_environment ?? "서식 환경 검토 중"}</Value></View>
          <View className="mt-5"><Label>대표 채비</Label><Value>{fish.fishing_methods.join(" · ") || "채비 정보 검토 중"}</Value></View>
          <View className="mt-5"><Label>미끼 · 루어</Label><Value>{fish.recommended_baits.join(" · ") || "미끼 정보 검토 중"}</Value></View>
          <Text className="mt-5 text-[11px] leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
            시즌과 채비는 지역·수온·출조 방식에 따라 달라지는 편집 가이드입니다.
          </Text>
        </InfoSection>

        <View className="mx-5"><ArchiveRule /></View>

        <InfoSection index="04 · IDENTIFICATION" title="식별 가이드">
          <Label>눈여겨볼 특징</Label>
          <Value>{fish.identification_features ?? "식별 특징 검토 중"}</Value>
          <View className="mt-5 border-l-4 pl-4" style={{ borderLeftColor: FIELD_COLORS.teal }}>
            <Label>유사종 구별</Label>
            <Value>{fish.similar_species_notes ?? "유사종 비교 정보를 준비 중입니다."}</Value>
          </View>
        </InfoSection>

        <View className="mx-5"><ArchiveRule /></View>

        <InfoSection index="05 · SAFETY & RULES" title="안전 · 규제">
          <View className="border-l-4 bg-white p-4" style={{ borderLeftColor: FIELD_COLORS.orange }}>
            <Label>취급 주의</Label>
            <Value>{fish.handling_cautions ?? "가시와 이빨을 확인한 뒤 안전 장비로 다룹니다."}</Value>
            <View className="mt-4"><Label>독성</Label><Value>{fish.toxicity ?? "독성 정보 검토 중"}</Value></View>
          </View>
          <View className="mt-5">
            {regulations.length > 0 ? regulations.map((regulation) => (
              <View key={regulation.id} className="mb-3 border bg-white p-4" style={{ borderColor: FIELD_COLORS.rule }}>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px]" style={{ color: FIELD_COLORS.orange, fontFamily: bodyExtraBoldFont }}>
                    {regulation.regulation_type === "closed_season" ? "금어기" : regulation.regulation_type === "minimum_weight" ? "금지체중" : "금지체장"}
                  </Text>
                  <Text className="text-[9px] tracking-[1px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>2026 VERIFIED</Text>
                </View>
                <Text className="mt-2 text-[14px] leading-6" style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>{regulation.rule_text}</Text>
                <TouchableOpacity className="mt-3 flex-row items-center" onPress={() => Linking.openURL(regulation.source_url)}>
                  <Text className="mr-2 text-[11px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont }}>해양수산부 원문</Text>
                  <FontAwesome name="external-link" size={11} color={FIELD_COLORS.teal} />
                </TouchableOpacity>
              </View>
            )) : (
              <View className="border bg-white p-4" style={{ borderColor: FIELD_COLORS.rule }}>
                <Text className="text-sm leading-6" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                  2026년 국가 기준에서 이 종에 연결된 금어기·금지체장 항목이 없습니다. 지역 조례는 별도로 확인하세요.
                </Text>
              </View>
            )}
          </View>
        </InfoSection>

        <View className="mx-5"><ArchiveRule /></View>

        <InfoSection index="06 · MY FIELD NOTES" title="나의 기록">
          {catches.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerStyle={{ paddingHorizontal: 20 }}>
              {catches.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  disabled={!item.trip_id}
                  onPress={() => item.trip_id && router.push(`/trips/${item.trip_id}`)}
                  className="mr-3 w-44 overflow-hidden border bg-white"
                  style={{ borderColor: FIELD_COLORS.rule }}
                >
                  <View className="h-32 items-center justify-center" style={{ backgroundColor: FIELD_COLORS.locked }}>
                    {item.thumbnail_url ?? item.image_url ? <Image source={{ uri: item.thumbnail_url ?? item.image_url! }} className="h-full w-full" resizeMode="cover" /> : <FontAwesome name="camera" size={22} color={FIELD_COLORS.muted} />}
                  </View>
                  <View className="p-3">
                    <Text className="text-[12px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>{item.location_name ?? "장소 미기록"}</Text>
                    <Text className="mt-1 text-[10px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>{formatDate(item.caught_at)}{item.size_cm ? ` · ${item.size_cm}cm` : ""}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity onPress={() => router.push("/record")} className="flex-row items-center justify-between border px-4 py-5" style={{ borderColor: FIELD_COLORS.rule }}>
              <View>
                <Text className="text-base" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>첫 발견을 기록해보세요</Text>
                <Text className="mt-1 text-xs" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>사진과 장소가 이곳에 쌓입니다.</Text>
              </View>
              <FontAwesome name="long-arrow-right" size={20} color={FIELD_COLORS.teal} />
            </TouchableOpacity>
          )}
        </InfoSection>

        <View className="mx-5"><ArchiveRule /></View>

        <InfoSection index="07 · SOURCES" title="출처 · 라이선스">
          {fish.image_source_url ? (
            <View className="mb-5 border bg-white p-4" style={{ borderColor: FIELD_COLORS.rule }}>
              <Label>대표 이미지</Label>
              <Value>{fish.image_attribution ?? "촬영자 정보 확인 중"}</Value>
              <Text className="mt-1 text-[11px]" style={{ color: FIELD_COLORS.orange, fontFamily: monoFont }}>
                {fish.image_license ?? "라이선스 확인 중"}
              </Text>
              <TouchableOpacity onPress={() => Linking.openURL(fish.image_source_url!)} className="mt-3 flex-row items-center">
                <Text className="mr-2 text-[11px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont }}>사진 원문 보기</Text>
                <FontAwesome name="external-link" size={11} color={FIELD_COLORS.teal} />
              </TouchableOpacity>
            </View>
          ) : (
            <View className="mb-5 border p-4" style={{ borderColor: FIELD_COLORS.rule }}>
              <Text className="text-sm leading-6" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                재사용 조건이 확인된 대표 이미지를 검토 중입니다.
              </Text>
            </View>
          )}
          {fish.guide_source_urls.map((url) => (
            <TouchableOpacity
              key={url}
              onPress={() => Linking.openURL(url)}
              className="flex-row items-center justify-between border-b py-4"
              style={{ borderBottomColor: FIELD_COLORS.rule }}
            >
              <Text className="text-[13px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>{sourceLabel(url)}</Text>
              <FontAwesome name="external-link" size={12} color={FIELD_COLORS.teal} />
            </TouchableOpacity>
          ))}
          <Text className="mt-5 text-[10px] leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
            GUIDE STATUS · {fish.guide_status.toUpperCase()}
          </Text>
        </InfoSection>
      </ScrollView>
    </View>
  );
};

export default FishDetailScreen;
