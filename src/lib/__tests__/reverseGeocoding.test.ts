import * as Location from "expo-location";

import { reverseGeocodeKoreanPlaceName } from "@/src/lib/reverseGeocoding";

jest.mock("expo-location", () => ({
  reverseGeocodeAsync: jest.fn(),
}));

const reverseGeocodeAsync = Location.reverseGeocodeAsync as jest.MockedFunction<
  typeof Location.reverseGeocodeAsync
>;

const address = (
  values: Partial<Location.LocationGeocodedAddress>,
): Location.LocationGeocodedAddress => ({
  city: null,
  country: "대한민국",
  district: null,
  formattedAddress: null,
  isoCountryCode: "KR",
  name: null,
  postalCode: null,
  region: null,
  street: null,
  streetNumber: null,
  subregion: null,
  timezone: null,
  ...values,
});

describe("reverseGeocodeKoreanPlaceName", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the direct administrative district for a land coordinate", async () => {
    reverseGeocodeAsync.mockResolvedValue([
      address({ district: "연제구", region: "부산광역시" }),
    ]);

    await expect(
      reverseGeocodeKoreanPlaceName({
        latitude: 35.1796,
        longitude: 129.0756,
      }),
    ).resolves.toEqual({ name: "연제구", countryCode: "KR" });
    expect(reverseGeocodeAsync).toHaveBeenCalledTimes(1);
  });

  it("uses the nearest coast address for an offshore coordinate", async () => {
    reverseGeocodeAsync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        address({ city: "제주시", region: "제주특별자치도" }),
      ]);

    await expect(
      reverseGeocodeKoreanPlaceName({
        latitude: 33.1,
        longitude: 126.2,
      }),
    ).resolves.toEqual({ name: "제주시 앞바다", countryCode: "KR" });
    expect(reverseGeocodeAsync).toHaveBeenCalledTimes(2);
    expect(reverseGeocodeAsync.mock.calls[1][0]).not.toEqual({
      latitude: 33.1,
      longitude: 126.2,
    });
  });

  it("does not replace a foreign direct result with a Korean coast", async () => {
    reverseGeocodeAsync.mockResolvedValue([
      address({
        country: "일본",
        district: null,
        isoCountryCode: "JP",
        region: null,
      }),
    ]);

    await expect(
      reverseGeocodeKoreanPlaceName({
        latitude: 34,
        longitude: 132,
      }),
    ).resolves.toEqual({ name: null, countryCode: "JP" });
    expect(reverseGeocodeAsync).toHaveBeenCalledTimes(1);
  });
});
