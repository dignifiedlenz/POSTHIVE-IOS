import Foundation
import EventKit
import React

// Debug logging
private func logDebug(_ items: Any...) {
    #if DEBUG
    print("📆 [AppleCalendar Native]", items.map { "\($0)" }.joined(separator: " "))
    #endif
}

@objc(AppleCalendarModule)
class AppleCalendarModule: RCTEventEmitter {
    
    private let eventStore = EKEventStore()
    private var hasListeners = false
    
    @objc
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return ["onCalendarChanged"]
    }
    
    override func startObserving() {
        hasListeners = true
        
        // Listen for calendar changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(calendarChanged),
            name: .EKEventStoreChanged,
            object: eventStore
        )
        
        logDebug("Started observing calendar changes")
    }
    
    override func stopObserving() {
        hasListeners = false
        NotificationCenter.default.removeObserver(self)
        logDebug("Stopped observing calendar changes")
    }
    
    @objc private func calendarChanged() {
        if hasListeners {
            sendEvent(withName: "onCalendarChanged", body: nil)
        }
    }
    
    // MARK: - Authorization
    
    @objc
    func getAuthorizationStatus(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let status = EKEventStore.authorizationStatus(for: .event)
        
        switch status {
        case .notDetermined:
            resolve("notDetermined")
        case .restricted:
            resolve("restricted")
        case .denied:
            resolve("denied")
        case .authorized:
            resolve("authorized")
        case .fullAccess:
            resolve("fullAccess")
        case .writeOnly:
            resolve("writeOnly")
        @unknown default:
            resolve("unknown")
        }
    }
    
    @objc
    func requestAccess(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        logDebug("Requesting calendar access...")
        
        if #available(iOS 17.0, *) {
            eventStore.requestFullAccessToEvents { granted, error in
                if let error = error {
                    logDebug("❌ Access request failed:", error.localizedDescription)
                    reject("ACCESS_ERROR", error.localizedDescription, error)
                    return
                }
                logDebug("✅ Full access granted:", granted)
                resolve(granted)
            }
        } else {
            eventStore.requestAccess(to: .event) { granted, error in
                if let error = error {
                    logDebug("❌ Access request failed:", error.localizedDescription)
                    reject("ACCESS_ERROR", error.localizedDescription, error)
                    return
                }
                logDebug("✅ Access granted:", granted)
                resolve(granted)
            }
        }
    }
    
    // MARK: - Calendars
    
    @objc
    func getCalendars(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        logDebug("Getting calendars...")
        
        let calendars = eventStore.calendars(for: .event)
        
        let calendarData = calendars.map { calendar -> [String: Any] in
            return [
                "id": calendar.calendarIdentifier,
                "title": calendar.title,
                "color": hexString(from: calendar.cgColor),
                "type": calendarTypeString(calendar.type),
                "source": calendar.source?.title ?? "Unknown",
                "allowsModifications": calendar.allowsContentModifications,
                "isSubscribed": calendar.isSubscribed,
                "isImmutable": calendar.isImmutable
            ]
        }
        
        logDebug("Found \(calendars.count) calendars")
        resolve(calendarData)
    }
    
    @objc
    func getDefaultCalendarId(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        if let defaultCalendar = eventStore.defaultCalendarForNewEvents {
            resolve(defaultCalendar.calendarIdentifier)
        } else {
            resolve(nil)
        }
    }
    
    // MARK: - Events
    
    @objc
    func getEvents(
        _ calendarIds: [String],
        startDate: String,
        endDate: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        logDebug("Getting events from \(calendarIds.count) calendars")
        
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        guard let start = dateFormatter.date(from: startDate) ?? ISO8601DateFormatter().date(from: startDate),
              let end = dateFormatter.date(from: endDate) ?? ISO8601DateFormatter().date(from: endDate) else {
            reject("INVALID_DATE", "Invalid date format", nil)
            return
        }
        
        // Get selected calendars
        var calendars: [EKCalendar] = []
        if calendarIds.isEmpty {
            calendars = eventStore.calendars(for: .event)
        } else {
            calendars = calendarIds.compactMap { id in
                eventStore.calendar(withIdentifier: id)
            }
        }
        
        let predicate = eventStore.predicateForEvents(withStart: start, end: end, calendars: calendars)
        let events = eventStore.events(matching: predicate)
        
        let eventData = events.map { event -> [String: Any] in
            return [
                "id": event.eventIdentifier ?? UUID().uuidString,
                "title": event.title ?? "Untitled",
                "notes": event.notes ?? "",
                "location": event.location ?? "",
                "startDate": dateFormatter.string(from: event.startDate),
                "endDate": dateFormatter.string(from: event.endDate),
                "isAllDay": event.isAllDay,
                "calendarId": event.calendar?.calendarIdentifier ?? "",
                "calendarTitle": event.calendar?.title ?? "",
                "calendarColor": hexString(from: event.calendar?.cgColor),
                "url": event.url?.absoluteString ?? "",
                "hasRecurrenceRules": event.hasRecurrenceRules,
                "availability": availabilityString(event.availability),
                "organizer": event.organizer?.name ?? ""
            ]
        }
        
        logDebug("Found \(events.count) events")
        resolve(eventData)
    }
    
    @objc
    func createEvent(
        _ calendarId: String,
        title: String,
        notes: String?,
        location: String?,
        startDate: String,
        endDate: String,
        isAllDay: Bool,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        logDebug("Creating event:", title)
        
        guard let calendar = eventStore.calendar(withIdentifier: calendarId) else {
            reject("CALENDAR_NOT_FOUND", "Calendar not found", nil)
            return
        }
        
        if !calendar.allowsContentModifications {
            reject("CALENDAR_READ_ONLY", "Calendar does not allow modifications", nil)
            return
        }
        
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        guard let start = dateFormatter.date(from: startDate) ?? ISO8601DateFormatter().date(from: startDate),
              let end = dateFormatter.date(from: endDate) ?? ISO8601DateFormatter().date(from: endDate) else {
            reject("INVALID_DATE", "Invalid date format", nil)
            return
        }
        
        let event = EKEvent(eventStore: eventStore)
        event.title = title
        event.notes = notes
        event.location = location
        event.startDate = start
        event.endDate = end
        event.isAllDay = isAllDay
        event.calendar = calendar
        
        do {
            try eventStore.save(event, span: .thisEvent)
            logDebug("✅ Event created:", event.eventIdentifier ?? "unknown")
            resolve([
                "id": event.eventIdentifier ?? "",
                "title": event.title ?? "",
                "startDate": startDate,
                "endDate": endDate
            ])
        } catch {
            logDebug("❌ Failed to create event:", error.localizedDescription)
            reject("CREATE_FAILED", error.localizedDescription, error)
        }
    }
    
    @objc
    func updateEvent(
        _ eventId: String,
        title: String?,
        notes: String?,
        location: String?,
        startDate: String?,
        endDate: String?,
        isAllDay: NSNumber?,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        logDebug("Updating event:", eventId)
        
        guard let event = eventStore.event(withIdentifier: eventId) else {
            reject("EVENT_NOT_FOUND", "Event not found", nil)
            return
        }
        
        if let calendar = event.calendar, !calendar.allowsContentModifications {
            reject("CALENDAR_READ_ONLY", "Calendar does not allow modifications", nil)
            return
        }
        
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        if let title = title {
            event.title = title
        }
        if let notes = notes {
            event.notes = notes
        }
        if let location = location {
            event.location = location
        }
        if let startDate = startDate,
           let start = dateFormatter.date(from: startDate) ?? ISO8601DateFormatter().date(from: startDate) {
            event.startDate = start
        }
        if let endDate = endDate,
           let end = dateFormatter.date(from: endDate) ?? ISO8601DateFormatter().date(from: endDate) {
            event.endDate = end
        }
        if let isAllDay = isAllDay {
            event.isAllDay = isAllDay.boolValue
        }
        
        do {
            try eventStore.save(event, span: .thisEvent)
            logDebug("✅ Event updated")
            resolve(true)
        } catch {
            logDebug("❌ Failed to update event:", error.localizedDescription)
            reject("UPDATE_FAILED", error.localizedDescription, error)
        }
    }
    
    @objc
    func deleteEvent(
        _ eventId: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        logDebug("Deleting event:", eventId)
        
        guard let event = eventStore.event(withIdentifier: eventId) else {
            // Event already deleted or doesn't exist
            resolve(true)
            return
        }
        
        if let calendar = event.calendar, !calendar.allowsContentModifications {
            reject("CALENDAR_READ_ONLY", "Calendar does not allow modifications", nil)
            return
        }
        
        do {
            try eventStore.remove(event, span: .thisEvent)
            logDebug("✅ Event deleted")
            resolve(true)
        } catch {
            logDebug("❌ Failed to delete event:", error.localizedDescription)
            reject("DELETE_FAILED", error.localizedDescription, error)
        }
    }
    
    // MARK: - Helpers
    
    private func hexString(from cgColor: CGColor?) -> String {
        guard let color = cgColor,
              let components = color.components,
              components.count >= 3 else {
            return "#3B82F6" // Default blue
        }
        
        let r = Int(components[0] * 255)
        let g = Int(components[1] * 255)
        let b = Int(components[2] * 255)
        
        return String(format: "#%02X%02X%02X", r, g, b)
    }
    
    private func calendarTypeString(_ type: EKCalendarType) -> String {
        switch type {
        case .local:
            return "local"
        case .calDAV:
            return "calDAV"
        case .exchange:
            return "exchange"
        case .subscription:
            return "subscription"
        case .birthday:
            return "birthday"
        @unknown default:
            return "unknown"
        }
    }
    
    private func availabilityString(_ availability: EKEventAvailability) -> String {
        switch availability {
        case .notSupported:
            return "notSupported"
        case .busy:
            return "busy"
        case .free:
            return "free"
        case .tentative:
            return "tentative"
        case .unavailable:
            return "unavailable"
        @unknown default:
            return "unknown"
        }
    }
}

