# AS2 Enterprise Gateway

A high-performance, full-stack B2B Managed File Transfer (MFT) gateway built with **NestJS**, **React**, and **PostgreSQL**. Designed with true enterprise parity (similar to ArcESB/RSSBus), this system provides secure, strictly compliant AS2 payload transmissions, including S/MIME encryption, detached digital signatures, Zlib CMS compression, and mathematically verifiable Message Disposition Notifications (MDNs).

---

## ✨ System Features

* **Full AS2 Compliance:** Supports inbound and outbound routing, S/MIME sealing, and synchronous/asynchronous MDN receipts.
* **Non-Repudiation of Receipt (NRR):** Cryptographic tracking of MIC (Message Integrity Check) hashes and digital signatures.
* **Native Transaction Logging:** Generates physical, timestamped `.log` files capturing socket-level TLS handshakes and byte-transfers.
* **Pristine Payload Preservation:** Extracts and preserves the exact original filenames from standard and attached MIME headers.
* **Modern Dashboard:** A React-based control center for managing certificates, configuring trading partners, and viewing historical audit ledgers.

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18+ recommended)
* **Docker Desktop** (For the PostgreSQL database)
* **Ngrok** (For testing inbound internet traffic locally)

### 1. First-Time Setup
To initialize the project for the first time, open a terminal in the root folder and run our automated setup command. This will install all dependencies for both the backend and frontend, spin up the Docker database, and launch both servers side-by-side:

\`\`\`bash
npm run start:first
\`\`\`

### 2. Daily Development
Once your packages are installed and your database is initialized, you can launch the entire stack using a single command:

\`\`\`bash
npm run start:all
\`\`\`
* **Frontend:** `http://localhost:3000` (or `http://localhost:5173` if using Vite)
* **Backend:** `http://localhost:8080`
* **Database:** `localhost:5433` (as2_gateway)

---

## 🌐 Network Configuration (Ngrok)
The AS2 protocol requires trading partners (like Veeva or the FDA) to push payloads directly to your server. To receive these files locally, you must expose your backend to the internet.

1. Open a new terminal and run:
   \`\`\`bash
   ngrok http 8080
   \`\`\`
2. Copy the secure **Forwarding URL** (e.g., `https://a1b2-c3d4.ngrok-free.app`).
3. Provide this exact URL to your trading partner, appending your receive route:
   * **Inbound Payload URL:** `https://your-ngrok-url.app/as2/receive`
   * **Async MDN URL:** `https://your-ngrok-url.app/as2/mdn`

---

## 🔄 How the Pipeline Works

### Outbound Transmissions (Sending Files)
1. **Upload:** You upload a file via the React UI's "Input" tab.
2. **Staging:** The backend controller (`/as2/send`) intercepts the file, preserving its exact original filename, and stores it temporarily in the local `/data_storage` directory.
3. **Ledger Initialization:** An `OUTBOUND` transaction is registered in PostgreSQL with a `PENDING` status.
4. **The Cryptographic Pipeline:** The `As2OutboundService` passes the file through a stream pipeline:
   * **Sign:** The file is hashed and signed using your Local Station's Private Key (PKCS#12 vault).
   * **Encrypt:** The signed package is enveloped using the Trading Partner's Public Certificate.
5. **Transmission:** The encrypted binary blob is POSTed to the partner's URL. The socket connection logs the TLS handshake to a dedicated `.log` file.
6. **Completion:** Upon receiving an HTTP 200 (and an MDN receipt), the database ledger is updated to `COMPLETED`.

### Inbound Transmissions (Receiving Files)
1. **Handshake:** A trading partner hits your exposed `/as2/receive` endpoint with an encrypted payload. The `As2Controller` verifies the `AS2-From` and `AS2-To` headers against your database.
2. **Ledger Initialization:** An `INBOUND` transaction is registered.
3. **The Unpacking Pipeline:** The `As2Service` routes the binary stream through the deciphering sequence:
   * **Decompress:** Checks for Zlib CMS compression and unpacks it.
   * **Extract Metadata:** Parses the MIME headers to capture the partner's original `filename`.
   * **Verify:** Validates the detached signature against the sender's public certificate to ensure data integrity.
   * **Decrypt:** Uses your Local Station's Private Key to unseal the final raw XML data.
4. **MIC Calculation:** A Message Integrity Check hash is computed on the pristine payload.
5. **Storage:** The decrypted file is saved to `/data_storage/<original-filename>`.
6. **MDN Dispatch:** A digitally signed receipt containing the MIC hash is returned to the partner (either synchronously in the HTTP response, or asynchronously via their requested webhook), and the ledger is marked `COMPLETED`.

---

## 📂 Directory Structure

* `/src` - The NestJS backend engine (Controllers, Services, Pipelines).
* `/dashboard` - The React frontend application.
* `/database` - Contains the TypeORM entities and the `schema.sql` for Docker initialization.
* `/data_storage` - The physical vault where raw files, decrypted payloads, and `.log` transcripts are stored. *(Note: This folder should be excluded via `.gitignore` to prevent sensitive data leaks).*