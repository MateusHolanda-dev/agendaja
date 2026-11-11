-- agendaJá. Run with Supabase migrations or SQL editor as project owner.
-- All appointment instants are UTC; recurring hours use organization.timezone.
begin;
create extension if not exists btree_gist with schema extensions;
set local search_path=public,extensions,pg_catalog;

create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 100),
 slug text not null unique check(slug ~ '^[a-z][a-z0-9-]{2,60}$'),
 timezone text not null default 'America/Fortaleza', phone text not null default '', email text not null default '',
 address text not null default '', logo_url text, cancellation_hours int not null default 2 check(cancellation_hours between 0 and 168),
 slot_interval int not null default 30 check(slot_interval in (5,10,15,20,30,60)), active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '', email text not null default '', phone text not null default '', created_at timestamptz not null default now()
);
create table public.organization_members (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null check(role in ('owner','admin','professional','receptionist')),
 created_at timestamptz not null default now(), unique(tenant_id,user_id)
);
create table public.professionals (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete set null, name text not null check(length(name) between 2 and 100),
 title text not null default '', email text not null default '', color text not null default '#56826f' check(color ~ '^#[0-9A-Fa-f]{6}$'),
 active boolean not null default true, created_at timestamptz not null default now(), unique(tenant_id,id), unique(tenant_id,user_id)
);
create table public.services (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(length(name) between 2 and 100), description text not null default '', category text not null default 'Geral',
 price numeric(12,2) not null check(price>=0), duration int not null check(duration between 5 and 720),
 active boolean not null default true, created_at timestamptz not null default now(), unique(tenant_id,id)
);
create table public.professional_services (
 tenant_id uuid not null references public.organizations(id) on delete cascade,
 professional_id uuid not null, service_id uuid not null,
 primary key(tenant_id,professional_id,service_id),
 foreign key(tenant_id,professional_id) references public.professionals(tenant_id,id) on delete cascade,
 foreign key(tenant_id,service_id) references public.services(tenant_id,id) on delete cascade
);
create table public.business_hours (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations(id) on delete cascade,
 weekday int not null check(weekday between 0 and 6), starts_at time not null, ends_at time not null,
 check(starts_at<ends_at), unique(tenant_id,weekday,starts_at),
 exclude using gist(tenant_id with =, weekday with =, tsrange(date '2000-01-01'+starts_at,date '2000-01-01'+ends_at,'[)') with &&)
);
create table public.professional_availability (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations(id) on delete cascade,
 professional_id uuid not null, weekday int not null check(weekday between 0 and 6), starts_at time not null, ends_at time not null,
 foreign key(tenant_id,professional_id) references public.professionals(tenant_id,id) on delete cascade,
 check(starts_at<ends_at),
 exclude using gist(professional_id with =, weekday with =, tsrange(date '2000-01-01'+starts_at,date '2000-01-01'+ends_at,'[)') with &&)
);
create table public.time_off (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations(id) on delete cascade,
 professional_id uuid not null, starts_at timestamptz not null, ends_at timestamptz not null, reason text not null default '',
 foreign key(tenant_id,professional_id) references public.professionals(tenant_id,id) on delete cascade,
 check(starts_at<ends_at), unique(tenant_id,id)
);
create table public.customers (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete set null, name text not null check(length(name) between 2 and 100),
 email text not null default '', phone text not null default '', notes text not null default '',
 created_at timestamptz not null default now(), unique(tenant_id,id), unique(tenant_id,user_id)
);
create table public.appointments (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations(id) on delete cascade,
 customer_id uuid not null, professional_id uuid not null, service_id uuid not null,
 starts_at timestamptz not null, ends_at timestamptz not null,
 duration int not null check(duration between 5 and 720), price numeric(12,2) not null check(price>=0),
 status text not null default 'confirmed' check(status in ('pending','confirmed','completed','cancelled')),
 paid boolean not null default false, notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),
 foreign key(tenant_id,professional_id) references public.professionals(tenant_id,id),
 foreign key(tenant_id,service_id) references public.services(tenant_id,id),
 check(ends_at>starts_at), check(ends_at=starts_at+duration*interval '1 minute'), unique(tenant_id,id),
 constraint appointments_no_overlap exclude using gist(professional_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
 where(status in ('pending','confirmed','completed'))
);
create table public.appointment_events (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
 appointment_id uuid not null, actor_id uuid references public.profiles(id) on delete set null,
 action text not null, details jsonb not null default '{}', created_at timestamptz not null default now(),
 foreign key(tenant_id,appointment_id) references public.appointments(tenant_id,id) on delete cascade
);
create table public.booking_attempts (
 id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index members_user_idx on public.organization_members(user_id,tenant_id);
create index appointments_tenant_date_idx on public.appointments(tenant_id,starts_at);
create index appointments_customer_idx on public.appointments(tenant_id,customer_id,starts_at desc);
create index customers_user_idx on public.customers(user_id);
create index customers_name_idx on public.customers(tenant_id,lower(name));
create index events_appointment_idx on public.appointment_events(tenant_id,appointment_id,created_at);
create index time_off_professional_idx on public.time_off(professional_id,starts_at,ends_at);
create index booking_attempts_user_time_idx on public.booking_attempts(user_id,created_at);

-- Security-definer membership helpers do not recursively evaluate member RLS.
create function public.has_org_role(p_tenant uuid,p_roles text[] default array['owner','admin','professional','receptionist'])
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.organization_members where tenant_id=p_tenant and user_id=auth.uid() and role=any(p_roles));
$$;
create function public.owns_professional(p_tenant uuid,p_professional uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.professionals where tenant_id=p_tenant and id=p_professional and user_id=auth.uid())
 and public.has_org_role(p_tenant,array['professional']);
