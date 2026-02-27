-- Create abstracts bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('abstracts', 'abstracts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to the abstracts bucket
CREATE POLICY "Public Access" ON storage.objects FOR ALL
USING (bucket_id = 'abstracts') WITH CHECK (bucket_id = 'abstracts');
