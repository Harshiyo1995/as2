import { Controller, Get, Post, Body, Delete, Param } from '@nestjs/common';
import { TradingPartnerService } from './trading-partner.service';

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

  @Post()
  async createPartner(@Body() body: { name: string; as2_id: string; url: string; certificate_pem: string }) {
    return this.partnerService.createPartner(body);
  }

  /**
   * NEW: POST /api/partners/upload-cert
   * Receives the parsed node-forge certificate metadata package from the frontend grid
   */
  @Post('upload-cert')
  async uploadCertificate(@Body() body: any) {
    const partnerRepository = this.partnerService['partnerRepository'];
    const manager = partnerRepository.manager;

    // 1. Manually save the certificate row first to bypass missing cascade properties.
    // Passing the string 'Certificate' targets the metadata registry cleanly without new imports.
    const savedCert = await manager.save('Certificate', {
      alias: body.certificate.alias,
      serial_number: body.certificate.serial_number,
      subject_dn: body.certificate.subject_dn,
      issuer_dn: body.certificate.issuer_dn,
      valid_from: new Date(body.certificate.valid_from),
      valid_to: new Date(body.certificate.valid_to),
      thumbprint: body.certificate.thumbprint,
      pem_data: body.certificate.pem_data, // Feeds our frontend tester dropdown lookup
      is_private: body.certificate.is_private,
    });

    // 2. Create the partner entity container and assign the saved certificate record to it
    const newPartner = partnerRepository.create({
      name: body.name,
      as2_id: body.as2_id,
      url: body.url,
      certificate: savedCert, // Correctly linked as a fully instantiated table row
    });

    // 3. Commit the partner to the datastore
    return await partnerRepository.save(newPartner);
  }

  @Delete(':id')
  async deletePartner(@Param('id') id: string) {
    const partnerRepository = this.partnerService['partnerRepository'];
    const certRepository = this.partnerService['certRepository'];

    const partner = await partnerRepository.findOne({
      where: { id },
      relations: ['certificate'],
    });

    if (!partner) {
      return { success: false, message: 'Partner not found' };
    }

    const cert = partner.certificate;

    // Delete partner first
    await partnerRepository.delete(id);

    // If partner had a public certificate, delete it too
    if (cert && !cert.is_private) {
      await certRepository.delete(cert.id);
    }

    return { success: true };
  }

  @Delete('certs/:certId')
  async deleteCertificate(@Param('certId') certId: string) {
    const certRepository = this.partnerService['certRepository'];

    const cert = await certRepository.findOne({
      where: { id: certId },
    });

    if (!cert) {
      return { success: false, message: 'Certificate not found' };
    }

    // Since onDelete is SET NULL on trading partner relationship, deleting the cert is safe
    await certRepository.delete(certId);

    return { success: true };
  }
}