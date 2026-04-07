-- ============================================================
-- 003_judgment_framework.sql
-- 판단 프레임워크 아카이빙 신규 테이블 + 기존 테이블 확장
-- ============================================================

-- ============================================================
-- 1. 신규 테이블
-- ============================================================

-- 판단 프레임워크 (페르소나당 1개)
create table judgment_frameworks (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null unique references personas(id) on delete cascade,
  philosophy text,
  domains text[] default '{}',
  version int default 1,
  status text default 'building'
    check (status in ('building', 'ready', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger judgment_frameworks_updated_at
  before update on judgment_frameworks
  for each row execute procedure update_updated_at();

-- 판단 축
create table judgment_axes (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references judgment_frameworks(id) on delete cascade,
  name text not null,
  description text,
  weight numeric(3,2) default 0.5
    check (weight >= 0 and weight <= 1),
  domain text,
  evidence_count int default 0,
  created_at timestamptz default now()
);

create index judgment_axes_framework_idx on judgment_axes(framework_id);

-- If-Then 판단 패턴
create table if_then_patterns (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references judgment_frameworks(id) on delete cascade,
  condition text not null,
  action text not null,
  reasoning text,
  axis_id uuid references judgment_axes(id) on delete set null,
  confidence numeric(3,2) default 0.5
    check (confidence >= 0 and confidence <= 1),
  source_type text not null
    check (source_type in ('interview', 'audio', 'manual')),
  source_id uuid,
  created_at timestamptz default now()
);

create index if_then_patterns_framework_idx on if_then_patterns(framework_id);
create index if_then_patterns_axis_idx on if_then_patterns(axis_id);

-- 경험 스토리
create table experience_stories (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references judgment_frameworks(id) on delete cascade,
  title text not null,
  summary text not null,
  context text not null,
  decision text not null,
  outcome text,
  lesson text,
  related_axes uuid[] default '{}',
  embedding vector(768),
  source_type text not null
    check (source_type in ('interview', 'audio', 'manual')),
  source_id uuid,
  created_at timestamptz default now()
);

create index stories_embedding_idx on experience_stories
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index stories_framework_idx on experience_stories(framework_id);

-- ============================================================
-- 2. 기존 테이블 확장
-- ============================================================

-- personas: 프레임워크 연결 참조
alter table personas add column framework_id uuid references judgment_frameworks(id);

-- interview_sessions: 심층 인터뷰 지원
alter table interview_sessions add column mode text default 'classic'
  check (mode in ('classic', 'deep'));
alter table interview_sessions add column total_questions int default 0;
alter table interview_sessions add column saturation_score numeric(3,2) default 0;

-- interview_answers: 추출 결과 저장
alter table interview_answers add column extracted_axes jsonb default '[]';
alter table interview_answers add column extracted_patterns jsonb default '[]';
alter table interview_answers add column extracted_stories jsonb default '[]';
alter table interview_answers add column question_intent text;

-- ============================================================
-- 3. RPC 함수
-- ============================================================

-- 경험 스토리 유사도 검색
create or replace function match_stories(
  query_embedding vector(768),
  target_framework_id uuid,
  match_count int default 5
) returns table (
  id uuid,
  title text,
  summary text,
  context text,
  decision text,
  outcome text,
  lesson text,
  related_axes uuid[],
  similarity float
)
language plpgsql as $$
begin
  return query
    select
      es.id, es.title, es.summary, es.context,
      es.decision, es.outcome, es.lesson, es.related_axes,
      1 - (es.embedding <=> query_embedding) as similarity
    from experience_stories es
    where es.framework_id = target_framework_id
      and es.embedding is not null
    order by es.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- 품질 게이트 v2 (기존 v1 하위 호환)
create or replace function check_quality_gate_v2(target_persona_id uuid)
returns jsonb
language plpgsql security definer as $$
declare
  result jsonb;
  v_framework_id uuid;
  v_axes_count int;
  v_patterns_count int;
  v_stories_count int;
  v_deep_interview boolean;
  v_must_pass boolean;
  v_interview_complete boolean;
  v_chunks_count int;
  v_principles_count int;
  v_scenarios_count int;
begin
  -- 프레임워크 존재 확인
  select jf.id into v_framework_id
  from judgment_frameworks jf
  where jf.persona_id = target_persona_id and jf.status = 'ready';

  -- 프레임워크 없으면 기존 v1 로직
  if v_framework_id is null then
    select exists(
      select 1 from interview_sessions
      where persona_id = target_persona_id and completed = true
    ) into v_interview_complete;

    select count(*) into v_chunks_count
    from chunks where persona_id = target_persona_id;

    select coalesce(array_length(principles, 1), 0) into v_principles_count
    from personas where id = target_persona_id;

    select coalesce(jsonb_array_length(decision_scenarios), 0) into v_scenarios_count
    from personas where id = target_persona_id;

    return jsonb_build_object(
      'version', 1,
      'interview_complete', v_interview_complete,
      'chunks_count', v_chunks_count,
      'principles_count', v_principles_count,
      'scenarios_count', v_scenarios_count,
      'eligible', v_interview_complete and v_chunks_count >= 1
    );
  end if;

  -- 새 품질 게이트
  select count(*) into v_axes_count
  from judgment_axes where framework_id = v_framework_id;

  select count(*) into v_patterns_count
  from if_then_patterns where framework_id = v_framework_id;

  select count(*) into v_stories_count
  from experience_stories where framework_id = v_framework_id;

  select exists(
    select 1 from interview_sessions
    where persona_id = target_persona_id and mode = 'deep' and completed = true
  ) into v_deep_interview;

  v_must_pass := v_deep_interview
    and v_axes_count >= 3
    and v_patterns_count >= 8
    and v_stories_count >= 5;

  result := jsonb_build_object(
    'version', 2,
    'framework_id', v_framework_id,
    'deep_interview_complete', v_deep_interview,
    'axes_count', v_axes_count,
    'patterns_count', v_patterns_count,
    'stories_count', v_stories_count,
    'must_pass', v_must_pass
  );

  return result;
end;
$$;

-- ============================================================
-- 4. RLS 정책
-- ============================================================

alter table judgment_frameworks enable row level security;
alter table judgment_axes enable row level security;
alter table if_then_patterns enable row level security;
alter table experience_stories enable row level security;

-- 소유자 접근
create policy "Users can manage own frameworks" on judgment_frameworks for all
  using (persona_id in (select id from personas where user_id = auth.uid()));

create policy "Users can manage own axes" on judgment_axes for all
  using (framework_id in (
    select jf.id from judgment_frameworks jf
    join personas p on jf.persona_id = p.id
    where p.user_id = auth.uid()
  ));

create policy "Users can manage own patterns" on if_then_patterns for all
  using (framework_id in (
    select jf.id from judgment_frameworks jf
    join personas p on jf.persona_id = p.id
    where p.user_id = auth.uid()
  ));

create policy "Users can manage own stories" on experience_stories for all
  using (framework_id in (
    select jf.id from judgment_frameworks jf
    join personas p on jf.persona_id = p.id
    where p.user_id = auth.uid()
  ));

-- 구매자 읽기 접근
create policy "Buyers can read purchased frameworks" on judgment_frameworks for select
  using (persona_id in (
    select pu.persona_id from purchases pu
    where pu.buyer_id = auth.uid() and pu.status = 'confirmed'
  ));

create policy "Buyers can read purchased axes" on judgment_axes for select
  using (framework_id in (
    select jf.id from judgment_frameworks jf
    join purchases pu on jf.persona_id = pu.persona_id
    where pu.buyer_id = auth.uid() and pu.status = 'confirmed'
  ));

create policy "Buyers can read purchased patterns" on if_then_patterns for select
  using (framework_id in (
    select jf.id from judgment_frameworks jf
    join purchases pu on jf.persona_id = pu.persona_id
    where pu.buyer_id = auth.uid() and pu.status = 'confirmed'
  ));

create policy "Buyers can read purchased stories" on experience_stories for select
  using (framework_id in (
    select jf.id from judgment_frameworks jf
    join purchases pu on jf.persona_id = pu.persona_id
    where pu.buyer_id = auth.uid() and pu.status = 'confirmed'
  ));

-- 서비스 역할 전체 접근 (추출 엔진 등에서 사용)
create policy "Service can manage frameworks" on judgment_frameworks for all
  using (true) with check (true);
create policy "Service can manage axes" on judgment_axes for all
  using (true) with check (true);
create policy "Service can manage patterns" on if_then_patterns for all
  using (true) with check (true);
create policy "Service can manage stories" on experience_stories for all
  using (true) with check (true);