$$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.profiles(id,name,email) values(new.id,left(coalesce(new.raw_user_meta_data->>'name',''),100),coalesce(new.email,''));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id,name,email)
select id,left(coalesce(raw_user_meta_data->>'name',''),100),coalesce(email,'') from auth.users on conflict(id) do nothing;
create function public.validate_org_timezone() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Fuso horário inválido'; end if;
 return new;
end $$;
create trigger valid_org_timezone before insert or update on public.organizations for each row execute function public.validate_org_timezone();

-- Shared schedule check used both by public availability and the database write trigger.
create function public.slot_is_available(p_tenant uuid,p_professional uuid,p_service uuid,p_start timestamptz,p_exclude uuid default null,p_duration int default null)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_org public.organizations; v_service public.services; v_local timestamp; v_end timestamp; v_finish timestamptz; v_day int;
begin
 select * into v_org from public.organizations where id=p_tenant and active;
 if not found then return false; end if;
 select * into v_service from public.services where id=p_service and tenant_id=p_tenant and active;
 if not found or not exists(select 1 from public.professionals where id=p_professional and tenant_id=p_tenant and active)
 or not exists(select 1 from public.professional_services where tenant_id=p_tenant and professional_id=p_professional and service_id=p_service)
 then return false; end if;
 v_finish:=p_start+coalesce(p_duration,v_service.duration)*interval '1 minute';
 v_local:=p_start at time zone v_org.timezone; v_end:=v_finish at time zone v_org.timezone;
 v_day:=extract(dow from v_local);
 if v_local::date<>v_end::date or extract(second from v_local)<>0
 or (extract(hour from v_local)::int*60+extract(minute from v_local)::int)%v_org.slot_interval<>0 then return false; end if;
 if not exists(select 1 from public.business_hours where tenant_id=p_tenant and weekday=v_day and starts_at<=v_local::time and ends_at>=v_end::time) then return false; end if;
 -- No custom schedule means inherit business hours. Once any schedule exists, missing days are days off.
 if exists(select 1 from public.professional_availability where tenant_id=p_tenant and professional_id=p_professional)
 and not exists(select 1 from public.professional_availability where tenant_id=p_tenant and professional_id=p_professional and weekday=v_day and starts_at<=v_local::time and ends_at>=v_end::time) then return false; end if;
 if exists(select 1 from public.time_off where tenant_id=p_tenant and professional_id=p_professional and tstzrange(starts_at,ends_at,'[)')&&tstzrange(p_start,v_finish,'[)')) then return false; end if;
 if exists(select 1 from public.appointments where professional_id=p_professional and id is distinct from p_exclude and status<>'cancelled' and tstzrange(starts_at,ends_at,'[)')&&tstzrange(p_start,v_finish,'[)')) then return false; end if;
 return true;
