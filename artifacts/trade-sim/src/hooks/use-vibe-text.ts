import { useAuth } from "./use-auth";

/**
 * Returns one of two strings depending on the active vibe preference.
 * @param corporate  Shown in 'corporate' mode (analytics-focused copy).
 * @param theBoys    Shown in 'the_boys' mode (casual fantasy-focused copy).
 */
export function useVibeText(corporate: string, theBoys: string): string {
  const vibe = useAuth((s) =>
    s.user ? s.user.vibePreference : s.guestVibePreference
  );
  return vibe === "the_boys" ? theBoys : corporate;
}
