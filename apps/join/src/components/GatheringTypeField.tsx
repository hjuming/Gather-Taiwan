import { useEffect, useState } from "react";
import { COVER_IMAGE_CHOICES, GATHERING_TYPES, getGatheringType } from "../lib/gathering-types";

/**
 * 聚會類型 + 代表圖。類型決定預設代表圖，主辦人可以再自行改選；
 * 沒有自選時 coverImageUrl 維持 null，之後換類型會跟著換圖。
 */
export default function GatheringTypeField({
  gatheringType,
  coverImageUrl,
  coverFile,
  onTypeChange,
  onCoverChange,
  onCoverFileChange,
}: {
  gatheringType: string;
  coverImageUrl: string | null;
  coverFile: File | null;
  onTypeChange: (value: string) => void;
  onCoverChange: (value: string | null) => void;
  onCoverFileChange: (value: File | null) => void;
}) {
  const type = getGatheringType(gatheringType);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!coverFile) {
      setFilePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(coverFile);
    setFilePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [coverFile]);

  const activeCover = filePreviewUrl ?? coverImageUrl ?? type.image;

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
          {coverFile
            ? `已選擇「${coverFile.name}」，儲存後會公開載入這張圖。`
            : coverImageUrl
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
                className={`btn-secondary cover-option${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                aria-label={`使用「${choice.label}」的圖當代表圖`}
                onClick={() => {
                  onCoverFileChange(null);
                  onCoverChange(choice.url === type.image ? null : choice.url);
                }}
              >
                <img src={choice.url} alt="" loading="lazy" width="160" height="100" />
                <span>{choice.label}</span>
              </button>
            );
          })}
        </div>
        <div className="cover-upload">
          <div className="cover-upload__actions">
            <label className="btn-secondary" htmlFor="coverImageUpload">上傳自己的圖片</label>
            {coverFile && (
              <button type="button" className="btn-text" onClick={() => onCoverFileChange(null)}>
                清除上傳圖片
              </button>
            )}
          </div>
          <input
            key={coverFile ? `${coverFile.name}-${coverFile.lastModified}` : "empty"}
            id="coverImageUpload"
            className="cover-upload__input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => onCoverFileChange(event.target.files?.[0] ?? null)}
          />
          <p className="hint cover-upload__warning">
            圖片會以公開網址載入；請勿上傳私人照片、聯絡資訊或不希望公開的內容。限 JPG、PNG、WebP，5 MB 以內。
          </p>
        </div>
      </fieldset>
    </div>
  );
}