end $$;
create function public.enforce_appointment() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_service public.services;
begin
 if tg_op='UPDATE' and (new.id<>old.id or new.tenant_id<>old.tenant_id or new.created_at<>old.created_at) then raise exception 'Identidade do agendamento não pode ser alterada'; end if;
 perform pg_advisory_xact_lock_shared(hashtextextended(new.tenant_id::text,3));
 perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text,0));
 if tg_op='INSERT' or new.service_id<>old.service_id then
  select * into strict v_service from public.services where id=new.service_id and tenant_id=new.tenant_id and active;
  new.duration:=v_service.duration; new.price:=v_service.price;
 elsif new.duration<>old.duration or new.price<>old.price then raise exception 'Preço e duração são preservados do serviço reservado';
 end if;
 new.ends_at:=new.starts_at+new.duration*interval '1 minute'; new.updated_at:=now();
 if new.status<>'cancelled' and (tg_op='INSERT' or new.starts_at<>old.starts_at or new.professional_id<>old.professional_id or new.service_id<>old.service_id or old.status='cancelled') then
  if new.starts_at<now() or new.starts_at>now()+interval '366 days' then raise exception 'Escolha uma data futura dentro de um ano'; end if;
  if not public.slot_is_available(new.tenant_id,new.professional_id,new.service_id,new.starts_at,new.id,new.duration) then raise exception 'Horário indisponível. Escolha outro horário.'; end if;
 end if;
 if tg_op='UPDATE' and old.status='completed' and new.status<>'completed' then raise exception 'Atendimento concluído não pode mudar de status'; end if;
 if new.status='completed' and new.starts_at>now() then raise exception 'Não é possível concluir atendimento futuro'; end if;
 return new;
end $$;
create trigger enforce_appointment before insert or update on public.appointments for each row execute function public.enforce_appointment();
create function public.enforce_time_off() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text,0));
 if exists(select 1 from public.appointments where professional_id=new.professional_id and status in ('pending','confirmed') and tstzrange(starts_at,ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Reagende os atendimentos deste período antes de criar o bloqueio'; end if;
 return new;
end $$;
create trigger enforce_time_off before insert or update on public.time_off for each row execute function public.enforce_time_off();
create function public.audit_appointment() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.appointment_events(tenant_id,appointment_id,actor_id,action,details)
 values(new.tenant_id,new.id,auth.uid(),case when tg_op='INSERT' then 'created' when new.status<>old.status then 'status_changed' when new.starts_at<>old.starts_at then 'rescheduled' else 'updated' end,
 jsonb_build_object('before',case when tg_op='UPDATE' then jsonb_build_object('status',old.status,'starts_at',old.starts_at,'professional_id',old.professional_id,'service_id',old.service_id,'customer_id',old.customer_id,'price',old.price,'duration',old.duration,'paid',old.paid) else null end,
 'after',jsonb_build_object('status',new.status,'starts_at',new.starts_at,'professional_id',new.professional_id,'service_id',new.service_id,'customer_id',new.customer_id,'price',new.price,'duration',new.duration,'paid',new.paid)));
 return new;
end $$;
create trigger audit_appointment after insert or update on public.appointments for each row execute function public.audit_appointment();

-- All tables default to deny. Clients never read internal notes or other customers.
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.professionals enable row level security;
alter table public.services enable row level security;
alter table public.professional_services enable row level security;
alter table public.business_hours enable row level security;
alter table public.professional_availability enable row level security;
alter table public.time_off enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_events enable row level security;
alter table public.booking_attempts enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid());
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy org_read on public.organizations for select to authenticated using(public.has_org_role(id));
create policy org_update on public.organizations for update to authenticated using(public.has_org_role(id,array['owner','admin'])) with check(public.has_org_role(id,array['owner','admin']));
create policy members_read on public.organization_members for select to authenticated using(user_id=auth.uid() or public.has_org_role(tenant_id,array['owner','admin']));
-- Membership writes go through owner-only set_team_member (verified account + atomic professional link).
-- The first owner membership is created by onboarding, never by a direct client write.
create policy professionals_read on public.professionals for select to authenticated using(public.has_org_role(tenant_id));
-- Professional writes go through save_professional; only set_team_member can change user_id.
create policy services_read on public.services for select to authenticated using(public.has_org_role(tenant_id));
create policy services_manage on public.services for all to authenticated using(public.has_org_role(tenant_id,array['owner','admin'])) with check(public.has_org_role(tenant_id,array['owner','admin']));
create policy professional_services_read on public.professional_services for select to authenticated using(public.has_org_role(tenant_id));
create policy professional_services_manage on public.professional_services for all to authenticated using(public.has_org_role(tenant_id,array['owner','admin'])) with check(public.has_org_role(tenant_id,array['owner','admin']));
create policy hours_read on public.business_hours for select to authenticated using(public.has_org_role(tenant_id));
create policy hours_manage on public.business_hours for all to authenticated using(public.has_org_role(tenant_id,array['owner','admin'])) with check(public.has_org_role(tenant_id,array['owner','admin']));
create policy availability_read on public.professional_availability for select to authenticated using(public.has_org_role(tenant_id));
create policy availability_manage on public.professional_availability for all to authenticated using(public.has_org_role(tenant_id,array['owner','admin'])) with check(public.has_org_role(tenant_id,array['owner','admin']));
create policy off_read on public.time_off for select to authenticated using(public.has_org_role(tenant_id,array['owner','admin','receptionist']) or public.owns_professional(tenant_id,professional_id));
create policy off_manage on public.time_off for all to authenticated using(public.has_org_role(tenant_id,array['owner','admin'])) with check(public.has_org_role(tenant_id,array['owner','admin']));
create policy customers_read on public.customers for select to authenticated using(public.has_org_role(tenant_id,array['owner','admin','receptionist']) or exists(select 1 from public.appointments a where a.customer_id=customers.id and public.owns_professional(a.tenant_id,a.professional_id)));
create policy customers_manage on public.customers for all to authenticated using(public.has_org_role(tenant_id,array['owner','admin','receptionist'])) with check(public.has_org_role(tenant_id,array['owner','admin','receptionist']));
create policy appointments_read on public.appointments for select to authenticated using(public.has_org_role(tenant_id,array['owner','admin','receptionist']) or public.owns_professional(tenant_id,professional_id));
create policy appointments_add on public.appointments for insert to authenticated with check(public.has_org_role(tenant_id,array['owner','admin','receptionist']));
create policy appointments_update on public.appointments for update to authenticated using(public.has_org_role(tenant_id,array['owner','admin','receptionist'])) with check(public.has_org_role(tenant_id,array['owner','admin','receptionist']));
create policy events_read on public.appointment_events for select to authenticated using(public.has_org_role(tenant_id,array['owner','admin']));

create function public.onboard_organization(p_name text,p_slug text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_uid uuid:=auth.uid();
begin
 if v_uid is null then raise exception 'Entre na sua conta para continuar'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,1));
 if exists(select 1 from public.organization_members where user_id=v_uid and role='owner') then raise exception 'Sua conta já possui um estabelecimento'; end if;
 insert into public.organizations(name,slug) values(trim(p_name),lower(trim(p_slug))) returning id into v_id;
 insert into public.organization_members(tenant_id,user_id,role) values(v_id,v_uid,'owner');
 insert into public.business_hours(tenant_id,weekday,starts_at,ends_at) select v_id,i,'09:00'::time,'18:00'::time from generate_series(1,6) i;
 return v_id;
