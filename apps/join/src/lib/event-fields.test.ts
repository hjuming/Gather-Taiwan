import { describe, expect, it } from "vitest";
import { validateEventAnswers, type EventFieldDefinition } from "./event-fields";

const fields: EventFieldDefinition[] = [
  {
    field_key: "name",
    label: "姓名",
    field_type: "short_text",
    is_required: true,
    options: null,
  },
  {
    field_key: "meal",
    label: "餐點",
    field_type: "single_choice",
    is_required: true,
    options: ["葷食", "素食"],
  },
  {
    field_key: "topics",
    label: "想聊的主題",
    field_type: "multiple_choice",
    is_required: false,
    options: ["工作", "旅行"],
  },
  {
    field_key: "agree",
    label: "同意活動規範",
    field_type: "boolean",
    is_required: true,
    options: null,
  },
];

describe("validateEventAnswers", () => {
  it("rejects missing required answers with the field label", () => {
    expect(validateEventAnswers(fields, {})).toBe("請填寫：姓名、餐點、同意活動規範");
  });

  it("accepts false as an answered required boolean", () => {
    expect(
      validateEventAnswers(fields, {
        name: "小明",
        meal: "素食",
        agree: false,
      }),
    ).toBeNull();
  });

  it("rejects a choice that is not in the field options", () => {
    expect(
      validateEventAnswers(fields, {
        name: "小明",
        meal: "海鮮",
        agree: true,
      }),
    ).toBe("「餐點」的選項無效");
  });

  it("rejects invalid values in a multiple-choice answer", () => {
    expect(
      validateEventAnswers(fields, {
        name: "小明",
        meal: "葷食",
        topics: ["工作", "不存在"],
        agree: true,
      }),
    ).toBe("「想聊的主題」的選項無效");
  });
});
