#!/usr/bin/env node
// ============================================================================
// BINDING VERIFICATION SCRIPT
// ============================================================================
// Imports omegaMappings and verifies every binding against the specification.
// Run: node scripts/verifyBindings.mjs
// ============================================================================

import {
  OMEGA_BINDINGS,
  buildOmegaBindingLookup,
  getOmegaBinding,
  COMBO_7_4_BINDING,
} from "../dist/omegaMappings.js";

import {
  OMEGA_KEY_THRESHOLDS,
  OMEGA_GESTURE_TYPES,
} from "../dist/omegaTypes.js";
import { INPUT_KEYS } from "../dist/types.js";

let passed = 0;
let failed = 0;
let warnings = 0;

function check(description, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${description}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

function warn(description) {
  console.log(`  ⚠️  WARN: ${description}`);
  warnings++;
}

function getBinding(inputKey, gesture) {
  const lookup = buildOmegaBindingLookup();
  return getOmegaBinding(lookup, inputKey, gesture);
}

function seqKeys(binding) {
  if (!binding) return [];
  return binding.sequence.map((s) => s.key).filter(Boolean);
}

function seqTimers(binding) {
  if (!binding) return [];
  return binding.sequence.filter((s) => s.timer).map((s) => s.timer);
}

// ============================================================================
console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║     OMEGA BINDING VERIFICATION - COMPREHENSIVE TEST        ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// ============================================================================
// SECTION A: INPUT KEY ADDITIONS
// ============================================================================
console.log("═══ SECTION A: INPUT KEY ADDITIONS ═══");

check("SPACEBAR in INPUT_KEYS", INPUT_KEYS.includes("SPACEBAR"));
check("Q in INPUT_KEYS", INPUT_KEYS.includes("Q"));
check("8 in INPUT_KEYS", INPUT_KEYS.includes("8"));

console.log("\n═══ SECTION A: THRESHOLDS ═══");
check(
  "SPACEBAR threshold = 380",
  OMEGA_KEY_THRESHOLDS["SPACEBAR"] === 380,
  `Got: ${OMEGA_KEY_THRESHOLDS["SPACEBAR"]}`,
);
check(
  "Q threshold = 350",
  OMEGA_KEY_THRESHOLDS["Q"] === 350,
  `Got: ${OMEGA_KEY_THRESHOLDS["Q"]}`,
);
check(
  "8 threshold = 380",
  OMEGA_KEY_THRESHOLDS["8"] === 380,
  `Got: ${OMEGA_KEY_THRESHOLDS["8"]}`,
);

console.log("\n═══ SECTION A: GESTURE TYPES ═══");
check(
  "quick_q_toggle in OMEGA_GESTURE_TYPES",
  OMEGA_GESTURE_TYPES.includes("quick_q_toggle"),
);
check(
  "long_q_toggle in OMEGA_GESTURE_TYPES",
  OMEGA_GESTURE_TYPES.includes("long_q_toggle"),
);
check(
  "quick_s_toggle in OMEGA_GESTURE_TYPES",
  OMEGA_GESTURE_TYPES.includes("quick_s_toggle"),
);
check(
  "long_s_toggle in OMEGA_GESTURE_TYPES",
  OMEGA_GESTURE_TYPES.includes("long_s_toggle"),
);

// ============================================================================
// SECTION B: OUTPUT KEYBIND REMAPPING
// ============================================================================
console.log("\n═══ SECTION B: OUTPUT KEYBIND REMAPPING ═══");

// Check targetWithCog helper uses ALT+F9 (cog) — check a binding that uses targetWithCog
const centerTarget = getBinding("1", "long");
check("1 long (Center Target + Cog) exists", !!centerTarget);
check(
  "1 long outputs SHIFT+O (Center Target)",
  centerTarget && seqKeys(centerTarget)[0] === "SHIFT+O",
  `Got: ${centerTarget ? seqKeys(centerTarget)[0] : "null"}`,
);
check(
  "1 long outputs ALT+F9 (Cog)",
  centerTarget && seqKeys(centerTarget)[1] === "ALT+F9",
  `Got: ${centerTarget ? seqKeys(centerTarget)[1] : "null"}`,
);

// Close Enemy = 8 (was Q)
const closeEnemy = getBinding("W", "quick");
check("W quick (Close Enemy + Cog) exists", !!closeEnemy);
check(
  "W quick outputs 8 (Close Enemy)",
  closeEnemy && seqKeys(closeEnemy)[0] === "8",
  `Got: ${closeEnemy ? seqKeys(closeEnemy)[0] : "null"}`,
);
check(
  "W quick outputs ALT+F9 (Cog)",
  closeEnemy && seqKeys(closeEnemy)[1] === "ALT+F9",
  `Got: ${closeEnemy ? seqKeys(closeEnemy)[1] : "null"}`,
);

// Focus Target Modifier = 7 (was SHIFT+R)
const focusMod = getBinding("H", "quick");
check("H quick (Focus Mod + Single Taunt) exists", !!focusMod);
check(
  "H quick first step is holdModifier 7",
  focusMod && seqKeys(focusMod)[0] === "7",
  `Got: ${focusMod ? seqKeys(focusMod)[0] : "null"}`,
);
check(
  "H quick holdThroughNext is true",
  focusMod && focusMod.sequence[0]?.holdThroughNext === true,
);

// Basic Attack = X (was SHIFT+Q)
const basicAttack5 = getBinding("5", "long");
check("5 long (Basic Attack) exists", !!basicAttack5);
check(
  "5 long outputs X (Basic Attack)",
  basicAttack5 && seqKeys(basicAttack5)[0] === "X",
  `Got: ${basicAttack5 ? seqKeys(basicAttack5)[0] : "null"}`,
);

// Vicious Slash = ALT+[ (was SHIFT+L)
const viciousSlash = getBinding("3", "long");
check("3 long (Vicious Slash) exists", !!viciousSlash);
check(
  "3 long outputs ALT+[ (Vicious Slash)",
  viciousSlash && seqKeys(viciousSlash)[0] === "ALT+[",
  `Got: ${viciousSlash ? seqKeys(viciousSlash)[0] : "null"}`,
);

// Seismic Grenade = ALT+/ (was ALT+NUMPAD4)
const seismicQ = getBinding("6", "quick_q_toggle");
check("6 quick_q_toggle (Seismic Grenade) exists", !!seismicQ);
check(
  "6 quick_q_toggle outputs ALT+/ (Seismic Grenade)",
  seismicQ && seqKeys(seismicQ)[0] === "ALT+/",
  `Got: ${seismicQ ? seqKeys(seismicQ)[0] : "null"}`,
);

// Also check 5 long_toggle Seismic Grenade
const seismic5 = getBinding("5", "long_toggle");
check("5 long_toggle (Seismic Grenade) exists", !!seismic5);
check(
  "5 long_toggle outputs ALT+/ (Seismic Grenade)",
  seismic5 && seqKeys(seismic5)[0] === "ALT+/",
  `Got: ${seismic5 ? seqKeys(seismic5)[0] : "null"}`,
);

// ============================================================================
// SECTION C: ABILITY BINDING CHANGES
// ============================================================================
console.log("\n═══ SECTION C: ABILITY BINDING CHANGES ═══");

// C1. SPACEBAR → Endure Pain Timer only
console.log("\n--- C1: SPACEBAR (Endure Pain Timer) ---");
const spaceQuick = getBinding("SPACEBAR", "quick");
check("SPACEBAR quick exists", !!spaceQuick);
check(
  "SPACEBAR quick has NO key output (timer only)",
  spaceQuick && seqKeys(spaceQuick).length === 0,
  `Keys: ${spaceQuick ? JSON.stringify(seqKeys(spaceQuick)) : "null"}`,
);
const spaceTimers = spaceQuick ? seqTimers(spaceQuick) : [];
check(
  "SPACEBAR quick timer id = 'drop'",
  spaceTimers.length > 0 && spaceTimers[0].id === "drop",
  `Got: ${spaceTimers[0]?.id}`,
);
check(
  "SPACEBAR quick timer duration = 15.5s",
  spaceTimers.length > 0 && spaceTimers[0].durationSeconds === 15.5,
  `Got: ${spaceTimers[0]?.durationSeconds}`,
);
check(
  "SPACEBAR quick timer message = 'drop drop drop drop'",
  spaceTimers.length > 0 && spaceTimers[0].message === "drop drop drop drop",
  `Got: '${spaceTimers[0]?.message}'`,
);

const spaceLong = getBinding("SPACEBAR", "long");
check("SPACEBAR long exists", !!spaceLong);
check(
  "SPACEBAR long has NO key output (timer only)",
  spaceLong && seqKeys(spaceLong).length === 0,
);
const spaceLongTimers = spaceLong ? seqTimers(spaceLong) : [];
check(
  "SPACEBAR long timer id = 'drop'",
  spaceLongTimers.length > 0 && spaceLongTimers[0].id === "drop",
);
check(
  "SPACEBAR long timer duration = 15.5s",
  spaceLongTimers.length > 0 && spaceLongTimers[0].durationSeconds === 15.5,
);
check(
  "SPACEBAR long timer message = 'drop drop drop drop'",
  spaceLongTimers.length > 0 &&
    spaceLongTimers[0].message === "drop drop drop drop",
  `Got: '${spaceLongTimers[0]?.message}'`,
);

// C2. I quick → Relic (SHIFT+X)
console.log("\n--- C2: I quick → Relic ---");
const relic = getBinding("I", "quick");
check("I quick (Relic) exists", !!relic);
check(
  "I quick outputs SHIFT+X",
  relic && seqKeys(relic)[0] === "SHIFT+X",
  `Got: ${relic ? seqKeys(relic)[0] : "null"}`,
);
check(
  "I quick name = 'Relic'",
  relic?.name === "Relic",
  `Got: '${relic?.name}'`,
);

const iLong = getBinding("I", "long");
check("I long is REMOVED", !iLong, iLong ? `Found: ${iLong.name}` : "");

// C3. Toggle 3 → Sweeping Slash
console.log("\n--- C3: Toggle 3 → Sweeping Slash ---");
const sweepingSlash = getBinding("3", "quick_toggle");
check("3 quick_toggle (Sweeping Slash) exists", !!sweepingSlash);
check(
  "3 quick_toggle outputs SHIFT+J",
  sweepingSlash && seqKeys(sweepingSlash)[0] === "SHIFT+J",
  `Got: ${sweepingSlash ? seqKeys(sweepingSlash)[0] : "null"}`,
);
check(
  "3 quick_toggle echo count = 2",
  sweepingSlash?.sequence[0]?.echoHits?.count === 2,
  `Got: ${sweepingSlash?.sequence[0]?.echoHits?.count}`,
);
check(
  "3 quick_toggle echo windowMs = 170",
  sweepingSlash?.sequence[0]?.echoHits?.windowMs === 170,
  `Got: ${sweepingSlash?.sequence[0]?.echoHits?.windowMs}`,
);
check(
  "3 quick_toggle gcdAbility = SWEEPING_SLASH",
  sweepingSlash?.gcdAbility === "SWEEPING_SLASH",
  `Got: ${sweepingSlash?.gcdAbility}`,
);

// C4. 2 long → REMOVED
console.log("\n--- C4: 2 long → REMOVED ---");
const twoLong = getBinding("2", "long");
check("2 long is REMOVED", !twoLong, twoLong ? `Found: ${twoLong.name}` : "");

// C5. ALL B bindings → REMOVED
console.log("\n--- C5: ALL B bindings REMOVED ---");
const bQuick = getBinding("B", "quick");
const bLong = getBinding("B", "long");
const bToggle = getBinding("B", "quick_toggle");
const bLongToggle = getBinding("B", "long_toggle");
check("B quick REMOVED", !bQuick, bQuick ? `Found: ${bQuick.name}` : "");
check("B long REMOVED", !bLong, bLong ? `Found: ${bLong.name}` : "");
check(
  "B quick_toggle REMOVED",
  !bToggle,
  bToggle ? `Found: ${bToggle.name}` : "",
);
check(
  "B long_toggle REMOVED",
  !bLongToggle,
  bLongToggle ? `Found: ${bLongToggle.name}` : "",
);

// C6. U long (Invincible) → REMOVED
console.log("\n--- C6: U long (Invincible) REMOVED ---");
const uLong = getBinding("U", "long");
check("U long is REMOVED", !uLong, uLong ? `Found: ${uLong.name}` : "");

// C7. 6 long_toggle (Stun Break) → REMOVED
console.log("\n--- C7: 6 long_toggle (Stun Break) REMOVED ---");
const sixLongToggle = getBinding("6", "long_toggle");
check(
  "6 long_toggle is REMOVED",
  !sixLongToggle,
  sixLongToggle ? `Found: ${sixLongToggle.name}` : "",
);

// C8. 6 quick → Ravage (echo×4)
console.log("\n--- C8: 6 quick → Ravage (echo×4) ---");
const ravage = getBinding("6", "quick");
check("6 quick (Ravage) exists", !!ravage);
check(
  "6 quick outputs SHIFT+K",
  ravage && seqKeys(ravage)[0] === "SHIFT+K",
  `Got: ${ravage ? seqKeys(ravage)[0] : "null"}`,
);
check(
  "6 quick echo count = 4",
  ravage?.sequence[0]?.echoHits?.count === 4,
  `Got: ${ravage?.sequence[0]?.echoHits?.count}`,
);
check(
  "6 quick gcdAbility = RAVAGE",
  ravage?.gcdAbility === "RAVAGE",
  `Got: ${ravage?.gcdAbility}`,
);

// C9. Toggle 6 → Force Push (verify)
console.log("\n--- C9: Toggle 6 → Force Push ---");
const forcePush = getBinding("6", "quick_toggle");
check("6 quick_toggle (Force Push) exists", !!forcePush);
check(
  "6 quick_toggle outputs ALT+L",
  forcePush && seqKeys(forcePush)[0] === "ALT+L",
  `Got: ${forcePush ? seqKeys(forcePush)[0] : "null"}`,
);
check(
  "6 quick_toggle echo count = 2",
  forcePush?.sequence[0]?.echoHits?.count === 2,
);

// C10. 6 quick_f2 → Basic Attack (X)
console.log("\n--- C10: 6 quick_f2 → Basic Attack ---");
const basicF2 = getBinding("6", "quick_f2");
check("6 quick_f2 (Basic Attack) exists", !!basicF2);
check(
  "6 quick_f2 outputs X",
  basicF2 && seqKeys(basicF2)[0] === "X",
  `Got: ${basicF2 ? seqKeys(basicF2)[0] : "null"}`,
);
check(
  "6 quick_f2 gcdAbility = BASIC_ATTACK",
  basicF2?.gcdAbility === "BASIC_ATTACK",
  `Got: ${basicF2?.gcdAbility}`,
);

// C11. 1 long → Center Target + Cog (already checked in Section B)
console.log("\n--- C11: 1 long → Center Target + Cog ---");
check("1 long → SHIFT+O + ALT+F9 (see Section B)", !!centerTarget);

// Also check 1 long_toggle
const oneLongToggle = getBinding("1", "long_toggle");
check("1 long_toggle (Center Target + Cog toggled) exists", !!oneLongToggle);
check(
  "1 long_toggle outputs SHIFT+O",
  oneLongToggle && seqKeys(oneLongToggle)[0] === "SHIFT+O",
  `Got: ${oneLongToggle ? seqKeys(oneLongToggle)[0] : "null"}`,
);
check(
  "1 long_toggle outputs ALT+F9 (Cog)",
  oneLongToggle && seqKeys(oneLongToggle)[1] === "ALT+F9",
  `Got: ${oneLongToggle ? seqKeys(oneLongToggle)[1] : "null"}`,
);

// C12. W quick → Close Enemy + Cog (already checked in Section B)
console.log("\n--- C12: W quick → Close Enemy + Cog ---");
check("W quick → 8 + ALT+F9 (see Section B)", !!closeEnemy);

// C13. U quick ↔ U toggle SWAP
console.log("\n--- C13: U quick ↔ U toggle SWAP ---");
const uQuick = getBinding("U", "quick");
check("U quick (Enraged Defense) exists", !!uQuick);
check(
  "U quick outputs SHIFT+. (Enraged Defense)",
  uQuick && seqKeys(uQuick)[0] === "SHIFT+.",
  `Got: ${uQuick ? seqKeys(uQuick)[0] : "null"}`,
);
check(
  "U quick name = 'Enraged Defense'",
  uQuick?.name === "Enraged Defense",
  `Got: '${uQuick?.name}'`,
);

const uToggle = getBinding("U", "quick_toggle");
check("U quick_toggle (Saber Ward) exists", !!uToggle);
check(
  "U quick_toggle outputs , (Saber Ward)",
  uToggle && seqKeys(uToggle)[0] === ",",
  `Got: ${uToggle ? seqKeys(uToggle)[0] : "null"}`,
);
check(
  "U quick_toggle name = 'Saber Ward'",
  uToggle?.name === "Saber Ward",
  `Got: '${uToggle?.name}'`,
);

// C14. A toggle → Single Taunt
console.log("\n--- C14: A toggle → Single Taunt, A long REMOVED ---");
const aToggle = getBinding("A", "quick_toggle");
check("A quick_toggle (Single Taunt) exists", !!aToggle);
check(
  "A quick_toggle outputs F6",
  aToggle && seqKeys(aToggle)[0] === "F6",
  `Got: ${aToggle ? seqKeys(aToggle)[0] : "null"}`,
);
check(
  "A quick_toggle echo count = 2",
  aToggle?.sequence[0]?.echoHits?.count === 2,
);

const aLong = getBinding("A", "long");
check("A long is REMOVED", !aLong, aLong ? `Found: ${aLong.name}` : "");

// ============================================================================
// SECTION D: Q TOGGLE BINDINGS
// ============================================================================
console.log("\n═══ SECTION D: Q TOGGLE BINDINGS ═══");

const smashQ = getBinding("5", "quick_q_toggle");
check("5 quick_q_toggle (Smash) exists", !!smashQ);
check(
  "5 quick_q_toggle outputs ] (Smash)",
  smashQ && seqKeys(smashQ)[0] === "]",
  `Got: ${smashQ ? seqKeys(smashQ)[0] : "null"}`,
);
check(
  "5 quick_q_toggle gcdAbility = SMASH",
  smashQ?.gcdAbility === "SMASH",
  `Got: ${smashQ?.gcdAbility}`,
);

const seismicQ2 = getBinding("6", "quick_q_toggle");
check("6 quick_q_toggle (Seismic Grenade) exists", !!seismicQ2);
check(
  "6 quick_q_toggle outputs ALT+/",
  seismicQ2 && seqKeys(seismicQ2)[0] === "ALT+/",
  `Got: ${seismicQ2 ? seqKeys(seismicQ2)[0] : "null"}`,
);
check(
  "6 quick_q_toggle gcdAbility = SEISMIC_GRENADE",
  seismicQ2?.gcdAbility === "SEISMIC_GRENADE",
);

// ============================================================================
// SECTION G: S TOGGLE BINDINGS
// ============================================================================
console.log("\n═══ SECTION G: S TOGGLE BINDINGS ═══");

const sToggle5 = getBinding("5", "quick_s_toggle");
check("5 quick_s_toggle (ToT + Cog) exists", !!sToggle5);
check(
  "5 quick_s_toggle step 1 = M (Target of Target)",
  sToggle5 && seqKeys(sToggle5)[0] === "M",
  `Got: ${sToggle5 ? seqKeys(sToggle5)[0] : "null"}`,
);
check(
  "5 quick_s_toggle step 2 = ALT+F9 (Cog)",
  sToggle5 && seqKeys(sToggle5)[1] === "ALT+F9",
  `Got: ${sToggle5 ? seqKeys(sToggle5)[1] : "null"}`,
);

const sToggle6 = getBinding("6", "quick_s_toggle");
check("6 quick_s_toggle (Focus ToT + Cog) exists", !!sToggle6);
check(
  "6 quick_s_toggle step 1 = J (Focus ToT)",
  sToggle6 && seqKeys(sToggle6)[0] === "J",
  `Got: ${sToggle6 ? seqKeys(sToggle6)[0] : "null"}`,
);
check(
  "6 quick_s_toggle step 2 = ALT+F9 (Cog)",
  sToggle6 && seqKeys(sToggle6)[1] === "ALT+F9",
  `Got: ${sToggle6 ? seqKeys(sToggle6)[1] : "null"}`,
);

// ============================================================================
// SECTION H: THRESHOLD ADJUSTMENTS
// ============================================================================
console.log("\n═══ SECTION H: THRESHOLD ADJUSTMENTS ═══");
check(
  "A threshold = 241 (was 336)",
  OMEGA_KEY_THRESHOLDS["A"] === 241,
  `Got: ${OMEGA_KEY_THRESHOLDS["A"]}`,
);
check(
  "W threshold = 185",
  OMEGA_KEY_THRESHOLDS["W"] === 185,
  `Got: ${OMEGA_KEY_THRESHOLDS["W"]}`,
);
check(
  "Y threshold = 233",
  OMEGA_KEY_THRESHOLDS["Y"] === 233,
  `Got: ${OMEGA_KEY_THRESHOLDS["Y"]}`,
);

// ============================================================================
// ALL PRE-EXISTING ABILITIES (Full Roster Check)
// ============================================================================
console.log("\n═══ FULL ABILITY ROSTER VERIFICATION ═══");

// 1 quick → Crushing Blow (N)
const cb = getBinding("1", "quick");
check(
  "1 quick = Crushing Blow (N)",
  cb && seqKeys(cb)[0] === "N" && cb.gcdAbility === "CRUSHING_BLOW",
);

// 1 quick_toggle → Crushing Blow (N)
const cbT = getBinding("1", "quick_toggle");
check(
  "1 quick_toggle = Crushing Blow toggled (N)",
  cbT && seqKeys(cbT)[0] === "N",
);

// 2 quick → Force Scream (O)
const fs = getBinding("2", "quick");
check(
  "2 quick = Force Scream (O)",
  fs && seqKeys(fs)[0] === "O" && fs.gcdAbility === "FORCE_SCREAM",
);

// 3 quick → Aegis Assault (Z)
const aa = getBinding("3", "quick");
check(
  "3 quick = Aegis Assault (Z)",
  aa && seqKeys(aa)[0] === "Z" && aa.gcdAbility === "AEGIS_ASSAULT",
);

// 4 quick → Interrupt (K)
const int = getBinding("4", "quick");
check("4 quick = Interrupt (K)", int && seqKeys(int)[0] === "K");

// 4 long → Close Enemy + Cog + Interrupt
const fourLong = getBinding("4", "long");
check(
  "4 long = Close Enemy+Cog+Interrupt",
  fourLong &&
    seqKeys(fourLong)[0] === "8" &&
    seqKeys(fourLong)[1] === "ALT+F9" &&
    seqKeys(fourLong)[2] === "K",
);

// 4 quick_toggle → Force Choke (DELETE)
const fc = getBinding("4", "quick_toggle");
check(
  "4 quick_toggle = Force Choke (DELETE)",
  fc && seqKeys(fc)[0] === "DELETE",
);

// 4 long_toggle → Electro Stun (ALT+-)
const es = getBinding("4", "long_toggle");
check("4 long_toggle = Electro Stun (ALT+-)", es && seqKeys(es)[0] === "ALT+-");

// 5 quick → Vicious Throw ([)
const vt = getBinding("5", "quick");
check(
  "5 quick = Vicious Throw ([)",
  vt && seqKeys(vt)[0] === "[" && vt.gcdAbility === "VICIOUS_THROW",
);

// 5 quick_toggle → Backhand (BACKSPACE)
const bh = getBinding("5", "quick_toggle");
check(
  "5 quick_toggle = Backhand (BACKSPACE)",
  bh && seqKeys(bh)[0] === "BACKSPACE",
);

// A quick → Leap (F9)
const leap = getBinding("A", "quick");
check(
  "A quick = Leap (F9)",
  leap && seqKeys(leap)[0] === "F9" && leap.gcdAbility === "FORCE_LEAP",
);

// S quick → Guard + Shield (L + \\)
const guard = getBinding("S", "quick");
check(
  "S quick = Guard + Shield (L, \\)",
  guard && seqKeys(guard)[0] === "L" && seqKeys(guard)[1] === "\\",
);

// Y quick → Next Target + Cog (V + ALT+F9)
const yQuick = getBinding("Y", "quick");
check(
  "Y quick = Next Target + Cog (V + ALT+F9)",
  yQuick && seqKeys(yQuick)[0] === "V" && seqKeys(yQuick)[1] === "ALT+F9",
);

// Y quick_toggle → Close Friend + Cog (' + ALT+F9)
const yToggle = getBinding("Y", "quick_toggle");
check(
  "Y quick_toggle = Close Friend + Cog (' + ALT+F9)",
  yToggle && seqKeys(yToggle)[0] === "'" && seqKeys(yToggle)[1] === "ALT+F9",
);

// W quick_toggle → Next Friend + Cog (. + ALT+F9)
const wToggle = getBinding("W", "quick_toggle");
check(
  "W quick_toggle = Next Friend + Cog (. + ALT+F9)",
  wToggle &&
    seqKeys(wToggle)[0] === "." &&
    wToggle &&
    seqKeys(wToggle)[1] === "ALT+F9",
);

// T quick → Previous Target + Cog (ALT+] + ALT+F9)
const tQuick = getBinding("T", "quick");
check(
  "T quick = Previous Target + Cog (ALT+] + ALT+F9)",
  tQuick && seqKeys(tQuick)[0] === "ALT+]" && seqKeys(tQuick)[1] === "ALT+F9",
);

// T long → Previous Friend + Cog (ALT+. + ALT+F9)
const tLong = getBinding("T", "long");
check(
  "T long = Previous Friend + Cog (ALT+. + ALT+F9)",
  tLong && seqKeys(tLong)[0] === "ALT+." && seqKeys(tLong)[1] === "ALT+F9",
);

// T quick_toggle → ToT + Cog (M + ALT+F9)
const tToggle = getBinding("T", "quick_toggle");
check(
  "T quick_toggle = ToT + Cog (M + ALT+F9)",
  tToggle && seqKeys(tToggle)[0] === "M" && seqKeys(tToggle)[1] === "ALT+F9",
);

// T long_toggle → Focus ToT + Cog (J + ALT+F9)
const tLongToggle = getBinding("T", "long_toggle");
check(
  "T long_toggle = Focus ToT + Cog (J + ALT+F9)",
  tLongToggle &&
    seqKeys(tLongToggle)[0] === "J" &&
    seqKeys(tLongToggle)[1] === "ALT+F9",
);

// I quick_toggle → Focus Mod + Single Taunt (7 hold → F6)
const iToggle = getBinding("I", "quick_toggle");
check(
  "I quick_toggle = Focus Mod + Single Taunt (7 hold → F6)",
  iToggle &&
    seqKeys(iToggle)[0] === "7" &&
    iToggle.sequence[0]?.holdThroughNext === true &&
    seqKeys(iToggle)[1] === "F6",
);

// I long_toggle → Mass Taunt combo (F7 → 7 hold → F6 → F7 → F7 → F8)
const iLongToggle = getBinding("I", "long_toggle");
check("I long_toggle = Mass Taunt combo exists", !!iLongToggle);
if (iLongToggle) {
  const keys = seqKeys(iLongToggle);
  check(
    "I long_toggle combo: F7 → 7 → F6 → F7 → F7 → F8",
    keys[0] === "F7" &&
      keys[1] === "7" &&
      keys[2] === "F6" &&
      keys[3] === "F7" &&
      keys[4] === "F7" &&
      keys[5] === "F8",
    `Got: ${JSON.stringify(keys)}`,
  );
}

// C timers
const cQuick = getBinding("C", "quick");
check(
  "C quick = Burst Timer (13s)",
  cQuick &&
    seqTimers(cQuick)[0]?.id === "burst" &&
    seqTimers(cQuick)[0]?.durationSeconds === 13,
);

const cLong = getBinding("C", "long");
check(
  "C long = Laze Timer (31s)",
  cLong &&
    seqTimers(cLong)[0]?.id === "laze" &&
    seqTimers(cLong)[0]?.durationSeconds === 31,
);

const cToggle = getBinding("C", "quick_toggle");
check(
  "C quick_toggle = Yield Timer (45s)",
  cToggle &&
    seqTimers(cToggle)[0]?.id === "yield" &&
    seqTimers(cToggle)[0]?.durationSeconds === 45,
);

const cLongToggle = getBinding("C", "long_toggle");
check(
  "C long_toggle = Fuel Timer (103s)",
  cLongToggle &&
    seqTimers(cLongToggle)[0]?.id === "fuel" &&
    seqTimers(cLongToggle)[0]?.durationSeconds === 103,
);

// MIDDLE_CLICK
const mcQuick = getBinding("MIDDLE_CLICK", "quick");
check(
  "MIDDLE_CLICK quick = Zoom In + Scroll",
  mcQuick && seqKeys(mcQuick)[0] === "CTRL+V",
);

const mcLong = getBinding("MIDDLE_CLICK", "long");
check(
  "MIDDLE_CLICK long = Scroll In",
  mcLong && mcLong.sequence[0]?.scrollDirection === "up",
);

// 4+7 Combo
check("COMBO_7_4_BINDING exists", !!COMBO_7_4_BINDING);
check(
  "COMBO_7_4 outputs 8 → K",
  seqKeys(COMBO_7_4_BINDING)[0] === "8" &&
    seqKeys(COMBO_7_4_BINDING)[1] === "K",
);

// ============================================================================
// COG ICON CHECK — Verify ALL targeting sequences end with ALT+F9
// ============================================================================
console.log("\n═══ COG ICON AUDIT (ALT+F9 on ALL targeting) ═══");

const targetingBindings = [
  { key: "1", gesture: "long", name: "1 long (Center Target + Cog)" },
  {
    key: "1",
    gesture: "long_toggle",
    name: "1 long_toggle (Center Target + Cog toggled)",
  },
  { key: "4", gesture: "long", name: "4 long (Close Enemy + Cog + Interrupt)" },
  { key: "W", gesture: "quick", name: "W quick (Close Enemy + Cog)" },
  {
    key: "W",
    gesture: "quick_toggle",
    name: "W quick_toggle (Next Friend + Cog)",
  },
  { key: "Y", gesture: "quick", name: "Y quick (Next Target + Cog)" },
  {
    key: "Y",
    gesture: "quick_toggle",
    name: "Y quick_toggle (Close Friend + Cog)",
  },
  { key: "T", gesture: "quick", name: "T quick (Previous Target + Cog)" },
  { key: "T", gesture: "long", name: "T long (Previous Friend + Cog)" },
  { key: "T", gesture: "quick_toggle", name: "T quick_toggle (ToT + Cog)" },
  { key: "T", gesture: "long_toggle", name: "T long_toggle (Focus ToT + Cog)" },
  { key: "5", gesture: "quick_s_toggle", name: "5 S-toggle (ToT + Cog)" },
  { key: "6", gesture: "quick_s_toggle", name: "6 S-toggle (Focus ToT + Cog)" },
];

for (const t of targetingBindings) {
  const b = getBinding(t.key, t.gesture);
  if (!b) {
    check(`${t.name} — has ALT+F9 Cog`, false, "Binding not found!");
    continue;
  }
  const keys = seqKeys(b);
  // Cog should be ALT+F9 and present somewhere in the sequence (usually last or second)
  const hasCog = keys.includes("ALT+F9");
  check(`${t.name} — has ALT+F9 Cog`, hasCog, `Keys: ${JSON.stringify(keys)}`);
}

// ============================================================================
// "REMOVED" BINDINGS — Verify they DON'T exist
// ============================================================================
console.log("\n═══ REMOVED BINDINGS AUDIT ═══");

const shouldNotExist = [
  { key: "2", gesture: "long", desc: "2 long (old Sweeping Slash)" },
  { key: "6", gesture: "long", desc: "6 long (old Endure Pain)" },
  { key: "6", gesture: "long_toggle", desc: "6 long_toggle (old Stun Break)" },
  { key: "B", gesture: "quick", desc: "B quick (old Medpack)" },
  { key: "B", gesture: "long", desc: "B long (old Endure Pain combo)" },
  { key: "B", gesture: "quick_toggle", desc: "B quick_toggle (old Adrenal)" },
  { key: "U", gesture: "long", desc: "U long (old Invincible)" },
  { key: "I", gesture: "long", desc: "I long (old Relic duplicate)" },
  { key: "A", gesture: "long", desc: "A long (old Single Taunt)" },
];

for (const r of shouldNotExist) {
  const b = getBinding(r.key, r.gesture);
  check(`${r.desc} — REMOVED`, !b, b ? `Still found: ${b.name}` : "");
}

// ============================================================================
// 6 long removed check
// ============================================================================
console.log("\n--- 6 long (Endure Pain moved to SPACEBAR) ---");
const sixLong = getBinding("6", "long");
check("6 long is REMOVED", !sixLong, sixLong ? `Found: ${sixLong.name}` : "");

// ============================================================================
// SUMMARY
// ============================================================================
console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log(
  `║  RESULTS: ${passed} PASSED / ${failed} FAILED / ${warnings} WARNINGS`,
);
console.log("╚════════════════════════════════════════════════════════════╝\n");

if (failed > 0) {
  console.log("🔴 SOME TESTS FAILED! Review failures above.");
  process.exit(1);
} else {
  console.log("🟢 ALL TESTS PASSED!");
  process.exit(0);
}
