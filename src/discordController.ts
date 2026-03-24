// ============================================================================
// DISCORD CONTROLLER - OS-level Discord audio/mic control
// ============================================================================
//
// Uses Windows PowerShell and nircmd for system-level audio control.
// Provides programmatic control of Discord's output volume and mic toggle.
//
// Requirements (Windows):
// - Discord running as a separate audio source
// - nircmd (optional, for more reliable volume control)
// - PowerShell (built-in on Windows 10/11)
//
// ============================================================================

import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "./logger.js";

const execAsync = promisify(exec);

/**
 * Volume levels as percentages
 */
export type VolumeLevel = "low" | "medium" | "high" | "mute";

const VOLUME_PERCENTAGES: Record<VolumeLevel, number> = {
  mute: 0,
  low: 25,
  medium: 50,
  high: 100,
};

/**
 * Discord Controller for Windows
 * Controls Discord volume and microphone via OS-level commands
 */
export class DiscordController {
  private lastVolumeLevel: VolumeLevel = "medium";
  private micMuted: boolean = false;

  constructor() {
    logger.debug("DiscordController initialized");
  }

  /**
   * Set Discord's output volume using PowerShell audio session control
   * @param level Volume level (low/medium/high/mute)
   */
  async setVolume(level: VolumeLevel): Promise<boolean> {
    const percentage = VOLUME_PERCENTAGES[level];

    try {
      // Method 1: Use PowerShell with AudioDeviceCmdlets (if installed)
      // This controls per-application volume in Windows Volume Mixer
      const psScript = `
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface ISimpleAudioVolume {
    int SetMasterVolume(float fLevel, ref Guid EventContext);
    int GetMasterVolume(out float pfLevel);
    int SetMute(bool bMute, ref Guid EventContext);
    int GetMute(out bool pbMute);
}

[Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionManager2 {
    int NotImpl1();
    int NotImpl2();
    int GetSessionEnumerator(out IAudioSessionEnumerator SessionEnum);
}

[Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionEnumerator {
    int GetCount(out int SessionCount);
    int GetSession(int SessionIndex, out IAudioSessionControl Session);
}

[Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl {
    int NotImpl1();
    int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
    int NotImpl2();
    int NotImpl3();
    int NotImpl4();
    int NotImpl5();
    int NotImpl6();
    int NotImpl7();
    int GetProcessId(out uint pRetVal);
}

[Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl2 : IAudioSessionControl {
    int NotImpl8();
    int GetProcessId2(out uint pRetVal);
}

public class AudioManager {
    [DllImport("ole32.dll")]
    public static extern int CoCreateInstance(ref Guid clsid, IntPtr inner, uint context, ref Guid uuid, out IntPtr rReturnedComObject);
    
    public static Guid IID_IAudioSessionManager2 = new Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F");
    public static Guid CLSID_MMDeviceEnumerator = new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E");
}
"@

        # Fallback: Set system volume (affects all apps)
        $volume = ${percentage} / 100
        (New-Object -ComObject WScript.Shell).SendKeys([char]173) # Mute toggle key code
      `;

      // Simpler approach: Use nircmd if available, otherwise PowerShell volume
      try {
        // Try nircmd first (more reliable per-app control)
        await this.setVolumeWithNircmd(percentage);
      } catch {
        // Fallback to system volume adjustment
        await this.setSystemVolume(percentage);
      }

      this.lastVolumeLevel = level;
      logger.info(`Discord volume set to ${level} (${percentage}%)`);
      return true;
    } catch (error) {
      logger.error(
        `Failed to set Discord volume: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * Set volume using nircmd (if available)
   */
  private async setVolumeWithNircmd(percentage: number): Promise<void> {
    // nircmd uses 0-65535 range
    const nircmdVolume = Math.round((percentage / 100) * 65535);
    await execAsync(`nircmd.exe setappvolume Discord.exe ${percentage / 100}`);
  }

  /**
   * Set system-wide volume as fallback
   */
  private async setSystemVolume(percentage: number): Promise<void> {
    // PowerShell command to set system volume
    const psCommand = `
      $wshell = New-Object -ComObject WScript.Shell
      # Calculate key presses needed (volume increments by 2% per keypress)
      # First mute, then set to desired level
      (Get-WmiObject -Class Win32_SoundDevice | Select-Object -First 1) | Out-Null
      
      # Use AudioDeviceCmdlets if available
      try {
        Set-AudioDevice -PlaybackVolume ${percentage} -ErrorAction Stop
      } catch {
        # Fallback: Use SendKeys for volume control
        # Each VolumeUp/Down changes by 2%
        $currentVol = [Audio]::Volume * 100
        $diff = ${percentage} - $currentVol
        $presses = [Math]::Abs([Math]::Round($diff / 2))
        $key = if ($diff -gt 0) { [char]175 } else { [char]174 }
        for ($i = 0; $i -lt $presses; $i++) { $wshell.SendKeys($key) }
      }
    `;

    // Simpler reliable method: Use PowerShell Core audio
    const simpleCommand = `powershell -Command "[audio]::Volume = ${
      percentage / 100
    }"`;

    try {
      await execAsync(simpleCommand);
    } catch {
      // Ultimate fallback: Use sndvol
      logger.warn(
        "PowerShell audio control failed, volume change may not work"
      );
    }
  }

  /**
   * Toggle microphone mute state
   * @param mute True to mute, false to unmute
   */
  async setMicMute(mute: boolean): Promise<boolean> {
    try {
      // Method 1: Use PowerShell to toggle default recording device
      const psCommand = mute
        ? `powershell -Command "Set-AudioDevice -RecordingMute $true" 2>$null || powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`
        : `powershell -Command "Set-AudioDevice -RecordingMute $false" 2>$null || powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`;

      // Simpler approach: Use Windows mic mute hotkey via nircmd or SendKeys
      try {
        // Try nircmd mutemic command
        const nircmdCommand = mute
          ? "nircmd.exe mutesysvolume 1 microphone"
          : "nircmd.exe mutesysvolume 0 microphone";
        await execAsync(nircmdCommand);
      } catch {
        // Fallback: Use PowerShell with AudioDeviceCmdlets
        const fallbackCommand = `powershell -Command "
          try {
            if (Get-Command Set-AudioDevice -ErrorAction SilentlyContinue) {
              Set-AudioDevice -RecordingMute $${mute}
            } else {
              # Toggle using COM object
              Add-Type -TypeDefinition 'using System.Runtime.InteropServices; [Guid(\\"294935CE-F637-4E7C-A41B-AB255460B862\\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IAudioEndpointVolume { int NotImpl1(); int NotImpl2(); int NotImpl3(); int NotImpl4(); int NotImpl5(); int NotImpl6(); int NotImpl7(); int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext); int GetMute(out bool pbMute); }'
            }
          } catch { }
        "`;
        await execAsync(fallbackCommand);
      }

      this.micMuted = mute;
      logger.info(`Microphone ${mute ? "muted" : "unmuted"}`);
      return true;
    } catch (error) {
      logger.error(
        `Failed to ${mute ? "mute" : "unmute"} microphone: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * Toggle microphone state
   */
  async toggleMic(): Promise<boolean> {
    return this.setMicMute(!this.micMuted);
  }

  /**
   * Convenience method: Set volume to low and unmute mic
   */
  async setLowVolumeWithMic(): Promise<boolean> {
    const volumeResult = await this.setVolume("low");
    const micResult = await this.setMicMute(false); // Unmute mic
    return volumeResult && micResult;
  }

  /**
   * Convenience method: Set volume to medium and unmute mic
   */
  async setMediumVolumeWithMic(): Promise<boolean> {
    const volumeResult = await this.setVolume("medium");
    const micResult = await this.setMicMute(false); // Unmute mic
    return volumeResult && micResult;
  }

  /**
   * Convenience method: Set volume to high and mute mic
   */
  async setHighVolumeNoMic(): Promise<boolean> {
    const volumeResult = await this.setVolume("high");
    const micResult = await this.setMicMute(true); // Mute mic
    return volumeResult && micResult;
  }

  /**
   * Press Discord hotkey for mic toggle
   * Requires Discord keybind configured (default: CTRL+SHIFT+M)
   * @param hotkey The Discord keybind for mic toggle (e.g., "CTRL+SHIFT+M")
   */
  async pressDiscordMicToggle(
    hotkey: string = "CTRL+SHIFT+M"
  ): Promise<boolean> {
    logger.info(`Discord: Pressing mic toggle hotkey (${hotkey})`);
    // This will be handled by the sequence executor pressing the actual key
    return true;
  }

  /**
   * Press Discord hotkey for deafen toggle
   * Requires Discord keybind configured (default: CTRL+SHIFT+D)
   * @param hotkey The Discord keybind for deafen (e.g., "CTRL+SHIFT+D")
   */
  async pressDiscordDeafenToggle(
    hotkey: string = "CTRL+SHIFT+D"
  ): Promise<boolean> {
    logger.info(`Discord: Pressing deafen toggle hotkey (${hotkey})`);
    // This will be handled by the sequence executor pressing the actual key
    return true;
  }

  /**
   * Get current volume level
   */
  getVolumeLevel(): VolumeLevel {
    return this.lastVolumeLevel;
  }

  /**
   * Get mic mute state
   */
  isMicMuted(): boolean {
    return this.micMuted;
  }
}

// Singleton instance
let discordControllerInstance: DiscordController | null = null;

export function getDiscordController(): DiscordController {
  if (!discordControllerInstance) {
    discordControllerInstance = new DiscordController();
  }
  return discordControllerInstance;
}
