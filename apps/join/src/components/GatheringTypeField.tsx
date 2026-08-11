import { COVER_IMAGE_CHOICES, GATHERING_TYPES, getGatheringType } from "../lib/gathering-types";

/**
 * 聚會類型 + 代表圖。類型決定預設代表圖，主辦人可以再自行改選；
 * 沒有自選時 coverImageUrl 維持 null，之後換類型會跟著換圖。
 */
export default function GatheringTypeField({
  gatheringType,
  coverImageUrl,
  onTypeChange,
  onCoverChange,
}: {
  gatheringType: string;
  coverImageUrl: string | null;
  onTypeChange: (value: string) => void;
  onCoverChange: (value: string | null) => void;
}) {
  const type = getGatheringType(gatheringType);
  const activeCover = coverImageUrl ?? type.image;

  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="gatheringType">聚會類型</label>
        <select
          id="gatheringType"
          value={gatheringType}
          onChange={(event) => onTypeChange(event.target.value)}
        >
          {GATHERING_TYPES.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="hint">{type.hint}</span>
      </div>

      <fieldset className="fieldset-reset cover-picker">
        <legend>代表圖</legend>
        <p className="hint cover-picker__hint">
          {coverImageUrl
            ? "已自選代表圖，換聚會類型不會改動它。"
            : `目前使用「${type.label}」的預設圖，也可以自己換一張。`}
        </p>
        <div className="cover-picker__grid">
          {COVER_IMAGE_CHOICES.map((choice) => {
            const selected = activeCover === choice.url;
            return (
              <button
                key={choice.url}
                type="button"
                className={`cover-option${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onCoverChange(choice.url === type.image ? null : choice.url)}
              >
                <img src={choice.url} alt="" loading="lazy" width="160" height="100" />
                <span>{choice.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
