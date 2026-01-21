//
//  LiveActivityModule.m
//  PostHiveCompanion
//
//  Objective-C wrapper to ensure React Native can find the Swift module
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(LiveActivityModule, RCTEventEmitter)

RCT_EXTERN_METHOD(isAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startActivity:(NSString *)taskId
                  title:(NSString *)title
                  projectName:(NSString *)projectName
                  estimatedMinutes:(NSNumber *)estimatedMinutes
                  priority:(NSString *)priority
                  startTime:(NSString *)startTime
                  endTime:(NSString *)endTime
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateActivity:(NSString *)taskId
                  remainingSeconds:(NSNumber *)remainingSeconds
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endActivity:(NSString *)taskId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getActiveActivities:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Event Live Activity methods
RCT_EXTERN_METHOD(startEventActivity:(NSString *)eventId
                  title:(NSString *)title
                  location:(NSString *)location
                  calendarColor:(NSString *)calendarColor
                  startTime:(NSString *)startTime
                  endTime:(NSString *)endTime
                  isUpcoming:(BOOL)isUpcoming
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateEventActivity:(NSString *)eventId
                  remainingSeconds:(NSNumber *)remainingSeconds
                  isUpcoming:(BOOL)isUpcoming
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endEventActivity:(NSString *)eventId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Transfer Live Activity methods
RCT_EXTERN_METHOD(startTransferActivity:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateTransferActivity:(NSString *)activityId
                  params:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endTransferActivity:(NSString *)activityId
                  status:(NSString *)status
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

