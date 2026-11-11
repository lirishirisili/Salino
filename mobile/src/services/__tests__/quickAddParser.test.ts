import { ItemUnit } from '../../models';
import { parseQuickAddLine, parseQuickAddText } from '../quickAddParser';

describe('parseQuickAddLine', () => {
  it('keeps a plain name with quantity 1', () => {
    expect(parseQuickAddLine('חלב')).toEqual({ name: 'חלב', quantity: 1, unit: null });
    expect(parseQuickAddLine('גבינה צהובה')).toEqual({ name: 'גבינה צהובה', quantity: 1, unit: null });
  });

  it('reads a leading or trailing quantity', () => {
    expect(parseQuickAddLine('2 חלב')).toEqual({ name: 'חלב', quantity: 2, unit: null });
    expect(parseQuickAddLine('ביצים 12')).toEqual({ name: 'ביצים', quantity: 12, unit: null });
    expect(parseQuickAddLine('לחם x2')).toEqual({ name: 'לחם', quantity: 2, unit: null });
    expect(parseQuickAddLine('3x tomatoes')).toEqual({ name: 'tomatoes', quantity: 3, unit: null });
  });

  it('reads Hebrew units (no \\b word boundaries)', () => {
    expect(parseQuickAddLine('חלב 3 ליטר')).toEqual({ name: 'חלב', quantity: 3, unit: ItemUnit.LITERS });
    expect(parseQuickAddLine('2 קילו עגבניות')).toEqual({ name: 'עגבניות', quantity: 2, unit: ItemUnit.KG });
    expect(parseQuickAddLine('1,5 ק"ג תפוחים')).toEqual({ name: 'תפוחים', quantity: 1.5, unit: ItemUnit.KG });
    expect(parseQuickAddLine('מים שישייה בקבוקים')).toEqual({
      name: 'מים שישייה',
      quantity: 1,
      unit: ItemUnit.BOTTLES,
    });
  });

  it('does not eat a lone number or a unit-only name', () => {
    expect(parseQuickAddLine('7')).toEqual({ name: '7', quantity: 1, unit: null });
    expect(parseQuickAddLine('ליטר')).toEqual({ name: 'ליטר', quantity: 1, unit: null });
  });

  it('strips list markers', () => {
    expect(parseQuickAddLine('- חלב')?.name).toBe('חלב');
    expect(parseQuickAddLine('• 2 לחם')).toEqual({ name: 'לחם', quantity: 2, unit: null });
    expect(parseQuickAddLine('3. ביצים')?.name).toBe('ביצים');
    expect(parseQuickAddLine('[ ] קפה')?.name).toBe('קפה');
  });
});

describe('parseQuickAddText', () => {
  it('splits a pasted WhatsApp list by lines', () => {
    const items = parseQuickAddText('רשימה:\n- חלב\n- 2 לחם\n\n• ביצים 12\n');
    // The "רשימה:" header line is dropped.
    expect(items.map((i) => i.name)).toEqual(['חלב', 'לחם', 'ביצים']);
    expect(items[1].quantity).toBe(2);
    expect(items[2].quantity).toBe(12);
  });

  it('splits commas and Arabic commas on one line', () => {
    expect(parseQuickAddText('חלב, לחם ,ביצים').map((i) => i.name)).toEqual(['חלב', 'לחם', 'ביצים']);
    expect(parseQuickAddText('حليب، خبز').length).toBe(2);
  });

  it('a single item stays a single item', () => {
    expect(parseQuickAddText('2 חלב')).toEqual([{ name: 'חלב', quantity: 2, unit: null }]);
  });
});
