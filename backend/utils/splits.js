/**
 * Splits utility functions to calculate and validate expense splits.
 * Working in cents (integers) to avoid floating-point rounding issues.
 */

/**
 * Split an amount equally among participants.
 * Leftover cents are added to the first participant.
 * @param {number} totalAmount - Total amount in dollars (e.g. 10.00)
 * @param {Array<number>} participantUserIds - Array of user IDs participating in the split
 * @returns {Array<{userId: number, amount: number}>} Calculated splits
 */
function splitEqually(totalAmount, participantUserIds) {
  if (!participantUserIds || participantUserIds.length === 0) {
    throw new Error('Participants list cannot be empty');
  }
  if (totalAmount <= 0) {
    throw new Error('Total amount must be greater than zero');
  }

  const totalCents = Math.round(totalAmount * 100);
  const n = participantUserIds.length;
  const baseCents = Math.floor(totalCents / n);
  const leftoverCents = totalCents - (baseCents * n);

  return participantUserIds.map((userId, index) => {
    const amountCents = index === 0 ? baseCents + leftoverCents : baseCents;
    return {
      userId,
      amount: parseFloat((amountCents / 100).toFixed(2))
    };
  });
}

/**
 * Validate and format an unequal split.
 * @param {number} totalAmount - Total amount in dollars
 * @param {Array<{userId: number, amount: number}>} splits - Provided splits with explicit amounts
 * @returns {Array<{userId: number, amount: number}>} Formatted splits
 */
function splitUnequally(totalAmount, splits) {
  if (!splits || splits.length === 0) {
    throw new Error('Splits list cannot be empty');
  }
  if (totalAmount <= 0) {
    throw new Error('Total amount must be greater than zero');
  }

  const totalCents = Math.round(totalAmount * 100);
  let sumCents = 0;

  const formattedSplits = splits.map(s => {
    const cents = Math.round(s.amount * 100);
    if (cents < 0) {
      throw new Error('Split amount cannot be negative');
    }
    sumCents += cents;
    return {
      userId: s.userId,
      amount: parseFloat((cents / 100).toFixed(2))
    };
  });

  if (sumCents !== totalCents) {
    throw new Error(`Sum of split amounts ($${(sumCents/100).toFixed(2)}) must equal total amount ($${totalAmount.toFixed(2)})`);
  }

  return formattedSplits;
}

/**
 * Split an amount by percentage.
 * Leftover cents due to rounding are added to the first participant.
 * @param {number} totalAmount - Total amount in dollars
 * @param {Array<{userId: number, percentage: number}>} splits - Provided splits with percentages
 * @returns {Array<{userId: number, amount: number, percentage: number}>} Calculated splits
 */
function splitByPercentage(totalAmount, splits) {
  if (!splits || splits.length === 0) {
    throw new Error('Splits list cannot be empty');
  }
  if (totalAmount <= 0) {
    throw new Error('Total amount must be greater than zero');
  }

  const totalCents = Math.round(totalAmount * 100);
  let sumPercentage = 0;
  
  splits.forEach(s => {
    if (s.percentage < 0) {
      throw new Error('Percentage cannot be negative');
    }
    sumPercentage += s.percentage;
  });

  // Allow minor float error for sum of percentages (e.g. 100.0)
  if (Math.abs(sumPercentage - 100) > 0.01) {
    throw new Error(`Sum of percentages (${sumPercentage}%) must equal 100%`);
  }

  let sumCents = 0;
  const calculatedSplits = splits.map((s, index) => {
    const cents = Math.floor((s.percentage / 100) * totalCents);
    sumCents += cents;
    return {
      userId: s.userId,
      amountCents: cents,
      percentage: s.percentage
    };
  });

  // Adjust leftover cents on first participant
  const leftoverCents = totalCents - sumCents;
  calculatedSplits[0].amountCents += leftoverCents;

  return calculatedSplits.map(s => ({
    userId: s.userId,
    amount: parseFloat((s.amountCents / 100).toFixed(2)),
    percentage: s.percentage
  }));
}

/**
 * Split an amount by shares.
 * Leftover cents due to rounding are added to the first participant.
 * @param {number} totalAmount - Total amount in dollars
 * @param {Array<{userId: number, share: number}>} splits - Provided splits with share ratios
 * @returns {Array<{userId: number, amount: number, share: number}>} Calculated splits
 */
function splitByShare(totalAmount, splits) {
  if (!splits || splits.length === 0) {
    throw new Error('Splits list cannot be empty');
  }
  if (totalAmount <= 0) {
    throw new Error('Total amount must be greater than zero');
  }

  let totalShares = 0;
  splits.forEach(s => {
    if (s.share < 0) {
      throw new Error('Share cannot be negative');
    }
    totalShares += s.share;
  });

  if (totalShares <= 0) {
    throw new Error('Total shares must be greater than zero');
  }

  const totalCents = Math.round(totalAmount * 100);
  let sumCents = 0;

  const calculatedSplits = splits.map((s, index) => {
    const cents = Math.floor((s.share / totalShares) * totalCents);
    sumCents += cents;
    return {
      userId: s.userId,
      amountCents: cents,
      share: s.share
    };
  });

  // Adjust leftover cents on first participant
  const leftoverCents = totalCents - sumCents;
  calculatedSplits[0].amountCents += leftoverCents;

  return calculatedSplits.map(s => ({
    userId: s.userId,
    amount: parseFloat((s.amountCents / 100).toFixed(2)),
    share: s.share
  }));
}

module.exports = {
  splitEqually,
  splitUnequally,
  splitByPercentage,
  splitByShare
};
