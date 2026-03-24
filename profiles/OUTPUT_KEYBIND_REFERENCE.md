# Omega Output Keybind Reference — All Profiles

> Generated from `omegaMappings.ts` and `omegaProfiles.ts`
> F4 has been **completely removed** from all output bindings. Replaced with **SHIFT+F3** where applicable.

---

## Profile Legend

| Key   | Profile                     | D Key Mode                              | S Quick Ability            |
| ----- | --------------------------- | --------------------------------------- | -------------------------- |
| **T** | Vengeance Juggernaut (Tank) | continuous_stream                       | Guard + Shield (L → \\)    |
| **R** | Rage Juggernaut             | burst_stream_slow (3×R, 5.6–6.8s cycle) | SpaceJamProtection (ALT+V) |
| **S** | Sorc Heals                  | single_press (D quick → ALT+O)          | Cleanse (ALT+Z)            |
| **M** | Sorc Madness                | single_press (D quick → ALT+O)          | Cleanse (ALT+Z)            |
| **E** | Engineering Sniper          | single_press (D quick → ALT+O)          | Met Prep (SHIFT+V)         |
| **C** | Combat Medic                | burst_stream_fast (3×R, 3.6–4.2s cycle) | Cleanse (ALT+Z)            |
| **A** | Arsenal Mercenary           | burst_stream_fast (3×R, 3.6–4.2s cycle) | Cleanse (ALT+Z)            |

---

## Shared Bindings (All Profiles)

These bindings are identical across all 7 profiles.

| Input Key    | Gesture        | Ability                  | Output Key(s)                      |
| ------------ | -------------- | ------------------------ | ---------------------------------- |
| SPACEBAR     | quick          | Endure Pain Drop Timer   | _Timer: 15.5s "drop"_              |
| SPACEBAR     | long           | Endure Pain Drop Timer   | _Timer: 15.5s "drop"_              |
| W            | quick          | Close Enemy + Cog        | `8` → `ALT+F9`                     |
| W            | quick_toggle   | Next Friend + Cog        | `.` → `ALT+F9`                     |
| Y            | quick          | Next Target + Cog        | `V` → `ALT+F9`                     |
| Y            | quick_toggle   | Close Friend + Cog       | `'` → `ALT+F9`                     |
| T            | quick          | Previous Target + Cog    | `ALT+]` → `ALT+F9`                 |
| T            | long           | Previous Friend + Cog    | `ALT+.` → `ALT+F9`                 |
| T            | quick_toggle   | Target of Target + Cog   | `M` → `ALT+F9`                     |
| T            | long_toggle    | Focus Target's ToT + Cog | `J` → `ALT+F9`                     |
| C            | quick          | Burst Timer (13s)        | _Timer: 13s "burst"_               |
| C            | long           | Laze Timer (31s)         | _Timer: 31s "laze"_                |
| C            | quick_toggle   | Yield Timer (45s)        | _Timer: 45s "yield"_               |
| C            | long_toggle    | Fuel Timer (103s)        | _Timer: 103s "fuel"_               |
| MIDDLE_CLICK | quick          | Max Zoom In + Scroll Out | `CTRL+V` → _420-480ms_ → scroll↓20 |
| MIDDLE_CLICK | long           | Scroll In (20 ticks)     | scroll↑20                          |
| S+5          | quick_s_toggle | Target of Target + Cog   | `M` → `ALT+F9`                     |
| S+6          | quick_s_toggle | Focus ToT + Cog          | `J` → `ALT+F9`                     |
| Q+5          | _dynamic DPS_  | DPS 1 Target → ToT → Cog | _[dps1 slot key]_ → `M` → `ALT+F9` |
| Q+6          | _dynamic DPS_  | DPS 2 Target → ToT → Cog | _[dps2 slot key]_ → `M` → `ALT+F9` |

---

## T — Vengeance Juggernaut (Tank)

