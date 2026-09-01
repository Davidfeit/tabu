import { describe, expect, it } from "vitest";
import { fakePeer } from "./peer-fixture";
import { framePlan, FRAME_GRACE_MS } from "./frames";

describe("מסלול התמונות", () => {
  const talking = fakePeer({ id: "pc", in: { offer: 1, answer: 1, ice: 2 } });
  const silent = fakePeer({ id: "phone" });

  it("שקט בתקופת החסד — וידאו אמיתי מקבל הזדמנות מלאה", () => {
    expect(framePlan([talking], [], FRAME_GRACE_MS - 1)).toEqual([]);
  });

  it("אחרי החסד: שולחים למי שחי בערוץ ואין ממנו וידאו", () => {
    expect(framePlan([talking, silent], [], FRAME_GRACE_MS)).toEqual(["pc"]);
  });

  it("עמית שותק לגמרי לא מקבל — שחקן טלפון בלי מסך וידאו", () => {
    expect(framePlan([silent], [], FRAME_GRACE_MS)).toEqual([]);
  });

  it("מי ששולח לנו תמונות נחשב חי גם בלי סיגנלינג", () => {
    expect(framePlan([silent], ["phone"], FRAME_GRACE_MS)).toEqual(["phone"]);
  });

  it("וידאו שזורם באמת עוצר את התמונות", () => {
    const streaming = fakePeer({
      id: "pc", in: { offer: 1, answer: 1, ice: 2 },
      stream: {} as MediaStream,
      video: { tracks: 1, live: true, muted: false },
    });
    expect(framePlan([streaming], [], FRAME_GRACE_MS)).toEqual([]);
  });
});
