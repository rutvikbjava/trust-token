-- Blockchain IoT Authentication Database Schema
-- This matches your current database structure

-- Devices table
create table if not exists devices (
  device_id text primary key,
  secret_hash text not null,
  trust_score int default 50 check (trust_score between 0 and 100),
  status text default 'active' check (status in ('active', 'blocked', 'revoked')),
  last_auth_at bigint,
  created_at timestamptz default now()
);

-- Blockchain table
create table if not exists blockchain (
  idx bigint primary key,
  ts bigint not null,
  event text not null,
  device_id text,
  data text default '{}',
  prev_hash text not null,
  hash text not null
);

-- Nonces table (composite primary key)
create table if not exists nonces (
  device_id text not null,
  nonce text not null,
  used_at timestamptz default now(),
  primary key (device_id, nonce)
);

-- Indexes for performance
create index if not exists idx_blockchain_device on blockchain(device_id);
create index if not exists idx_blockchain_ts on blockchain(ts);
create index if not exists idx_nonces_used_at on nonces(used_at);

-- Genesis block
insert into blockchain (idx, ts, event, device_id, data, prev_hash, hash)
values (0, 0, 'GENESIS', 'system', '{}', '0',
  encode(sha256(convert_to('00GENESISsystem{}0', 'UTF8')), 'hex'))
on conflict (idx) do nothing;

-- Verify setup
select 'Database schema ready!' as status;
select 'Genesis block:', * from blockchain where idx = 0;
