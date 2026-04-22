//
//  AppleNativeGlassIconButtonManager.m
//  PostHiveCompanion
//

#import <React/RCTViewManager.h>

@interface RCT_EXTERN_REMAP_MODULE(AppleNativeGlassIconButton, AppleNativeGlassIconButtonManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(systemImage, NSString)
RCT_EXPORT_VIEW_PROPERTY(prominent, BOOL)
RCT_EXPORT_VIEW_PROPERTY(active, BOOL)
RCT_EXPORT_VIEW_PROPERTY(enabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(onNativePress, RCTDirectEventBlock)

@end
