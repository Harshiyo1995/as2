import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { Transform } from 'stream';
import { TradingPartnerService } from '../database/trading-partner.service';

// node-forge used for pure-JS S/MIME crypto — no OpenSSL binary required
const forge = require('node-forge');

/**
 * A Transform stream that buffers all input, then performs
 * node-forge native ASN.1/DER PKCS7 decryption on _flush.
 */
class ForgeDecryptTransform extends Transform {
  private chunks: Buffer[] = [];
  constructor(
    private readonly privateKeyPem: string,
    private readonly certPem: string,
    private readonly logger: Logger,
  ) {
    super();
  }

  _transform(chunk: Buffer, _enc: string, cb: Function) {
    this.chunks.push(chunk);
    cb();
  }

  _flush(cb: Function) {
    try {
      const raw = Buffer.concat(this.chunks);
      this.logger.debug(`Decrypting ${raw.length} bytes via node-forge PKCS7 native DER`);

      const privKey = forge.pki.privateKeyFromPem(this.privateKeyPem);
      const cert = forge.pki.certificateFromPem(this.certPem);

      // Read incoming payload as binary string and parse natively using ASN.1 DER structure
      const binaryString = raw.toString('binary');
      const forgeBuffer = forge.util.createBuffer(binaryString);
      const asn1Obj = forge.asn1.fromDer(forgeBuffer);
      const msg = forge.pkcs7.messageFromAsn1(asn1Obj);

      this.logger.debug(`PKCS7 parsed successfully. Recipients: ${msg.recipients?.length ?? 0}. Cert serial: ${cert.serialNumber}`);

      // FIX: Dynamically scan the envelope to find the specific recipient slot matching your certificate
      const recipient = msg.findRecipient(cert);

      if (!recipient) {
        throw new Error(
          `No matching recipient wrapper found in this AS2 payload for certificate serial: ${cert.serialNumber}. ` +
          `Ensure the trading partner is encrypting data with your exact public certificate key pair.`
        );
      }

      // Decrypt using the isolated recipient entry block and your private key
      msg.decrypt(recipient, privKey);

      if (!msg.content) {
        throw new Error('Decryption produced empty content');
      }

      // Safe cross-conversion from forge utility byte streams back into Node.js Buffer
      const decrypted = Buffer.from(forge.util.bytesToHex(msg.content.getBytes()), 'hex');
      this.logger.debug(`Decryption success. Plaintext size: ${decrypted.length} bytes`);

      this.push(decrypted);
      cb();
    } catch (err) {
      this.logger.error(`ForgeDecryptTransform failed: ${err.message}`);
      cb(err);
    }
  }
}

/**
 * A Transform stream that buffers, then signs with node-forge.
 */
class ForgeSignTransform extends Transform {
  private chunks: Buffer[] = [];
  constructor(
    private readonly privateKeyPem: string,
    private readonly certPem: string,
  ) { super(); }

  _transform(chunk: Buffer, _enc: string, cb: Function) { this.chunks.push(chunk); cb(); }

  _flush(cb: Function) {
    try {
      const content = Buffer.concat(this.chunks);
      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(content.toString('binary'));
      p7.addCertificate(forge.pki.certificateFromPem(this.certPem));
      p7.addSigner({
        key: forge.pki.privateKeyFromPem(this.privateKeyPem),
        certificate: forge.pki.certificateFromPem(this.certPem),
        digestAlgorithm: forge.pki.oids.sha256,
        authenticatedAttributes: [
          { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
          { type: forge.pki.oids.signingTime, value: new Date() },
          { type: forge.pki.oids.messageDigest },
        ],
      });
      p7.sign();
      const pem = forge.pkcs7.messageToPem(p7);
      this.push(Buffer.from(pem));
      cb();
    } catch (err) { cb(err); }
  }
}

/**
 * A Transform stream that buffers all input, then verifies PKCS7 signature.
 */
class ForgeVerifyTransform extends Transform {
  private chunks: Buffer[] = [];
  constructor(
    private readonly senderCertPem: string,
    private readonly logger: Logger,
  ) { super(); }

  _transform(chunk: Buffer, _enc: string, cb: Function) { this.chunks.push(chunk); cb(); }

