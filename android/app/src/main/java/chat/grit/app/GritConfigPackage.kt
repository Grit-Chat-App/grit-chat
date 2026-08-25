// React Native package registration for GritConfigModule. GritConfig is part of the app rather than
// a library, so nothing autolinks it: MainApplication adds this package by hand.
//
// Same shape as HopMeshPackage.kt in @hop-mesh/react-native. Implementing ReactPackage rather than
// BaseReactPackage keeps this a legacy bridge module, which is what the iOS side is too, and the
// TurboModule interop layer picks it up from createNativeModules().

package chat.grit.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class GritConfigPackage : ReactPackage {

  // createNativeModules is deprecated in favour of BaseReactPackage.getModule. Deliberately not
  // migrated: this is a legacy bridge module by design, matching iOS and HopMeshPackage, and the
  // interop layer only reads legacy packages through this method. React Native's own
  // ReactPackageTurboModuleManagerDelegate suppresses the same warning at the call site.
  @Suppress("OVERRIDE_DEPRECATION")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(GritConfigModule(reactContext))

  // Constants only. This module renders nothing.
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
