import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { Transform } from 'stream';
import { TradingPartnerService } from '../database/trading-partner.service';

const forge = require('node-forge');

class ForgeDecryptTransform extends Transform {
  private chunks: Buffer[] = [];
  constructor(private readonly privateKeyPem: string, private readonly certPem: string, private readonly logger: Logger) { super(); }
  _transform(chunk: Buffer, _enc: string, cb: Function) { this.chunks.push(chunk); cb(); }
  _flush(cb: Function) {
    try {
      const raw = Buffer.concat(this.chunks);
      this.logger.debug(`Decrypting ${raw.length} bytes via node-forge PKCS7 native DER`);
      const privKey = forge.pki.privateKeyFromPem(this.privateKeyPem);
      const cert = forge.pki.certificateFromPem(this.certPem);
      const msg = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(raw.toString('binary'))));
      const recipient = msg.findRecipient(cert);
      msg.decrypt(recipient, privKey);
      
      let contentStr = '';
      if (typeof msg.content === 'string') contentStr = msg.content;
      else if (msg.content.data) contentStr = msg.content.data;
      else if (msg.content.value) contentStr = msg.content.value;
      else if (typeof msg.content.getBytes === 'function') contentStr = msg.content.getBytes();

      this.push(Buffer.from(contentStr, 'binary'));
      cb();
    } catch (err) { cb(err); }
  }
}

class ForgeSignTransform extends Transform {
  private chunks: Buffer[] = [];
  constructor(
    private readonly privateKeyPem: string, 
    private readonly certPem: string, 
    private readonly hashAlgo: string, 
    private readonly boundary: string,
    private readonly prependMime: boolean,
    private readonly logger: Logger
  ) { super(); }

  _transform(chunk: Buffer, _enc: string, cb: Function) { this.chunks.push(chunk); cb(); }

  _flush(cb: Function) {
    try {
      const rawXml = Buffer.concat(this.chunks);
      let xmlStr = rawXml.toString('utf8');
      xmlStr = xmlStr.replace(/(?<!\r)\n/g, '\r\n');
      const canonicalXml = Buffer.from(xmlStr, 'utf8');

      const payloadHeaders = Buffer.from("Content-Type: application/xml\r\n\r\n", "utf8");
      const signedContent = Buffer.concat([payloadHeaders, canonicalXml]);
      
      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(signedContent.toString('binary'));
      p7.addCertificate(forge.pki.certificateFromPem(this.certPem));
      
      const digestOid = this.hashAlgo === 'SHA-1' ? forge.pki.oids.sha1 : forge.pki.oids.sha256;
      p7.addSigner({
        key: forge.pki.privateKeyFromPem(this.privateKeyPem),
        certificate: forge.pki.certificateFromPem(this.certPem),
        digestAlgorithm: digestOid,
        authenticatedAttributes: [
          { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
          { type: forge.pki.oids.signingTime, value: new Date() },
          { type: forge.pki.oids.messageDigest },
        ],
      });
      p7.sign({ detached: true });

      const signatureDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
      const signatureB64 = forge.util.encode64(signatureDer).match(/.{1,76}/g).join('\r\n') + '\r\n';
      
      const micalg = this.hashAlgo === 'SHA-1' ? 'sha1' : 'sha-256';
      let out = Buffer.alloc(0);

      if (this.prependMime) {
        out = Buffer.concat([out, Buffer.from(
          `Content-Type: multipart/signed; protocol="application/pkcs7-signature"; micalg="${micalg}"; boundary="${this.boundary}"\r\n\r\n`,
          "utf8"
        )]);
      }

      out = Buffer.concat([
        out,
        Buffer.from(`--${this.boundary}\r\n`, 'utf8'),
        signedContent,
        Buffer.from(`\r\n--${this.boundary}\r\n`, 'utf8'),
        Buffer.from(`Content-Type: application/pkcs7-signature; name="smime.p7s"\r\n`, 'utf8'),
        Buffer.from(`Content-Transfer-Encoding: base64\r\n`, 'utf8'),
        Buffer.from(`Content-Disposition: attachment; filename="smime.p7s"\r\n\r\n`, 'utf8'),
        Buffer.from(signatureB64, 'utf8'),
        Buffer.from(`--${this.boundary}--\r\n`, 'utf8')
      ]);

      this.push(out);
      cb();
    } catch (err) { cb(err); }
  }
}

class ForgeVerifyTransform extends Transform {
  private chunks: Buffer[] = [];
  public micContent: Buffer | null = null; 
  
