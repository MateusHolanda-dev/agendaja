import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, ChevronDown, Clock3, LogOut, MapPin, MessageCircle, Pencil, Plus, BriefcaseBusiness, ShieldCheck, UserRound } from 'lucide-react';
import { useApp } from '../lib/store';
import { dateLabel, money } from '../lib/scheduling';
import { statusLabels } from '../lib/types';
import type { Appointment } from '../lib/types';
import { bookingInstant, downloadBooking } from './Booking';
import { Modal } from '../components/ui';
import './booking.css';

export default function CustomerPortal(){
  const {data,user,isDemo,updateAppointment,saveCustomer,notify,logout}=useApp();
  const navigate=useNavigate();
  const [tab,setTab]=useState<'upcoming'|'history'>('upcoming');
  const [cancelId,setCancelId]=useState<string|null>(null);
  const [edit,setEdit]=useState(false);
  const customer=data.customers.find(c=>c.userId===user?.id || (!!user?.email && c.email===user.email));
  const [name,setName]=useState(customer?.name||user?.name||'');
  const [phone,setPhone]=useState(customer?.phone||'');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [expanded,setExpanded]=useState<string|null>(null);
  const [findBusiness,setFindBusiness]=useState(false);
  const [businessLink,setBusinessLink]=useState('');
  const ownedIds=data.customers.filter(c=>!!user&&(c.userId===user.id||c.email===user.email)).map(c=>c.id);
  const appointments=data.appointments.filter(a=>ownedIds.includes(a.customerId));
  const upcoming=appointments.filter(a=>['pending','confirmed'].includes(a.status)&&bookingInstant(a.date,a.time,a.timezone||data.settings.timezone).getTime()+a.duration*60000>Date.now()).sort((a,b)=>bookingInstant(a.date,a.time,a.timezone||data.settings.timezone).getTime()-bookingInstant(b.date,b.time,b.timezone||data.settings.timezone).getTime());
  const history=appointments.filter(a=>!upcoming.some(b=>b.id===a.id)).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  const list=tab==='upcoming'?upcoming:history;
  const next=upcoming[0];
  const canChange=(a:Appointment)=>['pending','confirmed'].includes(a.status)&&bookingInstant(a.date,a.time,a.timezone||data.settings.timezone).getTime()-Date.now()>=(a.cancellationHours??data.settings.cancellationHours)*3600000;
  const whatsapp=data.settings.phone.replace(/\D/g,'');

  function newBooking(){if(data.settings.slug)navigate('/agendar/'+data.settings.slug);else{setError('');setFindBusiness(true);}}
  function openBusiness(e:React.FormEvent){e.preventDefault();const slug=businessLink.trim().split('/agendar/').pop()?.split(/[?#]/)[0].replace(/\/$/,'')||'';if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)){setError('Informe o link ou o identificador do estabelecimento.');return;}navigate('/agendar/'+slug);}

  async function cancel(){
    const appointment=appointments.find(a=>a.id===cancelId);
    if(!appointment||!canChange(appointment)){setError('O prazo para cancelar terminou. Fale com o estabelecimento.');return;}
    setBusy(true);setError('');
    try{await updateAppointment(appointment.id,{status:'cancelled'});setCancelId(null);notify('Agendamento cancelado.');}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível cancelar. Tente novamente.');}
    finally{setBusy(false);}
  }
  async function saveProfile(e:React.FormEvent){
    e.preventDefault(); if(!user)return;
    if(name.trim().length<3||phone.replace(/\D/g,'').length<10){setError('Informe seu nome e um celular com DDD.');return;}
    setBusy(true);setError('');
    try{await saveCustomer({id:customer?.id||crypto.randomUUID(),name:name.trim(),phone,email:customer?.email||user.email,notes:customer?.notes||'',userId:user.id});setEdit(false);notify('Seus dados foram atualizados.');}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.');}
    finally{setBusy(false);}
  }

  if(!user)return <div className="booking-loading"><UserRound size={40}/><h1>Seus agendamentos</h1><p>Entre na sua conta para acompanhar seus agendamentos.</p><Link className="btn primary" to="/login/cliente">Entrar na minha conta<ArrowRight size={16}/></Link></div>;
  return <div className="customer-page"><header className="booking-header"><Link to="/" className="booking-wordmark">agenda<span>Já</span><i/></Link><span className="booking-header-note">Seus agendamentos.</span><div className="customer-header-actions"><span className="customer-user-avatar">{(customer?.name||user.name).slice(0,1)}</span><span>{(customer?.name||user.name).split(' ')[0]}</span><button className="btn ghost" title="Sair da conta" aria-label="Sair da conta" onClick={()=>void logout()}><LogOut size={17}/></button></div></header>
  {isDemo&&<div className="booking-demo"><ShieldCheck size={14}/>Área do cliente em demonstração · Dados salvos apenas neste navegador.</div>}
  <main className="customer-main"><div className="customer-greeting"><div><span className="eyebrow">BEM-VINDO AO SEU ESPAÇO</span><h1>Olá, {(customer?.name||user.name).split(' ')[0]}<span>.</span></h1><p className="muted">Organize seus próximos compromissos por aqui.</p></div><button className="btn primary" onClick={newBooking}><Plus size={17}/>Novo agendamento</button></div>
  <div className="customer-layout"><div className="customer-primary">
  {next?<section className="customer-next"><div className="customer-next-top"><span className="eyebrow">SEU PRÓXIMO ENCONTRO</span><span className={`badge ${next.status}`}>{statusLabels[next.status]}</span></div><h2>{data.services.find(s=>s.id===next.serviceId)?.name||'Atendimento'}</h2><p>com {data.professionals.find(p=>p.id===next.professionalId)?.name||'seu profissional'}</p><div className="customer-next-time"><CalendarDays size={21}/><span>{dateLabel(next.date)}</span><i/><Clock3 size={19}/><strong>{next.time}</strong></div><div className="customer-next-bottom"><span><MapPin size={15}/>{next.businessName||data.settings.name}</span><button onClick={()=>downloadBooking(next,data.services.find(s=>s.id===next.serviceId)?.name||'Atendimento',next.businessName||data.settings.name,data.settings.address,next.timezone||data.settings.timezone)}>Adicionar ao calendário<ArrowRight size={15}/></button></div></section>:<section className="customer-next customer-next-empty"><BriefcaseBusiness size={30}/><span className="eyebrow">SEU TEMPO MERECE CUIDADO</span><h2>Que tal reservar<br/>um momento para você?</h2><p>Escolha o serviço e encontre um horário que combina com seu dia.</p><button className="btn" onClick={newBooking}>Encontrar meu horário<ArrowRight size={16}/></button></section>}
  <section className="customer-appointments card"><div className="customer-section-heading"><h2>Meus agendamentos</h2><span className="customer-count">{appointments.length}</span></div><div className="customer-tabs" role="tablist" aria-label="Filtrar agendamentos"><button role="tab" aria-selected={tab==='upcoming'} className={tab==='upcoming'?'active':''} onClick={()=>setTab('upcoming')}>Próximos<span>{upcoming.length}</span></button><button role="tab" aria-selected={tab==='history'} className={tab==='history'?'active':''} onClick={()=>setTab('history')}>Histórico<span>{history.length}</span></button></div>
  {list.length===0?<div className="empty-state"><CalendarDays size={28}/><h3>{tab==='upcoming'?'Sua agenda está livre':'Seu histórico começa aqui'}</h3><p>{tab==='upcoming'?'Reserve um horário e ele aparecerá neste espaço.':'Seus atendimentos anteriores aparecerão aqui.'}</p>{tab==='upcoming'&&<button className="btn secondary" onClick={newBooking}>Agendar um serviço<ArrowRight size={15}/></button>}</div>:list.map(a=>{const service=data.services.find(s=>s.id===a.serviceId);const professional=data.professionals.find(p=>p.id===a.professionalId);return <article className="customer-appointment" key={a.id}><div className="customer-appointment-main"><div className="customer-appointment-date"><strong>{a.date.slice(-2)}</strong><span>{new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(a.date+'T12:00:00')).replace('.','')}</span></div><div className="customer-appointment-info"><h3>{service?.name||'Atendimento'}</h3><p>{professional?.name} <span>·</span> {a.time} <span>·</span> {a.duration} min</p></div><div className="customer-appointment-status"><span className={`badge ${a.status}`}>{statusLabels[a.status]}</span><strong>{money(a.price)}</strong></div><button className="btn ghost" aria-label={`Ver detalhes de ${service?.name||'atendimento'}`} aria-expanded={expanded===a.id} onClick={()=>setExpanded(expanded===a.id?null:a.id)}><ChevronDown size={18} style={{transform:expanded===a.id?'rotate(180deg)':undefined}}/></button></div>{expanded===a.id&&<div className="customer-appointment-expanded"><p><MapPin size={14}/>{a.businessName||data.settings.name}</p><div className="customer-appointment-buttons">{canChange(a)?<><Link className="btn secondary" to={`/agendar/${a.businessSlug||data.settings.slug}?reschedule=${a.id}`}><Pencil size={14}/>Reagendar</Link><button className="btn ghost customer-danger" onClick={()=>{setCancelId(a.id);setError('');}}>Cancelar agendamento</button></>:['pending','confirmed'].includes(a.status)?<p className="muted">Para alterar este horário, fale com o estabelecimento.</p>:<Link className="btn secondary" to={`/agendar/${a.businessSlug||data.settings.slug}`}>Agendar novamente<ArrowRight size={14}/></Link>}</div></div>}</article>;})}</section>
  </div><aside className="customer-aside"><section className="card customer-profile"><div className="customer-section-heading"><h2>Meus dados</h2><button className="btn ghost" aria-label="Editar meus dados" onClick={()=>{setName(customer?.name||user.name);setPhone(customer?.phone||'');setError('');setEdit(true);}}><Pencil size={16}/></button></div><div className="customer-profile-avatar">{(customer?.name||user.name).split(' ').map(n=>n[0]).slice(0,2).join('')}</div><strong>{customer?.name||user.name}</strong><p>{customer?.email||user.email}</p><span>{customer?.phone||'Adicione seu celular'}</span><div className="customer-profile-note"><ShieldCheck size={15}/><span>Seus dados são usados para gerenciar seus atendimentos.</span></div></section><section className="customer-help"><span className="eyebrow">PODEMOS AJUDAR?</span><h3>Uma conversa<br/>resolve.</h3><p>Fale diretamente com o estabelecimento para tirar suas dúvidas.</p>{whatsapp?<a className="btn secondary" target="_blank" rel="noreferrer" href={`https://wa.me/${whatsapp.startsWith('55')?whatsapp:'55'+whatsapp}?text=${encodeURIComponent('Olá! Gostaria de falar sobre meu agendamento pelo agendaJá.')}`}><MessageCircle size={16}/>Conversar no WhatsApp</a>:<p className="muted">{data.settings.email||'Consulte os contatos do estabelecimento.'}</p>}</section></aside></div></main>
  <footer className="booking-footer"><span>Seu tempo bem cuidado.</span><span>Feito com <Link className="booking-wordmark" to="/">agenda<span>Já</span></Link></span></footer>
  <Modal open={!!cancelId} onClose={()=>{if(!busy)setCancelId(null);}} title="Cancelar este momento?"><div className="customer-modal-inner"><span className="customer-modal-icon"><CalendarDays size={25}/></span><p className="muted">O horário será liberado para outra pessoa. Você poderá fazer um novo agendamento quando quiser.</p>{error&&<p className="booking-error" role="alert">{error}</p>}<div className="customer-modal-actions"><button className="btn secondary" onClick={()=>setCancelId(null)} disabled={busy}>Manter agendamento</button><button className="btn primary" onClick={()=>void cancel()} disabled={busy}>{busy?'Cancelando…':'Sim, cancelar'}</button></div></div></Modal>
  <Modal open={edit} onClose={()=>{if(!busy)setEdit(false);}} title="Seus dados, atualizados."><div className="customer-modal-inner"><p className="muted">Assim o estabelecimento consegue falar com você.</p><form className="booking-details" onSubmit={e=>void saveProfile(e)}><label className="field">Nome completo<input className="input" autoFocus required minLength={3} maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label><label className="field">Celular com DDD<input className="input" required type="tel" maxLength={20} autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label><label className="field">E-mail<input className="input" readOnly value={user.email}/><small className="muted">O e-mail identifica sua conta.</small></label>{error&&<p className="booking-error" role="alert">{error}</p>}<button className="btn primary" disabled={busy} type="submit">{busy?'Salvando…':'Salvar alterações'}<Check size={16}/></button></form></div></Modal>
  <Modal open={findBusiness} onClose={()=>setFindBusiness(false)} title="Onde você quer agendar?"><div className="customer-modal-inner"><span className="customer-modal-icon"><BriefcaseBusiness size={25}/></span><p className="muted">Informe o link de agendamento compartilhado pelo estabelecimento ou o identificador dele.</p><form className="booking-details" onSubmit={openBusiness}><label className="field">Link ou identificador<input className="input" autoFocus required placeholder="Ex.: studio-aurora" value={businessLink} onChange={e=>setBusinessLink(e.target.value)}/></label>{error&&<p className="booking-error" role="alert">{error}</p>}<button className="btn primary" type="submit">Ver serviços e horários<ArrowRight size={16}/></button></form></div></Modal>
  </div>;
}
