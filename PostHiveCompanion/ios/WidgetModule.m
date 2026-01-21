//
//  WidgetModule.m
//  PostHiveCompanion
//
//  Objective-C bridge for WidgetModule
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetModule, NSObject)

RCT_EXTERN_METHOD(updateUpcomingItems:(NSArray *)items)
RCT_EXTERN_METHOD(updateLatestDeliverable:(NSDictionary *)deliverable)
RCT_EXTERN_METHOD(updateActiveTransfer:(NSDictionary *)transfer)
RCT_EXTERN_METHOD(clearActiveTransfer)
RCT_EXTERN_METHOD(updateActivityFeed:(NSArray *)activities)
RCT_EXTERN_METHOD(reloadAllWidgets)

@end