  constructor(private readonly logger: Logger) { super(); }

  _transform(chunk: Buffer, _enc: string, cb: Function) { this.chunks.push(chunk); cb(); }

  _flush(cb: Function) {
    try {
      let currentData = Buffer.concat(this.chunks);

      while (true) {
        let dataStr = currentData.toString('utf8');
        let lowerDataStr = dataStr.toLowerCase();

        // 1. LAYER A: CMS COMPRESSION (ZLIB)
        if (lowerDataStr.includes('smime-type=compressed-data') || lowerDataStr.includes('smime.p7z')) {
          this.logger.debug('CMS CompressedData detected. Unpacking ZLIB stream...');
          let headerEnd = currentData.indexOf(Buffer.from('\r\n\r\n', 'utf8'));
          if (headerEnd === -1) headerEnd = currentData.indexOf(Buffer.from('\n\n', 'utf8'));
          
          if (headerEnd !== -1) {
            let mimeHeaders = currentData.slice(0, headerEnd).toString('utf8');
            let bodyBytes = currentData.slice(headerEnd + (mimeHeaders.includes('\r\n') ? 4 : 2));
            
            if (mimeHeaders.toLowerCase().includes('base64')) {
              bodyBytes = Buffer.from(bodyBytes.toString('utf8').replace(/\s+/g, ''), 'base64');
            }

            let decompressedBuffer: Buffer | null = null;
            
            try {
              const asn1Obj = forge.asn1.fromDer(forge.util.createBuffer(bodyBytes.toString('binary')));
              
              function findAndInflate(node: any) {
                if (decompressedBuffer) return;
                
                if (typeof node.value === 'string' && node.value.length > 10) {
                  const buf = Buffer.from(node.value, 'binary');
                  try { decompressedBuffer = zlib.inflateSync(buf); return; } catch(e) {}
                  try { decompressedBuffer = zlib.inflateRawSync(buf); return; } catch(e) {}
                }
                
                if (Array.isArray(node.value)) {
                  let concatenated = Buffer.alloc(0);
                  let isConstructed = true;
                  for (let child of node.value) {
                    if (typeof child.value === 'string') {
                      concatenated = Buffer.concat([concatenated, Buffer.from(child.value, 'binary')]);
                    } else {
                      isConstructed = false;
                    }
                  }
                  if (isConstructed && concatenated.length > 10) {
                    try { decompressedBuffer = zlib.inflateSync(concatenated); return; } catch(e) {}
                    try { decompressedBuffer = zlib.inflateRawSync(concatenated); return; } catch(e) {}
                  }
                  for (let child of node.value) findAndInflate(child);
                }
              }
              findAndInflate(asn1Obj);
            } catch (e) {
              this.logger.debug('ASN.1 tree mapping skipped, falling back to raw binary scan.');
            }

            if (!decompressedBuffer) {
              this.logger.debug('Scanning binary blob for raw ZLIB Magic Bytes...');
              for (let i = 0; i < bodyBytes.length - 10; i++) {
                if (bodyBytes[i] === 0x78 && (bodyBytes[i+1] === 0x9C || bodyBytes[i+1] === 0xDA || bodyBytes[i+1] === 0x01)) {
                  try {
                    decompressedBuffer = zlib.inflateSync(bodyBytes.slice(i));
                    break;
                  } catch(e) {}
                }
              }
            }

            if (decompressedBuffer) {
              currentData = Buffer.from(decompressedBuffer);
              this.logger.debug('Successfully decompressed CMS payload into signed text.');
              continue; // Restart loop to strip the newly exposed signature!
            } else {
              this.logger.warn('Failed to inflate ZLIB payload. Halting loop to prevent crash.');
              if (!this.micContent) this.micContent = currentData;
              break;
            }
          } else {
            break;
          }
        }

        // 2. LAYER B: DETACHED SIGNATURE (multipart/signed)
        const boundaryMatch = dataStr.match(/boundary\s*=\s*"?([^"\r\n;]+)"?/i);
        if (boundaryMatch && lowerDataStr.includes('multipart/signed')) {
          this.logger.debug('Multipart/Signed Detached Signature detected. Unpacking...');
          const boundaryBuf = Buffer.from(`--${boundaryMatch[1]}`, 'utf8');
          const startIdx = currentData.indexOf(boundaryBuf);
          
          if (startIdx !== -1) {
            let contentStart = startIdx + boundaryBuf.length;
            while (contentStart < currentData.length && (currentData[contentStart] === 32 || currentData[contentStart] === 9)) contentStart++;
            if (currentData[contentStart] === 13 && currentData[contentStart + 1] === 10) contentStart += 2;
            else if (currentData[contentStart] === 10) contentStart += 1;

            const nextBoundaryIdx = currentData.indexOf(boundaryBuf, contentStart);
            if (nextBoundaryIdx !== -1) {
              let actualEnd = nextBoundaryIdx;
              
              // ─── THE RFC 2046 FIX: Backtrack the CRLF that belongs to the boundary ───
              if (actualEnd > contentStart && currentData[actualEnd - 1] === 10) {
                actualEnd--;
                if (actualEnd > contentStart && currentData[actualEnd - 1] === 13) {
                  actualEnd--;
                }
              }
              
              let exactBytes = currentData.slice(contentStart, actualEnd);
              
              // ─── THE PRISTINE MIC HASH ───
              // Because the bytes were sealed in a zip file, they are safe from mutation.
              // We hash the exact binary slice. No regex replacements!
              if (!this.micContent) {
                 this.micContent = exactBytes;
              }

              // Strip the MIME headers so the database gets pure XML
              let headerEnd = exactBytes.indexOf(Buffer.from('\r\n\r\n', 'utf8'));
              if (headerEnd === -1) headerEnd = exactBytes.indexOf(Buffer.from('\n\n', 'utf8'));
              
              if (headerEnd !== -1) {
                let headersStr = exactBytes.slice(0, headerEnd).toString('utf8').toLowerCase();
                let xmlContent = exactBytes.slice(headerEnd + (headersStr.includes('\r\n') ? 4 : 2));
                
                if (headersStr.includes('base64')) {
                  xmlContent = Buffer.from(xmlContent.toString('utf8').replace(/\s+/g, ''), 'base64');
                }
                currentData = xmlContent;
              } else {
                currentData = exactBytes;
              }
              continue; // Restart the loop just in case there's another layer!
            }
          }
          break;
        }

        // 3. LAYER C: ATTACHED SIGNATURE
        if (lowerDataStr.includes('smime-type=signed-data')) {
          this.logger.debug('Attached Signature detected. Unpacking...');
          let headerEnd = currentData.indexOf(Buffer.from('\r\n\r\n', 'utf8'));
          if (headerEnd === -1) headerEnd = currentData.indexOf(Buffer.from('\n\n', 'utf8'));
          
          if (headerEnd !== -1) {
            let mimeHeaders = currentData.slice(0, headerEnd).toString('utf8');
            let bodyBytes = currentData.slice(headerEnd + (mimeHeaders.includes('\r\n') ? 4 : 2));
            if (mimeHeaders.toLowerCase().includes('base64')) {
              bodyBytes = Buffer.from(bodyBytes.toString('utf8').replace(/\s+/g, ''), 'base64');
            }
            
            try {
              const asn1Obj = forge.asn1.fromDer(forge.util.createBuffer(bodyBytes.toString('binary')));
              const msg = forge.pkcs7.messageFromAsn1(asn1Obj);
              let contentStr = '';
              if (msg.content) {
                if (typeof msg.content === 'string') contentStr = msg.content;
                else if (msg.content.data) contentStr = msg.content.data;
                else if (msg.content.value) contentStr = msg.content.value;
              }
              
              let extractedBytes = Buffer.from(contentStr, 'binary');
              if (!this.micContent) this.micContent = extractedBytes;
              currentData = extractedBytes;
              continue;
            } catch (e) {}
          }
          break;
        }

        // 4. FALLBACK: Pure Unsigned/Uncompressed XML
        if (!this.micContent) {
           this.micContent = currentData;
        }
        break;
      }

      // Trim trailing empty space for the database to keep the XML clean
      if (currentData.length >= 2 && currentData[currentData.length - 2] === 13 && currentData[currentData.length - 1] === 10) {
        currentData = currentData.slice(0, currentData.length - 2);
      }
      
      this.push(currentData);
      cb();
    } catch (err) {
      if (!this.micContent) this.micContent = Buffer.concat(this.chunks);
      this.push(this.micContent);
      cb();
    }
  }
}

