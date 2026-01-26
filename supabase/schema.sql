-- AI Chat Hub Database Schema

-- Email verifications table (for code-based auth)
create table if not exists email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

create index idx_email_verifications_email on email_verifications(email);

-- Conversations table
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text null,
  summary text null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_conversations_user_id on conversations(user_id);

-- Messages table
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  parent_message_id uuid references messages(id) on delete set null,  -- user 메시지 ID 참조 (같은 질문에 대한 다른 AI 응답 연결)
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model text not null,
  created_at timestamp with time zone default now()
);

create index idx_messages_conversation_id on messages(conversation_id);
create index idx_messages_parent_id on messages(parent_message_id);

-- Daily usage table
create table if not exists daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_kr date not null,
  request_count integer not null default 0,
  char_count integer not null default 0,
  updated_at timestamp with time zone default now(),
  primary key (user_id, date_kr)
);

-- Profiles table (사용자 프로필 및 설정)
-- auth.users의 주요 정보도 함께 저장하여 마이그레이션 용이성 확보
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  -- auth.users 동기화 필드 (인증 정보 백업)
  email text,
  email_confirmed_at timestamp with time zone,
  phone text,
  phone_confirmed_at timestamp with time zone,
  auth_created_at timestamp with time zone,        -- auth.users.created_at
  auth_updated_at timestamp with time zone,        -- auth.users.updated_at
  last_sign_in_at timestamp with time zone,
  auth_provider text,                              -- google, email 등

  -- 인증 방식 및 비밀번호
  auth_method text default 'email',               -- 'email', 'google', 'otp_only'
  password_hash text,                             -- bcrypt 해시 (OAuth/OTP 사용자는 null)

  -- 사용자 기본 정보
  name text,
  avatar_url text,
  language text default 'ko',                      -- 선호 언어 (ko/en)
  timezone text default 'Asia/Seoul',              -- 시간대

  -- 마케팅/법적 동의
  marketing_agreed boolean default false,          -- 마케팅 수신 동의
  marketing_agreed_at timestamp with time zone,    -- 마케팅 동의 시점
  terms_agreed_at timestamp with time zone,        -- 이용약관 동의 시점
  privacy_agreed_at timestamp with time zone,      -- 개인정보처리방침 동의 시점

  -- AI 서비스 설정
  custom_instructions text,                        -- 사용자 맞춤 지시사항
  preferred_model text default 'gemini-2.5-flash', -- 기본 AI 모델
  memory_enabled boolean default false,            -- 대화 간 기억 기능

  -- 비즈니스/분석
  referral_source text,                            -- 유입 경로 (google, friend, twitter 등)
  subscription_tier text default 'free',           -- 구독 등급 (free/pro)
  last_active_at timestamp with time zone,         -- 마지막 활동 시간

  -- 타임스탬프
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 새 유저 가입 시 프로필 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id,
    email,
    email_confirmed_at,
    phone,
    phone_confirmed_at,
    auth_created_at,
    auth_updated_at,
    last_sign_in_at,
    auth_provider,
    name,
    avatar_url,
    terms_agreed_at,
    privacy_agreed_at,
    created_at
  )
  values (
    new.id,
    new.email,
    new.email_confirmed_at,
    new.phone,
    new.phone_confirmed_at,
    new.created_at,
    new.updated_at,
    new.last_sign_in_at,
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    now(),
    now(),
    now()
  );
  return new;
exception when others then
  -- 트리거 실패 시에도 auth.users 생성은 완료되도록 함
  raise warning 'Failed to create profile for user %: %', new.id, sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

-- auth.users 업데이트 시 profiles도 동기화하는 트리거
create or replace function public.handle_user_update()
returns trigger as $$
begin
  update public.profiles
  set
    email = new.email,
    email_confirmed_at = new.email_confirmed_at,
    phone = new.phone,
    phone_confirmed_at = new.phone_confirmed_at,
    auth_updated_at = new.updated_at,
    last_sign_in_at = new.last_sign_in_at,
    name = coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', profiles.name),
    avatar_url = coalesce(new.raw_user_meta_data->>'avatar_url', profiles.avatar_url),
    updated_at = now()
  where id = new.id;
  return new;
exception when others then
  raise warning 'Failed to update profile for user %: %', new.id, sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

-- 트리거 생성 (이미 존재하면 삭제 후 재생성)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute procedure public.handle_user_update();

-- Row Level Security (RLS)

-- Enable RLS
alter table email_verifications enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table daily_usage enable row level security;
alter table profiles enable row level security;

-- Email verifications policies (service role only - no user access)
-- These are managed by the API with service role key

-- Conversations policies
create policy "conversations_select" on conversations
  for select using (user_id = auth.uid());

create policy "conversations_insert" on conversations
  for insert with check (user_id = auth.uid());

create policy "conversations_update" on conversations
  for update using (user_id = auth.uid());

create policy "conversations_delete" on conversations
  for delete using (user_id = auth.uid());

-- Messages policies
create policy "messages_select" on messages
  for select using (
    conversation_id in (select id from conversations where user_id = auth.uid())
  );

create policy "messages_insert" on messages
  for insert with check (
    conversation_id in (select id from conversations where user_id = auth.uid())
  );

-- Daily usage policies
create policy "daily_usage_select" on daily_usage
  for select using (user_id = auth.uid());

create policy "daily_usage_insert" on daily_usage
  for insert with check (user_id = auth.uid());

create policy "daily_usage_update" on daily_usage
  for update using (user_id = auth.uid());

-- Profiles policies
create policy "profiles_select" on profiles
  for select using (id = auth.uid());

create policy "profiles_update" on profiles
  for update using (id = auth.uid());
