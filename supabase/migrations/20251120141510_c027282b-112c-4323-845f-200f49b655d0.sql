-- Create feedback table
CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit feedback
CREATE POLICY "Anyone can submit feedback"
ON public.feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only allow reading own feedback (optional, for future use)
CREATE POLICY "Users can view all feedback"
ON public.feedback
FOR SELECT
TO authenticated
USING (true);