//
//  AppleNativeCreateGlassMenu.swift
//  PostHiveCompanion
//
//  Full-screen dimmer + bottom glass sheet to pick a creation context (task, event, project, deliverable).
//

import Foundation
import SwiftUI
import UIKit
import React

private struct CreateMenuRow: Identifiable {
  let id: String
  let symbol: String
  let title: String
  let subtitle: String
}

private let createMenuRows: [CreateMenuRow] = [
  CreateMenuRow(id: "task", symbol: "checkmark.circle", title: "Task", subtitle: "To-do item"),
  CreateMenuRow(id: "event", symbol: "calendar", title: "Event", subtitle: "Milestone or meeting"),
  CreateMenuRow(id: "project", symbol: "folder.badge.plus", title: "Project", subtitle: "New creative project"),
  CreateMenuRow(id: "deliverable", symbol: "square.stack.3d.up", title: "Deliverable", subtitle: "Content for review"),
]

// MARK: - Props

final class AppleNativeCreateGlassMenuProps: ObservableObject {
  @Published var visible: Bool = false
  var emitDismiss: () -> Void = {}
  var emitSelect: (String) -> Void = { _ in }
}

// MARK: - SwiftUI

private struct AppleNativeCreateGlassMenuSwiftUI: View {
  @ObservedObject var props: AppleNativeCreateGlassMenuProps

  var body: some View {
    GeometryReader { geo in
      let safeBottom = geo.safeAreaInsets.bottom
      ZStack(alignment: .bottom) {
        if props.visible {
          Color.black.opacity(0.48)
            .ignoresSafeArea()
            .contentShape(Rectangle())
            .onTapGesture {
              props.emitDismiss()
            }

          VStack(spacing: 0) {
            ForEach(Array(createMenuRows.enumerated()), id: \.element.id) { pair in
              let row = pair.element
              Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                props.emitSelect(row.id)
              } label: {
                HStack(alignment: .center, spacing: 14) {
                  Image(systemName: row.symbol)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.primary)
                    .frame(width: 28, alignment: .center)
                  VStack(alignment: .leading, spacing: 2) {
                    Text(row.title)
                      .font(.system(size: 17, weight: .semibold))
                      .foregroundStyle(.primary)
                    Text(row.subtitle)
                      .font(.system(size: 13, weight: .regular))
                      .foregroundStyle(.secondary)
                  }
                  Spacer(minLength: 0)
                  Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 14)
                .contentShape(Rectangle())
              }
              .buttonStyle(.plain)

              if pair.offset < createMenuRows.count - 1 {
                Divider()
                  .opacity(0.35)
                  .padding(.leading, 60)
              }
            }
          }
          .frame(maxWidth: .infinity)
          .background {
            menuPanelBackground(cornerRadius: 22)
          }
          .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
          .padding(.horizontal, 16)
          .padding(.bottom, max(safeBottom, 12) + 8)
        }
      }
      .frame(width: geo.size.width, height: geo.size.height)
    }
  }

  @ViewBuilder
  private func menuPanelBackground(cornerRadius r: CGFloat) -> some View {
    if #available(iOS 26.0, *) {
      Color.clear
        .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: r, style: .continuous))
    } else {
      ZStack {
        RoundedRectangle(cornerRadius: r, style: .continuous)
          .fill(.regularMaterial)
        RoundedRectangle(cornerRadius: r, style: .continuous)
          .strokeBorder(
            LinearGradient(
              colors: [
                Color.white.opacity(0.45),
                Color.white.opacity(0.1),
              ],
              startPoint: .topLeading,
              endPoint: .bottomTrailing,
            ),
            lineWidth: 1,
          )
      }
    }
  }
}

// MARK: - UIView host

final class AppleNativeCreateGlassMenuView: UIView {
  private let props = AppleNativeCreateGlassMenuProps()
  private var hostingController: UIHostingController<AppleNativeCreateGlassMenuSwiftUI>?

  @objc var onDismiss: RCTDirectEventBlock? {
    didSet {
      syncEventHandlers()
    }
  }

  @objc var onSelect: RCTDirectEventBlock? {
    didSet {
      syncEventHandlers()
    }
  }

  @objc var visible: Bool = false {
    didSet {
      applyVisible()
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false
    backgroundColor = .clear
    clipsToBounds = true

    syncEventHandlers()

    let root = AppleNativeCreateGlassMenuSwiftUI(props: props)
    let hc = UIHostingController(rootView: root)
    hc.view.backgroundColor = .clear
    hc.view.isOpaque = false
    // SwiftUI owns row taps; dimmer uses SwiftUI onTapGesture.
    hc.view.isUserInteractionEnabled = true
    hostingController = hc
    addSubview(hc.view)
    hc.view.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      hc.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      hc.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      hc.view.topAnchor.constraint(equalTo: topAnchor),
      hc.view.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])

    applyVisible()
  }

  required init?(coder: NSCoder) {
    nil
  }

  private func syncEventHandlers() {
    props.emitDismiss = { [weak self] in
      self?.onDismiss?([:])
    }
    props.emitSelect = { [weak self] id in
      self?.onSelect?(["action": id])
    }
  }

  private func applyVisible() {
    let on = visible
    props.visible = on
    isUserInteractionEnabled = on
    isHidden = !on
    alpha = on ? 1 : 0
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingController?.view.setNeedsLayout()
  }
}

// MARK: - View manager

@objc(AppleNativeCreateGlassMenuManager)
final class AppleNativeCreateGlassMenuManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func view() -> UIView! {
    AppleNativeCreateGlassMenuView()
  }
}
