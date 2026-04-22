//
//  AppleNativeGlassSwitchManager.m
//  PostHiveCompanion
//

#import <React/RCTViewManager.h>

@interface RCT_EXTERN_REMAP_MODULE(AppleNativeGlassSwitch, AppleNativeGlassSwitchManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(value, BOOL)
RCT_EXPORT_VIEW_PROPERTY(enabled, BOOL)
// JS prop `tint` -> Swift `tintColor_` (avoids clashing with UIView.tintColor).
RCT_REMAP_VIEW_PROPERTY(tint, tintColor_, NSString)
RCT_EXPORT_VIEW_PROPERTY(onNativeChange, RCTDirectEventBlock)

@end