class ForgeEncryptTransform extends Transform {
  private chunks: Buffer[] = [];
  constructor(private readonly receiverCertPem: string, private readonly encAlgo: string, private readonly isInnerSigned: boolean, private readonly logger: Logger) { super(); }

  _transform(chunk: Buffer, _enc: string, cb: Function) { this.chunks.push(chunk); cb(); }

  _flush(cb: Function) {
    try {
      const innerContent = Buffer.concat(this.chunks);
      let payloadToEncrypt: Buffer;

      if (this.isInnerSigned) {
        payloadToEncrypt = innerContent;
      } else {
        const mimeHeader = Buffer.from("Content-Type: application/xml\r\n\r\n", "utf8");
        payloadToEncrypt = Buffer.concat([mimeHeader, innerContent]);
      }
      
      const p7 = forge.pkcs7.createEnvelopedData();
      const cert = forge.pki.certificateFromPem(this.receiverCertPem);
      
      if (cert.serialNumber.match(/^[89a-f]/i)) cert.serialNumber = '00' + cert.serialNumber;
      p7.addRecipient(cert);
      
      p7.content = forge.util.createBuffer(payloadToEncrypt.toString('binary'));
      
      let cipherOid = forge.pki.oids['aes256-CBC'];
      if (this.encAlgo === '3DES') cipherOid = forge.pki.oids['des-EDE3-CBC'];
      else if (this.encAlgo === 'AES128') cipherOid = forge.pki.oids['aes128-CBC'];

      p7.encrypt(undefined, cipherOid);

      const asn1 = p7.toAsn1();
      const der = forge.asn1.toDer(asn1).getBytes();
      this.push(Buffer.from(der, 'binary'));
      cb();
    } catch (err) { cb(err); }
  }
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  constructor(private readonly partnerService: TradingPartnerService) { }

