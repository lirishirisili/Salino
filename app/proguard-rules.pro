# Proguard rules for Salino
# Add project specific ProGuard rules here.

# Firebase
-keepattributes Signature
-keepattributes *Annotation*

# Keep data model classes for Firestore serialization
-keep class com.salino.sali.data.model.** { *; }

# AdMob
-keep class com.google.android.gms.ads.** { *; }
