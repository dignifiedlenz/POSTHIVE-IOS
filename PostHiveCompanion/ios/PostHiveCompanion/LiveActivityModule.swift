import Foundation
import ActivityKit
import WidgetKit
import React

// Debug logging
private func logDebug(_ items: Any...) {
    #if DEBUG
    print("🟣 [LiveActivity Native]", items.map { "\($0)" }.joined(separator: " "))
    #endif
}

// Activity Attributes - defines the data structure for Live Activity
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

// Event Activity Attributes - for calendar events
struct EventActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var eventId: String
        var title: String
        var location: String?
        var startTime: Date
        var endTime: Date
        var isUpcoming: Bool  // true = counting down to start, false = event in progress
        var remainingSeconds: Int
        var calendarColor: String  // Hex color from calendar
    }
    
    var eventId: String
    var title: String
    var location: String?
    var calendarColor: String
}

// Transfer Activity Attributes - for file transfers from desktop
struct TransferActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var sessionId: String
        var transferName: String
        var projectName: String
        var totalFiles: Int
        var completedFiles: Int
        var progress: Double  // 0.0 to 1.0
        var currentFileName: String
        var totalBytes: Int64
        var bytesTransferred: Int64
        var deviceName: String
        var status: String  // "in_progress", "completed", "failed"
    }
    
    var sessionId: String
    var transferName: String
    var projectName: String
    var deviceName: String
}

@objc(LiveActivityModule)
class LiveActivityModule: RCTEventEmitter {
    
    private var hasListeners = false
    
