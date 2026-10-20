package com.salino.sali

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.uimanager.ViewManager

/**
 * Exposes Android [BuildConfig.DEBUG] to JS.
 * Needed because this app embeds the JS bundle in debug APKs
 * (`debuggableVariants = []`), so `__DEV__` is false even when the
 * native binary is debuggable.
 */
class SalinoBuildInfoModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "SalinoBuildInfo"

  override fun getConstants(): Map<String, Any> =
    mapOf("isDebuggable" to BuildConfig.DEBUG)
}

class SalinoBuildInfoPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext,
  ): List<NativeModule> = listOf(SalinoBuildInfoModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
