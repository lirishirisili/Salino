import SwiftUI

struct AddItemScreen: View {
    @StateObject private var viewModel: AddItemViewModel
    let onDone: () -> Void

    init(container: AppContainer, onDone: @escaping () -> Void) {
        _viewModel = StateObject(wrappedValue: AddItemViewModel(container: container))
        self.onDone = onDone
    }

    var body: some View {
        ItemFormView(
            titleKey: "add_item_title",
            saveKey: "item_add",
            state: viewModel.state,
            onName: viewModel.onNameChange,
            onQuantity: viewModel.onQuantityChange,
            onUnit: viewModel.onUnitChange,
            onCategory: viewModel.onCategoryChange,
            onNote: viewModel.onNoteChange,
            onRecurring: viewModel.onRecurringToggle,
            onDays: viewModel.onRecurrenceDaysChange,
            onUrgent: viewModel.onUrgentToggle,
            onSuggestion: viewModel.applySuggestion,
            onMerge: viewModel.mergeWithDuplicate,
            onSave: viewModel.addItem
        )
        .onChange(of: viewModel.state.isSaved) { _, saved in if saved { onDone() } }
    }
}

struct EditItemScreen: View {
    @StateObject private var viewModel: EditItemViewModel
    let onDone: () -> Void

    init(itemId: String, container: AppContainer, onDone: @escaping () -> Void) {
        _viewModel = StateObject(wrappedValue: EditItemViewModel(itemId: itemId, container: container))
        self.onDone = onDone
    }

    var body: some View {
        ItemFormView(
            titleKey: "edit_item_title",
            saveKey: "item_save",
            state: viewModel.state,
            onName: viewModel.onNameChange,
            onQuantity: viewModel.onQuantityChange,
            onUnit: viewModel.onUnitChange,
            onCategory: viewModel.onCategoryChange,
            onNote: viewModel.onNoteChange,
            onRecurring: viewModel.onRecurringToggle,
            onDays: viewModel.onRecurrenceDaysChange,
            onUrgent: viewModel.onUrgentToggle,
            onSuggestion: { _ in },
            onMerge: viewModel.mergeWithDuplicate,
            onSave: viewModel.saveItem,
            onDelete: viewModel.deleteItem
        )
        .onChange(of: viewModel.state.isSaved) { _, saved in if saved { onDone() } }
        .onChange(of: viewModel.state.isDeleted) { _, deleted in if deleted { onDone() } }
    }
}

private struct ItemFormView: View {
    var titleKey: String
    var saveKey: String
    var state: ItemFormState
    var onName: (String) -> Void
    var onQuantity: (String) -> Void
    var onUnit: (ItemUnit?) -> Void
    var onCategory: (ItemCategory) -> Void
    var onNote: (String) -> Void
    var onRecurring: (Bool) -> Void
    var onDays: (String) -> Void
    var onUrgent: (Bool) -> Void
    var onSuggestion: (SuggestionItem) -> Void
    var onMerge: () -> Void
    var onSave: () -> Void
    var onDelete: (() -> Void)?

