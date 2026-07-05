import { useContext } from "react";
import { SessionContext } from "@/context/SessionContext";
import colors from "@/constants/colors";

export function useColors() {
  const { themePreference } = useContext(SessionContext);
  const theme = themePreference ?? "dark";
  return { ...colors[theme], radius: colors.radius };
}