end $$;
create function public.get_public_business(p_slug text) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('organization',jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'phone',o.phone,'address',o.address,'logo_url',o.logo_url,'timezone',o.timezone,'cancellation_hours',o.cancellation_hours,'slot_interval',o.slot_interval),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'category',s.category,'price',s.price,'duration',s.duration,'active',s.active) order by s.name) from public.services s where s.tenant_id=o.id and s.active),'[]'::jsonb),
 'professionals',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'title',p.title,'color',p.color,'active',p.active,'serviceIds',coalesce((select jsonb_agg(ps.service_id) from public.professional_services ps where ps.tenant_id=o.id and ps.professional_id=p.id),'[]'::jsonb)) order by p.name) from public.professionals p where p.tenant_id=o.id and p.active),'[]'::jsonb))
 from public.organizations o where o.slug=p_slug and o.active;
$$;
create function public.get_public_availability(p_slug text,p_service_id uuid,p_professional_id uuid,p_date date)
returns table(starts_at timestamptz,ends_at timestamptz) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_org public.organizations; v_duration int;
begin
 select * into v_org from public.organizations where slug=p_slug and active;
 if not found or p_date<(now() at time zone v_org.timezone)::date or p_date>(now() at time zone v_org.timezone)::date+365 then return; end if;
 select duration into v_duration from public.services where id=p_service_id and tenant_id=v_org.id and active;
 if v_duration is null then return; end if;
 return query select candidate,candidate+v_duration*interval '1 minute'
 from generate_series(p_date::timestamp at time zone v_org.timezone,(p_date+1)::timestamp at time zone v_org.timezone-interval '1 minute',v_org.slot_interval*interval '1 minute') candidate
 where candidate>now() and public.slot_is_available(v_org.id,p_professional_id,p_service_id,candidate);
