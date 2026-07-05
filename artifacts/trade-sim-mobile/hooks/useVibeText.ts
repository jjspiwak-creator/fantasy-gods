import { useSession } from "@/context/SessionContext";

export type VibePreference = "corporate" | "the_boys" | "coach_speak" | "vegas_degenerate";

/**
 * Returns one of up to four strings based on the active vibe preference.
 *
 * @param corporate        Analytics-focused copy (default).
 * @param theBoys          Casual fantasy-focused copy.
 * @param coachSpeak       Intense football clichés and press-conference cadence.
 *                         Falls back to theBoys when omitted — existing 2-arg
 *                         call sites continue to work without modification.
 * @param vegasDegenerate  Sports-betting jargon — units, spreads, parlays.
 *                         Falls back to theBoys when omitted.
 */
export function useVibeText(
  corporate: string,
  theBoys: string,
  coachSpeak?: string,
  vegasDegenerate?: string,
): string {
  const { vibePreference } = useSession();
  if (vibePreference === "the_boys") return theBoys;
  if (vibePreference === "coach_speak") return coachSpeak ?? theBoys;
  if (vibePreference === "vegas_degenerate") return vegasDegenerate ?? theBoys;
  return corporate;
}
