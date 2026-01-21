//
//  TaskLiveActivityWidget.swift
//  TaskLiveActivityWidget
//

import ActivityKit
import WidgetKit
import SwiftUI
import AppIntents
import Foundation

// Activity Attributes - MUST match exactly what's in LiveActivityModule.swift
struct TaskActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var taskId: String
        var title: String
        var projectName: String?
        var startTime: Date
        var endTime: Date
        var estimatedMinutes: Int
        var priority: String
        var remainingSeconds: Int
    }
    
    var taskId: String
    var title: String
    var projectName: String?
    var estimatedMinutes: Int
    var priority: String
}

// MARK: - App Intents for Live Activity Buttons

@available(iOS 16.1, *)
struct CompleteTaskIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Complete Task"
    static var description = IntentDescription("Mark the current task as completed")
    
    // This opens the app when the intent runs
    static var openAppWhenRun: Bool = true
    
    @Parameter(title: "Task ID")
    var taskId: String
    
    init() {
        self.taskId = ""
    }
    
    init(taskId: String) {
        self.taskId = taskId
    }
    
    func perform() async throws -> some IntentResult {
        // Store the action in UserDefaults (shared via App Group)
        // The app will read this when it opens (openAppWhenRun ensures app opens)
        if let defaults = UserDefaults(suiteName: "group.com.posthive.companion") {
            defaults.set(taskId, forKey: "pendingCompleteTaskId")
            defaults.set(Date().timeIntervalSince1970, forKey: "pendingCompleteTaskTimestamp")
            defaults.synchronize()
        }
        
        return .result()
    }
}

@available(iOS 16.1, *)
struct PauseTaskIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Pause Task"
    static var description = IntentDescription("Pause the current task")
    
    @Parameter(title: "Task ID")
    var taskId: String
    
    init() {
        self.taskId = ""
    }
    
    init(taskId: String) {
        self.taskId = taskId
    }
    
    func perform() async throws -> some IntentResult {
        if let url = URL(string: "posthive://task/pause/\(taskId)") {
            NotificationCenter.default.post(
                name: NSNotification.Name("PauseTask"),
                object: nil,
                userInfo: ["taskId": taskId]
            )
        }
        return .result()
    }
}

@available(iOS 16.1, *)
struct AddTimeIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Add 15 Minutes"
    static var description = IntentDescription("Add 15 minutes to the current task")
    
    @Parameter(title: "Task ID")
    var taskId: String
    
    init() {
        self.taskId = ""
    }
    
    init(taskId: String) {
        self.taskId = taskId
    }
    
    func perform() async throws -> some IntentResult {
        NotificationCenter.default.post(
            name: NSNotification.Name("AddTimeTask"),
            object: nil,
            userInfo: ["taskId": taskId, "minutes": 15]
        )
        return .result()
    }
}

@available(iOS 16.1, *)
struct TaskLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TaskActivityAttributes.self) { context in
            // Lock screen/banner UI
            LockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI - Logo left, Timer right
                DynamicIslandExpandedRegion(.leading) {
                    Image("PostHiveLogo")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 36, height: 36)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: context.state.startTime...context.state.endTime, countsDown: true)
                        .font(.system(size: 28, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .monospacedDigit()
                }
                
                // Title and button in bottom region (not full width)
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 10) {
                        // Task title - constrained width
                        VStack(alignment: .leading, spacing: 2) {
                            Text(context.attributes.title)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(.white)
                                .lineLimit(2)
                                .frame(maxWidth: 280, alignment: .leading)
                            
                            if let projectName = context.attributes.projectName {
                                Text(projectName)
                                    .font(.system(size: 12))
                                    .foregroundColor(.white.opacity(0.6))
                                    .lineLimit(1)
                                    .frame(maxWidth: 280, alignment: .leading)
                            }
                        }
                        
                        // Complete button - constrained width
                        Button(intent: CompleteTaskIntent(taskId: context.attributes.taskId)) {
                            HStack(spacing: 6) {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 12, weight: .bold))
                                Text("Complete Task")
                                    .font(.system(size: 13, weight: .semibold))
                            }
                            .foregroundColor(.black)
                            .frame(maxWidth: 280)
                            .padding(.vertical, 12)
                            .background(Color.white)
                            .cornerRadius(12)
                        }
                        .buttonStyle(.plain)
                    }
                    .frame(maxWidth: 280)
                }
            } compactLeading: {
                // Compact leading - "PH" text (bold, minimal width)
                Text("PH")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 24, alignment: .leading)
                    .padding(.leading, 2)
            } compactTrailing: {
                // Compact trailing - Time remaining (minimal width, right-aligned)
                Text(timerInterval: context.state.startTime...context.state.endTime, countsDown: true)
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundColor(.white)
                    .monospacedDigit()
                    .frame(minWidth: 44, alignment: .trailing)
                    .padding(.trailing, 2)
            } minimal: {
                // Minimal - Just the logo
                Image("PostHiveLogo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 18, height: 18)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
        }
    }
}

