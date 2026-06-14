const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { minimizeDebts } = require('../utils/debtMinimizer');

router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Get all active group memberships of the user
    const groupsResult = await db.query(
      `SELECT g.id, g.name, gm.joined_at
       FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1 AND gm.is_active = TRUE`,
      [userId]
    );
    const userGroups = groupsResult.rows;

    if (userGroups.length === 0) {
      return res.json({
        groups: [],
        netBalance: 0,
        owedAmount: 0, // overall amount you are owed
        oweAmount: 0,  // overall amount you owe
        debtsSummary: []
      });
    }

    const groupIds = userGroups.map(g => g.id);

    // 2. Fetch all members for these groups
    const membersResult = await db.query(
      `SELECT gm.group_id, u.id as user_id, u.name as user_name, u.email
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ANY($1)`,
      [groupIds]
    );

    // Map group_id -> member list and user lookup map
    const groupMembersMap = {};
    const usersLookup = {};
    membersResult.rows.forEach(r => {
      if (!groupMembersMap[r.group_id]) {
        groupMembersMap[r.group_id] = [];
      }
      groupMembersMap[r.group_id].push({ id: r.user_id, name: r.user_name });
      usersLookup[r.user_id] = r.user_name;
    });

    // 3. Fetch all expenses in these groups
    const expensesResult = await db.query(
      `SELECT id, group_id, amount, paid_by
       FROM expenses
       WHERE group_id = ANY($1)`,
      [groupIds]
    );

    // 4. Fetch all expense splits in these groups
    const splitsResult = await db.query(
      `SELECT es.expense_id, es.user_id, es.amount, e.group_id, e.paid_by
       FROM expense_splits es
       JOIN expenses e ON es.expense_id = e.id
       WHERE e.group_id = ANY($1)`,
      [groupIds]
    );

    // 5. Fetch all payments in these groups
    const paymentsResult = await db.query(
      `SELECT group_id, from_user_id, to_user_id, amount
       FROM payments
       WHERE group_id = ANY($1)`,
      [groupIds]
    );

    // Compute net balance and pairwise debts per group
    const groupsSummary = [];
    const overallPairwiseDebts = {}; // counterpartUserId -> net balance (positive means they owe user, negative means user owes them)
    const globalBalances = {};

    groupIds.forEach(gId => {
      const groupName = userGroups.find(g => g.id === gId).name;
      const groupExpenses = expensesResult.rows.filter(e => e.group_id === gId);
      const groupSplits = splitsResult.rows.filter(s => s.group_id === gId);
      const groupPayments = paymentsResult.rows.filter(p => p.group_id === gId);
      const groupMembers = groupMembersMap[gId] || [];

      // Calculate totals per user in this group
      const uMap = {};
      groupMembers.forEach(m => {
        uMap[m.id] = { id: m.id, name: m.name, paid: 0, owed: 0, sent: 0, received: 0 };
      });

      groupExpenses.forEach(e => {
        if (uMap[e.paid_by]) uMap[e.paid_by].paid += parseFloat(e.amount);
      });
      groupSplits.forEach(s => {
        if (uMap[s.user_id]) uMap[s.user_id].owed += parseFloat(s.amount);
      });
      groupPayments.forEach(p => {
        if (uMap[p.from_user_id]) uMap[p.from_user_id].sent += parseFloat(p.amount);
        if (uMap[p.to_user_id]) uMap[p.to_user_id].received += parseFloat(p.amount);
      });

      // User's balance in this group
      let groupNetBalance = 0;
      if (uMap[userId]) {
        const u = uMap[userId];
        groupNetBalance = (u.paid + u.sent) - (u.owed + u.received);
      }

      groupsSummary.push({
        id: gId,
        name: groupName,
        netBalance: parseFloat(groupNetBalance.toFixed(2))
      });

      // Accumulate to global balances
      groupMembers.forEach(m => {
        const u = uMap[m.id];
        const groupNet = (u.paid + u.sent) - (u.owed + u.received);
        if (!globalBalances[m.id]) {
          globalBalances[m.id] = 0;
        }
        globalBalances[m.id] += groupNet;
      });

      // Calculate pairwise direct debts in this group
      const directDebts = {};
      const mIds = groupMembers.map(m => m.id);
      mIds.forEach(idA => {
        directDebts[idA] = {};
        mIds.forEach(idB => {
          directDebts[idA][idB] = 0;
        });
      });

      // Sum splits: payer receives, splits owe
      groupExpenses.forEach(e => {
        const payerId = e.paid_by;
        const eSplits = groupSplits.filter(s => s.expense_id === e.id);
        eSplits.forEach(s => {
          if (s.user_id !== payerId) {
            if (directDebts[s.user_id] && directDebts[s.user_id][payerId] !== undefined) {
              directDebts[s.user_id][payerId] += parseFloat(s.amount);
            }
          }
        });
      });

      // Subtract settlements
      groupPayments.forEach(p => {
        if (directDebts[p.from_user_id] && directDebts[p.from_user_id][p.to_user_id] !== undefined) {
          directDebts[p.from_user_id][p.to_user_id] -= parseFloat(p.amount);
        }
      });

      // Accumulate to overall pairwise debts
      // For each pair involving current user:
      mIds.forEach(otherId => {
        if (otherId !== userId) {
          const debtUserToOther = directDebts[userId][otherId];
          const debtOtherToUser = directDebts[otherId][userId];
          const netGroupDebt = debtOtherToUser - debtUserToOther; // Positive means they owe user, negative means user owes them

          if (!overallPairwiseDebts[otherId]) {
            overallPairwiseDebts[otherId] = 0;
          }
          overallPairwiseDebts[otherId] += netGroupDebt;
        }
      });
    });

    // Format consolidated debts list
    let overallNetBalance = 0;
    let overallOwedAmount = 0;
    let overallOweAmount = 0;
    const debtsSummary = [];

    Object.keys(overallPairwiseDebts).forEach(otherId => {
      const netVal = overallPairwiseDebts[otherId];
      overallNetBalance += netVal;

      if (netVal > 0.005) {
        overallOwedAmount += netVal;
        debtsSummary.push({
          userId: parseInt(otherId),
          userName: usersLookup[otherId],
          status: 'owed', // this user owes you
          amount: parseFloat(netVal.toFixed(2))
        });
      } else if (netVal < -0.005) {
        overallOweAmount += Math.abs(netVal);
        debtsSummary.push({
          userId: parseInt(otherId),
          userName: usersLookup[otherId],
          status: 'owe', // you owe this user
          amount: parseFloat(Math.abs(netVal).toFixed(2))
        });
      }
    });

    // Minimized optimal payments
    const minimizedDebts = minimizeDebts(globalBalances, usersLookup);

    res.json({
      groups: groupsSummary,
      netBalance: parseFloat(overallNetBalance.toFixed(2)),
      owedAmount: parseFloat(overallOwedAmount.toFixed(2)),
      oweAmount: parseFloat(overallOweAmount.toFixed(2)),
      debtsSummary,
      minimizedDebts
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
