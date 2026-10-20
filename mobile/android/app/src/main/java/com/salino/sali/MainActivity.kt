package com.salino.sali
import expo.modules.splashscreen.SplashScreenManager

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.inputmethod.InputMethodManager
import android.webkit.WebView
import android.widget.EditText

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  /**
   * Ad banners (Appodeal + mediated networks) render through WebViews that grab focus
   * when a creative loads or refreshes. That blurs the focused TextInput mid-typing and
   * hides the keyboard (e.g. quick-add right after cold start). Hand focus back to the
   * input and stop that ad subtree from taking focus again.
   */
  private val adFocusGuard = ViewTreeObserver.OnGlobalFocusChangeListener { oldFocus, newFocus ->
    if (oldFocus !is EditText || newFocus == null || newFocus is EditText) {
      return@OnGlobalFocusChangeListener
    }
    val adRoot = findAdRoot(newFocus) ?: return@OnGlobalFocusChangeListener
    if (adRoot is ViewGroup) {
      adRoot.descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
    }
    adRoot.isFocusable = false
    adRoot.isFocusableInTouchMode = false
    newFocus.clearFocus()
    oldFocus.post {
      if (oldFocus.isAttachedToWindow && oldFocus.isShown && !oldFocus.isFocused) {
        restoreTextInputFocus(oldFocus)
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
    window.decorView.viewTreeObserver.addOnGlobalFocusChangeListener(adFocusGuard)
  }

  override fun onDestroy() {
    val observer = window.decorView.viewTreeObserver
    if (observer.isAlive) observer.removeOnGlobalFocusChangeListener(adFocusGuard)
    super.onDestroy()
  }

  /** Outermost ad view (WebView or ad-SDK class) containing [view], or null if it is not an ad. */
  private fun findAdRoot(view: View): View? {
    var current: View? = view
    var adRoot: View? = null
    while (current != null) {
      if (current is WebView || isAdSdkView(current)) {
        adRoot = current
      } else if (adRoot != null) {
        break
      }
      current = current.parent as? View
    }
    return adRoot
  }

  private fun isAdSdkView(view: View): Boolean {
    val name = view.javaClass.name
    return AD_SDK_PACKAGE_PREFIXES.any { name.startsWith(it) }
  }

  private fun restoreTextInputFocus(editText: EditText) {
    // ReactEditText may ignore OS-driven requestFocus(); use its JS focus path when present
    // (name/visibility differs across RN versions, hence reflection).
    val focusedFromJs = REACT_EDIT_TEXT_FOCUS_METHODS.any { name ->
      try {
        editText.javaClass.getMethod(name).invoke(editText)
        true
      } catch (e: Exception) {
        false
      }
    }
    if (!focusedFromJs || !editText.isFocused) editText.requestFocus()
    val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
    imm?.showSoftInput(editText, InputMethodManager.SHOW_IMPLICIT)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}

private val AD_SDK_PACKAGE_PREFIXES = listOf(
  "com.appodeal.",
  "io.bidmachine.",
  "org.bidon.",
  "com.applovin.",
  "com.unity3d.",
  "com.ironsource.",
  "com.facebook.ads.",
  "com.google.android.gms.ads.",
  "com.mbridge.",
  "com.my.target.",
  "com.vungle.",
  "com.bytedance.",
  "com.yandex.mobile.ads.",
  "com.inmobi.",
  "com.chartboost.",
  "com.fyber.",
  "com.smaato.",
  "com.moloco.",
  "com.mobilefuse.",
  "com.ogury.",
  "com.pubmatic.",
  "sg.bigo.",
  "net.pubnative.",
  "com.startapp.",
  "com.amazon.device.ads.",
)

private val REACT_EDIT_TEXT_FOCUS_METHODS = listOf("requestFocusFromJS")
