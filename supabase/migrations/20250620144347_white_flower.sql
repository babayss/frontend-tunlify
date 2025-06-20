/*
  # Update tunnels table schema for proper port management

  1. Schema Updates
    - Ensure all required columns exist with proper types
    - Add service_type column for service categorization
    - Add protocol column for protocol specification
    - Add local_port and remote_port columns for port mapping
    - Add proper indexes for performance

  2. Data Migration
    - Set default values for existing records
    - Ensure data consistency

  3. Security
    - Maintain existing RLS policies
*/

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add service_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tunnels' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE tunnels ADD COLUMN service_type text DEFAULT 'custom';
  END IF;

  -- Add protocol column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tunnels' AND column_name = 'protocol'
  ) THEN
    ALTER TABLE tunnels ADD COLUMN protocol text DEFAULT 'tcp';
  END IF;

  -- Add local_port column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tunnels' AND column_name = 'local_port'
  ) THEN
    ALTER TABLE tunnels ADD COLUMN local_port integer DEFAULT 3000;
  END IF;

  -- Add remote_port column (nullable for HTTP services)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tunnels' AND column_name = 'remote_port'
  ) THEN
    ALTER TABLE tunnels ADD COLUMN remote_port integer;
  END IF;
END $$;

-- Update existing records to have proper defaults
UPDATE tunnels 
SET 
  service_type = COALESCE(service_type, 'custom'),
  protocol = COALESCE(protocol, 'tcp'),
  local_port = COALESCE(local_port, 3000)
WHERE service_type IS NULL OR protocol IS NULL OR local_port IS NULL;

-- Add constraints
ALTER TABLE tunnels 
  ALTER COLUMN service_type SET NOT NULL,
  ALTER COLUMN protocol SET NOT NULL,
  ALTER COLUMN local_port SET NOT NULL;

-- Add check constraints for valid values
DO $$
BEGIN
  -- Check if constraint already exists before adding
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'tunnels_protocol_check'
  ) THEN
    ALTER TABLE tunnels ADD CONSTRAINT tunnels_protocol_check 
      CHECK (protocol IN ('tcp', 'udp', 'http'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'tunnels_local_port_check'
  ) THEN
    ALTER TABLE tunnels ADD CONSTRAINT tunnels_local_port_check 
      CHECK (local_port >= 1 AND local_port <= 65535);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'tunnels_remote_port_check'
  ) THEN
    ALTER TABLE tunnels ADD CONSTRAINT tunnels_remote_port_check 
      CHECK (remote_port IS NULL OR (remote_port >= 1 AND remote_port <= 65535));
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tunnels_location_remote_port 
  ON tunnels(location, remote_port) 
  WHERE remote_port IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tunnels_service_type 
  ON tunnels(service_type);

CREATE INDEX IF NOT EXISTS idx_tunnels_protocol 
  ON tunnels(protocol);

-- Add unique constraint for remote port per location (only for non-null ports)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tunnels_unique_remote_port 
  ON tunnels(location, remote_port) 
  WHERE remote_port IS NOT NULL;

-- Update any existing tunnels that might have null remote_port for TCP/UDP
UPDATE tunnels 
SET remote_port = (10000 + (RANDOM() * 50000)::integer)
WHERE protocol IN ('tcp', 'udp') 
  AND remote_port IS NULL;