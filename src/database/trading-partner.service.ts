import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradingPartner } from './entities/trading-partner.entity';
import { Certificate } from './entities/certificate.entity';

@Injectable()
export class TradingPartnerService {
  private readonly logger = new Logger(TradingPartnerService.name);

  constructor(
    @InjectRepository(TradingPartner)
    private readonly partnerRepository: Repository<TradingPartner>,
    @InjectRepository(Certificate)
    private readonly certRepository: Repository<Certificate>,
  ) {}

  /**
   * Strict Multi-Tenant Private Key Registry Lookup
   * STRICT ENFORCEMENT: Finds a private certificate explicitly owned by this local receiver AS2 ID.
   * If no explicit key exists for this exact tenant, it returns null to trigger an immediate routing rejection.
   */
  async getSystemCertificateByAs2Id(as2Id: string): Promise<Certificate | null> {
    // Zero-Trust Lookup: Only return a key if it belongs explicitly to this tenant identity
    const cert = await this.certRepository.findOne({
      where: [
        { is_private: true, alias: as2Id },
        { is_private: true, alias: `${as2Id}-private-cert` }
      ]
    });

    if (!cert) {
      this.logger.error(`❌ Security Isolation Violation: No explicit private key registered for local tenant profile: '${as2Id}'`);
      return null; 
    }

    return cert;
  }

  /**
   * Fetches the Trading Partner and their associated Certificate based on AS2 ID.
   */
  async getPartnerWithCertificate(as2Id: string): Promise<TradingPartner> {
    const partner = await this.partnerRepository.findOne({
      where: { as2_id: as2Id },
      relations: ['certificate'],
    });

    if (!partner) {
      this.logger.warn(`Trading Partner with AS2 ID ${as2Id} not found in database.`);
      throw new NotFoundException(`Trading Partner ${as2Id} not found.`);
    }

    if (!partner.certificate) {
      this.logger.warn(`Trading Partner ${as2Id} has no associated certificate.`);
      throw new NotFoundException(`Certificate for Partner ${as2Id} not found.`);
    }

    return partner;
  }

  /**
   * Fetches the system's own private certificate used for decryption/signing.
   * Typically identified by alias or a specific configuration flag.
   */
  async getSystemPrivateCertificate(): Promise<Certificate> {
    const cert = await this.certRepository.findOne({
      where: { is_private: true },
    });

    if (!cert) {
      this.logger.error('CRITICAL: No private system certificate found in database!');
      throw new Error('System configuration error: Missing private certificate.');
    }

    return cert;
  }

  /**
   * Creates a new Trading Partner and parses/saves their associated public certificate.
   */
  async createPartner(data: { name: string; as2_id: string; url: string; certificate_pem: string }) {
    let savedCert = null;

    if (data.certificate_pem) {
      try {
        const forge = require('node-forge');
        // Parse the PEM
        const certObj = forge.pki.certificateFromPem(data.certificate_pem);
        
        // Extract attributes
        const subjectDn = certObj.subject.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');
        const issuerDn = certObj.issuer.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');
        const validFrom = certObj.validity.notBefore;
        const validTo = certObj.validity.notAfter;
        const serialNumber = certObj.serialNumber;
        
        // Alignment Passage: SHA-1 hashing configuration
        const md = forge.md.sha1.create();
        md.update(forge.asn1.toDer(forge.pki.certificateToAsn1(certObj)).getBytes());
        const thumbprint = md.digest().toHex();

        // Create DB Record
        const newCert = this.certRepository.create({
          alias: `${data.as2_id}-public-cert`,
          thumbprint: thumbprint,
          subject_dn: subjectDn,
          issuer_dn: issuerDn,
          serial_number: serialNumber,
          is_private: false,
          pem_data: data.certificate_pem,
          valid_from: validFrom,
          valid_to: validTo,
        });

        savedCert = await this.certRepository.save(newCert);
        this.logger.log(`Successfully parsed and saved certificate for ${data.as2_id}`);
      } catch (err) {
        this.logger.error(`Failed to parse certificate for ${data.as2_id}`, err);
        throw new Error(`Invalid certificate PEM: ${err.message}`);
      }
    }

    // Create Trading Partner
    const partner = this.partnerRepository.create({
      name: data.name,
      as2_id: data.as2_id,
      url: data.url,
      certificate: savedCert,
    });

    await this.partnerRepository.save(partner);
    this.logger.log(`Successfully created Trading Partner: ${data.name}`);
    return partner;
  }
}