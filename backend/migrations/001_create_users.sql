-- Create users table with all required columns
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(128) PRIMARY KEY, -- Firebase UID
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    profile_picture_url TEXT,
    phone_number VARCHAR(20),
    auth_provider VARCHAR(50) DEFAULT 'email',
    last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create index on last_login for performance
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- Add trigger to update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