  calculateMic(data: Buffer, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
    const hash = crypto.createHash(algorithm);
    hash.update(data);
    return `${hash.digest('base64')}, ${algorithm}`;
  }

  async signMdn(body: string, senderAs2Id: string, boundary: string): Promise<string> {
      try {
          const systemCert = await this.partnerService.getSystemCertificateByAs2Id(senderAs2Id);
          if (!systemCert) throw new Error("Missing private key for MDN Signing");
          
          const privKeyPem = systemCert.private_key_pem || systemCert.pem_data;
          const certPem = systemCert.pem_data;
          
          let canonicalBody = body.replace(/(?<!\r)\n/g, '\r\n').trimEnd() + '\r\n';
          
          const p7 = forge.pkcs7.createSignedData();
          p7.content = forge.util.createBuffer(canonicalBody, 'utf8');
          p7.addCertificate(forge.pki.certificateFromPem(certPem));
          p7.addSigner({
            key: forge.pki.privateKeyFromPem(privKeyPem),
            certificate: forge.pki.certificateFromPem(certPem),
            digestAlgorithm: forge.pki.oids.sha256,
            authenticatedAttributes: [
              { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
              { type: forge.pki.oids.signingTime, value: new Date() },
              { type: forge.pki.oids.messageDigest },
            ],
          });
          p7.sign({ detached: true });
          
          const signatureDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
          const signatureB64 = forge.util.encode64(signatureDer).match(/.{1,76}/g).join('\r\n') + '\r\n';
          
          const assembledPayload = 
              `--${boundary}\r\n` +
              canonicalBody + 
              `\r\n--${boundary}\r\n` +
              `Content-Type: application/pkcs7-signature; name="smime.p7s"\r\n` +
              `Content-Transfer-Encoding: base64\r\n` +
              `Content-Disposition: attachment; filename="smime.p7s"\r\n\r\n` +
              signatureB64 +
              `--${boundary}--\r\n`;
                      
          return assembledPayload;
      } catch (e) {
          this.logger.error("MDN Signing Failed", e);
          return body;
      }
  }

  async createDecryptStream(privateKeyPem: string, certificatePem: string): Promise<Transform> {
    return new ForgeDecryptTransform(privateKeyPem, certificatePem, this.logger);
  }

  async createSignStream(privateKeyPem: string, certificatePem: string, hashAlgo: string, boundary: string, prependMime: boolean): Promise<Transform> {
    return new ForgeSignTransform(privateKeyPem, certificatePem, hashAlgo, boundary, prependMime, this.logger);
  }

  async createVerifyStream(): Promise<Transform> { return new ForgeVerifyTransform(this.logger); }

  async createEncryptStream(receiverCertPem: string, encAlgo: string = 'AES256', isInnerSigned: boolean = false): Promise<Transform> {
    return new ForgeEncryptTransform(receiverCertPem, encAlgo, isInnerSigned, this.logger);
  }

  createDecompressStream(): Transform { return zlib.createInflate(); }
  createCompressStream(): Transform { return zlib.createDeflate(); }

  async loadCertificate(as2Id: string): Promise<{ publicKey: string; privateKey?: string }> {
    const partner = await this.partnerService.getPartnerWithCertificate(as2Id);
    return {
      publicKey: partner.certificate.pem_data,
      privateKey: partner.certificate.is_private ? (partner.certificate as any).private_key_pem || partner.certificate.pem_data : undefined,
    };
  }

  checkCertificateExpiration(certPem: string, as2Id: string): void {
    const cert = forge.pki.certificateFromPem(certPem);
    const now = new Date();
    if (now < cert.validity.notBefore) throw new Error(`Certificate for ${as2Id} is not yet valid.`);
    if (now > cert.validity.notAfter) throw new Error(`Certificate for ${as2Id} has expired.`);
  }

  extractPfx(pfxBase64: string, password: string): { privateKeyPem: string, certPem: string } {
    const pfxDer = forge.util.decode64(pfxBase64);
    const p12Asn1 = forge.asn1.fromDer(pfxDer);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
    let privateKeyPem = ''; let certPem = '';
    for (const safeBags of p12.safeContents) {
      for (const bag of safeBags.safeBags) {
        if (bag.type === forge.pki.oids.keyBag || bag.type === forge.pki.oids.pkcs8ShroudedKeyBag) privateKeyPem = forge.pki.privateKeyToPem(bag.key);
        else if (bag.type === forge.pki.oids.certBag && !certPem) certPem = forge.pki.certificateToPem(bag.cert);
      }
    }
    return { privateKeyPem, certPem };
  }
}