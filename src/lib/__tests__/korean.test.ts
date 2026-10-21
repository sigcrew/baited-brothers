import { withRoParticle } from "@/src/lib/korean";

describe("withRoParticle", () => {
  it("uses 로 after a vowel or ㄹ and 으로 after other finals", () => {
    expect(withRoParticle("도다리")).toBe("도다리로");
    expect(withRoParticle("넙치")).toBe("넙치로");
    expect(withRoParticle("복섬")).toBe("복섬으로");
    expect(withRoParticle("우럭")).toBe("우럭으로");
    expect(withRoParticle("볼락")).toBe("볼락으로");
    expect(withRoParticle("가물치")).toBe("가물치로");
    expect(withRoParticle("쏨뱅이")).toBe("쏨뱅이로");
    expect(withRoParticle("돌돔")).toBe("돌돔으로");
    expect(withRoParticle("칠성장어")).toBe("칠성장어로");
    expect(withRoParticle("Sebastes")).toBe("Sebastes로");
  });
});
