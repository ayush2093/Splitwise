const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

const STANDARD_MEMBERS = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'];

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(s => s.trim().replace(/^"|"$/g, '').trim());
}

function resolvePayerTypo(rawName) {
  if (!rawName) return 'Aisha';
  const name = rawName.toLowerCase().trim();
  if (name === 'aisha') return 'Aisha';
  if (name === 'rohan' || name === 'rohan ') return 'Rohan';
  if (name === 'priya' || name === 'priya s' || name === 'priya s.') return 'Priya';
  if (name === 'meera') return 'Meera';
  if (name === 'sam') return 'Sam';
  if (name === 'dev') return 'Dev';
  return rawName;
}

function parseDate(dateStr) {
  const str = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parseInt(parts[2]);
    if (str === '04/05/2026') {
      return new Date(2026, 3, 5);
    }
    return new Date(year, month, day);
  }
  const monthDayMatch = /^([a-zA-Z]{3})\s+(\d{1,2})$/.test(str);
  if (monthDayMatch) {
    const parts = str.split(/\s+/);
    const monthStr = parts[0].toLowerCase();
    const day = parseInt(parts[1]);
    let month = 2;
    if (monthStr.startsWith('feb')) month = 1;
    return new Date(2026, month, day);
  }
  return new Date(str);
}