    @State private var showDeleteConfirm = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if state.isLoading && state.name.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).padding()
                }

                if !state.suggestions.isEmpty {
                    SurfaceCard {
                        Text(LocalizedStringKey("suggestions_title")).font(.headline)
                        Text(LocalizedStringKey("suggestions_subtitle_add"))
                            .font(.caption)
                            .foregroundStyle(SalinoColors.secondaryText)
                        SuggestionChips(suggestions: state.suggestions, onTap: onSuggestion)
                    }
                }

                if let duplicate = state.duplicateMatch {
                    duplicateWarning(duplicate)
                }

                SurfaceCard {
                    Text(LocalizedStringKey("item_name_label"))
                        .font(.title3.weight(.bold))
                    TextField(LocalizedStringKey("item_name_hint"), text: Binding(get: { state.name }, set: onName))
                        .padding(12)
                        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))

                    if state.errorMessage == "empty_name" {
                        Text(LocalizedStringKey("item_error_empty_name"))
                            .font(.caption)
                            .foregroundStyle(.red)
                    }

                    HStack {
                        TextField(LocalizedStringKey("item_quantity_label"), text: Binding(get: { state.quantity }, set: onQuantity))
                            .keyboardType(.decimalPad)
                            .padding(12)
                            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))

                        Picker(LocalizedStringKey("item_unit_label"), selection: Binding(get: { state.unit }, set: onUnit)) {
                            Text("").tag(ItemUnit?.none)
                            ForEach(ItemUnit.allCases) { unit in
                                Text(LocalizedStringKey(unit.localizedKey)).tag(Optional(unit))
                            }
                        }
                        .pickerStyle(.menu)
                        .frame(maxWidth: 150)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text(LocalizedStringKey("item_category_label")).font(.headline)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(ItemCategory.allCases) { category in
                                    Button(localized(category.localizedKey)) {
                                        onCategory(category)
                                    }
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .foregroundStyle(state.category == category ? .white : SalinoColors.primary)
                                    .background(state.category == category ? SalinoColors.primary : SalinoColors.primarySoft, in: Capsule())
                                }
                            }
                        }
                        if state.isCategoryAutoDetected {
                            Text(String(format: localized("category_auto_detected"), localized(state.category.localizedKey)))
                                .font(.caption)
                                .foregroundStyle(SalinoColors.primary)
                        }
                    }

                    TextField(LocalizedStringKey("item_note_hint"), text: Binding(get: { state.note }, set: onNote), axis: .vertical)
                        .lineLimit(3, reservesSpace: true)
                        .padding(12)
                        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))

                    Toggle(isOn: Binding(get: { state.isRecurring }, set: onRecurring)) {
                        VStack(alignment: .leading) {
                            Text(LocalizedStringKey("recurring_toggle_title"))
                            Text(LocalizedStringKey("recurring_toggle_subtitle"))
                                .font(.caption)
                                .foregroundStyle(SalinoColors.secondaryText)
                        }
                    }

                    if state.isRecurring {
                        TextField(LocalizedStringKey("recurring_every_days_label"), text: Binding(get: { state.recurrenceDays }, set: onDays))
                            .keyboardType(.numberPad)
                            .padding(12)
                            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
                    }

                    Toggle(isOn: Binding(get: { state.isUrgent }, set: onUrgent)) {
                        VStack(alignment: .leading) {
                            Label(LocalizedStringKey("urgent_toggle_title"), systemImage: "exclamationmark.circle.fill")
                            Text(LocalizedStringKey("urgent_toggle_subtitle"))
                                .font(.caption)
                                .foregroundStyle(SalinoColors.secondaryText)
                        }
                    }
                    .tint(.red)

                    if state.errorMessage == "generic" {
                        Text(LocalizedStringKey("error_generic"))
                            .font(.caption)
                            .foregroundStyle(.red)
                    }

                    PrimaryButton(titleKey: saveKey, systemImage: "checkmark", isLoading: state.isLoading, action: onSave)
                }

                if onDelete != nil {
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        Label(LocalizedStringKey("shopping_list_delete"), systemImage: "trash")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(16)
        }
        .navigationTitle(LocalizedStringKey(titleKey))
        .navigationBarTitleDisplayMode(.inline)
        .salinoBackground()
        .alert(LocalizedStringKey("shopping_list_delete_confirm"), isPresented: $showDeleteConfirm) {
            Button(LocalizedStringKey("shopping_list_delete"), role: .destructive) { onDelete?() }
            Button(LocalizedStringKey("cancel"), role: .cancel) {}
        }
    }

    private func duplicateWarning(_ duplicate: DuplicateMatch) -> some View {
        SurfaceCard {
            Label(duplicateTitle(duplicate.reason), systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
                .font(.headline)
            Text(duplicate.item.name)
                .font(.subheadline.weight(.semibold))
            if duplicate.reason != .similarItem {
                Button(action: onMerge) {
                    Label(LocalizedStringKey("duplicate_merge_action"), systemImage: "plus.circle")
                }
                .buttonStyle(.borderedProminent)
                .tint(SalinoColors.primary)
            }
        }
    }

    private func duplicateTitle(_ reason: DuplicateReason) -> LocalizedStringKey {
        switch reason {
        case .exactDuplicate: "duplicate_warning_title"
        case .possibleDuplicate: "duplicate_warning_fuzzy"
        case .similarItem: "duplicate_warning_similar"
        }
    }
}
