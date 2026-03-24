# Reversion Protocol - Teensy 4.0 Optimization

## Purpose

This document contains an optimized prompt to run through Claude Opus 4.5 agent after setting up the Teensy 4.0 hardware keyboard emulator. The Arduino/Teensy eliminates the RobotJS input queue contention issue, so we can remove the aggressive stutter-reduction workarounds and restore optimal combat responsiveness.

---

## Table of Contents

1. [Reversion Prompt (Post-Teensy)](#run-this-prompt-after-teensy-40-is-working)
2. [Queue Pressure Monitor Explanation](#queue-pressure-monitor-integration)
3. [Software-Only Mode Setup](#software-only-mode-for-non-hardware-users)
4. [Device Detection & Profile Loader](#device-detection--custom-profile-loader)
5. [Teensy 4.0 Hardware Setup Guide](#teensy-40-hardware-implementation-guide)
6. [Movement Keys Answer](#movement-keys-answer-e-f-g-)

---

## Run This Prompt After Teensy 4.0 Is Working

Copy and paste the following prompt into a new Claude Opus 4.5 agent session:

---

````
I have successfully set up my Teensy 4.0 hardware keyboard emulator and the mouse stutter issue is resolved. I need you to revert the aggressive stutter-reduction workarounds that were added as temporary fixes. Please make the following changes:

## 1. R Streaming Interval
Reduce the R streaming interval from 380ms back down to **200ms** for faster Retaliate procs.

File: `src/omegaGestureDetector.ts`
- Find: `const D_STREAM_INTERVAL_MS = 380;`
- Change to: `const D_STREAM_INTERVAL_MS = 200;`

## 2. Echo Hits - Increase Counts
Restore higher echo hit counts for better ability registration:

File: `profiles/swtor-omega-profile.json`
- **Backhand**: Change `"echoHits": { "count": 1 }` to `"echoHits": { "count": 3 }`
- **Force Choke**: Change `"echoHits": { "count": 1 }` to `"echoHits": { "count": 3 }`
- **Force Push**: Change `"echoHits": { "count": 1 }` to `"echoHits": { "count": 3 }`
- **Leap** (both quick and quick_toggle): Change `"echoHits": { "count": 1 }` to `"echoHits": { "count": 3 }`

## 3. Output Pacing - Reduce Delays
Reduce the output pacing delays since queue contention is no longer an issue:

File: `src/sequenceExecutor.ts`
- Find the OUTPUT PACING section
- Change 2nd position delay from `100` to `20`
- Change 3rd position delay from `120` to `50`
- Change 4th position delay from `190` to `80`

The code should look like:
```typescript
if (pacePosition === 2) {
  await this.sleep(20);
} else if (pacePosition === 3) {
  await this.sleep(50);
} else if (pacePosition === 4) {
  await this.sleep(80);
}
````

## 4. Remove RepeatPolice Entirely

Delete the RepeatPolice system as it's no longer needed:

File: `src/sequenceExecutor.ts`

### Remove these class properties:

```typescript
private lastAbilityTimes: Map<string, number> = new Map();
private repeatPoliceWaiting: Map<string, boolean> = new Map();
private readonly REPEAT_POLICE_WINDOW_MS = 350;
private readonly REPEAT_POLICE_DELAY_MS = 250;
```

### Remove the entire REPEAT POLICE block in executeInternal():

Delete the section between:

```typescript
// ================================================================
// REPEAT POLICE: Prevent redundant ability spam
// ================================================================
```

and:

```typescript
// ================================================================
// (end of repeat police block)
```

This includes all the duplicate detection, waiting logic, and the sleep call.

## 5. Remove Queue Pressure Monitor

The queue pressure monitoring system was designed to track RobotJS-induced input queue backup. With Teensy handling outputs, there's no queue contention to monitor.

### Remove from index.ts:

- Remove the import: `import { getQueuePressureMonitor } from "./queuePressureMonitor.js";`
- Remove the pressure report printing in the shutdown handler (the `console.log` and `pressureMonitor.printSummary()` lines)

### Remove from sequenceExecutor.ts:

- Remove the import: `import { getQueuePressureMonitor } from "./queuePressureMonitor.js";`
- Remove the `const pressureMonitor = getQueuePressureMonitor();` line at the top of executeInternal()
- Remove the adaptive delay block: `const adaptiveDelay = pressureMonitor.getAdaptiveDelay();` and its sleep
- Remove the ability throttle check: `if (pressureMonitor.shouldThrottleAbility(name))` block
- Remove the `pressureMonitor.recordOutput()` call after key release

### Remove from specialKeyHandler.ts:

- Remove the import: `import { getQueuePressureMonitor } from "./queuePressureMonitor.js";`
- Remove all `pressureMonitor.recordOutput()` calls in the handler methods

### Delete the file:

- Delete `src/queuePressureMonitor.ts` entirely

## 6. Build and Test

After making all changes, run `npm run build` and `npm start` to verify everything compiles and works correctly.

## Summary of Changes

| Setting                                             | Before (Workaround) | After (Teensy Optimized) |
| --------------------------------------------------- | ------------------- | ------------------------ |
| R Stream Interval                                   | 380ms               | 200ms                    |
| Echo Hits (Backhand, Force Choke, Force Push, Leap) | 1                   | 3                        |
| 2nd Output Delay                                    | 100ms               | 20ms                     |
| 3rd Output Delay                                    | 120ms               | 50ms                     |
| 4th Output Delay                                    | 190ms               | 80ms                     |
| RepeatPolice                                        | Active              | Removed                  |
| Queue Pressure Monitor                              | Active              | Removed                  |

Please make all these changes now.

```

---

## Queue Pressure Monitor Integration

### What It Is

The **Queue Pressure Monitor** (`queuePressureMonitor.ts`) is a diagnostic and adaptive throttling system that tracks theoretical Windows input queue pressure caused by RobotJS's synchronous `SendInput` calls.

### Why It Exists

RobotJS blocks the Node.js event loop during key holds (typically 40-50ms per keypress). During this blocking time, mouse movement events from the OS cannot be processed and buffer up. When the block releases, all buffered mouse events execute at once, causing the characteristic "mouse drift" or "stutter."

The Queue Pressure Monitor:
1. **Tracks every output event** with timestamp, ability name, key pressed, and blocking duration
2. **Calculates theoretical queue pressure** using a USB HID model (125Hz poll rate, ~1000 events/sec drain)
3. **Detects pressure spikes** and correlates them with specific abilities
4. **Identifies problematic ability sequences** that frequently cause backup
5. **Provides adaptive delays** - adds extra gaps when pressure is building
6. **Generates shutdown reports** showing which abilities contributed most to stutter

### How It Works

```

Output Event → Record timestamp, key, blocking duration
→ Calculate pressure contribution:
pressure = blockingMs × 0.5 × modifierMultiplier × recentActivityMultiplier
→ Check if spike threshold crossed
→ Track ability correlation with spikes
→ Simulate queue drain over time

```

**Pressure Thresholds:**
- WARNING: 50 (minor backup building)
- SPIKE: 100 (noticeable stutter likely)
- CRITICAL: 200 (severe stutter imminent)

### Shutdown Report

When you Ctrl+C the app, it prints:
- Total outputs and session duration
- Average/peak pressure levels
- Spike count and frequency
- Top 10 pressure-contributing abilities
- Problematic ability sequences
- Adaptive delay recommendations

### Why Remove It After Teensy

With Teensy handling outputs:
- Outputs go via USB HID, not SendInput API
- No blocking of Node.js event loop
- No competition with mouse input at driver level
- Queue pressure is always ~0
- Monitoring overhead becomes pure waste

---

## Software-Only Mode (For Non-Hardware Users)

For users who don't have a Teensy 4.0 and want to use the app with RobotJS only, all the stutter-reduction workarounds need to remain active.

### Prompt: Enable Software-Only Mode

Copy and paste this prompt to configure the app for software-only (RobotJS) operation with all stutter-reduction systems active:

```

I want to use the SWTOR macro agent in SOFTWARE-ONLY mode without a Teensy 4.0 hardware keyboard. Please ensure all the RobotJS stutter-reduction workarounds are properly configured:

## 1. Verify R Streaming Interval

The R streaming interval should be 380ms (slower to reduce queue pressure):

File: `src/omegaGestureDetector.ts`

- Confirm: `const D_STREAM_INTERVAL_MS = 380;`

## 2. Verify Echo Hits Are Reduced

Echo hits should be minimized to reduce keypresses:

File: `profiles/swtor-omega-profile.json`

- Backhand, Force Choke, Force Push, Leap should all have `"echoHits": { "count": 1 }`

## 3. Verify Output Pacing Is Active

Output pacing should have aggressive delays:

File: `src/sequenceExecutor.ts`

- 2nd position delay: 100ms
- 3rd position delay: 120ms
- 4th position delay: 190ms

## 4. Verify RepeatPolice Is Active

RepeatPolice should be present with these settings:

File: `src/sequenceExecutor.ts`

- REPEAT_POLICE_WINDOW_MS = 350 (or 450)
- REPEAT_POLICE_DELAY_MS = 250
- Duplicate detection and deletion logic present

## 5. Verify Queue Pressure Monitor Is Active

The pressure monitor should be integrated:

File: `src/queuePressureMonitor.ts` should exist
File: `src/sequenceExecutor.ts` should import and use it
File: `src/specialKeyHandler.ts` should record R stream events
File: `src/index.ts` should print report on shutdown

## 6. Build and Test

Run `npm run build` and verify all systems are active. When you exit with Ctrl+C, you should see the Queue Pressure Report.

Please verify all these systems are properly configured for software-only operation.

```

### Software-Only Settings Reference

| System | Setting | Value | Purpose |
|--------|---------|-------|---------|
| R Stream Interval | `D_STREAM_INTERVAL_MS` | 380ms | Slower R presses reduce queue load |
| Echo Hits | `echoHits.count` | 1 | Fewer repeated keypresses |
| Output Pacing (2nd) | Sleep | 100ms | Gap for queue drain |
| Output Pacing (3rd) | Sleep | 120ms | Gap for queue drain |
| Output Pacing (4th) | Sleep | 190ms | Gap for queue drain |
| RepeatPolice Window | `REPEAT_POLICE_WINDOW_MS` | 350-450ms | Duplicate detection window |
| RepeatPolice Delay | `REPEAT_POLICE_DELAY_MS` | 250ms | Delay before allowing repeat |
| Pressure Warning | Threshold | 50 | Start adding micro-delays |
| Pressure Spike | Threshold | 100 | Aggressive throttling |
| Pressure Critical | Threshold | 200 | Maximum throttling |

---

## Device Detection & Custom Profile Loader

This section helps new users set up the app with their own input devices (not just Azeron Cyborg and Utech Venus).

### Prompt: Set Up Device Detection for New Hardware

Copy and paste this prompt when you need to configure the app for different input devices:

```

I need to set up device detection for my input devices. I am NOT using an Azeron Cyborg or Utech Venus mouse. Please help me:

## 1. List All Connected Input Devices

First, I need to identify my devices. Please create a device discovery script that:

- Uses `node-global-key-listener` to capture key events
- Logs the device information for each keypress (device name, hardware ID if available)
- Runs for 30 seconds while I press keys on each device
- Outputs a summary of all detected devices with their identifiers

Create this as: `scripts/deviceDiscovery.ts`

## 2. Create Device Configuration File

After I identify my devices, create a device configuration system:

File: `src/deviceConfig.ts`

- Define a DeviceConfig interface with: name, type (keyboard/mouse/keypad), identifier pattern
- Load device config from `profiles/devices.json`
- Export function to check if a key event came from a registered device

File: `profiles/devices.json` (template)

```json
{
  "inputDevices": [
    {
      "name": "Primary Keypad",
      "type": "keypad",
      "identifierPattern": "DEVICE_NAME_OR_PATTERN_HERE",
      "description": "My gaming keypad - triggers gestures"
    },
    {
      "name": "Primary Mouse",
      "type": "mouse",
      "identifierPattern": "DEVICE_NAME_OR_PATTERN_HERE",
      "description": "My MMO mouse - side buttons trigger gestures"
    }
  ],
  "ignoreDevices": [
    {
      "name": "Regular Keyboard",
      "identifierPattern": "STANDARD_KB_PATTERN",
      "description": "Don't process inputs from this device"
    }
  ]
}
```

## 3. Integrate Device Filtering into InputListener

Modify `src/inputListener.ts` to:

- Load device configuration on startup
- Filter incoming key events based on device identifier
- Only process events from registered input devices
- Log rejected events (from ignored devices) at debug level

## 4. Create Device Setup Wizard

Create an interactive setup script: `scripts/deviceSetup.ts`

- Prompts user through device discovery
- "Press a key on your GAMING KEYPAD..."
- "Press a key on your MOUSE SIDE BUTTONS..."
- Captures device identifiers automatically
- Generates `profiles/devices.json` with detected devices
- Validates the configuration by testing each device

## 5. Documentation

Create `docs/DEVICE_SETUP.md` explaining:

- How to run the device discovery script
- How to run the device setup wizard
- How to manually edit devices.json if needed
- Common device patterns for popular gaming peripherals
- Troubleshooting tips for device detection issues

Please implement all of these now.

```

### Prompt: Create Custom Gesture Profile (No Class Switching)

This prompt helps create a new profile for a different game or personal keybindings without the SWTOR class-switching complexity:

```

I need to create a custom gesture profile for my own keybindings. This is NOT for SWTOR class switching - I just want to map my input gestures to output keys.

## 1. Create Profile Template Generator

Create a script: `scripts/createProfile.ts` that:

- Prompts for profile name
- Asks how many input keys to configure
- For each input key, asks:
  - What key triggers this? (e.g., "1", "F1", "MOUSE_BUTTON_4")
  - What gestures to support? (quick, long, both, all four)
  - For each gesture, what output key(s)?
- Generates a complete profile JSON file
- Validates the profile structure

## 2. Create Simple Profile Schema

Create `profiles/templates/simple-profile.json`:

```json
{
  "name": "My Custom Profile",
  "description": "Personal keybindings",
  "system": "omega",
  "gestureSettings": {
    "quickPressMaxMs": 180,
    "longPressMinMs": 220,
    "superLongPressMinMs": 800,
    "doubleTapWindowMs": 280
  },
  "bindings": [
    {
      "input": "1",
      "gestures": {
        "quick": {
          "name": "Quick 1",
          "sequence": [{ "key": "1", "bufferTier": "low" }]
        },
        "long": {
          "name": "Long 1",
          "sequence": [{ "key": "SHIFT+1", "bufferTier": "low" }]
        }
      }
    }
  ]
}
```

## 3. Create Profile Loader Without Class Detection

Modify or create a simple profile loader that:

- Loads a single profile from a specified JSON file
- Does NOT scan for in-game class changes
- Does NOT auto-switch profiles
- Uses command-line argument or config to select profile: `npm start -- --profile=my-profile.json`

## 4. Create Profile Validator

Create `scripts/validateProfile.ts` that:

- Loads a profile JSON file
- Validates all required fields are present
- Checks for duplicate input bindings
- Validates all output keys are recognized
- Reports any errors or warnings
- Exits with success/failure code for CI integration

## 5. Example Profiles

Create example profiles in `profiles/examples/`:

- `generic-mmo.json` - Common MMO keybindings
- `fps-abilities.json` - FPS game ability keys
- `minimal.json` - Simplest possible working profile

Please implement this profile system now.

```

---

## Teensy 4.0 Hardware Implementation Guide

This section provides complete step-by-step instructions for setting up the Teensy 4.0 hardware keyboard emulator.

### Problem Analysis

#### Current Architecture (The Problem)

```

[Azeron Cyborg] → [Node.js App] → [RobotJS SendInput] → [Windows Input Queue]
[Venus Buttons] → [Node.js App] ↗ ↑
[Venus Movement] ──────────────────────────────────────────────┘ (COMPETITION)

```

**Root Cause:** RobotJS uses Windows SendInput API (software injection) which competes with mouse input at the driver level, causing mouse stutter during macro execution. Mouse movement and keyboard outputs share timing resources in the Windows input pipeline.

#### Teensy Solution

```

INPUT (unchanged):
Venus X/Y ──────────────► Windows Mouse Queue ──► Game
Venus Buttons ──► App (gesture detection)
Azeron Keys ────► App (gesture detection)

OUTPUT (fixed by Teensy):
App ──► Serial ──► Teensy ──► USB HID Keyboard ──► Windows KB Queue ──► Game
↑
Separate USB device
No SendInput
No competition

```

### Why This Works

| Aspect | RobotJS (Current) | Teensy (Solution) |
|--------|-------------------|-------------------|
| Output method | Software injection (SendInput API) | Real USB HID device |
| Device identity | Same as "software keyboard" | Separate physical keyboard |
| Input path | Shared with mouse at driver level | Completely separate USB endpoint |
| Timing | Subject to Windows scheduling | Hardware-precise timing (<1ms) |
| Competition | Competes with mouse movement | Zero interference |

---

### Prompt: Complete Teensy 4.0 Setup

When your Teensy 4.0 arrives, copy and paste this prompt:

```

My Teensy 4.0 has arrived. Please guide me through the complete hardware and software setup process.

## PHASE 1: Hardware Verification

1. Connect Teensy 4.0 via micro-USB cable to PC
2. Verify the orange LED blinks (factory test program)
3. Verify Windows detects and installs drivers automatically
4. Check Device Manager shows the Teensy

## PHASE 2: Software Installation

### Step 2.1: Install Arduino IDE

- Download Arduino IDE 2.x from https://www.arduino.cc/en/software
- Install with default settings

### Step 2.2: Install Teensyduino

- Download from https://www.pjrc.com/teensy/td_download.html
- Run installer, point to Arduino installation folder
- Select ALL libraries when prompted

### Step 2.3: Install Teensy Loader

- Download from https://www.pjrc.com/teensy/loader.html
- Install or run the executable

## PHASE 3: Arduino IDE Configuration

1. Open Arduino IDE
2. Go to **Tools → Board → Teensyduino → Teensy 4.0**
3. Go to **Tools → USB Type → "Serial + Keyboard + Mouse + Joystick"**
4. Go to **Tools → Port** → Select the COM port showing "Teensy"

## PHASE 4: Upload HID Keyboard Sketch

Create a new sketch in Arduino IDE and upload this code:

```cpp
// ============================================================================
// TEENSY 4.0 USB HID KEYBOARD FOR SWTOR MACRO SYSTEM
// ============================================================================
// Protocol: "KEY:keyname:duration[:modifiers]"
// Examples: "KEY:n:45", "KEY:j:50:shift", "KEY:m:40:alt"
// ============================================================================

const int BUFFER_SIZE = 128;
char buffer[BUFFER_SIZE];
int bufferIndex = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000) { }

  pinMode(LED_BUILTIN, OUTPUT);
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(100);
    digitalWrite(LED_BUILTIN, LOW);
    delay(100);
  }

  Serial.println("READY:TEENSY_HID_v1.0");
}

void loop() {
  while (Serial.available() > 0) {
    char c = Serial.read();

    if (c == '\n' || c == '\r') {
      if (bufferIndex > 0) {
        buffer[bufferIndex] = '\0';
        processCommand(buffer);
        bufferIndex = 0;
      }
    } else if (bufferIndex < BUFFER_SIZE - 1) {
      buffer[bufferIndex++] = c;
    }
  }
}

void processCommand(char* cmd) {
  if (strncmp(cmd, "KEY:", 4) == 0) {
    processKeyCommand(cmd + 4);
  } else if (strncmp(cmd, "PING", 4) == 0) {
    Serial.println("PONG");
  } else if (strncmp(cmd, "REL", 3) == 0) {
    Keyboard.releaseAll();
    Serial.println("OK:REL");
  }
}

void processKeyCommand(char* params) {
  char keyName[32];
  int duration = 50;
  char modifiers[32] = "";

  char* colonPos = strchr(params, ':');
  if (colonPos == NULL) {
    strncpy(keyName, params, sizeof(keyName) - 1);
  } else {
    int keyLen = colonPos - params;
    strncpy(keyName, params, keyLen);
    keyName[keyLen] = '\0';

    char* durationStr = colonPos + 1;
    char* modColonPos = strchr(durationStr, ':');

    if (modColonPos == NULL) {
      duration = atoi(durationStr);
    } else {
      *modColonPos = '\0';
      duration = atoi(durationStr);
      strncpy(modifiers, modColonPos + 1, sizeof(modifiers) - 1);
    }
  }

  int keyCode = getKeyCode(keyName);
  if (keyCode == 0) {
    Serial.print("ERR:UNKNOWN_KEY:");
    Serial.println(keyName);
    return;
  }

  bool useShift = (strstr(modifiers, "shift") != NULL);
  bool useAlt = (strstr(modifiers, "alt") != NULL);
  bool useCtrl = (strstr(modifiers, "ctrl") != NULL);

  if (useShift) Keyboard.press(MODIFIERKEY_SHIFT);
  if (useAlt) Keyboard.press(MODIFIERKEY_ALT);
  if (useCtrl) Keyboard.press(MODIFIERKEY_CTRL);

  Keyboard.press(keyCode);
  delay(duration);
  Keyboard.release(keyCode);

  if (useCtrl) Keyboard.release(MODIFIERKEY_CTRL);
  if (useAlt) Keyboard.release(MODIFIERKEY_ALT);
  if (useShift) Keyboard.release(MODIFIERKEY_SHIFT);

  Serial.print("OK:");
  Serial.print(keyName);
  Serial.print(":");
  Serial.println(duration);
}

int getKeyCode(const char* keyName) {
  // Single character keys
  if (strlen(keyName) == 1) {
    char c = keyName[0];
    if (c >= 'a' && c <= 'z') return KEY_A + (c - 'a');
    if (c >= 'A' && c <= 'Z') return KEY_A + (c - 'A');
    if (c >= '1' && c <= '9') return KEY_1 + (c - '1');
    if (c == '0') return KEY_0;
    switch (c) {
      case ' ': return KEY_SPACE;
      case ',': return KEY_COMMA;
      case '.': return KEY_PERIOD;
      case '/': return KEY_SLASH;
      case ';': return KEY_SEMICOLON;
      case '\'': return KEY_QUOTE;
      case '[': return KEY_LEFT_BRACE;
      case ']': return KEY_RIGHT_BRACE;
      case '\\': return KEY_BACKSLASH;
      case '-': return KEY_MINUS;
      case '=': return KEY_EQUAL;
      case '`': return KEY_TILDE;
    }
  }

  // Function keys
  if (strcasecmp(keyName, "f1") == 0) return KEY_F1;
  if (strcasecmp(keyName, "f2") == 0) return KEY_F2;
  if (strcasecmp(keyName, "f3") == 0) return KEY_F3;
  if (strcasecmp(keyName, "f4") == 0) return KEY_F4;
  if (strcasecmp(keyName, "f5") == 0) return KEY_F5;
  if (strcasecmp(keyName, "f6") == 0) return KEY_F6;
  if (strcasecmp(keyName, "f7") == 0) return KEY_F7;
  if (strcasecmp(keyName, "f8") == 0) return KEY_F8;
  if (strcasecmp(keyName, "f9") == 0) return KEY_F9;
  if (strcasecmp(keyName, "f10") == 0) return KEY_F10;
  if (strcasecmp(keyName, "f11") == 0) return KEY_F11;
  if (strcasecmp(keyName, "f12") == 0) return KEY_F12;

  // Numpad
  if (strcasecmp(keyName, "np0") == 0 || strcasecmp(keyName, "numpad_0") == 0) return KEYPAD_0;
  if (strcasecmp(keyName, "np1") == 0 || strcasecmp(keyName, "numpad_1") == 0) return KEYPAD_1;
  if (strcasecmp(keyName, "np2") == 0 || strcasecmp(keyName, "numpad_2") == 0) return KEYPAD_2;
  if (strcasecmp(keyName, "np3") == 0 || strcasecmp(keyName, "numpad_3") == 0) return KEYPAD_3;
  if (strcasecmp(keyName, "np4") == 0 || strcasecmp(keyName, "numpad_4") == 0) return KEYPAD_4;
  if (strcasecmp(keyName, "np5") == 0 || strcasecmp(keyName, "numpad_5") == 0) return KEYPAD_5;
  if (strcasecmp(keyName, "np6") == 0 || strcasecmp(keyName, "numpad_6") == 0) return KEYPAD_6;
  if (strcasecmp(keyName, "np7") == 0 || strcasecmp(keyName, "numpad_7") == 0) return KEYPAD_7;
  if (strcasecmp(keyName, "np8") == 0 || strcasecmp(keyName, "numpad_8") == 0) return KEYPAD_8;
  if (strcasecmp(keyName, "np9") == 0 || strcasecmp(keyName, "numpad_9") == 0) return KEYPAD_9;
  if (strcasecmp(keyName, "np_add") == 0 || strcasecmp(keyName, "numpad_+") == 0) return KEYPAD_PLUS;
  if (strcasecmp(keyName, "np_sub") == 0 || strcasecmp(keyName, "numpad_-") == 0) return KEYPAD_MINUS;
  if (strcasecmp(keyName, "np_mul") == 0 || strcasecmp(keyName, "numpad_*") == 0) return KEYPAD_ASTERIX;
  if (strcasecmp(keyName, "np_div") == 0 || strcasecmp(keyName, "numpad_/") == 0) return KEYPAD_SLASH;
  if (strcasecmp(keyName, "np_dec") == 0 || strcasecmp(keyName, "numpad_.") == 0) return KEYPAD_PERIOD;
  if (strcasecmp(keyName, "np_enter") == 0) return KEYPAD_ENTER;

  // Navigation keys
  if (strcasecmp(keyName, "esc") == 0 || strcasecmp(keyName, "escape") == 0) return KEY_ESC;
  if (strcasecmp(keyName, "tab") == 0) return KEY_TAB;
  if (strcasecmp(keyName, "backspace") == 0) return KEY_BACKSPACE;
  if (strcasecmp(keyName, "enter") == 0 || strcasecmp(keyName, "return") == 0) return KEY_ENTER;
  if (strcasecmp(keyName, "space") == 0) return KEY_SPACE;
  if (strcasecmp(keyName, "insert") == 0) return KEY_INSERT;
  if (strcasecmp(keyName, "delete") == 0) return KEY_DELETE;
  if (strcasecmp(keyName, "home") == 0) return KEY_HOME;
  if (strcasecmp(keyName, "end") == 0) return KEY_END;
  if (strcasecmp(keyName, "pageup") == 0) return KEY_PAGE_UP;
  if (strcasecmp(keyName, "pagedown") == 0) return KEY_PAGE_DOWN;
  if (strcasecmp(keyName, "up") == 0) return KEY_UP;
  if (strcasecmp(keyName, "down") == 0) return KEY_DOWN;
  if (strcasecmp(keyName, "left") == 0) return KEY_LEFT;
  if (strcasecmp(keyName, "right") == 0) return KEY_RIGHT;

  return 0;
}
```

## PHASE 5: Test the Teensy

1. Open Arduino IDE's Serial Monitor (Tools → Serial Monitor)
2. Set baud rate to **115200**
3. Should see: `READY:TEENSY_HID_v1.0`
4. Type `PING` and press Enter → Should respond `PONG`
5. Open Notepad
6. In Serial Monitor, type: `KEY:n:50` → Letter 'n' should appear in Notepad
7. Test modifiers: `KEY:j:50:shift` → Capital 'J' should appear

## PHASE 6: Node.js Integration

### Step 6.1: Install serialport package

Run: `npm install serialport`

### Step 6.2: Create TeensyExecutor

Create file: `src/teensyExecutor.ts` with the following content:

```typescript
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

interface TeensyConfig {
  baudRate?: number;
  timeout?: number;
}

interface PendingCommand {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

export class TeensyExecutor {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private isReady: boolean = false;
  private pendingCommands: Map<string, PendingCommand> = new Map();
  private config: Required<TeensyConfig>;
  private commandId: number = 0;

  constructor(config: TeensyConfig = {}) {
    this.config = {
      baudRate: config.baudRate ?? 115200,
      timeout: config.timeout ?? 500,
    };
  }

  async connect(): Promise<void> {
    const portPath = await this.findTeensyPort();
    if (!portPath) {
      throw new Error("Teensy not found. Check USB connection.");
    }

    return new Promise((resolve, reject) => {
      this.port = new SerialPort({
        path: portPath,
        baudRate: this.config.baudRate,
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: "\n" }));

      this.port.on("error", (err) => {
        console.error("[Teensy] Port error:", err.message);
        reject(err);
      });

      this.parser.on("data", (line: string) => {
        const trimmed = line.trim();
        this.handleResponse(trimmed);
      });

      this.port.on("open", () => {
        console.log("[Teensy] Port opened, waiting for ready signal...");
        setTimeout(() => {
          if (!this.isReady) {
            this.isReady = true;
            console.log("[Teensy] Assuming ready (timeout)");
            resolve();
          }
        }, 2000);
      });

      const readyTimeout = setTimeout(() => {
        if (!this.isReady) {
          reject(new Error("Teensy did not send ready signal"));
        }
      }, 5000);

      this.parser.once("data", (line: string) => {
        if (line.includes("READY")) {
          clearTimeout(readyTimeout);
          this.isReady = true;
          console.log("[Teensy] Ready:", line.trim());
          resolve();
        }
      });
    });
  }

  private async findTeensyPort(): Promise<string | null> {
    const ports = await SerialPort.list();

    for (const port of ports) {
      const isTeensy =
        port.vendorId?.toLowerCase() === "16c0" ||
        port.manufacturer?.toLowerCase().includes("teensy") ||
        port.manufacturer?.toLowerCase().includes("pjrc");

      if (isTeensy) {
        console.log(`[Teensy] Found at ${port.path}`);
        return port.path;
      }
    }

    console.log(
      "[Teensy] Available ports:",
      ports.map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer,
        vendorId: p.vendorId,
      })),
    );

    return null;
  }

  private handleResponse(response: string): void {
    if (response.startsWith("OK:") || response.startsWith("ERR:")) {
      const keyMatch = response.match(/^(?:OK|ERR):([^:]+)/);
      if (keyMatch) {
        const key = keyMatch[1];
        const pending = this.pendingCommands.get(key);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingCommands.delete(key);
          if (response.startsWith("ERR:")) {
            pending.reject(new Error(response));
          } else {
            pending.resolve(response);
          }
        }
      }
    } else if (response === "PONG") {
      const pending = this.pendingCommands.get("PING");
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingCommands.delete("PING");
        pending.resolve(response);
      }
    }
  }

  private async sendCommand(
    command: string,
    expectKey?: string,
  ): Promise<string> {
    if (!this.port || !this.isReady) {
      throw new Error("Teensy not connected");
    }

    return new Promise((resolve, reject) => {
      const key = expectKey || command.split(":")[1] || command;

      const timeout = setTimeout(() => {
        this.pendingCommands.delete(key);
        reject(new Error(`Timeout waiting for response to: ${command}`));
      }, this.config.timeout);

      this.pendingCommands.set(key, { resolve, reject, timeout });

      this.port!.write(command + "\n", (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pendingCommands.delete(key);
          reject(err);
        }
      });
    });
  }

  async pressKey(
    key: string,
    durationMs: number = 50,
    modifiers: string[] = [],
  ): Promise<void> {
    const teensyKey = this.mapKeyName(key);
    let command = `KEY:${teensyKey}:${durationMs}`;

    if (modifiers.length > 0) {
      command += ":" + modifiers.join("+");
    }

    await this.sendCommand(command, teensyKey);
  }

  async keyTap(key: string, modifiers: string[] = []): Promise<void> {
    await this.pressKey(key, 50, modifiers);
  }

  async keyToggle(key: string, down: boolean): Promise<void> {
    if (down) {
      await this.pressKey(key, 10);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await this.sendCommand("PING", "PING");
      return response === "PONG";
    } catch {
      return false;
    }
  }

  async releaseAll(): Promise<void> {
    await this.sendCommand("REL", "REL");
  }

  private mapKeyName(key: string): string {
    const keyMap: Record<string, string> = {
      numpad_0: "np0",
      numpad_1: "np1",
      numpad_2: "np2",
      numpad_3: "np3",
      numpad_4: "np4",
      numpad_5: "np5",
      numpad_6: "np6",
      numpad_7: "np7",
      numpad_8: "np8",
      numpad_9: "np9",
      "numpad_+": "np_add",
      "numpad_-": "np_sub",
      "numpad_*": "np_mul",
      "numpad_/": "np_div",
      "numpad_.": "np_dec",
      escape: "esc",
      page_up: "pageup",
      page_down: "pagedown",
    };

    return keyMap[key.toLowerCase()] || key.toLowerCase();
  }

  async disconnect(): Promise<void> {
    if (this.port && this.port.isOpen) {
      return new Promise((resolve) => {
        this.port!.close(() => {
          this.port = null;
          this.parser = null;
          this.isReady = false;
          resolve();
        });
      });
    }
  }

  static async listPorts(): Promise<void> {
    const ports = await SerialPort.list();
    console.log("Available serial ports:");
    ports.forEach((port) => {
      console.log(
        `  ${port.path}: ${port.manufacturer || "Unknown"} (VID: ${port.vendorId || "N/A"})`,
      );
    });
  }
}

