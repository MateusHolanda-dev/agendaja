-- Administração da plataforma: autorização independente dos papéis de cada empresa.
begin;
create schema if not exists agendaja_private;
revoke all on schema agendaja_private from public,anon,authenticated;
create table agendaja_private.platform_owner (
 singleton boolean primary key default true check(singleton),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table agendaja_private.platform_audit (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null,
 entity text not null, record_id uuid not null, fields text[] not null,
 created_at timestamptz not null default now()
);
alter table agendaja_private.platform_owner enable row level security;
alter table agendaja_private.platform_audit enable row level security;
revoke all on all tables in schema agendaja_private from public,anon,authenticated;

create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from agendaja_private.platform_owner a join auth.users u on u.id=a.user_id
 where a.user_id=auth.uid() and u.email_confirmed_at is not null);
$$;

create function public.platform_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_platform_admin() then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 return jsonb_build_object(
  'organizations',(select count(*) from public.organizations),
  'active_organizations',(select count(*) from public.organizations where active),
  'users',(select count(*) from public.profiles),
  'customers',(select count(*) from public.customers),
  'professionals',(select count(*) from public.professionals),
  'appointments',(select count(*) from public.appointments),
  'pending',(select count(*) from public.appointments where status='pending'),
  'completed',(select count(*) from public.appointments where status='completed'),
  'received',(select coalesce(sum(price),0) from public.appointments where paid and status<>'cancelled')
 );
end $$;

