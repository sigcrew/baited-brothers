import { useEffect, useState } from "react";

import { useAuth } from "@/src/contexts/AuthContext";
import { createSignedUserMediaUrl } from "@/src/lib/userMedia";

export const useUserAvatar = () => {
  const { session } = useAuth();
  const metadata = session?.user.user_metadata;
  const avatarPath =
    typeof metadata?.avatar_thumbnail_path === "string"
      ? metadata.avatar_thumbnail_path
      : typeof metadata?.avatar_path === "string"
        ? metadata.avatar_path
        : null;
  const externalAvatarUrl =
    !avatarPath && typeof metadata?.avatar_url === "string"
      ? metadata.avatar_url
      : null;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(externalAvatarUrl);

  useEffect(() => {
    let active = true;
    if (!avatarPath) {
      setAvatarUrl(externalAvatarUrl);
      return () => {
        active = false;
      };
    }

    createSignedUserMediaUrl(avatarPath)
      .then((url) => {
        if (active) setAvatarUrl(url);
      })
      .catch(() => {
        if (active) setAvatarUrl(null);
      });

    return () => {
      active = false;
    };
  }, [avatarPath, externalAvatarUrl]);

  return avatarUrl;
};
