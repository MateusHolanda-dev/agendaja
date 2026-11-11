begin;
alter table public.organizations add column industry text not null default 'other'
 check (industry in ('salon','barbershop','aesthetics','consultations','fitness','education','pet','automotive','consulting','other'));

drop function public.onboard_organization(text,text);
create function public.onboard_organization(p_name text,p_slug text,p_industry text default 'other')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_uid uuid:=auth.uid();
begin
 if v_uid is null then raise exception 'Entre na sua conta para continuar'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,1));
 if exists(select 1 from public.organization_members where user_id=v_uid and role='owner') then raise exception 'Sua conta já possui um estabelecimento'; end if;
 insert into public.organizations(name,slug,industry) values(trim(p_name),lower(trim(p_slug)),p_industry) returning id into v_id;
 insert into public.organization_members(tenant_id,user_id,role) values(v_id,v_uid,'owner');
 insert into public.business_hours(tenant_id,weekday,starts_at,ends_at) select v_id,i,'09:00'::time,'18:00'::time from generate_series(1,6) i;
 return v_id;
end $$;

create function public.save_business_profile(p_tenant_id uuid,p_settings jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_org_role(p_tenant_id,array['owner','admin']) then raise exception 'Acesso restrito à gestão'; end if;
 perform public.save_business_settings(p_tenant_id,p_settings);
 if p_settings ? 'industry' then update public.organizations set industry=p_settings->>'industry' where id=p_tenant_id; end if;
end $$;
revoke all on function public.onboard_organization(text,text,text),public.save_business_profile(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.onboard_organization(text,text,text),public.save_business_profile(uuid,jsonb) to authenticated;
commit;
