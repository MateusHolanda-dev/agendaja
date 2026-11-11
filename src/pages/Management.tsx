import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Check, Clock3, Copy, ExternalLink, ImagePlus, Mail, MapPin, Pencil, Plus, BriefcaseBusiness, Search, ShieldCheck, Users, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../lib/store';
import { industries } from '../lib/industries';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui';
import { statusLabels, type BusinessSettings, type Customer, type Professional, type Service, type TimeOff } from '../lib/types';
import './Management.css';

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const initials = (value: string) => value.split(' ').filter(Boolean).slice(0, 2).map(item => item[0]).join('');
const id = () => crypto.randomUUID();
const isManager = (role?: string) => role === 'owner' || role === 'admin';
const readableDate = (date: string) => format(new Date(`${date}T12:00:00`), "dd 'de' MMMM", { locale: ptBR });

function Heading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="muted">{description}</p></div>{children}</div>;
}

function ErrorMessage({ message }: { message: string }) {
  return message ? <p className="form-error" role="alert">{message}</p> : null;
}

function Empty({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><Search size={28} /><h3>{title}</h3><p className="muted">{description}</p></div>;
}

function FormActions({ busy, onClose, label = 'Salvar alterações' }: { busy: boolean; onClose: () => void; label?: string }) {
  return <div className="modal-actions"><button className="btn secondary" type="button" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} type="submit">{busy ? 'Salvando…' : label}<Check size={16} /></button></div>;
}

const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function ProfessionalSchedule({ professional, settings, onChange }: { professional: Professional; settings: BusinessSettings; onChange: (value: Professional) => void }) {
  const [custom, setCustom] = useState(!!professional.availability?.length);
  const schedule = professional.availability ?? [];
  const changeSchedule = (weekday: number, key: 'start' | 'end', value: string) => onChange({ ...professional, availability: schedule.map(row => row.weekday === weekday ? { ...row, [key]: value } : row) });
  return <fieldset className="field professional-schedule"><legend>Horários individuais</legend><label className="checkbox-label"><input type="checkbox" checked={custom} onChange={event => { setCustom(event.target.checked); onChange({ ...professional, availability: event.target.checked ? settings.weekdays.map(weekday => ({ weekday, start: settings.opening, end: settings.closing })) : undefined }); }} />Definir uma semana personalizada</label><small className="muted">Sem personalização, o profissional segue os dias e horários do estabelecimento. Pausas e folgas são adicionadas nos bloqueios.</small>{custom && <div className="schedule-days">{weekdayNames.map((day, weekday) => { const row = schedule.find(value => value.weekday === weekday); const open = settings.weekdays.includes(weekday); return <div className={`schedule-day ${!open ? 'closed' : ''}`} key={weekday}><label className="checkbox-label"><input type="checkbox" disabled={!open} checked={!!row} onChange={event => onChange({ ...professional, availability: event.target.checked ? [...schedule, { weekday, start: settings.opening, end: settings.closing }] : schedule.filter(value => value.weekday !== weekday) })} />{day}</label>{row ? <div className="schedule-day-times"><input className="input" type="time" required aria-label={`Início ${day}`} value={row.start} min={settings.opening} max={settings.closing} onChange={event => changeSchedule(weekday, 'start', event.target.value)} /><span>até</span><input className="input" type="time" required aria-label={`Fim ${day}`} value={row.end} min={settings.opening} max={settings.closing} onChange={event => changeSchedule(weekday, 'end', event.target.value)} /></div> : <span className="muted">{open ? 'Folga' : 'Estabelecimento fechado'}</span>}</div>; })}</div>}{custom && !schedule.length && <small className="error-text">Selecione pelo menos um dia ou desative a semana personalizada.</small>}</fieldset>;
}

