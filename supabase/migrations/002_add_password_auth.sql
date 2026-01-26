-- Migration: Add password authentication support
-- Run this SQL in your Supabase SQL Editor

-- Add auth_method and password_hash columns to profiles table
DO $$
BEGIN
    -- Add auth_method column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'auth_method'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN auth_method text DEFAULT 'email';

        COMMENT ON COLUMN public.profiles.auth_method IS 'Authentication method: email, google, otp_only';
    END IF;

    -- Add password_hash column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN password_hash text;

        COMMENT ON COLUMN public.profiles.password_hash IS 'bcrypt hashed password (null for OAuth users)';
    END IF;
END $$;

-- Update existing Google OAuth users to have auth_method = 'google'
UPDATE public.profiles
SET auth_method = 'google'
WHERE auth_provider = 'google' AND (auth_method IS NULL OR auth_method = 'email');

-- Update existing OTP-only users (no password) to have auth_method = 'otp_only'
-- (Run this later if you want to distinguish OTP-only users)
-- UPDATE public.profiles
-- SET auth_method = 'otp_only'
-- WHERE auth_provider = 'email' AND password_hash IS NULL AND auth_method = 'email';
