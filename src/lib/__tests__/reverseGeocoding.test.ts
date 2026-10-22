import * as Location from "expo-location";

import { reverseGeocodeKoreanPlaceName } from "@/src/lib/reverseGeocoding";

jest.mock("expo-location", () => ({
  reverseGeocodeAsync: jest.fn(),
}));
jest.mock("@/src/lib/regionLookup", () => ({
  lookupKoreanRegionName: jest.fn(),
}));

import { lookupKoreanRegionName } from "@/src/lib/regionLookup";

const serverLookup = lookupKoreanRegionName as jest.MockedFunction<typeof lookupKoreanRegionName>;

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
    serverLookup.mockResolvedValue(null);
  });

  it("uses the server lookup when the device geocoder throws (Android without location permission)", async () => {
    reverseGeocodeAsync.mockRejectedValue(new Error("Not authorized to use location services"));
    serverLookup.mockResolvedValue("충청남도 보령시");

    await expect(
      reverseGeocodeKoreanPlaceName({ latitude: 36.3313, longitude: 126.6128 }),
    ).resolves.toEqual({ name: "충청남도 보령시", countryCode: "KR" });
    expect(serverLookup).toHaveBeenCalledTimes(1);
  });

  it("names an offshore point from the server lookup of the nearest coast", async () => {
    reverseGeocodeAsync.mockRejectedValue(new Error("Not authorized to use location services"));
    serverLookup.mockResolvedValueOnce(null).mockResolvedValueOnce("제주특별자치도 제주시");

    await expect(
      reverseGeocodeKoreanPlaceName({ latitude: 33.1, longitude: 126.2 }),
    ).resolves.toEqual({ name: "제주특별자치도 제주시 앞바다", countryCode: "KR" });
    expect(serverLookup).toHaveBeenCalledTimes(2);
  });

  it("does not call the server when the device geocoder already named the place", async () => {
    reverseGeocodeAsync.mockResolvedValue([
      address({ district: "연제구", region: "부산광역시" }),
    ]);
    await reverseGeocodeKoreanPlaceName({ latitude: 35.1796, longitude: 129.0756 });
    expect(serverLookup).not.toHaveBeenCalled();
  });

  it("returns no name when both the device and the server have nothing", async () => {
    reverseGeocodeAsync.mockRejectedValue(new Error("Not authorized to use location services"));
    await expect(
      reverseGeocodeKoreanPlaceName({ latitude: 36.3313, longitude: 126.6128 }),
    ).resolves.toEqual({ name: null, countryCode: null });
  });

  it("combines the province and district for a land coordinate", async () => {
    reverseGeocodeAsync.mockResolvedValue([
      address({ district: "연제구", region: "부산광역시" }),
    ]);

    await expect(
      reverseGeocodeKoreanPlaceName({
        latitude: 35.1796,
        longitude: 129.0756,
      }),
    ).resolves.toEqual({ name: "부산광역시 연제구", countryCode: "KR" });
    expect(reverseGeocodeAsync).toHaveBeenCalledTimes(1);
  });

  it("combines the province and city for an offshore coordinate", async () => {
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
    ).resolves.toEqual({
      name: "제주특별자치도 제주시 앞바다",
      countryCode: "KR",
    });
    expect(reverseGeocodeAsync).toHaveBeenCalledTimes(2);
    expect(reverseGeocodeAsync.mock.calls[1][0]).not.toEqual({
      latitude: 33.1,
      longitude: 126.2,
    });
  });

  it("removes duplicated platform address fields", async () => {
    reverseGeocodeAsync.mockResolvedValue([
      address({
        city: "서울",
        district: "강남구",
        region: "서울특별시",
        subregion: "강남구",
      }),
    ]);

    await expect(
      reverseGeocodeKoreanPlaceName({
        latitude: 37.52,
        longitude: 127.05,
      }),
    ).resolves.toEqual({
      name: "서울특별시 강남구",
      countryCode: "KR",
    });
  });

  it("keeps each level when province and city share the same root name", async () => {
    reverseGeocodeAsync.mockResolvedValue([
      address({ city: "제주시", region: "제주특별자치도" }),
    ]);

    await expect(
      reverseGeocodeKoreanPlaceName({
        latitude: 33.51,
        longitude: 126.52,
      }),
    ).resolves.toEqual({
      name: "제주특별자치도 제주시",
      countryCode: "KR",
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
