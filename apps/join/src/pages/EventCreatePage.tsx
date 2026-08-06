import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createEvent, createOrganizer, getMyOrganizers, type OrganizerMembership } from "../lib/api";
import { useSession } from "../lib/useSession";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function defaultDateTimeLocal(hoursFromNow: number): string {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

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
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [confirmationMode, setConfirmationMode] = useState<"instant" | "organizer_confirmed">("instant");
  const [startsAt, setStartsAt] = useState(defaultDateTimeLocal(24 * 7));
  const [endsAt, setEndsAt] = useState(defaultDateTimeLocal(24 * 7 + 2));
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [hasCapacity, setHasCapacity] = useState(true);
  const [capacity, setCapacity] = useState(20);
  const [feeAmount, setFeeAmount] = useState(0);
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [hasMinAge, setHasMinAge] = useState(false);
  const [minAge, setMinAge] = useState(18);
  const [inviteOnly, setInviteOnly] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    getMyOrganizers()
      .then((rows) => {
        setOrganizers(rows);
        if (rows.length > 0) setOrganizerId(rows[0].organizer_id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "讀取主辦身份失敗"));
  }, [session]);

  if (loading) return null;
  if (!session) {
    navigate(`/auth?redirect=${encodeURIComponent("/events/new")}`, { replace: true });
    return null;
  }

  async function handleCreateOrganizer(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!newOrganizerName.trim()) {
      setError("請輸入主辦名稱");
      return;
    }
    setCreatingOrganizer(true);
    try {
      const slug = `${slugify(newOrganizerName)}-${Math.random().toString(36).slice(2, 6)}`;
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
    if (new Date(startsAt) >= new Date(endsAt)) {
      setError("結束時間必須晚於開始時間");
      return;
    }

    setBusy(true);
    try {
      const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
      const event_ = await createEvent({
        organizerId,
        slug,
        title: title.trim(),
        summary: summary.trim(),
        description: description.trim(),
        visibility,
        confirmationMode,
        timezone: "Asia/Taipei",
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        locationName: locationName.trim(),
        locationAddress: locationAddress.trim(),
        capacity: hasCapacity ? capacity : null,
        feeAmount,
        paymentInstructions: paymentInstructions.trim(),
        minAge: hasMinAge ? minAge : null,
        inviteOnly,
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
        <p className="eyebrow">來聚一場</p>
        <h1>先建立主辦身份</h1>
        <p style={{ color: "var(--muted)" }}>建立一次即可，之後開新活動都會用這個身份。</p>
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
              {creatingOrganizer ? "建立中…" : "建立主辦身份"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="page page--wide">
      <p className="eyebrow">建立新活動</p>
      <h1>{title.trim() || "新的聚場"}</h1>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <form className="stack" onSubmit={handleSubmit}>
        {organizers.length > 1 && (
          <div className="field">
            <label htmlFor="organizer">主辦身份</label>
            <select id="organizer" value={organizerId} onChange={(event) => setOrganizerId(event.target.value)}>
              {organizers.map((o) => (
                <option key={o.organizer_id} value={o.organizer_id}>
                  {o.organizers.display_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="card stack">
          <h2>基本資訊</h2>
          <div className="field">
            <label htmlFor="title">活動名稱</label>
            <input id="title" type="text" value={title} onChange={(event) => setTitle(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="summary">一句話簡介</label>
            <input id="summary" type="text" value={summary} onChange={(event) => setSummary(event.target.value)} />
          </div>
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
        </div>

        <div className="card stack">
          <h2>時間</h2>
          <div className="row">
            <div className="field">
              <label htmlFor="startsAt">開始時間</label>
              <input
                id="startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="endsAt">結束時間</label>
              <input
                id="endsAt"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="card stack">
          <h2>公開範圍與報名方式</h2>
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
              <option value="organizer_confirmed">主辦人逐一確認</option>
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
        </div>

        <div className="card stack">
          <h2>費用與收款說明</h2>
          <div className="field">
            <label htmlFor="feeAmount">費用（TWD，0 表示免費）</label>
            <input
              id="feeAmount"
              type="number"
              min={0}
              step="1"
              value={feeAmount}
              onChange={(event) => setFeeAmount(Number(event.target.value))}
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
        </div>

        <div className="actions">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "建立中…" : "建立活動"}
          </button>
        </div>
      </form>
    </div>
  );
}
