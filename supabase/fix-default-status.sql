-- Fix default status for existing users

-- Update all NULL statuses to 'online'
UPDATE public.profiles
SET status = 'online'
WHERE status IS NULL;
