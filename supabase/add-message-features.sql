-- Add reply_to column to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL;

-- Add reply_to column to direct_messages
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL;
