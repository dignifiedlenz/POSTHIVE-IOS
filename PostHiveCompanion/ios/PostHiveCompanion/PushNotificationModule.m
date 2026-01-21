#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <UserNotifications/UserNotifications.h>
#import <UIKit/UIKit.h>

@interface PushNotificationModule : NSObject <RCTBridgeModule>
@end

@implementation PushNotificationModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

RCT_EXPORT_METHOD(registerForPushNotifications:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
    [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
                          completionHandler:^(BOOL granted, NSError * _Nullable error) {
      if (error) {
        reject(@"PERMISSION_ERROR", error.localizedDescription, error);
        return;
      }
      
      if (granted) {
        dispatch_async(dispatch_get_main_queue(), ^{
          [[UIApplication sharedApplication] registerForRemoteNotifications];
        });
      }
      
      resolve(@(granted));
    }];
  });
}

RCT_EXPORT_METHOD(getDeviceToken:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  // Read from UserDefaults (set by Swift AppDelegate)
  NSString *token = [[NSUserDefaults standardUserDefaults] stringForKey:@"APNsDeviceToken"];
  if (token) {
    resolve(token);
  } else {
    resolve([NSNull null]);
  }
}

RCT_EXPORT_METHOD(checkPermissionStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings * _Nonnull settings) {
    NSString *status;
    switch (settings.authorizationStatus) {
      case UNAuthorizationStatusAuthorized:
        status = @"authorized";
        break;
      case UNAuthorizationStatusDenied:
        status = @"denied";
        break;
      case UNAuthorizationStatusNotDetermined:
        status = @"notDetermined";
        break;
      case UNAuthorizationStatusProvisional:
        status = @"provisional";
        break;
      case UNAuthorizationStatusEphemeral:
        status = @"ephemeral";
        break;
      default:
        status = @"unknown";
        break;
    }
    resolve(status);
  }];
}

@end
