import { useSettings } from "@apex/core";

export function useTheme() {
  const ctx = useSettings() as any;
  const theme = ctx?.theme || "dark";
  const isLight = theme === "light";

  return {
    isLight,
    theme,
    colors: {
      bgBase: isLight ? "#ffffff" : "#07070f",
      bgCard: isLight ? "#f2f2f7" : "rgba(255, 255, 255, 0.035)",
      bgCardBorder: isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.09)",
      border: isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.07)",
      borderStrong: isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.12)",
      textPrimary: isLight ? "#000000" : "#ffffff",
      textSecondary: isLight ? "rgba(0, 0, 0, 0.6)" : "rgba(255, 255, 255, 0.5)",
      textTertiary: isLight ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.28)",
      accentRed: "#FF2D55",
      accentBlue: "#0A84FF",
      accentYellow: "#FFD60A",
      accentGreen: "#30D158",
      accentOrange: "#FF9F0A",
      accentPurple: "#BF5AF2",
    }
  };
}
