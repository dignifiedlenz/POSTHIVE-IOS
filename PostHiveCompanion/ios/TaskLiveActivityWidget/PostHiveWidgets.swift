//
//  PostHiveWidgets.swift
//  PostHiveCompanion
//
//  Static Home Screen Widgets for PostHive
//

import WidgetKit
import SwiftUI
import UIKit

// MARK: - App Group Constants
let appGroupIdentifier = "group.com.posthive.companion"

// MARK: - Shared Data Models

struct UpcomingItem: Codable, Identifiable {
    var id: String
    var title: String
    var subtitle: String?
    var time: Date?
    var type: ItemType
    var priority: String?
    var color: String?
    
    enum ItemType: String, Codable {
        case event
        case todo
    }
}

struct DeliverableSnapshot: Codable {
    var id: String
    var name: String
    var projectName: String?
    var thumbnailUrl: String?
    var unreadCommentCount: Int
    var currentVersion: Int?
    var updatedAt: Date
}

struct TransferProgress: Codable {
    var id: String
    var fileName: String
    var progress: Double // 0.0 to 1.0
    var bytesTransferred: Int64
    var totalBytes: Int64
    var isUpload: Bool
    var startedAt: Date
}

struct RecentTransferItem: Codable, Identifiable {
    var id: String
    var fileName: String
    var isUpload: Bool
    var completedAt: Date
}

struct ActivityItem: Codable, Identifiable {
    var id: String
    var type: ActivityType
    var title: String
    var subtitle: String?
    var timestamp: Date
    var thumbnailUrl: String?
    var userName: String?
    
    enum ActivityType: String, Codable {
        case upload
        case comment
        case approval
        case revision
        case share
        case mention
        case download
    }
}

// MARK: - Data Provider (Reads from UserDefaults)

struct WidgetDataProvider {
    static let shared = WidgetDataProvider()
    
