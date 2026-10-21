import { resolveCompletionActions } from "@/components/record/CatchCompletionView";

const keys = (actions: ReturnType<typeof resolveCompletionActions>) => actions.map((action) => action.key);
const primary = (actions: ReturnType<typeof resolveCompletionActions>) =>
  actions.filter((action) => action.variant === "primary");

describe("resolveCompletionActions", () => {
  it("returns to the trip as the single primary action when recording during a trip", () => {
    const actions = resolveCompletionActions({
      isFirstDiscovery: false,
      hasFish: true,
      tripName: "대천항",
      canReturnToTrip: true,
      canRecordAnother: true,
    });
    expect(primary(actions)).toEqual([{ key: "trip", label: "대천항 출조로 돌아가기", variant: "primary" }]);
    expect(keys(actions)).toEqual(["trip", "share", "another", "record"]);
    expect(keys(actions)).not.toContain("home");
  });

  it("falls back to a generic trip label when the name is blank", () => {
    const [first] = resolveCompletionActions({
      isFirstDiscovery: true,
      hasFish: true,
      tripName: "  ",
      canReturnToTrip: true,
      canRecordAnother: false,
    });
    expect(first.label).toBe("출조 기록으로 돌아가기");
  });

  it("promotes the encyclopedia for a first discovery outside a trip", () => {
    const actions = resolveCompletionActions({
      isFirstDiscovery: true,
      hasFish: true,
      canReturnToTrip: false,
      canRecordAnother: false,
    });
    expect(primary(actions)).toEqual([{ key: "encyclopedia", label: "도감 보기", variant: "primary" }]);
    expect(keys(actions)).toEqual(["encyclopedia", "share", "home"]);
  });

  it("promotes the card for a known species, and never the encyclopedia without a fish", () => {
    const known = resolveCompletionActions({ isFirstDiscovery: false, hasFish: true, canReturnToTrip: false, canRecordAnother: false });
    expect(primary(known)[0].key).toBe("record");

    const custom = resolveCompletionActions({ isFirstDiscovery: true, hasFish: false, canReturnToTrip: false, canRecordAnother: false });
    expect(primary(custom)[0].key).toBe("record");
  });

  it("always has exactly one primary action", () => {
    for (const isFirstDiscovery of [true, false]) {
      for (const canReturnToTrip of [true, false]) {
        for (const canRecordAnother of [true, false]) {
          const actions = resolveCompletionActions({ isFirstDiscovery, hasFish: true, canReturnToTrip, canRecordAnother });
          expect(primary(actions)).toHaveLength(1);
          expect(actions.length).toBeLessThanOrEqual(4);
        }
      }
    }
  });
});
