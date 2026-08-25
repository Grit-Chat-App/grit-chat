// RCT_EXTERN bridge for the Swift GritConfig module. A Swift class is invisible to the React Native
// bridge on its own: this macro declares the class, makes it conform to RCTBridgeModule, and
// registers it at load time so the module can be resolved by name from JavaScript.
//
// Same shape as node_modules/@hop-mesh/react-native/ios/HopMesh.m. There are no RCT_EXTERN_METHOD
// lines because GritConfig exports no methods at all, only constants; the bridge picks those up from
// -constantsToExport on the Swift class and surfaces them to JavaScript as getConstants().
//
// No bridging header is involved. Nothing here needs to see a Swift declaration, so the only import
// is React's own, and SWIFT_OBJC_BRIDGING_HEADER stays unset for this target.

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(GritConfig, NSObject)

// Nothing this module reads is main-thread-only: an Info.plist lookup and NSProcessInfo are both
// safe from any queue. Saying NO keeps startup off a synchronous hop to the main queue, which is
// what the bridge does before reading constants from a module that claims to need it. It also
// silences the warning the bridge logs when a module exports constants without answering this.
+ (BOOL)requiresMainQueueSetup { return NO; }

@end
