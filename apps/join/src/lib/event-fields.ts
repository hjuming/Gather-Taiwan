import type { FieldType } from "./types";

export interface EventFieldDefinition {
  field_key: string;
  label: string;
  field_type: FieldType;
  is_required: boolean;
  options: string[] | null;
}

export type EventAnswer = string | string[] | boolean | null | undefined;

function isMissing(answer: EventAnswer): boolean {
  return answer === null || answer === undefined || (typeof answer === "string" && answer.trim() === "");
}

export function validateEventAnswers(
  fields: EventFieldDefinition[],
  answers: Record<string, EventAnswer>,
): string | null {
  const missing = fields.filter((field) => {
    if (!field.is_required) return false;
    const answer = answers[field.field_key];
    if (field.field_type === "multiple_choice") {
      return !Array.isArray(answer) || answer.length === 0;
    }
    if (field.field_type === "boolean") return typeof answer !== "boolean";
    return isMissing(answer);
  });

  if (missing.length > 0) return `請填寫：${missing.map((field) => field.label).join("、")}`;

  for (const field of fields) {
    const answer = answers[field.field_key];
    if (answer === null || answer === undefined || answer === "") continue;

    if (field.field_type === "short_text" || field.field_type === "long_text") {
      if (typeof answer !== "string") return `「${field.label}」格式無效`;
      continue;
    }

    if (field.field_type === "single_choice") {
      if (typeof answer !== "string" || !field.options?.includes(answer)) {
        return `「${field.label}」的選項無效`;
      }
      continue;
    }

    if (field.field_type === "multiple_choice") {
      if (
        !Array.isArray(answer) ||
        answer.some((value) => typeof value !== "string" || !field.options?.includes(value))
      ) {
        return `「${field.label}」的選項無效`;
      }
      continue;
    }

    if (field.field_type === "boolean" && typeof answer !== "boolean") {
      return `「${field.label}」格式無效`;
    }
  }

  return null;
}
