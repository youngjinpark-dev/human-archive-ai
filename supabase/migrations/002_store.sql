-- ============================================================
-- 스토어 관련 테이블, RLS, 함수, 트리거
-- ============================================================

-- 스토어 등록 (페르소나를 마켓에 등록)
create table store_listings (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null unique references personas(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  subtitle text,
  description text not null,
  category text not null,
  tags text[] default '{}',
  thumbnail_url text,
  price_krw int default 0,
  is_free boolean default true,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'active', 'suspended', 'archived')),
  quality_score jsonb default '{}',
  view_count int default 0,
  trial_count int default 0,
  purchase_count int default 0,
  rating_avg numeric(3,2) default 0,
  rating_count int default 0,
  is_high_risk boolean default false,
  revenue_split_seller int default 80,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 체험 세션 (로그인/비로그인 사용자 체험 제한)
create table trial_sessions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references store_listings(id) on delete cascade,
  user_id uuid references profiles(id),
  ip_address inet,
  fingerprint text,
  messages_today int default 0,
  personas_today text[] default '{}',
  last_message_at timestamptz,
  trial_date date default current_date,
  created_at timestamptz default now()
);

create unique index trial_sessions_user_listing_date on trial_sessions (user_id, listing_id, trial_date)
  where user_id is not null;
create unique index trial_sessions_anon_listing_date on trial_sessions (ip_address, fingerprint, listing_id, trial_date)
  where user_id is null;

-- 구매
create table purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid not null references store_listings(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  amount_krw int not null,
  payment_method text,
  toss_payment_key text unique,
  toss_order_id text unique,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed', 'refunded', 'cancelled')),
  seller_amount int,
  platform_amount int,
  settled boolean default false,
  settled_at timestamptz,
  created_at timestamptz default now()
);

create unique index purchases_buyer_listing_confirmed on purchases (buyer_id, listing_id)
  where status = 'confirmed';

-- 초대 코드
create table invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid references profiles(id),
  used_by uuid references profiles(id),
  used_at timestamptz,
  expires_at timestamptz,
  active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- updated_at 트리거
-- ============================================================
create trigger store_listings_updated_at
  before update on store_listings
  for each row execute procedure update_updated_at();

-- ============================================================
-- RLS 정책
-- ============================================================
alter table store_listings enable row level security;
alter table trial_sessions enable row level security;
alter table purchases enable row level security;
alter table invite_codes enable row level security;

-- store_listings: 활성 목록은 모두 읽기, 소유자만 CRUD
create policy "Anyone can read active listings" on store_listings for select
  using (status = 'active');
create policy "Sellers can manage own listings" on store_listings for all
  using (auth.uid() = seller_id);

-- trial_sessions: 사용자 자기 세션만 읽기, 서비스 전체 관리
create policy "Users can read own trial sessions" on trial_sessions for select
  using (auth.uid() = user_id);
create policy "Service can manage trial sessions" on trial_sessions for all
  using (true) with check (true);

-- purchases: 구매자 자기 구매 읽기, 판매자 자기 판매 읽기, 서비스 전체 관리
create policy "Buyers can read own purchases" on purchases for select
  using (auth.uid() = buyer_id);
create policy "Sellers can read own sales" on purchases for select
  using (auth.uid() = seller_id);
create policy "Service can manage purchases" on purchases for all
  using (true) with check (true);

-- invite_codes: 서비스만 관리
create policy "Service can manage invite codes" on invite_codes for all
  using (true) with check (true);

-- ============================================================
-- 기존 테이블 RLS 확장: 구매자가 구매한 페르소나 데이터 접근
-- ============================================================

-- chunks: 구매 확인된 사용자도 읽기 가능
create policy "Buyers can read purchased persona chunks" on chunks for select
  using (
    persona_id in (
      select p.persona_id from purchases p
      where p.buyer_id = auth.uid() and p.status = 'confirmed'
    )
  );

-- chat_sessions: 구매자도 세션 생성/읽기
create policy "Buyers can manage purchased persona chat sessions" on chat_sessions for all
  using (
    user_id = auth.uid()
    and persona_id in (
      select p.persona_id from purchases p
      where p.buyer_id = auth.uid() and p.status = 'confirmed'
    )
  );

