import { useEffect } from "react";
import { useLocation } from "react-router";

/** Every new page opens at the top. Only a change of page does it (not a tab or filter inside one,
 * which only changes the query string). */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
