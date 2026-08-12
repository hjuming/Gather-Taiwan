import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createEvent, createOrganizer, getMyOrganizers, type OrganizerMembership } from "../lib/api";
import { useSession } from "../lib/useSession";
import { createEventSlug, createSlug } from "../lib/slug";
import { getGoogleMapsEmbedUrl } from "../lib/event-links";
import { DEFAULT_GATHERING_TYPE, resolveCoverImage } from "../lib/gathering-types";
import { useErrorFocus } from "../lib/useErrorFocus";
import DateTimeField from "../components/DateTimeField";
import GatheringTypeField from "../components/GatheringTypeField";
import {
  addTaipeiDays,
  dateTimePartsToTaipeiIso,
  dateTimePartsToTimestamp,
  daysBetween,
  getDefaultEventDateTime,
  isValidTime,
  type DateTimeParts,
} from "../lib/date-time";

export default function EventCreatePage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  const [organizers, setOrganizers] = useState<OrganizerMembership[]>([]);
  const [organizerId, setOrganizerId] = useState("");
  const [newOrganizerName, setNewOrganizerName] = useState("");
  const [creatingOrganizer, setCreatingOrganizer] = useState(false);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  // 預設保守：同學會、家族聚餐這類場合多半不想被陌生人搜到，想公開的人自己改。
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("unlisted");
  const [confirmationMode, setConfirmationMode] = useState<"instant" | "organizer_confirmed">("instant");
  const [startsAt, setStartsAt] = useState<DateTimeParts>(() => getDefaultEventDateTime().startsAt);
  const [endsAt, setEndsAt] = useState<DateTimeParts>(() => getDefaultEventDateTime().endsAt);
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [hasCapacity, setHasCapacity] = useState(true);
  const [capacity, setCapacity] = useState(20);
  const [feeAmountInput, setFeeAmountInput] = useState("0");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [hasMinAge, setHasMinAge] = useState(false);
  const [minAge, setMinAge] = useState(18);
  const [inviteOnly, setInviteOnly] = useState(false);
  const [gatheringType, setGatheringType] = useState<string>(DEFAULT_GATHERING_TYPE);
  // null 代表沿用類型預設圖；主辦人自選後才寫入實際路徑。
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useErrorFocus(error);

  useEffect(() => {
    if (!session) return;
    getMyOrganizers()
      .then((rows) => {
        setOrganizers(rows);
        if (rows.length > 0) setOrganizerId(rows[0].organizer_id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "讀取主辦身份失敗"));
  }, [session]);

  useEffect(() => {
    if (!loading && !session) {
      navigate(`/auth?redirect=${encodeURIComponent("/events/new")}`, { replace: true });
    }
  }, [loading, session, navigate]);

  if (loading || !session) return null;

  async function handleCreateOrganizer(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!newOrganizerName.trim()) {
      setError("請輸入主辦名稱");
      return;
    }
    setCreatingOrganizer(true);
    try {
      const slug = createSlug(newOrganizerName, "organizer", 63);
      const id = await createOrganizer(slug, newOrganizerName.trim());
      const rows = await getMyOrganizers();
      setOrganizers(rows);
      setOrganizerId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立主辦身份失敗");
    } finally {
      setCreatingOrganizer(false);
    }
  }

  /**
   * 改開始日期時，結束日期跟著移動同樣的天數（沿用原本的時長）。
   * 不這樣做的話，改了開始日期就會留下「結束早於開始」的組合，
   * 而右側預覽只顯示開始日期，看不出來哪裡錯。
   */
  function handleStartsAtChange(next: DateTimeParts) {
    const dayShift = daysBetween(startsAt.date, next.date);
    if (dayShift !== 0) {
      setEndsAt((previous) => ({ ...previous, date: addTaipeiDays(previous.date, dayShift) }));
    }
    setStartsAt(next);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!organizerId) {
      setError("請先建立或選擇主辦身份");
      return;
    }
    if (!title.trim()) {
      setError("請輸入活動名稱");
      return;
    }
    if (!locationName.trim()) {
      setError("請輸入地點名稱");
      return;
    }
    if (!isValidTime(startsAt.time) || !isValidTime(endsAt.time)) {
      setError("請選擇有效的 24 小時制時間");
      return;
    }
    if (dateTimePartsToTimestamp(startsAt) >= dateTimePartsToTimestamp(endsAt)) {
      setError("結束時間必須晚於開始時間");
      return;
    }

    const feeAmount = feeAmountInput === "" ? 0 : Number(feeAmountInput);
    if (!Number.isSafeInteger(feeAmount) || feeAmount < 0) {
      setError("費用請填寫 0 或正整數");
      return;
    }

    setBusy(true);
    try {
      const slug = createEventSlug(title, startsAt.date, 95);
      const event_ = await createEvent({
        organizerId,
        slug,
        title: title.trim(),
        summary: summary.trim(),
        description: description.trim(),
        visibility,
        confirmationMode,
        timezone: "Asia/Taipei",
        startsAt: dateTimePartsToTaipeiIso(startsAt),
        endsAt: dateTimePartsToTaipeiIso(endsAt),
        locationName: locationName.trim(),
        locationAddress: locationAddress.trim(),
        capacity: hasCapacity ? capacity : null,
        feeAmount,
        paymentInstructions: paymentInstructions.trim(),
        minAge: hasMinAge ? minAge : null,
        inviteOnly,
        gatheringType,
        coverImageUrl,
      });
      navigate(`/e/${event_.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立活動失敗");
    } finally {
      setBusy(false);
    }
  }

  if (organizers.length === 0) {
    return (
      <div className="page">
        <p className="eyebrow">先留下一個名字</p>
        <h1>這場聚會，由誰發起？</h1>
        <p style={{ color: "var(--muted)" }}>留下一個大家認得的名字，之後每一次相約，都可以沿用。</p>
        {error && <div className="banner banner--error">{error}</div>}
        <form className="stack card" onSubmit={handleCreateOrganizer}>
          <div className="field">
            <label htmlFor="organizerName">主辦名稱</label>
            <input
              id="organizerName"
              type="text"
              value={newOrganizerName}
              onChange={(event) => setNewOrganizerName(event.target.value)}
              placeholder="例如：來聚一場 EiMBA 讀書會"
              required
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn-primary" disabled={creatingOrganizer}>
              {creatingOrganizer ? "準備中…" : "留下這個名字"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  const mapEmbedUrl = getGoogleMapsEmbedUrl({ location_name: locationName, location_address: locationAddress });

  return (
    <div className="page page--wide create-page">
      <header className="create-header">
        <div>
          <p className="eyebrow">準備一場聚會</p>
          <h1>{title.trim() || "新的聚會"}</h1>
          <p>有些台灣記憶，是從一張桌開始的。先把想見的人，約在同一個時間與地點。</p>
        </div>
        <span className="create-header__date">台北時間<br /><strong>24 小時制</strong></span>
      </header>

      <nav className="section-rail create-section-rail" aria-label="建立活動步驟">
        <a href="#create-basics">相聚內容</a>
        <a href="#create-time">見面時間</a>
        <a href="#create-access">誰可以來</a>
        <a href="#create-fee">到場方式</a>
      </nav>

      {error && (
        <div className="banner banner--error" role="alert" tabIndex={-1} ref={errorRef}>
          {error}
        </div>
      )}

      <form className="create-form" onSubmit={handleSubmit}>
        <div className="create-form__main stack">
        {organizers.length > 1 && (
          <div className="field">
            <label htmlFor="organizer">這場聚會的名字</label>
            <select id="organizer" value={organizerId} onChange={(event) => setOrganizerId(event.target.value)}>
              {organizers.map((o) => (
                <option key={o.organizer_id} value={o.organizer_id}>
                  {o.organizers.display_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <section id="create-basics" className="card stack form-section">
          <h2>聚會主題與場景</h2>
          <div className="field">
            <label htmlFor="title">活動名稱</label>
            <input id="title" type="text" value={title} onChange={(event) => setTitle(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="summary">一句話簡介</label>
            <input id="summary" type="text" value={summary} onChange={(event) => setSummary(event.target.value)} />
          </div>
          <GatheringTypeField
            gatheringType={gatheringType}
            coverImageUrl={coverImageUrl}
            onTypeChange={setGatheringType}
            onCoverChange={setCoverImageUrl}
          />
          <div className="field">
            <label htmlFor="description">活動說明</label>
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="活動內容、注意事項…"
            />
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="locationName">地點名稱</label>
              <input
                id="locationName"
                type="text"
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
                placeholder="例如：金色三麥 美麗華店"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="locationAddress">地址</label>
              <input
                id="locationAddress"
                type="text"
                value={locationAddress}
                onChange={(event) => setLocationAddress(event.target.value)}
              />
            </div>
          </div>
        </section>

        <section id="create-time" className="card stack form-section">
          <h2>什麼時候見面</h2>
          <p className="hint">台北時間，使用 24 小時制。預設為當日 18:30–21:30。</p>
          <DateTimeField id="startsAt" label="開始時間" value={startsAt} onChange={handleStartsAtChange} />
          <DateTimeField id="endsAt" label="結束時間" value={endsAt} onChange={setEndsAt} />
        </section>

        <section id="create-access" className="card stack form-section">
          <h2>誰可以來</h2>
          <div className="field">
            <label htmlFor="visibility">公開範圍</label>
            <select
              id="visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as typeof visibility)}
            >
              <option value="public">公開（任何人可搜尋到）</option>
              <option value="unlisted">不公開列表（有連結才能看到）</option>
              <option value="private">私密（僅受邀者可看到）</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="confirmationMode">確認方式</label>
            <select
              id="confirmationMode"
              value={confirmationMode}
              onChange={(event) => setConfirmationMode(event.target.value as typeof confirmationMode)}
            >
              <option value="instant">立即確認（額滿前自動確認）</option>
              <option value="organizer_confirmed">由你親自確認每一位</option>
            </select>
          </div>
          <div className="check-field">
            <input
              id="inviteOnly"
              type="checkbox"
              checked={inviteOnly}
              onChange={(event) => setInviteOnly(event.target.checked)}
            />
            <label htmlFor="inviteOnly">僅受邀者可報名</label>
          </div>
          <div className="check-field">
            <input
              id="hasCapacity"
              type="checkbox"
              checked={hasCapacity}
              onChange={(event) => setHasCapacity(event.target.checked)}
            />
            <label htmlFor="hasCapacity">設定人數上限</label>
          </div>
          {hasCapacity && (
            <div className="field">
              <label htmlFor="capacity">人數上限</label>
              <input
                id="capacity"
                type="number"
                min={1}
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
              />
            </div>
          )}
          <div className="check-field">
            <input
              id="hasMinAge"
              type="checkbox"
              checked={hasMinAge}
              onChange={(event) => setHasMinAge(event.target.checked)}
            />
            <label htmlFor="hasMinAge">設定最低年齡限制</label>
          </div>
          {hasMinAge && (
            <div className="field">
              <label htmlFor="minAge">最低年齡</label>
              <input
                id="minAge"
                type="number"
                min={0}
                max={120}
                value={minAge}
                onChange={(event) => setMinAge(Number(event.target.value))}
              />
            </div>
          )}
        </section>

        <section id="create-fee" className="card stack form-section">
          <h2>到場方式與費用</h2>
          <div className="field">
            <label htmlFor="feeAmount">費用（TWD，0 表示免費）</label>
            <input
              id="feeAmount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={feeAmountInput}
              onChange={(event) => setFeeAmountInput(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
          <div className="field">
            <label htmlFor="paymentInstructions">收款說明</label>
            <textarea
              id="paymentInstructions"
              value={paymentInstructions}
              onChange={(event) => setPaymentInstructions(event.target.value)}
              placeholder="例如：現場收費 / 匯款帳號…（平台不代收，僅顯示你填寫的說明）"
            />
          </div>
        </section>

        <div className="actions create-submit">
          <span>建立後可在「我發起的聚會」找到這一場</span>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "準備中…" : "把這場聚會建立起來"}
          </button>
        </div>
        </div>
        <aside className="create-form__aside" aria-label="聚會預覽">
          <div className="create-preview">
            <p className="section-kicker">桌邊先放一張椅子</p>
            <img
              className="create-preview__cover"
              src={resolveCoverImage({ cover_image_url: coverImageUrl, gathering_type: gatheringType })}
              alt=""
              loading="lazy"
            />
            <h2>{title.trim() || "新的聚會"}</h2>
            <p>{summary.trim() || "寫下一句，讓大家知道這次為什麼想見面。"}</p>
            <dl>
              {/* 跨日時必須把結束日期寫出來，否則預覽會掩蓋「結束早於開始」這類錯誤。 */}
              <div>
                <dt>時間</dt>
                <dd>
                  {startsAt.date === endsAt.date
                    ? `${startsAt.date}・${startsAt.time}–${endsAt.time}`
                    : `${startsAt.date} ${startsAt.time} – ${endsAt.date} ${endsAt.time}`}
                </dd>
              </div>
              <div><dt>地點</dt><dd>{locationName.trim() || "還在等一個地方"}</dd></div>
              <div><dt>席次</dt><dd>{hasCapacity ? `${capacity} 人` : "不限人數"}</dd></div>
              <div><dt>到場</dt><dd>{Number(feeAmountInput) > 0 ? `NT$ ${feeAmountInput}` : "免費"}</dd></div>
            </dl>
            {mapEmbedUrl && (
              <div className="create-preview__map">
                <iframe
                  key={mapEmbedUrl}
                  src={mapEmbedUrl}
                  title="活動地點地圖預覽"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
            <p className="create-preview__note">建立後，這段相聚會有自己的連結，可以送進 LINE 群組。</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
