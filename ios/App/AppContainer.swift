import Foundation
import Combine
import SwiftData

@MainActor
final class AppContainer: ObservableObject {
    let localStore: LocalStore

    let authRepository: AuthRepository
    let householdRepository: HouseholdRepository
    let shoppingRepository: ShoppingRepository
    let recurringRepository: RecurringRepository
    let activityRepository: ActivityRepository
    let suggestionsRepository: SuggestionsRepository

    let categoryAutoDetector: CategoryAutoDetector
    let duplicateDetector: DuplicateDetector
    let suggestionEngine: SuggestionEngine
    let voiceInputParser: VoiceInputParser

    private init(localStore: LocalStore) {
        self.localStore = localStore

        let shoppingRemoteDataSource = ShoppingRemoteDataSource()
        let recurringRemoteDataSource = RecurringRemoteDataSource()
        let activityRemoteDataSource = ActivityRemoteDataSource()
        let householdRemoteDataSource = HouseholdRemoteDataSource()

        let authRepository = FirebaseAuthRepository(localStore: localStore)
        let syncQueueProcessor = SyncQueueProcessor(
            localStore: localStore,
            shoppingRemoteDataSource: shoppingRemoteDataSource,
            activityRemoteDataSource: activityRemoteDataSource,
            recurringRemoteDataSource: recurringRemoteDataSource
        )

        let shoppingRepository = ShoppingRepositoryImpl(
            localStore: localStore,
            remoteDataSource: shoppingRemoteDataSource,
            authRepository: authRepository,
            syncQueueProcessor: syncQueueProcessor
        )
        let recurringRepository = RecurringRepositoryImpl(
            localStore: localStore,
            remoteDataSource: recurringRemoteDataSource,
            authRepository: authRepository,
            syncQueueProcessor: syncQueueProcessor
        )
        let activityRepository = ActivityRepositoryImpl(
            localStore: localStore,
            remoteDataSource: activityRemoteDataSource,
            syncQueueProcessor: syncQueueProcessor
        )

        let normalizer = ItemTextNormalizer()
        let phraseMatcher = ProtectedPhraseMatcher()
        let extractor = ProductSignatureExtractor(normalizer: normalizer, phraseMatcher: phraseMatcher)
        let comparisonEngine = SignatureComparisonEngine(normalizer: normalizer)
        let suggestionEngine = RuleBasedSuggestionEngine()

        self.authRepository = authRepository
        self.householdRepository = HouseholdRepositoryImpl(
            remoteDataSource: householdRemoteDataSource,
            localStore: localStore,
            authRepository: authRepository
        )
        self.shoppingRepository = shoppingRepository
        self.recurringRepository = recurringRepository
        self.activityRepository = activityRepository
        self.suggestionsRepository = SuggestionsRepositoryImpl(
            shoppingRepository: shoppingRepository,
            recurringRepository: recurringRepository,
            suggestionEngine: suggestionEngine
        )
        self.categoryAutoDetector = KeywordCategoryAutoDetector()
        self.duplicateDetector = NormalizedDuplicateDetector(
            normalizer: normalizer,
            extractor: extractor,
            comparisonEngine: comparisonEngine
        )
        self.suggestionEngine = suggestionEngine
        self.voiceInputParser = KeywordVoiceInputParser()
    }

    static func bootstrap() -> AppContainer {
        do {
            return AppContainer(localStore: LocalStore(container: try LocalStore.makeDefaultContainer()))
        } catch {
            do {
                return AppContainer(localStore: LocalStore(container: try LocalStore.makeDefaultContainer(inMemory: true)))
            } catch {
                preconditionFailure("Unable to initialize SwiftData storage.")
            }
        }
    }
}
