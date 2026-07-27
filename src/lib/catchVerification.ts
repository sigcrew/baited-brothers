type CatchVerificationInput = {
  captureMethod?: "live_camera" | "development_upload";
  latitude?: number;
  longitude?: number;
  locationCapturedAt?: string;
};

export const getCatchVerificationStatus = ({
  captureMethod,
  latitude,
  longitude,
  locationCapturedAt,
}: CatchVerificationInput): "verified" | "unverified" => {
  if (captureMethod === "development_upload") return "verified";

  return latitude != null &&
    longitude != null &&
    locationCapturedAt != null
    ? "verified"
    : "unverified";
};
