import { useEffect, useRef } from "react";

/**
 * 表單送出失敗時，把錯誤訊息帶到使用者眼前。
 *
 * 長表單的錯誤橫幅在最上方，而送出鈕在最下方——實測相距約 1800px，
 * 按下送出後畫面完全沒有變化，使用者會以為網站壞掉。
 * 這裡在錯誤出現時捲動到橫幅並給它焦點，讓螢幕閱讀器也會朗讀。
 */
export function useErrorFocus<T extends HTMLElement = HTMLDivElement>(error: string | null) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!error || !ref.current) return;
    // 順序很重要：focus() 會中斷進行中的捲動，所以先取得焦點（不捲動）再捲到定位。
    ref.current.focus({ preventScroll: true });
    // 這裡刻意用 instant 而不是 smooth。橫幅插進頁面頂端會把下方內容往下推，
    // 瀏覽器的 scroll anchoring 為了維持閱讀位置會反向捲動，實測會直接吃掉 smooth
    // 動畫（正式站量測：smooth 完全沒有位移，instant 正確置中）。
    ref.current.scrollIntoView({ behavior: "instant", block: "center" });
  }, [error]);

  return ref;
}
