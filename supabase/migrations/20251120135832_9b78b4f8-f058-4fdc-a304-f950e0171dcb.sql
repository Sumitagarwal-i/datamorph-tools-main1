-- Create conversions table for logging
CREATE TABLE public.conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  input_format TEXT NOT NULL,
  output_format TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert (no auth required)
CREATE POLICY "Anyone can log conversions" 
ON public.conversions 
FOR INSERT 
WITH CHECK (true);

-- Create policy to allow anyone to read (for potential analytics)
CREATE POLICY "Anyone can view conversions" 
ON public.conversions 
FOR SELECT 
USING (true);

-- Create index for faster queries on timestamp
CREATE INDEX idx_conversions_timestamp ON public.conversions(timestamp DESC);