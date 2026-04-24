//
//  AudioSessionModule.swift
//  PostHiveCompanion
//
//  Tiny RN bridge that lets JS prepare the shared `AVAudioSession` for speech recognition
//  before calling `Voice.start(...)`, and tear it back down to a playback-friendly state on
//  release.
//
//  Why this exists: `@react-native-voice/voice` does NOT configure the audio session for
//  you — it just calls `AVAudioEngine.start()`. If something else in the app (e.g. the
//  dashboard's `react-native-video` HLS background layer) has already promoted the session
//  to `.playback` (no input), the engine throws:
//
//      "required condition is false: IsFormatSampleRateAndChannelCountValid(format)"
//
//  ...because the input node has a 0-channel format. The fix is to flip the session to
//  `.playAndRecord` (mixable, with Bluetooth + speaker default) right before recording, then
//  flip back to `.playback` afterwards so the HLS player keeps working.
//

import Foundation
import AVFoundation
import React

@objc(AudioSessionModule)
final class AudioSessionModule: NSObject {

  /// `AVAudioSession` is configured on the main queue in each method — RN may call from a
  /// background thread, and off-main updates often leave `inputNode` with an invalid format
  /// (`IsFormatSampleRateAndChannelCountValid` in `AVAudioEngine`).
  @objc static func requiresMainQueueSetup() -> Bool { false }

  /// Configure the session for speech recognition. Idempotent — safe to call repeatedly.
  /// Resolves once the session is active in `.playAndRecord` mode.
  @objc(prepareForRecording:rejecter:)
  func prepareForRecording(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      let session = AVAudioSession.sharedInstance()

      // Mirror `@react-native-voice/voice`'s own `setupAudioSession` exactly so its setCategory
      // call (which fires right before it queries `inputNode.outputFormatForBus:0`) is a no-op
      // and does not invalidate the input graph:
      //   - category: .playAndRecord
      //   - options:  .allowBluetooth on BT/headset routes, else .defaultToSpeaker
      //   - no mode  (Swift API: setCategory(_:options:) — preserves prior mode like Voice does)
      let isBluetooth: Bool = {
        if let inputs = session.availableInputs {
          for port in inputs where port.portType == .bluetoothHFP {
            return true
          }
        }
        for output in session.currentRoute.outputs
        where output.portType == .headphones || output.portType == .bluetoothA2DP {
          return true
        }
        return false
      }()
      let options: AVAudioSession.CategoryOptions = isBluetooth ? [.allowBluetoothHFP] : [.defaultToSpeaker]

      do {
        try session.setCategory(.playAndRecord, options: options)
        // Hint preferred IO so iOS doesn't have to negotiate after activation. These are
        // soft preferences — iOS may pick different values, which is fine.
        try? session.setPreferredSampleRate(44_100)
        try? session.setPreferredInputNumberOfChannels(1)
        try session.setActive(true, options: [.notifyOthersOnDeactivation])
      } catch {
        reject(
          "audio_session_record_failed",
          "Could not switch AVAudioSession to playAndRecord: \(error.localizedDescription)",
          error
        )
        return
      }

      // CRITICAL: `AVAudioEngine.inputNode.outputFormat(forBus: 0)` returns 0 Hz / 0 ch
      // *before* the engine has been started — the hardware input route isn't allocated
      // until something actually starts it. `@react-native-voice/voice` queries that
      // format immediately after creating its engine, then calls `installTapOnBus` with
      // it, which throws `IsFormatSampleRateAndChannelCountValid` whenever the route
      // hasn't been warmed up yet (typically right after a category switch).
      //
      // Fix: spin up our own tiny `AVAudioEngine`, start it briefly, and verify it
      // returns a valid input format. Once iOS has published a real format to one
      // engine, the next engine Voice creates inherits the warm route.
      func warmUpInputRoute(remainingAttempts: Int) {
        let warmEngine = AVAudioEngine()
        // Touch inputNode so the engine creates its input AU.
        _ = warmEngine.inputNode

        var started = false
        do {
          try warmEngine.start()
          started = true
        } catch {
          // Engine couldn't start — most likely the route isn't ready yet. Retry below.
        }

        let format = warmEngine.inputNode.outputFormat(forBus: 0)
        if started {
          warmEngine.stop()
        }

        if started && format.sampleRate > 0 && format.channelCount > 0 {
          resolve(nil)
          return
        }

        if remainingAttempts <= 0 {
          // Resolve anyway — JS layer will surface any subsequent Voice error and retry
          // with its own backoff. Better to let Voice attempt than to time out here.
          resolve(nil)
          return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
          warmUpInputRoute(remainingAttempts: remainingAttempts - 1)
        }
      }
      // Up to ~640 ms of warm-up at 80 ms intervals — usually settles in 1–2 attempts.
      warmUpInputRoute(remainingAttempts: 8)
    }
  }

  /// Restore a sane playback-only session after we're done recording, so that the dashboard
  /// HLS background / any other player can resume hearing audio routing properly.
  @objc(restoreForPlayback:rejecter:)
  func restoreForPlayback(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      let session = AVAudioSession.sharedInstance()
      do {
        try session.setCategory(
          .playback,
          mode: .default,
          options: [.mixWithOthers]
        )
        try session.setActive(true, options: [])
        resolve(nil)
      } catch {
        // Non-fatal — recording already stopped and the most we lose is suboptimal routing.
        reject(
          "audio_session_playback_failed",
          "Could not restore AVAudioSession to playback: \(error.localizedDescription)",
          error
        )
      }
    }
  }
}

