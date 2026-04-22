//
//  AppleNativeFabChrome.swift
//  PostHiveCompanion
//
//  iOS 26+: Liquid Glass `.interactive()` when `interactive=true` (system press/reflections).
//  UIKit gestures on the hosting view: tap, long-press voice, swipe-up cancel.
//
//  interactive=false: decorative; touches off so RN Pressable can own hits (fallback path).
//

import Foundation
import SwiftUI
import UIKit
import React

private let voiceSwipeThreshold: CGFloat = 80
private let longPressMinDuration: TimeInterval = 0.32

// MARK: - Props

final class AppleNativeFabChromeProps: ObservableObject {
  @Published var symbolName: String = "plus"
  @Published var useInteractiveGlass: Bool = false
}

// MARK: - SwiftUI

private struct AppleNativeFabChromeSwiftUI: View {
  @ObservedObject var props: AppleNativeFabChromeProps

  var body: some View {
    GeometryReader { geo in
      let d = min(geo.size.width, geo.size.height)
      fabContent(diameter: d)
        .position(x: geo.size.width / 2, y: geo.size.height / 2)
    }
  }

  @ViewBuilder
  private func fabContent(diameter d: CGFloat) -> some View {
    let iconSize = max(14, d * 0.42)
    if #available(iOS 26.0, *) {
      let base = Image(systemName: props.symbolName)
        .font(.system(size: iconSize, weight: .semibold))
        .foregroundStyle(.white)
        .frame(width: d, height: d)
      if props.useInteractiveGlass {
        base.glassEffect(.regular.interactive(), in: Circle())
      } else {
        base.glassEffect(.regular, in: Circle())
      }
    } else {
      ZStack {
        Circle()
          .fill(.regularMaterial)
        Circle()
          .strokeBorder(
            LinearGradient(
              colors: [
                Color.white.opacity(0.52),
                Color.white.opacity(0.18),
                Color.white.opacity(0.08),
              ],
              startPoint: .topLeading,
              endPoint: .bottomTrailing,
            ),
            lineWidth: 1.5,
          )
        Image(systemName: props.symbolName)
          .font(.system(size: iconSize, weight: .semibold))
          .foregroundStyle(.white)
      }
      .frame(width: d, height: d)
      .shadow(color: .black.opacity(0.4), radius: 14, x: 0, y: 8)
    }
  }
}

// MARK: - Native create-menu rows
//
// Mirrored on the JS side (see `AppleNativeCreateGlassMenu.tsx` `CreationMenuAction`).
private struct FabCreateMenuItem {
  let id: String
  let title: String
  let subtitle: String
  let symbol: String
}

private let fabCreateMenuItems: [FabCreateMenuItem] = [
  FabCreateMenuItem(id: "task", title: "Task", subtitle: "To-do item", symbol: "checkmark.circle"),
  FabCreateMenuItem(id: "event", title: "Event", subtitle: "Milestone or meeting", symbol: "calendar"),
  FabCreateMenuItem(id: "project", title: "Project", subtitle: "New creative project", symbol: "folder.badge.plus"),
  FabCreateMenuItem(id: "deliverable", title: "Deliverable", subtitle: "Content for review", symbol: "square.stack.3d.up"),
]

// MARK: - UIView host

final class AppleNativeFabChromeView: UIView, UIGestureRecognizerDelegate {
  #if DEBUG
  private static var didLogMount = false
  #endif
  private let props = AppleNativeFabChromeProps()
  private var hostingController: UIHostingController<AppleNativeFabChromeSwiftUI>?

  /// Tap callback. Carries `{action: <id>}` when triggered from the system context menu so RN
  /// can route directly to the matching creation flow. An empty dict means a bare short tap
  /// (e.g. from the legacy non-menu code path), which RN may handle as it likes.
  @objc var onNativeShortTap: RCTDirectEventBlock?
  @objc var onVoiceBegan: RCTDirectEventBlock?
  @objc var onVoiceEnded: RCTDirectEventBlock?

  @objc var systemImage: NSString = "plus" {
    didSet {
      props.symbolName = systemImage as String
    }
  }

  @objc var interactive: Bool = false {
    didSet {
      props.useInteractiveGlass = interactive
      applyInteractionMode()
    }
  }

  private var longPress: UILongPressGestureRecognizer?
  /// Transparent UIButton overlay that hosts the system `UIMenu`. Tapping the FAB lets iOS
  /// present its native (Liquid Glass on iOS 26+) context menu — long-press still routes to
  /// our voice handler because the long-press gesture beats the button's primary action.
  private var menuButton: UIButton?

  private var voiceSessionActive = false
  private var voiceEndDelivered = false
  /// Finger Y at long-press recognition (UIKit coords: ↑ decreases Y). Used for swipe-up cancel.
  private var voiceLongPressStartY: CGFloat = 0

  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false
    backgroundColor = .clear
    clipsToBounds = false