    private var userDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupIdentifier)
    }

    private var appGroupContainerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
    }
    
    // MARK: - Workspace Name
    
    func getWorkspaceName() -> String? {
        guard let defaults = userDefaults else { return nil }
        return defaults.string(forKey: "widgetWorkspaceName")
    }
    
    // MARK: - Upcoming Items (Events & Todos)
    
    func getUpcomingItems() -> [UpcomingItem] {
        guard let defaults = userDefaults,
              let data = defaults.data(forKey: "widgetUpcomingItems") else {
            return []
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        do {
            return try decoder.decode([UpcomingItem].self, from: data)
        } catch {
            return []
        }
    }
    
    // MARK: - Latest Deliverable
    
    func getLatestDeliverable() -> DeliverableSnapshot? {
        guard let defaults = userDefaults,
              let data = defaults.data(forKey: "widgetLatestDeliverable") else {
            print("Widget: No deliverable data found")
            return nil
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        do {
            let snapshot = try decoder.decode(DeliverableSnapshot.self, from: data)
            print("Widget: Loaded deliverable - name: \(snapshot.name), currentVersion: \(snapshot.currentVersion?.description ?? "nil"), thumbnailUrl: \(snapshot.thumbnailUrl ?? "nil"), unreadComments: \(snapshot.unreadCommentCount)")
            return snapshot
        } catch {
            print("Widget: Failed to decode deliverable: \(error)")
            if let decodingError = error as? DecodingError {
                switch decodingError {
                case .keyNotFound(let key, let context):
                    print("Widget: Missing key '\(key.stringValue)' - \(context)")
                case .typeMismatch(let type, let context):
                    print("Widget: Type mismatch for \(type) - \(context)")
                case .valueNotFound(let type, let context):
                    print("Widget: Value not found for \(type) - \(context)")
                case .dataCorrupted(let context):
                    print("Widget: Data corrupted - \(context)")
                @unknown default:
                    print("Widget: Unknown decoding error")
                }
            }
            return nil
        }
    }
    
    // MARK: - Cached Thumbnail Image
    
    func getCachedThumbnailImage(for deliverableId: String) -> UIImage? {
        guard let defaults = userDefaults else {
            print("Widget: No UserDefaults available")
            return nil
        }
        
        let cachedId = defaults.string(forKey: "widgetThumbnailDeliverableId")
        let fileName = defaults.string(forKey: "widgetThumbnailFileName")
        let legacyImageData = defaults.data(forKey: "widgetThumbnailData")
        
        print("Widget: Looking for thumbnail for \(deliverableId), cached ID: \(cachedId ?? "nil"), file: \(fileName ?? "nil"), legacy bytes: \(legacyImageData?.count ?? 0)")
        
        guard let cachedId = cachedId,
              cachedId == deliverableId else {
            print("Widget: Thumbnail cache miss - cachedId: \(cachedId ?? "nil"), matches: \(cachedId == deliverableId)")
            return nil
        }

        // Preferred path: App Group file
        if let fileName, let containerURL = appGroupContainerURL {
            let fileURL = containerURL
                .appendingPathComponent("widget_thumbnails", isDirectory: true)
                .appendingPathComponent(fileName)
            if let data = try? Data(contentsOf: fileURL), let image = UIImage(data: data) {
                print("Widget: Loaded thumbnail from file \(fileName), size: \(image.size)")
                return image
            } else {
                print("Widget: Failed to load thumbnail file \(fileName)")
            }
        }

        // Fallback: legacy UserDefaults blob
        if let legacyImageData, let image = UIImage(data: legacyImageData) {
            print("Widget: Loaded legacy thumbnail bytes, size: \(image.size)")
            return image
        }

        return nil
    }
    
    // MARK: - Active Transfer
    
    func getActiveTransfer() -> TransferProgress? {
        guard let defaults = userDefaults,
              let data = defaults.data(forKey: "widgetActiveTransfer") else {
            return nil
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        do {
            return try decoder.decode(TransferProgress.self, from: data)
        } catch {
            return nil
        }
    }

    func getRecentTransfers() -> [RecentTransferItem] {
        guard let defaults = userDefaults,
              let data = defaults.data(forKey: "widgetRecentTransfers") else {
            return []
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        do {
            return try decoder.decode([RecentTransferItem].self, from: data)
        } catch {
            return []
        }
    }
    
    // MARK: - Activity Feed
    
    func getActivityFeed() -> [ActivityItem] {
        guard let defaults = userDefaults else {
            print("Widget: No UserDefaults available for activity feed")
            return []
        }
        
        guard let data = defaults.data(forKey: "widgetActivityFeed") else {
            print("Widget: No activity feed data found in UserDefaults")
            return []
        }
        
        print("Widget: Found activity feed data (\(data.count) bytes)")
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        do {
            let items = try decoder.decode([ActivityItem].self, from: data)
            print("Widget: Successfully decoded \(items.count) activities")
            return items
        } catch {
            print("Widget: Failed to decode activities: \(error)")
            if let decodingError = error as? DecodingError {
                switch decodingError {
                case .typeMismatch(let type, let context):
                    print("Widget: Type mismatch - expected \(type), context: \(context)")
                case .valueNotFound(let type, let context):
                    print("Widget: Value not found - type \(type), context: \(context)")
                case .keyNotFound(let key, let context):
                    print("Widget: Key not found - \(key), context: \(context)")
                case .dataCorrupted(let context):
                    print("Widget: Data corrupted - context: \(context)")
                @unknown default:
                    print("Widget: Unknown decoding error")
                }
            }
            return []
        }
    }
}

// MARK: - String Helpers

func capitalizeFirst(_ str: String) -> String {
    guard !str.isEmpty else { return str }
    return str.prefix(1).uppercased() + str.dropFirst()
}

// MARK: - Color Helpers

func widgetColorFromHex(_ hex: String) -> Color {
    var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
    
    var rgb: UInt64 = 0
    Scanner(string: hexSanitized).scanHexInt64(&rgb)
    
    let r = Double((rgb & 0xFF0000) >> 16) / 255.0
    let g = Double((rgb & 0x00FF00) >> 8) / 255.0
    let b = Double(rgb & 0x0000FF) / 255.0
    
    return Color(red: r, green: g, blue: b)
}

func priorityColor(_ priority: String?) -> Color {
    switch priority?.lowercased() {
    case "urgent": return Color(red: 0.9, green: 0.2, blue: 0.2)
    case "high": return Color(red: 1.0, green: 0.6, blue: 0.0)
    case "medium": return Color(red: 0.3, green: 0.5, blue: 0.9)
    case "low": return Color(red: 0.4, green: 0.7, blue: 0.4)
    default: return Color.gray
    }
}

// MARK: - PostHive Brand Colors

struct PostHiveColors {
    static let primary = Color(red: 0.4, green: 0.3, blue: 0.9) // Deep purple
    static let accent = Color(red: 1.0, green: 0.4, blue: 0.4)  // Coral
    // Unread/new comments should be blue (not coral/red)
    static let commentBadge = Color(red: 0.23, green: 0.51, blue: 0.96) // ~#3B82F6
    static let background = Color(red: 0.08, green: 0.08, blue: 0.1)
    static let cardBackground = Color(red: 0.12, green: 0.12, blue: 0.15)
    static let textPrimary = Color.white
    static let textSecondary = Color.white.opacity(0.6)
}

// MARK: - Noisy Wave Background

struct NoisyWaveBackground: View {
    var body: some View {
        ZStack {
            // Base gradient: white (bottom) to black (top)
            LinearGradient(
                stops: [
                    .init(color: Color.white.opacity(0.4), location: 0.0),
                    .init(color: Color.white.opacity(0.25), location: 0.15),
                    .init(color: Color.white.opacity(0.15), location: 0.30),
                    .init(color: Color.white.opacity(0.08), location: 0.45),
                    .init(color: Color.black.opacity(0.2), location: 0.60),
                    .init(color: Color.black.opacity(0.6), location: 0.80),
                    .init(color: Color.black, location: 1.0)
                ],
                startPoint: .bottom,
                endPoint: .top
            )
            
            // Fine grain layer - using repeating gradients
            GeometryReader { geo in
                ZStack {
                    // Horizontal grain
                    Rectangle()
                        .fill(
                            LinearGradient(
                                stops: [
                                    .init(color: Color.white.opacity(0.06), location: 0.0),
                                    .init(color: Color.clear, location: 0.001),
                                    .init(color: Color.clear, location: 0.002),
                                    .init(color: Color.white.opacity(0.03), location: 0.004)
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: 2, height: geo.size.height)
                        .scaleEffect(x: geo.size.width / 2, anchor: .leading)
                    
                    // Vertical grain
                    Rectangle()
                        .fill(
                            LinearGradient(
                                stops: [
                                    .init(color: Color.white.opacity(0.06), location: 0.0),
                                    .init(color: Color.clear, location: 0.001),
                                    .init(color: Color.clear, location: 0.002),
                                    .init(color: Color.white.opacity(0.03), location: 0.004)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: geo.size.width, height: 2)
                        .scaleEffect(y: geo.size.height / 2, anchor: .top)
                }
                .opacity(0.7)
                .blendMode(.screen)
            }
            
            // Coarse grain layer
            GeometryReader { geo in
                ZStack {
                    Rectangle()
                        .fill(
                            LinearGradient(
                                stops: [
                                    .init(color: Color.white.opacity(0.08), location: 0.0),
                                    .init(color: Color.clear, location: 0.0005),
                                    .init(color: Color.clear, location: 0.001),
                                    .init(color: Color.white.opacity(0.04), location: 0.002)
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: 1, height: geo.size.height)
                        .scaleEffect(x: geo.size.width, anchor: .leading)
                    
                    Rectangle()
                        .fill(
                            LinearGradient(
                                stops: [
                                    .init(color: Color.white.opacity(0.08), location: 0.0),
                                    .init(color: Color.clear, location: 0.0005),
                                    .init(color: Color.clear, location: 0.001),
                                    .init(color: Color.white.opacity(0.04), location: 0.002)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: geo.size.width, height: 1)
                        .scaleEffect(y: geo.size.height, anchor: .top)
                }
                .opacity(0.4)
                .blendMode(.overlay)
            }
            
            // Wave shapes using Path
            GeometryReader { geo in
                ZStack {
                    // Wave 1 - Bottom
                    WaveShape(
                        amplitude: 50,
                        frequency: 0.008,
                        phase: 0
                    )
                    .fill(
                        LinearGradient(
                            stops: [
                                .init(color: Color.white.opacity(0.08), location: 0.0),
                                .init(color: Color.white.opacity(0), location: 1.0)
                            ],
                            startPoint: .bottom,
                            endPoint: .top
                        )
                    )
                    .frame(height: geo.size.height * 0.4)
                    .offset(y: geo.size.height * 0.6)
                    .opacity(0.6)
                    .blendMode(.screen)
                    
                    // Wave 2 - Middle
                    WaveShape(
                        amplitude: 40,
                        frequency: 0.006,
                        phase: CGFloat.pi / 2
                    )
                    .fill(
                        LinearGradient(
                            stops: [
                                .init(color: Color.white.opacity(0.06), location: 0.0),
                                .init(color: Color.white.opacity(0), location: 1.0)
                            ],
                            startPoint: .bottom,
                            endPoint: .top
                        )
                    )
                    .frame(height: geo.size.height * 0.35)
                    .offset(y: geo.size.height * 0.4)
                    .opacity(0.5)
                    .blendMode(.overlay)
                    
                    // Wave 3 - Top
                    WaveShape(
                        amplitude: 35,
                        frequency: 0.007,
                        phase: CGFloat.pi
                    )
                    .fill(
                        LinearGradient(
                            stops: [
                                .init(color: Color.white.opacity(0.05), location: 0.0),
                                .init(color: Color.white.opacity(0), location: 1.0)
                            ],
                            startPoint: .bottom,
                            endPoint: .top
                        )
                    )
                    .frame(height: geo.size.height * 0.3)
                    .offset(y: geo.size.height * 0.2)
                    .opacity(0.4)
                    .blendMode(.screen)
                    
                    // Blob shape - bottom right
                    Ellipse()
                        .fill(Color.white.opacity(0.03))
                        .frame(
                            width: geo.size.width * 0.6,
                            height: geo.size.height * 0.5
                        )
                        .offset(
                            x: geo.size.width * 0.35,
                            y: geo.size.height * 0.4
                        )
                        .blur(radius: 60)
                        .opacity(0.7)
                        .blendMode(.overlay)
                    
                    // Blob shape - top left
                    Ellipse()
                        .fill(Color.white.opacity(0.02))
                        .frame(
                            width: geo.size.width * 0.7,
                            height: geo.size.height * 0.6
                        )
                        .offset(
                            x: -geo.size.width * 0.15,
                            y: -geo.size.height * 0.15
                        )
                        .blur(radius: 80)
                        .opacity(0.6)
                        .blendMode(.screen)
                }
            }
        }
    }
}

// Helper shape for wave patterns
struct WaveShape: Shape {
    var amplitude: CGFloat
    var frequency: CGFloat
    var phase: CGFloat
    
    func path(in rect: CGRect) -> Path {
        var path = Path()
        
        path.move(to: CGPoint(x: 0, y: rect.midY))
        
        for x in stride(from: 0, through: rect.width, by: 1) {
            let y = rect.midY + amplitude * sin(frequency * x + phase)
            path.addLine(to: CGPoint(x: x, y: y))
        }
        
        // Close the path to create a filled shape
        path.addLine(to: CGPoint(x: rect.width, y: rect.height))
        path.addLine(to: CGPoint(x: 0, y: rect.height))
        path.closeSubpath()
        
        return path
    }
}

// ============================================================================
// MARK: - 1. UPCOMING EVENTS & TODOS WIDGET (Medium/Large)
// ============================================================================

struct UpcomingTimelineEntry: TimelineEntry {
    let date: Date
    let items: [UpcomingItem]
}

struct UpcomingTimelineProvider: TimelineProvider {
    typealias Entry = UpcomingTimelineEntry
    
    func placeholder(in context: Context) -> UpcomingTimelineEntry {
        UpcomingTimelineEntry(date: Date(), items: sampleUpcomingItems)
    }
    
    func getSnapshot(in context: Context, completion: @escaping (UpcomingTimelineEntry) -> Void) {
        let items = WidgetDataProvider.shared.getUpcomingItems()
        let entry = UpcomingTimelineEntry(date: Date(), items: items.isEmpty ? sampleUpcomingItems : items)
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<UpcomingTimelineEntry>) -> Void) {
        let items = WidgetDataProvider.shared.getUpcomingItems()
        let entry = UpcomingTimelineEntry(date: Date(), items: items)
        
        // Update every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
    
    private var sampleUpcomingItems: [UpcomingItem] {
        [
            UpcomingItem(id: "1", title: "Client Meeting", subtitle: "Zoom Call", time: Date().addingTimeInterval(3600), type: .event, color: "#4A90D9"),
            UpcomingItem(id: "2", title: "Review Final Cut", subtitle: "Project Alpha", time: Date().addingTimeInterval(7200), type: .todo, priority: "high"),
            UpcomingItem(id: "3", title: "Export Deliverables", subtitle: nil, time: Date().addingTimeInterval(10800), type: .todo, priority: "medium"),
        ]
    }
}

struct UpcomingWidget: Widget {
    let kind = "PostHiveUpcomingWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: UpcomingTimelineProvider()) { entry in
            UpcomingWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    Image("DefaultThumbnail")
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                }
        }
        .contentMarginsDisabled()
        .configurationDisplayName("Upcoming")
        .description("View your upcoming events and tasks")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct UpcomingWidgetView: View {
    var entry: UpcomingTimelineEntry
    
    @Environment(\.widgetFamily) var family
    
    // Split items into events and todos
    var events: [UpcomingItem] {
        entry.items.filter { $0.type == .event }
    }
    
    var todos: [UpcomingItem] {
        entry.items.filter { $0.type == .todo }
    }
    
    var workspaceName: String? {
        WidgetDataProvider.shared.getWorkspaceName()
    }
    
    var body: some View {
        ZStack {
            // Dark overlay for readability
            Color.black.opacity(0.5)
            
            VStack(alignment: .leading, spacing: 0) {
                // Header
                HStack {
                    if family == .systemLarge, let workspaceName = workspaceName {
                        Text("POSTHIVE | \(workspaceName.uppercased())")
                            .font(.system(size: 14, weight: .black))
                            .foregroundColor(.white)
                    } else {
                        Text("POSTHIVE")
                            .font(.system(size: family == .systemLarge ? 14 : 12, weight: .black))
                            .foregroundColor(.white)
                    }
                
                Spacer()
                
                Text(formatHeaderDate(Date()))
                    .font(.system(size: family == .systemLarge ? 12 : 10, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.5))
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 10)
            
            // Content
            if entry.items.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    VStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 24))
                            .foregroundColor(Color.white.opacity(0.3))
                        Text("All clear!")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.5))
                    }
                    Spacer()
                }
                Spacer()
            } else if family == .systemLarge {
                // LARGE: Top/Bottom layout
                VStack(alignment: .leading, spacing: 0) {
                    // TOP: Events
                    VStack(alignment: .leading, spacing: 8) {
                        if events.isEmpty {
                            Text("No upcoming events")
                                .font(.system(size: 13))
                                .foregroundColor(Color.white.opacity(0.3))
                                .italic()
                        } else {
                            ForEach(Array(events.prefix(3))) { event in
                                EventRowLarge(item: event)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    
                    // Divider
                    Rectangle()
                        .fill(Color.white.opacity(0.1))
                        .frame(height: 1)
                        .padding(.vertical, 12)
                    
                    // BOTTOM: Tasks
                    VStack(alignment: .leading, spacing: 0) {
                        if todos.isEmpty {
                            Text("No pending tasks")
                                .font(.system(size: 13))
                                .foregroundColor(Color.white.opacity(0.3))
                                .italic()
                        } else {
                            ForEach(Array(todos.prefix(4))) { todo in
                                TodoRowLarge(item: todo)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 4)
                .padding(.vertical, 5)
                .padding(.bottom, 12)
            } else {
                // MEDIUM: Left/Right layout
                HStack(alignment: .top, spacing: 4) {
                    // LEFT: Events
                    VStack(alignment: .leading, spacing: 4) {
                        if events.isEmpty {
                            Text("No events")
                                .font(.system(size: 11))
                                .foregroundColor(Color.white.opacity(0.3))
                                .italic()
                        } else {
                            ForEach(Array(events.prefix(3))) { event in
                                EventRow(item: event)
                            }
                        }
                        
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    
                    // Divider
                    Rectangle()
                        .fill(Color.white.opacity(0.1))
                        .frame(width: 1)
                        .padding(.vertical, 3)
                    
                    // RIGHT: Tasks
                    VStack(alignment: .leading, spacing: 6) {
                        if todos.isEmpty {
                            Text("No tasks")
                                .font(.system(size: 11))
                                .foregroundColor(Color.white.opacity(0.3))
                                .italic()
                        } else {
                            ForEach(Array(todos.prefix(4))) { todo in
                                TodoRow(item: todo)
                            }
                        }
                        
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
            }
            }
        }
        .widgetURL(URL(string: "posthive://calendar"))
    }
    
    func formatHeaderDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }
}

// Event row for MEDIUM widget - compact, styled like calendar screen
struct EventRow: View {
    let item: UpcomingItem
    
    var body: some View {
        HStack(spacing: 5) {
            // Blue border left - no border radius, matching calendar screen
            Rectangle()
                .fill(Color(red: 0.23, green: 0.51, blue: 0.96)) // #3b82f6 blue
                .frame(width: 3, height: 28)
            
            VStack(alignment: .leading, spacing: 1) {
                Text(item.title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                
                if let time = item.time {
                    Text(formatTime(time))
                        .font(.system(size: 10))
                        .foregroundColor(Color.white.opacity(0.5))
                }
            }
        }
    }
    
    func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            formatter.dateFormat = "h:mm a"
        } else if calendar.isDateInTomorrow(date) {
            formatter.dateFormat = "'Tomorrow'"
        } else {
            formatter.dateFormat = "MMM d"
        }
        return formatter.string(from: date)
    }
}

// Event row for LARGE widget - bigger fonts, styled like calendar screen
struct EventRowLarge: View {
    let item: UpcomingItem
    
    var body: some View {
        HStack(spacing: 6) {
            // Blue border left - no border radius, matching calendar screen
            Rectangle()
                .fill(Color(red: 0.23, green: 0.51, blue: 0.96)) // #3b82f6 blue
                .frame(width: 4, height: 34)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                
                if let time = item.time {
                    Text(formatTime(time))
                        .font(.system(size: 11))
                        .foregroundColor(Color.white.opacity(0.5))
                }
            }
            
            Spacer()
        }
        .padding(.vertical, 2)
        .padding(.horizontal, 4)
    }
    
    func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            formatter.dateFormat = "'Today' h:mm a"
        } else if calendar.isDateInTomorrow(date) {
            formatter.dateFormat = "'Tomorrow' h:mm a"
        } else {
            formatter.dateFormat = "EEE, MMM d"
        }
        return formatter.string(from: date)
    }
}

// Todo row for MEDIUM widget - compact pill style
struct TodoRow: View {
    let item: UpcomingItem
    
    var body: some View {
        HStack(spacing: 6) {
            // Checkbox
            RoundedRectangle(cornerRadius: 3)
                .stroke(Color.white.opacity(0.4), lineWidth: 1.5)
                .frame(width: 14, height: 14)
            
            Text(capitalizeFirst(item.title))
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.white)
                .lineLimit(1)
        }
        .padding(.vertical, 2)
        .padding(.horizontal, 6)
    }
}

// Todo row for LARGE widget - card style with due date
struct TodoRowLarge: View {
    let item: UpcomingItem
    
    var body: some View {
        HStack(spacing: 8) {
            // Checkbox
            RoundedRectangle(cornerRadius: 4)
                .stroke(Color.white.opacity(0.4), lineWidth: 2)
                .frame(width: 18, height: 18)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(capitalizeFirst(item.title))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(1)
                
                if let time = item.time {
                    Text(formatTime(time))
                        .font(.system(size: 10))
                        .foregroundColor(Color.white.opacity(0.5))
                }
            }
            
            Spacer()
        }
        .padding(.vertical, 5)
        .padding(.horizontal, 5)
    }
    
    func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            formatter.dateFormat = "'Today' h:mm a"
        } else if calendar.isDateInTomorrow(date) {
            formatter.dateFormat = "'Tomorrow'"
        } else {
            formatter.dateFormat = "MMM d"
        }
        return formatter.string(from: date)
    }
}


// ============================================================================
// MARK: - 2. LATEST DELIVERABLE WIDGET (Small)
// ============================================================================

struct DeliverableTimelineEntry: TimelineEntry {
    let date: Date
    let deliverable: DeliverableSnapshot?
}

struct DeliverableTimelineProvider: TimelineProvider {
    typealias Entry = DeliverableTimelineEntry
    
    func placeholder(in context: Context) -> DeliverableTimelineEntry {
        DeliverableTimelineEntry(date: Date(), deliverable: sampleDeliverable)
    }
    
    func getSnapshot(in context: Context, completion: @escaping (DeliverableTimelineEntry) -> Void) {
        let deliverable = WidgetDataProvider.shared.getLatestDeliverable()
        let entry = DeliverableTimelineEntry(date: Date(), deliverable: deliverable ?? sampleDeliverable)
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<DeliverableTimelineEntry>) -> Void) {
        let deliverable = WidgetDataProvider.shared.getLatestDeliverable()
        let entry = DeliverableTimelineEntry(date: Date(), deliverable: deliverable)
        
        // Update every 30 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
    
    private var sampleDeliverable: DeliverableSnapshot {
        DeliverableSnapshot(
            id: "sample",
            name: "Final Export v2",
            projectName: "Client Project",
            thumbnailUrl: nil,
            unreadCommentCount: 3,
            updatedAt: Date()
        )
    }
}

struct DeliverableWidget: Widget {
    let kind = "PostHiveDeliverableWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DeliverableTimelineProvider()) { entry in
            DeliverableWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    Image("DefaultThumbnail")
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                }
        }
        // iOS 18 deployment target for this extension → safe to disable system content margins
        // so the thumbnail can be truly edge-to-edge.
        .contentMarginsDisabled()
        .configurationDisplayName("Latest Review")
        .description("See your latest deliverable and unread comments")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct DeliverableWidgetView: View {
    var entry: DeliverableTimelineEntry
    
    @Environment(\.widgetFamily) var family
    
    var body: some View {
        Group {
            if let deliverable = entry.deliverable {
                if family == .systemSmall {
                    SmallDeliverableContent(deliverable: deliverable)
                } else {
                    MediumDeliverableContent(deliverable: deliverable)
                }
            } else {
                // Empty state
                VStack(spacing: 8) {
                    Image(systemName: "film.stack")
                        .font(.system(size: 28))
                        .foregroundColor(Color.white.opacity(0.3))
                    Text("No deliverables")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.5))
                }
            }
        }
        .widgetURL(entry.deliverable != nil ? URL(string: "posthive://deliverable/\(entry.deliverable!.id)") : URL(string: "posthive://deliverables"))
    }
}

