package com.salino.sali.di

import android.content.Context
import androidx.room.Room
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.salino.sali.data.local.CategoryClassificationCache
import com.salino.sali.data.local.CategoryClassificationStore
import com.salino.sali.data.local.SalinoDatabase
import com.salino.sali.data.repository.ActivityRepositoryImpl
import com.salino.sali.data.repository.AuthRepositoryImpl
import com.salino.sali.data.repository.HouseholdRepositoryImpl
import com.salino.sali.data.repository.RecurringRepositoryImpl
import com.salino.sali.data.repository.ShoppingRepositoryImpl
import com.salino.sali.data.repository.SuggestionsRepositoryImpl
import com.salino.sali.data.service.NormalizedDuplicateDetector
import com.salino.sali.data.service.RuleBasedSuggestionEngine
import com.salino.sali.data.service.FirebaseAiCategoryClassifier
import com.salino.sali.data.service.KeywordCategoryAutoDetector
import com.salino.sali.data.service.KeywordVoiceInputParser
import com.salino.sali.data.service.duplicate.ItemTextNormalizer
import com.salino.sali.data.service.duplicate.ProductSignatureExtractor
import com.salino.sali.data.service.duplicate.ProtectedPhraseMatcher
import com.salino.sali.data.service.duplicate.SignatureComparisonEngine
import com.salino.sali.domain.repository.ActivityRepository
import com.salino.sali.data.repository.OnboardingRepositoryImpl
import com.salino.sali.domain.repository.AuthRepository
import com.salino.sali.domain.repository.HouseholdRepository
import com.salino.sali.domain.repository.OnboardingRepository
import com.salino.sali.domain.repository.RecurringRepository
import com.salino.sali.domain.repository.ShoppingRepository
import com.salino.sali.domain.repository.SuggestionsRepository
import com.salino.sali.domain.service.AiCategoryClassifier
import com.salino.sali.domain.service.CategoryAutoDetector
import com.salino.sali.domain.service.DuplicateDetector
import com.salino.sali.domain.service.ItemNameAutocompleteEngine
import com.salino.sali.domain.service.ItemNameAutocompleteEngineImpl
import com.salino.sali.domain.service.SuggestionEngine
import com.salino.sali.domain.service.VoiceInputParser
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideFirebaseAuth(): FirebaseAuth = FirebaseAuth.getInstance()

    @Provides
    @Singleton
    fun provideFirestore(): FirebaseFirestore = FirebaseFirestore.getInstance()

    @Provides
    @Singleton
    fun provideFirebaseFunctions(): FirebaseFunctions =
        FirebaseFunctions.getInstance("europe-west1")

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): SalinoDatabase =
        Room.databaseBuilder(context, SalinoDatabase::class.java, "salino.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun provideHouseholdDao(database: SalinoDatabase) = database.householdDao()

    @Provides
    fun provideHouseholdMemberDao(database: SalinoDatabase) = database.householdMemberDao()

    @Provides
    fun provideShoppingItemDao(database: SalinoDatabase) = database.shoppingItemDao()

    @Provides
    fun provideActivityLogDao(database: SalinoDatabase) = database.activityLogDao()

    @Provides
    fun provideRecurringItemDao(database: SalinoDatabase) = database.recurringItemDao()

    @Provides
    fun providePendingSyncDao(database: SalinoDatabase) = database.pendingSyncOperationDao()

    @Provides
    @IoDispatcher
    fun provideIoDispatcher(): CoroutineDispatcher = Dispatchers.IO

    @Provides
    @Singleton
    fun provideAuthRepository(
        auth: FirebaseAuth,
        firestore: FirebaseFirestore,
        database: SalinoDatabase
    ): AuthRepository = AuthRepositoryImpl(auth, firestore, database)

    @Provides
    @Singleton
    fun provideOnboardingRepository(
        impl: OnboardingRepositoryImpl
    ): OnboardingRepository = impl

    @Provides
    @Singleton
    fun provideHouseholdRepository(
        impl: HouseholdRepositoryImpl
    ): HouseholdRepository = impl

    @Provides
    @Singleton
    fun provideShoppingRepository(
        impl: ShoppingRepositoryImpl
    ): ShoppingRepository = impl

    @Provides
    @Singleton
    fun provideActivityRepository(
        impl: ActivityRepositoryImpl
    ): ActivityRepository = impl

    @Provides
    @Singleton
    fun provideRecurringRepository(
        impl: RecurringRepositoryImpl
    ): RecurringRepository = impl

    @Provides
    @Singleton
    fun provideSuggestionsRepository(
        impl: SuggestionsRepositoryImpl
    ): SuggestionsRepository = impl

    @Provides
    @Singleton
    fun provideItemTextNormalizer(): ItemTextNormalizer = ItemTextNormalizer()

    @Provides
    @Singleton
    fun provideProtectedPhraseMatcher(): ProtectedPhraseMatcher = ProtectedPhraseMatcher()

    @Provides
    @Singleton
    fun provideProductSignatureExtractor(
        normalizer: ItemTextNormalizer,
        phraseMatcher: ProtectedPhraseMatcher
    ): ProductSignatureExtractor = ProductSignatureExtractor(normalizer, phraseMatcher)

    @Provides
    @Singleton
    fun provideSignatureComparisonEngine(
        normalizer: ItemTextNormalizer
    ): SignatureComparisonEngine = SignatureComparisonEngine(normalizer)

    @Provides
    @Singleton
    fun provideDuplicateDetector(
        normalizer: ItemTextNormalizer,
        extractor: ProductSignatureExtractor,
        comparisonEngine: SignatureComparisonEngine
    ): DuplicateDetector = NormalizedDuplicateDetector(normalizer, extractor, comparisonEngine)

    @Provides
    @Singleton
    fun provideCategoryAutoDetector(): CategoryAutoDetector = KeywordCategoryAutoDetector()

    @Provides
    @Singleton
    fun provideAiCategoryClassifier(
        functions: FirebaseFunctions
    ): AiCategoryClassifier = FirebaseAiCategoryClassifier(functions)

    @Provides
    @Singleton
    fun provideCategoryClassificationStore(
        cache: CategoryClassificationCache
    ): CategoryClassificationStore = cache

    @Provides
    @Singleton
    fun provideSuggestionEngine(): SuggestionEngine = RuleBasedSuggestionEngine()

    @Provides
    @Singleton
    fun provideVoiceInputParser(): VoiceInputParser = KeywordVoiceInputParser()

    @Provides
    @Singleton
    fun provideItemNameAutocompleteEngine(
        impl: ItemNameAutocompleteEngineImpl
    ): ItemNameAutocompleteEngine = impl
}
