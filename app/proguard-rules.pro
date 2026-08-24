# Proguard rules for Salino
# Add project specific ProGuard rules here.

# Firebase
-keepattributes Signature
-keepattributes *Annotation*

# Keep data model classes for Firestore serialization
-keep class com.salino.sali.data.model.** { *; }

# Unity Ads (legacy Direct Unity Ads — rollback only)
-keep class com.unity3d.ads.** { *; }
-keep class com.unity3d.services.** { *; }

# Unity LevelPlay (ironSource) mediation
-keep class com.unity3d.mediation.** { *; }
-keep class com.ironsource.** { *; }
-dontwarn com.ironsource.**
-keep public interface com.ironsource.mediationsdk.sdk.** { *; }
-keep public interface com.ironsource.mediationsdk.impressionData.ImpressionDataListener { *; }
