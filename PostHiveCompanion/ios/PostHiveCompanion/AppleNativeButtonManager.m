//
//  AppleNativeButtonManager.m
//  PostHiveCompanion
//

#import <React/RCTViewManager.h>

@interface RCT_EXTERN_REMAP_MODULE(AppleNativeButton, AppleNativeButtonManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(title, NSString)
RCT_EXPORT_VIEW_PROPERTY(buttonStyle, NSString)
RCT_EXPORT_VIEW_PROPERTY(enabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(systemImage, NSString)
RCT_EXPORT_VIEW_PROPERTY(onNativePress, RCTDirectEventBlock)

@end
