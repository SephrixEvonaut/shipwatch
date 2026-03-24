# SWTOR Vengeance Juggernaut - Output Keybind Reference

A complete list of all output keys used in ability sequences. This document is separate from the manifest system and serves as a quick reference for SWTOR in-game keybind configuration.

**Source of truth:** `omegaMappings.ts` — if conflicts exist, the code is authoritative.

---

## 🎮 Combat Abilities

| Ability        | Output Key | Notes                    |
| -------------- | ---------- | ------------------------ |
| Crushing Blow  | `N`        | Primary rotation ability |
| Force Scream   | `O`        | High damage ability      |
| Aegis Assault  | `Z`        | Tank rotation filler     |
| Vicious Throw  | `[`        | Execute ability           |
| Vicious Slash  | `ALT+[`    | Filler ability (was SHIFT+L) |
| Sweeping Slash | `SHIFT+J`  | AOE attack               |
| Retaliation    | `R`        | Proc-based (D toggle stream) |
| Smash          | `]`        | AOE slam (Q toggle + 5)  |
| Basic Attack   | `X`        | Auto-attack (was SHIFT+Q) |
| Ravage         | `SHIFT+K`  | Channeled ability        |

---

## 🗡️ Offensive Cooldowns

| Ability         | Output Key | Notes                        |
| --------------- | ---------- | ---------------------------- |
| Backhand        | `BACKSPACE`| Interrupt alternative        |
| Force Choke     | `DELETE`   | Channeled CC                 |
| Force Push      | `ALT+L`    | Knockback                    |
| Electro Stun    | `ALT+-`    | Hard stun                    |
| Seismic Grenade | `ALT+/`    | Ranged AOE (was ALT+NUMPAD4) |

---

## 🛡️ Defensive Abilities

| Ability         | Output Key | Notes                           |
| --------------- | ---------- | ------------------------------- |
| Saber Ward      | `,`        | Main defensive (U quick_toggle) |
| Enraged Defense | `SHIFT+.`  | Self-heal (U quick)             |
| Endure Pain     | `SPACEBAR` | Direct in-game (timer only)     |
| Invincible      | `B`        | Direct in-game (removed from app) |

---

## 🏃 Movement & Mobility

| Ability    | Output Key | Notes      |
| ---------- | ---------- | ---------- |
| Leap       | `F9`       | Gap closer |
| Intercede  | `;`        | Ally leap  |

---

## 🎯 Taunts

| Ability             | Output Key | Notes                        |
| ------------------- | ---------- | ---------------------------- |
| Single Target Taunt | `F6`       | Primary taunt (A quick_toggle) |
| Mass Taunt          | `F7`       | AOE taunt                    |
| Enrage              | `F8`       | Rage builder                 |

---

## 🔒 Crowd Control

| Ability      | Output Key | Notes             |
| ------------ | ---------- | ----------------- |
| Interrupt    | `K`        | Primary interrupt |

---

## 🎯 Targeting Keys

| Function              | Output Key | Notes                          |
| --------------------- | ---------- | ------------------------------ |
| Next Enemy            | `V`        | Tab-target next (Y quick)      |
| Previous Target       | `ALT+]`    | Tab-target previous (T quick)  |
| Close Enemy           | `8`        | Nearest enemy (was Q)          |
| Next Friend           | `.`        | Cycle allies forward (W toggle)|
| Close Friend          | `'`        | Nearest ally (Y toggle)        |
| Previous Friend       | `ALT+.`    | Cycle allies back (T long)     |
| Target of Target      | `M`        | Assist function (T toggle)     |
| Acquire Center Target | `SHIFT+O`  | Screen-center target (1 long)  |
| Focus Target's ToT    | `J`        | Focus target's target (T long_toggle) |
| Set Focus Target      | `9`        | Mark focus (was X, in-game)    |
| Focus Target Modifier | `7`        | Cast on focus prefix (was SHIFT+R) |
| Cog Icon              | `ALT+F9`   | Targeting confirm (was 7)      |

---

## 🛡️ Guard System

