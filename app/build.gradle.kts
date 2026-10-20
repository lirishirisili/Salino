plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
    alias(libs.plugins.google.services)
}

android {
    namespace = "com.salino.sali"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.salino.sali"
        minSdk = 26
        targetSdk = 36
        versionCode = 70
        versionName = "1.3.49"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            storeFile = file("../salino-upload-key.jks")
            storePassword = "XkHbU1787570@"
            keyAlias = "Salino"
            keyPassword = "XkHbU1787570@"
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

composeCompiler {
    enableStrongSkippingMode = true
}

dependencies {
    // Core
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.compose)

    // Compose
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.compose.ui.tooling.preview)

    // Lifecycle
    implementation(libs.lifecycle.runtime.ktx)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.process)

    // Navigation
    implementation(libs.navigation.compose)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // Firebase
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)
    implementation(libs.firebase.analytics)
    implementation(libs.firebase.functions)
    implementation(libs.firebase.messaging)

    // Coroutines
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)

    // DataStore
    implementation(libs.androidx.datastore.preferences)

    // Room
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    // Google Sign-In
    implementation(libs.play.services.auth)

    // Appodeal SDK 4.3.0 — mediation only, BANNER adapters, NO AdMob / GAM / UA services.
    // Generated from https://docs.appodeal.com/android/advanced/configure-mediated-networks
    // with Google AdMob + Google Ad Manager unchecked; Adjust/AppsFlyer/Firebase/Meta Analytics excluded.
    implementation("com.appodeal.ads.sdk:core:4.3.0")
    // BidMachine
    implementation("io.bidmachine:ads.networks.amazon:12.0.0.0")
    implementation("io.bidmachine:ads.networks.meta_audience:6.21.0.1")
    implementation("io.bidmachine:ads.networks.mintegral:17.1.61.1")
    implementation("io.bidmachine:ads.networks.my_target:5.47.1.2")
    implementation("io.bidmachine:ads.networks.vungle:7.7.4.0")
    // AppLovin MAX (no google-adapter / google-ad-manager-adapter)
    implementation("com.applovin.mediation:amazon-tam-adapter:11.3.1.0")
    implementation("com.applovin.mediation:bidmachine-adapter:3.7.1.0")
    implementation("com.applovin.mediation:bigoads-adapter:5.9.0.0")
    implementation("com.applovin.mediation:bytedance-adapter:8.1.0.3.0")
    implementation("com.applovin.mediation:chartboost-adapter:9.10.2.0")
    implementation("com.applovin.mediation:facebook-adapter:6.21.0.0")
    implementation("com.applovin.mediation:fyber-adapter:8.4.6.0")
    implementation("com.applovin.mediation:inmobi-adapter:11.3.0.1")
    implementation("com.applovin.mediation:ironsource-adapter:9.4.4.0.0")
    implementation("com.applovin.mediation:mintegral-adapter:17.1.61.0")
    implementation("com.applovin.mediation:mobilefuse-adapter:1.11.0.0")
    implementation("com.applovin.mediation:moloco-adapter:4.3.1.0")
    implementation("com.applovin.mediation:ogury-presage-adapter:6.2.0.0")
    implementation("com.applovin.mediation:pubmatic-adapter:4.10.0.0")
    implementation("com.applovin.mediation:smaato-adapter:22.7.2.3")
    implementation("com.applovin.mediation:unityads-adapter:4.17.0.0")
    implementation("com.applovin.mediation:verve-adapter:3.7.1.0")
    implementation("com.applovin.mediation:vungle-adapter:7.7.4.0")
    implementation("com.applovin.mediation:yandex-adapter:7.17.0.0")
    // Bidon
    implementation("org.bidon:amazon-adapter:12.0.0.0")
    implementation("org.bidon:applovin-adapter:13.6.3.0")
    implementation("org.bidon:bidmachine-adapter:3.7.1.1")
    implementation("org.bidon:bigoads-adapter:5.9.0.0")
    implementation("org.bidon:chartboost-adapter:9.10.2.0")
    implementation("org.bidon:dtexchange-adapter:8.4.6.0")
    implementation("org.bidon:inmobi-adapter:11.3.0.0")
    implementation("org.bidon:ironsource-adapter:9.4.4.0")
    implementation("org.bidon:meta-adapter:6.21.0.0")
    implementation("org.bidon:mintegral-adapter:17.1.61.0")
    implementation("org.bidon:mobilefuse-adapter:1.11.0.0")
    implementation("org.bidon:moloco-adapter:4.3.1.0")
    implementation("org.bidon:startio-adapter:5.2.4.1")
    implementation("org.bidon:taurusx-adapter:1.12.2.0")
    implementation("org.bidon:unityads-adapter:4.17.0.0")
    implementation("org.bidon:vkads-adapter:5.47.1.0")
    implementation("org.bidon:vungle-adapter:7.7.4.0")
    implementation("org.bidon:yandex-adapter:7.17.0.0")
    implementation("org.bidon:zmaticoo-adapter:2.0.7.0.0")
    // Level Play (Appodeal mediation engine demand — no admob-adapter)
    implementation("com.unity3d.ads-mediation:applovin-adapter:5.8.0")
    implementation("com.unity3d.ads-mediation:bidmachine-adapter:5.7.0")
    implementation("com.unity3d.ads-mediation:bigo-adapter:5.8.0")
    implementation("com.unity3d.ads-mediation:facebook-adapter:5.3.0")
    implementation("com.unity3d.ads-mediation:fyber-adapter:5.9.0")
    implementation("com.unity3d.ads-mediation:inmobi-adapter:5.7.0")
    implementation("com.unity3d.ads-mediation:mintegral-adapter:5.18.0")
    implementation("com.unity3d.ads-mediation:mobilefuse-adapter:5.3.0")
    implementation("com.unity3d.ads-mediation:moloco-adapter:5.6.0")
    implementation("com.unity3d.ads-mediation:mytarget-adapter:5.5.0")
    implementation("com.unity3d.ads-mediation:ogury-adapter:5.2.0")
    implementation("com.unity3d.ads-mediation:pangle-adapter:5.18.0")
    implementation("com.unity3d.ads-mediation:unityads-adapter:5.6.0")
    implementation("com.unity3d.ads-mediation:verve-adapter:5.2.0")
    implementation("com.unity3d.ads-mediation:vungle-adapter:5.10.0")
    // Appodeal adapters (explicitly omit :admob and UA service adapters)
    implementation("com.appodeal.ads.sdk.adapters:amazon:12.0.0.0")
    implementation("com.appodeal.ads.sdk.adapters:applovin:13.6.3.0")
    implementation("com.appodeal.ads.sdk.adapters:applovin_max:13.6.3.1")
    implementation("com.appodeal.ads.sdk.adapters:bidmachine:3.7.1.0")
    implementation("com.appodeal.ads.sdk.adapters:bidon:0.14.0.0")
    implementation("com.appodeal.ads.sdk.adapters:bigo_ads:5.9.0.0")
    implementation("com.appodeal.ads.sdk.adapters:chartboost:9.10.2.0")
    implementation("com.appodeal.ads.sdk.adapters:dt_exchange:8.4.6.0")
    implementation("com.appodeal.ads.sdk.adapters:iab:1.8.1.0")
    implementation("com.appodeal.ads.sdk.adapters:inmobi:11.3.0.0")
    implementation("com.appodeal.ads.sdk.adapters:ironsource:9.4.4.0")
    implementation("com.appodeal.ads.sdk.adapters:level_play:9.4.4.0")
    implementation("com.appodeal.ads.sdk.adapters:meta:6.21.0.0")
    implementation("com.appodeal.ads.sdk.adapters:mintegral:17.1.61.0")
    implementation("com.appodeal.ads.sdk.adapters:mobilefuse:1.11.0.0")
    implementation("com.appodeal.ads.sdk.adapters:moloco:4.3.1.0")
    implementation("com.appodeal.ads.sdk.adapters:my_target:5.47.1.0")
    implementation("com.appodeal.ads.sdk.adapters:ogury:6.2.0.0")
    implementation("com.appodeal.ads.sdk.adapters:pubmatic:4.10.0.0")
    implementation("com.appodeal.ads.sdk.adapters:sentry_analytics:8.44.1.0")
    implementation("com.appodeal.ads.sdk.adapters:smaato:22.7.2.0")
    implementation("com.appodeal.ads.sdk.adapters:startio:5.2.4.0")
    implementation("com.appodeal.ads.sdk.adapters:taurusx:1.12.2.0")
    implementation("com.appodeal.ads.sdk.adapters:unity_ads:4.17.0.0")
    implementation("com.appodeal.ads.sdk.adapters:verve:3.7.1.0")
    implementation("com.appodeal.ads.sdk.adapters:vungle:7.7.4.0")
    implementation("com.appodeal.ads.sdk.adapters:yandex:7.17.0.0")

    implementation(libs.play.services.appset)
    implementation(libs.play.services.ads.identifier)
    implementation(libs.play.services.basement)

    // Testing
    testImplementation("junit:junit:4.13.2")
}

// Explicitly keep Google Mobile Ads / AdMob out of the classpath (no AdMob App ID in manifest).
// Do not exclude play-services-ads-lite — Stack Consent Manager / UMP may need it.
configurations.configureEach {
    exclude(group = "com.appodeal.ads.sdk.adapters", module = "admob")
    exclude(group = "com.appodeal.ads.sdk.networks", module = "admob")
    exclude(group = "com.google.android.gms", module = "play-services-ads")
    exclude(group = "com.applovin.mediation", module = "google-adapter")
    exclude(group = "com.applovin.mediation", module = "google-ad-manager-adapter")
    exclude(group = "com.unity3d.ads-mediation", module = "admob-adapter")

    // Appodeal adapters may pull kotlin-stdlib 2.3.x; keep toolchain on project Kotlin 2.0.10.
    resolutionStrategy {
        force("org.jetbrains.kotlin:kotlin-stdlib:2.0.10")
        force("org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.0.10")
        force("org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.0.10")
        force("org.jetbrains.kotlin:kotlin-stdlib-common:2.0.10")
    }
}
