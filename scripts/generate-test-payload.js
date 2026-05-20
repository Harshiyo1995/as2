/**
 * Generates a real S/MIME encrypted AS2 test payload using node-forge.
 * Run with: node scripts/generate-test-payload.js
 *
 * This will:
 *  1. Read the system public cert (system-cert.pem)
 *  2. Encrypt a sample EDI/XML payload with it
 *  3. Output the encrypted PEM and a ready-to-use curl command
 */
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const certPath = path.join(__dirname, '..', 'system-cert.pem');
if (!fs.existsSync(certPath)) {
  console.error('ERROR: system-cert.pem not found. Run the seed script first.');
  process.exit(1);
}

const certPem = fs.readFileSync(certPath, 'utf8');
const cert = forge.pki.certificateFromPem(certPem);

// Sample FDA submission XML payload
const samplePayload = `<?xml version="1.0" encoding="UTF-8"?>
<ICHMessage>
  <ichicsr lang="en" xmlns="urn:ichar:names:icsr:icsrv2:schema">
    <safetyreport>
      <safetyreportid>US-TEST-001-2026</safetyreportid>
      <primarysource>
        <reportergivename>John</reportergivename>
        <reporterfamilyname>Doe</reporterfamilyname>
        <reportercountry>US</reportercountry>
      </primarysource>
      <patient>
        <patientsex>1</patientsex>
        <patientagegroup>5</patientagegroup>
        <reaction>
          <reactionmeddrapt>Headache</reactionmeddrapt>
          <reactionoutcome>1</reactionoutcome>
        </reaction>
      </patient>
    </safetyreport>
  </ichicsr>
</ICHMessage>`;

console.log('Encrypting payload with system-cert.pem...\n');

// Create PKCS7 Enveloped Data (S/MIME encrypted)
// Using 3DES (des-EDE3-CBC) — fully supported by all node-forge versions
const p7 = forge.pkcs7.createEnvelopedData();
p7.addRecipient(cert);
p7.content = forge.util.createBuffer(samplePayload, 'utf8');
p7.encrypt();  // defaults to 3DES which is universally supported

const encryptedPem = forge.pkcs7.messageToPem(p7);

// Save to file
const outPath = path.join(__dirname, '..', 'test-payload-encrypted.pem');
fs.writeFileSync(outPath, encryptedPem);

console.log('✅ Encrypted payload saved to: test-payload-encrypted.pem');
console.log('   Size:', encryptedPem.length, 'bytes\n');

// Generate message ID
const messageId = `<e2e-test-${Date.now()}@gateway>`;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('READY-TO-USE CURL COMMAND (paste in PowerShell):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`
curl --location "http://localhost:8080/as2/receive" \`
  --header "AS2-From: VEEVA_ESG" \`
  --header "AS2-To: YOUR_COMPANY3" \`
  --header "Message-ID: ${messageId}" \`
  --header "Subject: FDA ICSR Test Submission" \`
  --header "Content-Type: application/pkcs7-mime; smime-type=enveloped-data" \`
  --header "Disposition-Notification-To: VEEVA_ESG" \`
  --data-binary "@test-payload-encrypted.pem"
`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Or import via Postman: POST http://localhost:8080/as2/receive');
console.log('Body: Binary → select file: test-payload-encrypted.pem');