// MARK: - Lock Screen View (Tasks)
@available(iOS 16.1, *)
struct LockScreenView: View {
    let context: ActivityViewContext<TaskActivityAttributes>
    
    var body: some View {
        HStack(spacing: 12) {
            // PostHive logo
            Image("PostHiveLogo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 40, height: 40)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            
            // Task info
            VStack(alignment: .leading, spacing: 3) {
                Text(context.attributes.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                
                if let projectName = context.attributes.projectName {
                    Text(projectName)
                        .font(.system(size: 11))
                        .foregroundColor(.white.opacity(0.6))
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
            // Live countdown timer
            Text(timerInterval: context.state.startTime...context.state.endTime, countsDown: true)
                .font(.system(size: 24, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
                .monospacedDigit()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color.black)
    }
}

// ===== EVENT LIVE ACTIVITY =====

// Event Activity Attributes - MUST match exactly what's in LiveActivityModule.swift
struct EventActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var eventId: String
        var title: String
        var location: String?
        var startTime: Date
        var endTime: Date
        var isUpcoming: Bool
        var remainingSeconds: Int
        var calendarColor: String
    }
    
    var eventId: String
    var title: String
    var location: String?
    var calendarColor: String
}

// Helper to convert hex to SwiftUI Color
@available(iOS 16.1, *)
func colorFromHex(_ hex: String) -> Color {
    var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
    
    var rgb: UInt64 = 0
    Scanner(string: hexSanitized).scanHexInt64(&rgb)
    
    let r = Double((rgb & 0xFF0000) >> 16) / 255.0
    let g = Double((rgb & 0x00FF00) >> 8) / 255.0
    let b = Double(rgb & 0x0000FF) / 255.0
    
    return Color(red: r, green: g, blue: b)
}

@available(iOS 16.1, *)
struct EventLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EventActivityAttributes.self) { context in
            // Lock screen/banner UI for events
            EventLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI
                DynamicIslandExpandedRegion(.leading) {
                    // Calendar icon with event color
                    ZStack {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(colorFromHex(context.attributes.calendarColor))
                            .frame(width: 36, height: 36)
                        Image(systemName: "calendar")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(.white)
                    }
                }
                
                DynamicIslandExpandedRegion(.trailing) {
                    // Countdown timer
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(context.state.isUpcoming ? "STARTS IN" : "ENDS IN")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white.opacity(0.6))
                        
                        if context.state.isUpcoming {
                            Text(timerInterval: Date()...context.state.startTime, countsDown: true)
                                .font(.system(size: 24, weight: .bold, design: .monospaced))
                                .foregroundColor(colorFromHex(context.attributes.calendarColor))
                                .monospacedDigit()
                        } else {
                            Text(timerInterval: Date()...context.state.endTime, countsDown: true)
                                .font(.system(size: 24, weight: .bold, design: .monospaced))
                                .foregroundColor(colorFromHex(context.attributes.calendarColor))
                                .monospacedDigit()
                        }
                    }
                }
                
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        // Event title
                        Text(context.attributes.title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.white)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        
                        // Location if available
                        if let location = context.attributes.location, !location.isEmpty {
                            HStack(spacing: 4) {
                                Image(systemName: "mappin.circle.fill")
                                    .font(.system(size: 11))
                                    .foregroundColor(colorFromHex(context.attributes.calendarColor))
                                Text(location)
                                    .font(.system(size: 12))
                                    .foregroundColor(.white.opacity(0.7))
                                    .lineLimit(1)
                            }
                        }
                        
                        // Time range
                        HStack(spacing: 4) {
                            Image(systemName: "clock")
                                .font(.system(size: 11))
                                .foregroundColor(.white.opacity(0.5))
                            Text("\(formatEventTime(context.state.startTime)) - \(formatEventTime(context.state.endTime))")
                                .font(.system(size: 12))
                                .foregroundColor(.white.opacity(0.6))
                        }
                    }
                }
            } compactLeading: {
                // Calendar icon
                ZStack {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(colorFromHex(context.attributes.calendarColor))
                        .frame(width: 20, height: 20)
                    Image(systemName: "calendar")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.white)
                }
                .padding(.leading, 4)
            } compactTrailing: {
                // Countdown
                if context.state.isUpcoming {
                    Text(timerInterval: Date()...context.state.startTime, countsDown: true)
                        .font(.system(size: 14, weight: .bold, design: .monospaced))
                        .foregroundColor(colorFromHex(context.attributes.calendarColor))
                        .monospacedDigit()
                        .frame(minWidth: 44)
                        .padding(.trailing, 4)
                } else {
                    Text(timerInterval: Date()...context.state.endTime, countsDown: true)
                        .font(.system(size: 14, weight: .bold, design: .monospaced))
                        .foregroundColor(colorFromHex(context.attributes.calendarColor))
                        .monospacedDigit()
                        .frame(minWidth: 44)
                        .padding(.trailing, 4)
                }
            } minimal: {
                // Just calendar icon
                ZStack {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(colorFromHex(context.attributes.calendarColor))
                        .frame(width: 18, height: 18)
                    Image(systemName: "calendar")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundColor(.white)
                }
            }
        }
    }
}

