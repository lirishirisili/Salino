import { ShoppingItem, ItemStatus, SuggestionItem, RecurringItem } from '../models';
import { buildSuggestions } from '../services/suggestionEngine';
import { sortShoppingItems } from '../local/itemOrder';

export { sortShoppingItems } from '../local/itemOrder';

export function partitionShoppingItems(items: ShoppingItem[]) {
  const activeItems = items.filter((i) => i.status === ItemStatus.ACTIVE);
  const boughtItems = items.filter((i) => i.status === ItemStatus.BOUGHT);
  return { activeItems, boughtItems };
}

export function buildShoppingListState(items: ShoppingItem[], recurringItems: RecurringItem[]) {
  const sorted = sortShoppingItems(items);
  const { activeItems, boughtItems } = partitionShoppingItems(sorted);
  const suggestions: SuggestionItem[] = buildSuggestions(activeItems, boughtItems, recurringItems);
  return { items: sorted, activeItems, boughtItems, suggestions, recurringItems };
}
