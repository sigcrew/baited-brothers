import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/src/contexts/AuthContext";
import { supabase } from "@/src/lib/supabase";
import { optimizeUserPhoto } from "@/src/lib/optimizeUserPhoto";
import { useUserAvatar } from "@/src/hooks/useUserAvatar";
import {
  removeUserMedia,
  uploadUserPhotoVariants,
} from "@/src/lib/userMedia";
import { SettingsScaffold } from "@/components/settings/SettingsScaffold";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
} from "@/src/theme/fieldJournal";

const DEFAULT_PROFILE_IMAGE = require("@/assets/images/adaptive-icon-baited.png");

export default function ProfileEditScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const signedAvatarUrl = useUserAvatar();
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDisplayName(
      session?.user.user_metadata?.display_name ??
        session?.user.user_metadata?.full_name ??
        "",
    );
  }, [session]);

  const currentAvatarUrl = signedAvatarUrl;
  const avatarSource = selectedAvatar?.uri
    ? { uri: selectedAvatar.uri }
    : !removeAvatar && currentAvatarUrl
      ? { uri: currentAvatarUrl }
      : DEFAULT_PROFILE_IMAGE;

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });
    if (result.canceled || !result.assets[0]) return;
    setSelectedAvatar(result.assets[0]);
    setRemoveAvatar(false);
  };

  const save = async () => {
    const nextName = displayName.trim();
    if (!nextName) {
      Alert.alert("이름을 입력해 주세요");
      return;
    }
    if (!session) return;
    setIsSaving(true);
    let uploadedPaths: string[] = [];

    try {
      let avatarPath = removeAvatar
        ? null
        : typeof session.user.user_metadata?.avatar_path === "string"
          ? session.user.user_metadata.avatar_path
          : null;
      let avatarUrl =
        removeAvatar || avatarPath
          ? null
          : typeof session.user.user_metadata?.avatar_url === "string"
            ? session.user.user_metadata.avatar_url
            : null;

      if (selectedAvatar) {
        const optimized = await optimizeUserPhoto({
          uri: selectedAvatar.uri,
          width: selectedAvatar.width,
          height: selectedAvatar.height,
          maxDimension: 768,
          compress: 0.75,
        });
        const uploaded = await uploadUserPhotoVariants({
          userId: session.user.id,
          folder: "profile",
          photo: optimized,
        });
        uploadedPaths = [uploaded.imagePath, uploaded.thumbnailPath];
        avatarUrl = null;
        avatarPath = uploaded.imagePath;
      }

      const previousAvatarPath =
        typeof session.user.user_metadata?.avatar_path === "string"
          ? session.user.user_metadata.avatar_path
          : null;
      const previousAvatarThumbnailPath =
        typeof session.user.user_metadata?.avatar_thumbnail_path === "string"
          ? session.user.user_metadata.avatar_thumbnail_path
          : null;
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: nextName,
          avatar_url: avatarUrl,
          avatar_path: avatarPath,
          avatar_thumbnail_path:
            removeAvatar
              ? null
              : uploadedPaths[1] ?? previousAvatarThumbnailPath,
        },
      });
      if (error) throw error;

      if (previousAvatarPath !== avatarPath) {
        await removeUserMedia([
          previousAvatarPath?.startsWith(`${session.user.id}/`)
            ? previousAvatarPath
            : null,
          previousAvatarThumbnailPath?.startsWith(`${session.user.id}/`)
            ? previousAvatarThumbnailPath
            : null,
        ]);
      }
    } catch {
      await removeUserMedia(uploadedPaths);
      setIsSaving(false);
      Alert.alert("저장 실패", "프로필 사진과 이름을 저장하지 못했습니다.");
      return;
    }

    setIsSaving(false);
    Alert.alert("저장 완료", "프로필을 변경했습니다.", [
      { text: "확인", onPress: () => router.back() },
    ]);
  };

  return (
    <SettingsScaffold
      eyebrow="PROFILE IDENTITY"
      title="프로필 수정"
      description="기록과 조과 카드에 표시되는 이름을 변경합니다."
    >
      {session ? (
        <>
          <View className="mt-7 items-center">
            <Image
              source={avatarSource}
              resizeMode="cover"
              style={{ width: 120, height: 120, borderRadius: 60 }}
            />
            <View className="mt-4 flex-row">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="프로필 사진 선택"
                disabled={isSaving}
                onPress={pickAvatar}
                className="border px-5 py-3"
                style={{
                  borderColor: FIELD_COLORS.teal,
                  backgroundColor: FIELD_COLORS.paper,
                }}
              >
                <Text
                  style={{
                    color: FIELD_COLORS.teal,
                    fontFamily: bodyExtraBoldFont,
                  }}
                >
                  사진 변경
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="기본 프로필 사진 사용"
                disabled={isSaving}
                onPress={() => {
                  setSelectedAvatar(null);
                  setRemoveAvatar(true);
                }}
                className="ml-2 border px-5 py-3"
                style={{
                  borderColor: FIELD_COLORS.rule,
                  backgroundColor: FIELD_COLORS.paper,
                }}
              >
                <Text
                  style={{
                    color: FIELD_COLORS.muted,
                    fontFamily: bodyExtraBoldFont,
                  }}
                >
                  기본 이미지
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text
            className="mt-8 text-sm"
            style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
          >
            표시 이름
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            editable={!isSaving}
            maxLength={24}
            placeholder="표시 이름"
            className="mt-3 border bg-white px-4 py-4"
            style={{
              borderColor: FIELD_COLORS.rule,
              color: FIELD_COLORS.ink,
              fontFamily: bodyFont,
            }}
          />
          <Text
            className="mt-5 text-sm"
            style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
          >
            로그인 이메일 · {session.user.email}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="프로필 저장"
            disabled={isSaving}
            onPress={save}
            className="mt-7 items-center py-4"
            style={{
              backgroundColor: isSaving
                ? FIELD_COLORS.locked
                : FIELD_COLORS.teal,
            }}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                className="text-base text-white"
                style={{ fontFamily: bodyExtraBoldFont }}
              >
                변경사항 저장
              </Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          onPress={() => router.push("/(auth)/login")}
          className="mt-6 items-center py-4"
          style={{ backgroundColor: FIELD_COLORS.teal }}
        >
          <Text className="text-white" style={{ fontFamily: bodyExtraBoldFont }}>
            로그인하기
          </Text>
        </TouchableOpacity>
      )}
    </SettingsScaffold>
  );
}