struct SmallDeliverableContent: View {
    let deliverable: DeliverableSnapshot
    
    // Get cached thumbnail from App Group - ensure we use the correct deliverable ID
    var cachedThumbnail: UIImage? {
        // Always use the deliverable ID from the snapshot to ensure we get the correct thumbnail
        WidgetDataProvider.shared.getCachedThumbnailImage(for: deliverable.id)
    }
    
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                // Full-bleed thumbnail - try cache first, then URL
                if let uiImage = cachedThumbnail {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: geo.size.width, height: geo.size.height)
                        .clipped()
                } else if let thumbnailUrl = deliverable.thumbnailUrl, let url = URL(string: thumbnailUrl) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: geo.size.width, height: geo.size.height)
                                .clipped()
                        case .failure(_), .empty:
                            placeholderView
                        @unknown default:
                            placeholderView
                        }
                    }
                } else {
                    placeholderView
                }
                
                // Dark overlay over entire thumbnail
                Color.black.opacity(0.35)
                    .frame(width: geo.size.width, height: geo.size.height)
                
                // Bottom gradient overlay
                LinearGradient(
                    colors: [
                        .clear,
                        Color.black.opacity(0.3),
                        Color.black.opacity(0.85)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: geo.size.height * 0.6)
                
                // Content overlay (re-add comfortable padding even though content margins are disabled)
                VStack(alignment: .leading, spacing: 3) {
                    Spacer()
                    
                    // Title with version
                    HStack(spacing: 6) {
                        Text(deliverable.name)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .shadow(color: .black.opacity(0.5), radius: 2, x: 0, y: 1)
                        
                        if let version = deliverable.currentVersion {
                            Text(version == 100 ? "Final" : "V\(version)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white.opacity(0.7))
                                .shadow(color: .black.opacity(0.5), radius: 2, x: 0, y: 1)
                        }
                    }
                    
                    // Project name
                    if let projectName = deliverable.projectName {
                        Text(projectName)
                            .font(.system(size: 10))
                            .foregroundColor(.white.opacity(0.7))
                            .lineLimit(1)
                            .shadow(color: .black.opacity(0.5), radius: 2, x: 0, y: 1)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.bottom, 10)
                
                // Unread comment badge - top right
                if deliverable.unreadCommentCount > 0 {
                    VStack {
                        HStack {
                            Spacer()
                            ZStack {
                                Circle()
                                    .fill(PostHiveColors.commentBadge)
                                    .frame(width: 20, height: 20)
                                    .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 1)
                                
                                Text("\(min(deliverable.unreadCommentCount, 99))")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundColor(.white)
                            }
                            .padding(10)
                        }
                        Spacer()
                    }
                }
            }
        }
    }
    
    var placeholderView: some View {
        Image("DefaultThumbnail")
            .resizable()
            .aspectRatio(contentMode: .fill)
    }
}

