import { describe, it, expect } from "vitest";
import type { GameState } from "@/engine/types";
import { errorText } from "./messages";

describe("למה אי אפשר לעשות את זה", () => {
  // "אי אפשר לעשות את זה עכשיו" נכון תמיד ולא עוזר לעולם. המשחק יודע
  // בדיוק מה הוא מחכה לו, ולכן הוא אומר את זה.
  const at = (phase: GameState["phase"], drawnCard: unknown = null) =>
    errorText("WRONG_PHASE", { phase, drawnCard } as GameState);

  it("מצביע על מה שחוסם בפועל", () => {
    expect(at("awaiting_roll")).toContain("לגלגל");
    expect(at("awaiting_buy")).toContain("קנייה או ויתור");
    expect(at("awaiting_end")).toContain("לסיים תור");
    expect(at("debt")).toContain("חוב");
  });

  it("כרטיס פתוח קודם לכל שאר ההסברים", () => {
    expect(at("awaiting_end", { kind: "chance" })).toContain("כרטיס פתוח");
  });

  it("בלי מצב, נשארת ההודעה הכללית", () => {
    expect(errorText("WRONG_PHASE")).toBe("אי אפשר לעשות את זה עכשיו");
  });
});
