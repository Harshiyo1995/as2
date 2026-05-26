/**
 * Seed Script: Import generated test certificate into the AS2 gateway database.
 * Run with: node scripts/seed-system-cert.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// ─── CONFIGURE YOUR GATEWAY'S LOCAL AS2 IDENTITY HERE ───
const TARGET_AS2_ID = 'YOUR_COMPANY1'; 

// Read the generated PEM files
const certPath = path.join(__dirname, '..', 'system-cert.pem');
const keyPath = path.join(__dirname, '..', 'system-private.key.pem');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('ERROR: Could not find system-cert.pem or system-private.key.pem');
  console.error('Run the certificate generation step first.');
  process.exit(1);
}

const certPem = fs.readFileSync(certPath, 'utf8');
const keyPem = fs.readFileSync(keyPath, 'utf8');

// Parse basic cert info using regex (without forge for simplicity)
const now = new Date();
const validTo = new Date(now);
validTo.setFullYear(validTo.getFullYear() + 5);

async function seedCert() {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    database: 'as2_gateway',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL...');

    // Add private_key_pem column if it doesn't exist yet
    await client.query(`
      ALTER TABLE certificates 
      ADD COLUMN IF NOT EXISTS private_key_pem TEXT;
    `);
    console.log('Schema migration: private_key_pem column ensured.');

    // Remove old system cert if exists to prevent conflicts
    await client.query(`DELETE FROM certificates WHERE alias = $1`, [TARGET_AS2_ID]);

    // Insert the system private certificate using the exact AS2 ID as the alias
    const result = await client.query(`
      INSERT INTO certificates (
        alias, thumbprint, subject_dn, issuer_dn, serial_number,
        is_private, pem_data, private_key_pem, valid_from, valid_to, created_at
      ) VALUES (
        $1,
        'test-thumbprint-' || md5(random()::text),
        'CN=AS2 Gateway, O=My Company, C=US',
        'CN=AS2 Gateway, O=My Company, C=US',
        '01',
        true,
        $2,
        $3,
        $4,
        $5,
        NOW()
      ) RETURNING id, alias;
    `, [TARGET_AS2_ID, certPem, keyPem, now.toISOString(), validTo.toISOString()]);

    console.log(`✅ System private certificate inserted successfully!`);
    console.log(`   ID:    ${result.rows[0].id}`);
    console.log(`   Alias: ${result.rows[0].alias} (Matches AS2-To header)`);
    console.log('');
    console.log('Your AS2 Gateway is now configured with a private key for decryption.');
    console.log('Restart your NestJS server and try sending a test payload!');

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await client.end();
  }
}

seedCert();