struct MediumDeliverableContent: View {
    let deliverable: DeliverableSnapshot
    
    // Get cached thumbnail from App Group - ensure we use the correct deliverable ID
    var cachedThumbnail: UIImage? {
        // Always use the deliverable ID from the snapshot to ensure we get the correct thumbnail
        WidgetDataProvider.shared.getCachedThumbnailImage(for: deliverable.id)
    }
    
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottomLeading) {
                // Full-bleed thumbnail - try cache first, then URL
                if let uiImage = cachedThumbnail {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: geo.size.width, height: geo.size.height)
                        .clipped()
                } else if let thumbnailUrl = deliverable.thumbnailUrl, let url = URL(string: thumbnailUrl) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: geo.size.width, height: geo.size.height)
                                .clipped()
                        case .failure(_), .empty:
                            placeholderView
                        @unknown default:
                            placeholderView
                        }
                    }
                } else {
                    placeholderView
                }
                
                // Dark overlay over entire thumbnail
                Color.black.opacity(0.35)
                    .frame(width: geo.size.width, height: geo.size.height)
                
                // Bottom gradient overlay
                LinearGradient(
                    colors: [
                        .clear,
                        Color.black.opacity(0.4),
                        Color.black.opacity(0.9)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: geo.size.height * 0.65)
                
                // Content overlay
                VStack(alignment: .leading, spacing: 4) {
                    Spacer()
                    
                    // Title with version
                    HStack(spacing: 8) {
                        Text(deliverable.name)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .shadow(color: .black.opacity(0.5), radius: 2, x: 0, y: 1)
                        
                        if let version = deliverable.currentVersion {
                            Text(version == 100 ? "Final" : "V\(version)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white.opacity(0.7))
                                .shadow(color: .black.opacity(0.5), radius: 2, x: 0, y: 1)
                        }
                    }
                    
                    // Project name
                    if let projectName = deliverable.projectName {
                        Text(projectName)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.white.opacity(0.7))
                            .lineLimit(1)
                            .shadow(color: .black.opacity(0.5), radius: 2, x: 0, y: 1)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
                
                // Unread comment badge - top right (for visibility)
                if deliverable.unreadCommentCount > 0 {
                    VStack {
                        HStack {
                            Spacer()
                            ZStack {
                                Circle()
                                    .fill(PostHiveColors.commentBadge)
                                    .frame(width: 22, height: 22)
                                    .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 1)
                                
                                Text("\(min(deliverable.unreadCommentCount, 99))")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.white)
                            }
                            .padding(12)
                        }
                        Spacer()
                    }
                }
            }
        }
    }
    
    var placeholderView: some View {
        Image("DefaultThumbnail")
            .resizable()
            .aspectRatio(contentMode: .fill)
    }
}

