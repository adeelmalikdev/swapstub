
CREATE TABLE public.auth_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup','recovery')),
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auth_otps_email_purpose_idx ON public.auth_otps (lower(email), purpose, created_at DESC);

GRANT ALL ON public.auth_otps TO service_role;

ALTER TABLE public.auth_otps ENABLE ROW LEVEL SECURITY;

-- No policies = no anon/authenticated access. Only service_role (which bypasses RLS) can use it.
