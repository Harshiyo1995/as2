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
   * Dynamically modifies an existing trading partner connection profile row state safely handling UUID vs String IDs
   */
  async updatePartnerSettings(id: string, updateData: any): Promise<any> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);

    let partner;
    if (isUuid) {
      partner = await this.partnerRepository.findOne({ 
        where: [ { id: id as any }, { as2_id: id } ],
        relations: ['certificate']
      });
    } else {
      partner = await this.partnerRepository.findOne({ 
        where: { as2_id: id },
        relations: ['certificate']
      });
    }

    if (!partner) return null;

    partner.as2_id = updateData.as2_id ?? partner.as2_id;
    partner.url = updateData.url ?? partner.url;
    partner.sign_outbound = updateData.sign_outbound ?? partner.sign_outbound;
    partner.encrypt_outbound = updateData.encrypt_outbound ?? partner.encrypt_outbound;
    partner.encryption_algorithm = updateData.encryption_algorithm ?? partner.encryption_algorithm;
    partner.request_mdn = updateData.request_mdn ?? partner.request_mdn;
    partner.mdn_delivery_mode = updateData.mdn_delivery_mode ?? partner.mdn_delivery_mode;

    return await this.partnerRepository.save(partner);
  }

  /**
   * Strict Multi-Tenant Private Key Registry Lookup
   */
  async getSystemCertificateByAs2Id(as2Id: string) {
    const cert = await this.certRepository.findOne({
      where: [
        { alias: as2Id, is_private: true },
        { alias: `${as2Id}_local_station`, is_private: true }
      ],
    });

    if (!cert) {
      this.logger.error(`❌ Security Isolation Violation: No explicit private key registered for local tenant profile: '${as2Id}'`);
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
        const certObj = forge.pki.certificateFromPem(data.certificate_pem);
        
        const subjectDn = certObj.subject.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');
        const issuerDn = certObj.issuer.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');
        const validFrom = certObj.validity.notBefore;
        const validTo = certObj.validity.notAfter;
        const serialNumber = certObj.serialNumber;
        
        const md = forge.md.sha1.create();
        md.update(forge.asn1.toDer(forge.pki.certificateToAsn1(certObj)).getBytes());
        const thumbprint = md.digest().toHex();

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