type TeamMember = { user_id: string; name: string; email: string; role: string };
const roleNames: Record<string, string> = { owner: 'Proprietário', admin: 'Administrador', professional: 'Profissional', receptionist: 'Recepcionista' };
function TeamAccess() {
  const { data, user, isDemo, notify } = useApp();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('receptionist');
  const [professionalId, setProfessionalId] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (isDemo || !supabase || !user?.tenantId) return;
    let active = true; setLoading(true); setError(''); setMembers([]);
    void (async () => { try { const { data: result, error: failure } = await supabase!.rpc('list_team_members', { p_tenant_id: user.tenantId }); if (!active) return; if (failure) setError(failure.message); else setMembers((result ?? []) as TeamMember[]); } catch { if (active) setError('Não foi possível carregar a equipe. Tente abrir esta aba novamente.'); } finally { if (active) setLoading(false); } })();
    return () => { active = false; };
  }, [isDemo, user?.tenantId, refresh]);
  async function saveMember() {
    if (!supabase || !user?.tenantId || user.role !== 'owner') return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Informe o e-mail de uma conta já cadastrada e confirmada.'); return; }
    if (role === 'professional' && !professionalId) { setError('Escolha o profissional correspondente a essa conta.'); return; }
    setBusy(true); setError('');
    try { const { error: failure } = await supabase.rpc('set_team_member', { p_tenant_id: user.tenantId, p_email: email.trim().toLowerCase(), p_role: role, p_professional_id: role === 'professional' ? professionalId : null }); if (failure) throw failure; notify('Acesso da equipe atualizado.'); setEmail(''); setProfessionalId(''); setRefresh(value => value + 1); }
    catch (failure) { setError(failure instanceof Error ? failure.message : typeof failure === 'object' && failure && 'message' in failure ? String(failure.message) : 'Não foi possível atualizar o acesso.'); }
    finally { setBusy(false); }
  }
  const visibleMembers = isDemo && user ? [{ user_id: user.id, name: user.name, email: user.email, role: user.role }] : members;
  return <section className="team-access"><div className="section-heading"><h3>Acesso da equipe</h3><p className="muted">Cada pessoa com a permissão certa para trabalhar.</p></div>{loading && <p className="muted" role="status">Carregando a equipe…</p>}<div className="team-members">{visibleMembers.map(member => <div className="team-member" key={member.user_id}><span className="avatar">{initials(member.name || member.email)}</span><div><strong>{member.name || member.email}</strong><small className="muted">{member.email}</small></div><span className="badge confirmed">{roleNames[member.role] ?? member.role}</span>{!isDemo && user?.role === 'owner' && member.role !== 'owner' && <button className="btn ghost" type="button" aria-label={`Alterar acesso de ${member.name}`} onClick={() => { setEmail(member.email); setRole(member.role); setProfessionalId(''); }}><Pencil size={15} /></button>}</div>)}</div>{isDemo ? <p className="muted team-explanation">A demonstração exibe o proprietário fictício. A inclusão de pessoas e as permissões reais ficam disponíveis quando o Supabase estiver conectado.</p> : user?.role === 'owner' ? <div className="team-editor" onKeyDown={event => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); void saveMember(); } }}><strong>Adicionar ou atualizar acesso</strong><p className="muted">A pessoa precisa ter uma conta cadastrada e o e-mail confirmado no agendaJá. Esta ação concede acesso; não envia convite.</p><div className="form-grid"><label className="field">E-mail da conta<input className="input" type="email" maxLength={200} value={email} onChange={event => setEmail(event.target.value)} placeholder="pessoa@exemplo.com" /></label><label className="field">Permissão<select className="input" value={role} onChange={event => setRole(event.target.value)}><option value="receptionist">Recepcionista · agenda e clientes</option><option value="professional">Profissional · própria agenda</option><option value="admin">Administrador · gestão do estabelecimento</option></select></label>{role === 'professional' && <label className="field">Profissional vinculado<select className="input" value={professionalId} onChange={event => setProfessionalId(event.target.value)}><option value="">Selecione um profissional</option>{data.professionals.filter(professional => professional.active).map(professional => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></label>}<button className="btn primary" type="button" disabled={busy || loading} onClick={() => void saveMember()}>{busy ? 'Atualizando…' : 'Salvar acesso'}<ShieldCheck size={16} /></button></div></div> : <p className="muted team-explanation">Somente o proprietário pode conceder ou alterar os acessos da equipe.</p>}<ErrorMessage message={error} /></section>;
}