// ============================================================================
// MARK: - 3. ACTIVE TRANSFER WIDGET (Small)
// ============================================================================

struct TransferTimelineEntry: TimelineEntry {
    let date: Date
    let transfer: TransferProgress?
    let recentTransfers: [RecentTransferItem]
}

struct TransferTimelineProvider: TimelineProvider {
    typealias Entry = TransferTimelineEntry
    
    func placeholder(in context: Context) -> TransferTimelineEntry {
        TransferTimelineEntry(date: Date(), transfer: sampleTransfer, recentTransfers: sampleRecentTransfers)
    }
    
    func getSnapshot(in context: Context, completion: @escaping (TransferTimelineEntry) -> Void) {
        let transfer = WidgetDataProvider.shared.getActiveTransfer()
        let recentTransfers = WidgetDataProvider.shared.getRecentTransfers()
        let entry = TransferTimelineEntry(
            date: Date(),
            transfer: transfer ?? sampleTransfer,
            recentTransfers: recentTransfers.isEmpty ? sampleRecentTransfers : recentTransfers
        )
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<TransferTimelineEntry>) -> Void) {
        let transfer = WidgetDataProvider.shared.getActiveTransfer()
        let recentTransfers = WidgetDataProvider.shared.getRecentTransfers()
        let entry = TransferTimelineEntry(date: Date(), transfer: transfer, recentTransfers: recentTransfers)
        
        // Update more frequently during active transfer
        let minutes = transfer != nil ? 1 : 15
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: minutes, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
    
    private var sampleTransfer: TransferProgress {
        TransferProgress(
            id: "sample",
            fileName: "Final_Export_v2.mov",
            progress: 0.67,
            bytesTransferred: 1_500_000_000,
            totalBytes: 2_240_000_000,
            isUpload: true,
            startedAt: Date().addingTimeInterval(-300)
        )
    }

    private var sampleRecentTransfers: [RecentTransferItem] {
        [
            RecentTransferItem(id: "t1", fileName: "Final_Export_v3.mov", isUpload: true, completedAt: Date().addingTimeInterval(-300)),
            RecentTransferItem(id: "t2", fileName: "Client_Feedback.pdf", isUpload: false, completedAt: Date().addingTimeInterval(-900)),
            RecentTransferItem(id: "t3", fileName: "BehindTheScenes.zip", isUpload: true, completedAt: Date().addingTimeInterval(-1800)),
        ]
    }
}

