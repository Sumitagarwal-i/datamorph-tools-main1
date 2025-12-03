-- Create notification_subscriptions table for Detective D email notifications
-- This table stores email addresses of users who want to be notified when Detective D launches

CREATE TABLE IF NOT EXISTS public.notification_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_email ON public.notification_subscriptions(email);

-- Add index on subscribed_at for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_subscribed_at ON public.notification_subscriptions(subscribed_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.notification_subscriptions;
DROP POLICY IF EXISTS "Only authenticated users can view subscriptions" ON public.notification_subscriptions;

-- Create policy to allow anonymous users to insert (subscribe)
CREATE POLICY "Enable insert for anon users" ON public.notification_subscriptions
  FOR INSERT 
  TO anon
  WITH CHECK (true);

-- Create policy to allow only authenticated users to view subscriptions (admin access)
CREATE POLICY "Enable read for authenticated users only" ON public.notification_subscriptions
  FOR SELECT
  TO authenticated
  USING (true);

-- Add comment to table
COMMENT ON TABLE public.notification_subscriptions IS 'Stores email subscriptions for Detective D launch notifications';

-- Add comments to columns
COMMENT ON COLUMN public.notification_subscriptions.id IS 'Unique identifier for the subscription';
COMMENT ON COLUMN public.notification_subscriptions.email IS 'Email address of the subscriber (unique)';
COMMENT ON COLUMN public.notification_subscriptions.subscribed_at IS 'Timestamp when the user subscribed';
COMMENT ON COLUMN public.notification_subscriptions.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN public.notification_subscriptions.updated_at IS 'Timestamp when the record was last updated';

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function before update
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.notification_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