create function public.platform_list(p_entity text,p_tenant_id uuid default null,p_query text default '',p_offset int default 0,p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_source text; v_where text; v_rows jsonb; v_total bigint;
begin
 if not public.is_platform_admin() then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if p_limit is null or p_offset is null or p_query is null or p_limit not between 1 and 100 or p_offset not between 0 and 1000000 or length(p_query)>100 then raise exception 'Consulta inválida'; end if;
 -- Every SQL fragment below is a fixed server-side allowlist; inputs remain bound parameters.
 case p_entity
 when 'organizations' then v_source:='select o.*,o.id as scope_tenant_id from public.organizations o';
 when 'users' then v_source:='select p.id,p.name,u.email,p.phone,p.created_at,u.email_confirmed_at as confirmed_at from public.profiles p join auth.users u on u.id=p.id';
 when 'members' then v_source:='select m.*,p.name,p.email,o.name as business_name,m.tenant_id as scope_tenant_id from public.organization_members m join public.profiles p on p.id=m.user_id join public.organizations o on o.id=m.tenant_id';
 when 'professionals' then v_source:='select p.*,o.name as business_name,p.tenant_id as scope_tenant_id from public.professionals p join public.organizations o on o.id=p.tenant_id';
 when 'services' then v_source:='select s.*,o.name as business_name,s.tenant_id as scope_tenant_id from public.services s join public.organizations o on o.id=s.tenant_id';
 when 'customers' then v_source:='select c.*,o.name as business_name,c.tenant_id as scope_tenant_id from public.customers c join public.organizations o on o.id=c.tenant_id';
 when 'appointments' then v_source:='select a.*,c.name as customer_name,p.name as professional_name,s.name as service_name,o.name as business_name,o.timezone,a.tenant_id as scope_tenant_id from public.appointments a join public.customers c on c.id=a.customer_id join public.professionals p on p.id=a.professional_id join public.services s on s.id=a.service_id join public.organizations o on o.id=a.tenant_id';
 when 'events' then v_source:='select e.*,o.name as business_name,e.tenant_id as scope_tenant_id from public.appointment_events e join public.organizations o on o.id=e.tenant_id';
 when 'hours' then v_source:='select h.*,o.name as business_name,h.tenant_id as scope_tenant_id from public.business_hours h join public.organizations o on o.id=h.tenant_id';
 when 'availability' then v_source:='select a.*,p.name as professional_name,a.tenant_id as scope_tenant_id from public.professional_availability a join public.professionals p on p.id=a.professional_id';
 when 'time_off' then v_source:='select t.*,p.name as professional_name,t.tenant_id as scope_tenant_id from public.time_off t join public.professionals p on p.id=t.professional_id';
 when 'assignments' then v_source:='select ps.*,p.name as professional_name,s.name as service_name,ps.tenant_id as scope_tenant_id from public.professional_services ps join public.professionals p on p.id=ps.professional_id join public.services s on s.id=ps.service_id';
 when 'audit' then v_source:='select a.*,p.name as actor_name from agendaja_private.platform_audit a left join public.profiles p on p.id=a.actor_id';
 else raise exception 'Área inválida';
 end case;
 v_where:=' where ($1::uuid is null or (to_jsonb(r)->>''scope_tenant_id'')::uuid=$1 or (to_jsonb(r)->>''id'')::uuid in (select user_id from public.organization_members where tenant_id=$1)) and ($2='''' or to_jsonb(r)::text ilike ''%''||$2||''%'')';
 execute 'select count(*) from ('||v_source||') r'||v_where into v_total using p_tenant_id,p_query;
 execute 'select coalesce(jsonb_agg(entry),''[]''::jsonb) from (select to_jsonb(r)-''scope_tenant_id'' as entry from ('||v_source||') r'||v_where||' order by coalesce(to_jsonb(r)->>''created_at'',to_jsonb(r)->>''starts_at'','''') desc,to_jsonb(r)::text limit $3 offset $4) page'
 into v_rows using p_tenant_id,p_query,p_limit,p_offset;
 return jsonb_build_object('rows',v_rows,'total',v_total);
end $$;

create function public.platform_update(p_entity text,p_id uuid,p_patch jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_table text; v_fields text[]; v_key text; v_sets text; v_count int;
begin
 if not public.is_platform_admin() then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if p_id is null or p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb or octet_length(p_patch::text)>12000 then raise exception 'Alteração inválida'; end if;
 case p_entity
 when 'organizations' then v_table:='organizations';v_fields:=array['name','slug','industry','phone','email','address','active','cancellation_hours','slot_interval'];
 when 'users' then v_table:='profiles';v_fields:=array['name','phone'];
 when 'professionals' then v_table:='professionals';v_fields:=array['name','title','email','color','active'];
 when 'services' then v_table:='services';v_fields:=array['name','description','category','price','duration','active'];
 when 'customers' then v_table:='customers';v_fields:=array['name','email','phone','notes'];
 when 'appointments' then v_table:='appointments';v_fields:=array['status','paid','notes','starts_at'];
 else raise exception 'Esta área é somente leitura';
 end case;
 for v_key in select jsonb_object_keys(p_patch) loop
  if not v_key=any(v_fields) then raise exception 'Campo não permitido: %',v_key; end if;
  v_sets:=concat_ws(',',v_sets,format('%I=x.%I',v_key,v_key));
 end loop;
 execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) x where t.id=$2',v_table,v_sets,v_table) using p_patch,p_id;
 get diagnostics v_count=row_count;
 if v_count<>1 then raise exception 'Registro não encontrado'; end if;
 insert into agendaja_private.platform_audit(actor_id,entity,record_id,fields)
 values(auth.uid(),p_entity,p_id,array(select jsonb_object_keys(p_patch)));
end $$;

-- Suspending a business also removes its team's API access. Existing customer history remains available to its owner.
create or replace function public.has_org_role(p_tenant uuid,p_roles text[] default array['owner','admin','professional','receptionist'])
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members m join public.organizations o on o.id=m.tenant_id
 where m.tenant_id=p_tenant and m.user_id=auth.uid() and m.role=any(p_roles) and o.active);
$$;
revoke all on function public.is_platform_admin(),public.platform_overview(),public.platform_list(text,uuid,text,int,int),public.platform_update(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.is_platform_admin(),public.platform_overview(),public.platform_list(text,uuid,text,int,int),public.platform_update(text,uuid,jsonb) to authenticated;
commit;
