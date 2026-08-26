import { useCallback, useEffect, useState } from "react";

/**
 * מסך מלא.
 *
 * זה המנוף האמיתי לגודל הלוח: לוח ריבועי חסום ע"י גובה המסך, וכרום
 * הדפדפן גוזל ~80px מתוכו. במסך 1080p זה כ-8% נוספים ללוח.
 */
export function useFullscreen(): [boolean, () => void, boolean] {
  const supported = typeof document !== "undefined" && !!document.documentElement.requestFullscreen;
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    // באיפרים ובהקשרים מסוימים הבקשה נדחית; אין מה לעשות חוץ מלהתעלם.
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  return [active, toggle, supported];
}
