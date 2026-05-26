import { Controller, Get, Post, Body, Put, Delete, Param, BadRequestException } from '@nestjs/common';
import { TradingPartnerService } from './trading-partner.service';
const forge = require('node-forge');

@Controller('api/partners')
export class TradingPartnerController {
  constructor(private readonly partnerService: TradingPartnerService) { }

  @Get()
  async getAllPartners() {
    return this.partnerService['partnerRepository'].find({
      relations: ['certificate'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * NEW: Fetch all raw certificates (both Public Partners and Private Stations)
   */
  @Get('certs')
  async getAllCertificates() {
    return this.partnerService['certRepository'].find({
      order: { created_at: 'DESC' },
    });
  }

  @Post()
  async createPartner(@Body() body: { name: string; as2_id: string; url: string; certificate_pem: string }) {
    return this.partnerService.createPartner(body);
  }

  /**
   * Catches the React frontend payload and forcefully updates ALL settings in PostgreSQL.
   */
  @Put(':id')
  async updatePartner(@Param('id') id: string, @Body() body: any) {
    const partnerRepository = this.partnerService['partnerRepository'];
    
    // 1. Find the exact database record
    let partner = await partnerRepository.findOne({ where: { id: id } });
    if (!partner) {
      partner = await partnerRepository.findOne({ where: { as2_id: id } });
    }

    if (!partner) {
      throw new BadRequestException(`Trading partner with identifier [${id}] not found in database.`);
    }

    // 2. Clean up React-specific payload objects so they don't crash PostgreSQL
    const cleanPayload = { ...body };
    delete cleanPayload.tls_protocols; // We only save the parsed string (tls_enabled_protocols)
    delete cleanPayload.certificate;   

    // 3. FORCE THE SQL UPDATE FOR ALL FIELDS DYNAMICALLY
    // By passing 'cleanPayload' directly, TypeORM will map every single key sent 
    // by React straight into the database columns without needing them hardcoded line-by-line.
    await partnerRepository.update(partner.id, cleanPayload);

    // 4. Fetch the fresh, updated entity to confirm success
    const updatedPartner = await partnerRepository.findOne({ 
        where: { id: partner.id }, 
        relations: ['certificate'] 
    });

    // 5. Return the exact JSON structure your frontend expects
    return {
      success: true,
      message: 'Trading partner configuration updated dynamically.',
      data: updatedPartner
    };
  }

  /**
   * Receives the parsed public certificate metadata package to create a trading partner
   */
  @Post('upload-cert')
  async uploadCertificate(@Body() body: any) {
    const partnerRepository = this.partnerService['partnerRepository'];
    const manager = partnerRepository.manager;

    const savedCert = await manager.save('Certificate', {
      alias: body.certificate.alias,
      serial_number: body.certificate.serial_number,
      subject_dn: body.certificate.subject_dn,
      issuer_dn: body.certificate.issuer_dn,
      valid_from: new Date(body.certificate.valid_from),
      valid_to: new Date(body.certificate.valid_to),
      thumbprint: body.certificate.thumbprint,
      pem_data: body.certificate.pem_data,
      is_private: false,
    });

    // ─── NOW SAVING FULL CONNECTOR PROFILES ───
    const newPartner = partnerRepository.create({
      name: body.name,
      as2_id: body.as2_id,
      url: body.url,
      sign_outbound: body.sign_outbound,
      encrypt_outbound: body.encrypt_outbound,
      encryption_algorithm: body.encryption_algorithm,
      signature_algorithm: body.signature_algorithm,
      request_mdn: body.request_mdn,
      mdn_delivery_mode: body.mdn_delivery_mode,
      mdn_url: body.mdn_url,
      connection_timeout: body.connection_timeout,
      certificate: savedCert,
    });

    return await partnerRepository.save(newPartner);
  }

  @Post('upload-private-key')
  async uploadPrivateKey(@Body() body: any) {
    let privPem = body.private_key_pem;
    let certPem = body.certificate_pem;

    // ─── NATIVE NODE-FORGE PFX EXTRACTION ───
    if (body.pfx_base64 && body.password) {
      try {
        const pfxDer = forge.util.decode64(body.pfx_base64);
        const p12Asn1 = forge.asn1.fromDer(pfxDer);
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, body.password);

        for (const safeBags of p12.safeContents) {
          for (const bag of safeBags.safeBags) {
            if (bag.type === forge.pki.oids.keyBag || bag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
              privPem = forge.pki.privateKeyToPem(bag.key);
            } else if (bag.type === forge.pki.oids.certBag) {
              if (!certPem) {
                certPem = forge.pki.certificateToPem(bag.cert);
              }
            }
          }
        }
      } catch (err) {
        throw new BadRequestException(`Invalid .pfx vault or incorrect password. (${err.message})`);
      }
    }

    if (!privPem || !certPem) {
      throw new BadRequestException('A valid private key and certificate could not be extracted.');
    }

    const certObj = forge.pki.certificateFromPem(certPem);
    const formatDn = (attrs: any[]) => attrs.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');

    const partnerRepository = this.partnerService['partnerRepository'];
    const manager = partnerRepository.manager;

    const savedCert = await manager.save('Certificate', {
      alias: `${body.as2_id}_local_station`,
      serial_number: certObj.serialNumber,
      subject_dn: formatDn(certObj.subject.attributes),
      issuer_dn: formatDn(certObj.issuer.attributes),
      valid_from: certObj.validity.notBefore,
      valid_to: certObj.validity.notAfter,
      thumbprint: forge.md.sha1.create().update(forge.asn1.toDer(forge.pki.certificateToAsn1(certObj)).getBytes()).digest().toHex().toUpperCase(),
      pem_data: certPem,
      private_key_pem: privPem,
      is_private: true,
    });

    return savedCert;
  }

  @Delete(':id')
  async deletePartner(@Param('id') id: string) {
    const partnerRepository = this.partnerService['partnerRepository'];
    const certRepository = this.partnerService['certRepository'];

    const partner = await partnerRepository.findOne({
      where: { id },
      relations: ['certificate'],
    });

    if (!partner) return { success: false, message: 'Partner not found' };

    const cert = partner.certificate;
    await partnerRepository.delete(id);

    if (cert && !cert.is_private) {
      await certRepository.delete(cert.id);
    }
    return { success: true };
  }

  @Delete('certs/:certId')
  async deleteCertificate(@Param('certId') certId: string) {
    const certRepository = this.partnerService['certRepository'];
    await certRepository.delete(certId);
    return { success: true };
  }
}