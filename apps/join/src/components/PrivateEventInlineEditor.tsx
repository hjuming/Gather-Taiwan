import { useState, type FormEvent } from "react";
import { updateEvent } from "../lib/api";
import DateTimeField from "./DateTimeField";
import LocationSearchField from "./LocationSearchField";
import {
  dateTimePartsToTaipeiIso,
  dateTimePartsToTimestamp,
  getTaipeiDateTimeParts,
  isValidTime,
  type DateTimeParts,
} from "../lib/date-time";
import { removeEventCover, uploadEventCover, validateEventCoverFile } from "../lib/event-covers";
import type { EventRow } from "../lib/types";

export default function PrivateEventInlineEditor({
  event,
  onSaved,
  onCancel,
}: {
  event: EventRow;
  onSaved: (event: EventRow) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [summary, setSummary] = useState(event.summary ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [startsAt, setStartsAt] = useState<DateTimeParts>(getTaipeiDateTimeParts(new Date(event.starts_at)));
  const [endsAt, setEndsAt] = useState<DateTimeParts>(getTaipeiDateTimeParts(new Date(event.ends_at)));
  const [locationName, setLocationName] = useState(event.location_name ?? "");
  const [locationAddress, setLocationAddress] = useState(event.location_address ?? "");
  const [hasCapacity, setHasCapacity] = useState(event.capacity !== null);
  const [capacity, setCapacity] = useState(event.capacity ?? 8);
  const [feeMode, setFeeMode] = useState(event.fee_mode ?? "free");
  const [feeAmount, setFeeAmount] = useState(String(Number(event.fee_amount)));
  const [paymentInstructions, setPaymentInstructions] = useState(event.payment_instructions ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    setError(null);
    if (!title.trim()) return setError("請填活動名稱");
    if (!locationName.trim()) return setError("請填地點名稱");
    if (!startsAt.date || !endsAt.date || !isValidTime(startsAt.time) || !isValidTime(endsAt.time)) {
      return setError("請確認日期與時間");
    }
    if (dateTimePartsToTimestamp(startsAt) >= dateTimePartsToTimestamp(endsAt)) {
      return setError("結束時間必須晚於開始時間");
    }
    const numericFee = feeMode === "fixed" && feeAmount !== "" ? Number(feeAmount) : 0;
    if (feeMode === "fixed" && (!Number.isSafeInteger(numericFee) || numericFee <= 0)) {
      return setError("固定費用請填寫正整數");
    }
    if (hasCapacity && (!Number.isSafeInteger(capacity) || capacity < 1)) {
      return setError("人數上限請填寫正整數");
    }
    if (coverFile) {
      const coverError = await validateEventCoverFile(coverFile);
      if (coverError) return setError(coverError);
    }

    setBusy(true);
    let uploadedCoverUrl: string | null = null;
    try {
      const nextCoverUrl = coverFile ? await uploadEventCover(event.id, coverFile) : event.cover_image_url;
      uploadedCoverUrl = coverFile ? nextCoverUrl : null;
      const updated = await updateEvent(event.id, {
        title: title.trim(),
        summary: summary.trim(),
        description: description.trim(),
        visibility: event.visibility,
        confirmationMode: event.confirmation_mode,
        startsAt: dateTimePartsToTaipeiIso(startsAt),
        endsAt: dateTimePartsToTaipeiIso(endsAt),
        locationName: locationName.trim(),
        locationAddress: locationAddress.trim(),
        capacity: hasCapacity ? capacity : null,
        feeAmount: numericFee,
        feeMode,
        paymentInstructions: paymentInstructions.trim(),
        minAge: event.min_age,
        gatheringType: event.gathering_type ?? "other",
        coverImageUrl: nextCoverUrl,
      });
      if (event.cover_image_url && event.cover_image_url !== nextCoverUrl) {
        await removeEventCover(event.cover_image_url).catch(() => undefined);
      }
      onSaved(updated);
    } catch (err) {
      if (uploadedCoverUrl) await removeEventCover(uploadedCoverUrl).catch(() => undefined);
      setError(err instanceof Error ? err.message : "儲存修改失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="private-event-inline-editor stack--tight" onSubmit={handleSubmit}>
      {error && <div className="banner banner--error" role="alert">{error}</div>}
      <div className="field">
        <label htmlFor="inline-event-title">活動名稱</label>
        <input id="inline-event-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="inline-event-summary">一句話簡介</label>
        <input id="inline-event-summary" value={summary} onChange={(event) => setSummary(event.target.value)} />
      </div>
      <div className="private-event-inline-editor__date-time">
        <DateTimeField id="inline-event-start" label="開始時間" value={startsAt} onChange={setStartsAt} />
        <DateTimeField id="inline-event-end" label="結束時間" value={endsAt} onChange={setEndsAt} />
      </div>
      <LocationSearchField
        locationName={locationName}
        locationAddress={locationAddress}
        onLocationNameChange={setLocationName}
        onLocationAddressChange={setLocationAddress}
      />
      <div className="private-event-inline-editor__split">
        <div className="field">
          <label htmlFor="inline-event-capacity">人數上限</label>
          <input id="inline-event-capacity" type="number" min={1} value={hasCapacity ? capacity : ""} disabled={!hasCapacity} onChange={(event) => setCapacity(Number(event.target.value))} placeholder="不限人數" />
        </div>
        <label className="check-field" htmlFor="inline-event-has-capacity">
          <input id="inline-event-has-capacity" type="checkbox" checked={hasCapacity} onChange={(event) => setHasCapacity(event.target.checked)} />
          設定人數上限
        </label>
      </div>
      <div className="private-event-inline-editor__split">
        <div className="field">
          <label htmlFor="inline-event-fee-mode">費用方式</label>
          <select id="inline-event-fee-mode" value={feeMode} onChange={(event) => setFeeMode(event.target.value as typeof feeMode)}>
            <option value="free">免費</option>
            <option value="fixed">固定費用</option>
            <option value="on_site_split">現場結算後分攤</option>
          </select>
        </div>
        {feeMode === "fixed" && (
          <div className="field">
            <label htmlFor="inline-event-fee">每人費用（TWD）</label>
            <input id="inline-event-fee" type="number" min={1} value={feeAmount} onChange={(event) => setFeeAmount(event.target.value)} />
          </div>
        )}
      </div>
      <div className="field">
        <label htmlFor="inline-event-payment">費用說明</label>
        <textarea id="inline-event-payment" value={paymentInstructions} onChange={(event) => setPaymentInstructions(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="inline-event-description">活動說明</label>
        <textarea id="inline-event-description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="inline-event-cover">更換代表圖（選填）</label>
        <input id="inline-event-cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} />
        <p className="hint">代表圖會以公開網址顯示，請勿上傳私人內容。</p>
      </div>
      <div className="actions">
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? "儲存中…" : "儲存修改"}</button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>取消</button>
      </div>
    </form>
  );
}