-- chat_messages: 구매자도 메시지 읽기/쓰기
create policy "Buyers can manage purchased persona chat messages" on chat_messages for all
  using (
    session_id in (
      select cs.id from chat_sessions cs
      join purchases p on cs.persona_id = p.persona_id
      where cs.user_id = auth.uid()
        and p.buyer_id = auth.uid()
        and p.status = 'confirmed'
    )
  );

-- personas: 구매자도 구매한 페르소나 읽기
create policy "Buyers can read purchased personas" on personas for select
  using (
    id in (
      select p.persona_id from purchases p
      where p.buyer_id = auth.uid() and p.status = 'confirmed'
    )
  );

-- ============================================================
-- 스토어 검색 함수
-- ============================================================
create or replace function search_store_listings(
  search_query text default null,
  filter_category text default null,
  sort_by text default 'newest',
  page_limit int default 20,
  page_offset int default 0
)
returns table (
  id uuid,
  persona_id uuid,
  seller_id uuid,
  title text,
  subtitle text,
  description text,
  category text,
  tags text[],
  thumbnail_url text,
  price_krw int,
  is_free boolean,
  status text,
  quality_score jsonb,
  view_count int,
  trial_count int,
  purchase_count int,
  rating_avg numeric(3,2),
  rating_count int,
  is_high_risk boolean,
  revenue_split_seller int,
  created_at timestamptz,
  updated_at timestamptz,
  seller_name text,
  persona_name text
)
language plpgsql security definer as $$
begin
  return query
    select
      sl.id, sl.persona_id, sl.seller_id,
      sl.title, sl.subtitle, sl.description,
      sl.category, sl.tags, sl.thumbnail_url,
      sl.price_krw, sl.is_free, sl.status,
      sl.quality_score, sl.view_count, sl.trial_count,
      sl.purchase_count, sl.rating_avg, sl.rating_count,
      sl.is_high_risk, sl.revenue_split_seller,
      sl.created_at, sl.updated_at,
      pr.display_name as seller_name,
      pe.name as persona_name
    from store_listings sl
    join profiles pr on sl.seller_id = pr.id
    join personas pe on sl.persona_id = pe.id
    where sl.status = 'active'
      and (search_query is null or (
        sl.title ilike '%' || search_query || '%'
        or sl.description ilike '%' || search_query || '%'
        or pe.name ilike '%' || search_query || '%'
      ))
      and (filter_category is null or sl.category = filter_category)
    order by
      case when sort_by = 'newest' then sl.created_at end desc,
      case when sort_by = 'popular' then sl.purchase_count end desc,
      case when sort_by = 'rating' then sl.rating_avg end desc
    limit page_limit
    offset page_offset;
end;
$$;

-- ============================================================
-- 품질 게이트 확인 함수
-- ============================================================
create or replace function check_quality_gate(target_persona_id uuid)
returns jsonb
language plpgsql security definer as $$
declare
  result jsonb;
  v_interview_complete boolean;
  v_chunks_count int;
  v_principles_count int;
  v_scenarios_count int;
  v_eligible boolean;
begin
  -- 인터뷰 완료 여부
  select exists(
    select 1 from interview_sessions
    where persona_id = target_persona_id and completed = true
  ) into v_interview_complete;

  -- 청크 수
  select count(*) into v_chunks_count
  from chunks where persona_id = target_persona_id;

  -- 원칙 수
  select coalesce(array_length(principles, 1), 0) into v_principles_count
  from personas where id = target_persona_id;

  -- 시나리오 수
  select coalesce(jsonb_array_length(decision_scenarios), 0) into v_scenarios_count
  from personas where id = target_persona_id;

  -- 적격 판단: 인터뷰 완료 + 청크 1개 이상
  v_eligible := v_interview_complete and v_chunks_count >= 1;

  result := jsonb_build_object(
    'interview_complete', v_interview_complete,
    'chunks_count', v_chunks_count,
    'principles_count', v_principles_count,
    'scenarios_count', v_scenarios_count,
    'eligible', v_eligible
  );

  return result;
end;
$$;
