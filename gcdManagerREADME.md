# GCD System Implementation

## Overview

The GCD (Global Cooldown) system emulates SWTOR's ability timing:

- **1.275 second global cooldown** after any GCD ability
- **Per-ability cooldowns** that must expire before reuse
- **Queue system** - most recent gesture wins when GCD ends
- **Gesture fallback** - long ↔ super_long when one is unbound

---

## GCD Abilities

These abilities trigger the 1.275s global cooldown:

| Ability         | Individual CD | Notes            |
| --------------- | ------------- | ---------------- |
| Crushing Blow   | 7s            | Primary rotation |
| Force Scream    | 11s           | Primary rotation |
| Aegis Assault   | 11s           | Primary rotation |
| Vicious Throw   | 9s            | Execute          |
| Ravage          | 16.5s         | Channeled        |
| Guard           | 1s            | Guard swap       |
| Intercede       | 18s           | Defensive leap   |
| Smash           | 14s           | AoE              |
| Force Leap      | 3s            | Mobility         |
| Force Choke     | 50s           | Hard CC          |
| Backhand        | 50s           | Hard CC          |
| Force Push      | 50s           | Hard CC          |
| Sweeping Slash  | GCD only      | No individual CD |
| Vicious Slash   | GCD only      | No individual CD |
| Basic Attack    | GCD only      | No individual CD |
| Saber Throw     | GCD only      | No individual CD |
| Electro Stun    | GCD only      | No individual CD |
| Seismic Grenade | GCD only      | No individual CD |

---

## Profile Changes

### 1. Add `gcdAbility` field to MacroBinding

The system can auto-detect abilities from macro names, but explicit declaration is preferred:

```json
{
  "name": "Crushing Blow",
  "gcdAbility": "CRUSHING_BLOW",
  "trigger": { "key": "1", "gesture": "single" },
  "sequence": [
    { "key": "N", "minDelay": 25, "maxDelay": 30, "bufferTier": "low" }
  ],
  "enabled": true
}
```

### 2. Valid gcdAbility values:

- `CRUSHING_BLOW`
- `FORCE_SCREAM`
- `AEGIS_ASSAULT`
- `SWEEPING_SLASH`
- `VICIOUS_SLASH`
- `BASIC_ATTACK`
- `RAVAGE`
- `SMASH`
- `VICIOUS_THROW`
- `SABER_THROW`
- `FORCE_CHOKE`
- `BACKHAND`
- `FORCE_PUSH`
- `ELECTRO_STUN`
- `SEISMIC_GRENADE`
- `INTERCEDE`
- `GUARD`
- `FORCE_LEAP`

---

## Gesture Fallback Logic

For single, double, triple, quadruple taps:

- If `long` gesture triggered but has no binding → try `super_long`
- If `super_long` gesture triggered but has no binding → try `long`

This allows you to:

- Bind only `single_long` - both long and super_long will trigger it
- Bind only `single_super_long` - both long and super_long will trigger it
- Or bind both for distinct actions

### Empty Binding Detection

A binding is considered "empty" (eligible for fallback) if:

- Name contains `~` (placeholder marker)
- Sequence array is empty `[]`
- `enabled: false`

---

## JSON Profile Example with GCD Fields

