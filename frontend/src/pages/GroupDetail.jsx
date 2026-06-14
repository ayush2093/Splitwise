import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function GroupDetail({ onGroupUpdated }) {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  // Core Data State
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [balances, setBalances] = useState({});
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals visibility
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);

  // Ledger Modal State
  const [ledgerModal, setLedgerModal] = useState({ show: false, userId: null, name: '' });
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const openLedgerModal = async (memberId, name) => {
    setLedgerModal({ show: true, userId: memberId, name });
    setLedgerLoading(true);
    try {
      const data = await api.get(`/groups/${id}/ledger/${memberId}`);
      setLedgerEntries(data.entries || []);
    } catch (err) {
      console.error(err);
      alert('Failed to load ledger details: ' + err.message);
    } finally {
      setLedgerLoading(false);
    }
  };

  // Add Member Modal State
  const [memberEmail, setMemberEmail] = useState('');
  const [memberError, setMemberError] = useState('');
  const [memberSuccess, setMemberSuccess] = useState('');

  // Add Expense Modal State
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().substring(0, 10));
  const [expensePayer, setExpensePayer] = useState('');
  const [expenseSplitType, setExpenseSplitType] = useState('equal');
  const [expenseSplits, setExpenseSplits] = useState({}); // userId -> value (checkbox state, amount, percentage, or share)
  const [expenseError, setExpenseError] = useState('');

  // Settle Up Modal State
  const [settlePayer, setSettlePayer] = useState('');
  const [settlePayee, setSettlePayee] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(new Date().toISOString().substring(0, 10));
  const [settleError, setSettleError] = useState('');

  const fetchGroupDetails = async () => {
    try {
      const data = await api.get(`/groups/${id}`);
      setGroup(data.group);
      setMembers(data.members);
      setExpenses(data.expenses);
      setPayments(data.payments);
      setBalances(data.balances);
      setDebts(data.debts);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load group details.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchGroupDetails();
  }, [id]);

  // Set default form values once members are loaded
  useEffect(() => {
    if (members.length > 0) {
      // Payer defaults to current user if they are in the group, otherwise first member
      const isCurrentInGroup = members.some(m => m.id === currentUser.id && m.is_active);
      setExpensePayer(isCurrentInGroup ? currentUser.id.toString() : members[0].id.toString());
      
      // Initialize splits state
      resetSplitsState(expenseSplitType, members);
    }
  }, [members, expenseSplitType]);

  const resetSplitsState = (splitType, memberList) => {
    const activeMembers = memberList.filter(m => m.is_active);
    const initialSplits = {};
    activeMembers.forEach(m => {
      if (splitType === 'equal') {
        initialSplits[m.id] = true; // selected by default
      } else if (splitType === 'percentage') {
        initialSplits[m.id] = ''; // default empty
      } else if (splitType === 'share') {
        initialSplits[m.id] = '1'; // default 1 share
      } else {
        initialSplits[m.id] = ''; // unequal
      }
    });
    setExpenseSplits(initialSplits);
  };

  const resetExpenseForm = () => {
    setExpenseDesc('');
    setExpenseAmount('');
    setExpenseDate(new Date().toISOString().substring(0, 10));
    setExpenseSplitType('equal');
    setExpenseError('');
    if (members.length > 0) {
      const isCurrentInGroup = members.some(m => m.id === currentUser.id && m.is_active);
      setExpensePayer(isCurrentInGroup ? currentUser.id.toString() : members[0].id.toString());
      resetSplitsState('equal', members);
    }
  };

  const resetSettleForm = () => {
    setSettlePayer('');
    setSettlePayee('');
    setSettleAmount('');
    setSettleDate(new Date().toISOString().substring(0, 10));
    setSettleError('');
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setMemberError('');
    setMemberSuccess('');
    
    try {
      await api.post(`/groups/${id}/members`, { email: memberEmail });
      setMemberSuccess('Member added successfully!');
      setMemberEmail('');
      fetchGroupDetails();
      if (onGroupUpdated) onGroupUpdated();
    } catch (err) {
      setMemberError(err.message || 'Failed to add member.');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member? Historic calculations will be preserved, but they will not be able to participate in new expenses.')) {
      return;
    }
    try {
      await api.delete(`/groups/${id}/members/${memberId}`);
      fetchGroupDetails();
      if (onGroupUpdated) onGroupUpdated();
    } catch (err) {
      alert(err.message || 'Failed to remove member.');
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setExpenseError('');

    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) {
      setExpenseError('Please enter a valid amount greater than zero');
      return;
    }

    const activeMembers = members.filter(m => m.is_active);
    let splitsPayload = [];

    if (expenseSplitType === 'equal') {
      const selectedIds = Object.keys(expenseSplits).filter(k => expenseSplits[k]);
      if (selectedIds.length === 0) {
        setExpenseError('Please select at least one participant');
        return;
      }
      splitsPayload = selectedIds.map(id => parseInt(id));
    } else if (expenseSplitType === 'unequal') {
      let sum = 0;
      for (const m of activeMembers) {
        const val = parseFloat(expenseSplits[m.id]);
        if (isNaN(val) || val < 0) {
          setExpenseError(`Please enter a valid amount for ${m.name}`);
          return;
        }
        sum += val;
        splitsPayload.push({ userId: m.id, amount: val });
      }
      // Check sum match
      if (Math.abs(sum - amount) > 0.01) {
        setExpenseError(`Sum of splits ($${sum.toFixed(2)}) must equal total amount ($${amount.toFixed(2)})`);
        return;
      }
    } else if (expenseSplitType === 'percentage') {
      let sum = 0;
      for (const m of activeMembers) {
        const val = parseFloat(expenseSplits[m.id]);
        if (isNaN(val) || val < 0) {
          setExpenseError(`Please enter a valid percentage for ${m.name}`);
          return;
        }
        sum += val;
        splitsPayload.push({ userId: m.id, percentage: val });
      }
      if (Math.abs(sum - 100) > 0.01) {
        setExpenseError(`Sum of percentages (${sum}%) must equal 100%`);
        return;
      }
    } else if (expenseSplitType === 'share') {
      let sum = 0;
      for (const m of activeMembers) {
        const val = parseFloat(expenseSplits[m.id]);
        if (isNaN(val) || val < 0) {
          setExpenseError(`Please enter valid shares for ${m.name}`);
          return;
        }
        sum += val;
        splitsPayload.push({ userId: m.id, share: val });
      }
      if (sum <= 0) {
        setExpenseError('Sum of shares must be greater than zero');
        return;
      }
    }

    try {
      await api.post(`/groups/${id}/expenses`, {
        description: expenseDesc.trim(),
        amount: amount,
        date: expenseDate,
        paid_by: parseInt(expensePayer),
        split_type: expenseSplitType,
        splits: splitsPayload
      });
      setShowExpenseModal(false);
      resetExpenseForm();
      fetchGroupDetails();
      if (onGroupUpdated) onGroupUpdated();
    } catch (err) {
      setExpenseError(err.message || 'Failed to add expense');
    }
  };

  const handleSettleUp = async (e) => {
    e.preventDefault();
    setSettleError('');

    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) {
      setSettleError('Please enter a valid amount');
      return;
    }
    if (!settlePayer || !settlePayee) {
      setSettleError('Payer and recipient are required');
      return;
    }
    if (settlePayer === settlePayee) {
      setSettleError('Payer and recipient must be different');
      return;
    }

    try {
      await api.post(`/groups/${id}/settlements`, {
        from_user_id: parseInt(settlePayer),
        to_user_id: parseInt(settlePayee),
        amount: amount,
        date: settleDate
      });
      setShowSettleModal(false);
      resetSettleForm();
      fetchGroupDetails();
      if (onGroupUpdated) onGroupUpdated();
    } catch (err) {
      setSettleError(err.message || 'Failed to record settlement');
    }
  };

  const openSettleModalWithDebt = (debt) => {
    setSettlePayer(debt.fromUser.id.toString());
    setSettlePayee(debt.toUser.id.toString());
    setSettleAmount(debt.amount.toString());
    setShowSettleModal(true);
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      month: months[d.getMonth()],
      day: d.getDate()
    };
  };

  if (loading) {
    return <div className="main-content"><h3>Loading group details...</h3></div>;
  }

  if (error || !group) {
    return (
      <div className="main-content">
        <div className="error-banner">{error || 'Group not found.'}</div>
        <Link to="/" className="btn btn-secondary">Go to Dashboard</Link>
      </div>
    );
  }

  const isCreator = group.created_by === currentUser.id;
  const activeMembers = members.filter(m => m.is_active);

  // Splits live calculator helpers
  const getUnequalTotal = () => {
    let sum = 0;
    Object.keys(expenseSplits).forEach(k => {
      const val = parseFloat(expenseSplits[k]);
      if (!isNaN(val)) sum += val;
    });
    return sum;
  };

  const getPercentageTotal = () => {
    let sum = 0;
    Object.keys(expenseSplits).forEach(k => {
      const val = parseFloat(expenseSplits[k]);
      if (!isNaN(val)) sum += val;
    });
    return sum;
  };

  return (
    <div className="main-content">
      {/* Group Header */}
      <div className="group-header">
        <div>
          <h2 className="group-title">{group.name}</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Created by {group.creator_name}</span>
        </div>
        <div className="group-actions">
          <button className="btn btn-secondary" onClick={() => setShowMemberModal(true)}>
            👤 Add Member
          </button>
          <button className="btn btn-secondary" onClick={() => { resetSettleForm(); setShowSettleModal(true); }}>
            💸 Settle Up
          </button>
          <button className="btn btn-primary" onClick={() => { resetExpenseForm(); setShowExpenseModal(true); }}>
            ➕ Add Expense
          </button>
        </div>
      </div>

      <div className="group-grid">
        {/* Left Column: Expenses list */}
        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Expense History</h3>
            </div>
            
            {expenses.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>💸</span>
                <p style={{ fontWeight: 600 }}>No expenses recorded yet</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Click "Add Expense" to log the first bill!</p>
              </div>
            ) : (
              <div className="expense-list">
                {expenses.map(e => {
                  const dObj = formatDate(e.date);
                  // Find personal status for currentUser
                  // Did they pay? How much do they owe?
                  const personalOwed = balances[currentUser.id] || 0;
                  
                  return (
                    <div 
                      key={e.id} 
                      className="expense-item" 
                      onClick={() => navigate(`/expense/${e.id}`)}
                    >
                      <div className="expense-item-left">
                        <div className="expense-date-badge">
                          <span className="expense-date-month">{dObj.month}</span>
                          <span className="expense-date-day">{dObj.day}</span>
                        </div>
                        <div className="expense-info">
                          <span className="expense-desc">{e.description}</span>
                          <span className="expense-payer">
                            paid by <strong>{e.paid_by === currentUser.id ? 'you' : e.paid_by_name}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="expense-item-right">
                        <div className="expense-total">
                          <div className="expense-total-label">total amount</div>
                          <div className="expense-total-val">${parseFloat(e.amount).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Balances and Debts summary */}
        <div>
          {/* Group Balances */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Group Balances</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {members.map(m => {
                const bal = balances[m.id] || 0;
                if (!m.is_active && Math.abs(bal) < 0.01) return null; // hide settled inactive members
                
                return (
                  <div key={m.id} style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px dashed var(--surface-border)' }}>
                    <div>
                      <span style={{ fontWeight: m.id === currentUser.id ? 700 : 500 }}>
                        {m.name} {m.id === currentUser.id && '(you)'}
                      </span>
                      {!m.is_active && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>(Inactive)</span>}
                      <button 
                        className="btn-link"
                        style={{ display: 'block', fontSize: '0.75rem', textAlign: 'left', color: 'var(--primary)', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                        onClick={() => openLedgerModal(m.id, m.name)}
                      >
                        🔍 View Itemized Ledger
                      </button>
                    </div>
                    <span style={{ fontWeight: 700, color: bal > 0 ? 'var(--accent-green)' : bal < 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                      {bal > 0 ? `gets back $${bal.toFixed(2)}` : bal < 0 ? `owes $${Math.abs(bal).toFixed(2)}` : 'settled up'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pairwise debts breakdown */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Who owes who</h3>
            </div>
            {debts.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
                Everyone is settled up!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {debts.map((d, index) => (
                  <div key={index} className="debt-item" style={{ fontSize: '0.9rem', padding: '0.6rem 0.8rem', borderLeftWidth: '3px' }}>
                    <div style={{ flex: 1 }}>
                      <strong>{d.fromUser.name}</strong> owes <strong>{d.toUser.name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>direct debt</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontWeight: 700 }}>${d.amount.toFixed(2)}</span>
                      {(d.fromUser.id === currentUser.id || d.toUser.id === currentUser.id) && (
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => openSettleModalWithDebt(d)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Settle
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Members Admin list */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Members List</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0' }}>
                  <span style={{ fontSize: '0.9rem', color: m.is_active ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    {m.name} {m.id === group.created_by && '👑'} {!m.is_active && '(Removed)'}
                  </span>
                  {isCreator && m.id !== group.created_by && m.is_active && (
                    <button 
                      onClick={() => handleRemoveMember(m.id)}
                      className="btn btn-link"
                      style={{ color: 'var(--accent-red)', fontSize: '0.8rem', padding: '0.1rem 0.4rem' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: ADD MEMBER */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add member by email</h3>
              <button className="modal-close-btn" onClick={() => setShowMemberModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddMember}>
              {memberError && <div className="error-banner">{memberError}</div>}
              {memberSuccess && <div className="error-banner" style={{ backgroundColor: 'var(--primary-light)', borderColor: 'var(--primary)', color: 'var(--primary)' }}>{memberSuccess}</div>}
              <div className="form-group">
                <label className="form-label" htmlFor="memberEmail">Email Address</label>
                <input 
                  type="email" 
                  id="memberEmail" 
                  className="form-input" 
                  placeholder="e.g. friend@domain.com" 
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowMemberModal(false); setMemberError(''); setMemberSuccess(''); }}>Close</button>
                <button type="submit" className="btn btn-primary">Add Member</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD EXPENSE */}
      {showExpenseModal && (
        <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Add an expense</h3>
              <button className="modal-close-btn" onClick={() => setShowExpenseModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddExpense}>
              {expenseError && <div className="error-banner">{expenseError}</div>}
              
              <div className="form-group">
                <label className="form-label" htmlFor="expDesc">Description</label>
                <input 
                  type="text" 
                  id="expDesc" 
                  className="form-input" 
                  placeholder="e.g. Dinner, Groceries" 
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="expAmount">Amount ($)</label>
                  <input 
                    type="number" 
                    id="expAmount" 
                    step="0.01" 
                    min="0.01" 
                    className="form-input" 
                    placeholder="0.00" 
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="expDate">Date</label>
                  <input 
                    type="date" 
                    id="expDate" 
                    className="form-input" 
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="expPayer">Paid by</label>
                  <select 
                    id="expPayer" 
                    className="form-input" 
                    value={expensePayer} 
                    onChange={(e) => setExpensePayer(e.target.value)}
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name} {m.id === currentUser.id && '(you)'}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="expSplitType">Split Type</label>
                  <select 
                    id="expSplitType" 
                    className="form-input" 
                    value={expenseSplitType} 
                    onChange={(e) => setExpenseSplitType(e.target.value)}
                  >
                    <option value="equal">Equally</option>
                    <option value="unequal">Unequally (Exact amounts)</option>
                    <option value="percentage">By percentage</option>
                    <option value="share">By shares</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Split Inputs */}
              <div>
                <label className="form-label">Split Details</label>
                <div className="splits-input-container">
                  {activeMembers.map(m => {
                    const val = expenseSplits[m.id];
                    return (
                      <div key={m.id} className="split-input-row">
                        <span className="split-input-label">{m.name} {m.id === currentUser.id && '(you)'}</span>
                        
                        {expenseSplitType === 'equal' && (
                          <input 
                            type="checkbox" 
                            checked={!!val} 
                            style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--primary)' }}
                            onChange={(e) => setExpenseSplits({ ...expenseSplits, [m.id]: e.target.checked })}
                          />
                        )}

                        {expenseSplitType === 'unequal' && (
                          <div className="split-input-field-wrapper">
                            <span className="split-input-unit">$</span>
                            <input 
                              type="number" 
                              step="0.01" 
                              min="0"
                              placeholder="0.00"
                              className="split-input-field" 
                              value={val || ''}
                              onChange={(e) => setExpenseSplits({ ...expenseSplits, [m.id]: e.target.value })}
                            />
                          </div>
                        )}

                        {expenseSplitType === 'percentage' && (
                          <div className="split-input-field-wrapper">
                            <input 
                              type="number" 
                              step="0.01" 
                              min="0"
                              max="100"
                              placeholder="0"
                              className="split-input-field" 
                              value={val || ''}
                              onChange={(e) => setExpenseSplits({ ...expenseSplits, [m.id]: e.target.value })}
                            />
                            <span className="split-input-unit">%</span>
                          </div>
                        )}

                        {expenseSplitType === 'share' && (
                          <div className="split-input-field-wrapper">
                            <input 
                              type="number" 
                              step="1" 
                              min="0"
                              placeholder="1"
                              className="split-input-field" 
                              value={val || ''}
                              onChange={(e) => setExpenseSplits({ ...expenseSplits, [m.id]: e.target.value })}
                            />
                            <span className="split-input-unit">share(s)</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Live indicators */}
                {expenseSplitType === 'unequal' && (
                  <div style={{ fontSize: '0.8rem', textAlign: 'right', marginTop: '0.5rem', color: Math.abs(getUnequalTotal() - parseFloat(expenseAmount || 0)) > 0.01 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                    Total split: ${getUnequalTotal().toFixed(2)} / ${parseFloat(expenseAmount || 0).toFixed(2)}
                  </div>
                )}

                {expenseSplitType === 'percentage' && (
                  <div style={{ fontSize: '0.8rem', textAlign: 'right', marginTop: '0.5rem', color: Math.abs(getPercentageTotal() - 100) > 0.01 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                    Total: {getPercentageTotal().toFixed(1)}% / 100%
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SETTLE UP */}
      {showSettleModal && (
        <div className="modal-overlay" onClick={() => setShowSettleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Record a payment</h3>
              <button className="modal-close-btn" onClick={() => setShowSettleModal(false)}>×</button>
            </div>
            <form onSubmit={handleSettleUp}>
              {settleError && <div className="error-banner">{settleError}</div>}
              
              <div className="form-group">
                <label className="form-label" htmlFor="setPay">Who paid? (Payer)</label>
                <select 
                  id="setPay" 
                  className="form-input" 
                  value={settlePayer} 
                  onChange={(e) => setSettlePayer(e.target.value)}
                  required
                >
                  <option value="">Select payer</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name} {m.id === currentUser.id && '(you)'}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="setRec">Who received? (Recipient)</label>
                <select 
                  id="setRec" 
                  className="form-input" 
                  value={settlePayee} 
                  onChange={(e) => setSettlePayee(e.target.value)}
                  required
                >
                  <option value="">Select recipient</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name} {m.id === currentUser.id && '(you)'}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="setAmount">Amount ($)</label>
                  <input 
                    type="number" 
                    id="setAmount" 
                    step="0.01" 
                    min="0.01" 
                    className="form-input" 
                    placeholder="0.00" 
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="setDate">Date</label>
                  <input 
                    type="date" 
                    id="setDate" 
                    className="form-input" 
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ledger Breakdown Modal */}
      {ledgerModal.show && (
        <div className="modal-overlay" onClick={() => setLedgerModal({ show: false, userId: null, name: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title">Itemized Ledger: {ledgerModal.name}</h3>
              <button className="modal-close-btn" onClick={() => setLedgerModal({ show: false, userId: null, name: '' })}>×</button>
            </div>
            
            <div style={{ maxHeight: '450px', overflowY: 'auto', padding: '1rem 0' }}>
              {ledgerLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading transactions ledger...</div>
              ) : ledgerEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No transactions recorded for this member.
                </div>
              ) : (
                <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--surface-border)', paddingBottom: '0.5rem' }}>
                      <th style={{ padding: '0.5rem' }}>Date</th>
                      <th style={{ padding: '0.5rem' }}>Description</th>
                      <th style={{ padding: '0.5rem' }}>Total Cost</th>
                      <th style={{ padding: '0.5rem' }}>Payer</th>
                      <th style={{ padding: '0.5rem' }}>Share Owed</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Net Effect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((e, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                        <td style={{ padding: '0.5rem' }}>{new Date(e.date).toISOString().split('T')[0]}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <strong>{e.description}</strong>
                          {e.amountUsd && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Original: ${e.amountUsd.toFixed(2)} USD</div>}
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {e.type === 'expense' ? `${e.currency === 'USD' ? '$' : '₹'}${e.totalAmount.toFixed(2)}` : '-'}
                        </td>
                        <td style={{ padding: '0.5rem' }}>{e.paidBy}</td>
                        <td style={{ padding: '0.5rem' }}>
                          {e.type === 'expense' ? `₹${e.userShare.toFixed(2)}` : '-'}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: e.netEffect > 0 ? 'var(--accent-green)' : e.netEffect < 0 ? 'var(--accent-red)' : 'inherit' }}>
                          {e.netEffect > 0 ? `+₹${e.netEffect.toFixed(2)}` : e.netEffect < 0 ? `-₹${Math.abs(e.netEffect).toFixed(2)}` : '₹0.00'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setLedgerModal({ show: false, userId: null, name: '' })}
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
