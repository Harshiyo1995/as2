-- PostgreSQL DDL for AS2 Gateway

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trading Partners
CREATE TABLE trading_partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    as2_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(1024), -- Outbound URL for async MDN or sending
    mdn_url VARCHAR(1024), -- Default MDN return URL
    certificate_id UUID, -- Link to public cert for encryption/verification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Certificates (Public keys for partners, Private keys for self)
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alias VARCHAR(255) NOT NULL UNIQUE,
    thumbprint VARCHAR(255) NOT NULL UNIQUE,
    subject_dn TEXT NOT NULL,
    issuer_dn TEXT NOT NULL,
    serial_number VARCHAR(255) NOT NULL,
    is_private BOOLEAN DEFAULT FALSE, -- True if this is our private key (stored securely or referenced via KMS)
    pem_data TEXT NOT NULL, -- Full PEM certificate string (and encrypted private key if applicable)
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key reference to certificates
ALTER TABLE trading_partners
ADD CONSTRAINT fk_tp_certificate
FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE SET NULL;

-- Transactions (Core ledger of messages)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(512) NOT NULL UNIQUE, -- AS2 Message-ID
    correlation_id VARCHAR(512), -- Parsed from FDA ACK2/ACK3 or internal ID
    direction VARCHAR(50) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    sender_as2_id VARCHAR(255) NOT NULL,
    receiver_as2_id VARCHAR(255) NOT NULL,
    subject TEXT,
    raw_file_path VARCHAR(1024), -- Path on disk to the raw encrypted payload
    decrypted_file_path VARCHAR(1024), -- Path to the decrypted content
    status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    fda_submission_status VARCHAR(50), -- Specific status from FDA ACKs (e.g., Success, Warning, Error)
    mdn_status VARCHAR(50) CHECK (mdn_status IN ('PENDING', 'PROCESSED', 'FAILED', 'NOT_REQUIRED')),
    mdn_message_id VARCHAR(512), -- Message-ID of the corresponding MDN
    mic VARCHAR(255), -- Message Integrity Check value computed
    retry_count INTEGER DEFAULT 0,
    error_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_transactions_message_id ON transactions(message_id);
CREATE INDEX idx_transactions_correlation_id ON transactions(correlation_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_sender_receiver ON transactions(sender_as2_id, receiver_as2_id);