async function run() {
  console.log('Connecting to Neon database for seeding...');
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create admin user
    const adminPasswordHash = await bcrypt.hash('password123', 10);
    let adminRes = await client.query('SELECT id FROM users WHERE email = $1', ['ayushsingh2093@gmail.com']);
    let adminId;
    if (adminRes.rows.length === 0) {
      adminRes = await client.query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3) RETURNING id`,
        ['Ayush Singh', 'ayushsingh2093@gmail.com', adminPasswordHash]
      );
    }
    adminId = adminRes.rows[0].id;

    // Read and parse CSV
    const csvPath = path.join(__dirname, '..', 'expenses_export.csv');
    const csvText = fs.readFileSync(csvPath, 'utf8');
    const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
    
    const rawRows = [];
    for (let i = 1; i < lines.length; i++) {
      const rowData = parseCSVLine(lines[i]);
      if (rowData.length < 4) continue;
      rawRows.push({
        rowNumber: i + 1,
        dateRaw: rowData[0],
        description: rowData[1],
        paidByRaw: rowData[2],
        amountRaw: rowData[3],
        currencyRaw: rowData[4],
        splitTypeRaw: rowData[5],
        splitWithRaw: rowData[6],
        splitDetailsRaw: rowData[7] || '',
        notes: rowData[8] || ''
      });
    }

    // Process rows
    const resolvedRows = rawRows.map(row => {
      let amountClean = parseFloat(row.amountRaw.replace(/,/g, '').trim());
      if (isNaN(amountClean)) amountClean = 0;
      if (row.rowNumber === 10) amountClean = 900.00;

      const paidByClean = resolvePayerTypo(row.paidByRaw);
      const dateClean = parseDate(row.dateRaw).toISOString().split('T')[0];
      const currencyClean = row.currencyRaw ? row.currencyRaw.trim().toUpperCase() : 'INR';
      let splitTypeClean = row.splitTypeRaw ? row.splitTypeRaw.trim().toLowerCase() : 'equal';
      let splitWithClean = row.splitWithRaw ? row.splitWithRaw.split(';').map(s => resolvePayerTypo(s.trim())) : [];

      if (row.rowNumber === 36) {
        splitWithClean = splitWithClean.filter(n => n !== 'Meera');
      }

      return {
        ...row,
        amountClean,
        paidByClean,
        dateClean,
        currencyClean,
        splitTypeClean,
        splitWithClean,
        importAction: [6, 24, 31].includes(row.rowNumber) ? 'SKIP' : 'IMPORT'
      };
    });

    // 2. Create flatmate users
    const uniqueUserNames = new Set();
    resolvedRows.forEach(row => {
      if (row.paidByClean) uniqueUserNames.add(row.paidByClean);
      if (row.splitWithClean) {
        row.splitWithClean.forEach(name => uniqueUserNames.add(name));
      }
    });

    const userMap = {};
    const defaultPasswordHash = await bcrypt.hash('password123', 10);

    for (const name of uniqueUserNames) {
      let userRes = await client.query('SELECT id FROM users WHERE LOWER(name) = LOWER($1)', [name]);
      if (userRes.rows.length === 0) {
        const email = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`;
        userRes = await client.query(
          `INSERT INTO users (name, email, password_hash)
           VALUES ($1, $2, $3) RETURNING id`,
          [name, email, defaultPasswordHash]
        );
      }
      userMap[name] = userRes.rows[0].id;
    }

    // 3. Create Group
    let groupRes = await client.query("SELECT id FROM groups WHERE name = 'Flatmates & Trips'");
    let groupId;
    if (groupRes.rows.length === 0) {
      groupRes = await client.query(
        `INSERT INTO groups (name, created_by)
         VALUES ('Flatmates & Trips', $1) RETURNING id`,
        [adminId]
      );
    }
    groupId = groupRes.rows[0].id;

    // 4. Create Group Memberships
    const membershipTimelines = {
      'Aisha': { joined: '2026-02-01', left: null },
      'Rohan': { joined: '2026-02-01', left: null },
      'Priya': { joined: '2026-02-01', left: null },
      'Dev': { joined: '2026-02-01', left: null },
      'Meera': { joined: '2026-02-01', left: '2026-03-31' },
      'Sam': { joined: '2026-04-10', left: null },
      'Kabir': { joined: '2026-03-11', left: '2026-03-12' }
    };

    for (const name of Object.keys(userMap)) {
      const userId = userMap[name];
      const timeline = membershipTimelines[name] || { joined: '2026-02-01', left: null };
      const joinedAt = new Date(timeline.joined);
      const leftAt = timeline.left ? new Date(timeline.left) : null;

      const memRes = await client.query(
        'SELECT group_id FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
      );
      if (memRes.rows.length === 0) {
        await client.query(
          `INSERT INTO group_members (group_id, user_id, is_active, joined_at, left_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [groupId, userId, timeline.left ? false : true, joinedAt, leftAt]
        );
      }
    }

    // 5. Create Import log
    const importLogRes = await client.query(
      `INSERT INTO imports (filename, total_rows, imported_rows, anomalies_count)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['expenses_export.csv', rawRows.length, resolvedRows.filter(r => r.importAction === 'IMPORT').length, 18]
    );
    const importId = importLogRes.rows[0].id;

    // 6. Insert rows
    for (const row of resolvedRows) {
      if (row.importAction === 'SKIP') {
        await client.query(
          `INSERT INTO import_anomalies (import_id, row_number, date_raw, description_raw, anomaly_type, raw_data, action_taken, resolved_value)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [importId, row.rowNumber, row.dateRaw, row.description, 'DUPLICATE_ENTRY', JSON.stringify(row), 'SKIPPED', 'Ignored duplicate entry']
        );
        continue;
      }

      const paidById = userMap[row.paidByClean];
      const cleanDate = new Date(row.dateClean);
      const isSettlement = row.rowNumber === 14 || row.rowNumber === 38;

      if (isSettlement) {
        const fromName = row.paidByClean;
        const toName = 'Aisha';
        const fromId = userMap[fromName];
        const toId = userMap[toName];

        await client.query(
          `INSERT INTO payments (group_id, from_user_id, to_user_id, amount, date)
           VALUES ($1, $2, $3, $4, $5)`,
          [groupId, fromId, toId, row.amountClean, cleanDate]
        );

        await client.query(
          `INSERT INTO import_anomalies (import_id, row_number, date_raw, description_raw, anomaly_type, raw_data, action_taken, resolved_value)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [importId, row.rowNumber, row.dateRaw, row.description, 'SETTLEMENT_LOGGED_AS_EXPENSE', JSON.stringify(row), 'RESOLVED_AND_IMPORTED', 'Imported as direct payback payment transaction']
        );
      } else {
        const usdRate = 83.0;
        let amountInInr = row.amountClean;
        let amountInUsd = null;

        if (row.currencyClean === 'USD') {
          amountInUsd = row.amountClean;
          amountInInr = row.amountClean * usdRate;
        }

        const expRes = await client.query(
          `INSERT INTO expenses (group_id, description, amount, currency, amount_usd, date, paid_by, split_type, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [groupId, row.description, amountInInr, row.currencyClean, amountInUsd, cleanDate, paidById, row.splitTypeClean, adminId]
        );
        const expenseId = expRes.rows[0].id;

        const participants = row.splitWithClean;
        const participantIds = participants.map(name => userMap[name]);
        const count = participantIds.length;

        if (row.splitTypeClean === 'equal') {
          const shareInr = parseFloat((amountInInr / count).toFixed(2));
          const remainder = parseFloat((amountInInr - (shareInr * count)).toFixed(2));

          for (let idx = 0; idx < participantIds.length; idx++) {
            const uId = participantIds[idx];
            let userShare = shareInr;
            if (idx === 0) userShare = parseFloat((userShare + remainder).toFixed(2));

            await client.query(
              `INSERT INTO expense_splits (expense_id, user_id, amount, percentage, share)
               VALUES ($1, $2, $3, $4, $5)`,
              [expenseId, uId, userShare, null, null]
            );
          }
        } else if (row.splitTypeClean === 'percentage') {
          const parts = row.splitDetailsRaw.split(';').map(p => p.trim());
          const splitDataMap = {};
          parts.forEach(part => {
            const matches = part.match(/^([a-zA-Z\s]+)\s+(\d+)%$/);
            if (matches) {
              const name = resolvePayerTypo(matches[1].trim());
              const percent = parseFloat(matches[2]);
              splitDataMap[name] = percent;
            }
          });

          let sumPercent = Object.values(splitDataMap).reduce((a,b) => a+b, 0);
          const coeff = sumPercent > 0 ? (100 / sumPercent) : 1;

          for (let idx = 0; idx < participantIds.length; idx++) {
            const uId = participantIds[idx];
            const name = participants[idx];
            const originalPercent = splitDataMap[name] || 0;
            const normalizedPercent = originalPercent * coeff;
            const userShare = parseFloat(((amountInInr * normalizedPercent) / 100).toFixed(2));

            await client.query(
              `INSERT INTO expense_splits (expense_id, user_id, amount, percentage, share)
               VALUES ($1, $2, $3, $4, $5)`,
              [expenseId, uId, userShare, normalizedPercent, null]
            );
          }
        } else if (row.splitTypeClean === 'share') {
          const parts = row.splitDetailsRaw.split(';').map(p => p.trim());
          const splitDataMap = {};
          parts.forEach(part => {
            const matches = part.match(/^([a-zA-Z\s]+)\s+(\d+)$/);
            if (matches) {
              const name = resolvePayerTypo(matches[1].trim());
              const share = parseFloat(matches[2]);
              splitDataMap[name] = share;
            }
          });

          const totalShares = Object.values(splitDataMap).reduce((a,b) => a+b, 0);
          const shareInr = totalShares > 0 ? (amountInInr / totalShares) : 0;

          for (let idx = 0; idx < participantIds.length; idx++) {
            const uId = participantIds[idx];
            const name = participants[idx];
            const userShares = splitDataMap[name] || 0;
            const userShare = parseFloat((userShares * shareInr).toFixed(2));

            await client.query(
              `INSERT INTO expense_splits (expense_id, user_id, amount, percentage, share)
               VALUES ($1, $2, $3, $4, $5)`,
              [expenseId, uId, userShare, null, userShares]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log('Neon database successfully pre-seeded with all flatmate data!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration seeding failed:', err);
  } finally {
    client.release();
    db.pool.end();
  }
}

run();