function BusinessLogo({ settings, onChange }: { settings: BusinessSettings; onChange: (url: string | undefined) => void }) {
  const { data, user, isDemo, saveSettings, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
    if (!extensions[file.type] || file.size > 2 * 1024 * 1024) { setError('Escolha uma imagem PNG, JPG ou WebP de até 2 MB.'); return; }
    setBusy(true); setError(''); let uploadedPath: string | undefined;
    try {
      const preview = URL.createObjectURL(file);
      try { await new Promise<void>((resolve, reject) => { const image = new Image(); image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0 ? resolve() : reject(new Error('A imagem está vazia.')); image.onerror = () => reject(new Error('Não foi possível abrir essa imagem.')); image.src = preview; }); }
      finally { URL.revokeObjectURL(preview); }
      let url: string;
      if (isDemo) url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Não foi possível ler a imagem.')); reader.readAsDataURL(file); });
      else { if (!supabase || !user?.tenantId) throw new Error('Conecte o estabelecimento para enviar a imagem.'); uploadedPath = `${user.tenantId}/logo-${crypto.randomUUID()}.${extensions[file.type]}`; const { error: failure } = await supabase.storage.from('business-logos').upload(uploadedPath, file, { contentType: file.type, upsert: false }); if (failure) throw failure; url = supabase.storage.from('business-logos').getPublicUrl(uploadedPath).data.publicUrl; }
      await saveSettings({ ...data.settings, logoUrl: url }); onChange(url); notify('Logo atualizado com sucesso.');
    } catch (failure) { if (uploadedPath && supabase) await supabase.storage.from('business-logos').remove([uploadedPath]); setError(failure instanceof Error ? failure.message : typeof failure === 'object' && failure && 'message' in failure ? String(failure.message) : 'Não foi possível enviar o logo.'); }
    finally { setBusy(false); }
  }
  async function remove() { setBusy(true); setError(''); try { await saveSettings({ ...data.settings, logoUrl: undefined }); onChange(undefined); notify('Logo removido.'); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível remover o logo.'); } finally { setBusy(false); } }
  return <div className="business-logo-editor"><div className="business-logo-preview">{settings.logoUrl ? <img src={settings.logoUrl} alt={`Logo de ${settings.name}`} /> : <span>{initials(settings.name)}</span>}</div><div><strong>Logo do estabelecimento</strong><p className="muted">PNG, JPG ou WebP, até 2 MB. A imagem aparece na página pública.</p><div className="logo-actions"><label className={`btn secondary logo-upload ${busy ? 'disabled' : ''}`}><ImagePlus size={16} />{busy ? 'Atualizando…' : 'Escolher imagem'}<input aria-label="Enviar logo do estabelecimento" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => void upload(event)} /></label>{settings.logoUrl && <button type="button" className="btn ghost" disabled={busy} onClick={() => void remove()}>Remover</button>}</div><small className="muted">O logo é salvo ao enviar. {isDemo ? 'Na demonstração, fica apenas neste navegador.' : 'O arquivo ficará acessível publicamente.'}</small><ErrorMessage message={error} /></div></div>;
}

export function CustomersPage() {
  const { data, user, saveCustomer, notify } = useApp();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canEdit = isManager(user?.role) || user?.role === 'receptionist';
  const customers = data.customers.filter(customer => `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(query.toLowerCase()));
  const history = viewing ? data.appointments.filter(appointment => appointment.customerId === viewing.id).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)) : [];
  const open = (customer?: Customer) => { setError(''); setEditing(customer ?? { id: id(), name: '', email: '', phone: '', notes: '' }); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    if (editing.name.trim().length < 2) { setError('Informe o nome completo do cliente.'); return; }
    if (editing.phone.replace(/\D/g, '').length < 10) { setError('Informe um telefone com DDD.'); return; }
    setBusy(true); setError('');
    try { await saveCustomer({ ...editing, name: editing.name.trim(), email: editing.email.trim().toLowerCase(), phone: editing.phone.trim() }); setEditing(null); notify('Cliente salvo com sucesso.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar o cliente.'); }
    finally { setBusy(false); }
  }
  return <>
    <Heading eyebrow="RELACIONAMENTOS QUE IMPORTAM" title="Seus clientes" description="Cada atendimento é o começo de uma boa relação.">{canEdit && <button className="btn primary" onClick={() => open()}><Plus size={18} />Novo cliente</button>}</Heading>
    <div className="card"><div className="toolbar"><div className="search-field"><Search size={18} /><input className="input" aria-label="Buscar clientes" placeholder="Busque por nome, e-mail ou telefone…" value={query} onChange={event => setQuery(event.target.value)} /></div><span className="muted">{customers.length} {customers.length === 1 ? 'cliente' : 'clientes'}</span></div>
      {customers.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Contato</th><th>Atendimentos</th><th>Última visita</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{customers.map(customer => {
        const completed = data.appointments.filter(item => item.customerId === customer.id && item.status === 'completed');
        const last = completed.map(item => item.date).sort().at(-1);
        return <tr key={customer.id}><td><button className="customer-name" onClick={() => setViewing(customer)}><span className="avatar">{initials(customer.name)}</span><span><strong>{customer.name}</strong><small className="muted">Cliente do estabelecimento</small></span></button></td><td><span>{customer.phone || '—'}</span><small className="muted">{customer.email || 'Sem e-mail'}</small></td><td>{completed.length} {completed.length === 1 ? 'atendimento' : 'atendimentos'}</td><td>{last ? readableDate(last) : <span className="muted">Primeira visita em breve</span>}</td><td><button className="btn ghost" aria-label={`Ver histórico de ${customer.name}`} onClick={() => setViewing(customer)}><ArrowUpRight size={18} /></button>{canEdit && <button className="btn ghost" aria-label={`Editar ${customer.name}`} onClick={() => open(customer)}><Pencil size={16} /></button>}</td></tr>;
      })}</tbody></table></div> : <Empty title="Nenhum cliente encontrado" description={query ? 'Tente buscar por outro nome ou telefone.' : 'Cadastre seu primeiro cliente para começar.'} />}
    </div>
    <Modal open={!!editing} onClose={() => setEditing(null)} title={editing && data.customers.some(item => item.id === editing.id) ? 'Editar cliente' : 'Um novo relacionamento'}>
      {editing && <form onSubmit={submit}><div className="form-grid"><label className="field">Nome completo<input className="input" required autoFocus maxLength={100} value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} placeholder="Como seu cliente se chama?" /></label><label className="field">Telefone com DDD<input className="input" type="tel" required maxLength={25} value={editing.phone} onChange={event => setEditing({ ...editing, phone: event.target.value })} placeholder="(85) 99999-9999" /></label><label className="field">E-mail<input className="input" type="email" maxLength={200} value={editing.email} onChange={event => setEditing({ ...editing, email: event.target.value })} placeholder="cliente@exemplo.com" /></label><label className="field">Observações internas<textarea className="input" rows={3} maxLength={2000} value={editing.notes} onChange={event => setEditing({ ...editing, notes: event.target.value })} placeholder="Preferências e informações úteis para o atendimento" /><small className="muted">Visíveis apenas para a equipe autorizada. Evite dados sensíveis desnecessários.</small></label></div><ErrorMessage message={error} /><FormActions busy={busy} onClose={() => setEditing(null)} label="Salvar cliente" /></form>}
    </Modal>
    <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name ?? 'Cliente'}>{viewing && <><div className="customer-contact"><p><Mail size={16} /> {viewing.email || 'E-mail não informado'}</p><p>{viewing.phone}</p></div>{viewing.notes && <div className="notice"><ShieldCheck size={18} /><div><strong>Observações da equipe</strong><p>{viewing.notes}</p></div></div>}<h3 style={{ margin: '24px 0 12px' }}>Histórico de agendamentos</h3>{history.length ? <div className="history-list">{history.map(appointment => <div className="history-row" key={appointment.id}><div><strong>{data.services.find(service => service.id === appointment.serviceId)?.name ?? 'Serviço'}</strong><small className="muted">{readableDate(appointment.date)} às {appointment.time} · {data.professionals.find(professional => professional.id === appointment.professionalId)?.name}</small></div><span className={`badge ${appointment.status}`}>{statusLabels[appointment.status]}</span></div>)}</div> : <Empty title="A história começa agora" description="Os agendamentos deste cliente aparecerão aqui." />}</>}</Modal>
  </>;
}

export function ServicesPage() {
  const { data, user, saveService, notify } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [editing, setEditing] = useState<Service | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canEdit = isManager(user?.role);
  const categories = ['Todos', ...new Set(data.services.map(service => service.category).filter(Boolean))];
  const services = data.services.filter(service => (category === 'Todos' || service.category === category) && `${service.name} ${service.description}`.toLowerCase().includes(query.toLowerCase()));
  const open = (service?: Service) => { setError(''); setEditing(service ?? { id: id(), name: '', description: '', category: '', price: 0, duration: 30, active: true }); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    if (editing.name.trim().length < 2 || !editing.category.trim()) { setError('Informe o nome e a categoria do serviço.'); return; }
    if (!Number.isFinite(editing.price) || editing.price < 0 || !Number.isInteger(editing.duration) || editing.duration < 5 || editing.duration > 480) { setError('Informe um valor válido e uma duração entre 5 e 480 minutos.'); return; }
    setBusy(true); setError('');
    try { await saveService({ ...editing, name: editing.name.trim(), category: editing.category.trim() }); setEditing(null); notify('Serviço salvo com sucesso.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar o serviço.'); }
    finally { setBusy(false); }
  }
  return <><Heading eyebrow="SEU TALENTO, SEUS SERVIÇOS" title="Seus serviços" description="Organize o que você oferece. Facilite a próxima escolha.">{canEdit && <button className="btn primary" onClick={() => open()}><Plus size={18} />Novo serviço</button>}</Heading>
    <div className="toolbar"><div className="search-field"><Search size={18} /><input className="input" aria-label="Buscar serviços" placeholder="Encontre um serviço…" value={query} onChange={event => setQuery(event.target.value)} /></div><label className="field"><span className="sr-only">Categoria</span><select className="input" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label></div>
    {services.length ? <div className="grid-3 service-grid">{services.map((service, index) => <article className="card entity-card" key={service.id}><div className="entity-card-top"><span className={`service-icon tone-${index % 3}`}><BriefcaseBusiness size={23} /></span><span className={`badge ${service.active ? 'confirmed' : 'cancelled'}`}>{service.active ? 'Ativo' : 'Inativo'}</span></div><span className="eyebrow">{service.category}</span><h3>{service.name}</h3><p className="muted">{service.description || 'Um cuidado especial, feito por quem entende.'}</p><div className="service-meta"><span><Clock3 size={15} />{service.duration} min</span><strong>{money(service.price)}</strong></div><div className="entity-card-footer"><span className="muted">{data.professionals.filter(professional => professional.active && professional.serviceIds.includes(service.id)).length} profissionais habilitados</span>{canEdit && <button className="btn ghost" onClick={() => open(service)} aria-label={`Editar ${service.name}`}><Pencil size={16} /></button>}</div></article>)}</div> : <div className="card"><Empty title="Nenhum serviço por aqui" description="Ajuste os filtros ou cadastre um serviço para oferecer aos seus clientes." /></div>}
    <Modal open={!!editing} onClose={() => setEditing(null)} title={editing && data.services.some(item => item.id === editing.id) ? 'Editar serviço' : 'Um novo cuidado'}>{editing && <form onSubmit={submit}><div className="form-grid"><label className="field">Nome do serviço<input className="input" autoFocus required maxLength={100} placeholder="Ex.: Atendimento individual" value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label><label className="field">Categoria<input className="input" required maxLength={80} list="service-categories" placeholder="Ex.: Consultas, aulas, beleza" value={editing.category} onChange={event => setEditing({ ...editing, category: event.target.value })} /><datalist id="service-categories">{categories.filter(item => item !== 'Todos').map(item => <option key={item} value={item} />)}</datalist></label><div className="form-columns"><label className="field">Preço (R$)<input className="input" required type="number" min="0" step="0.01" max="100000" value={editing.price} onChange={event => setEditing({ ...editing, price: Number(event.target.value) })} /></label><label className="field">Duração em minutos<input className="input" required type="number" min="5" max="480" step="5" value={editing.duration} onChange={event => setEditing({ ...editing, duration: Number(event.target.value) })} /></label></div><label className="field">Descrição<textarea className="input" rows={3} maxLength={1000} value={editing.description} onChange={event => setEditing({ ...editing, description: event.target.value })} placeholder="Conte um pouco sobre esse serviço" /></label><label className="checkbox-label"><input type="checkbox" checked={editing.active} onChange={event => setEditing({ ...editing, active: event.target.checked })} />Disponível para novos agendamentos</label></div><ErrorMessage message={error} /><FormActions busy={busy} onClose={() => setEditing(null)} label="Salvar serviço" /></form>}</Modal>
  </>;
}

export function ProfessionalsPage() {
  const { data, user, saveProfessional, addTimeOff, removeTimeOff, notify } = useApp();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Professional | null>(null);
  const [availability, setAvailability] = useState<Professional | null>(null);
  const [timeOff, setTimeOff] = useState({ date: format(new Date(), 'yyyy-MM-dd'), start: '12:00', end: '13:00', reason: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canEdit = isManager(user?.role);
  const professionals = data.professionals.filter(professional => `${professional.name} ${professional.title}`.toLowerCase().includes(query.toLowerCase()));
  const open = (professional?: Professional) => { setError(''); setEditing(professional ? { ...professional, availability: professional.availability?.length ? professional.availability.map(row => ({ ...row })) : undefined } : { id: id(), name: '', title: '', email: '', color: '#678a70', serviceIds: [], active: true }); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    if (editing.name.trim().length < 2) { setError('Informe o nome do profissional.'); return; }
    if (editing.active && editing.serviceIds.length === 0) { setError('Vincule pelo menos um serviço ao profissional.'); return; }
    if (editing.availability && !editing.availability.length) { setError('Selecione ao menos um dia da semana ou desative a personalização.'); return; }
    if (editing.availability?.some(row => !data.settings.weekdays.includes(row.weekday) || row.start >= row.end || row.start < data.settings.opening || row.end > data.settings.closing)) { setError('Os horários individuais precisam estar dentro do expediente, com o fim depois do início.'); return; }
    setBusy(true); setError('');
    try { await saveProfessional({ ...editing, name: editing.name.trim(), email: editing.email.trim().toLowerCase() }); setEditing(null); notify('Profissional salvo com sucesso.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar o profissional.'); }
    finally { setBusy(false); }
  }
  async function block(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!availability) return;
    if (timeOff.start >= timeOff.end) { setError('O fim do bloqueio deve ser depois do início.'); return; }
    setBusy(true); setError('');
    try { await addTimeOff({ ...timeOff, id: id(), professionalId: availability.id } as TimeOff); setTimeOff({ ...timeOff, reason: '' }); notify('Horário bloqueado na agenda.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível bloquear o horário.'); }
    finally { setBusy(false); }
  }
  async function unblock(blockId: string) {
    setBusy(true); setError('');
    try { await removeTimeOff(blockId); notify('Bloqueio removido.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível remover o bloqueio.'); }
    finally { setBusy(false); }
  }
  return <><Heading eyebrow="GENTE QUE FAZ ACONTECER" title="Sua equipe" description="Talentos diferentes. O mesmo cuidado em cada atendimento.">{canEdit && <button className="btn primary" onClick={() => open()}><Plus size={18} />Novo profissional</button>}</Heading><div className="toolbar"><div className="search-field"><Search size={18} /><input className="input" aria-label="Buscar profissionais" placeholder="Busque pelo nome ou especialidade…" value={query} onChange={event => setQuery(event.target.value)} /></div><span className="muted">{data.professionals.filter(professional => professional.active).length} profissionais ativos</span></div>
    {professionals.length ? <div className="grid-3 professional-grid">{professionals.map(professional => <article className="card entity-card" key={professional.id}><div className="entity-card-top"><span className="avatar avatar-large" style={{ background: `${professional.color}22`, color: professional.color }}>{initials(professional.name)}</span><span className={`badge ${professional.active ? 'confirmed' : 'cancelled'}`}>{professional.active ? 'Na equipe' : 'Inativo'}</span></div><h3>{professional.name}</h3><p className="muted">{professional.title || 'Profissional'}</p><div className="professional-services">{professional.serviceIds.map(serviceId => <span className="chip" key={serviceId}>{data.services.find(service => service.id === serviceId)?.name ?? 'Serviço'}</span>)}</div><div className="professional-hours"><Clock3 size={16} /><span>{professional.availability?.length ? professional.availability.length + ' dias na semana' : data.settings.opening + ' – ' + data.settings.closing}</span><small className="muted">{professional.availability?.length ? 'Horários individuais' : 'Horário do estabelecimento'}</small></div><div className="entity-card-footer"><Link className="text-link" to={`/app/agenda?profissional=${professional.id}`}>Ver agenda<ArrowUpRight size={16} /></Link>{canEdit && <div style={{ display: 'flex' }}><button className="btn ghost" aria-label={`Bloqueios de ${professional.name}`} onClick={() => { setError(''); setAvailability(professional); }}><CalendarDays size={17} /></button><button className="btn ghost" aria-label={`Editar ${professional.name}`} onClick={() => open(professional)}><Pencil size={16} /></button></div>}</div></article>)}</div> : <div className="card"><Empty title="Nenhum profissional encontrado" description="Cadastre sua equipe ou tente outra busca." /></div>}
    <div className="notice" style={{ marginTop: 24 }}><Users size={20} /><div><strong>Organize a equipe com tranquilidade</strong><p className="muted">O cadastro profissional define os serviços e a agenda. A concessão de acesso ao sistema é uma operação separada, com permissões no servidor.</p></div></div>
    <Modal open={!!editing} onClose={() => setEditing(null)} title={editing && data.professionals.some(item => item.id === editing.id) ? 'Editar profissional' : 'Um novo talento na equipe'}>{editing && <form onSubmit={submit}><div className="form-grid"><label className="field">Nome completo<input className="input" autoFocus required maxLength={100} value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label><div className="form-columns"><label className="field">Especialidade<input className="input" maxLength={100} placeholder="Ex.: Instrutor, consultor, especialista" value={editing.title} onChange={event => setEditing({ ...editing, title: event.target.value })} /></label><label className="field">Cor na agenda<input type="color" className="input" value={editing.color} onChange={event => setEditing({ ...editing, color: event.target.value })} /></label></div><label className="field">E-mail<input className="input" type="email" maxLength={200} value={editing.email} onChange={event => setEditing({ ...editing, email: event.target.value })} /></label><fieldset className="field"><legend>Serviços oferecidos</legend><div className="checkbox-list">{data.services.filter(service => service.active || editing.serviceIds.includes(service.id)).map(service => <label className="checkbox-label" key={service.id}><input type="checkbox" checked={editing.serviceIds.includes(service.id)} onChange={event => setEditing({ ...editing, serviceIds: event.target.checked ? [...editing.serviceIds, service.id] : editing.serviceIds.filter(serviceId => serviceId !== service.id) })} />{service.name}<span className="muted">{service.duration} min</span></label>)}</div>{data.services.length === 0 && <small className="muted">Cadastre um serviço antes de ativar um profissional.</small>}</fieldset><ProfessionalSchedule professional={editing} settings={data.settings} onChange={setEditing} /><label className="checkbox-label"><input type="checkbox" checked={editing.active} onChange={event => setEditing({ ...editing, active: event.target.checked })} />Profissional ativo para agendamentos</label></div><ErrorMessage message={error} /><FormActions busy={busy} onClose={() => setEditing(null)} label="Salvar profissional" /></form>}</Modal>
    <Modal open={!!availability} onClose={() => setAvailability(null)} title={`Bloqueios · ${availability?.name ?? ''}`}><p className="muted" style={{ marginBottom: 20 }}>Reserve pausas, folgas e compromissos que não podem receber atendimentos.</p><form onSubmit={block}><div className="form-grid"><label className="field">Data<input type="date" className="input" required value={timeOff.date} onChange={event => setTimeOff({ ...timeOff, date: event.target.value })} /></label><div className="form-columns"><label className="field">Das<input type="time" className="input" required value={timeOff.start} onChange={event => setTimeOff({ ...timeOff, start: event.target.value })} /></label><label className="field">Até<input type="time" className="input" required value={timeOff.end} onChange={event => setTimeOff({ ...timeOff, end: event.target.value })} /></label></div><label className="field">Motivo<input className="input" maxLength={200} required placeholder="Ex.: Pausa para almoço" value={timeOff.reason} onChange={event => setTimeOff({ ...timeOff, reason: event.target.value })} /></label></div><ErrorMessage message={error} /><button className="btn primary" style={{ marginTop: 16 }} disabled={busy} type="submit"><Plus size={16} />{busy ? 'Salvando…' : 'Adicionar bloqueio'}</button></form><div className="history-list" style={{ marginTop: 24 }}>{data.timeOff.filter(item => item.professionalId === availability?.id).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)).map(item => <div className="history-row" key={item.id}><div><strong>{item.reason}</strong><small className="muted">{readableDate(item.date)} · {item.start} – {item.end}</small></div><button className="btn ghost" disabled={busy} aria-label={`Remover bloqueio ${item.reason}`} onClick={() => void unblock(item.id)}><X size={17} /></button></div>)}</div></Modal>
  </>;
}

export function SettingsPage() {
  const { data, user, saveSettings, notify, isDemo } = useApp();
  const [settings, setSettings] = useState<BusinessSettings>({ ...data.settings, weekdays: [...data.settings.weekdays] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('business');
  const canEdit = isManager(user?.role);
  const publicUrl = `${window.location.origin}/agendar/${settings.slug}`;
  const update = <K extends keyof BusinessSettings>(key: K, value: BusinessSettings[K]) => setSettings(current => ({ ...current, [key]: value }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (tab === 'access') return;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(settings.slug)) { setError('O endereço deve conter apenas letras minúsculas, números e hífens.'); return; }
    if (settings.opening >= settings.closing) { setError('O encerramento deve ser depois da abertura.'); return; }
    if (!settings.weekdays.length) { setError('Selecione pelo menos um dia de atendimento.'); return; }
    if (!settings.name.trim() || settings.name.trim().length < 2) { setError('Informe o nome do estabelecimento.'); return; }
    setBusy(true); setError('');
    try { await saveSettings({ ...settings, name: settings.name.trim() }); notify('Configurações salvas com sucesso.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar as configurações.'); }
    finally { setBusy(false); }
  }
  async function copyUrl() {
    try { await navigator.clipboard.writeText(publicUrl); notify('Link de agendamento copiado.'); }
    catch { notify('Copie o endereço exibido abaixo para compartilhar.'); }
  }
  if (!canEdit) return <><Heading eyebrow="SEU ESTABELECIMENTO" title="Configurações" description="Os detalhes que fazem o negócio funcionar." /><div className="card"><Empty title="Acesso restrito à gestão" description="O proprietário ou administrador pode alterar as configurações do estabelecimento." /></div></>;
  return <><Heading eyebrow="DO SEU JEITO" title="Tudo no lugar" description="Cuide dos detalhes. O agendaJá cuida do seu tempo." />
    <div className="settings-layout"><nav className="settings-nav" aria-label="Seções de configurações">{[{ id: 'business', label: 'Estabelecimento', Icon: MapPin }, { id: 'hours', label: 'Horários e políticas', Icon: Clock3 }, { id: 'booking', label: 'Página de agendamento', Icon: CalendarDays }, { id: 'notifications', label: 'WhatsApp', Icon: Mail }, { id: 'access', label: 'Acesso e assinatura', Icon: ShieldCheck }].map(({ id: tabId, label, Icon }) => <button key={tabId} className={`settings-tab ${tab === tabId ? 'active' : ''}`} onClick={() => setTab(tabId)}><Icon size={18} />{label}</button>)}</nav>
      <form className="card settings-card" onSubmit={submit}>
        {tab === 'business' && <><div className="section-heading"><h2>Seu estabelecimento</h2><p className="muted">É assim que os clientes vão encontrar você.</p></div><label className="field">Segmento do negócio<select className="input" value={settings.industry??'other'} onChange={event=>update('industry',event.target.value)}>{industries.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label><BusinessLogo settings={settings} onChange={url => update('logoUrl', url)} /><div className="form-grid"><label className="field">Nome do estabelecimento<input required className="input" maxLength={100} value={settings.name} onChange={event => update('name', event.target.value)} /></label><div className="form-columns"><label className="field">Telefone<input type="tel" className="input" maxLength={25} value={settings.phone} onChange={event => update('phone', event.target.value)} /></label><label className="field">E-mail de contato<input type="email" className="input" maxLength={200} value={settings.email} onChange={event => update('email', event.target.value)} /></label></div><label className="field">Endereço<input className="input" maxLength={250} value={settings.address} onChange={event => update('address', event.target.value)} /></label></div></>}
        {tab === 'hours' && <><div className="section-heading"><h2>Tempo bem organizado</h2><p className="muted">Defina quando seus clientes podem ser atendidos.</p></div><div className="form-grid"><label className="field">Fuso horário<select className="input" value={settings.timezone} onChange={event => update('timezone', event.target.value)}>{['America/Fortaleza', 'America/Sao_Paulo', 'America/Manaus', 'America/Rio_Branco', 'America/Noronha', 'America/Belem', 'America/Cuiaba', 'America/Campo_Grande'].map(zone => <option key={zone} value={zone}>{zone.replace('America/', '').replaceAll('_', ' ')}</option>)}</select></label><fieldset className="field"><legend>Dias de atendimento</legend><div className="weekdays-picker">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => <button type="button" className={`day-choice ${settings.weekdays.includes(index) ? 'selected' : ''}`} aria-pressed={settings.weekdays.includes(index)} key={day} onClick={() => update('weekdays', settings.weekdays.includes(index) ? settings.weekdays.filter(value => value !== index) : [...settings.weekdays, index])}>{day}</button>)}</div></fieldset><div className="form-columns"><label className="field">Abertura<input className="input" type="time" required value={settings.opening} onChange={event => update('opening', event.target.value)} /></label><label className="field">Encerramento<input className="input" type="time" required value={settings.closing} onChange={event => update('closing', event.target.value)} /></label></div><div className="form-columns"><label className="field">Intervalo entre opções de horário<select className="input" value={settings.interval} onChange={event => update('interval', Number(event.target.value))}>{[5, 10, 15, 20, 30, 60].map(value => <option key={value} value={value}>{value} minutos</option>)}</select></label><label className="field">Antecedência para cancelar<select className="input" value={settings.cancellationHours} onChange={event => update('cancellationHours', Number(event.target.value))}>{[0, 1, 2, 4, 6, 12, 24, 48].map(value => <option key={value} value={value}>{value === 0 ? 'Até o início do atendimento' : `${value} horas`}</option>)}</select></label></div><p className="muted">Pausas e folgas individuais podem ser adicionadas na tela de profissionais.</p></div></>}
        {tab === 'booking' && <><div className="section-heading"><h2>Sua agenda de portas abertas</h2><p className="muted">Compartilhe o link e deixe os clientes escolherem o melhor horário.</p></div><div className="form-grid"><label className="field">Endereço da página pública<div className="slug-field"><span>/agendar/</span><input className="input" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} value={settings.slug} onChange={event => update('slug', event.target.value)} /></div><small className="muted">Use letras minúsculas, números e hífens. Salve antes de compartilhar um novo endereço.</small></label><div className="booking-link-box"><span className="eyebrow">SEU LINK DE AGENDAMENTO</span><p style={{ overflowWrap: 'anywhere' }}>{publicUrl}</p><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button type="button" className="btn secondary" onClick={() => void copyUrl()}><Copy size={15} />Copiar link</button><Link className="btn primary" to={`/agendar/${data.settings.slug}`} target="_blank" rel="noreferrer">Abrir página<ExternalLink size={15} /></Link></div></div></div></>}
        {tab === 'notifications' && <><div className="section-heading"><h2>Uma conversa faz a diferença</h2><p className="muted">Lembre seus clientes dos próximos cuidados.</p></div><div className="notice"><Mail size={21} /><div><strong>WhatsApp com envio manual</strong><p className="muted">Na agenda, abra um atendimento e escolha a opção de WhatsApp. A mensagem será preparada para você revisar e enviar pelo seu próprio aplicativo.</p></div></div><div className="feature-info"><div><ArrowUpRight size={20} /><strong>Você controla o envio</strong><p className="muted">Nenhuma mensagem é enviada automaticamente.</p></div><div><ArrowDownLeft size={20} /><strong>Sem integração paga no MVP</strong><p className="muted">Automações e lembretes programados ficam para uma integração futura.</p></div></div><label className="field">Telefone de contato do estabelecimento<input className="input" type="tel" maxLength={25} value={settings.phone} onChange={event => update('phone', event.target.value)} /></label></>}
        {tab === 'access' && <><div className="section-heading"><h2>Seu espaço de trabalho</h2><p className="muted">Informações da conta e controle de acesso.</p></div><div className="account-summary"><span className="avatar">{initials(user?.name ?? 'Usuário')}</span><div><strong>{user?.name}</strong><p className="muted">{user?.email}</p></div><span className="badge confirmed">{user?.role === 'owner' ? 'Proprietário' : 'Administrador'}</span></div><div className="notice"><ShieldCheck size={20} /><div><strong>{isDemo ? 'Ambiente de demonstração' : 'Conta conectada ao Supabase'}</strong><p className="muted">{isDemo ? 'Os dados deste ambiente são fictícios e ficam neste navegador. A autenticação real depende da configuração do Supabase.' : 'As permissões do estabelecimento são verificadas no banco. Alterações na equipe de acesso exigem a operação administrativa correspondente.'}</p></div></div><TeamAccess /><h3 style={{ marginTop: 28 }}>Assinatura</h3><p className="muted" style={{ marginTop: 8 }}>A cobrança recorrente está prevista para uma próxima etapa. Nenhuma cobrança ou assinatura está ativa nesta versão.</p></>}
        <ErrorMessage message={error} />{tab !== 'access' && <div className="settings-actions"><button className="btn primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}<Check size={17} /></button></div>}
      </form></div>
  </>;
}
