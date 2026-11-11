# Backend do agendaJá

O modo de demonstração do frontend usa dados locais do navegador. Este diretório contém o backend real preparado para um projeto Supabase, sem credenciais e sem dados fictícios no banco. A migration não foi aplicada a uma instância Supabase nesta entrega.

## Instalação

1. Crie um projeto Supabase e aplique `migrations/202611110001_initial.sql` e depois `migrations/202611110002_business_industries.sql` no SQL Editor como proprietário do projeto, ou use `supabase db push` após vincular o projeto com a CLI. Cada arquivo é aplicado uma única vez. A segunda migration acrescenta o segmento do negócio e a função `save_business_profile`, que salva configurações e segmento na mesma transação.
2. No Auth, habilite cadastro por e-mail, confirmação de e-mail e recuperação de senha; configure a URL do site e os redirecionamentos permitidos. Habilite proteção antiabuso/CAPTCHA do provedor para cadastros e login antes da abertura pública.
3. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env.local` do aplicativo, usando somente a URL e a chave pública/anon. Nunca coloque a chave `service_role` no frontend. Reinicie o Vite.
4. Cadastre uma conta, confirme o e-mail e crie a organização com a RPC de onboarding. A organização nasce vazia, com funcionamento de segunda a sábado, das 09h às 18h, no fuso `America/Fortaleza`.
5. Cadastre serviços, profissionais e os vínculos entre eles. Sem esse vínculo, o profissional não pode receber reservas para o serviço.

As migrations devem ser executadas uma vez e versionadas. Não execute este arquivo sobre um banco com tabelas homônimas sem revisar a migração dos dados existentes.

## Modelo e permissões

Uma organização representa um estabelecimento no MVP. `tenant_id` identifica a organização em todos os dados operacionais. Uma pessoa pode participar de várias organizações, mas o onboarding inicial permite criar um estabelecimento por proprietário para limitar abuso. Expansão de filiais e assinaturas requer evolução do modelo.

As tabelas são `organizations`, `profiles`, `organization_members`, `professionals`, `services`, `professional_services`, `business_hours`, `professional_availability`, `time_off`, `customers`, `appointments`, `appointment_events` e `booking_attempts`.

- Proprietário e administrador gerenciam serviços, profissionais, horários e configurações. Somente proprietário gerencia vínculos da equipe. Escritas de profissionais e membros são feitas pelas RPCs autorizadas; nenhuma conta do aplicativo altera `user_id` de profissionais ou promove alguém para `owner` por escrita direta. A primeira linha de proprietário nasce na transação de onboarding.
- Recepcionista gerencia clientes e agendamentos do estabelecimento e registra recebimentos.
- Profissional vê sua própria agenda e clientes relacionados aos seus atendimentos, incluindo as observações internas desses clientes, e pode alterar o status dos próprios atendimentos pela RPC. Não registra recebimentos nem gerencia cadastros gerais.
- Cliente não lê diretamente `customers`, `appointments` ou observações internas. As RPCs pessoais retornam somente os próprios agendamentos e campos públicos dos serviços/estabelecimentos.
- Visitante sem login acessa somente catálogo público e disponibilidade; a confirmação exige uma conta com e-mail verificado.

Todas as tabelas usam RLS. Chaves estrangeiras compostas impedem associar cliente, serviço e profissional de organizações diferentes. A tabela de eventos não permite escrita direta pelo aplicativo; alterações dos agendamentos geram registros pelo trigger. Logotipos são públicos no bucket `business-logos`; gravações são restritas a proprietário/admin na pasta `<tenant_id>/`, com até 2 MB e tipos PNG/JPEG/WebP. O bucket não aceita documentos de clientes.

## Campos usados pelo frontend

- `organizations`: `id`, `name`, `slug`, `phone`, `email`, `address`, `logo_url`, `timezone`, `cancellation_hours`, `slot_interval`, `active`.
- `services`: `id`, `tenant_id`, `name`, `description`, `category`, `price`, `duration` em minutos, `active`.
- `professionals`: `id`, `tenant_id`, `user_id` opcional, `name`, `title`, `email`, `color`, `active`.
- `professional_services`: `tenant_id`, `professional_id`, `service_id`.
- `business_hours`: `tenant_id`, `weekday` (domingo = 0), `starts_at` e `ends_at` como hora local. É possível representar pausas com mais de uma faixa no mesmo dia.
- `professional_availability`: os mesmos campos de horário e `professional_id`. Sem nenhuma faixa própria, herda o expediente da empresa; a partir de uma faixa própria, os dias ausentes são folgas.
- `time_off`: `id`, `tenant_id`, `professional_id`, `starts_at`, `ends_at` em UTC, `reason`.
- `customers`: `id`, `tenant_id`, `user_id` opcional, `name`, `email`, `phone`, `notes` internas.
- `appointments`: `id`, `tenant_id`, `customer_id`, `professional_id`, `service_id`, `starts_at`, `ends_at`, `duration`, `price`, `status`, `paid`, `notes`, `created_at`, `updated_at`.
- `appointment_events`: `id`, `tenant_id`, `appointment_id`, `actor_id`, `action`, `details`, `created_at`.

Datas de agendamento são `timestamptz`, armazenadas como instantes UTC. Converter a data selecionada para UTC a partir do fuso do estabelecimento, não do dispositivo do visitante. A disponibilidade pública já retorna instantes corretos; enviar o `starts_at` escolhido sem reconstruir a data no navegador.

## RPCs

Use `supabase.rpc('nome', { parametros })`. Erros de regras de negócio são retornados pelo Supabase em `error`; mostre uma mensagem adequada e atualize a disponibilidade após conflitos.

### `onboard_organization`

Parâmetros: `{p_name: string, p_slug: string, p_industry?: string}`. Requer login. Retorna o UUID da organização. Cria organização, segmento, vínculo de proprietário e horários padrão em uma transação. Segmentos aceitos: salon, barbershop, aesthetics, consultations, fitness, education, pet, automotive, consulting, other. Não insere serviços nem clientes de exemplo. Dados de perfil são criados pelo trigger de Auth; contas preexistentes recebem backfill na migration.

### `get_public_business`

Parâmetros: `{p_slug: string}`. Acesso anônimo. Retorna `null` se não houver estabelecimento ativo, ou:

```json
{
  "organization": {"id":"uuid","name":"Nome","slug":"nome","phone":"","address":"","logo_url":null,"timezone":"America/Fortaleza","cancellation_hours":2,"slot_interval":30},
  "services": [{"id":"uuid","name":"Corte","description":"","category":"Cabelo","price":50,"duration":60,"active":true}],
  "professionals": [{"id":"uuid","name":"Ana","title":"Profissional","color":"#56826f","active":true,"serviceIds":["uuid"]}]
}
```

Não retorna e-mails de profissionais, notas de clientes ou reservas de outras pessoas.

### `get_public_availability`

Parâmetros: `{p_slug, p_service_id: uuid, p_professional_id: uuid, p_date: 'YYYY-MM-DD'}`. Acesso anônimo. Retorna `[{starts_at: ISO_UTC, ends_at: ISO_UTC}]`. A data é interpretada no fuso da empresa. Considera expediente, pausas, disponibilidade individual, folgas, duração e reservas existentes. Limita consultas ao dia atual e aos próximos 365 dias.

### `book_public_appointment`

Parâmetros: `{p_slug, p_service_id, p_professional_id, p_starts_at: ISO_UTC, p_customer_name, p_customer_email, p_customer_phone}`. Requer login e e-mail verificado. O e-mail informado precisa ser o e-mail da conta. Retorna `{id, status, starts_at, ends_at}`.

O banco calcula preço/duração a partir do serviço e confirma o horário dentro da transação. Uma constraint de exclusão impede reservas sobrepostas mesmo em requisições simultâneas; intervalos adjacentes são permitidos. O cliente é vinculado à conta no estabelecimento. Clientes cadastrados manualmente sem conta não são vinculados automaticamente apenas pelo e-mail, evitando apropriação de históricos.

Há limite de dez reservas bem-sucedidas por hora por conta. Erros de transação não consomem a cota. Isso não substitui proteção de rede, CAPTCHA do Auth, limites no gateway e monitoramento contra abuso distribuído. Consultas públicas de disponibilidade não têm limite de rede implementado no SQL.

### `get_my_appointments`

Sem parâmetros. Requer login. Retorna um array JSON de agendamentos próprios, com `id`, `tenant_id`, `customer_id`, `professional_id`, `service_id`, `starts_at`, `ends_at`, `duration`, `price`, `status`, `paid`, `created_at`, `business_name`, `business_slug`, `timezone`, `service_name`, `professional_name`, `cancellation_hours`. Não retorna notas internas nem dados de outros clientes.

### `cancel_my_appointment`

Parâmetros: `{p_appointment_id: uuid}`. Retorna `void`. Exige titularidade, status pendente/confirmado e antecedência mínima definida pelo estabelecimento. Não remove a reserva do histórico.

### `reschedule_my_appointment`

Parâmetros: `{p_appointment_id: uuid, p_starts_at: ISO_UTC}`. Retorna `{id,status,starts_at,ends_at}`. Mesmas regras de titularidade e prazo do cancelamento; preserva profissional, serviço, preço e duração originais. O horário novo precisa estar disponível. Validação no banco usa a duração original mesmo se o serviço tiver mudado desde a reserva.

### `set_appointment_status`

Parâmetros: `{p_appointment_id: uuid, p_status: 'pending'|'confirmed'|'completed'|'cancelled', p_paid: boolean|null}`. Retorna `void`. Equipe com permissão ou profissional responsável altera o status; somente proprietário/admin/recepcionista alteram recebimentos. Um atendimento futuro não pode ser concluído; um concluído não pode voltar a outro status.

### `save_business_settings`

Parâmetros: `{p_tenant_id: uuid, p_settings: {name,slug,phone,email,address,timezone,cancellation_hours,slot_interval,opening:'09:00',closing:'18:00',weekdays:[1,2,3,4,5,6],logo_url?:string|null}}`. Retorna `void`. Restrito a proprietário/admin. Atualiza a organização e substitui o expediente em uma transação. `logo_url` aceita uma URL HTTPS de até 2048 caracteres; ausente preserva o logo atual, `null` ou `''` remove. Este formulário simples salva uma faixa diária; pausas mais complexas podem usar `business_hours`. Rejeita mudanças que deixem reservas futuras fora do novo expediente. Há bloqueio transacional compartilhado com a criação/reagendamento de reservas.

### `save_professional`

Parâmetros: `{p_tenant_id: uuid, p_professional: {id?:uuid,name,title,email,color,active,availability?:[{weekday:0,start:'09:00',end:'12:00'}]}, p_service_ids: uuid[]}`. Retorna UUID do profissional. Restrito a proprietário/admin. Salva profissional e substitui vínculos de serviços na mesma transação. Não altera `user_id` nem atribui permissões de equipe. Um ID de profissional ou serviço de outra organização faz a operação inteira falhar, inclusive sob conflito de chave concorrente.

Se a chave `availability` estiver presente, substitui as faixas de disponibilidade individual na mesma transação. Pode haver mais de uma faixa por dia para representar pausas. Faixas sobrepostas, invertidas ou dias inválidos são rejeitados pelo banco. `[]` remove a agenda própria e volta a herdar o expediente da empresa; a chave ausente preserva a configuração existente. Reservas futuras não podem ficar fora da nova disponibilidade: é necessário reagendá-las antes. O bloqueio por profissional é compartilhado com a validação de reservas.

### `list_team_members`

Parâmetros: `{p_tenant_id: uuid}`. Retorna um array JSON `[{user_id,name,email,role,professional_id}]`. Somente proprietário/admin do estabelecimento consultam essa lista. Não permite enumerar pessoas de outras organizações nem expor e-mails da equipe no catálogo público.

### `set_team_member`

Parâmetros: `{p_tenant_id: uuid, p_email: string, p_role: 'admin'|'professional'|'receptionist', p_professional_id: uuid|null}`. Retorna o UUID da conta vinculada. Somente proprietário pode executar; administrador não concede acesso. A pessoa deve ter uma conta existente e com e-mail confirmado no Auth; o e-mail do perfil precisa corresponder ao e-mail real dessa conta. Não envia convites ou mensagens.

Cria ou atualiza o vínculo de equipe na organização. Não permite modificar o próprio proprietário nem atribuir o papel de proprietário. O papel profissional exige um profissional ativo da mesma organização e não permite tomar um vínculo pertencente a outra conta. Trocar o profissional remove o vínculo anterior da mesma pessoa; mudar para administrador/recepcionista limpa o vínculo profissional. Vínculo de equipe e de profissional mudam na mesma transação. Para os demais papéis, envie `p_professional_id:null`.

## Verificação executada

O teste `tests/verify.mjs` carrega a migration completa em PostgreSQL WASM (PGlite), com os schemas mínimos de Auth/Storage simulados. Ele cobre criação de perfis, onboarding, isolamento entre tenants, reserva pública autenticada, anonimato, e-mail, duração, sobreposição parcial, adjacência, folgas, disponibilidade individual e pausas, privacidade de notas, papéis, auditoria, cancelamento, reagendamento, logo, gestão de equipe verificada e transações de configurações.

Para repetir sem adicionar dependências de teste à aplicação:

```powershell
npm install --prefix "$env:TEMP\agendaja-db-check" @electric-sql/pglite
node supabase/tests/verify.mjs "$env:TEMP\agendaja-db-check"
```

Os testes não substituem validação em uma instância Supabase real. Antes de comercializar, validar Auth/SMTP, recuperação de senha, políticas de Storage, permissões de cada papel e concorrência entre duas conexões reais. A constraint PostgreSQL de exclusão está presente, mas o teste WASM usa uma única conexão e não simula duas requisições em paralelo.

## Operação e próximos passos

- Definir política de retenção, exportação e exclusão de dados pessoais e processo de atendimento ao titular. Dados e observações devem ser limitados ao necessário. Registros de auditoria e histórico precisam de uma política documentada antes de processar solicitações de remoção.
- Configurar backups, alertas, monitoramento e proteção antiabuso antes da abertura comercial. Remover registros antigos de `booking_attempts` por uma rotina administrativa com retenção definida; não há agendamento automático nesta entrega.
- Implementar convites por e-mail, notificações automatizadas e cobrança recorrente quando os respectivos provedores forem escolhidos. O gerenciamento atual permite conceder acesso a uma conta já criada e verificada; nenhuma mensagem é enviada pelo SQL.
- O campo `paid` registra o recebimento informado pela equipe; não representa um pagamento processado pela plataforma. Integração de pagamentos e assinaturas não está implementada.
- Para multiunidade, acrescentar entidade de estabelecimento e seus vínculos de profissionais/horários; não reutilizar uma organização para unidades com fusos diferentes sem modelagem própria.

Referências: [RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [funções de banco](https://supabase.com/docs/guides/database/functions), [políticas do PostgreSQL](https://www.postgresql.org/docs/current/sql-createpolicy.html).
