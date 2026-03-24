import fs from "fs";

const profile = JSON.parse(
  fs.readFileSync("./profiles/swtor-vengeance-jugg.json", "utf8")
);

// Map key -> {raw: [macros], shift: [macros], alt: [macros]}
const keyUsage = {};

for (const macro of profile.macros) {
  for (const step of macro.sequence) {
    if (!step || !step.key) continue;
    const key = String(step.key);
    const parts = key.split("+").map((p) => p.trim().toUpperCase());
    const last = parts[parts.length - 1];
    const hasShift = parts.slice(0, -1).includes("SHIFT");
    const hasAlt = parts.slice(0, -1).includes("ALT");

    if (!keyUsage[last]) keyUsage[last] = { raw: [], shift: [], alt: [] };

    const entry = macro.name + " (" + macro.trigger.gesture + ")";
    if (!hasShift && !hasAlt) keyUsage[last].raw.push(entry);
    if (hasShift) keyUsage[last].shift.push(entry);
    if (hasAlt) keyUsage[last].alt.push(entry);
  }
}

console.log("=== CONUNDRUM KEYS (appear in multiple forms) ===\n");

for (const [key, usage] of Object.entries(keyUsage)) {
  const forms = [
    usage.raw.length > 0,
    usage.shift.length > 0,
    usage.alt.length > 0,
  ].filter(Boolean).length;
  if (forms > 1) {
    console.log("KEY:", key);
    if (usage.raw.length)
      console.log(
        "  RAW:",
        usage.raw.slice(0, 3).join(", ") +
          (usage.raw.length > 3 ? "...(+" + (usage.raw.length - 3) + ")" : "")
      );
    if (usage.shift.length)
      console.log(
        "  SHIFT+:",
        usage.shift.slice(0, 3).join(", ") +
          (usage.shift.length > 3
            ? "...(+" + (usage.shift.length - 3) + ")"
            : "")
      );
    if (usage.alt.length)
      console.log(
        "  ALT+:",
        usage.alt.slice(0, 3).join(", ") +
          (usage.alt.length > 3 ? "...(+" + (usage.alt.length - 3) + ")" : "")
      );
    console.log("");
  }
}
