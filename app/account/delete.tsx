import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/contexts/AuthContext";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
} from "@/src/theme/fieldJournal";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deleteAccount, session } = useAuth();
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const canDelete = confirmation.trim() === "계정 삭제";
  const isAppleUser =
    session?.user.app_metadata?.provider === "apple" ||
    session?.user.identities?.some((identity) => identity.provider === "apple");

  const handleDelete = async () => {
    if (!canDelete || isDeleting) return;
    setIsDeleting(true);
    let appleAuthorizationCode: string | undefined;
    if (isAppleUser) {
      try {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [],
        });
        appleAuthorizationCode = credential.authorizationCode ?? undefined;
        if (!appleAuthorizationCode) {
          throw new Error("Apple 인증 코드를 받지 못했습니다.");
        }
      } catch (error) {
        setIsDeleting(false);
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "ERR_REQUEST_CANCELED"
        ) {
          return;
        }
        Alert.alert("Apple 확인 실패", "Apple 계정을 다시 확인해 주세요.");
        return;
      }
    }
    const { error } = await deleteAccount(appleAuthorizationCode);
    setIsDeleting(false);
    if (error) {
      Alert.alert("탈퇴 실패", "잠시 후 다시 시도해 주세요.");
      return;
    }
    router.replace("/(auth)/login");
  };

  return (
    <ScrollView
      className="flex-1 px-6"
      style={{ backgroundColor: FIELD_COLORS.foam, paddingTop: insets.top + 12 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <TouchableOpacity onPress={() => router.back()} className="py-3">
        <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
          ← 돌아가기
        </Text>
      </TouchableOpacity>
      <Text
        className="mt-5 text-[34px]"
        style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
      >
        계정 탈퇴
      </Text>
      <Text
        className="mt-5 text-sm leading-6"
        style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}
      >
        탈퇴하면 출조, 조과, 도감 해금 기록과 업로드한 사진이 삭제되며 복구할 수
        없습니다.
      </Text>
      <Text
        className="mt-8 text-sm"
        style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
      >
        계속하려면 ‘계정 삭제’를 입력하세요.
      </Text>
      <TextInput
        value={confirmation}
        onChangeText={setConfirmation}
        editable={!isDeleting}
        autoCapitalize="none"
        className="mt-3 border bg-white px-4 py-4"
        style={{ borderColor: FIELD_COLORS.rule, color: FIELD_COLORS.ink }}
        placeholder="계정 삭제"
      />
      <TouchableOpacity
        disabled={!canDelete || isDeleting}
        onPress={handleDelete}
        className="mt-5 items-center py-4"
        style={{
          backgroundColor: canDelete ? FIELD_COLORS.red : FIELD_COLORS.locked,
        }}
      >
        {isDeleting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white" style={{ fontFamily: bodyExtraBoldFont }}>
            모든 데이터 삭제 후 탈퇴
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
