//
//  AppleNativeCreateGlassMenuManager.m
//  PostHiveCompanion
//

#import <React/RCTViewManager.h>

@interface RCT_EXTERN_REMAP_MODULE(AppleNativeCreateGlassMenu, AppleNativeCreateGlassMenuManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(visible, BOOL)
RCT_EXPORT_VIEW_PROPERTY(onDismiss, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onSelect, RCTDirectEventBlock)

@end
