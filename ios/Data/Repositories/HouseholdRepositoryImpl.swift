import Foundation
import FirebaseFirestore

@MainActor
final class HouseholdRepositoryImpl: HouseholdRepository {
    private let remoteDataSource: HouseholdRemoteDataSource
    private let localStore: LocalStore
    private let authRepository: AuthRepository
    private var householdListeners: [String: ListenerRegistration] = [:]
    private var memberListeners: [String: ListenerRegistration] = [:]

    init(remoteDataSource: HouseholdRemoteDataSource, localStore: LocalStore, authRepository: AuthRepository) {
        self.remoteDataSource = remoteDataSource
        self.localStore = localStore
        self.authRepository = authRepository
    }

    func createHousehold(name: String) async throws -> Household {
        guard let user = await firstCurrentUser() else { throw FirebaseConfigurationError.missingCurrentUser }
        let household = try await remoteDataSource.createHousehold(userId: user.id, displayName: user.displayName, name: name)
        localStore.cacheHousehold(household)
        return household
    }

    func joinHousehold(inviteCode: String) async throws -> Household {
        guard let user = await firstCurrentUser() else { throw FirebaseConfigurationError.missingCurrentUser }
        let household = try await remoteDataSource.joinHousehold(userId: user.id, displayName: user.displayName, inviteCode: inviteCode)
        localStore.cacheHousehold(household)
        return household
    }

    func getHousehold(householdId: String) async throws -> Household {
        if let local = localStore.fetchHousehold(householdId: householdId) {
            Task { @MainActor in
                if let remote = try? await remoteDataSource.getHousehold(householdId: householdId) {
                    localStore.cacheHousehold(remote)
                }
            }
            return local
        }
        let remote = try await remoteDataSource.getHousehold(householdId: householdId)
        localStore.cacheHousehold(remote)
        return remote
    }

    func observeHousehold(householdId: String) -> AsyncStream<Household?> {
        ensureHouseholdSync(householdId)
        return localStore.observeHousehold(householdId: householdId)
    }

    func observeHouseholdMembers(householdId: String) -> AsyncStream<[HouseholdMember]> {
        ensureMembersSync(householdId)
        return localStore.observeMembers(householdId: householdId)
    }

    func getInviteCode(householdId: String) async throws -> String {
        try await getHousehold(householdId: householdId).inviteCode
    }

    func updateHouseholdName(householdId: String, newName: String) async throws {
        try await remoteDataSource.updateHouseholdName(householdId: householdId, newName: newName)
    }

    func leaveHousehold(householdId: String) async throws {
        guard let user = await firstCurrentUser() else { throw FirebaseConfigurationError.missingCurrentUser }
        householdListeners.removeValue(forKey: householdId)?.remove()
        memberListeners.removeValue(forKey: householdId)?.remove()
        try await remoteDataSource.leaveHousehold(householdId: householdId, userId: user.id)
        localStore.clearHouseholdData(householdId: householdId)
    }

    func clearListeners() {
        householdListeners.values.forEach { $0.remove() }
        householdListeners.removeAll()
        memberListeners.values.forEach { $0.remove() }
        memberListeners.removeAll()
    }

    private func ensureHouseholdSync(_ householdId: String) {
        guard householdListeners[householdId] == nil else { return }
        householdListeners[householdId] = remoteDataSource.listenToHousehold(householdId: householdId) { [weak self] household in
            Task { @MainActor in self?.localStore.cacheHousehold(household) }
        }
    }

    private func ensureMembersSync(_ householdId: String) {
        guard memberListeners[householdId] == nil else { return }
        memberListeners[householdId] = remoteDataSource.listenToMembers(householdId: householdId) { [weak self] members in
            Task { @MainActor in self?.localStore.replaceMembers(householdId: householdId, members: members) }
        }
    }

    private func firstCurrentUser() async -> UserProfile? {
        for await user in authRepository.observeCurrentUser() {
            return user
        }
        return nil
    }
}