end $$;
create function public.book_public_appointment(p_slug text,p_service_id uuid,p_professional_id uuid,p_starts_at timestamptz,p_customer_name text,p_customer_email text,p_customer_phone text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_org public.organizations; v_customer uuid; v_appointment public.appointments; v_service public.services; v_uid uuid:=auth.uid(); v_email text;
begin
 if v_uid is null then raise exception 'Entre na sua conta para confirmar o agendamento'; end if;
 select email into v_email from auth.users where id=v_uid and email_confirmed_at is not null;
 if v_email is null then raise exception 'Confirme seu e-mail antes de agendar'; end if;
 if lower(trim(p_customer_email))<>lower(v_email) then raise exception 'Use o e-mail da sua conta'; end if;
 if length(trim(p_customer_name)) not between 2 and 100 or length(p_customer_phone) not between 8 and 25 then raise exception 'Confira seu nome e telefone'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,2));
 if (select count(*) from public.booking_attempts where user_id=v_uid and created_at>now()-interval '1 hour')>=10 then raise exception 'Limite de agendamentos atingido. Tente mais tarde.'; end if;
 select * into strict v_org from public.organizations where slug=p_slug and active;
 select * into strict v_service from public.services where id=p_service_id and tenant_id=v_org.id and active;
 insert into public.booking_attempts(user_id) values(v_uid);
 insert into public.customers(tenant_id,user_id,name,email,phone) values(v_org.id,v_uid,trim(p_customer_name),lower(v_email),trim(p_customer_phone))
 on conflict(tenant_id,user_id) do update set name=excluded.name,email=excluded.email,phone=excluded.phone returning id into v_customer;
 insert into public.appointments(tenant_id,customer_id,professional_id,service_id,starts_at,ends_at,duration,price)
 values(v_org.id,v_customer,p_professional_id,p_service_id,p_starts_at,p_starts_at+v_service.duration*interval '1 minute',v_service.duration,v_service.price)
 returning * into v_appointment;
 return jsonb_build_object('id',v_appointment.id,'status',v_appointment.status,'starts_at',v_appointment.starts_at,'ends_at',v_appointment.ends_at);
exception when exclusion_violation then raise exception 'Este horário acabou de ser reservado. Escolha outro horário.';
end $$;
create function public.get_my_appointments() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'tenant_id',a.tenant_id,'customer_id',a.customer_id,'professional_id',a.professional_id,'service_id',a.service_id,'starts_at',a.starts_at,'ends_at',a.ends_at,'duration',a.duration,'price',a.price,'status',a.status,'paid',a.paid,'created_at',a.created_at,'business_name',o.name,'business_slug',o.slug,'timezone',o.timezone,'service_name',s.name,'professional_name',p.name,'cancellation_hours',o.cancellation_hours) order by a.starts_at desc),'[]'::jsonb)
 from public.appointments a join public.customers c on c.tenant_id=a.tenant_id and c.id=a.customer_id join public.organizations o on o.id=a.tenant_id join public.services s on s.tenant_id=a.tenant_id and s.id=a.service_id join public.professionals p on p.tenant_id=a.tenant_id and p.id=a.professional_id where c.user_id=auth.uid();
