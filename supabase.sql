-- Devices table
create table devices (
  device_id text primary key,
  secret text not null,
  trust int default 50 check (trust between 0 and 100),
  status text default 'active' check (status in ('active', 'blocked', 'revoked')),
  created_at timestamptz default now()
);

-- Blockchain table (idx PK prevents forks)
create table blocks (
  idx bigint primary key,
  ts bigint not null,
  event text not null,
  device_id text,
  data jsonb default '{}'::jsonb,
  prev_hash text not null,
  hash text not null
);

-- Nonces table (replay prevention)
create table nonces (
  nonce text primary key,
  ts bigint not null
);

-- Genesis block
insert into blocks (idx, ts, event, device_id, data, prev_hash, hash)
values (0, 0, 'GENESIS', 'system', '{}'::jsonb, '0',
  encode(sha256(convert_to('00GENESISsystem{}0', 'UTF8')), 'hex'))
on conflict do nothing;