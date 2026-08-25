// RCT_EXTERN bridge for the Swift GritNotifications module, same shape as GritConfig.m.

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(GritNotifications, NSObject)

RCT_EXTERN_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(present:(NSString *)title
                  body:(NSString *)body
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setBadge:(nonnull NSNumber *)count
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Posting a notification touches UNUserNotificationCenter, which is main-queue bound for badge and
// presentation bookkeeping. Claiming the main queue keeps the bridge from warning and keeps the
// calls ordered.
+ (BOOL)requiresMainQueueSetup { return YES; }

@end