struct TransferWidget: Widget {
    let kind = "PostHiveTransferWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TransferTimelineProvider()) { entry in
            TransferWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    Image("DefaultThumbnail")
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                }
        }
        .contentMarginsDisabled()
        .configurationDisplayName("Transfer")
        .description("Monitor your current file transfer")
        .supportedFamilies([.systemSmall])
    }
}

struct TransferWidgetView: View {
    var entry: TransferTimelineEntry
    
    var body: some View {
        Group {
            if let transfer = entry.transfer {
                ActiveTransferContent(transfer: transfer)
            } else {
                NoTransferContent(recentTransfers: entry.recentTransfers)
            }
        }
        .widgetURL(URL(string: "posthive://transfers"))
    }
}

struct ActiveTransferContent: View {
    let transfer: TransferProgress
    
    var body: some View {
        ZStack {
            // Dark overlay for readability
            Color.black.opacity(0.5)
            
            VStack(alignment: .leading, spacing: 6) {
            // Header
            HStack {
                Image(systemName: transfer.isUpload ? "arrow.up.circle.fill" : "arrow.down.circle.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.white)
                
                Text(transfer.isUpload ? "UPLOADING" : "DOWNLOADING")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(Color.white.opacity(0.5))
                    .tracking(0.5)
                
                Spacer()
            }
            .padding(.horizontal, 3)
            .padding(.top, 3)
            
            Spacer()
            
            // Circular progress
            HStack {
                Spacer()
                
                ZStack {
                    // Background circle
                    Circle()
                        .stroke(Color.white.opacity(0.15), lineWidth: 6)
                        .frame(width: 60, height: 60)
                    
                    // Progress arc - white
                    Circle()
                        .trim(from: 0, to: CGFloat(transfer.progress))
                        .stroke(
                            Color.white,
                            style: StrokeStyle(lineWidth: 6, lineCap: .round)
                        )
                        .frame(width: 60, height: 60)
                        .rotationEffect(.degrees(-90))
                    
                    // Percentage
                    Text("\(Int(transfer.progress * 100))%")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                
                Spacer()
            }
            
            Spacer()
            
            // File info
            VStack(alignment: .leading, spacing: 2) {
                Text(transfer.fileName)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                
                Text(formatBytes(transfer.bytesTransferred) + " / " + formatBytes(transfer.totalBytes))
                    .font(.system(size: 9))
                    .foregroundColor(Color.white.opacity(0.5))
            }
            .padding(.horizontal, 3)
            .padding(.bottom, 3)
            }
        }
    }
    
    func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

struct NoTransferContent: View {
    let recentTransfers: [RecentTransferItem]

    var body: some View {
        ZStack {
            // Dark overlay for readability
            Color.black.opacity(0.5)
            
            VStack(alignment: .leading, spacing: 6) {
            // Header
            HStack {
                Text("POSTHIVE")
                    .font(.system(size: 12, weight: .black))
                    .foregroundColor(.white)
                
                Spacer()
            }
            .padding(.horizontal, 8)
            .padding(.top, 8)
            
            if recentTransfers.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "arrow.up.arrow.down.circle")
                            .font(.system(size: 28))
                            .foregroundColor(Color.white.opacity(0.3))

                        Text("No active transfer")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.5))
                    }
                    Spacer()
                }
                Spacer()
            } else {
                VStack(alignment: .leading, spacing: 3) {
                    Text("LAST 5")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(Color.white.opacity(0.45))
                        .tracking(0.5)

                    ForEach(Array(recentTransfers.prefix(5))) { item in
                        HStack(spacing: 5) {
                            Image(systemName: item.isUpload ? "arrow.up.right" : "arrow.down.right")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundColor(Color.white.opacity(0.55))

                            Text(item.fileName)
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundColor(.white)
                                .lineLimit(1)

                            Spacer(minLength: 0)
                        }
                    }
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 8)
            }
            }
        }
    }
}

