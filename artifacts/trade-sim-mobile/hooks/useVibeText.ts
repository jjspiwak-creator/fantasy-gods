import { useSession } from "@/context/SessionContext";

/**
 * Returns one of two strings depending on the active vibe preference.
 * @param corporate  Shown in 'corporate' mode (analytics-focused copy).
 * @param theBoys    Shown in 'the_boys' mode (casual fantasy-focused copy).
 */
export function useVibeText(corporate: string, theBoys: string): string {
  const { vibePreference } = useSession();
  return vibePreference === "the_boys" ? theBoys : corporate;
}
