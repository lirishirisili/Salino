# Proguard rules for Salino
# Add project specific ProGuard rules here.

# Firebase
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes JavascriptInterface

# Keep data model classes for Firestore serialization
-keep class com.salino.sali.data.model.** { *; }

# Appodeal SDK + adapters (banner mediation, no AdMob)
-keep class com.appodeal.** { *; }
-keep class com.explorestack.** { *; }
-keep class com.applovin.** { *; }
-keep class io.bidmachine.** { *; }
-keep class org.bidon.** { *; }
-keep class com.facebook.ads.** { *; }
-keep class com.unity3d.ads.** { *; }
-keep class com.unity3d.services.** { *; }
-keep class com.unity3d.mediation.** { *; }
-keep class com.ironsource.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-dontwarn com.appodeal.**
-dontwarn com.explorestack.**
-dontwarn com.applovin.**
-dontwarn io.bidmachine.**
-dontwarn org.bidon.**
-dontwarn com.facebook.ads.**
