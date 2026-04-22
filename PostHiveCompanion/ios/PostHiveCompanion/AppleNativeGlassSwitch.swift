//
//  AppleNativeGlassSwitch.swift
//  PostHiveCompanion
//
//  SwiftUI `Toggle` (switch style) hosted in `UIHostingController`.
//  iOS 26+: picks up Liquid Glass material treatment automatically.
//  Earlier iOS: standard system Switch via SwiftUI Toggle.
//

import Foundation
import SwiftUI
import UIKit
import React

// MARK: - Observable props (RN updates drive SwiftUI)

final class AppleNativeGlassSwitchProps: ObservableObject {
  @Published var isOn: Bool = false
  @Published var enabled: Bool = true
  /// Hex string for the "on" tint, e.g. "#4ade80". `nil` = system green.
  @Published var tintHex: String?
}

// MARK: - SwiftUI

private struct AppleNativeGlassSwitchSwiftUI: View {
  @ObservedObject var props: AppleNativeGlassSwitchProps
  let onChange: (Bool) -> Void

  var body: some View {
    Toggle(
      "",
      isOn: Binding(
        get: { props.isOn },
        set: { newValue in
          // Push state immediately so SwiftUI animates without waiting for RN round-trip.
          props.isOn = newValue
          onChange(newValue)
        },
      ),
    )
    .labelsHidden()
    .toggleStyle(.switch)
    .tint(resolvedTint)
    .disabled(!props.enabled)
    .opacity(props.enabled ? 1 : 0.5)
    .fixedSize()
  }

  private var resolvedTint: Color {
    if let hex = props.tintHex, let ui = UIColor(hex: hex) {
      return Color(uiColor: ui)
    }
    return .green
  }
}

// MARK: - UIView host

final class AppleNativeGlassSwitchView: UIView {
  #if DEBUG
  private static var didLogMount = false
  #endif

  private let props = AppleNativeGlassSwitchProps()
  private var hostingController: UIHostingController<AppleNativeGlassSwitchSwiftUI>?

  /// Native event: `{ value: Bool }`
  @objc var onNativeChange: RCTDirectEventBlock?

  @objc var value: Bool = false {
    didSet {
      // Only push down to SwiftUI when the parent really changed it; avoids
      // re-entrant updates from our own `onNativeChange` callback.
      if props.isOn != value {
        props.isOn = value
      }
    }
  }

  @objc var enabled: Bool = true {
    didSet { props.enabled = enabled }
  }

  @objc var tintColor_: NSString? {
    didSet {
      let s = tintColor_ as String?
      props.tintHex = (s == nil || s?.isEmpty == true) ? nil : s
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .clear
    isOpaque = false

    let root = AppleNativeGlassSwitchSwiftUI(props: props) { [weak self] newValue in
      self?.onNativeChange?(["value": newValue])
    }
    let hc = UIHostingController(rootView: root)
    hc.view.backgroundColor = .clear
    hc.view.isOpaque = false
    hostingController = hc
    addSubview(hc.view)
    hc.view.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      hc.view.centerXAnchor.constraint(equalTo: centerXAnchor),
      hc.view.centerYAnchor.constraint(equalTo: centerYAnchor),
    ])

    #if DEBUG
    if !Self.didLogMount {
      Self.didLogMount = true
      let os = ProcessInfo.processInfo.operatingSystemVersion
      let ver = "\(os.majorVersion).\(os.minorVersion).\(os.patchVersion)"
      if #available(iOS 26.0, *) {
        NSLog("[POSTHIVE_GLASS] AppleNativeGlassSwitch mounted → SwiftUI Toggle (Liquid Glass). iOS %@", ver)
      } else {
        NSLog("[POSTHIVE_GLASS] AppleNativeGlassSwitch mounted → SwiftUI Toggle (no Liquid Glass). iOS %@", ver)
      }
    }
    #endif
  }

  required init?(coder: NSCoder) {
    nil
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingController?.view.setNeedsLayout()
  }
}

// MARK: - View manager

@objc(AppleNativeGlassSwitchManager)
final class AppleNativeGlassSwitchManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func view() -> UIView! {
    AppleNativeGlassSwitchView()
  }
}

// MARK: - UIColor hex helper (file-private to avoid clashing with other modules)

private extension UIColor {
  convenience init?(hex raw: String) {
    var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 6 || s.count == 8, let v = UInt64(s, radix: 16) else {
      return nil
    }
    let r, g, b, a: CGFloat
    if s.count == 6 {
      r = CGFloat((v & 0xFF0000) >> 16) / 255.0
      g = CGFloat((v & 0x00FF00) >> 8) / 255.0
      b = CGFloat(v & 0x0000FF) / 255.0
      a = 1
    } else {
      r = CGFloat((v & 0xFF000000) >> 24) / 255.0
      g = CGFloat((v & 0x00FF0000) >> 16) / 255.0
      b = CGFloat((v & 0x0000FF00) >> 8) / 255.0
      a = CGFloat(v & 0x000000FF) / 255.0
    }
    self.init(red: r, green: g, blue: b, alpha: a)
  }
}
