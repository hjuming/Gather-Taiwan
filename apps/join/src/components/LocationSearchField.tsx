import { getGoogleMapsEmbedUrl, getGoogleMapsSearchUrl } from "../lib/event-links";

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
  const mapLocation = { location_name: locationName, location_address: locationAddress };
  const mapEmbedUrl = getGoogleMapsEmbedUrl(mapLocation);
  const mapSearchUrl = getGoogleMapsSearchUrl(mapLocation);

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
            placeholder="例如：105臺北市松山區南京東路五段250巷5-2號"
          />
        </div>
      </div>

      {mapEmbedUrl && (
        <div className="location-search__preview">
          <div className="location-search__preview-heading">
            <p className="section-kicker">地圖預覽</p>
            {mapSearchUrl && (
              <a className="btn-text" href={mapSearchUrl} target="_blank" rel="noreferrer">
                在 Google 地圖開啟 ↗
              </a>
            )}
          </div>
          <iframe
            key={mapEmbedUrl}
            src={mapEmbedUrl}
            title="Google 地圖預覽"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <p className="hint">地圖會依照目前輸入的地點名稱與地址預覽，儲存前請確認標記位置正確。</p>
        </div>
      )}
    </div>
  );
}
