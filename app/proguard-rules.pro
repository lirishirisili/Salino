# Proguard rules for Salino
# Add project specific ProGuard rules here.

# Firebase
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes JavascriptInterface

# Keep data model classes for Firestore serialization
-keep class com.salino.sali.data.model.** { *; }

# Unity LevelPlay (ironSource) mediation + Unity Ads adapter
-keepclassmembers class com.ironsource.sdk.controller.IronSourceWebView$JSInterface {
    public *;
}
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}
-keep public class com.google.android.gms.ads.** {
    public *;
}
-keep class com.unity3d.mediation.** { *; }
-keep class com.unity3d.mediation.banner.** { *; }
-keep interface com.unity3d.mediation.** { *; }
-keep class com.ironsource.** { *; }
-keep class com.ironsource.adapters.** { *; }
-keep class com.ironsource.unity.androidbridge.** { *; }
-keep class com.unity3d.ads.** { *; }
-keep class com.unity3d.services.** { *; }
-dontwarn com.ironsource.mediationsdk.**
-dontwarn com.ironsource.adapters.**
-dontwarn com.ironsource.**
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
