# Proguard rules for Salino
# Add project specific ProGuard rules here.

# Firebase
-keepattributes Signature
-keepattributes *Annotation*

# Keep data model classes for Firestore serialization
-keep class com.salino.sali.data.model.** { *; }

# Unity Ads
-keep class com.unity3d.ads.** { *; }
-keep class com.unity3d.services.** { *; }
