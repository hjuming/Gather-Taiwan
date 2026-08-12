import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getEventBySlug, updateEvent } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";
import type { EventRow } from "../lib/types";
import DateTimeField from "../components/DateTimeField";
import GatheringTypeField from "../components/GatheringTypeField";
import LocationSearchField from "../components/LocationSearchField";
import {
  dateTimePartsToTaipeiIso,
  dateTimePartsToTimestamp,
  getTaipeiDateTimeParts,
  isValidTime,
  type DateTimeParts,
} from "../lib/date-time";
import { DEFAULT_GATHERING_TYPE } from "../lib/gathering-types";
import { useErrorFocus } from "../lib/useErrorFocus";
import { removeEventCover, uploadEventCover, validateEventCoverFile } from "../lib/event-covers";

const TAIPEI = "Asia/Taipei";

export default function EventEditPage() {
  const { slug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const coverUploadFailed = searchParams.get("coverUpload") === "failed";
  const { session, loading } = useSession();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [confirmationMode, setConfirmationMode] = useState<"instant" | "organizer_confirmed">("instant");
  const [startsAt, setStartsAt] = useState<DateTimeParts>({ date: "", time: "18:30" });
  const [endsAt, setEndsAt] = useState<DateTimeParts>({ date: "", time: "21:30" });
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [hasCapacity, setHasCapacity] = useState(true);
  const [capacity, setCapacity] = useState(20);
  const [feeMode, setFeeMode] = useState<"free" | "fixed" | "on_site_split">("free");
  const [feeAmountInput, setFeeAmountInput] = useState("0");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [hasMinAge, setHasMinAge] = useState(false);
  const [minAge, setMinAge] = useState(18);
  const [gatheringType, setGatheringType] = useState<string>(DEFAULT_GATHERING_TYPE);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useErrorFocus(error);

  useEffect(() => {
    if (coverUploadFailed) {
      setError("聚會已建立，但代表圖上傳失敗；請重新選擇圖片後儲存。\n圖片會以公開網址載入，請勿放入私人內容。");
    }
  }, [coverUploadFailed]);

  useEffect(() => {
    if (!loading && !session) {
      navigate(`/auth?redirect=${encodeURIComponent(`/e/${slug}/edit`)}`, { replace: true });
    }
  }, [loading, session, navigate, slug]);

  useEffect(() => {
    if (!session || !slug) return;
    let cancelled = false;

    (async () => {
      try {
        const row = await getEventBySlug(slug);
        if (!row) {
          if (!cancelled) setLoadError("找不到這場聚會");
          return;
        }
        // 只有主辦團隊的管理者能編輯；用資料庫既有的判定函式，不在前端自行推斷權限。
        const { data: isAdmin } = await supabase.rpc("is_organizer_admin", {
          p_organizer_id: row.organizer_id,
        });
        if (cancelled) return;

        setEvent(row);
        setAllowed(Boolean(isAdmin));
        if (!isAdmin) return;

        setTitle(row.title);
        setSummary(row.summary ?? "");
        setDescription(row.description ?? "");
        setVisibility(row.visibility);
        setConfirmationMode(row.confirmation_mode);
        setStartsAt(getTaipeiDateTimeParts(new Date(row.starts_at)));
        setEndsAt(getTaipeiDateTimeParts(new Date(row.ends_at)));
        setLocationName(row.location_name ?? "");
        setLocationAddress(row.location_address ?? "");
        setHasCapacity(row.capacity !== null);
        if (row.capacity !== null) setCapacity(row.capacity);
        setFeeAmountInput(String(Number(row.fee_amount)));
        setFeeMode(row.fee_mode ?? (Number(row.fee_amount) > 0 ? "fixed" : /現場|分攤/.test(row.payment_instructions ?? "") ? "on_site_split" : "free"));
        setPaymentInstructions(row.payment_instructions ?? "");
        setHasMinAge(row.min_age !== null);
        if (row.min_age !== null) setMinAge(row.min_age);
        setGatheringType(row.gathering_type ?? DEFAULT_GATHERING_TYPE);
        setCoverImageUrl(row.cover_image_url);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "讀取聚會失敗");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, slug]);

  if (loading || !session) return null;

  if (loadError) {
    return (
      <div className="page">
        <div className="banner banner--error" role="alert">{loadError}</div>
      </div>
    );
  }

  if (!event || allowed === null) {
    return (
      <div className="page">
        <p className="hint">讀取中…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="page stack">
        <div className="banner banner--error" role="alert">只有這場聚會的主人可以編輯內容。</div>
        <div className="actions">
          <Link to={`/e/${slug}`} className="btn-secondary">回到聚會頁</Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    const row = event as EventRow;
    setError(null);

    if (!title.trim()) {
      setError("請填活動名稱");
      return;
    }
    if (!locationName.trim()) {
      setError("請填地點名稱");
      return;
    }
    if (!isValidTime(startsAt.time) || !isValidTime(endsAt.time)) {
      setError("請確認時間格式");
      return;
    }
    if (dateTimePartsToTimestamp(startsAt) >= dateTimePartsToTimestamp(endsAt)) {
      setError("結束時間必須晚於開始時間");
      return;
    }
    const feeAmount = feeMode === "fixed" && feeAmountInput !== "" ? Number(feeAmountInput) : 0;
    if (feeMode === "fixed" && (!Number.isSafeInteger(feeAmount) || feeAmount <= 0)) {
      setError("固定費用請填寫正整數；現場分攤請改選對應方式");
      return;
    }

    if (coverFile) {
      const coverError = await validateEventCoverFile(coverFile);
      if (coverError) {
        setError(coverError);
        return;
      }
    }

    setBusy(true);
    let uploadedCoverUrl: string | null = null;
    try {
      const nextCoverImageUrl = coverFile ? await uploadEventCover(row.id, coverFile) : coverImageUrl;
      uploadedCoverUrl = coverFile ? nextCoverImageUrl : null;
      await updateEvent(row.id, {
        title: title.trim(),
        summary: summary.trim(),
        description: description.trim(),
        visibility,
        confirmationMode,
        startsAt: dateTimePartsToTaipeiIso(startsAt),
        endsAt: dateTimePartsToTaipeiIso(endsAt),
        locationName: locationName.trim(),
        locationAddress: locationAddress.trim(),
        capacity: hasCapacity ? capacity : null,
        feeAmount,
        feeMode,
        paymentInstructions: paymentInstructions.trim(),
        minAge: hasMinAge ? minAge : null,
        gatheringType,
        coverImageUrl: nextCoverImageUrl,
      });
      if (coverImageUrl && coverImageUrl !== nextCoverImageUrl) {
        await removeEventCover(coverImageUrl).catch(() => undefined);
      }
      navigate(`/e/${row.slug}`);
    } catch (err) {
      if (uploadedCoverUrl) await removeEventCover(uploadedCoverUrl).catch(() => undefined);
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--wide create-page">
      <div className="create-header">
        <div>
          <p className="eyebrow">編輯聚會</p>
          <h1>{event.title}</h1>
          <p className="hint">時區固定為 {TAIPEI}。活動連結不會因為編輯而改變。</p>
        </div>
      </div>

      {error && <div className="banner banner--error" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}

      <form className="stack" onSubmit={handleSubmit}>
        <section className="card stack form-section">
          <h2>聚會主題與場景</h2>
          <div className="field">
            <label htmlFor="edit-title">活動名稱</label>
            <input id="edit-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="edit-summary">一句話簡介</label>
            <input id="edit-summary" type="text" value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <GatheringTypeField
            gatheringType={gatheringType}
            coverImageUrl={coverImageUrl}
            coverFile={coverFile}
            onTypeChange={setGatheringType}
            onCoverChange={setCoverImageUrl}
            onCoverFileChange={setCoverFile}
          />
          <div className="field">
            <label htmlFor="edit-description">活動說明</label>
            <textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <LocationSearchField
            locationName={locationName}
            locationAddress={locationAddress}
            onLocationNameChange={setLocationName}
            onLocationAddressChange={setLocationAddress}
          />
        </section>

        <section className="card stack form-section">
          <h2>什麼時候見面</h2>
          <DateTimeField id="edit-startsAt" label="開始時間" value={startsAt} onChange={setStartsAt} />
          <DateTimeField id="edit-endsAt" label="結束時間" value={endsAt} onChange={setEndsAt} />
        </section>

        <section className="card stack form-section">
          <h2>誰可以來</h2>
          <div className="field">
            <label htmlFor="edit-visibility">公開範圍</label>
            <select id="edit-visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>
              <option value="public">公開（任何人可搜尋到）</option>
              <option value="unlisted">不公開列表（有連結才能看到）</option>
              <option value="private">私密（僅受邀者可看到）</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="edit-confirmationMode">確認方式</label>
            <select id="edit-confirmationMode" value={confirmationMode} onChange={(e) => setConfirmationMode(e.target.value as typeof confirmationMode)}>
              <option value="instant">立即確認（額滿前自動確認）</option>
              <option value="organizer_confirmed">由你親自確認每一位</option>
            </select>
          </div>
          <div className="check-field">
            <input id="edit-hasCapacity" type="checkbox" checked={hasCapacity} onChange={(e) => setHasCapacity(e.target.checked)} />
            <label htmlFor="edit-hasCapacity">設定人數上限</label>
          </div>
          {hasCapacity && (
            <div className="field">
              <label htmlFor="edit-capacity">人數上限</label>
              <input id="edit-capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
            </div>
          )}
          <div className="check-field">
            <input id="edit-hasMinAge" type="checkbox" checked={hasMinAge} onChange={(e) => setHasMinAge(e.target.checked)} />
            <label htmlFor="edit-hasMinAge">設定年齡限制</label>
          </div>
          {hasMinAge && (
            <div className="field">
              <label htmlFor="edit-minAge">最低年齡</label>
              <input id="edit-minAge" type="number" min={0} value={minAge} onChange={(e) => setMinAge(Number(e.target.value))} />
            </div>
          )}
        </section>

        <section className="card stack form-section">
          <h2>費用</h2>
          <div className="field">
            <label htmlFor="edit-feeMode">費用方式</label>
            <select
              id="edit-feeMode"
              value={feeMode}
              onChange={(e) => {
                const nextMode = e.target.value as typeof feeMode;
                setFeeMode(nextMode);
                if (nextMode !== "fixed") setFeeAmountInput("0");
              }}
            >
              <option value="free">免費</option>
              <option value="fixed">固定費用</option>
              <option value="on_site_split">現場結算後分攤</option>
            </select>
          </div>
          {feeMode === "fixed" && (
          <div className="field">
            <label htmlFor="edit-fee">每人費用（TWD）</label>
            <input id="edit-fee" type="number" min={0} inputMode="numeric" value={feeAmountInput} onChange={(e) => setFeeAmountInput(e.target.value)} />
          </div>
          )}
          <div className="field">
            <label htmlFor="edit-paymentInstructions">收款說明</label>
            <textarea id="edit-paymentInstructions" value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} />
          </div>
        </section>

        <div className="actions create-submit">
          <Link to={`/e/${event.slug}`} className="btn-secondary">先不改了</Link>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "儲存中…" : "儲存修改"}
          </button>
        </div>
      </form>
    </div>
  );
}
