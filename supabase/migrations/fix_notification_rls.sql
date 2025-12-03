-- Fix RLS policies for notification_subscriptions table
-- Run this in your Supabase SQL Editor

-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.notification_subscriptions;
DROP POLICY IF EXISTS "Only authenticated users can view subscriptions" ON public.notification_subscriptions;
DROP POLICY IF EXISTS "Enable insert for anon users" ON public.notification_subscriptions;
DROP POLICY IF EXISTS "Enable read for authenticated users only" ON public.notification_subscriptions;

-- Temporarily disable RLS to test (uncomment if needed for debugging)
-- ALTER TABLE public.notification_subscriptions DISABLE ROW LEVEL SECURITY;

-- OR keep RLS enabled with these permissive policies:
-- Allow ALL users (anon and authenticated) to insert
CREATE POLICY "Allow public inserts" ON public.notification_subscriptions
  FOR INSERT 
  WITH CHECK (true);

-- Allow only authenticated users to read
CREATE POLICY "Allow authenticated reads" ON public.notification_subscriptions
  FOR SELECT
  TO authenticated
  USING (true);

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'notification_subscriptions';
