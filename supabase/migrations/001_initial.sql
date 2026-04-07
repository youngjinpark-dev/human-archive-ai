-- pgvector 확장
create extension if not exists vector;

-- 사용자 프로필 (Supabase Auth 연동)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

-- 페르소나
create table personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  domain text,
  description text,
  style text,
  principles text[] default '{}',
  decision_scenarios jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 인터뷰 세션
create table interview_sessions (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  phase_index int default 0,
  question_index int default 0,
  completed boolean default false,
  created_at timestamptz default now()
);

-- 인터뷰 답변 기록
create table interview_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references interview_sessions(id) on delete cascade,
  phase text not null,
  question text not null,
  answer text not null,
  extracted_data jsonb,
  created_at timestamptz default now()
);

-- 임베딩 청크 (RAG)
create table chunks (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  content text not null,
  embedding vector(768),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index chunks_embedding_idx on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 채팅 세션
create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  user_id uuid references profiles(id),
  created_at timestamptz default now()
);

-- 채팅 메시지
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- 파일 업로드
create table file_uploads (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  transcript text,
  status text default 'uploaded' check (status in ('uploaded', 'transcribing', 'embedding', 'done', 'error')),
  created_at timestamptz default now()
);

-- API 키
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  key_hash text not null unique,
  key_prefix text not null,
  owner text not null,
  allowed_personas uuid[],
  active boolean default true,
  created_at timestamptz default now()
);

-- pgvector 유사도 검색 함수
create or replace function match_chunks(
  query_embedding vector(768),
  target_persona_id uuid,
  match_count int default 5
) returns table (id uuid, content text, metadata jsonb, similarity float)
language plpgsql as $$
begin
  return query
    select c.id, c.content, c.metadata,
           1 - (c.embedding <=> query_embedding) as similarity
    from chunks c
    where c.persona_id = target_persona_id
    order by c.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- Auth trigger: 새 사용자 생성 시 profiles에 자동 삽입
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- updated_at 자동 갱신
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger personas_updated_at
  before update on personas
  for each row execute procedure update_updated_at();

-- RLS 정책
alter table profiles enable row level security;
alter table personas enable row level security;
alter table interview_sessions enable row level security;
alter table interview_answers enable row level security;
alter table chunks enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table file_uploads enable row level security;
alter table api_keys enable row level security;

-- profiles
create policy "Users can read own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- personas
create policy "Users can manage own personas" on personas for all using (auth.uid() = user_id);

-- interview_sessions
create policy "Users can manage own interviews" on interview_sessions for all
  using (persona_id in (select id from personas where user_id = auth.uid()));

-- interview_answers
create policy "Users can manage own interview answers" on interview_answers for all
  using (session_id in (
    select is2.id from interview_sessions is2
    join personas p on is2.persona_id = p.id
    where p.user_id = auth.uid()
  ));

-- chunks (service role에서 insert, 사용자는 자기 페르소나 것만 read)
create policy "Users can read own chunks" on chunks for select
  using (persona_id in (select id from personas where user_id = auth.uid()));
create policy "Service can manage chunks" on chunks for all
  using (true) with check (true);

-- chat_sessions
create policy "Users can manage own chat sessions" on chat_sessions for all
  using (user_id = auth.uid());

-- chat_messages
create policy "Users can manage own chat messages" on chat_messages for all
  using (session_id in (select id from chat_sessions where user_id = auth.uid()));

-- file_uploads
create policy "Users can manage own uploads" on file_uploads for all
  using (persona_id in (select id from personas where user_id = auth.uid()));

-- api_keys
create policy "Users can manage own api keys" on api_keys for all
  using (auth.uid() = user_id);

-- Storage bucket for uploads
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false)
on conflict do nothing;

create policy "Users can upload files" on storage.objects for insert
  with check (bucket_id = 'uploads' and auth.role() = 'authenticated');
create policy "Users can read own files" on storage.objects for select
  using (bucket_id = 'uploads' and auth.role() = 'authenticated');
