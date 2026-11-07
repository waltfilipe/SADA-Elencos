/** Portuguese label for the dominant foot. Unknown values stay blank. */
export function formatFoot(foot: string | null | undefined): "Destro" | "Canhoto" | "Ambidestro" | null {
  if (!foot) return null;
  const value = foot.trim().toLowerCase();
  if (!value || value === "—" || value === "-" || value === "nan" || value === "unknown" || value === "none" || value === "n/a") {
    return null;
  }
  if (value.includes("amb") || value === "both" || value === "either" || value === "ambos") return "Ambidestro";
  if (value.includes("canh") || value.includes("esquer") || value === "left" || value === "l") return "Canhoto";
  if (value.includes("destr") || value.includes("direit") || value === "right" || value === "r") return "Destro";
  return null;
}