```json
{
  "name": "SWTOR Vengeance Juggernaut",
  "description": "Vengeance Jugg with GCD tracking",
  "gestureSettings": {
    "multiPressWindow": 355,
    "debounceDelay": 15,
    "longPressMin": 520,
    "longPressMax": 860,
    "superLongMin": 861,
    "superLongMax": 1300,
    "cancelThreshold": 1301
  },
  "macros": [
    {
      "name": "Crushing Blow",
      "gcdAbility": "CRUSHING_BLOW",
      "trigger": { "key": "1", "gesture": "single" },
      "sequence": [
        {
          "key": "N",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "low",
          "echoHits": { "count": 3, "windowMs": 170 }
        }
      ],
      "enabled": true
    },
    {
      "name": "Retaliation + Crushing Blow",
      "gcdAbility": "CRUSHING_BLOW",
      "trigger": { "key": "1", "gesture": "double" },
      "sequence": [
        { "key": "R", "minDelay": 25, "maxDelay": 30, "bufferTier": "low" },
        {
          "key": "N",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "low",
          "echoHits": { "count": 3, "windowMs": 170 }
        }
      ],
      "enabled": true
    },
    {
      "name": "Backhand",
      "gcdAbility": "BACKHAND",
      "trigger": { "key": "1", "gesture": "single_long" },
      "sequence": [
        {
          "key": "ALT+V",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "medium"
        }
      ],
      "enabled": true
    },
    {
      "name": "Force Choke",
      "gcdAbility": "FORCE_CHOKE",
      "trigger": { "key": "1", "gesture": "single_super_long" },
      "sequence": [
        {
          "key": "ALT+NUMPAD3",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "medium"
        }
      ],
      "enabled": true
    },
    {
      "name": "Force Scream",
      "gcdAbility": "FORCE_SCREAM",
      "trigger": { "key": "2", "gesture": "single" },
      "sequence": [
        {
          "key": "O",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "low",
          "echoHits": { "count": 3, "windowMs": 170 }
        }
      ],
      "enabled": true
    },
    {
      "name": "Aegis Assault",
      "gcdAbility": "AEGIS_ASSAULT",
      "trigger": { "key": "3", "gesture": "single" },
      "sequence": [
        {
          "key": "Z",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "low",
          "echoHits": { "count": 3, "windowMs": 170 }
        }
      ],
      "enabled": true
    },
    {
      "name": "Sweeping Slash",
      "gcdAbility": "SWEEPING_SLASH",
      "trigger": { "key": "6", "gesture": "single" },
      "sequence": [
        {
          "key": "SHIFT+J",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "low"
        }
      ],
      "enabled": true
    },
    {
      "name": "Ravage",
      "gcdAbility": "RAVAGE",
      "trigger": { "key": "6", "gesture": "single_long" },
      "sequence": [
        {
          "key": "SHIFT+X",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "medium"
        }
      ],
      "enabled": true
    },
    {
      "name": "Vicious Throw",
      "gcdAbility": "VICIOUS_THROW",
      "trigger": { "key": "5", "gesture": "single" },
      "sequence": [
        {
          "key": "[",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "low",
          "echoHits": { "count": 3, "windowMs": 170 }
        }
      ],
      "enabled": true
    },
    {
      "name": "Saber Throw",
      "gcdAbility": "SABER_THROW",
      "trigger": { "key": "5", "gesture": "single_long" },
      "sequence": [
        {
          "key": "SHIFT+M",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "medium"
        }
      ],
      "enabled": true
    },
    {
      "name": "Guard Swap",
      "gcdAbility": "GUARD",
      "trigger": { "key": "4", "gesture": "single_long" },
      "sequence": [
        { "key": "L", "minDelay": 25, "maxDelay": 30, "bufferTier": "low" },
        {
          "key": "NUMPAD_MULTIPLY",
          "minDelay": 6,
          "maxDelay": 12,
          "bufferTier": "low"
        }
      ],
      "enabled": true
    },
    {
      "name": "Intercede",
      "gcdAbility": "INTERCEDE",
      "trigger": { "key": "4", "gesture": "single_super_long" },
      "sequence": [
        { "key": ";", "minDelay": 25, "maxDelay": 30, "bufferTier": "medium" }
      ],
      "enabled": true
    },
    {
      "name": "Force Leap",
      "gcdAbility": "FORCE_LEAP",
      "trigger": { "key": "A", "gesture": "single" },
      "sequence": [
        { "key": "F9", "minDelay": 25, "maxDelay": 30, "bufferTier": "low" }
      ],
      "enabled": true
    },
    {
      "name": "Smash",
      "gcdAbility": "SMASH",
      "trigger": { "key": "2", "gesture": "double" },
      "sequence": [
        { "key": "]", "minDelay": 25, "maxDelay": 30, "bufferTier": "medium" }
      ],
      "enabled": true
    },
    {
      "name": "Electro Stun",
      "gcdAbility": "ELECTRO_STUN",
      "trigger": { "key": "2", "gesture": "single_long" },
      "sequence": [
        {
          "key": "ALT+NUMPAD6",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "medium"
        }
      ],
      "enabled": true
    },
    {
      "name": "Force Push",
      "gcdAbility": "FORCE_PUSH",
      "trigger": { "key": "2", "gesture": "single_super_long" },
      "sequence": [
        {
          "key": "ALT+NUMPAD4",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "medium"
        }
      ],
      "enabled": true
    },
    {
      "name": "Seismic Grenade",
      "gcdAbility": "SEISMIC_GRENADE",
      "trigger": { "key": "3", "gesture": "single_super_long" },
      "sequence": [
        {
          "key": "ALT+NUMPAD5",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "medium"
        }
      ],
      "enabled": true
    },
    {
      "name": "Jump",
      "trigger": { "key": "W", "gesture": "single" },
      "sequence": [
        {
          "key": "NUMPAD0",
          "minDelay": 25,
          "maxDelay": 30,
          "bufferTier": "low"
        }
      ],
      "enabled": true
    },
    {
      "name": "Interrupt",
      "trigger": { "key": "4", "gesture": "single" },
      "sequence": [
        { "key": "K", "minDelay": 25, "maxDelay": 30, "bufferTier": "low" }
      ],
      "enabled": true
    },
    {
      "name": "Saber Ward",
      "trigger": { "key": "Y", "gesture": "single" },
      "sequence": [
        { "key": ",", "minDelay": 25, "maxDelay": 30, "bufferTier": "low" }
      ],
      "enabled": true
    }
  ]
}
```

