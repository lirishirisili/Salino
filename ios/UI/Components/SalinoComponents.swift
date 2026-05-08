import SwiftUI

struct BrandHeader: View {
    var subtitleKey: String?

    var body: some View {
        VStack(spacing: 12) {
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(maxWidth: 220, maxHeight: 90)
                .accessibilityHidden(true)
            if let subtitleKey {
                Text(LocalizedStringKey(subtitleKey))
                    .font(.subheadline)
                    .foregroundStyle(SalinoColors.secondaryText)
                    .multilineTextAlignment(.center)
            }
        }
    }
}

struct SurfaceCard<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            content
        }
        .padding(16)
        .background(SalinoColors.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(SalinoColors.border.opacity(0.7), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.06), radius: 12, x: 0, y: 6)
    }
}

struct PrimaryButton: View {
    var titleKey: String
    var systemImage: String?
    var isLoading = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                if isLoading {
                    ProgressView().tint(.white)
                } else if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(LocalizedStringKey(titleKey))
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
        }
        .buttonStyle(.plain)
        .foregroundStyle(.white)
        .background(SalinoColors.primary, in: Capsule())
    }
}

struct EmptyStateView: View {
    var systemImage: String
    var titleKey: String
    var subtitleKey: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(SalinoColors.primary)
            Text(LocalizedStringKey(titleKey))
                .font(.title3.weight(.semibold))
            Text(LocalizedStringKey(subtitleKey))
                .font(.subheadline)
                .foregroundStyle(SalinoColors.secondaryText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}

struct SuggestionChips: View {
    var suggestions: [SuggestionItem]
    var onTap: (SuggestionItem) -> Void

    var body: some View {
        if !suggestions.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(suggestions) { suggestion in
                        Button {
                            onTap(suggestion)
                        } label: {
                            Label(suggestion.name, systemImage: "plus")
                                .font(.subheadline.weight(.medium))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(SalinoColors.primarySoft, in: Capsule())
                                .foregroundStyle(SalinoColors.primary)
                        }
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }
}

struct ShoppingItemRow: View {
    var item: ShoppingItem
    var bought: Bool = false
    var onToggleBought: () -> Void
    var onEdit: () -> Void
    var onDelete: (() -> Void)?
    var onFavorite: (() -> Void)?

    var body: some View {
        HStack(spacing: 12) {
            Button(action: onToggleBought) {
                Image(systemName: bought ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(bought ? SalinoColors.primary : SalinoColors.border)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(item.name)
                        .font(.body.weight(.semibold))
                        .strikethrough(bought)
                    if item.isUrgent {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
                Text(metaText)
                    .font(.caption)
                    .foregroundStyle(SalinoColors.secondaryText)
            }
            Spacer()
            if let onFavorite {
                Button(action: onFavorite) {
                    Image(systemName: item.isFavorite ? "star.fill" : "star")
                        .foregroundStyle(item.isFavorite ? .yellow : SalinoColors.border)
                }
                .buttonStyle(.plain)
            }
            Button(action: onEdit) {
                Image(systemName: "chevron.forward")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(SalinoColors.secondaryText)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 8)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if let onDelete {
                Button(role: .destructive, action: onDelete) {
                    Label(LocalizedStringKey("shopping_list_delete"), systemImage: "trash")
                }
            }
        }
    }

    private var metaText: String {
        let quantity = formatQuantity(item.quantity)
        let unit = item.unit.map { localized($0.localizedKey) } ?? ""
        let category = localized(item.category.localizedKey)
        return [quantity, unit, category].filter { !$0.isEmpty }.joined(separator: " - ")
    }
}
