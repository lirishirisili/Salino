import { ShoppingItem, ItemStatus, SuggestionItem, RecurringItem } from '../models';
import { buildSuggestions } from '../services/suggestionEngine';

export function partitionShoppingItems(items: ShoppingItem[]) {
  const activeItems = items.filter((i) => i.status === ItemStatus.ACTIVE);
  const boughtItems = items.filter((i) => i.status === ItemStatus.BOUGHT);
  return { activeItems, boughtItems };
}

export function buildShoppingListState(items: ShoppingItem[], recurringItems: RecurringItem[]) {
  const { activeItems, boughtItems } = partitionShoppingItems(items);
  const suggestions: SuggestionItem[] = buildSuggestions(activeItems, boughtItems, recurringItems);
  return { items, activeItems, boughtItems, suggestions, recurringItems };
}