---

## YAML Manifest Updates

Add `gcdAbility` field to entries that contain GCD abilities:

```yaml
1:
  single:
    name: Crushing Blow
    gcdAbility: CRUSHING_BLOW
    sequence:
      - key: N
        bufferTier: low
        echoHits: { count: 3, windowMs: 170 }

  single_long:
    name: Backhand
    gcdAbility: BACKHAND
    sequence:
      - key: ALT+V
        bufferTier: medium

  single_super_long:
    name: Force Choke
    gcdAbility: FORCE_CHOKE
    sequence:
      - key: ALT+NUMPAD3
        bufferTier: medium

  double:
    name: Retaliation + Crushing Blow
    gcdAbility: CRUSHING_BLOW
    sequence:
      - key: R
        bufferTier: low
      - key: N
        bufferTier: low
        echoHits: { count: 3, windowMs: 170 }
```

---

## Behavior Summary

### When GCD is NOT active:

1. Gesture triggers
2. Check if binding has GCD ability
3. If GCD ability: check individual CD → execute if ready, skip if on CD
4. If non-GCD: execute immediately

### When GCD IS active:

1. Gesture triggers
2. Check if binding has GCD ability
3. If GCD ability: add to queue
4. If non-GCD: execute immediately (bypasses GCD)
5. When GCD ends:
   - Find most recent queued entry
   - Skip entries with ability on cooldown
   - Execute first valid entry
   - Discard all other queued entries

### Gesture Fallback:

1. Gesture triggers (e.g., `single_long`)
2. Check if binding exists and is valid
3. If empty/invalid: try fallback (`single_super_long`)
4. If fallback valid: use it
5. If both empty: no action

---

## Files Changed

1. **types.ts** - Added `gcdAbility` field to `MacroBinding`
2. **gcdManager.ts** - New module for GCD/cooldown tracking
3. **index.ts** - Integration of GCD system and gesture fallback
4. **gcdManager.spec.ts** - Test coverage
5. **Profile JSON** - Add `gcdAbility` fields to macros
6. **gesture-manifest.yaml** - Add `gcdAbility` fields to macros

---

## Testing

Run tests:

```bash
npm test -- gcdManager.spec.ts
```

Enable GCD debug logging:

```bash
DEBUG_GCD=1 npm start
```
