/**
 * Utility: Generate fresh RSA 2048-bit keypairs and X.509 Certificates for AS2 Testing
 * Run with: node scripts/generate-keys.js
 */
const forge = require('node-forge');
const fs = require('fs');

console.log('⏳ Generating 2048-bit RSA key pair (this may take a few seconds)...');
const keys = forge.pki.rsa.generateKeyPair(2048);

console.log('📝 Creating self-signed X.509 certificate...');
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = Math.floor(Math.random() * 100000).toString();

// Set Validity (Valid from right now, expires in 5 years)
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5);

// Configure the Certificate Subject / Issuer Info
const attrs = [
  { name: 'commonName', value: 'Veeva Test Partner AS2' },
  { name: 'organizationName', value: 'External Pharma Corp' },
  { name: 'countryName', value: 'US' }
];
cert.setSubject(attrs);
cert.setIssuer(attrs); // Self-signed, so issuer matches subject

// Sign the certificate using SHA-256
cert.sign(keys.privateKey, forge.md.sha256.create());

// Convert to PEM format
const pemCert = forge.pki.certificateToPem(cert);
const pemKey = forge.pki.privateKeyToPem(keys.privateKey);

// Write to disk
fs.writeFileSync('partner-public-cert.pem', pemCert);
fs.writeFileSync('partner-private.key', pemKey);

console.log('✅ Success! Your test keys have been generated:');
console.log('   📄 partner-public-cert.pem  (Upload this to your Trading Partner profile)');
console.log('   🔑 partner-private.key      (Keep this safe / Use it in your test scripts)');