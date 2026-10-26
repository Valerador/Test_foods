-- Enable pg_trgm for fuzzy address matching on dev db
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create test database if not exists
SELECT 'CREATE DATABASE orderflow_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'orderflow_test')\gexec

-- Connect to test db and enable pg_trgm
\c orderflow_test
CREATE EXTENSION IF NOT EXISTS pg_trgm;
