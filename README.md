# SWTOR Macro Agent

A local Node.js application for per-key gesture detection and macro execution for SWTOR. Runs on your gaming PC and sends real keypresses to the game.

## Quick Start

1. **Extract** this folder to your gaming PC
2. **Install** Node.js 18+ from https://nodejs.org/
3. **Open terminal** in this folder
4. **Run**:
   ```bash
   npm install
   npm start
   ```

## Features

- **22 Input Keys**: W, A, S, D, B, I, T, C, H, Y, U, P, 1-6, mouse buttons
- **12 Gesture Types**: single, single_long, single_super_long, double, double_long, double_super_long, triple, triple_long, triple_super_long, quadruple, quadruple_long, quadruple_super_long
- **Human-Like Timing**: Randomized delays between keypresses (25ms minimum)
- **Per-Key Isolation**: Each key has independent gesture detection
- **Anti-Cheat Friendly**: Configurable timing variance for natural patterns
- **Multi-Backend Support**: RobotJS (default), Interception Driver (stealth), or Mock (testing)

## Sequence Constraints

| Constraint                         | Value |
| ---------------------------------- | ----- |
| Minimum delay between presses      | 25ms  |
| Minimum variance (max - min)       | 4ms   |
| Maximum unique keys per sequence   | 4     |
| Maximum repeats per key (echoHits) | 6     |

## Installation

### Prerequisites

