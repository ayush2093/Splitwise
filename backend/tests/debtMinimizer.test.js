const { minimizeDebts } = require('../utils/debtMinimizer');

describe('Cash Flow Minimizer', () => {
  test('settles simple circular debt optimally', () => {
    // A owes B 100, B owes C 100
    // Net: A owes C 100 (-100, 0, 100)
    const balances = {
      1: -100.0, // A
      2: 0.0,    // B
      3: 100.0   // C
    };
    const lookup = {
      1: 'Aisha',
      2: 'Rohan',
      3: 'Priya'
    };

    const transactions = minimizeDebts(balances, lookup);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].fromUser.name).toBe('Aisha');
    expect(transactions[0].toUser.name).toBe('Priya');
    expect(transactions[0].amount).toBe(100.0);
  });

  test('settles multiple uneven balances', () => {
    // Aisha owes 150, Rohan owes 50, Priya is owed 200
    const balances = {
      1: -150.0, // Aisha
      2: -50.0,  // Rohan
      3: 200.0   // Priya
    };
    const lookup = {
      1: 'Aisha',
      2: 'Rohan',
      3: 'Priya'
    };

    const transactions = minimizeDebts(balances, lookup);
    expect(transactions).toHaveLength(2);
    
    // Aisha pays Priya 150
    // Rohan pays Priya 50
    const tAisha = transactions.find(t => t.fromUser.name === 'Aisha');
    const tRohan = transactions.find(t => t.fromUser.name === 'Rohan');

    expect(tAisha.toUser.name).toBe('Priya');
    expect(tAisha.amount).toBe(150.0);

    expect(tRohan.toUser.name).toBe('Priya');
    expect(tRohan.amount).toBe(50.0);
  });
});