| Input | Gesture      | Ability                           | Output Key(s)                                |
| ----- | ------------ | --------------------------------- | -------------------------------------------- |
| 1     | quick        | Crushing Blow                     | `N`                                          |
| 1     | long         | Center Target + Cog               | `SHIFT+O` → `ALT+F9`                         |
| 1     | quick_toggle | Crushing Blow                     | `N`                                          |
| 1     | long_toggle  | Center Target + Cog               | `SHIFT+O` → `ALT+F9`                         |
| 2     | quick        | Force Scream                      | `O`                                          |
| 3     | quick        | Aegis Assault                     | `Z`                                          |
| 3     | long         | Smash                             | `]`                                          |
| 3     | quick_toggle | Vicious Slash                     | `ALT+[`                                      |
| 4     | quick        | Interrupt                         | `K`                                          |
| 4     | quick_toggle | Force Choke                       | `DELETE`                                     |
| 4     | quick_f2     | Electro Stun Grenade              | `ALT+-`                                      |
| 5     | quick        | Vicious Throw                     | `[`                                          |
| 5     | quick_toggle | Backhand                          | `BACKSPACE`                                  |
| 5     | quick_f2     | Saber Throw                       | `SHIFT+N`                                    |
| 5     | long_f2      | Focus Mod + Saber Throw           | `7`(hold) → `SHIFT+N`                        |
| 6     | quick        | Ravage                            | `SHIFT+K`                                    |
| 6     | quick_toggle | Force Push                        | `ALT+L`                                      |
| 6     | quick_f2     | Seismic Grenade                   | `ALT+/`                                      |
| A     | quick        | Leap                              | `F9`                                         |
| A     | quick_toggle | Single Taunt                      | `F6`                                         |
| A     | long_toggle  | Focus Mod + Single Taunt          | `7`(hold) → `F6`                             |
| S     | quick        | Guard + Shield                    | `L` → `\`                                    |
| D     | toggle       | Retaliate Stream                  | `R` (continuous)                             |
| I     | quick        | Relic                             | `SHIFT+X`                                    |
| I     | quick_toggle | Focus Mod + Single Taunt          | `7`(hold) → `F6`                             |
| I     | long_toggle  | Mass Taunt + Focus Taunt + Enrage | `F7` → `7`(hold) → `F6` → `F7` → `F7` → `F8` |
| U     | quick        | Enraged Defense                   | `SHIFT+.`                                    |
| U     | quick_toggle | Saber Ward                        | `,`                                          |
| H     | quick        | Focus + Taunt + Relic 2           | `7`(hold) → `F6` → `ALT+X`                   |
| 4+7   | combo        | Close Enemy + Interrupt           | `8` → `K`                                    |

---

## R — Rage Juggernaut

| Input | Gesture      | Ability                      | Output Key(s)                                |
| ----- | ------------ | ---------------------------- | -------------------------------------------- |
| 1     | quick        | Furious Strike               | `N`                                          |
| 1     | long         | Center Target + Cog          | `SHIFT+O` → `ALT+F9`                         |
| 2     | quick        | Force Scream                 | `O`                                          |
| 2     | long         | Sweeping Slash               | `SHIFT+J`                                    |
| 2     | quick_toggle | Raging Burst                 | `ALT+O`                                      |
| 3     | quick        | Sundering Strike             | `Z`                                          |
| 3     | long         | Smash                        | `]`                                          |
| 3     | quick_toggle | Vicious Slash                | `ALT+[`                                      |
| 3     | quick_f2     | Ravage                       | `SHIFT+K`                                    |
| 4     | quick        | Interrupt                    | `K`                                          |
| 4     | quick_toggle | Force Choke                  | `DELETE`                                     |
| 4     | quick_f2     | Electro Stun Grenade         | `ALT+-`                                      |
| 5     | quick        | Vicious Throw                | `[`                                          |
| 5     | long         | Force Crush                  | `SHIFT+Z`                                    |
| 5     | quick_toggle | Obliterate                   | `ALT+N`                                      |
| 5     | long_toggle  | Seismic Grenade              | `ALT+/`                                      |
| 5     | quick_f2     | Saber Throw                  | `SHIFT+N`                                    |
| 5     | long_f2      | Focus Mod + Saber Throw      | `7`(hold) → `SHIFT+N`                        |
| 6     | quick        | Retaliation                  | `R`                                          |
| 6     | quick_toggle | Force Push                   | `ALT+L`                                      |
| 6     | quick_f2     | Seismic Grenade (6F2)        | `ALT+/`                                      |
| A     | quick        | Leap                         | `F9`                                         |
| A     | quick_toggle | Single Taunt                 | `F6`                                         |
| A     | long_toggle  | Focus Mod + Single Taunt     | `7`(hold) → `F6`                             |
| S     | quick        | SpaceJamProtection           | `ALT+V`                                      |
| D     | toggle       | Retaliate Burst (slow)       | `R` ×3, 100-127ms gap, 5.6-6.8s cycle        |
| U     | quick        | Enraged Defense              | `SHIFT+.`                                    |
| U     | quick_toggle | Saber Ward                   | `,`                                          |
| I     | quick        | Relic                        | `SHIFT+X`                                    |
| I     | quick_toggle | Focus Mod + Single Taunt (I) | `7`(hold) → `F6`                             |
| I     | long_toggle  | Mass Taunt Combo             | `F7` → `7`(hold) → `F6` → `F7` → `F7` → `F8` |
| H     | quick        | Focus Mod + Taunt + Relic 2  | `7`(hold) → `F6` → `ALT+X`                   |

---

## S — Sorc Heals

| Input | Gesture        | Ability                          | Output Key(s)  |
| ----- | -------------- | -------------------------------- | -------------- |
| 1     | quick          | Resurgence                       | `N`            |
| 1     | long           | Close Friend + Cog               | `'` → `ALT+F9` |
| 1     | quick_toggle   | Innervate                        | `N`            |
| 1     | quick_f2       | Affliction                       | `F1`           |
| 2     | quick          | Revivification                   | `O`            |
| 2     | quick_toggle   | Roaming Mend                     | `F3`           |
| 2     | quick_f2       | Knockback                        | `SHIFT+F3`     |
| 3     | quick          | Rally                            | `Z`            |
| 3     | quick_toggle   | Dark Heal                        | `SHIFT+J`      |
| 3     | quick_f2       | Crushing Darkness                | `F5`           |
| 4     | quick          | Interrupt                        | `K`            |
| 4     | quick_toggle   | Electrocute                      | `DELETE`       |
| 4     | quick_f2       | Electro Grenade                  | `ALT+-`        |
| 4     | quick_q_toggle | Shock                            | `ALT+K`        |
| 5     | quick          | Cloud Mind                       | `[`            |
| 5     | quick_toggle   | Consume Darkness                 | `BACKSPACE`    |
| 5     | quick_f2       | Force Lightning                  | `SHIFT+L`      |
| 6     | quick          | Static Barrier                   | `SHIFT+K`      |
| 6     | quick_toggle   | Sorcerer Pull                    | `ALT+L`        |
| 6     | quick_f2       | Seismic Grenade                  | `ALT+/`        |
| A     | quick          | Force Speed                      | `F9`           |
| S     | quick          | Cleanse                          | `ALT+Z`        |
| D     | quick          | Self Heal                        | `ALT+O`        |
| U     | quick          | Cloud Mind (U)                   | `SHIFT+.`      |
| U     | quick_toggle   | Barrier                          | `,`            |
| I     | quick          | Polarity Shift                   | `SHIFT+X`      |
| I     | quick_toggle   | Relic                            | `SHIFT+V`      |
| H     | quick          | Recklessness                     | `SHIFT+R`      |
| B     | quick          | Phase Walk / Voltaic / Whirlwind | `]`            |

---

## M — Sorc Madness

| Input | Gesture        | Ability                          | Output Key(s)  |
| ----- | -------------- | -------------------------------- | -------------- |
| 1     | quick          | Affliction                       | `N`            |
| 1     | long           | Close Friend + Cog               | `'` → `ALT+F9` |
| 1     | quick_toggle   | Force Lightning (1 toggle)       | `SHIFT+L`      |
| 1     | quick_f2       | Resurgence                       | `F1`           |
| 2     | quick          | Creeping Terror                  | `O`            |
| 2     | quick_toggle   | Force Storm                      | `F3`           |
| 2     | quick_f2       | Knockback                        | `SHIFT+F3`     |
| 3     | quick          | Death Field                      | `Z`            |
| 3     | quick_toggle   | Force Leech                      | `SHIFT+J`      |
| 3     | quick_f2       | Consume Darkness                 | `F5`           |
| 4     | quick          | Interrupt                        | `K`            |
| 4     | quick_toggle   | Electrocute                      | `DELETE`       |
| 4     | quick_f2       | Electro Grenade                  | `ALT+-`        |
| 4     | quick_q_toggle | Shock                            | `ALT+K`        |
| 5     | quick          | Cloud Mind                       | `[`            |
| 5     | quick_toggle   | Demolish                         | `BACKSPACE`    |
| 5     | quick_f2       | Force Lightning (5 F2)           | `SHIFT+L`      |
| 6     | quick          | Static Barrier                   | `SHIFT+K`      |
| 6     | quick_toggle   | Sorcerer Pull                    | `ALT+L`        |
| 6     | quick_f2       | Seismic Grenade                  | `ALT+/`        |
| A     | quick          | Force Speed                      | `F9`           |
| S     | quick          | Cleanse                          | `ALT+Z`        |
| D     | quick          | Self Heal                        | `ALT+O`        |
| U     | quick          | Force Speed (U)                  | `SHIFT+.`      |
| U     | quick_toggle   | Barrier                          | `,`            |
| I     | quick          | Polarity Shift                   | `SHIFT+X`      |
| I     | quick_toggle   | Relic                            | `SHIFT+V`      |
| H     | quick          | Recklessness                     | `SHIFT+R`      |
| B     | quick          | Phase Walk / Voltaic / Whirlwind | `]`            |

---

## E — Engineering Sniper

| Input | Gesture        | Ability                  | Output Key(s)    |
| ----- | -------------- | ------------------------ | ---------------- |
| 1     | quick          | Snipe                    | `N`              |
| 1     | quick_toggle   | Series of Shots          | `ALT+N`          |
| 1     | quick_f2       | Corrosive Dart           | `F1`             |
| 2     | quick          | Crouch                   | `O`              |
| 2     | quick_toggle   | Crouch 2                 | `F3`             |
| 2     | quick_f2       | Entrench                 | `SHIFT+F3`       |
| 3     | quick          | Interrogation Probe      | `Z`              |
| 3     | quick_toggle   | Plasma Probe             | `SHIFT+J`        |
| 3     | quick_f2       | Laze Target              | `F5`             |
| 4     | quick          | Interrupt                | `K`              |
| 4     | quick_toggle   | EMP Discharge            | `DELETE`         |
| 4     | quick_f2       | Sabotage                 | `ALT+-`          |
| 4     | quick_q_toggle | Electro Stun             | `ALT+K`          |
| 5     | quick          | Frag Grenade             | `[`              |
| 5     | quick_toggle   | Suppressive Fire         | `BACKSPACE`      |
| 5     | quick_f2       | Orbital Strike           | `SHIFT+L`        |
| 6     | quick          | Knockback                | `SHIFT+K`        |
| 6     | quick_toggle   | Maim / Ballistic Shield  | `ALT+L`          |
| 6     | quick_f2       | Diversion                | `ALT+Z`          |
| A     | quick          | Roll                     | `F9`             |
| A     | quick_toggle   | Single Taunt             | `F6`             |
| A     | long_toggle    | Focus Mod + Single Taunt | `7`(hold) → `F6` |
| S     | quick          | Met Prep                 | `SHIFT+V`        |
| D     | quick          | Shield Probe             | `ALT+O`          |
| U     | quick          | Evasion                  | `SHIFT+.`        |
| I     | quick          | Relic                    | `SHIFT+X`        |
| H     | quick          | Reload Ammo              | `ALT+X`          |

---

## C — Combat Medic

| Input | Gesture        | Ability                | Output Key(s)                         |
| ----- | -------------- | ---------------------- | ------------------------------------- |
| 1     | quick          | Kolto Shot             | `N`                                   |
| 1     | quick_toggle   | Successive Treatment   | `ALT+N`                               |
| 1     | quick_f2       | Sticky Grenade         | `F1`                                  |
| 2     | quick          | Bacta Infusion         | `O`                                   |
| 2     | quick_toggle   | Plasma Grenade         | `F3`                                  |
| 2     | quick_f2       | Full Auto              | `SHIFT+F3`                            |
| 3     | quick          | Advanced Medical Probe | `Z`                                   |
| 3     | quick_toggle   | Medical Probe          | `SHIFT+J`                             |
| 3     | quick_f2       | Charge Bolts           | `F5`                                  |
| 3     | quick_q_toggle | High Impact Bolt       | `ALT+J`                               |
| 4     | quick          | Interrupt              | `K`                                   |
| 4     | quick_toggle   | Knockback              | `DELETE`                              |
| 4     | quick_f2       | Electro Stun           | `ALT+-`                               |
| 4     | quick_q_toggle | Explosive Round        | `ALT+K`                               |
| 5     | quick          | Kolto Bomb             | `[`                                   |
| 5     | quick_toggle   | Mortar Volley          | `BACKSPACE`                           |
| 5     | quick_f2       | Net                    | `SHIFT+L`                             |
| 6     | quick          | Trauma Probe           | `SHIFT+K`                             |
| 6     | quick_toggle   | Hydroserums            | `ALT+L`                               |
| 6     | quick_f2       | Seismic Mine           | `ALT+/`                               |
| B     | quick          | Concussive Missile     | `SHIFT+[`                             |
| A     | quick          | React Shield           | `F9`                                  |
| A     | quick_toggle   | Reflecto Guard         | `F6`                                  |
| S     | quick          | Cleanse                | `ALT+Z`                               |
| D     | toggle         | Retaliate Burst (fast) | `R` ×3, 100-127ms gap, 3.6-4.2s cycle |
| U     | quick          | Adrenaline Rush        | `SHIFT+.`                             |
| I     | quick          | Relic                  | `SHIFT+X`                             |
| I     | quick_toggle   | Tech Override          | `ALT+M`                               |
| I     | quick_f2       | Reload                 | `ALT+\`                               |
| H     | quick          | Chaff Flare            | `SHIFT+]`                             |

---

## A — Arsenal Mercenary

| Input | Gesture        | Ability                       | Output Key(s)                         |
| ----- | -------------- | ----------------------------- | ------------------------------------- |
| 1     | quick          | Tracer Missile                | `N`                                   |
| 1     | quick_toggle   | Bolstorm                      | `ALT+N`                               |
| 1     | quick_f2       | Sticky Grenade / Stealth Scan | `F1`                                  |
| 1     | quick_q_toggle | Basic Attack                  | `X`                                   |
| 2     | quick          | Bacta Infusion                | `O`                                   |
| 2     | quick_toggle   | Plasma Grenade                | `F3`                                  |
| 2     | quick_f2       | Full Auto                     | `SHIFT+F3`                            |
| 3     | quick          | Heatseeker Missile            | `Z`                                   |
| 3     | quick_toggle   | Med Probe                     | `SHIFT+J`                             |
| 3     | quick_f2       | Priming Shot                  | `F5`                                  |
| 3     | quick_q_toggle | High Impact Bolt              | `ALT+J`                               |
| 4     | quick          | Interrupt                     | `K`                                   |
| 4     | quick_toggle   | Knockback                     | `DELETE`                              |
| 4     | quick_f2       | Electro Stun                  | `ALT+-`                               |
| 4     | quick_q_toggle | Relic 2                       | `ALT+F6`                              |
| 5     | quick          | Sweeping Gunfire              | `[`                                   |
| 5     | quick_toggle   | Mortar Volley                 | `BACKSPACE`                           |
| 5     | quick_f2       | Net                           | `SHIFT+L`                             |
| 6     | quick          | Explosive Round               | `SHIFT+K`                             |
| 6     | quick_toggle   | Hydroserums                   | `ALT+L`                               |
| 6     | quick_f2       | Seismic Mine                  | `ALT+/`                               |
| B     | quick          | Concussive Missile            | `SHIFT+[`                             |
| A     | quick          | React Shield                  | `F9`                                  |
| A     | quick_toggle   | Reflecto Guard                | `F6`                                  |
| S     | quick          | Cleanse                       | `ALT+Z`                               |
| D     | toggle         | Retaliate Burst (fast)        | `R` ×3, 100-127ms gap, 3.6-4.2s cycle |
| U     | quick          | Adrenaline Rush               | `SHIFT+.`                             |
| I     | quick          | Relic                         | `SHIFT+X`                             |
| I     | quick_toggle   | Tech Override                 | `ALT+M`                               |
| I     | quick_f2       | Reload                        | `ALT+\`                               |
| H     | quick          | Chaff Flare                   | `SHIFT+]`                             |

---

## Output Key Master Index

Every unique output key the Teensy sends, and which profile(s) / ability use it.

| Output Key  | Ability (Profile)                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `N`         | 1q: Crushing Blow (T), Furious Strike (R), Resurgence (S), Affliction (M), Snipe (E), Kolto Shot (C), Tracer Missile (A)            |
| `O`         | 2q: Force Scream (T/R), Revivification (S), Creeping Terror (M), Crouch (E), Bacta Infusion (C/A)                                   |
| `Z`         | 3q: Aegis Assault (T), Sundering Strike (R), Rally (S), Death Field (M), Interrogation Probe (E), Adv Med Probe (C), Heatseeker (A) |
| `[`         | 5q: Vicious Throw (T/R), Cloud Mind (S/M), Frag Grenade (E), Kolto Bomb (C), Sweeping Gunfire (A)                                   |
| `]`         | 3L: Smash (T/R). Bq: Phase Walk/Voltaic/Whirlwind (S/M)                                                                             |
| `K`         | 4q: Interrupt (all profiles)                                                                                                        |
| `DELETE`    | 4qt: Force Choke (T/R), Electrocute (S/M), EMP Discharge (E), Knockback (C/A)                                                       |
| `ALT+-`     | 4f2: Electro Stun Grenade (T/R/S/M), Sabotage (E), Electro Stun (C/A)                                                               |
| `BACKSPACE` | 5qt: Backhand (T), Consume Darkness (S), Demolish (M), Suppressive Fire (E), Mortar Volley (C/A)                                    |
| `SHIFT+K`   | 6q: Ravage (T), Static Barrier (S/M), Knockback (E), Trauma Probe (C), Explosive Round (A). 3f2: Ravage (R)                         |
| `ALT+L`     | 6qt: Force Push (T/R), Sorcerer Pull (S/M), Maim/Ballistic (E), Hydroserums (C/A)                                                   |
| `ALT+/`     | 6f2: Seismic Grenade/Mine (T/R/S/M/C/A). 5lt: Seismic Grenade (R)                                                                   |
| `F3`        | 2qt: Roaming Mend (S), Force Storm (M), Crouch 2 (E), Plasma Grenade (C/A)                                                          |
| `SHIFT+F3`  | 2f2 (was F4): Knockback (S/M), Entrench (E), Full Auto (C/A)                                                                        |
| `F1`        | 1f2: Affliction (S), Resurgence (M), Corrosive Dart (E), Sticky Grenade (C/A)                                                       |
| `F5`        | 3f2: Crushing Darkness (S), Consume Darkness (M), Laze Target (E), Charge Bolts (C), Priming Shot (A)                               |
| `SHIFT+J`   | 2L: Sweeping Slash (R). 3qt: Dark Heal (S), Force Leech (M), Plasma Probe (E), Medical Probe (C), Med Probe (A)                     |
| `ALT+[`     | 3qt: Vicious Slash (T/R)                                                                                                            |
| `SHIFT+L`   | 5f2: Force Lightning (S/M), Orbital Strike (E), Net (C/A)                                                                           |
| `ALT+O`     | 2qt: Raging Burst (R). Dq: Self Heal (S/M), Shield Probe (E)                                                                        |
| `ALT+N`     | 5qt: Obliterate (R). 1qt: Series of Shots (E)                                                                                       |
| `SHIFT+Z`   | 5L: Force Crush (R)                                                                                                                 |
| `ALT+V`     | Sq: SpaceJamProtection (R)                                                                                                          |
| `ALT+Z`     | Sq: Cleanse (S/M/C/A). 6f2: Diversion (E)                                                                                           |
| `SHIFT+V`   | Sq: Met Prep (E). Iqt: Relic (S/M)                                                                                                  |
| `SHIFT+R`   | Hq: Recklessness (S/M)                                                                                                              |
| `ALT+K`     | 4qq: Shock (S/M), Electro Stun (E), Explosive Round (C)                                                                             |
| `ALT+J`     | 3qq: High Impact Bolt (C). 3qq: High Impact Bolt (A)                                                                                |
| `ALT+M`     | Iqt: Tech Override (C/A)                                                                                                            |
| `ALT+\`     | If2: Reload (C/A)                                                                                                                   |
| `SHIFT+[`   | Bq: Concussive Missile (C/A)                                                                                                        |
| `SHIFT+]`   | Hq: Chaff Flare (C/A)                                                                                                               |
| `ALT+F6`    | 4qq: Relic 2 (A)                                                                                                                    |
| `X`         | 1qq: Basic Attack (A)                                                                                                               |
| `R`         | D key: Retaliate (all — mode varies). 6q: Retaliation (R)                                                                           |
| `F9`        | Aq: Leap (T/R), Force Speed (S/M), Roll (E), React Shield (C/A)                                                                     |
| `F6`        | Aqt: Single Taunt (T/R/E), Reflecto Guard (C/A)                                                                                     |
| `SHIFT+N`   | 5f2: Saber Throw (T/R)                                                                                                              |
| `SHIFT+X`   | Iq: Relic (T/R/E/C/A), Polarity Shift (S/M)                                                                                         |
| `ALT+X`     | Hq final step: Relic 2 (T/R). Hq: Reload Ammo (E)                                                                                   |
| `SHIFT+.`   | Uq: Enraged Defense (T/R), Cloud Mind (S), Force Speed (M), Evasion (E), Adrenaline Rush (C/A)                                      |
| `,`         | Uqt: Saber Ward (T/R), Barrier (S/M)                                                                                                |
| `'`         | Y qt (shared). 1L: Close Friend + Cog (S/M)                                                                                         |
| `7` (hold)  | Focus Modifier: 5Lf2, Alt, Iqt, Ilt, Hq (T/R/E)                                                                                     |
| `F7`        | Mass Taunt (T/R Ilt only)                                                                                                           |
| `F8`        | Enrage (T/R Ilt only)                                                                                                               |
| `SHIFT+O`   | Center Target (1L, T/R only)                                                                                                        |
| `ALT+F9`    | Cog icon (after all targeting steps)                                                                                                |
| `8`         | Close Enemy targeting (W quick)                                                                                                     |
| `.`         | Next Friend targeting (W qt)                                                                                                        |
| `V`         | Next Target targeting (Y quick)                                                                                                     |
| `ALT+]`     | Previous Target (T quick)                                                                                                           |
| `ALT+.`     | Previous Friend (T long)                                                                                                            |
| `M`         | Target of Target (T qt, S+5, Q+5/Q+6)                                                                                               |
| `J`         | Focus Target's ToT (T lt, S+6)                                                                                                      |
| `CTRL+V`    | Max Zoom In (MIDDLE_CLICK quick)                                                                                                    |
| `ESCAPE`    | C double-tap output                                                                                                                 |

---

## F4 Removal Summary

**F4 (`F4`) is no longer used as any output key.** The following bindings use `SHIFT+F3` (was F4):

| Profile | Key | Gesture  | Ability   | Output   |
| ------- | --- | -------- | --------- | -------- |
| S       | 2   | quick_f2 | Knockback | SHIFT+F3 |
| M       | 2   | quick_f2 | Knockback | SHIFT+F3 |
| E       | 2   | quick_f2 | Entrench  | SHIFT+F3 |
| C       | 2   | quick_f2 | Full Auto | SHIFT+F3 |
| A       | 2   | quick_f2 | Full Auto | SHIFT+F3 |

Tank (T) and Rage (R) have no key 2 F2 binding — no change needed.