    let root = AppleNativeFabChromeSwiftUI(props: props)
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

    // Transparent UIButton over the SwiftUI chrome. With `showsMenuAsPrimaryAction = true`
    // a single tap pops the system context menu (Liquid Glass on iOS 26+, regular menu otherwise).
    // The button is invisible — the SwiftUI hosting view underneath is what the user sees.
    let btn = UIButton(type: .custom)
    btn.backgroundColor = .clear
    btn.translatesAutoresizingMaskIntoConstraints = false
    btn.showsMenuAsPrimaryAction = true
    btn.menu = buildCreateMenu()
    addSubview(btn)
    NSLayoutConstraint.activate([
      btn.leadingAnchor.constraint(equalTo: leadingAnchor),
      btn.trailingAnchor.constraint(equalTo: trailingAnchor),
      btn.topAnchor.constraint(equalTo: topAnchor),
      btn.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
    menuButton = btn

    // Long-press lives on the button (not the parent view) so it sits inside the same gesture
    // arena as UIButton's internal recognizers and can race them. When ours wins (finger held
    // past `longPressMinDuration`), we cancel the button's tracking so iOS doesn't *also*
    // open the menu on touch-up.
    let lp = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
    lp.minimumPressDuration = longPressMinDuration
    lp.allowableMovement = 140
    lp.delegate = self
    btn.addGestureRecognizer(lp)
    longPress = lp

    applyInteractionMode()

    #if DEBUG
    if !Self.didLogMount {
      Self.didLogMount = true
      let os = ProcessInfo.processInfo.operatingSystemVersion
      let ver = "\(os.majorVersion).\(os.minorVersion).\(os.patchVersion)"
      if #available(iOS 26.0, *) {
        NSLog("[POSTHIVE_GLASS] AppleNativeFabChrome mounted → SwiftUI glassEffect + UIMenu. iOS %@", ver)
      } else {
        NSLog("[POSTHIVE_GLASS] AppleNativeFabChrome mounted → SwiftUI material + UIMenu. iOS %@", ver)
      }
    }
    #endif
  }

  required init?(coder: NSCoder) {
    nil
  }

  private func applyInteractionMode() {
    let on = interactive
    isUserInteractionEnabled = on
    // Keep hosting view non-interactive so hit-testing targets the menu button beneath it.
    hostingController?.view.isUserInteractionEnabled = false
    menuButton?.isUserInteractionEnabled = on
  }

  // MARK: System UIMenu

  private func buildCreateMenu() -> UIMenu {
    let actions: [UIAction] = fabCreateMenuItems.map { item in
      UIAction(
        title: item.title,
        subtitle: item.subtitle,
        image: UIImage(systemName: item.symbol)
      ) { [weak self] _ in
        UISelectionFeedbackGenerator().selectionChanged()
        self?.onNativeShortTap?(["action": item.id])
      }
    }
    return UIMenu(title: "Create", children: actions)
  }

  // MARK: Voice (long-press)

  @objc private func handleLongPress(_ g: UILongPressGestureRecognizer) {
    guard interactive else { return }

    switch g.state {
    case .began:
      // Race won — cancel the button's pending tap so iOS does NOT open the menu on touch-up.
      menuButton?.cancelTracking(with: nil)

      voiceSessionActive = true
      voiceEndDelivered = false
      voiceLongPressStartY = g.location(in: self).y
      UIImpactFeedbackGenerator(style: .medium).impactOccurred()
      onVoiceBegan?([:])

    case .changed:
      guard voiceSessionActive, !voiceEndDelivered else { return }
      let dyUp = voiceLongPressStartY - g.location(in: self).y
      if dyUp > voiceSwipeThreshold {
        voiceEndDelivered = true
        voiceSessionActive = false
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        onVoiceEnded?(["aborted": true])
      }

    case .ended:
      if voiceSessionActive, !voiceEndDelivered {
        voiceEndDelivered = true
        onVoiceEnded?(["aborted": false])
      }
      voiceSessionActive = false
      voiceEndDelivered = false

    case .cancelled, .failed:
      if voiceSessionActive, !voiceEndDelivered {
        voiceEndDelivered = true
        onVoiceEnded?(["aborted": true])
      }
      voiceSessionActive = false
      voiceEndDelivered = false

    default:
      break
    }
  }

  // MARK: UIGestureRecognizerDelegate

  /// Allow our long-press to recognize alongside UIButton's built-in recognizers — otherwise
  /// the button's gesture would block ours and we'd never trigger voice.
  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    return true
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingController?.view.setNeedsLayout()
  }
}

// MARK: - View manager

@objc(AppleNativeFabChromeManager)
final class AppleNativeFabChromeManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func view() -> UIView! {
    AppleNativeFabChromeView()
  }
}
