//
//  PostHiveCompanion-Bridging-Header.h
//  PostHiveCompanion
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Forward declare our push notification module so Swift can access it
@interface PushNotificationModule : NSObject <RCTBridgeModule>
+ (void)setDeviceToken:(NSString *)token;
+ (NSString *)getStoredDeviceToken;
@end

// Forward declare Live Activity module
@interface LiveActivityModule : NSObject <RCTBridgeModule>
@end

// Forward declare Apple Calendar module
@interface AppleCalendarModule : RCTEventEmitter <RCTBridgeModule>
@end
