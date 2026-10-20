# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# @appodeal-proguard (managed by withAppodealAndroid.js)
-keep class com.appodeal.** { *; }
-keep class com.explorestack.** { *; }
-keep class com.applovin.** { *; }
-keep class io.bidmachine.** { *; }
-keep class org.bidon.** { *; }
-keep class com.facebook.ads.** { *; }
-dontwarn com.appodeal.**
-dontwarn com.explorestack.**
-dontwarn com.facebook.ads.internal.**
-keeppackagenames com.facebook.*
