-- PostgreSQL DDL for AS2 Gateway (ArcESB Parity Edition)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Certificates Store Table 
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alias VARCHAR(255) NOT NULL UNIQUE,
    thumbprint VARCHAR(255) NOT NULL UNIQUE,
    subject_dn TEXT NOT NULL,
    issuer_dn TEXT NOT NULL,
    serial_number VARCHAR(255) NOT NULL,
    is_private BOOLEAN DEFAULT FALSE,
    pem_data TEXT NOT NULL,
    private_key_pem TEXT,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Trading Partners Profile Table (Fully Expanded for ArcESB Parity)
CREATE TABLE IF NOT EXISTS trading_partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    as2_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(1024),
    
    -- Basic Security Info
    sign_outbound BOOLEAN DEFAULT TRUE,
    encrypt_outbound BOOLEAN DEFAULT TRUE,
    require_signature BOOLEAN DEFAULT TRUE,
    require_encryption BOOLEAN DEFAULT TRUE,
    compress_outbound BOOLEAN DEFAULT FALSE,
    encryption_algorithm VARCHAR(50) DEFAULT '3DES',
    signature_algorithm VARCHAR(50) DEFAULT 'SHA256',
    
    -- MDN Receipts
    request_mdn BOOLEAN DEFAULT TRUE,
    mdn_security VARCHAR(50) DEFAULT 'SIGNED',
    mdn_delivery_mode VARCHAR(50) DEFAULT 'SYNC',
    mdn_url VARCHAR(1024),
    connection_timeout INTEGER DEFAULT 60,
    
    -- Partner Public Key Link
    certificate_id UUID,
    
    -- Advanced Tab: Reliability & Local Profile
    as2_reliability BOOLEAN DEFAULT FALSE,
    as2_reliability_interval INTEGER DEFAULT 30,
    alternate_local_as2_id VARCHAR(255),
    alternate_private_cert_id UUID,
    alternate_private_cert_password VARCHAR(255),
    
    -- Advanced Tab: TLS Client Authentication
    tls_use_profile_settings BOOLEAN DEFAULT TRUE,
    tls_private_cert_id UUID,
    tls_private_cert_password VARCHAR(255),
    
    -- Advanced Tab: HTTP Authentication
    http_auth_enabled BOOLEAN DEFAULT FALSE,
    http_auth_type VARCHAR(50) DEFAULT 'BASIC',
    http_auth_user VARCHAR(255),
    http_auth_password VARCHAR(255),
    
    -- Advanced Tab: Network & Routing
    tls_enabled_protocols TEXT DEFAULT 'TLSv1.1,TLSv1.2',
    temp_receive_directory VARCHAR(1024),
    custom_http_headers TEXT,
    
    -- Advanced Tab: Proxies
    use_global_proxy BOOLEAN DEFAULT TRUE,
    proxy_type VARCHAR(50) DEFAULT 'None',
    proxy_host VARCHAR(255),
    proxy_port INTEGER,
    proxy_user VARCHAR(255),
    proxy_password VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys for Certs
    CONSTRAINT fk_tp_certificate FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE SET NULL,
    CONSTRAINT fk_tp_alt_private_cert FOREIGN KEY (alternate_private_cert_id) REFERENCES certificates(id) ON DELETE SET NULL,
    CONSTRAINT fk_tp_tls_private_cert FOREIGN KEY (tls_private_cert_id) REFERENCES certificates(id) ON DELETE SET NULL
);

-- 3. Transactions Audit Ledger Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(512) NOT NULL UNIQUE,
    correlation_id VARCHAR(512),
    direction VARCHAR(50) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    sender_as2_id VARCHAR(255) NOT NULL,
    receiver_as2_id VARCHAR(255) NOT NULL,
    subject TEXT,
    raw_file_path VARCHAR(1024),
    decrypted_file_path VARCHAR(1024),
    status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    fda_submission_status VARCHAR(50),
    mdn_status VARCHAR(50) CHECK (mdn_status IN ('PENDING', 'PROCESSED', 'FAILED', 'NOT_REQUIRED')),
    mdn_message_id VARCHAR(512),
    mic VARCHAR(255),
    retry_count INTEGER DEFAULT 0,
    error_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_message_id ON transactions(message_id);
CREATE INDEX IF NOT EXISTS idx_transactions_correlation_id ON transactions(correlation_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_sender_receiver ON transactions(sender_as2_id, receiver_as2_id);