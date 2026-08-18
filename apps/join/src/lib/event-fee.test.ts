import { describe, expect, it } from "vitest";
import { formatEventFee } from "./event-fee";

describe("formatEventFee", () => {
  it("shows on-site split settlement instead of free when instructions describe it", () => {
    expect(formatEventFee({ fee_amount: "0", fee_mode: "free", payment_instructions: "現場結算後分攤" })).toBe("現場結算後分攤");
  });

  it("shows a fixed TWD amount", () => {
    expect(formatEventFee({ fee_amount: "1000", fee_mode: "fixed", payment_instructions: null })).toBe("NT$ 1000");
  });
});