  _flush(cb: Function) {
    try {
      const raw = Buffer.concat(this.chunks);
      const binaryString = raw.toString('binary');
      const forgeBuffer = forge.util.createBuffer(binaryString);
      const asn1Obj = forge.asn1.fromDer(forgeBuffer);
      const msg = forge.pkcs7.messageFromAsn1(asn1Obj);

      // Create a trust store containing only the exact sender certificate
      const certStore = forge.pki.createCaStore([this.senderCertPem]);
      
      // Verification performs mathematical signature checks and validates against the trust store
      // Note: Node-forge verify requires the message content to be present.
      const verified = msg.verify(certStore);
      if (!verified) {
        throw new Error('integrity-check-failed: Signature verification failed mathematically or certificate mismatch.');
      }

      if (!msg.content) {
        throw new Error('integrity-check-failed: Verified payload produced empty content');
      }

      const verifiedContent = Buffer.from(forge.util.bytesToHex(msg.content.getBytes()), 'hex');
      this.logger.debug(`Signature verification success. Plaintext size: ${verifiedContent.length} bytes`);
      
      this.push(verifiedContent);
      cb();
    } catch (err) {
      this.logger.error(`ForgeVerifyTransform failed: ${err.message}`);
      cb(new Error(`integrity-check-failed: ${err.message}`));
    }
  }
}


/**
 * A Transform stream that buffers, then encrypts with node-forge.
 */
class ForgeEncryptTransform extends Transform {
  private chunks: Buffer[] = [];
  constructor(private readonly receiverCertPem: string) { super(); }

  _transform(chunk: Buffer, _enc: string, cb: Function) { this.chunks.push(chunk); cb(); }

  _flush(cb: Function) {
    try {
      const content = Buffer.concat(this.chunks);
      const p7 = forge.pkcs7.createEnvelopedData();
      p7.addRecipient(forge.pki.certificateFromPem(this.receiverCertPem));
      p7.content = forge.util.createBuffer(content.toString('binary'));
      p7.encrypt(undefined, forge.pki.oids['aes256-CBC']);
      const pem = forge.pkcs7.messageToPem(p7);
      this.push(Buffer.from(pem));
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
    const digest = hash.digest('base64');
    return `${digest}, ${algorithm}`;
  }

  /**
   * S/MIME Decryption via node-forge (pure JS, no OpenSSL binary required).
   */
  async createDecryptStream(privateKeyPem: string, certificatePem: string): Promise<Transform> {
    if (!privateKeyPem || !certificatePem) {
      throw new Error('Private key and certificate PEM are required for decryption');
    }
    return new ForgeDecryptTransform(privateKeyPem, certificatePem, this.logger);
  }

  /**
   * S/MIME Signing via node-forge (For Outbound).
   */
  async createSignStream(privateKeyPem: string, certificatePem: string): Promise<Transform> {
    return new ForgeSignTransform(privateKeyPem, certificatePem);
  }

  /**
   * S/MIME Signature Verification via node-forge (For Inbound).
   */
  async createVerifyStream(senderCertPem: string): Promise<Transform> {
    return new ForgeVerifyTransform(senderCertPem, this.logger);
  }

  /**
   * S/MIME Encryption via node-forge (For Outbound).
   */
  async createEncryptStream(receiverCertPem: string): Promise<Transform> {
    return new ForgeEncryptTransform(receiverCertPem);
  }

  createDecompressStream(): Transform {
    return zlib.createInflate();
  }

  createCompressStream(): Transform {
    return zlib.createDeflate();
  }

  async loadCertificate(as2Id: string): Promise<{ publicKey: string; privateKey?: string }> {
    try {
      const partner = await this.partnerService.getPartnerWithCertificate(as2Id);
      return {
        publicKey: partner.certificate.pem_data,
        privateKey: partner.certificate.is_private ? (partner.certificate as any).private_key_pem || partner.certificate.pem_data : undefined,
      };
    } catch (e) {
      this.logger.error(`Failed to load certificate for ${as2Id}`, e);
      throw e;
    }
  }

  /**
   * Strictly validates if a certificate is mathematically valid right now based on timestamps.
   */
  checkCertificateExpiration(certPem: string, as2Id: string): void {
    const cert = forge.pki.certificateFromPem(certPem);
    const now = new Date();
    if (now < cert.validity.notBefore) {
      throw new Error(`Certificate for ${as2Id} is not yet valid. Becomes valid at ${cert.validity.notBefore}`);
    }
    if (now > cert.validity.notAfter) {
      throw new Error(`Certificate for ${as2Id} has expired. Expired at ${cert.validity.notAfter}`);
    }
  }
}