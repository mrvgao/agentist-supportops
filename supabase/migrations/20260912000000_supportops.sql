-- Personal workspaces: owner_id = authenticated user. Team membership is an extension.
create table public.tickets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users,
 body text not null check(length(body) between 1 and 4000), created_at timestamptz not null default now()
);
create table public.jobs (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null unique references public.tickets,
 owner_id uuid not null references auth.users, status text not null default 'queued'
 check(status in ('queued','running','completed','failed','blocked')),
 attempts integer not null default 0, lease_token uuid, lease_until timestamptz,
 available_at timestamptz not null default now(), last_error text
);
create table public.replies (
 ticket_id uuid primary key references public.tickets, owner_id uuid not null references auth.users,
 status text not null check(status in ('draft','human_review')), text text not null,
 citations jsonb not null default '[]', created_at timestamptz not null default now()
);
create table public.subscriptions (
 owner_id uuid primary key references auth.users, status text not null,
 cancelled_at timestamptz, last_invoice_at timestamptz
);
create table public.budgets (
 owner_id uuid not null references auth.users, day date not null default current_date,
 token_limit integer not null default 100000, used_tokens integer not null default 0,
 reserved_tokens integer not null default 0, primary key(owner_id,day),
 check(token_limit >= 0 and used_tokens >= 0 and reserved_tokens >= 0)
);
create table public.usage_ledger (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.jobs,
 owner_id uuid not null references auth.users, day date not null default current_date,
 reserved integer not null, tokens integer, cost_usd numeric,
 state text not null default 'reserved' check(state in ('reserved','measured','unknown')),
 created_at timestamptz not null default now()
);
alter table public.tickets enable row level security;
alter table public.jobs enable row level security;
alter table public.replies enable row level security;
alter table public.subscriptions enable row level security;
alter table public.budgets enable row level security;
alter table public.usage_ledger enable row level security;
create policy own_tickets on public.tickets for select to authenticated using(owner_id = (select auth.uid()));
create policy own_jobs on public.jobs for select to authenticated using(owner_id = (select auth.uid()));
create policy own_replies on public.replies for select to authenticated using(owner_id = (select auth.uid()));
create policy own_subscription on public.subscriptions for select to authenticated using(owner_id = (select auth.uid()));
create policy own_budget on public.budgets for select to authenticated using(owner_id = (select auth.uid()));
create policy own_usage on public.usage_ledger for select to authenticated using(owner_id = (select auth.uid()));
revoke all on public.tickets,public.jobs,public.replies,public.subscriptions,public.budgets,public.usage_ledger from anon,authenticated;
grant select on public.tickets,public.jobs,public.replies,public.subscriptions,public.budgets,public.usage_ledger to authenticated;
grant all on public.tickets,public.jobs,public.replies,public.subscriptions,public.budgets,public.usage_ledger to service_role;

-- Narrow atomic boundary: user cannot select another owner or insert arbitrary job state.
create function public.submit_ticket(p_body text) returns uuid language plpgsql security definer set search_path = '' as $$
declare tid uuid; uid uuid := auth.uid();
begin
 if uid is null then raise exception 'unauthorized'; end if;
 insert into public.tickets(owner_id,body) values(uid,p_body) returning id into tid;
 insert into public.jobs(ticket_id,owner_id) values(tid,uid);
 return tid;
end $$;
revoke all on function public.submit_ticket(text) from public,anon;
grant execute on function public.submit_ticket(text) to authenticated;

-- Service-only functions use invoker rights. SKIP LOCKED claims atomically;
-- fencing token prevents a stale worker from completing a reclaimed job.
create function public.claim_job() returns setof public.jobs language plpgsql set search_path = '' as $$
begin
 update public.jobs set status='failed',last_error='lease_attempts_exhausted'
 where status='running' and lease_until < now() and attempts >= 3;
 return query
 with candidate as (
  select id from public.jobs where attempts < 3 and available_at <= now()
   and (status='queued' or (status='running' and lease_until < now()))
  order by available_at for update skip locked limit 1
 ) update public.jobs j set status='running',attempts=j.attempts+1,
 lease_token=gen_random_uuid(),lease_until=now()+interval '60 seconds'
 from candidate c where j.id=c.id returning j.*;
