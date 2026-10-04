// When to offer "Add Brew Bowl to your home screen". Kept free of React so it can be tested.

export const INSTALL_DISMISSED_KEY = "bbb:install-dismissed";

/** The card is for a browser tab: not for the app already running from the home screen, and not
 * again once the person said "Not now" on this phone. */
export function shouldShowInstallCard(input: { standalone: boolean; dismissed: boolean }): boolean {
  return !input.standalone && !input.dismissed;
}

/** Whether the page is running as an installed app (Android, desktop, or iOS home-screen). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios || (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches);
}