// ============================================================================
// MARK: - 4. ACTIVITY FEED WIDGET (Small, Medium, Large)
// ============================================================================

struct ActivityTimelineEntry: TimelineEntry {
    let date: Date
    let activities: [ActivityItem]
}

struct ActivityTimelineProvider: TimelineProvider {
    typealias Entry = ActivityTimelineEntry
    
    func placeholder(in context: Context) -> ActivityTimelineEntry {
        ActivityTimelineEntry(date: Date(), activities: sampleActivities)
    }
    
    func getSnapshot(in context: Context, completion: @escaping (ActivityTimelineEntry) -> Void) {
        let activities = WidgetDataProvider.shared.getActivityFeed()
        let entry = ActivityTimelineEntry(date: Date(), activities: activities.isEmpty ? sampleActivities : activities)
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<ActivityTimelineEntry>) -> Void) {
        let activities = WidgetDataProvider.shared.getActivityFeed()
        let entry = ActivityTimelineEntry(date: Date(), activities: activities)
        
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
    
    private var sampleActivities: [ActivityItem] {
        [
            ActivityItem(id: "1", type: .upload, title: "Final Cut v3", subtitle: "Wedding Project", timestamp: Date().addingTimeInterval(-300), userName: "Sarah"),
            ActivityItem(id: "2", type: .comment, title: "Great work on the intro!", subtitle: "Client Promo", timestamp: Date().addingTimeInterval(-1200), userName: "John"),
            ActivityItem(id: "3", type: .approval, title: "Approved", subtitle: "Brand Video v2", timestamp: Date().addingTimeInterval(-3600), userName: "Mike"),
            ActivityItem(id: "4", type: .revision, title: "Revision requested", subtitle: "Product Demo", timestamp: Date().addingTimeInterval(-7200), userName: "Lisa"),
        ]
    }
}

