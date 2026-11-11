-- Execute depois da migration 202611110003_platform_admin.sql no SQL Editor do Supabase.
-- Substitua somente o e-mail abaixo pelo seu e-mail cadastrado e confirmado no agendaJá.
do $$
declare v_email text:='SEU_EMAIL_AQUI';v_user uuid;v_existing uuid;
begin
 if v_email='SEU_EMAIL_AQUI' then raise exception 'Preencha seu e-mail antes de executar este arquivo'; end if;
 select id into strict v_user from auth.users where lower(email)=lower(trim(v_email)) and email_confirmed_at is not null;
 select user_id into v_existing from agendaja_private.platform_owner where singleton;
 if v_existing is not null and v_existing<>v_user then raise exception 'A plataforma já tem outro administrador. Não houve alteração.'; end if;
 insert into agendaja_private.platform_owner(singleton,user_id) values(true,v_user) on conflict(singleton) do nothing;
end $$;
