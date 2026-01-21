import Foundation
import ActivityKit
import WidgetKit
import React

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

@objc(LiveActivityModule)
class LiveActivityModule: NSObject {
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    // Check if Live Activities are available
    @objc
    func isAvailable(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.1, *) {
            resolve(ActivityAuthorizationInfo().areActivitiesEnabled)
        } else {
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
        if #available(iOS 16.1, *) {
            // Parse dates
            let dateFormatter = ISO8601DateFormatter()
            dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            
            guard let startDate = dateFormatter.date(from: startTime) ?? ISO8601DateFormatter().date(from: startTime),
                  let endDate = dateFormatter.date(from: endTime) ?? ISO8601DateFormatter().date(from: endTime) else {
                reject("INVALID_DATE", "Invalid date format", nil)
                return
            }
            
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
            if let existingActivity = Activity<TaskActivityAttributes>.activities.first(where: { $0.attributes.taskId == taskId }) {
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
                    resolve(taskId)
                }
            } else {
                // Start new activity
                do {
                    let activity = try Activity<TaskActivityAttributes>.request(
                        attributes: attributes,
                        contentState: initialState,
                        pushType: nil
                    )
                    resolve(activity.id)
                } catch {
                    reject("START_FAILED", "Failed to start Live Activity: \(error.localizedDescription)", error)
                }
            }
        } else {
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
                reject("NOT_FOUND", "Live Activity not found for task: \(taskId)", nil)
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
}


