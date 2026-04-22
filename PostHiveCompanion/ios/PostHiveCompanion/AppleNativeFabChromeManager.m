//
//  AppleNativeFabChromeManager.m
//  PostHiveCompanion
//

#import <React/RCTViewManager.h>

@interface RCT_EXTERN_REMAP_MODULE(AppleNativeFabChrome, AppleNativeFabChromeManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(systemImage, NSString)
RCT_EXPORT_VIEW_PROPERTY(interactive, BOOL)
RCT_EXPORT_VIEW_PROPERTY(onNativeShortTap, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVoiceBegan, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVoiceEnded, RCTDirectEventBlock)

@end
