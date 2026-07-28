type CatchVerificationInput = {
  captureMethod?: "live_camera" | "photo_library" | "development_upload";
  latitude?: number;
  longitude?: number;
  capturedAt?: string;
};

export const getCatchVerificationStatus = ({
  captureMethod,
  latitude,
  longitude,
  capturedAt,
}: CatchVerificationInput): "pending" | "general_record" => {
  return (captureMethod === "live_camera" ||
    captureMethod === "photo_library") &&
    latitude != null &&
    longitude != null &&
    capturedAt != null
    ? "pending"
    : "general_record";
};
