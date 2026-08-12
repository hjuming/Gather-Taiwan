import { useRef, useState } from "react";

interface AddressSearchResult {
  place_id: number;
  osm_type: string;
  osm_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string | null;
}

interface LocationSearchFieldProps {
  locationName: string;
  locationAddress: string;
  onLocationNameChange: (value: string) => void;
  onLocationAddressChange: (value: string) => void;
}

export default function LocationSearchField({
  locationName,
  locationAddress,
  onLocationNameChange,
  onLocationAddressChange,
}: LocationSearchFieldProps) {
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSearchAt = useRef(0);

  async function searchAddress() {
    const query = locationName.trim();
    if (query.length < 2) {
      setError("請先輸入至少 2 個字，再查詢地址");
      setResults([]);
      return;
    }

    const now = Date.now();
    if (now - lastSearchAt.current < 1000) {
      setError("請稍候再查詢一次");
      return;
    }
    lastSearchAt.current = now;
    setSearching(true);
    setError(null);

    try {
      const response = await fetch(`/app/api/address-search?q=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as AddressSearchResult[] | { error?: string } | null;
      if (!response.ok || !Array.isArray(payload)) {
        throw new Error("address_search_unavailable");
      }
      setResults(payload);
      if (payload.length === 0) setError("找不到相符地點，請補上區域或分店名稱再試一次");
    } catch {
      setResults([]);
      setError("地址查詢暫時無法使用，請直接貼上地址");
    } finally {
      setSearching(false);
    }
  }

  function chooseAddress(result: AddressSearchResult) {
    onLocationAddressChange(result.display_name);
    setResults([]);
    setError(null);
  }

  return (
    <div className="location-search stack--tight">
      <div className="row location-search__fields">
        <div className="field">
          <label htmlFor="locationName">地點名稱</label>
          <input
            id="locationName"
            type="text"
            value={locationName}
            onChange={(event) => onLocationNameChange(event.target.value)}
            placeholder="例如：魚菜居酒屋"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="locationAddress">地址</label>
          <input
            id="locationAddress"
            type="text"
            value={locationAddress}
            onChange={(event) => onLocationAddressChange(event.target.value)}
            placeholder="查詢後選一筆，或自行貼上地址"
          />
        </div>
      </div>

      <div className="location-search__actions">
        <button type="button" className="btn-secondary" onClick={searchAddress} disabled={searching}>
          {searching ? "查詢中…" : "查詢地址"}
        </button>
        <span className="hint">輸入地點名稱後按查詢，再點選正確地址回填。</span>
      </div>

      {error && <p className="hint location-search__message" role="status">{error}</p>}

      {results.length > 0 && (
        <div className="location-search__results" role="listbox" aria-label="地址查詢結果">
          {results.map((result) => (
            <button
              key={`${result.osm_type}-${result.osm_id}-${result.place_id}`}
              type="button"
              className="btn-text location-search__result"
              onClick={() => chooseAddress(result)}
            >
              {result.display_name}
            </button>
          ))}
        </div>
      )}

      <p className="hint location-search__attribution">
        地址資料由 OpenStreetMap 貢獻者提供；查詢只在你按下按鈕時送出。
        <a className="btn-text" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          查看資料授權
        </a>
      </p>
    </div>
  );
}
