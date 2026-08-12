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
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
    ref.current.focus({ preventScroll: true });
  }, [error]);

  return ref;
}
