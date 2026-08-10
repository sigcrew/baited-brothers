import { useRouter } from "expo-router";

import { ShareCatchCardModal } from "@/components/share/ShareCatchCardModal";
import type { ShareCatchData } from "@/src/lib/shareCard";

const PREVIEW_CATCH: ShareCatchData = {
  id: "field-catch-094",
  imageSource: require("@/assets/images/species/field60-illustrated/color/03-pseudopleuronectes-yokohamae.png"),
  fishName: "넙치",
  scientificName: "Paralichthys olivaceus",
  sizeCm: 42.5,
  caughtAt: "2026-08-10T05:30:00+09:00",
  regionLabel: "대한민국 남해",
  verificationStatus: "field_verified",
};

const SharePreviewScreen = () => {
  const router = useRouter();

  return (
    <ShareCatchCardModal
      item={PREVIEW_CATCH}
      visible
      onClose={() => router.replace("/(tabs)")}
      source="preview"
      initialShowRegion
    />
  );
};

export default SharePreviewScreen;