// Singleton instance
let teensyInstance: TeensyExecutor | null = null;

export async function getTeensyExecutor(
  config?: TeensyConfig,
): Promise<TeensyExecutor> {
  if (!teensyInstance) {
    teensyInstance = new TeensyExecutor(config);
    await teensyInstance.connect();
  }
  return teensyInstance;
}

export async function isTeensyAvailable(): Promise<boolean> {
  const ports = await SerialPort.list();
  return ports.some(
    (port) =>
      port.vendorId?.toLowerCase() === "16c0" ||
      port.manufacturer?.toLowerCase().includes("teensy") ||
      port.manufacturer?.toLowerCase().includes("pjrc"),
  );
}
```

### Step 6.3: Update executorFactory.ts

Add 'teensy' as a backend option in `src/executorFactory.ts`:

1. Add import: `import { getTeensyExecutor, isTeensyAvailable } from './teensyExecutor.js';`
2. Add 'teensy' to the Backend type union
3. In createExecutor(), add case for 'teensy' that uses TeensyExecutor instead of RobotJS

### Step 6.4: Update startup command

The app should accept `--backend=teensy` command line argument:
`npm start -- --backend=teensy`

## PHASE 7: Run Reversion Protocol

After confirming Teensy works, run the reversion protocol prompt from the top of this document to remove all the RobotJS stutter workarounds.

## Verification Checklist

### Hardware Setup

- [ ] Teensy 4.0 connected via micro-USB data cable
- [ ] Orange LED blinks on power
- [ ] Windows detects Teensy in Device Manager

### Software Installation

- [ ] Arduino IDE 2.x installed
- [ ] Teensyduino add-on installed
- [ ] Teensy Loader installed

### Arduino Configuration

- [ ] Board: Teensy 4.0
- [ ] USB Type: Serial + Keyboard + Mouse + Joystick
- [ ] Port: Correct COM port selected
- [ ] Sketch uploaded successfully

### Testing

- [ ] Serial Monitor shows `READY:TEENSY_HID_v1.0`
- [ ] `PING` returns `PONG`
- [ ] `KEY:n:50` types 'n' in Notepad
- [ ] `KEY:j:50:shift` types 'J' in Notepad

### Node.js Integration

- [ ] `serialport` package installed
- [ ] TeensyExecutor class created
- [ ] executorFactory.ts updated
- [ ] App starts with `--backend=teensy`
- [ ] Keys output correctly in SWTOR

### Reversion Complete

- [ ] Reversion protocol prompt executed
- [ ] R stream interval at 200ms
- [ ] Echo hits restored to 3
- [ ] Output pacing reduced
- [ ] RepeatPolice removed
- [ ] Queue Pressure Monitor removed
- [ ] Build successful
- [ ] No mouse stutter during combat

Please guide me through each phase now.

```

