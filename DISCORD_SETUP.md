# Discord Integration Setup Guide

## Overview

Your SWTOR macro system now uses a **hybrid approach** for Discord control:

- **OS-level volume control** for Discord audio (low/medium/high)
- **Discord hotkeys** for mic toggle and deafen functionality
- **SWTOR mute** for game audio control

## Discord Configuration Required

### Step 1: Configure Discord Keybinds

Open Discord Settings → Keybinds and set:

1. **Toggle Mute**: `CTRL+SHIFT+M`
2. **Toggle Deafen**: `CTRL+SHIFT+D`

### Step 2: Test Discord Hotkeys

- Press `CTRL+SHIFT+M` in Discord to verify mic toggle works
- Press `CTRL+SHIFT+D` in Discord to verify deafen works

## Macro Button Layout

### Volume Control (OS-level)

- **Button 7 (single press)**: Set Discord volume to LOW (25%)
- **Button 8 (single press)**: Set Discord volume to MEDIUM (50%)
- **Button 9 (single press)**: Set Discord volume to HIGH (100%) + Deafen

### Mic & Deafen Control (Discord hotkeys)

- **Button 7 (long press)**: Toggle microphone on/off (CTRL+SHIFT+M)
- **Button 8 (long press)**: Toggle deafen on/off (CTRL+SHIFT+D)

### SWTOR Audio Control

- **B (single_long)**: Mute SWTOR (existing functionality)
- **B (double_long)**: Mute SWTOR (existing functionality)
- **B (single_super_long)**: Mute SWTOR (existing functionality)

## How It Works

### Volume Control Flow

1. You press Button 7/8/9 (single press)
2. System detects "Discord Volume: Low/Medium/High" in step name
3. PowerShell/nircmd adjusts Discord's system volume
4. No keypress is sent (OS handles it directly)

### Mic/Deafen Flow

1. You press Button 7/8 (long press)
2. System detects "Discord Mic Toggle" or "Discord Deafen" in step name
3. RobotJS sends CTRL+SHIFT+M or CTRL+SHIFT+D keypress
4. Discord receives hotkey and toggles mic/deafen

## Use Cases

### Scenario 1: Raid Call-Outs

- **Button 7 (single)**: Lower Discord to 25% volume
- **Button 7 (long)**: Toggle mic ON for call-outs
- Focus on game audio while communicating

### Scenario 2: Boss Fight Focus

- **Button 9 (single)**: Max Discord volume (100%) + Deafen
- Hear game audio clearly without Discord interference
- Press Button 8 (long) to un-deafen when needed

### Scenario 3: Quick Mic Toggle

- **Button 7 (long)**: Toggle mic on/off anytime
- No volume change, just mic control

## Troubleshooting

### Volume Control Not Working

- Ensure Discord is running as a separate audio source in Windows
- Install nircmd for better per-app control: https://www.nirsoft.net/utils/nircmd.html
- Place nircmd.exe in system PATH or project directory

### Hotkeys Not Working

- Verify Discord keybinds are set correctly (Settings → Keybinds)
- Make sure no other app is using CTRL+SHIFT+M or CTRL+SHIFT+D
- Test hotkeys manually in Discord before using macros

### Mic Stays Muted

- Discord mic toggle is a **toggle**, not push-to-talk
- Press Button 7 (long) again to unmute
- Check Discord's voice settings for correct input device

## Technical Details

### Files Modified

- `discordController.ts`: Added hotkey methods
- `sequenceExecutor.ts`: Updated detection logic for volume/mic/deafen
- `swtor-vengeance-jugg.json`: New Discord control macros

### Detection Keywords

- Volume control: "Volume: Low", "Volume: Medium", "Volume: High"
- Mic toggle: "Mic Toggle"
- Deafen: "Deafen"

### Execution Behavior

- **Volume control**: Async OS command, skips keypress
- **Mic/Deafen**: Async logging + RobotJS keypress
- **No gameplay interruption**: All commands execute in background
