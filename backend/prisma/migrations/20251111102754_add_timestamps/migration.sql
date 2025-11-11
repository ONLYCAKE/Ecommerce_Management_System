-- Add safe timestamp columns with defaults

-- Role.createdAt
DO $$ BEGIN
  ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'Role.createdAt exists, skipping';
END $$;

-- User.createdAt
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'User.createdAt exists, skipping';
END $$;

-- User.updatedAt
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'User.updatedAt exists, skipping';
END $$;

-- Product.createdAt
DO $$ BEGIN
  ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'Product.createdAt exists, skipping';
END $$;