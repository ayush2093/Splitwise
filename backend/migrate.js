const db = require('./db');
const fs = require('fs');
const path = require('path');

const migrate = async () => {
  console.log('Starting database migration...');
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Drop tables in order of dependency
    const tablesToDrop = [
      'import_anomalies',
      'imports',
      'chat_messages',
      'payments',
      'expense_splits',
      'expenses',
      'group_members',
      'groups',
      'users'
    ];

    for (const table of tablesToDrop) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`Dropped table ${table} (if it existed)`);
    }

    // Read and run schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(sql);
    console.log('Executed schema.sql successfully');

    await client.query('COMMIT');
    console.log('Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during database migration:', error);
    process.exit(1);
  } finally {
    client.release();
  }
};

migrate();