| Function   | Output Key              | Notes                    |
| ---------- | ----------------------- | ------------------------ |
| Guard Swap | `L` + `\`              | Dual-key with shield icon |

---

## 💊 Consumables

| Item    | Output Key | Notes          |
| ------- | ---------- | -------------- |
| Relic   | `SHIFT+X`  | On-use relic (I quick) |

---

## 🔧 Utility

| Function       | Output Key | Notes          |
| -------------- | ---------- | -------------- |
| Escape         | `ESCAPE`   | C double-tap   |

---

## 🎨 Icon System Keys

| Icon      | Output Key        | Purpose                            |
| --------- | ----------------- | ---------------------------------- |
| 🎯 Cog    | `ALT+F9`         | Confirms targeting actions (was 7) |
| 🔫 Gun    | `NUMPAD_ADD`      | Confirms focus target actions      |
| 🛡️ Shield | `\`               | Guard swap confirmation            |

---

## ⏱️ Timer System (TTS)

| Timer      | Duration | Message              | Trigger          |
| ---------- | -------- | -------------------- | ---------------- |
| Drop       | 15.5s    | "drop drop drop drop"| SPACEBAR detect  |
| Burst      | 13s      | "burst"              | C quick          |
| Laze       | 31s      | "laze"               | C long           |
| Yield      | 45s      | "yield"              | C quick_toggle   |
| Fuel       | 103s     | "fuel"               | C long_toggle    |

---

## 📊 Complete Gesture → Output Mapping

### Key 1
| Gesture       | Ability                | Output                  |
| ------------- | ---------------------- | ----------------------- |
| quick         | Crushing Blow          | `N` (echo×2)           |
| long          | Center Target + Cog    | `SHIFT+O` → `ALT+F9`  |
| quick_toggle  | Crushing Blow (toggled)| `N` (echo×2)           |
| long_toggle   | Center Target + Cog    | `SHIFT+O` → `ALT+F9`  |

### Key 2
| Gesture | Ability      | Output      |
| ------- | ------------ | ----------- |
| quick   | Force Scream | `O` (echo×2)|

### Key 3
| Gesture      | Ability        | Output               |
| ------------ | -------------- | -------------------- |
| quick        | Aegis Assault  | `Z` (echo×2)        |
| long         | Vicious Slash  | `ALT+[`              |
| quick_toggle | Sweeping Slash | `SHIFT+J` (echo×2)  |

### Key 4
| Gesture      | Ability              | Output                       |
| ------------ | -------------------- | ---------------------------- |
| quick        | Interrupt            | `K` (echo×2)                |
| long         | Close Enemy+Cog+Int  | `8` → `ALT+F9` → `K`       |
| quick_toggle | Force Choke          | `DELETE`                     |
| long_toggle  | Electro Stun         | `ALT+-`                      |
| combo_7_4    | Close Enemy+Interrupt| `8` → `K`                   |

### Key 5
| Gesture        | Ability         | Output               |
| -------------- | --------------- | -------------------- |
| quick          | Vicious Throw   | `[` (echo×2)         |
| long           | Basic Attack    | `X` (echo×2)         |
| quick_toggle   | Backhand        | `BACKSPACE`          |
| quick_q_toggle | Smash (Q toggle)| `]` (echo×2)         |
| long_toggle    | Seismic Grenade | `ALT+/`              |

### Key 6
| Gesture        | Ability           | Output             |
| -------------- | ----------------- | ------------------ |
| quick          | Ravage            | `SHIFT+K` (echo×4)|
| quick_toggle   | Force Push        | `ALT+L` (echo×2)  |
| quick_f2       | Basic Attack      | `X` (echo×2)      |
| quick_q_toggle | Seismic Grenade   | `ALT+/`            |

### Key W (toggle activator, threshold 185ms)
| Gesture      | Ability            | Output                  |
| ------------ | ------------------ | ----------------------- |
| quick        | Close Enemy + Cog  | `8` → `ALT+F9`         |
| quick_toggle | Next Friend + Cog  | `.` → `ALT+F9`         |
| long hold    | Toggle only        | No output               |

### Key Y (toggle activator, threshold 233ms)
| Gesture      | Ability             | Output                  |
| ------------ | ------------------- | ----------------------- |
| quick        | Next Target + Cog   | `V` → `ALT+F9`         |
| quick_toggle | Close Friend + Cog  | `'` → `ALT+F9`         |
| long hold    | Toggle only         | No output               |

### Key A
| Gesture      | Ability       | Output          |
| ------------ | ------------- | --------------- |
| quick        | Leap          | `F9` (echo×2)  |
| quick_toggle | Single Taunt  | `F6` (echo×2)  |

### Key S
| Gesture         | Ability              | Output          |
| --------------- | -------------------- | --------------- |
| quick           | Guard + Shield       | `L` → `\`      |
| long hold       | Group Member Toggle  | Intercepts 1-6,T|

### Key T
| Gesture      | Ability               | Output                  |
| ------------ | --------------------- | ----------------------- |
| quick        | Previous Target + Cog | `ALT+]` → `ALT+F9`    |
| long         | Previous Friend + Cog | `ALT+.` → `ALT+F9`    |
| quick_toggle | ToT + Cog             | `M` → `ALT+F9`         |
| long_toggle  | Focus ToT + Cog       | `J` → `ALT+F9`         |

### Key U
| Gesture      | Ability         | Output     |
| ------------ | --------------- | ---------- |
| quick        | Enraged Defense | `SHIFT+.`  |
| quick_toggle | Saber Ward      | `,`        |

### Key I
| Gesture      | Ability                  | Output                         |
| ------------ | ------------------------ | ------------------------------ |
| quick        | Relic                    | `SHIFT+X`                      |
| quick_toggle | Focus Mod + Single Taunt | `7` (hold) → `F6`             |
| long_toggle  | Mass Taunt combo         | `F7` → `7`(hold) → `F6` → ... |

### Key H
| Gesture | Ability                  | Output           |
| ------- | ------------------------ | ---------------- |
| quick   | Focus Mod + Single Taunt | `7` (hold) → `F6`|

### Key C (double-tap detection)
| Gesture      | Ability      | Output    |
| ------------ | ------------ | --------- |
| quick        | Burst Timer  | TTS 13s   |
| long         | Laze Timer   | TTS 31s   |
| quick_toggle | Yield Timer  | TTS 45s   |
| long_toggle  | Fuel Timer   | TTS 103s  |
| double-tap   | Escape       | `ESCAPE`  |

### SPACEBAR (detect only — player presses directly in SWTOR)
| Gesture | Ability         | Output          |
| ------- | --------------- | --------------- |
| quick   | Drop Timer      | TTS 15.5s      |
| long    | Drop Timer      | TTS 15.5s      |

### MIDDLE_CLICK
| Gesture | Ability            | Output                    |
| ------- | ------------------ | ------------------------- |
| quick   | Zoom In + Scroll   | `CTRL+V` → scroll down   |
| long    | Scroll In          | scroll up 20 ticks        |

### Key D (toggle mode — R streaming)
| Action      | Behavior                          |
| ----------- | --------------------------------- |
| Press #1    | R stream ON, TTS "on on on"       |
| Press #2    | R stream OFF, TTS "off off off"   |
| R interval  | 430ms between Rs                  |

### S Toggle Intercepts (S held past 512ms)
| Key | Output                 |
| --- | ---------------------- |
| 1   | F10 → ALT+F9 (Group 1)|
| 2   | F11 → ALT+F9 (Group 2)|
| 3   | F12 → ALT+F9 (Group 3)|
| 4   | INSERT → ALT+F9 (Group 4)|
| 5   | M → ALT+F9 (ToT + Cog)|
| 6   | J → ALT+F9 (Focus ToT)|
| T   | M → ALT+F9 (ToT + Cog)|

### Q Toggle (Q held >350ms)
| Key + Gesture  | Ability         | Output      |
| -------------- | --------------- | ----------- |
| 5 quick_q_toggle | Smash          | `]` (echo×2)|
| 6 quick_q_toggle | Seismic Grenade| `ALT+/`     |

---

## 🎮 NEW SWTOR In-Game Keybinds Required

| Ability/Function       | New SWTOR Keybind | Previous |
| ---------------------- | ----------------- | -------- |
| Close Enemy            | `8`               | `Q`      |
| Cog Icon               | `ALT+F9`          | `7`      |
| Set Focus Target       | `9`               | `X`      |
| Focus Target Modifier  | `7`               | `SHIFT+R`|
| Basic Attack           | `X`               | `SHIFT+Q`|
| Vicious Slash          | `ALT+[`           | `SHIFT+L`|
| Seismic Grenade        | `ALT+/`           | `ALT+NUMPAD4`|
| Ravage                 | `SHIFT+K`         | *(same)* |
| Force Push             | `ALT+L`           | *(same)* |
| Invincible             | `B` (direct)      | `ALT+M`  |
| Endure Pain            | `SPACEBAR` (direct)| `SHIFT+,`|

---

_Generated from omegaMappings.ts — last updated for Omega overhaul_