$$;
create function public.cancel_my_appointment(p_appointment_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_appointment public.appointments; v_hours int;
begin
 select a.* into v_appointment from public.appointments a join public.customers c on c.id=a.customer_id and c.tenant_id=a.tenant_id where a.id=p_appointment_id and c.user_id=auth.uid() for update of a;
 if not found then raise exception 'Agendamento não encontrado'; end if;
 select cancellation_hours into v_hours from public.organizations where id=v_appointment.tenant_id;
 if v_appointment.status not in ('pending','confirmed') or v_appointment.starts_at<now()+v_hours*interval '1 hour' then raise exception 'Cancelamento fora do prazo. Entre em contato com o estabelecimento.'; end if;
 update public.appointments set status='cancelled' where id=p_appointment_id;
end $$;
create function public.reschedule_my_appointment(p_appointment_id uuid,p_starts_at timestamptz) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_appointment public.appointments; v_hours int;
begin
 select a.* into v_appointment from public.appointments a join public.customers c on c.id=a.customer_id and c.tenant_id=a.tenant_id where a.id=p_appointment_id and c.user_id=auth.uid() for update of a;
 if not found then raise exception 'Agendamento não encontrado'; end if;
 select cancellation_hours into v_hours from public.organizations where id=v_appointment.tenant_id;
 if v_appointment.status not in ('pending','confirmed') or v_appointment.starts_at<now()+v_hours*interval '1 hour' then raise exception 'Reagendamento fora do prazo. Entre em contato com o estabelecimento.'; end if;
 -- Reschedule keeps service, professional, price, and duration. Availability and overlap are checked by trigger.
 update public.appointments set starts_at=p_starts_at,status='confirmed' where id=p_appointment_id returning * into v_appointment;
 return jsonb_build_object('id',v_appointment.id,'status',v_appointment.status,'starts_at',v_appointment.starts_at,'ends_at',v_appointment.ends_at);
exception when exclusion_violation then raise exception 'Este horário acabou de ser reservado. Escolha outro horário.';
end $$;
create function public.set_appointment_status(p_appointment_id uuid,p_status text,p_paid boolean default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_appointment public.appointments;
begin
 select * into v_appointment from public.appointments where id=p_appointment_id for update;
 if not found then raise exception 'Agendamento não encontrado'; end if;
 if not public.has_org_role(v_appointment.tenant_id,array['owner','admin','receptionist']) and not public.owns_professional(v_appointment.tenant_id,v_appointment.professional_id) then raise exception 'Sem permissão para alterar este atendimento'; end if;
 if p_status not in ('pending','confirmed','completed','cancelled') then raise exception 'Status inválido'; end if;
 if p_paid is not null and not public.has_org_role(v_appointment.tenant_id,array['owner','admin','receptionist']) then raise exception 'Sem permissão para registrar recebimentos'; end if;
 update public.appointments set status=p_status,paid=coalesce(p_paid,paid) where id=p_appointment_id;
end $$;
create function public.save_business_settings(p_tenant_id uuid,p_settings jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_open time; v_close time; v_day int;
begin
 if not public.has_org_role(p_tenant_id,array['owner','admin']) then raise exception 'Sem permissão para alterar o estabelecimento'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,3));
 perform 1 from public.organizations where id=p_tenant_id for update;
 v_open:=(p_settings->>'opening')::time; v_close:=(p_settings->>'closing')::time;
 if v_open is null or v_close is null or v_open>=v_close then raise exception 'Horário de funcionamento inválido'; end if;
 if jsonb_typeof(p_settings->'weekdays') is distinct from 'array' then raise exception 'Informe os dias de funcionamento'; end if;
 if p_settings ? 'logo_url' and nullif(p_settings->>'logo_url','') is not null and (length(p_settings->>'logo_url')>2048 or (p_settings->>'logo_url')!~'^https://') then raise exception 'Informe uma URL HTTPS válida para o logotipo'; end if;
 update public.organizations set name=trim(p_settings->>'name'),slug=lower(trim(p_settings->>'slug')),
 phone=coalesce(p_settings->>'phone',''),email=coalesce(p_settings->>'email',''),address=coalesce(p_settings->>'address',''),
 timezone=coalesce(p_settings->>'timezone',timezone),cancellation_hours=(p_settings->>'cancellation_hours')::int,slot_interval=(p_settings->>'slot_interval')::int,
 logo_url=case when p_settings ? 'logo_url' then nullif(p_settings->>'logo_url','') else logo_url end where id=p_tenant_id;
 delete from public.business_hours where tenant_id=p_tenant_id;
 for v_day in select distinct value::int from jsonb_array_elements_text(p_settings->'weekdays') loop
  insert into public.business_hours(tenant_id,weekday,starts_at,ends_at) values(p_tenant_id,v_day,v_open,v_close);
 end loop;
 if exists(select 1 from public.appointments a join public.organizations o on o.id=a.tenant_id where a.tenant_id=p_tenant_id and a.status in ('pending','confirmed') and a.starts_at>now()
  and not exists(select 1 from public.business_hours h where h.tenant_id=p_tenant_id and h.weekday=extract(dow from a.starts_at at time zone o.timezone)
   and h.starts_at<=(a.starts_at at time zone o.timezone)::time and h.ends_at>=(a.ends_at at time zone o.timezone)::time
   and (a.starts_at at time zone o.timezone)::date=(a.ends_at at time zone o.timezone)::date)) then
  raise exception 'Há atendimentos fora dos novos horários. Reagende-os antes de salvar.';
 end if;
end $$;
create function public.save_professional(p_tenant_id uuid,p_professional jsonb,p_service_ids uuid[]) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid:=coalesce(nullif(p_professional->>'id','')::uuid,gen_random_uuid()); v_service uuid; v_slot jsonb;
begin
 if not public.has_org_role(p_tenant_id,array['owner','admin']) then raise exception 'Sem permissão para gerenciar profissionais'; end if;
 perform pg_advisory_xact_lock_shared(hashtextextended(p_tenant_id::text,3));
 perform pg_advisory_xact_lock(hashtextextended(v_id::text,0));
 if exists(select 1 from public.professionals where id=v_id and tenant_id<>p_tenant_id) then raise exception 'Profissional não pertence a este estabelecimento'; end if;
 insert into public.professionals(id,tenant_id,name,title,email,color,active)
 values(v_id,p_tenant_id,trim(p_professional->>'name'),coalesce(p_professional->>'title',''),coalesce(p_professional->>'email',''),coalesce(p_professional->>'color','#56826f'),coalesce((p_professional->>'active')::boolean,true))
 on conflict(id) do update set name=excluded.name,title=excluded.title,email=excluded.email,color=excluded.color,active=excluded.active where professionals.tenant_id=p_tenant_id;
 if not found then raise exception 'Profissional não pertence a este estabelecimento'; end if;
 delete from public.professional_services where tenant_id=p_tenant_id and professional_id=v_id;
 for v_service in select distinct unnest(coalesce(p_service_ids,array[]::uuid[])) loop
  insert into public.professional_services(tenant_id,professional_id,service_id) values(p_tenant_id,v_id,v_service);
 end loop;
 if p_professional ? 'availability' then
  if jsonb_typeof(p_professional->'availability') is distinct from 'array' then raise exception 'Disponibilidade inválida'; end if;
  delete from public.professional_availability where tenant_id=p_tenant_id and professional_id=v_id;
  for v_slot in select value from jsonb_array_elements(p_professional->'availability') loop
   insert into public.professional_availability(tenant_id,professional_id,weekday,starts_at,ends_at)
   values(p_tenant_id,v_id,(v_slot->>'weekday')::int,(v_slot->>'start')::time,(v_slot->>'end')::time);
  end loop;
  if exists(select 1 from public.professional_availability where tenant_id=p_tenant_id and professional_id=v_id)
  and exists(select 1 from public.appointments a join public.organizations o on o.id=a.tenant_id
   where a.tenant_id=p_tenant_id and a.professional_id=v_id and a.status in ('pending','confirmed') and a.starts_at>now()
   and not exists(select 1 from public.professional_availability pa where pa.tenant_id=p_tenant_id and pa.professional_id=v_id
    and pa.weekday=extract(dow from a.starts_at at time zone o.timezone)
    and pa.starts_at<=(a.starts_at at time zone o.timezone)::time and pa.ends_at>=(a.ends_at at time zone o.timezone)::time
    and (a.starts_at at time zone o.timezone)::date=(a.ends_at at time zone o.timezone)::date)) then
   raise exception 'Há atendimentos fora da nova disponibilidade. Reagende-os antes de salvar.';
  end if;
 end if;
 return v_id;
end $$;
create function public.list_team_members(p_tenant_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.has_org_role(p_tenant_id,array['owner','admin']) then raise exception 'Sem permissão para consultar a equipe'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'name',p.name,'email',p.email,'role',m.role,'professional_id',pr.id) order by p.name,p.email),'[]'::jsonb)
 from public.organization_members m join public.profiles p on p.id=m.user_id
 left join public.professionals pr on pr.tenant_id=m.tenant_id and pr.user_id=m.user_id where m.tenant_id=p_tenant_id);
