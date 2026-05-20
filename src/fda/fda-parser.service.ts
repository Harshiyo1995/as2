import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as xml2js from 'xml2js';
import { TransactionService } from '../database/transaction.service';

@Injectable()
export class FdaParserService {
  private readonly logger = new Logger(FdaParserService.name);

  constructor(private readonly transactionService: TransactionService) { }

  /**
   * Post-processing function called after an AS2 payload has been decrypted.
   * Checks if it's an FDA ACK2 or ACK3 and parses relevant correlation IDs.
   */
  async processAck(decryptedFilePath: string, messageId: string): Promise<void> {
    this.logger.log(`Parsing potential FDA ACK for Message-ID: ${messageId}`);

    try {
      const xmlData = fs.readFileSync(decryptedFilePath, 'utf-8');

      // FIX: Dropped the trailing '>' character. This ensures the parser identifies the root
      // elements correctly even if they contain attributes like lang="en" or schema namespaces.
      const isAck2 = xmlData.includes('<m2acknowledgement');
      const isAck3 = xmlData.includes('<ichacknowledgement');

      if (!isAck2 && !isAck3) {
        this.logger.debug('Payload content is standard data or plaintext, not an FDA ACK2 or ACK3 XML structure.');
        return;
      }

      // Added stripPrefix processor to safely neutralize XML namespace mutations (e.g. soap/ns2)
      const parser = new xml2js.Parser({
        explicitArray: true,
        tagNameProcessors: [xml2js.processors.stripPrefix]
      });
      const parsedXml = await parser.parseStringPromise(xmlData);

      let correlationId: string | null = null;
      let submissionStatus: string | null = null;
      let ackType = '';

      // Re-mapped nested array object properties to accurately parse real FDA schema trees
      if (isAck2) {
        ackType = 'FDA ACK2 (Gateway Structure Validation)';
        const root = parsedXml?.m2acknowledgement;
        const ackNode = root?.acknowledgement?.[0];

        if (ackNode) {
          correlationId = ackNode.localmessagenumb?.[0] || null;
          const code = ackNode.parsingacknowledgementcode?.[0];
          // '01' indicates clear gateway structural confirmation 
          submissionStatus = code === '01' ? 'Success' : 'Error';
        }
      } else if (isAck3) {
        ackType = 'FDA ACK3 (Clinical Safety Core Acceptance)';
        const root = parsedXml?.ichacknowledgement;
        const msgAckNode = root?.acknowledgement?.[0]?.messageacknowledgement?.[0];

        if (msgAckNode) {
          correlationId = msgAckNode.icsrmessagenumb?.[0] || null;
          const code = msgAckNode.icsrmessageacknowledgementcode?.[0];
          // 'AA' = Application Accept (ACK3 Pass), 'AE' = Application Error (ACK3 Fail)
          submissionStatus = code === 'AA' ? 'Success' : 'Error';
        }
      }

      if (correlationId) {
        // FIX: Automatically normalize the ID format. If the parsed XML string 
        // is missing angle brackets, wrap them on-the-fly to guarantee an exact DB match.
        if (!correlationId.startsWith('<')) correlationId = `<${correlationId}`;
        if (!correlationId.endsWith('>')) correlationId = `${correlationId}>`;

        this.logger.log(`Successfully parsed ${ackType}. Correlated Original Message ID: ${correlationId}, Status: ${submissionStatus}`);

        // Updates database state fields using matching original core transaction IDs
        await this.transactionService.updateFdaAckDetails(messageId, correlationId, submissionStatus);
      } else {
        this.logger.warn(`Identified explicit structural wrappers for ${ackType} but failed to extract correlation metadata.`);
      }
    } catch (error) {
      this.logger.error(`Error parsing FDA ACK for Message-ID ${messageId}`, error.stack);
    }
  }

  /**
   * NEW METHOD: Parses an inbound primary clinical safety data report file structure.
   * Extracts its internal business message number token and normalizes the tracking row's 
   * identifier keys to guarantee downstream automated ACK correlation matching operations.
   */
  async processInboundBasePayload(decryptedFilePath: string, transportMessageId: string): Promise<void> {
    this.logger.log(`Parsing prospective primary data document file for Transport Message-ID: ${transportMessageId}`);

    try {
      const xmlData = fs.readFileSync(decryptedFilePath, 'utf-8');

      // Check if the payload represents a base ICH E2B Safety report document transmission
      const isIcsr = xmlData.includes('<ichicsr');
      if (!isIcsr) {
        this.logger.debug('File data asset represents secondary data contents. Bypassing document re-keying logic.');
        return;
      }

      const parser = new xml2js.Parser({
        explicitArray: true,
        tagNameProcessors: [xml2js.processors.stripPrefix]
      });
      const parsedXml = await parser.parseStringPromise(xmlData);

      // Traverses down standard ICH E2B structural schemas to extract the business value
      let businessMessageNumber: string | null = parsedXml?.ichicsr?.ichicsrmessageheader?.[0]?.messagenumb?.[0] || null;

      if (businessMessageNumber) {
        // Normalize layout with outer tracking brackets to coordinate with processAck query patterns
        if (!businessMessageNumber.startsWith('<')) businessMessageNumber = `<${businessMessageNumber}`;
        if (!businessMessageNumber.endsWith('>')) businessMessageNumber = `${businessMessageNumber}>`;

        this.logger.log(`Matched Business Safety Document Tracking String: ${businessMessageNumber}`);

        // Target underlying repository storage safely without needing controller constructor injections modifications
        const transactionRepository = this.transactionService['transactionRepository'];
        if (transactionRepository) {
          await transactionRepository.update(
            { message_id: transportMessageId },
            { message_id: businessMessageNumber }
          );
          this.logger.log(`Successfully overwritten network envelope key wrapper with core business tracking token.`);
        }
      } else {
        this.logger.warn('Detected primary safety report wrapper tags but failed to parse header business token content fields.');
      }
    } catch (error) {
      this.logger.error(`Error executing primary data layout extraction on tracking target ${transportMessageId}`, error.stack);
    }
  }
}