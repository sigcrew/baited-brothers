create table if not exists public.apple_auth_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id text not null,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apple_auth_tokens_client_id_length
    check (char_length(client_id) between 3 and 255)
);

alter table public.apple_auth_tokens enable row level security;

revoke all on table public.apple_auth_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.apple_auth_tokens to service_role;

comment on table public.apple_auth_tokens is
  'Encrypted Sign in with Apple refresh tokens used only for account-deletion revocation.';
comment on column public.apple_auth_tokens.client_id is
  'Apple App ID or Services ID that issued the stored refresh token.';
comment on column public.apple_auth_tokens.refresh_token_ciphertext is
  'AES-GCM ciphertext. The encryption key is stored only in Edge Function secrets.';
comment on column public.apple_auth_tokens.refresh_token_iv is
  'Unique 96-bit AES-GCM initialization vector encoded as base64.';