- Node.js 18+ (Download from https://nodejs.org/)
- Windows (recommended), macOS, or Linux
- Visual Studio Build Tools (Windows) for native dependencies

### Step 1: Extract Files

Your downloaded package already includes:

- The macro agent code
- Your exported profile in `profiles/` folder

### Step 2: Install Dependencies

```bash
cd swtor-macro-agent
npm install
```

**Note**: If native modules fail to install:

- **Windows**: Install Visual Studio Build Tools with C++ workload
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: `sudo apt install libxtst-dev libpng++-dev build-essential`

### Step 3: Enable Global Key Capture

For the agent to detect keys when SWTOR is focused, install `node-global-key-listener`:

```bash
npm install node-global-key-listener
```

Without this, the agent only works when the terminal is focused (testing mode).

### Step 4: Run the Agent

```bash
npm start
```

The agent will:

1. Load your macro profile from `profiles/`
2. Start listening for key gestures
3. Execute macro sequences when gestures are detected

Press **Ctrl+C** to stop the agent.

## Profile Format

Your exported profile in `profiles/` looks like:

```json
{
  "name": "Sith Warrior DPS",
  "gestureSettings": {
    "multiPressWindow": 350,
    "debounceDelay": 30,
    "longPressMin": 80,
    "longPressMax": 140,
    "superLongMin": 300,
    "superLongMax": 2000,
    "cancelThreshold": 3000
  },
  "macros": [
    {
      "name": "Force Charge Opener",
      "trigger": { "key": "1", "gesture": "double" },
      "sequence": [
        { "key": "a", "minDelay": 25, "maxDelay": 30, "echoHits": 1 },
        { "key": "b", "minDelay": 30, "maxDelay": 40, "echoHits": 1 },
        { "key": "c", "minDelay": 25, "maxDelay": 35, "echoHits": 2 }
      ],
      "enabled": true
    }
  ]
}
```

### Key Fields

- **trigger.key**: Which key to monitor (W, A, S, D, 1-6, B, C, etc.)
- **trigger.gesture**: What gesture type triggers the macro
- **sequence**: Array of keypresses to send
- **echoHits**: Number of times to press this key (1-6)

## Gesture Types

| Gesture                | How to Trigger                               |
| ---------------------- | -------------------------------------------- |
| `single`               | Single tap (final tap released < 80ms)       |
| `single_long`          | Single tap where final tap held 80–145ms     |
| `single_super_long`    | Single tap where final tap held 146–265ms    |
| `double`               | Two quick taps (final tap released < 80ms)   |
| `double_long`          | Two taps where final tap held 80–145ms       |
| `double_super_long`    | Two taps where final tap held 146–265ms      |
| `triple`               | Three quick taps (final tap released < 80ms) |
| `triple_long`          | Three taps where final tap held 80–145ms     |
| `triple_super_long`    | Three taps where final tap held 146–265ms    |
| `quadruple`            | Four quick taps (final tap released < 80ms)  |
| `quadruple_long`       | Four taps where final tap held 80–145ms      |
| `quadruple_super_long` | Four taps where final tap held 146–265ms     |

Note: Holding the final tap > 265ms cancels only that key's recording (other simultaneous key sequences continue to be recorded independently).

## Timing Configuration

Each step in a sequence has:

- `minDelay`: Minimum milliseconds before next keypress
- `maxDelay`: Maximum milliseconds before next keypress
- `echoHits`: Number of times to press this key (1-6)

The actual delay is **randomized** between min and max for human-like behavior.

### Example: Fast but Safe

```json
{ "key": "a", "minDelay": 25, "maxDelay": 29, "echoHits": 1 }
```

Result: Single press with 25-29ms delay after (4ms variance)

### Example: Echo Hits

```json
{ "key": "b", "minDelay": 30, "maxDelay": 50, "echoHits": 3 }
```

Result: Press "b" 3 times, each with 30-50ms delay between

## Backend Selection

The agent supports multiple execution backends:

| Backend        | Detection Risk | How It Works                                     |
| -------------- | -------------- | ------------------------------------------------ |
| `robotjs`      | Medium         | Uses Windows SendInput API, sets injection flags |
| `interception` | Low            | Kernel-level driver, no injection flags          |
| `mock`         | N/A            | Testing only (logs but doesn't send keys)        |

### Command Line Options

```bash
# Auto-select best available (Interception > RobotJS > Mock)
npm start

# Force specific backend
npm start -- --backend=robotjs
npm start -- --backend=interception
npm start -- --backend=mock

# Show available backends
npm start -- --backends

# Set default via environment variable
set MACRO_BACKEND=interception
npm start
```

## Upgrading to Interception Driver

For harder-to-detect input (no software injection flags):

1. Read `INTERCEPTION_SETUP.md` for full instructions
2. Download driver from https://github.com/oblitum/Interception
3. Install driver (requires admin + reboot)
4. Install FFI modules: `npm install ffi-napi ref-napi`
5. Run with: `npm start -- --backend=interception`

## Troubleshooting

### "Cannot find module 'robotjs'"

Install native build tools:

- **Windows**: Install Visual Studio Build Tools with C++ workload
- **macOS**: `xcode-select --install`
- **Linux**: `sudo apt install build-essential`

Then run `npm install` again.

### Keys Not Detected When SWTOR Is Focused

Install global key listener:

```bash
npm install node-global-key-listener
```

Without this, keys are only detected when the terminal window is focused.

### SWTOR Not Receiving Keypresses

- Make sure robotjs installed correctly
- Run the agent as Administrator (Windows)
- Check that SWTOR isn't blocking synthetic input
- Try the Interception backend for better compatibility

### Agent Starts But Nothing Happens

- Check that your profile has `"enabled": true` on macros
- Verify the trigger keys match what you're pressing
- Look at the console output for gesture detection messages

## File Structure

```
swtor-macro-agent/
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── README.md             # This file
├── INTERCEPTION_SETUP.md # Advanced driver setup
├── src/
│   ├── index.ts              # Main entry point
│   ├── types.ts              # Type definitions
│   ├── gestureDetector.ts    # Gesture detection engine
│   ├── sequenceExecutor.ts   # RobotJS keypress sender
│   ├── interceptionExecutor.ts # Interception driver sender
│   ├── executorFactory.ts    # Backend selection
│   ├── inputListener.ts      # Keyboard/mouse hooks
│   └── profileLoader.ts      # JSON profile loader
└── profiles/
    └── your-profile.json     # Your exported macros
```

## Anti-Cheat Considerations

**RobotJS (Default):**

- Sends real keypresses to the OS
- Sets LLKHF_INJECTED flag (can be detected by anti-cheat)
- Uses randomized timing for human-like behavior

**Interception Driver (Recommended for Stealth):**

- Kernel-level injection
- No software injection flags
- Input appears as hardware
- Requires driver installation

**Tips for Safety:**

- Use realistic timing (30-50ms delays)
- Add variance (at least 4ms between min/max)
- Don't execute macros at superhuman speed
- Upgrade to Interception for better stealth

## License

MIT - Use at your own risk. The author is not responsible for any game bans or ToS violations.

## Recent Changes (Dec 2025)

- Added `OUTPUT_KEYS` and expanded gesture/sequence typing for improved macro expressiveness.
- Implemented `profileCompiler` (precomputes `conundrumKeys`) and `trafficController` to avoid modifier collisions when running concurrent sequences.
- `GestureDetector` now exposes a stable listener API: `onGesture(cb)` / `offGesture(cb)` — tests subscribe instead of replacing internal callback.
- Improved test stability; increased test timeout for integration-style gesture mapping tests.

Run the build and tests as shown above to verify the current state.
