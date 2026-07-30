import * as Location from "expo-location";

import { ensureForegroundLocationPermission } from "@/src/lib/locationPermission";

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

const getForegroundPermissionsAsync =
  Location.getForegroundPermissionsAsync as jest.MockedFunction<
    typeof Location.getForegroundPermissionsAsync
  >;
const requestForegroundPermissionsAsync =
  Location.requestForegroundPermissionsAsync as jest.MockedFunction<
    typeof Location.requestForegroundPermissionsAsync
  >;

describe("ensureForegroundLocationPermission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reuses an existing permission grant", async () => {
    getForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    } as Awaited<ReturnType<typeof Location.getForegroundPermissionsAsync>>);

    await expect(ensureForegroundLocationPermission()).resolves.toBe(true);
    expect(requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("requests permission when Android can ask again", async () => {
    getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as Awaited<ReturnType<typeof Location.getForegroundPermissionsAsync>>);
    requestForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    } as Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>);

    await expect(ensureForegroundLocationPermission()).resolves.toBe(true);
    expect(requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("does not prompt again after a permanent denial", async () => {
    getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    } as Awaited<ReturnType<typeof Location.getForegroundPermissionsAsync>>);

    await expect(ensureForegroundLocationPermission()).resolves.toBe(false);
    expect(requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});
