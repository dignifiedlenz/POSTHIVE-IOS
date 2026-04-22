//
//  AppleNativeButton.swift
//  PostHiveCompanion
//
//  SwiftUI `Button` in `UIHostingController`.
//  iOS 26+: Liquid Glass button styles (`.glass`, `.glassProminent`).
//  Earlier iOS: standard bordered styles.
//

import SwiftUI
import UIKit
import React

// MARK: - Observable props (RN updates drive SwiftUI)

final class AppleNativeButtonProps: ObservableObject {
  @Published var title: String = ""
  @Published var styleName: String = "borderedProminent"
  @Published var systemImage: String?
  @Published var enabled: Bool = true
}

// MARK: - SwiftUI

private struct AppleNativeButtonSwiftUI: View {
  @ObservedObject var props: AppleNativeButtonProps
  let onPress: () -> Void

  var body: some View {
    if #available(iOS 17.0, *) {
      styledCore
        .controlSize(.large)
        .disabled(!props.enabled)
    } else {
      styledCore
        .disabled(!props.enabled)
    }
  }

  private var styledCore: AnyView {
    let label = buttonLabel
    switch normalizedStyle {
    case "borderedprominent", "prominent", "filled":
      if #available(iOS 26.0, *) {
        return AnyView(Button(action: onPress) { label }.buttonStyle(.glassProminent))
      } else {
        return AnyView(Button(action: onPress) { label }.buttonStyle(.borderedProminent))
      }
    case "bordered", "secondary":
      if #available(iOS 26.0, *) {
        return AnyView(Button(action: onPress) { label }.buttonStyle(.glass))
      } else {
        return AnyView(Button(action: onPress) { label }.buttonStyle(.bordered))
      }
    case "borderless":
      return AnyView(Button(action: onPress) { label }.buttonStyle(.borderless))
    case "plain":
      if #available(iOS 16.0, *) {
        return AnyView(Button(action: onPress) { label }.buttonStyle(.plain))
      } else {
        return AnyView(Button(action: onPress) { label }.buttonStyle(.bordered))
      }
    default:
      if #available(iOS 26.0, *) {
        return AnyView(Button(action: onPress) { label }.buttonStyle(.glassProminent))
      } else {
        return AnyView(Button(action: onPress) { label }.buttonStyle(.borderedProminent))
      }
    }
  }

  private var normalizedStyle: String {
    props.styleName.lowercased().replacingOccurrences(of: "-", with: "")
  }

  @ViewBuilder
  private var buttonLabel: some View {
    let t = props.title
    Group {
      if let sym = props.systemImage?.trimmingCharacters(in: .whitespacesAndNewlines), !sym.isEmpty {
        Label {
          Text(t)
        } icon: {
          Image(systemName: sym)
        }
      } else {
        Text(t)
      }
    }
    // Extra breathing room inside the native button chrome so the touch
    // target / pill feels chunkier without losing the native Liquid Glass
    // shape.
    .padding(.horizontal, 12)
    .padding(.vertical, 6)
  }
}

// MARK: - UIView host

final class AppleNativeButtonView: UIView {
  private let props = AppleNativeButtonProps()
  private var hostingController: UIHostingController<AppleNativeButtonSwiftUI>?

  @objc var onNativePress: RCTDirectEventBlock?

  @objc var title: NSString = "" {
    didSet { props.title = title as String }
  }

  /// borderedProminent | bordered | borderless | plain | secondary | prominent | filled
  @objc var buttonStyle: NSString = "borderedProminent" {
    didSet { props.styleName = buttonStyle as String }
  }

  @objc var enabled: Bool = true {
    didSet { props.enabled = enabled }
  }

  @objc var systemImage: NSString? {
    didSet {
      let s = systemImage as String?
      props.systemImage = (s == nil || s?.isEmpty == true) ? nil : s
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .clear
    let root = AppleNativeButtonSwiftUI(props: props) { [weak self] in
      self?.onNativePress?([:])
    }
    let hc = UIHostingController(rootView: root)
    hc.view.backgroundColor = .clear
    hostingController = hc
    addSubview(hc.view)
    hc.view.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      hc.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      hc.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      hc.view.topAnchor.constraint(equalTo: topAnchor),
      hc.view.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
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

@objc(AppleNativeButtonManager)
final class AppleNativeButtonManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func view() -> UIView! {
    AppleNativeButtonView()
  }
}
