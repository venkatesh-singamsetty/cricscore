/**
 * Generic Team Brand Colors Utility
 * - Team 1: Electric Cyan Blue (#00D2FF)
 * - Team 2: Target Amber (#FBBF24) - matches target equation & RRR amber-400
 */

export const TEAM_BRAND_COLORS = {
  TEAM_1: "#00D2FF", // Electric Cyan Blue
  TEAM_2: "#FBBF24", // Target Amber (Tailwind amber-400, matching target equation)
  // Backward compatibility aliases
  SPARTANS: "#00D2FF",
  GLADIATORS: "#FBBF24",
} as const;

export const normalizeTeamName = (name?: string): string =>
  (name || "").trim().toLowerCase();

export const getTeamBrandColor = (
  teamName?: string,
  matchTeamA?: string,
  matchTeamB?: string,
): string => {
  const n = normalizeTeamName(teamName);
  const a = normalizeTeamName(matchTeamA);
  const b = normalizeTeamName(matchTeamB);

  // Match Team A (First Team / Batting 1st)
  if (a && n === a) return TEAM_BRAND_COLORS.TEAM_1;
  // Match Team B (Second Team / Bowling 1st)
  if (b && n === b) return TEAM_BRAND_COLORS.TEAM_2;

  // Keyword fallbacks for default matches
  if (n.includes("spartan")) return TEAM_BRAND_COLORS.TEAM_1;
  if (n.includes("gladiator")) return TEAM_BRAND_COLORS.TEAM_2;

  return TEAM_BRAND_COLORS.TEAM_1;
};

export const getTeamGlow = (color: string): string => {
  return color === TEAM_BRAND_COLORS.TEAM_1
    ? "0 0 8px rgba(0,210,255,0.8)"
    : "0 0 6px rgba(251,191,36,0.45)";
};
