#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PostHiveAuthSession, NSObject)

RCT_EXTERN_METHOD(start:(NSString *)urlString
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