end $$;
create function public.set_team_member(p_tenant_id uuid,p_email text,p_role text,p_professional_id uuid default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid; v_link uuid;
begin
 if not public.has_org_role(p_tenant_id,array['owner']) then raise exception 'Somente o proprietário pode gerenciar acessos da equipe'; end if;
 if p_role is null or p_role not in ('admin','professional','receptionist') then raise exception 'Papel inválido para a equipe'; end if;
 perform 1 from public.organizations where id=p_tenant_id for update;
 select u.id into v_uid from auth.users u join public.profiles p on p.id=u.id and lower(p.email)=lower(u.email)
 where lower(u.email)=lower(trim(p_email)) and u.email_confirmed_at is not null;
 if v_uid is null then raise exception 'A pessoa precisa criar uma conta e confirmar o e-mail antes de receber acesso'; end if;
 if v_uid=auth.uid() or exists(select 1 from public.organization_members where tenant_id=p_tenant_id and user_id=v_uid and role='owner') then raise exception 'O acesso do proprietário não pode ser alterado por esta operação'; end if;
 if p_role='professional' then
  if p_professional_id is null then raise exception 'Selecione o profissional que usará esta conta'; end if;
  select user_id into v_link from public.professionals where tenant_id=p_tenant_id and id=p_professional_id and active for update;
  if not found then raise exception 'Profissional não encontrado neste estabelecimento'; end if;
  if v_link is not null and v_link<>v_uid then raise exception 'Este profissional já está vinculado a outra conta'; end if;
 elsif p_professional_id is not null then raise exception 'Selecione um profissional apenas para o papel profissional';
 end if;
 insert into public.organization_members(tenant_id,user_id,role) values(p_tenant_id,v_uid,p_role)
 on conflict(tenant_id,user_id) do update set role=excluded.role where organization_members.role<>'owner';
 if not found then raise exception 'O acesso do proprietário não pode ser alterado por esta operação'; end if;
 update public.professionals set user_id=null where tenant_id=p_tenant_id and user_id=v_uid and (p_role<>'professional' or id<>p_professional_id);
 if p_role='professional' then update public.professionals set user_id=v_uid where tenant_id=p_tenant_id and id=p_professional_id; end if;
 return v_uid;
end $$;

-- Explicit grants; public cannot invoke implementation helpers or write tables.
revoke all on public.organizations,public.profiles,public.organization_members,public.professionals,public.services,public.professional_services,public.business_hours,public.professional_availability,public.time_off,public.customers,public.appointments,public.appointment_events,public.booking_attempts from anon;
grant select,insert,update,delete on public.organizations,public.profiles,public.organization_members,public.professionals,public.services,public.professional_services,public.business_hours,public.professional_availability,public.time_off,public.customers,public.appointments,public.appointment_events to authenticated;
revoke all on function public.has_org_role(uuid,text[]),public.owns_professional(uuid,uuid),public.handle_new_user(),public.validate_org_timezone(),public.slot_is_available(uuid,uuid,uuid,timestamptz,uuid,int),public.enforce_appointment(),public.enforce_time_off(),public.audit_appointment(),public.onboard_organization(text,text),public.get_public_business(text),public.get_public_availability(text,uuid,uuid,date),public.book_public_appointment(text,uuid,uuid,timestamptz,text,text,text),public.get_my_appointments(),public.cancel_my_appointment(uuid),public.reschedule_my_appointment(uuid,timestamptz),public.set_appointment_status(uuid,text,boolean),public.save_business_settings(uuid,jsonb),public.save_professional(uuid,jsonb,uuid[]),public.list_team_members(uuid),public.set_team_member(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.has_org_role(uuid,text[]),public.owns_professional(uuid,uuid) to authenticated;
grant execute on function public.get_public_business(text),public.get_public_availability(text,uuid,uuid,date) to anon,authenticated;
grant execute on function public.onboard_organization(text,text),public.book_public_appointment(text,uuid,uuid,timestamptz,text,text,text),public.get_my_appointments(),public.cancel_my_appointment(uuid),public.reschedule_my_appointment(uuid,timestamptz),public.set_appointment_status(uuid,text,boolean),public.save_business_settings(uuid,jsonb),public.save_professional(uuid,jsonb,uuid[]),public.list_team_members(uuid),public.set_team_member(uuid,text,text,uuid) to authenticated;

-- Logos are public by design. Never use this bucket for client records.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('business-logos','business-logos',true,2097152,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy logos_read on storage.objects for select to public using(bucket_id='business-logos');
create policy logos_insert on storage.objects for insert to authenticated with check(bucket_id='business-logos' and exists(select 1 from public.organizations o where o.id::text=(storage.foldername(name))[1] and public.has_org_role(o.id,array['owner','admin'])));
create policy logos_update on storage.objects for update to authenticated using(bucket_id='business-logos' and exists(select 1 from public.organizations o where o.id::text=(storage.foldername(name))[1] and public.has_org_role(o.id,array['owner','admin']))) with check(bucket_id='business-logos' and exists(select 1 from public.organizations o where o.id::text=(storage.foldername(name))[1] and public.has_org_role(o.id,array['owner','admin'])));
create policy logos_delete on storage.objects for delete to authenticated using(bucket_id='business-logos' and exists(select 1 from public.organizations o where o.id::text=(storage.foldername(name))[1] and public.has_org_role(o.id,array['owner','admin'])));
commit;
