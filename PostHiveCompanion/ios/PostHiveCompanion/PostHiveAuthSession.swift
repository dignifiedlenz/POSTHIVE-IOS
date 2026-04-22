import AuthenticationServices
import React
import UIKit

@objc(PostHiveAuthSession)
class PostHiveAuthSession: NSObject, ASWebAuthenticationPresentationContextProviding {
  private var authSession: ASWebAuthenticationSession?

  @objc
  static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc(start:resolver:rejecter:)
  func start(
    _ urlString: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let url = URL(string: urlString) else {
      reject("E_INVALID_URL", "Invalid auth URL", nil)
      return
    }

    authSession = ASWebAuthenticationSession(
      url: url,
      callbackURLScheme: "posthive"
    ) { [weak self] callbackURL, error in
      self?.authSession = nil

      if let error = error {
        if let authError = error as? ASWebAuthenticationSessionError,
           authError.code == .canceledLogin {
          reject("E_CANCELLED", "User cancelled sign-in", error)
          return
        }
        reject("E_AUTH", error.localizedDescription, error)
        return
      }

      guard let callbackURL = callbackURL else {
        reject("E_NO_CALLBACK", "No callback URL", nil)
        return
      }

      resolve(callbackURL.absoluteString)
    }

    authSession?.presentationContextProvider = self
    authSession?.prefersEphemeralWebBrowserSession = false

    if authSession?.start() != true {
      reject("E_START", "Failed to start sign-in session", nil)
    }
  }

  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    if let window = scenes
      .flatMap({ $0.windows })
      .first(where: { $0.isKeyWindow }) {
      return window
    }
    if let window = scenes.flatMap({ $0.windows }).first {
      return window
    }
    return UIApplication.shared.windows.first(where: { $0.isKeyWindow })
      ?? UIApplication.shared.windows.first
      ?? UIWindow(frame: UIScreen.main.bounds)
  }
}
