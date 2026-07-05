const colors = {
  dark: {
    text: "#f0f6ff",
    tint: "#08d4f0",

    background: "#060d1f",
    foreground: "#f0f6ff",

    card: "#0e1a30",
    cardForeground: "#f0f6ff",

    primary: "#08d4f0",
    primaryForeground: "#060d1f",

    secondary: "#152035",
    secondaryForeground: "#f0f6ff",

    muted: "#152035",
    mutedForeground: "#8fa3bd",

    accent: "#7c5cbf",
    accentForeground: "#f0f6ff",

    destructive: "#d9243a",
    destructiveForeground: "#f0f6ff",

    success: "#1fb855",
    successForeground: "#060d1f",

    border: "#1a2a42",
    input: "#1a2a42",
  },

  light: {
    text: "#0a1628",
    tint: "#007aa3",

    background: "#f0f4f8",
    foreground: "#0a1628",

    card: "#ffffff",
    cardForeground: "#0a1628",

    primary: "#007aa3",
    primaryForeground: "#ffffff",

    secondary: "#e2e8f0",
    secondaryForeground: "#0a1628",

    muted: "#e2e8f0",
    mutedForeground: "#5a7090",

    accent: "#6d4ca8",
    accentForeground: "#ffffff",

    destructive: "#d9243a",
    destructiveForeground: "#ffffff",

    success: "#16a34a",
    successForeground: "#ffffff",

    border: "#c8d8e8",
    input: "#c8d8e8",
  },

  /** Field Mode: grass greens, white yard-line borders, leather-brown accents */
  field: {
    text: "#ffffff",
    tint: "#f5d060",

    background: "#1a3d1a",
    foreground: "#ffffff",

    card: "#1f4a22",
    cardForeground: "#ffffff",

    primary: "#f5d060",
    primaryForeground: "#1a3d1a",

    secondary: "#163318",
    secondaryForeground: "#ffffff",

    muted: "#163318",
    mutedForeground: "#8fbe8f",

    accent: "#8B4513",
    accentForeground: "#ffffff",

    destructive: "#ef4444",
    destructiveForeground: "#ffffff",

    success: "#a8f4c8",
    successForeground: "#1a3d1a",

    border: "#ffffff44",
    input: "#1f4a22",
  },

  radius: 12,
};

export type ThemeKey = "dark" | "light" | "field";
export default colors;
