//
//  AppleNativeComposerGlass.swift
//  PostHiveCompanion
//
//  Liquid Glass (iOS 26+) composer panel + compact icon buttons for assistant.
//

import Foundation
import SwiftUI
import UIKit
import React

// MARK: - Glass panel (background only, non-interactive)

final class AppleNativeGlassPanelProps: ObservableObject {
  @Published var cornerRadius: CGFloat = 14
}

private struct AppleNativeGlassPanelSwiftUI: View {
  @ObservedObject var props: AppleNativeGlassPanelProps

  var body: some View {
    GeometryReader { geo in
      let r = props.cornerRadius
      let w = geo.size.width
      let h = geo.size.height
      if #available(iOS 26.0, *) {
        Color.clear
          .frame(width: w, height: h)
          .glassEffect(.regular, in: RoundedRectangle(cornerRadius: r, style: .continuous))
      } else {
        ZStack {
          RoundedRectangle(cornerRadius: r, style: .continuous)
            .fill(.regularMaterial)
          RoundedRectangle(cornerRadius: r, style: .continuous)
            .strokeBorder(
              LinearGradient(
                colors: [
                  Color.white.opacity(0.45),
                  Color.white.opacity(0.12),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing,
              ),
              lineWidth: 1,
            )
        }
        .frame(width: w, height: h)
      }
    }
  }
}

final class AppleNativeGlassPanelView: UIView {
  #if DEBUG
  private static var didLogMount = false
  #endif
  private let props = AppleNativeGlassPanelProps()
  private var hostingController: UIHostingController<AppleNativeGlassPanelSwiftUI>?

  @objc var cornerRadius: NSNumber = NSNumber(value: 14) {
    didSet {
      props.cornerRadius = CGFloat(truncating: cornerRadius)
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    isUserInteractionEnabled = false
    isOpaque = false
    backgroundColor = .clear

    let root = AppleNativeGlassPanelSwiftUI(props: props)
    let hc = UIHostingController(rootView: root)
    hc.view.backgroundColor = .clear
    hc.view.isOpaque = false
    hc.view.isUserInteractionEnabled = false
    hostingController = hc
    addSubview(hc.view)
    hc.view.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      hc.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      hc.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      hc.view.topAnchor.constraint(equalTo: topAnchor),
      hc.view.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])

    #if DEBUG
    if !Self.didLogMount {
      Self.didLogMount = true
      let os = ProcessInfo.processInfo.operatingSystemVersion
      let ver = "\(os.majorVersion).\(os.minorVersion).\(os.patchVersion)"
      if #available(iOS 26.0, *) {
        NSLog("[POSTHIVE_GLASS] AppleNativeGlassPanel mounted → SwiftUI glassEffect (Liquid Glass). iOS %@", ver)
      } else {
        NSLog("[POSTHIVE_GLASS] AppleNativeGlassPanel mounted → SwiftUI regularMaterial only. iOS %@", ver)
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

@objc(AppleNativeGlassPanelManager)
final class AppleNativeGlassPanelManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func view() -> UIView! {
    AppleNativeGlassPanelView()
  }
}

// MARK: - Icon button (mic / send)

final class AppleNativeGlassIconButtonProps: ObservableObject {
  @Published var symbolName: String = "paperplane.fill"
  @Published var prominent: Bool = true
  @Published var active: Bool = false
  @Published var enabled: Bool = true
}

private struct AppleNativeGlassIconButtonSwiftUI: View {
  @ObservedObject var props: AppleNativeGlassIconButtonProps
  let onTap: () -> Void

  var body: some View {
    iconButton
      .disabled(!props.enabled)
      .opacity(props.enabled ? 1 : 0.42)
  }

  @ViewBuilder
  private var iconButton: some View {
    let sym = props.symbolName
    if #available(iOS 26.0, *) {
      // `.glass` / `.glassProminent` button styles paint opaque fills — skip them so `glassEffect`
      // samples content behind the composer (same idea as `AppleNativeFabChrome`).
      let weight: Font.Weight = (props.prominent || props.active) ? .bold : .semibold
      Button(action: onTap) {
        Image(systemName: sym)
          .font(.system(size: 18, weight: weight))
          .foregroundStyle(.white)
          .frame(width: 40, height: 40)
          .glassEffect(.regular.interactive(), in: Circle())
      }
      .buttonStyle(.plain)
    } else {
      legacyPreGlassIconButton(systemName: sym)
    }
  }

  @ViewBuilder
  private func legacyPreGlassIconButton(systemName sym: String) -> some View {
    if props.prominent || props.active {
      Button(action: onTap) {
        Image(systemName: sym)
          .font(.system(size: 18, weight: .semibold))
          .foregroundStyle(.white)
          .frame(width: 40, height: 40)
      }
      .buttonStyle(BorderedProminentButtonStyle())
    } else {
      Button(action: onTap) {
        Image(systemName: sym)
          .font(.system(size: 18, weight: .semibold))
          .foregroundStyle(.white)
          .frame(width: 40, height: 40)
      }
      .buttonStyle(BorderedButtonStyle())
    }
  }
}

final class AppleNativeGlassIconButtonView: UIView {
  #if DEBUG
  private static var didLogMount = false
  #endif
  private let props = AppleNativeGlassIconButtonProps()
  private var hostingController: UIHostingController<AppleNativeGlassIconButtonSwiftUI>?

  @objc var onNativePress: RCTDirectEventBlock?

  @objc var systemImage: NSString = "paperplane.fill" {
    didSet { props.symbolName = systemImage as String }
  }

  @objc var prominent: Bool = true {
    didSet { props.prominent = prominent }
  }

  @objc var active: Bool = false {
    didSet { props.active = active }
  }

  @objc var enabled: Bool = true {
    didSet { props.enabled = enabled }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false
    backgroundColor = .clear

    let root = AppleNativeGlassIconButtonSwiftUI(props: props) { [weak self] in
      self?.onNativePress?([:])
    }
    let hc = UIHostingController(rootView: root)
    hc.view.backgroundColor = .clear
    hc.view.isOpaque = false
    hostingController = hc
    addSubview(hc.view)
    hc.view.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      hc.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      hc.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      hc.view.topAnchor.constraint(equalTo: topAnchor),
      hc.view.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])

    #if DEBUG
    if !Self.didLogMount {
      Self.didLogMount = true
      let os = ProcessInfo.processInfo.operatingSystemVersion
      let ver = "\(os.majorVersion).\(os.minorVersion).\(os.patchVersion)"
      if #available(iOS 26.0, *) {
        NSLog("[POSTHIVE_GLASS] AppleNativeGlassIconButton mounted → SwiftUI glassEffect.interactive. iOS %@", ver)
      } else {
        NSLog("[POSTHIVE_GLASS] AppleNativeGlassIconButton mounted → bordered SwiftUI (no Liquid Glass). iOS %@", ver)
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

@objc(AppleNativeGlassIconButtonManager)
final class AppleNativeGlassIconButtonManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func view() -> UIView! {
    AppleNativeGlassIconButtonView()
  }
}
