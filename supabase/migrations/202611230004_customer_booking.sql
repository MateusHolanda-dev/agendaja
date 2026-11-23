begin;
-- Reservas novas são criadas pela função book_public_appointment, que usa
-- auth.uid() e o e-mail confirmado para vincular o próprio cliente à empresa.
-- Equipe mantém as permissões existentes de consultar e gerenciar reservas.
-- SECURITY DEFINER continua podendo inserir; INSERT direto pela API é removido.
revoke insert on public.appointments from authenticated;
commit;
