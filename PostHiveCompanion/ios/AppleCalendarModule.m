//
//  AppleCalendarModule.m
//  PostHiveCompanion
//
//  Objective-C wrapper for Apple Calendar (EventKit) integration
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(AppleCalendarModule, RCTEventEmitter)

// Authorization
RCT_EXTERN_METHOD(getAuthorizationStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(requestAccess:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Calendars
RCT_EXTERN_METHOD(getCalendars:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getDefaultCalendarId:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Events - Read
RCT_EXTERN_METHOD(getEvents:(NSArray *)calendarIds
                  startDate:(NSString *)startDate
                  endDate:(NSString *)endDate
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Events - Create
RCT_EXTERN_METHOD(createEvent:(NSString *)calendarId
                  title:(NSString *)title
                  notes:(NSString *)notes
                  location:(NSString *)location
                  startDate:(NSString *)startDate
                  endDate:(NSString *)endDate
                  isAllDay:(BOOL)isAllDay
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Events - Update
RCT_EXTERN_METHOD(updateEvent:(NSString *)eventId
                  title:(NSString *)title
                  notes:(NSString *)notes
                  location:(NSString *)location
                  startDate:(NSString *)startDate
                  endDate:(NSString *)endDate
                  isAllDay:(nonnull NSNumber *)isAllDay
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Events - Delete
RCT_EXTERN_METHOD(deleteEvent:(NSString *)eventId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