end $$;
create function public.renew_lease(p_job uuid,p_lease uuid) returns void language plpgsql set search_path = '' as $$
begin
 update public.jobs set lease_until=now()+interval '60 seconds'
 where id=p_job and lease_token=p_lease and status='running' and lease_until>now();
 if not found then raise exception 'stale_lease'; end if;
end $$;
create function public.complete_job(p_job uuid,p_lease uuid,p_result jsonb) returns void language plpgsql set search_path = '' as $$
declare j public.jobs;
begin
 select * into j from public.jobs where id=p_job for update;
 if j.id is null or j.lease_token is distinct from p_lease then raise exception 'stale_lease'; end if;
 if j.status='completed' then return; end if;
 if j.status<>'running' or j.lease_until<now() then raise exception 'stale_lease'; end if;
 insert into public.replies(ticket_id,owner_id,status,text,citations)
 values(j.ticket_id,j.owner_id,p_result->>'status',p_result->>'text',coalesce(p_result->'citations','[]'))
 on conflict(ticket_id) do nothing;
 update public.jobs set status='completed',lease_until=null where id=j.id;
end $$;
create function public.fail_job(p_job uuid,p_lease uuid,p_reason text) returns void language plpgsql set search_path = '' as $$
begin
 update public.jobs set status=case when p_reason='budget_exhausted' then 'blocked' when attempts>=3 then 'failed' else 'queued' end,
 last_error=p_reason,available_at=now()+interval '5 seconds',lease_until=null
 where id=p_job and lease_token=p_lease and status='running';
end $$;
create function public.reserve_usage(p_job uuid,p_lease uuid,p_tokens integer) returns uuid language plpgsql set search_path = '' as $$
declare uid uuid; rid uuid;
begin
 if p_tokens<=0 or p_tokens>100000 then raise exception 'invalid_reservation'; end if;
 select owner_id into uid from public.jobs where id=p_job and lease_token=p_lease and status='running' and lease_until>now();
 if uid is null then raise exception 'stale_lease'; end if;
 insert into public.budgets(owner_id) values(uid) on conflict do nothing;
 update public.budgets set reserved_tokens=reserved_tokens+p_tokens
 where owner_id=uid and day=current_date and used_tokens+reserved_tokens+p_tokens<=token_limit;
 if not found then return null; end if;
 insert into public.usage_ledger(job_id,owner_id,reserved) values(p_job,uid,p_tokens) returning id into rid;
 return rid;
end $$;
create function public.settle_usage(p_id uuid,p_tokens integer,p_cost numeric,p_state text) returns void language plpgsql set search_path = '' as $$
declare u public.usage_ledger;
begin
 if p_tokens<0 or p_cost<0 or p_state not in ('measured','unknown') then raise exception 'invalid_settlement'; end if;
 select * into u from public.usage_ledger where id=p_id for update;
 if u.id is null then raise exception 'reservation_missing'; end if;
 if u.state<>'reserved' then return; end if;
 update public.budgets set reserved_tokens=reserved_tokens-u.reserved,used_tokens=used_tokens+p_tokens
 where owner_id=u.owner_id and day=u.day;
 update public.usage_ledger set tokens=p_tokens,cost_usd=case when p_state='unknown' then null else p_cost end,state=p_state where id=p_id;
end $$;
revoke all on function public.claim_job(),public.renew_lease(uuid,uuid),public.complete_job(uuid,uuid,jsonb),public.fail_job(uuid,uuid,text),public.reserve_usage(uuid,uuid,integer),public.settle_usage(uuid,integer,numeric,text) from public,anon,authenticated;
grant execute on function public.claim_job(),public.renew_lease(uuid,uuid),public.complete_job(uuid,uuid,jsonb),public.fail_job(uuid,uuid,text),public.reserve_usage(uuid,uuid,integer),public.settle_usage(uuid,integer,numeric,text) to service_role;
