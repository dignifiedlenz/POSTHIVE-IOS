//
//  WidgetModule.swift
//  PostHiveCompanion
//
//  React Native bridge for updating iOS Home Screen Widgets
//

import Foundation
import WidgetKit
import UIKit

@objc(WidgetModule)
class WidgetModule: NSObject {
    
    private let appGroupIdentifier = "group.com.posthive.companion"
    
    private var userDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupIdentifier)
    }

    private var appGroupContainerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
    }
    
    // MARK: - Upcoming Items (Events & Todos)
    
    @objc
    func updateUpcomingItems(_ items: [[String: Any]]) {
        guard let defaults = userDefaults else { return }
        
        do {
            // Convert dictionaries to our data model
            let upcomingItems: [UpcomingItemData] = items.compactMap { dict in
                guard let id = dict["id"] as? String,
                      let title = dict["title"] as? String,
                      let typeString = dict["type"] as? String else {
                    return nil
                }
                
                var time: Date? = nil
                if let timeString = dict["time"] as? String {
                    let formatter = ISO8601DateFormatter()
                    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    time = formatter.date(from: timeString) ?? ISO8601DateFormatter().date(from: timeString)
                }
                
                return UpcomingItemData(
                    id: id,
                    title: title,
                    subtitle: dict["subtitle"] as? String,
                    time: time,
                    type: typeString,
                    priority: dict["priority"] as? String,
                    color: dict["color"] as? String
                )
            }
            
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(upcomingItems)
            defaults.set(data, forKey: "widgetUpcomingItems")
            defaults.synchronize()
            
            // Refresh widgets
            WidgetCenter.shared.reloadTimelines(ofKind: "PostHiveUpcomingWidget")
        } catch {
            print("WidgetModule: Failed to encode upcoming items: \(error)")
        }
    }
    
    // MARK: - Latest Deliverable
    
    @objc
    func updateLatestDeliverable(_ deliverable: [String: Any]?) {
        guard let defaults = userDefaults else { return }
        
        // Handle null/empty dictionary (JS "clear" case) as well as nil
        guard let deliverable = deliverable, !deliverable.isEmpty else {
            defaults.removeObject(forKey: "widgetLatestDeliverable")
            defaults.removeObject(forKey: "widgetThumbnailData") // legacy
            defaults.removeObject(forKey: "widgetThumbnailFileName")
            defaults.removeObject(forKey: "widgetThumbnailDeliverableId")
            defaults.synchronize()
            WidgetCenter.shared.reloadTimelines(ofKind: "PostHiveDeliverableWidget")
            return
        }

        guard let id = deliverable["id"] as? String,
              let name = deliverable["name"] as? String else {
            print("WidgetModule: Missing required fields (id or name)")
            return
        }

        var updatedAt = Date()
        if let dateString = deliverable["updatedAt"] as? String {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            updatedAt = formatter.date(from: dateString) ?? Date()
        }

        // Handle NSNull values from React Native - convert to nil
        let thumbnailUrl: String? = {
            let value = deliverable["thumbnailUrl"]
            if value is NSNull { return nil }
            return value as? String
        }()

        let currentVersion: Int? = {
            let value = deliverable["currentVersion"]
            if value is NSNull { return nil }
            return value as? Int
        }()

        print("WidgetModule: Updating deliverable '\(name)' with thumbnailUrl: \(thumbnailUrl ?? "nil"), currentVersion: \(currentVersion?.description ?? "nil")")

        // Save snapshot immediately so widget can render text right away
        saveDeliverableSnapshot(
            id: id,
            name: name,
            projectName: deliverable["projectName"] as? String,
            thumbnailUrl: thumbnailUrl,
            unreadCommentCount: deliverable["unreadCommentCount"] as? Int ?? 0,
            currentVersion: currentVersion,
            updatedAt: updatedAt
        )

        WidgetCenter.shared.reloadTimelines(ofKind: "PostHiveDeliverableWidget")

        // Download and cache thumbnail image in background
        if let urlString = thumbnailUrl, !urlString.isEmpty, let url = URL(string: urlString) {
            print("WidgetModule: Starting thumbnail download for \(id)")
            downloadAndCacheThumbnail(url: url, deliverableId: id) {
                print("WidgetModule: Thumbnail cached, reloading widget")
                WidgetCenter.shared.reloadTimelines(ofKind: "PostHiveDeliverableWidget")
            }
        } else {
            print("WidgetModule: No valid thumbnail URL")
        }
    }

    private func downloadAndCacheThumbnail(url: URL, deliverableId: String, completion: @escaping () -> Void) {
        print("WidgetModule: Downloading thumbnail from \(url.absoluteString)")

        let task = URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            if let error = error {
                print("WidgetModule: Failed to download thumbnail: \(error.localizedDescription)")
                completion()
                return
            }

            guard let httpResponse = response as? HTTPURLResponse else {
                print("WidgetModule: Invalid response type")
                completion()
                return
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                print("WidgetModule: HTTP error \(httpResponse.statusCode)")
                completion()
                return
            }

            guard let data = data, !data.isEmpty else {
                print("WidgetModule: No data received for thumbnail")
                completion()
                return
            }

            print("WidgetModule: Downloaded thumbnail successfully, size: \(data.count) bytes")

            guard let self else {
                completion()
                return
            }

            // Resize image for widget (iOS widgets have size limits - max ~2.5MB total area)
            guard let originalImage = UIImage(data: data) else {
                print("WidgetModule: Failed to create UIImage from downloaded data")
                completion()
                return
            }
            
            let originalSize = originalImage.size
            print("WidgetModule: Original image size: \(originalSize.width)x\(originalSize.height)")
            
            // Calculate max dimensions for widget (iOS widgets have strict size limits)
            // Max area is typically ~2.5MB but can be lower, so we'll be conservative
            // Target: max 600px width, 400px height = 240,000 pixels (well under limit)
            let maxWidth: CGFloat = 600
            let maxHeight: CGFloat = 400
            let maxArea: CGFloat = maxWidth * maxHeight // 240,000 pixels (safe limit)
            
            let scale: CGFloat
            if originalSize.width * originalSize.height > maxArea {
                // Calculate scale to fit within max area while maintaining aspect ratio
                let widthScale = maxWidth / originalSize.width
                let heightScale = maxHeight / originalSize.height
                scale = min(widthScale, heightScale)
            } else {
                scale = 1.0 // Image is already small enough
            }
            
            let newSize = CGSize(width: originalSize.width * scale, height: originalSize.height * scale)
            print("WidgetModule: Resizing to \(newSize.width)x\(newSize.height) (scale: \(scale))")
            
            // Resize image
            UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
            defer { UIGraphicsEndImageContext() }
            
            originalImage.draw(in: CGRect(origin: .zero, size: newSize))
            guard let resizedImage = UIGraphicsGetImageFromCurrentImageContext() else {
                print("WidgetModule: Failed to resize image")
                completion()
                return
            }
            
            // Convert to JPEG with compression (quality 0.85 for good balance)
            guard let resizedData = resizedImage.jpegData(compressionQuality: 0.85) else {
                print("WidgetModule: Failed to convert resized image to JPEG")
                completion()
                return
            }
            
            print("WidgetModule: Resized image: \(resizedData.count) bytes (was \(data.count) bytes)")

            // Save thumbnail as a file in the App Group container (more reliable than UserDefaults blobs)
            guard let containerURL = self.appGroupContainerURL else {
                print("WidgetModule: No App Group container URL")
                completion()
                return
            }

            let thumbnailsDir = containerURL.appendingPathComponent("widget_thumbnails", isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: thumbnailsDir, withIntermediateDirectories: true)
            } catch {
                print("WidgetModule: Failed to create thumbnails dir: \(error)")
                completion()
                return
            }

            let fileName = "\(deliverableId).jpg"
            let fileURL = thumbnailsDir.appendingPathComponent(fileName)
            do {
                try resizedData.write(to: fileURL, options: [.atomic])
                print("WidgetModule: Wrote resized thumbnail file \(fileName) (\(resizedData.count) bytes, \(newSize.width)x\(newSize.height))")
            } catch {
                print("WidgetModule: Failed to write thumbnail file: \(error)")
                completion()
                return
            }

            guard let defaults = self.userDefaults else {
                print("WidgetModule: No UserDefaults available")
                completion()
                return
            }

            defaults.set(fileName, forKey: "widgetThumbnailFileName")
            defaults.set(deliverableId, forKey: "widgetThumbnailDeliverableId")
            defaults.synchronize()

            print("WidgetModule: Cached thumbnail pointer for deliverable \(deliverableId)")

            WidgetCenter.shared.reloadTimelines(ofKind: "PostHiveDeliverableWidget")
            completion()
        }
        task.resume()
    }

    private func saveDeliverableSnapshot(
        id: String,
        name: String,
        projectName: String?,
        thumbnailUrl: String?,
        unreadCommentCount: Int,
        currentVersion: Int?,
        updatedAt: Date
    ) {
        guard let defaults = userDefaults else { return }

        do {
            let snapshot = DeliverableSnapshotData(
                id: id,
                name: name,
                projectName: projectName,
                thumbnailUrl: thumbnailUrl,
                unreadCommentCount: unreadCommentCount,
                currentVersion: currentVersion,
                updatedAt: updatedAt
            )

            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(snapshot)
            defaults.set(data, forKey: "widgetLatestDeliverable")
            defaults.synchronize()

            print("WidgetModule: Saved deliverable snapshot - name: \(name), currentVersion: \(currentVersion?.description ?? "nil"), thumbnailUrl: \(thumbnailUrl ?? "nil"), unreadComments: \(unreadCommentCount), data size: \(data.count) bytes")

            WidgetCenter.shared.reloadTimelines(ofKind: "PostHiveDeliverableWidget")
        } catch {
            print("WidgetModule: Failed to encode deliverable: \(error)")
        }
    }
    
    // MARK: - Active Transfer
    
    @objc
    func updateActiveTransfer(_ transfer: [String: Any]?) {
        guard let defaults = userDefaults else { return }
        
        if let transfer = transfer {
            do {
                guard let id = transfer["id"] as? String,
                      let fileName = transfer["fileName"] as? String,
                      let progress = transfer["progress"] as? Double else {
                    return
                }
                
                var startedAt = Date()
                if let dateString = transfer["startedAt"] as? String {
                    let formatter = ISO8601DateFormatter()
                    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    startedAt = formatter.date(from: dateString) ?? Date()
                }
                
                let transferData = TransferProgressData(
                    id: id,
                    fileName: fileName,
                    progress: progress,
                    bytesTransferred: transfer["bytesTransferred"] as? Int64 ?? 0,
                    totalBytes: transfer["totalBytes"] as? Int64 ?? 0,
                    isUpload: transfer["isUpload"] as? Bool ?? true,
                    startedAt: startedAt
                )
                
                let encoder = JSONEncoder()
                encoder.dateEncodingStrategy = .iso8601
                let data = try encoder.encode(transferData)
                defaults.set(data, forKey: "widgetActiveTransfer")
                defaults.synchronize()
                
                WidgetCenter.shared.reloadTimelines(ofKind: "PostHiveTransferWidget")
            } catch {
                print("WidgetModule: Failed to encode transfer: \(error)")
            }
        } else {
            defaults.removeObject(forKey: "widgetActiveTransfer")
            defaults.synchronize()
            WidgetCenter.shared.reloadTimelines(ofKind: "PostHiveTransferWidget")
        }
    }
    
    // MARK: - Clear Transfer (when complete)
    
    @objc
    func clearActiveTransfer() {
        updateActiveTransfer(nil)
    }

    // MARK: - Activity Feed

    @objc
    func updateActivityFeed(_ activities: [[String: Any]]) {
        guard let defaults = userDefaults else {
            print("WidgetModule: No UserDefaults available for activity feed")
            return
        }

        print("WidgetModule: Updating activity feed with \(activities.count) items")

        do {
            let activityItems: [ActivityItem] = activities.compactMap { dict in
                guard let id = dict["id"] as? String,
                      let typeString = dict["type"] as? String,
                      let title = dict["title"] as? String else {
                    print("WidgetModule: Skipping activity - missing required fields")
                    return nil
                }

                let activityType: ActivityItem.ActivityType
                switch typeString.lowercased() {
                case "upload": activityType = .upload
                case "comment": activityType = .comment
                case "approval": activityType = .approval
                case "revision": activityType = .revision
                case "share": activityType = .share
                case "mention": activityType = .mention
                case "download": activityType = .download
                default:
                    print("WidgetModule: Unknown activity type '\(typeString)', defaulting to upload")
                    activityType = .upload
                }

                var timestamp = Date()
                if let timeString = dict["timestamp"] as? String {
                    let formatter = ISO8601DateFormatter()
                    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    timestamp = formatter.date(from: timeString) ?? ISO8601DateFormatter().date(from: timeString) ?? Date()
                }

                let subtitle: String? = {
                    let value = dict["subtitle"]
                    if value is NSNull { return nil }
                    return value as? String
                }()

                let thumbnailUrl: String? = {
                    let value = dict["thumbnailUrl"]
                    if value is NSNull { return nil }
                    return value as? String
                }()

                let userName: String? = {
                    let value = dict["userName"]
                    if value is NSNull { return nil }
                    return value as? String
                }()

                return ActivityItem(
                    id: id,
                    type: activityType,
                    title: title,
                    subtitle: subtitle,
                    timestamp: timestamp,
                    thumbnailUrl: thumbnailUrl,
                    userName: userName
                )
            }

            print("WidgetModule: Converted \(activityItems.count) activities (from \(activities.count) input)")

            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(activityItems)
            defaults.set(data, forKey: "widgetActivityFeed")
            defaults.synchronize()

            print("WidgetModule: Saved \(activityItems.count) activities to widget (data size: \(data.count) bytes)")
            WidgetCenter.shared.reloadTimelines(ofKind: "PostHiveActivityWidget")
        } catch {
            print("WidgetModule: Failed to encode activity feed: \(error)")
        }
    }
    
    // MARK: - Force Reload All Widgets
    
    @objc
    func reloadAllWidgets() {
        WidgetCenter.shared.reloadAllTimelines()
    }
    
    // MARK: - Module Setup
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}

// MARK: - Internal Data Models (must match widget extension)

private struct UpcomingItemData: Codable {
    var id: String
    var title: String
    var subtitle: String?
    var time: Date?
    var type: String
    var priority: String?
    var color: String?
}

private struct DeliverableSnapshotData: Codable {
    var id: String
    var name: String
    var projectName: String?
    var thumbnailUrl: String?
    var unreadCommentCount: Int
    var currentVersion: Int?
    var updatedAt: Date
}

private struct TransferProgressData: Codable {
    var id: String
    var fileName: String
    var progress: Double
    var bytesTransferred: Int64
    var totalBytes: Int64
    var isUpload: Bool
    var startedAt: Date
}

// ActivityItem must match the widget extension's ActivityItem exactly
private struct ActivityItem: Codable {
    enum ActivityType: String, Codable {
        case upload
        case comment
        case approval
        case revision
        case share
        case mention
        case download
    }
    
    var id: String
    var type: ActivityType
    var title: String
    var subtitle: String?
    var timestamp: Date
    var thumbnailUrl: String?
    var userName: String?
}
