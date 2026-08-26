# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated / worklets
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ── Rules below only take effect when minifyEnabled/shrinkResources are turned
# ── on in build.gradle. They are kept ready so R8 can be enabled safely without
# ── stripping code these SDKs resolve reflectively. Do NOT enable minify before
# ── running a full release smoke test with these rules in place.

# Hermes / React Native core
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep @com.facebook.proguard.annotations.DoNotStrip class * { *; }
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.react.bridge.ReactMethod *;
}

# Expo / expo-modules
-keep class expo.modules.** { *; }
-keep class expo.core.** { *; }
-keepclassmembers class * {
    @expo.modules.core.interfaces.ExpoMethod *;
}

# Firebase (JS SDK talks over the network, but native @react-native-firebase
# modules and their GMS deps resolve reflectively).
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Google Sign-In
-keep class com.google.android.gms.auth.** { *; }

# Unity LevelPlay / ironSource mediation + adapters
-keep class com.unity3d.mediation.** { *; }
-keep class com.ironsource.** { *; }
-keep class com.unity3d.ads.** { *; }
-dontwarn com.unity3d.**
-dontwarn com.ironsource.**

# OkHttp / Okio (used transitively) — silence reflective warnings.
-dontwarn okhttp3.**
-dontwarn okio.**

# Add any project specific keep options here:
