const forge = require('node-forge');
const fs = require('fs');

console.log('Generating RSA 2048-bit key pair...');
const keys = forge.pki.rsa.generateKeyPair(2048);

console.log('Creating X.509 Certificate...');
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = Math.floor(Math.random() * 1000000).toString();
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5); // 5 year expiration

const attrs = [{ name: 'commonName', value: 'COMPANYUS' }];
cert.setSubject(attrs);
cert.setIssuer(attrs);

// --- ENTERPRISE AS2 FIX: Add V3 Extensions ---
// This tells Veeva's gateway that this certificate is legally allowed 
// to be used for AS2 Signatures and Encryption.
cert.setExtensions([{
  name: 'basicConstraints',
  cA: false
}, {
  name: 'keyUsage',
  keyCertSign: false,
  digitalSignature: true, // Required for AS2 signing
  nonRepudiation: true,   // Required for MDN receipts
  keyEncipherment: true,  // Required for AS2 encryption
  dataEncipherment: true
}]);
// ---------------------------------------------

// Self-sign the cert
cert.sign(keys.privateKey, forge.md.sha256.create());

// Bundle into a password-protected PKCS#12 (.pfx) vault
const password = 'securepassword123';
console.log(`Bundling into .pfx with password: ${password}...`);

const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
  keys.privateKey,
  [cert],
  password,
  { generateLocalKeyId: true, algorithm: '3des' }
);

const p12Der = forge.asn1.toDer(p12Asn1).getBytes();

// Save to disk using Buffer to prevent binary encoding corruption
fs.writeFileSync('COMPANYUS.pfx', Buffer.from(p12Der, 'binary'));

console.log('✅ Success! COMPANYUS.pfx generated.');