@available(iOS 16.1, *)
func formatEventTime(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "h:mm a"
    return formatter.string(from: date)
}

// MARK: - Lock Screen View (Events)
@available(iOS 16.1, *)
struct EventLockScreenView: View {
    let context: ActivityViewContext<EventActivityAttributes>
    
    var eventColor: Color {
        colorFromHex(context.attributes.calendarColor)
    }
    
    var body: some View {
        HStack(spacing: 12) {
            // Calendar icon with color
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(eventColor)
                    .frame(width: 44, height: 44)
                Image(systemName: "calendar")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
            }
            
            // Event info
            VStack(alignment: .leading, spacing: 3) {
                // Status label
                Text(context.state.isUpcoming ? "UPCOMING EVENT" : "NOW")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(eventColor)
                    .tracking(0.5)
                
                Text(context.attributes.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                
                // Time range
                Text("\(formatEventTime(context.state.startTime)) - \(formatEventTime(context.state.endTime))")
                    .font(.system(size: 11))
                    .foregroundColor(.white.opacity(0.6))
            }
            
            Spacer()
            
            // Countdown
            VStack(alignment: .trailing, spacing: 2) {
                Text(context.state.isUpcoming ? "Starts in" : "Ends in")
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.5))
                
                if context.state.isUpcoming {
                    Text(timerInterval: Date()...context.state.startTime, countsDown: true)
                        .font(.system(size: 22, weight: .bold, design: .monospaced))
                        .foregroundColor(eventColor)
                        .monospacedDigit()
                } else {
                    Text(timerInterval: Date()...context.state.endTime, countsDown: true)
                        .font(.system(size: 22, weight: .bold, design: .monospaced))
                        .foregroundColor(eventColor)
                        .monospacedDigit()
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color.black)
    }
}
