import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { Alert, Platform } from "react-native";
import { supabase } from "@/src/lib/supabase";

type AppleSignInButtonProps = {
  fieldJournal?: boolean;
};

const AppleSignInButton = ({ fieldJournal = false }: AppleSignInButtonProps) => {
  if (Platform.OS !== "ios") return null;

  const handlePress = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) throw error;

      if (credential.fullName) {
        const fullName = [
          credential.fullName.givenName,
          credential.fullName.familyName,
        ]
          .filter(Boolean)
          .join(" ");
        await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            given_name: credential.fullName.givenName ?? undefined,
            family_name: credential.fullName.familyName ?? undefined,
          },
        });
      }

      router.replace("/(tabs)");
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "ERR_REQUEST_CANCELED"
      ) {
        return;
      }
      Alert.alert(
        "Apple 로그인 실패",
        e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다."
      );
    }
  };

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={
        fieldJournal
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={fieldJournal ? 4 : 12}
      style={{ width: "100%", height: fieldJournal ? 54 : 50 }}
      onPress={handlePress}
    />
  );
};

export default AppleSignInButton;