    @objc
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return ["onTaskComplete", "onTaskPause", "onTaskAddTime"]
    }
    
    override func startObserving() {
        hasListeners = true
        
        // Listen for app becoming active to check for pending widget actions
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(checkPendingWidgetActions),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        
        // Check immediately when listeners start (for when app is already running)
        checkPendingWidgetActions()
        
        // Also check again after a short delay to catch any actions that happened right before listeners started
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.checkPendingWidgetActions()
        }
        
        // Check periodically while app is running (every 2 seconds) to catch widget actions
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            self?.startPeriodicCheck()
        }
        
        logDebug("Started observing Live Activity events")
    }
    
    override func stopObserving() {
        hasListeners = false
        NotificationCenter.default.removeObserver(self)
        logDebug("Stopped observing Live Activity events")
    }
    
    // Start periodic checking for pending actions (while app is running)
    private func startPeriodicCheck() {
        guard hasListeners else { return }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            guard let self = self, self.hasListeners else { return }
            self.checkPendingWidgetActions()
            self.startPeriodicCheck() // Continue checking
        }
    }
    
    // Check for pending actions from widget button presses
    @objc private func checkPendingWidgetActions() {
        guard hasListeners else { return }
        
        guard let defaults = UserDefaults(suiteName: "group.com.posthive.companion") else {
            logDebug("Could not access App Group UserDefaults")
            return
        }
        
        // Check for pending complete task action
        if let taskId = defaults.string(forKey: "pendingCompleteTaskId"),
           let timestamp = defaults.object(forKey: "pendingCompleteTaskTimestamp") as? Double {
            // Only process if it happened in the last 60 seconds (increased window)
            let actionTime = Date(timeIntervalSince1970: timestamp)
            let timeSinceAction = Date().timeIntervalSince(actionTime)
            if timeSinceAction < 60 {
                logDebug("Found pending complete task action:", taskId, "age:", String(format: "%.1f", timeSinceAction), "seconds")
                sendEvent(withName: "onTaskComplete", body: ["taskId": taskId])
                // Clear the pending action immediately after sending
                defaults.removeObject(forKey: "pendingCompleteTaskId")
                defaults.removeObject(forKey: "pendingCompleteTaskTimestamp")
                defaults.synchronize()
            } else {
                // Clear stale actions
                logDebug("Clearing stale complete task action (age:", String(format: "%.1f", timeSinceAction), "seconds)")
                defaults.removeObject(forKey: "pendingCompleteTaskId")
                defaults.removeObject(forKey: "pendingCompleteTaskTimestamp")
                defaults.synchronize()
            }
        }
        
        // Check for pending add time action  
        if let taskId = defaults.string(forKey: "pendingAddTimeTaskId"),
           let minutes = defaults.object(forKey: "pendingAddTimeMinutes") as? Int,
           let timestamp = defaults.object(forKey: "pendingAddTimeTimestamp") as? Double {
            let actionTime = Date(timeIntervalSince1970: timestamp)
            if Date().timeIntervalSince(actionTime) < 30 {
                logDebug("Found pending add time action:", taskId, "minutes:", minutes)
                sendEvent(withName: "onTaskAddTime", body: ["taskId": taskId, "minutes": minutes])
            }
            defaults.removeObject(forKey: "pendingAddTimeTaskId")
            defaults.removeObject(forKey: "pendingAddTimeMinutes")
            defaults.removeObject(forKey: "pendingAddTimeTimestamp")
            defaults.synchronize()
        }
    }
    
    // Check if Live Activities are available
    @objc
    func isAvailable(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        logDebug("isAvailable called")
        if #available(iOS 16.1, *) {
            let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
            logDebug("iOS 16.1+ - areActivitiesEnabled:", enabled)
            resolve(enabled)
        } else {
            logDebug("iOS < 16.1 - not available")
            resolve(false)
        }
    }
    
    // Start a Live Activity for a task
    @objc
    func startActivity(
        _ taskId: String,
        title: String,
        projectName: String?,
        estimatedMinutes: NSNumber,
        priority: String,
        startTime: String,
        endTime: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        logDebug("====== START ACTIVITY (Native) ======")
        logDebug("taskId:", taskId)
        logDebug("title:", title)
        logDebug("projectName:", projectName ?? "(nil)")
        logDebug("estimatedMinutes:", estimatedMinutes)
        logDebug("priority:", priority)
        logDebug("startTime:", startTime)
        logDebug("endTime:", endTime)
        
        if #available(iOS 16.1, *) {
            // Check if activities are enabled
            let authInfo = ActivityAuthorizationInfo()
            logDebug("areActivitiesEnabled:", authInfo.areActivitiesEnabled)
            
            if !authInfo.areActivitiesEnabled {
                logDebug("❌ Live Activities are disabled in Settings!")
                reject("DISABLED", "Live Activities are disabled. Enable them in Settings > PostHive > Live Activities", nil)
                return
            }
            
            // Parse dates
            let dateFormatter = ISO8601DateFormatter()
            dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            
            guard let startDate = dateFormatter.date(from: startTime) ?? ISO8601DateFormatter().date(from: startTime),
                  let endDate = dateFormatter.date(from: endTime) ?? ISO8601DateFormatter().date(from: endTime) else {
                logDebug("❌ Invalid date format - startTime:", startTime, "endTime:", endTime)
                reject("INVALID_DATE", "Invalid date format", nil)
                return
            }
            
            logDebug("Parsed dates - start:", startDate, "end:", endDate)
            
            // Calculate remaining seconds
            let remainingSeconds = Int(endDate.timeIntervalSince(Date()))
            
            // Create attributes
            let attributes = TaskActivityAttributes(
                taskId: taskId,
                title: title,
                projectName: projectName,
                estimatedMinutes: estimatedMinutes.intValue,
                priority: priority
            )
            
            // Create initial content state
            let initialState = TaskActivityAttributes.ContentState(
                taskId: taskId,
                title: title,
                projectName: projectName,
                startTime: startDate,
                endTime: endDate,
                estimatedMinutes: estimatedMinutes.intValue,
                priority: priority,
                remainingSeconds: max(0, remainingSeconds)
            )
            
            // Check if activity already exists
            let existingActivities = Activity<TaskActivityAttributes>.activities
            logDebug("Current activities count:", existingActivities.count)
            
            if let existingActivity = existingActivities.first(where: { $0.attributes.taskId == taskId }) {
                logDebug("Found existing activity, updating...")
                // Update existing activity
                Task {
                    let updatedState = TaskActivityAttributes.ContentState(
                        taskId: taskId,
                        title: title,
                        projectName: projectName,
                        startTime: startDate,
                        endTime: endDate,
                        estimatedMinutes: estimatedMinutes.intValue,
                        priority: priority,
                        remainingSeconds: max(0, remainingSeconds)
                    )
                    await existingActivity.update(using: updatedState)
                    logDebug("✅ Existing activity updated")
                    resolve(taskId)
                }
            } else {
                logDebug("No existing activity, creating new one...")
                // Start new activity
                do {
                    let activity = try Activity<TaskActivityAttributes>.request(
                        attributes: attributes,
                        contentState: initialState,
                        pushType: nil
                    )
                    logDebug("✅ New activity created with ID:", activity.id)
                    logDebug("Activity state:", activity.activityState.rawValue)
                    resolve(activity.id)
                } catch {
                    logDebug("❌ Failed to create activity:", error.localizedDescription)
                    reject("START_FAILED", "Failed to start Live Activity: \(error.localizedDescription)", error)
                }
            }
        } else {
            logDebug("❌ iOS version too old")
            reject("NOT_SUPPORTED", "Live Activities require iOS 16.1 or later", nil)
        }
    }
    
    // Update a Live Activity
    @objc
    func updateActivity(
        _ taskId: String,
        remainingSeconds: NSNumber,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.1, *) {
            guard let activity = Activity<TaskActivityAttributes>.activities.first(where: { $0.attributes.taskId == taskId }) else {
                // Don't reject - just resolve with empty string to avoid error spam
                // Activity might not be created yet or was dismissed by user
                logDebug("updateActivity: Activity not found for task:", taskId, "- skipping silently")
                resolve("")
                return
            }
            
            let currentState = activity.contentState
            let updatedState = TaskActivityAttributes.ContentState(
                taskId: currentState.taskId,
                title: currentState.title,
                projectName: currentState.projectName,
                startTime: currentState.startTime,
                endTime: currentState.endTime,
                estimatedMinutes: currentState.estimatedMinutes,
                priority: currentState.priority,
                remainingSeconds: max(0, remainingSeconds.intValue)
            )
            
            Task {
                await activity.update(using: updatedState)
                resolve(taskId)
            }
        } else {
            reject("NOT_SUPPORTED", "Live Activities require iOS 16.1 or later", nil)
        }
    }
    
    // End a Live Activity
    @objc
    func endActivity(
        _ taskId: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.1, *) {
            guard let activity = Activity<TaskActivityAttributes>.activities.first(where: { $0.attributes.taskId == taskId }) else {
                // Activity not found, but that's okay - might have been dismissed
                resolve(taskId)
                return
            }
            
            Task {
                let finalState = TaskActivityAttributes.ContentState(
                    taskId: activity.contentState.taskId,
                    title: activity.contentState.title,
                    projectName: activity.contentState.projectName,
                    startTime: activity.contentState.startTime,
                    endTime: activity.contentState.endTime,
                    estimatedMinutes: activity.contentState.estimatedMinutes,
                    priority: activity.contentState.priority,
                    remainingSeconds: 0
                )
                await activity.end(using: finalState, dismissalPolicy: .immediate)
                resolve(taskId)
            }
        } else {
            reject("NOT_SUPPORTED", "Live Activities require iOS 16.1 or later", nil)
        }
    }
    
    // Get all active activities
    @objc
    func getActiveActivities(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.1, *) {
            let activities = Activity<TaskActivityAttributes>.activities.map { activity in
                return [
                    "taskId": activity.attributes.taskId,
                    "title": activity.contentState.title,
                    "remainingSeconds": activity.contentState.remainingSeconds
                ]
            }
            resolve(activities)
        } else {
            resolve([])
        }
    }
    
    // ===== EVENT LIVE ACTIVITY METHODS =====
    
    // Start a Live Activity for a calendar event
    @objc
    func startEventActivity(
        _ eventId: String,
        title: String,
        location: String?,
        calendarColor: String,
        startTime: String,
        endTime: String,
        isUpcoming: Bool,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        logDebug("====== START EVENT ACTIVITY (Native) ======")
        logDebug("eventId:", eventId)
        logDebug("title:", title)
        logDebug("location:", location ?? "(nil)")
        logDebug("calendarColor:", calendarColor)
        logDebug("isUpcoming:", isUpcoming)
        
        if #available(iOS 16.1, *) {
            let authInfo = ActivityAuthorizationInfo()
            
            if !authInfo.areActivitiesEnabled {
                reject("DISABLED", "Live Activities are disabled", nil)
                return
            }
            
            let dateFormatter = ISO8601DateFormatter()
            dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            
            guard let startDate = dateFormatter.date(from: startTime) ?? ISO8601DateFormatter().date(from: startTime),
                  let endDate = dateFormatter.date(from: endTime) ?? ISO8601DateFormatter().date(from: endTime) else {
                reject("INVALID_DATE", "Invalid date format", nil)
                return
            }
            
            // Calculate remaining seconds (to start if upcoming, to end if in progress)
            let remainingSeconds = isUpcoming
                ? Int(startDate.timeIntervalSince(Date()))
                : Int(endDate.timeIntervalSince(Date()))
            
            let attributes = EventActivityAttributes(
                eventId: eventId,
                title: title,
                location: location,
                calendarColor: calendarColor
            )
            
            let initialState = EventActivityAttributes.ContentState(
                eventId: eventId,
                title: title,
                location: location,
                startTime: startDate,
                endTime: endDate,
                isUpcoming: isUpcoming,
                remainingSeconds: max(0, remainingSeconds),
                calendarColor: calendarColor
            )
            
            // Check if activity already exists
            let existingActivities = Activity<EventActivityAttributes>.activities
            
            if let existingActivity = existingActivities.first(where: { $0.attributes.eventId == eventId }) {
                Task {
                    await existingActivity.update(using: initialState)
                    logDebug("✅ Event activity updated")
                    resolve(eventId)
                }
            } else {
                do {
                    let activity = try Activity<EventActivityAttributes>.request(
                        attributes: attributes,
                        contentState: initialState,
                        pushType: nil
                    )
                    logDebug("✅ Event activity created with ID:", activity.id)
                    resolve(activity.id)
                } catch {
                    logDebug("❌ Failed to create event activity:", error.localizedDescription)
                    reject("START_FAILED", "Failed to start Event Live Activity: \(error.localizedDescription)", error)
                }
            }
        } else {
            reject("NOT_SUPPORTED", "Live Activities require iOS 16.1 or later", nil)
        }
    }
    
    // Update an Event Live Activity
    @objc
    func updateEventActivity(
        _ eventId: String,
        remainingSeconds: NSNumber,
        isUpcoming: Bool,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.1, *) {
            guard let activity = Activity<EventActivityAttributes>.activities.first(where: { $0.attributes.eventId == eventId }) else {
                resolve("")
                return
            }
            
            let currentState = activity.contentState
            let updatedState = EventActivityAttributes.ContentState(
                eventId: currentState.eventId,
                title: currentState.title,
                location: currentState.location,
                startTime: currentState.startTime,
                endTime: currentState.endTime,
                isUpcoming: isUpcoming,
                remainingSeconds: max(0, remainingSeconds.intValue),
                calendarColor: currentState.calendarColor
            )
            
            Task {
                await activity.update(using: updatedState)
                resolve(eventId)
            }
        } else {
            reject("NOT_SUPPORTED", "Live Activities require iOS 16.1 or later", nil)
        }
    }
    
    // End an Event Live Activity
    @objc
    func endEventActivity(
        _ eventId: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.1, *) {
            guard let activity = Activity<EventActivityAttributes>.activities.first(where: { $0.attributes.eventId == eventId }) else {
                resolve(eventId)
                return
            }
            
            Task {
                let finalState = EventActivityAttributes.ContentState(
                    eventId: activity.contentState.eventId,
                    title: activity.contentState.title,
                    location: activity.contentState.location,
                    startTime: activity.contentState.startTime,
                    endTime: activity.contentState.endTime,
                    isUpcoming: false,
                    remainingSeconds: 0,
                    calendarColor: activity.contentState.calendarColor
                )
                await activity.end(using: finalState, dismissalPolicy: .immediate)
                logDebug("✅ Event activity ended")
                resolve(eventId)
            }
        } else {
            reject("NOT_SUPPORTED", "Live Activities require iOS 16.1 or later", nil)
        }
    }
    
    // ===== TRANSFER LIVE ACTIVITY METHODS =====
    
    // Start a Live Activity for a file transfer
    @objc
    func startTransferActivity(
        _ params: NSDictionary,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        logDebug("====== START TRANSFER ACTIVITY (Native) ======")
        
        guard let sessionId = params["sessionId"] as? String,
              let transferName = params["transferName"] as? String,
              let projectName = params["projectName"] as? String else {
            reject("INVALID_PARAMS", "Missing required parameters", nil)
            return
        }
        
        let totalFiles = params["totalFiles"] as? Int ?? 0
        let completedFiles = params["completedFiles"] as? Int ?? 0
        let progress = params["progress"] as? Double ?? 0.0
        let currentFileName = params["currentFileName"] as? String ?? ""
        let totalBytes = params["totalBytes"] as? Int64 ?? 0
        let bytesTransferred = params["bytesTransferred"] as? Int64 ?? 0
        let deviceName = params["deviceName"] as? String ?? "Desktop"
        
        logDebug("sessionId:", sessionId)
        logDebug("transferName:", transferName)
        logDebug("projectName:", projectName)
        logDebug("progress:", progress)
        
        if #available(iOS 16.1, *) {
            let authInfo = ActivityAuthorizationInfo()
            
            if !authInfo.areActivitiesEnabled {
                reject("DISABLED", "Live Activities are disabled", nil)
                return
            }
            
            let attributes = TransferActivityAttributes(
                sessionId: sessionId,
                transferName: transferName,
                projectName: projectName,
                deviceName: deviceName
            )
            
            let initialState = TransferActivityAttributes.ContentState(
                sessionId: sessionId,
                transferName: transferName,
                projectName: projectName,
                totalFiles: totalFiles,
                completedFiles: completedFiles,
                progress: progress,
                currentFileName: currentFileName,
                totalBytes: totalBytes,
                bytesTransferred: bytesTransferred,
                deviceName: deviceName,
                status: "in_progress"
            )
            
            // Check if activity already exists
            let existingActivities = Activity<TransferActivityAttributes>.activities
            
            if let existingActivity = existingActivities.first(where: { $0.attributes.sessionId == sessionId }) {
                Task {
                    await existingActivity.update(using: initialState)
                    logDebug("✅ Transfer activity updated")
                    resolve(sessionId)
                }
            } else {
                do {
                    let activity = try Activity<TransferActivityAttributes>.request(
                        attributes: attributes,
                        contentState: initialState,
                        pushType: nil
                    )
                    logDebug("✅ Transfer activity created with ID:", activity.id)
                    resolve(activity.id)
                } catch {
                    logDebug("❌ Failed to create transfer activity:", error.localizedDescription)
                    reject("START_FAILED", "Failed to start Transfer Live Activity: \(error.localizedDescription)", error)
                }
            }
        } else {
            reject("NOT_SUPPORTED", "Live Activities require iOS 16.1 or later", nil)
        }
    }
    
    // Update a Transfer Live Activity
    @objc
    func updateTransferActivity(
        _ activityId: String,
        params: NSDictionary,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.1, *) {
            guard let activity = Activity<TransferActivityAttributes>.activities.first(where: { $0.id == activityId || $0.attributes.sessionId == activityId }) else {
                resolve("")
                return
            }
            
            let currentState = activity.contentState
            let completedFiles = params["completedFiles"] as? Int ?? currentState.completedFiles
            let progress = params["progress"] as? Double ?? currentState.progress
            let currentFileName = params["currentFileName"] as? String ?? currentState.currentFileName
            let bytesTransferred = params["bytesTransferred"] as? Int64 ?? currentState.bytesTransferred
            
            let updatedState = TransferActivityAttributes.ContentState(
                sessionId: currentState.sessionId,
                transferName: currentState.transferName,
                projectName: currentState.projectName,
                totalFiles: currentState.totalFiles,
                completedFiles: completedFiles,
                progress: progress,
                currentFileName: currentFileName,
                totalBytes: currentState.totalBytes,
                bytesTransferred: bytesTransferred,
                deviceName: currentState.deviceName,
                status: "in_progress"
            )
            
            Task {
                await activity.update(using: updatedState)
                resolve(activityId)
            }
        } else {
            reject("NOT_SUPPORTED", "Live Activities require iOS 16.1 or later", nil)
        }
    }
    
    // End a Transfer Live Activity
    @objc
    func endTransferActivity(
        _ activityId: String,
        status: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.1, *) {
            guard let activity = Activity<TransferActivityAttributes>.activities.first(where: { $0.id == activityId || $0.attributes.sessionId == activityId }) else {
                resolve(activityId)
                return
            }
            
            Task {
                let finalState = TransferActivityAttributes.ContentState(
                    sessionId: activity.contentState.sessionId,
                    transferName: activity.contentState.transferName,
                    projectName: activity.contentState.projectName,
                    totalFiles: activity.contentState.totalFiles,
                    completedFiles: status == "completed" ? activity.contentState.totalFiles : activity.contentState.completedFiles,
                    progress: status == "completed" ? 1.0 : activity.contentState.progress,
                    currentFileName: "",
                    totalBytes: activity.contentState.totalBytes,
                    bytesTransferred: status == "completed" ? activity.contentState.totalBytes : activity.contentState.bytesTransferred,
                    deviceName: activity.contentState.deviceName,
                    status: status
                )
                await activity.end(using: finalState, dismissalPolicy: .default)
                logDebug("✅ Transfer activity ended with status:", status)
                resolve(activityId)
            }
        } else {
            reject("NOT_SUPPORTED", "Live Activities require iOS 16.1 or later", nil)
        }
    }
}

