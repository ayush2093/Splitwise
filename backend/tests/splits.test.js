const {
  splitEqually,
  splitUnequally,
  splitByPercentage,
  splitByShare
} = require('../utils/splits');

describe('Splitwise Clone Split Calculations', () => {

  describe('Equal Splits', () => {
    test('Splits a clean amount equally', () => {
      const result = splitEqually(30.00, [1, 2, 3]);
      expect(result).toEqual([
        { userId: 1, amount: 10.00 },
        { userId: 2, amount: 10.00 },
        { userId: 3, amount: 10.00 }
      ]);
    });

    test('Splits with rounding adjustments (adds leftover cent to first participant)', () => {
      const result = splitEqually(10.00, [1, 2, 3]);
      expect(result[0].amount).toBe(3.34);
      expect(result[1].amount).toBe(3.33);
      expect(result[2].amount).toBe(3.33);
      
      const totalSum = result.reduce((sum, item) => sum + item.amount, 0);
      expect(totalSum).toBe(10.00);
    });

    test('Throws error for empty participants list', () => {
      expect(() => splitEqually(10.00, [])).toThrow('Participants list cannot be empty');
    });

    test('Throws error for zero or negative amount', () => {
      expect(() => splitEqually(-5.00, [1, 2])).toThrow('Total amount must be greater than zero');
    });
  });

  describe('Unequal Splits', () => {
    test('Validates accurate unequal splits', () => {
      const splits = [
        { userId: 1, amount: 4.50 },
        { userId: 2, amount: 5.50 }
      ];
      const result = splitUnequally(10.00, splits);
      expect(result).toEqual(splits);
    });

    test('Throws error if unequal splits do not sum to total', () => {
      const splits = [
        { userId: 1, amount: 4.50 },
        { userId: 2, amount: 5.00 } // Sum = 9.50, Total = 10.00
      ];
      expect(() => splitUnequally(10.00, splits)).toThrow(/must equal total amount/);
    });

    test('Throws error for negative split amount', () => {
      const splits = [
        { userId: 1, amount: -1.00 },
        { userId: 2, amount: 11.00 }
      ];
      expect(() => splitUnequally(10.00, splits)).toThrow('Split amount cannot be negative');
    });
  });

  describe('Percentage Splits', () => {
    test('Splits by percentage correctly', () => {
      const splits = [
        { userId: 1, percentage: 50 },
        { userId: 2, percentage: 30 },
        { userId: 3, percentage: 20 }
      ];
      const result = splitByPercentage(100.00, splits);
      expect(result).toEqual([
        { userId: 1, amount: 50.00, percentage: 50 },
        { userId: 2, amount: 30.00, percentage: 30 },
        { userId: 3, amount: 20.00, percentage: 20 }
      ]);
    });

    test('Splits percentage with rounding adjustment', () => {
      const splits = [
        { userId: 1, percentage: 33.33 },
        { userId: 2, percentage: 33.33 },
        { userId: 3, percentage: 33.34 }
      ];
      const result = splitByPercentage(10.00, splits);
      const totalSum = result.reduce((sum, item) => sum + item.amount, 0);
      expect(totalSum).toBe(10.00);
      // Let's verify rounding cents are distributed
      expect(result[0].amount).toBe(3.34); // base 3.33 + 0.01 leftover cent
      expect(result[1].amount).toBe(3.33);
      expect(result[2].amount).toBe(3.33);
    });

    test('Throws error if percentages do not sum to 100%', () => {
      const splits = [
        { userId: 1, percentage: 50 },
        { userId: 2, percentage: 40 }
      ];
      expect(() => splitByPercentage(10.00, splits)).toThrow('Sum of percentages (90%) must equal 100%');
    });
  });

  describe('Share Splits', () => {
    test('Splits by shares correctly', () => {
      const splits = [
        { userId: 1, share: 2 },
        { userId: 2, share: 1 },
        { userId: 3, share: 1 }
      ];
      const result = splitByShare(10.00, splits);
      expect(result).toEqual([
        { userId: 1, amount: 5.00, share: 2 },
        { userId: 2, amount: 2.50, share: 1 },
        { userId: 3, amount: 2.50, share: 1 }
      ]);
    });

    test('Splits shares with rounding adjustments', () => {
      const splits = [
        { userId: 1, share: 1 },
        { userId: 2, share: 1 },
        { userId: 3, share: 1 }
      ];
      const result = splitByShare(10.00, splits);
      expect(result[0].amount).toBe(3.34);
      expect(result[1].amount).toBe(3.33);
      expect(result[2].amount).toBe(3.33);
      
      const totalSum = result.reduce((sum, item) => sum + item.amount, 0);
      expect(totalSum).toBe(10.00);
    });

    test('Throws error for negative shares', () => {
      const splits = [
        { userId: 1, share: -1 },
        { userId: 2, share: 2 }
      ];
      expect(() => splitByShare(10.00, splits)).toThrow('Share cannot be negative');
    });

    test('Throws error for zero total shares', () => {
      const splits = [
        { userId: 1, share: 0 },
        { userId: 2, share: 0 }
      ];
      expect(() => splitByShare(10.00, splits)).toThrow('Total shares must be greater than zero');
    });
  });
});
