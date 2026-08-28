import { describe, expect, it } from "vitest";
import { DICE_MS } from "@/components/Dice";
import { walkPlan } from "./useTokenMotion";

const roll = { rolled: true, reduced: false };
const card = { rolled: false, reduced: false };

describe("תכנון תזוזה", () => {
  it("תזוזה מגלגול מחכה לסיום הקוביות", () => {
    // הדרישה: החייל יוצא לדרך רק אחרי שהקוביות נעצרו. חייל שיוצא מוקדם
    // מספר את התוצאה לפני שהספיקו לקרוא אותה.
    expect(walkPlan(0, 7, roll).delayMs).toBe(DICE_MS);
  });

  it("תזוזה מקלף אינה מחכה — אין קוביות להמתין להן", () => {
    expect(walkPlan(7, 11, card).delayMs).toBe(0);
  });

  it("הולך צעד-צעד לאורך המסלול, כולל היעד ובלי המוצא", () => {
    const p = walkPlan(38, 2, roll);
    expect(p.kind).toBe("walk");
    expect(p.steps).toEqual([39, 0, 1, 2]);
  });

  it("מרחק גדול מגלגול אפשרי הוא העברה, לא הליכה", () => {
    // מעצר בית מ-30 ל-10: מי שנשלח לשם לא עובר בזינוק, ואסור שייראה כאילו.
    const p = walkPlan(30, 10, card);
    expect(p.kind).toBe("jump");
    expect(p.steps).toEqual([]);
  });

  it("העברה שנובעת מגלגול עדיין מחכה לקוביות", () => {
    expect(walkPlan(30, 10, roll).delayMs).toBe(DICE_MS);
  });

  it("בהעדפת תנועה מופחתת אין הנפשה ואין השהיה", () => {
    const p = walkPlan(0, 7, { rolled: true, reduced: true });
    expect(p).toEqual({ kind: "jump", delayMs: 0, steps: [] });
  });

  it("בדיוק 12 עדיין הולכים, 13 כבר קופצים", () => {
    expect(walkPlan(0, 12, roll).kind).toBe("walk");
    expect(walkPlan(0, 13, roll).kind).toBe("jump");
  });
});