struct ActivityWidget: Widget {
    let kind = "PostHiveActivityWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ActivityTimelineProvider()) { entry in
            ActivityWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    Image("DefaultThumbnail")
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                }
        }
        .contentMarginsDisabled()
        .configurationDisplayName("Activity Feed")
        .description("Recent uploads, comments, and approvals")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct ActivityWidgetView: View {
    var entry: ActivityTimelineEntry
    @Environment(\.widgetFamily) var family
    
    var body: some View {
        ZStack {
            // Dark overlay for readability
            Color.black.opacity(0.5)
            
            VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("POSTHIVE")
                    .font(.system(size: family == .systemLarge ? 14 : 12, weight: .black))
                    .foregroundColor(.white)
                
                Spacer()
                
                Text("ACTIVITY")
                    .font(.system(size: family == .systemLarge ? 11 : 10, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.5))
                    .tracking(0.5)
            }
            .padding(.horizontal, family == .systemLarge ? 12 : 10)
            .padding(.top, family == .systemLarge ? 10 : 8)
            .padding(.bottom, family == .systemLarge ? 8 : 6)
            
            if entry.activities.isEmpty {
                EmptyActivityView()
            } else {
                activityList
            }
            }
        }
        .widgetURL(URL(string: "posthive://activity"))
    }
    
    private var activityList: some View {
        let maxItems = itemCount
        let items = Array(entry.activities.prefix(maxItems))
        
        return VStack(alignment: .leading, spacing: family == .systemLarge ? 6 : (family == .systemSmall ? 4 : 3)) {
            ForEach(items) { activity in
                ActivityRow(activity: activity, compact: family == .systemSmall)
                
                if activity.id != items.last?.id {
                    Divider()
                        .background(Color.white.opacity(0.1))
                        .padding(.vertical, family == .systemLarge ? 2 : 0)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, family == .systemLarge ? 12 : 10)
        .padding(.bottom, family == .systemLarge ? 10 : 8)
    }
    
    private var itemCount: Int {
        switch family {
        case .systemSmall: return 3
        case .systemMedium: return 5
        case .systemLarge: return 12
        default: return 4
        }
    }
}

struct ActivityRow: View {
    let activity: ActivityItem
    let compact: Bool
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            // Content
            VStack(alignment: .leading, spacing: 2) {
                Text(activity.title)
                    .font(.system(size: compact ? 12 : 13, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(compact ? 2 : 2)
                
                // Secondary line: subtitle or user
                HStack(spacing: 4) {
                    if let subtitle = activity.subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.system(size: compact ? 10 : 11))
                            .foregroundColor(Color.white.opacity(0.55))
                            .lineLimit(1)
                    } else if let userName = activity.userName, !userName.isEmpty {
                        Text(userName)
                            .font(.system(size: compact ? 10 : 11, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.45))
                            .lineLimit(1)
                    }
                    
                    // Timestamp
                    Text(formatTimestamp(activity.timestamp))
                        .font(.system(size: compact ? 9 : 10))
                        .foregroundColor(Color.white.opacity(0.4))
                        .lineLimit(1)
                }
            }
            
            Spacer()
        }
        .padding(.vertical, compact ? 2 : 3)
    }
    
    func formatTimestamp(_ date: Date) -> String {
        let now = Date()
        let timeInterval = now.timeIntervalSince(date)
        
        if timeInterval < 60 {
            return "now"
        } else if timeInterval < 3600 {
            let minutes = Int(timeInterval / 60)
            return "\(minutes)m"
        } else if timeInterval < 86400 {
            let hours = Int(timeInterval / 3600)
            return "\(hours)h"
        } else {
            let days = Int(timeInterval / 86400)
            if days == 1 {
                return "1d"
            } else if days < 7 {
                return "\(days)d"
            } else {
                let formatter = DateFormatter()
                formatter.dateFormat = "MMM d"
                return formatter.string(from: date)
            }
        }
    }
}

struct EmptyActivityView: View {
    var body: some View {
        VStack(spacing: 8) {
            Spacer()
            
            Image(systemName: "bell.slash")
                .font(.system(size: 28))
                .foregroundColor(Color.white.opacity(0.3))
            
            Text("No recent activity")
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(Color.white.opacity(0.5))
            
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

// ============================================================================
// MARK: - Widget Previews
// ============================================================================

#if DEBUG
@available(iOS 17.0, *)
#Preview("Upcoming - Medium", as: .systemMedium) {
    UpcomingWidget()
} timeline: {
    UpcomingTimelineEntry(date: Date(), items: [
        UpcomingItem(id: "1", title: "Client Review Call", subtitle: "Zoom", time: Date().addingTimeInterval(1800), type: .event, color: "#4A90D9"),
        UpcomingItem(id: "2", title: "Export Final Cut", subtitle: "Wedding Film", time: Date().addingTimeInterval(5400), type: .todo, priority: "urgent"),
        UpcomingItem(id: "3", title: "Color Grade Session", subtitle: nil, time: Date().addingTimeInterval(9000), type: .todo, priority: "high"),
    ])
}

@available(iOS 17.0, *)
#Preview("Deliverable - Small", as: .systemSmall) {
    DeliverableWidget()
} timeline: {
    DeliverableTimelineEntry(date: Date(), deliverable: DeliverableSnapshot(
        id: "1",
        name: "Final Export v2",
        projectName: "Wedding Film",
        thumbnailUrl: nil,
        unreadCommentCount: 5,
        updatedAt: Date()
    ))
}

@available(iOS 17.0, *)
#Preview("Transfer - Small", as: .systemSmall) {
    TransferWidget()
} timeline: {
    TransferTimelineEntry(date: Date(), transfer: TransferProgress(
        id: "1",
        fileName: "4K_Export_Final.mov",
        progress: 0.45,
        bytesTransferred: 1_200_000_000,
        totalBytes: 2_700_000_000,
        isUpload: true,
        startedAt: Date()
    ), recentTransfers: [])
}
#endif