---

### Serial Protocol Reference

| Command | Format | Example | Response |
|---------|--------|---------|----------|
| Key press | `KEY:key:duration[:modifiers]` | `KEY:n:45` | `OK:n:45` |
| Modified key | `KEY:key:duration:mod1+mod2` | `KEY:j:50:shift` | `OK:j:50` |
| Ping | `PING` | `PING` | `PONG` |
| Release all | `REL` | `REL` | `OK:REL` |

### Key Name Mappings

| RobotJS Format | Teensy Format |
|----------------|---------------|
| `numpad_0` - `numpad_9` | `np0` - `np9` |
| `numpad_+` | `np_add` |
| `numpad_-` | `np_sub` |
| `numpad_*` | `np_mul` |
| `numpad_/` | `np_div` |
| `escape` | `esc` |
| `page_up` | `pageup` |
| `page_down` | `pagedown` |
| `f1` - `f12` | `f1` - `f12` (same) |

---

## Movement Keys Answer (E, F, G, ;)

**Keep your movement keys (E, F, G, ;) on the Azeron going directly to the OS.**

The Teensy should ONLY handle the **synthetic output keys** - the ones this app generates (ability keys, modifiers, etc.).

Here's why:
1. Movement keys need **zero latency** - adding Arduino serial communication would add ~1-2ms
2. The stutter you see on movement keys is **indirect** - caused by RobotJS blocking, not by the keys themselves
3. Once Teensy handles outputs, the blocking is eliminated, so your Azeron → OS path becomes clean again
4. Keeping them separate means your movement works even if the Teensy disconnects

```

┌─────────────┐ ┌──────────────┐
│ Azeron │ ─── E, F, G, ; ────► │ Direct OS │ ← Keep this path (movement)
└─────────────┘ └──────────────┘

┌─────────────┐ Serial ┌─────────────┐ USB HID ┌──────────────┐
│ Node.js │ ─────────────► │ Teensy 4.0 │ ──────────────► │ OS/SWTOR │ ← New path (abilities)
└─────────────┘ Commands └─────────────┘ Real keyboard └──────────────┘

```

```
