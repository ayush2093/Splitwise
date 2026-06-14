/**
 * Cash Flow Minimizer (Optimal Debt Settlement Algorithm)
 * 
 * Takes a map of user net balances: { userId: netBalance }
 * and returns the minimum set of transactions (from, to, amount) to settle all debts.
 */
function minimizeDebts(userBalances, usersLookup = {}) {
  const debtors = [];
  const creditors = [];

  // Separate debtors and creditors
  Object.keys(userBalances).forEach(uId => {
    const userId = parseInt(uId);
    const balance = parseFloat(userBalances[uId].toFixed(2));
    const userName = usersLookup[userId] || `User_${userId}`;

    if (balance < -0.005) {
      debtors.push({ userId, userName, balance: Math.abs(balance) });
    } else if (balance > 0.005) {
      creditors.push({ userId, userName, balance });
    }
  });

  // Sort debtors and creditors descending by balance
  debtors.sort((a, b) => b.balance - a.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  const transactions = [];
  let dIdx = 0;
  let cIdx = 0;

  // Greedily match largest debtor with largest creditor
  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const amountToSettle = Math.min(debtor.balance, creditor.balance);
    
    // Round to 2 decimal places to prevent float issues
    const roundedAmount = parseFloat(amountToSettle.toFixed(2));

    if (roundedAmount > 0.005) {
      transactions.push({
        fromUser: { id: debtor.userId, name: debtor.userName },
        toUser: { id: creditor.userId, name: creditor.userName },
        amount: roundedAmount
      });
    }

    debtor.balance = parseFloat((debtor.balance - amountToSettle).toFixed(2));
    creditor.balance = parseFloat((creditor.balance - amountToSettle).toFixed(2));

    if (debtor.balance <= 0.005) {
      dIdx++;
    }
    if (creditor.balance <= 0.005) {
      cIdx++;
    }
  }

  return transactions;
}

module.exports = {
  minimizeDebts
};
