import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin, Scissors, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { z } from 'zod';
import { useApp } from '../lib/store';
import { availableSlots, today, money, dateLabel, businessNow } from '../lib/scheduling';
import type { Appointment, AppData, Customer, Professional } from '../lib/types';
import './booking.css';

const detailsSchema = z.object({ name: z.string().trim().min(3, 'Informe seu nome completo.').max(100), email: z.string().trim().email('Informe um e-mail válido.'), phone: z.string().refine(v => v.replace(/\D/g, '').length >= 10 && v.replace(/\D/g, '').length <= 13, 'Informe um telefone com DDD.'), consent: z.boolean().refine(v => v, 'Confirme a autorização para continuar.') });

/** Converts an establishment's wall-clock date/time into a UTC instant. */
export function bookingInstant(date: string, time: string, timezone: string) {
  const desired = Date.parse(`${date}T${time}:00Z`);
  let instant = desired;
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone:timezone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' });
  for (let i=0;i<3;i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
    const represented = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    instant += desired - represented;
  }
  return new Date(instant);
}

export function downloadBooking(appointment: Appointment, title: string, business: string, address: string, timezone: string) {
  const start = bookingInstant(appointment.date, appointment.time, timezone);
  const stamp = (d:Date)=> d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const escape = (s:string)=>s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const text = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//agendaJa//Agendamentos//PT-BR','BEGIN:VEVENT',`UID:${appointment.id}@agendaja`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(new Date(start.getTime()+appointment.duration*60000))}`,`SUMMARY:${escape(title+' • '+business)}`,`LOCATION:${escape(address)}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([text],{type:'text/calendar;charset=utf-8'}));
  const a=document.createElement('a'); a.href=url; a.download='agendaja-agendamento.ics'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function Booking() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const app = useApp();
  const {user,isDemo,notify} = app;
  const [publicData,setPublicData] = useState<AppData|null>(null);
  const [loading,setLoading] = useState(!isDemo);
  const [loadError,setLoadError] = useState('');
  const data = isDemo ? app.data : publicData;
  const existing = app.data.appointments.find(a=>a.id===params.get('reschedule'));
  const ownCustomer = user ? app.data.customers.find(c=>c.userId===user.id || (!!user.email && c.email===user.email)) : undefined;
  const ownCustomerIds = app.data.customers.filter(c=>!!user&&(c.userId===user.id||c.email===user.email)).map(c=>c.id);
  const canReschedule = !!existing && !!user && ownCustomerIds.includes(existing.customerId) && ['pending','confirmed'].includes(existing.status) && (!existing.businessSlug||existing.businessSlug===slug);
  const draft=useMemo(()=>{try{return JSON.parse(sessionStorage.getItem('agendaja-booking-'+slug)||'null') as {serviceId:string;professionalId:string;date:string;time:string;step:number}|null;}catch{return null;}},[slug]);
  const [step,setStep]=useState(canReschedule?2:Math.min(draft?.step||0,3));
  const [serviceId,setServiceId]=useState(canReschedule?existing?.serviceId||'':draft?.serviceId||'');
  const [professionalId,setProfessionalId]=useState(canReschedule?existing?.professionalId||'':draft?.professionalId||'');
  const [date,setDate]=useState(draft?.date&&draft.date>=today()?draft.date:today());
  const [time,setTime]=useState(draft?.time||'');
  const [slotList,setSlotList]=useState<string[]>([]);
  const [slotInstants,setSlotInstants]=useState<Record<string,string>>({});
  const [slotsLoading,setSlotsLoading]=useState(false);
  const [slotError,setSlotError]=useState('');
  const [name,setName]=useState(ownCustomer?.name || user?.name || '');
  const [email,setEmail]=useState(ownCustomer?.email || user?.email || '');
  const [phone,setPhone]=useState(ownCustomer?.phone || '');
  const [consent,setConsent]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [booked,setBooked]=useState<Appointment|null>(null);
  const [category,setCategory]=useState('Todos');

  useEffect(()=>{sessionStorage.setItem('agendaja-booking-'+slug,JSON.stringify({serviceId,professionalId,date,time,step}));},[slug,serviceId,professionalId,date,time,step]);
  useEffect(()=>{if(canReschedule&&existing){setServiceId(existing.serviceId);setProfessionalId(existing.professionalId);setStep(2);}},[existing?.id,canReschedule]);
  useEffect(()=>{if(user){setName(value=>value||ownCustomer?.name||user.name);setEmail(value=>value||user.email);setPhone(value=>value||ownCustomer?.phone||'');}},[user?.id,ownCustomer?.id]);

  useEffect(()=> {
    if(isDemo) return;
    let live=true;
    setLoading(true); setLoadError('');
    void import('../lib/supabase').then(async ({supabase})=>{
      if(!supabase) throw new Error('A conexão com o estabelecimento ainda não foi configurada.');
      const result=await supabase.rpc('get_public_business',{p_slug:slug});
      if(result.error) throw result.error;
      if(!result.data) throw new Error('Estabelecimento não encontrado.');
      const raw=result.data;
      const organization=raw.organization;
      const mapped:AppData={services:raw.services,professionals:(raw.professionals as Professional[]).map(p=>({...p,email:''})),customers:[],appointments:[],events:[],timeOff:[],settings:{name:organization.name,slug:organization.slug,phone:organization.phone||'',email:'',address:organization.address||'',timezone:organization.timezone,logoUrl:organization.logo_url??undefined,cancellationHours:organization.cancellation_hours,interval:organization.slot_interval,opening:'00:00',closing:'23:59',weekdays:[0,1,2,3,4,5,6]}};
      if(live){setPublicData(mapped);if(!draft?.date)setDate(businessNow(mapped.settings.timezone).slice(0,10));}
    }).catch((e:unknown)=> {if(live) setLoadError(e instanceof Error?e.message:'Não foi possível carregar este estabelecimento.');}).finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false;};
  },[isDemo,slug]);

  const service=data?.services.find(s=>s.id===serviceId);
  const professional=data?.professionals.find(p=>p.id===professionalId);
  const services=data?.services.filter(s=>s.active)||[];
  const categories=['Todos',...new Set(services.map(s=>s.category))];
  const people=data?.professionals.filter(p=>p.active && p.serviceIds.includes(serviceId))||[];
  const dateStrip=useMemo(()=>Array.from({length:7},(_,i)=>format(addDays(parseISO(date),i),'yyyy-MM-dd')),[date]);

  useEffect(()=>{
    if(!data || !serviceId || !professionalId || step!==2) return;
    setSlotError('');
    if(isDemo) {
      const withoutOriginal=canReschedule ? {...data, appointments:data.appointments.filter(a=>a.id!==existing?.id)} : data;
      setSlotList(availableSlots(withoutOriginal,date,professionalId,serviceId));
      return;
    }
    let live=true; setSlotsLoading(true);
    void import('../lib/supabase').then(async({supabase})=>{
      if(!supabase) throw new Error('Conexão indisponível.');
      const result=await supabase.rpc('get_public_availability',{p_slug:slug,p_service_id:serviceId,p_professional_id:professionalId,p_date:date});
      if(result.error) throw result.error;
      const rows=(result.data??[]) as {starts_at:string;ends_at:string}[];
      const instants=Object.fromEntries(rows.map(row=>[new Intl.DateTimeFormat('pt-BR',{timeZone:data.settings.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(row.starts_at)),row.starts_at]));
      if(live){setSlotInstants(instants);setSlotList(Object.keys(instants));}
    }).catch(()=>{if(live){setSlotList([]);setSlotError('Não foi possível consultar os horários. Tente outra data.');}}).finally(()=>{if(live)setSlotsLoading(false);});
    return ()=>{live=false;};
  },[data,date,professionalId,serviceId,step,isDemo,slug,canReschedule,existing?.id]);

  function next(){
    setError('');
    if(step===3){
      const parsed=detailsSchema.safeParse({name,email,phone,consent});
      if(!parsed.success){setError(parsed.error.issues[0].message);return;}
    }
    setStep(s=>s+1); window.scrollTo({top:0,behavior:'smooth'});
  }

  async function confirm(){
    if(!data || !service || !professional || !time) return;
    setBusy(true);setError('');
    try {
      let result:Appointment;
      if(isDemo){
        const cleanData=canReschedule?{...data,appointments:data.appointments.filter(a=>a.id!==existing?.id)}:data;
        if(!availableSlots(cleanData,date,professionalId,serviceId).includes(time))throw new Error('Esse horário acabou de ficar indisponível. Escolha outro.');
        if(canReschedule && existing){
          if(bookingInstant(existing.date,existing.time,data.settings.timezone).getTime()-Date.now()<data.settings.cancellationHours*3600000)throw new Error('O prazo para reagendar terminou. Entre em contato com o estabelecimento.');
          await app.updateAppointment(existing.id,{date,time});
          result={...existing,date,time,professionalId,serviceId,duration:service.duration,price:service.price};
        }else{
          const customer:Customer={id:ownCustomer?.id||crypto.randomUUID(),name:name.trim(),email:email.trim(),phone,notes:ownCustomer?.notes||'',userId:user?.id};
          await app.saveCustomer(customer);
          result=await app.bookAppointment({customerId:customer.id,professionalId,serviceId,date,time,duration:service.duration,price:service.price,notes:''});
        }
      }else{
        const {supabase}=await import('../lib/supabase');
        if(!supabase) throw new Error('Conexão indisponível.');
        if(!user)throw new Error('Entre na sua conta e confirme seu e-mail para reservar este horário.');
        const startsAt=slotInstants[time]||bookingInstant(date,time,data.settings.timezone).toISOString();
        const response=canReschedule&&existing?await supabase.rpc('reschedule_my_appointment',{p_appointment_id:existing.id,p_starts_at:startsAt}):await supabase.rpc('book_public_appointment',{p_slug:slug,p_service_id:serviceId,p_professional_id:professionalId,p_starts_at:startsAt,p_customer_name:name.trim(),p_customer_email:email.trim(),p_customer_phone:phone});
        if(response.error) throw new Error(response.error.message);
        result={id:response.data.id,status:response.data.status,customerId:ownCustomer?.id||'',date,time,duration:service.duration,price:service.price,serviceId,professionalId,paid:false,notes:'',createdAt:new Date().toISOString()};
        app.reload();
      }
      setBooked(result);sessionStorage.removeItem('agendaja-booking-'+slug);notify(canReschedule?'Agendamento atualizado.':'Seu horário foi reservado.');
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível reservar. Tente novamente.');}
    finally{setBusy(false);}
  }

  if(loading)return <div className="booking-loading"><div className="booking-wordmark">agenda<span>Já</span><i/></div><div className="booking-loader"/><p>Preparando seu próximo momento de cuidado…</p></div>;
  if(loadError || !data || (isDemo && slug!==data.settings.slug))return <div className="booking-loading"><Scissors size={40}/><h1>Não encontramos este espaço</h1><p className="muted">{loadError||'Confira o link do estabelecimento e tente novamente.'}</p><Link className="btn primary" to="/">Voltar ao início</Link></div>;

  const stepLabels=['Serviço','Profissional','Horário','Seus dados','Confirmar'];
  const loginPath=`/login/cliente?next=${encodeURIComponent('/agendar/'+slug+(params.get('reschedule')?'?reschedule='+params.get('reschedule'):''))}`;
  const businessToday=businessNow(data.settings.timezone).slice(0,10);
  return <div className="booking-page">
    <header className="booking-header"><Link to="/" className="booking-wordmark">agenda<span>Já</span><i/></Link><span className="booking-header-note">Seu tempo bem cuidado.</span><Link className="booking-login" to={user?.role==='customer'?'/cliente':loginPath}><UserRound size={16}/>{user?.role==='customer'?'Minha conta':'Já sou cliente'}<ArrowRight size={15}/></Link></header>
    {isDemo&&<div className="booking-demo"><Sparkles size={14}/><span>Experiência de demonstração · Os agendamentos ficam apenas neste navegador.</span></div>}
    <main className="booking-main">
      <section className="booking-business"><div className="booking-business-logo">{data.settings.logoUrl?<img src={data.settings.logoUrl} alt={data.settings.name} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"inherit"}}/>:<Scissors size={27}/>}</div><div><div className="eyebrow">UM TEMPO SÓ SEU</div><h1>{data.settings.name}</h1><p><MapPin size={14}/>{data.settings.address||'Atendimento com hora marcada'}</p></div><span className="booking-business-tag"><ShieldCheck size={15}/>Agendamento online</span></section>
      {booked?<section className="booking-success card"><div className="booking-success-icon"><Check size={34}/></div><div className="eyebrow">TUDO CERTO POR AQUI</div><h2>{canReschedule?'Seu novo horário está reservado.':'Seu próximo cuidado já tem hora.'}</h2><p className="muted">{name.split(' ')[0]}, esperamos você em {data.settings.name}.</p><div className="booking-success-details"><strong>{service?.name}</strong><span>com {professional?.name}</span><div><CalendarDays size={17}/>{dateLabel(booked.date)}<span>às {booked.time}</span></div><small>{data.settings.address}</small></div><div className="booking-success-actions"><button className="btn primary" onClick={()=>downloadBooking(booked,service?.name||'Atendimento',data.settings.name,data.settings.address,data.settings.timezone)}><CalendarDays size={16}/>Adicionar ao calendário</button><Link className="btn secondary" to={user?'/cliente':'/login/cliente'}>Meus agendamentos<ArrowRight size={16}/></Link></div><p className="booking-policy">Precisa mudar os planos? Cancelamentos e reagendamentos até {data.settings.cancellationHours}h antes do atendimento.</p></section>:
      <div className="booking-layout"><section className="booking-workspace"><nav className="booking-steps" aria-label="Etapas do agendamento">{stepLabels.map((label,i)=><button key={label} onClick={()=>{if(i<step){setStep(i);setError('');}}} disabled={i>step||(canReschedule&&i<2)} aria-current={step===i?'step':undefined} className={`${i===step?'current':''} ${i<step?'done':''}`}><span>{i<step?<Check size={13}/>:i+1}</span><b>{label}</b></button>)}</nav>
      <div className="booking-step-content" key={step}>
        <div className="booking-step-heading"><span className="eyebrow">PASSO 0{step+1} DE 05</span><h2>{['O que vamos cuidar hoje?','Escolha quem cuida de você.','Encontre seu melhor horário.','Vamos nos conhecer?','Só falta confirmar.'][step]}</h2><p className="muted">{['Escolha o serviço para o seu momento.','Pessoas que fazem a diferença em cada detalhe.','Todos os horários no fuso do estabelecimento.','Seus dados serão usados para cuidar do seu agendamento.','Confira os detalhes e reserve seu momento.'][step]}</p></div>
        {step===0&&<><div className="booking-categories">{categories.map(c=><button className={`chip ${category===c?'selected':''}`} key={c} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="booking-services">{services.filter(s=>category==='Todos'||s.category===category).map(s=><button key={s.id} className={`booking-service ${s.id===serviceId?'selected':''}`} onClick={()=>{setServiceId(s.id);setProfessionalId('');setTime('');}}><span className="booking-service-icon"><Scissors size={20}/></span><span className="booking-service-info"><strong>{s.name}</strong><small>{s.description}</small><span><Clock3 size={13}/>{s.duration} min</span></span><span className="booking-service-price">{money(s.price)}<i>{s.id===serviceId?<Check size={13}/>:null}</i></span></button>)}</div>{services.length===0&&<div className="empty-state"><Scissors/><h3>O catálogo está sendo preparado</h3><p>Entre em contato com o estabelecimento para agendar.</p></div>}</>}
        {step===1&&<div className="booking-professionals">{people.map(p=><button className={`booking-person ${professionalId===p.id?'selected':''}`} key={p.id} onClick={()=>{setProfessionalId(p.id);setTime('');}}><span className="booking-person-avatar" style={{background:p.color,color:'#365242'}}>{p.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><strong>{p.name}</strong><span>{p.title}</span><i>{professionalId===p.id?<Check size={15}/>:<ArrowRight size={15}/>}</i></button>)}{people.length===0&&<div className="empty-state"><UserRound/><h3>Nenhum profissional disponível</h3><p>Escolha outro serviço ou fale com o estabelecimento.</p></div>}</div>}
        {step===2&&<><div className="booking-date-tools"><strong>{format(parseISO(date),'MMMM yyyy',{locale:ptBR})}</strong><label className="booking-date-picker">Escolher data<input aria-label="Escolher data do agendamento" type="date" min={businessToday} value={date} onChange={e=>{if(e.target.value>=businessToday){setDate(e.target.value);setTime('');}}}/></label><button className="btn ghost" aria-label="Semana anterior" disabled={date<=businessToday} onClick={()=>{const prev=format(addDays(parseISO(date),-7),'yyyy-MM-dd');setDate(prev<businessToday?businessToday:prev);setTime('');}}><ChevronLeft size={17}/></button><button className="btn ghost" aria-label="Próxima semana" onClick={()=>{setDate(format(addDays(parseISO(date),7),'yyyy-MM-dd'));setTime('');}}><ChevronRight size={17}/></button></div><div className="booking-dates">{dateStrip.map(d=><button className={d===date?'selected':''} onClick={()=>{setDate(d);setTime('');}} key={d}><span>{format(parseISO(d),'EEE',{locale:ptBR}).replace('.','')}</span><strong>{format(parseISO(d),'dd')}</strong><i/></button>)}</div><div className="booking-slots-label"><Clock3 size={15}/><span>Horários disponíveis</span><small>{service?.duration} min de cuidado</small></div>{slotsLoading?<p className="muted" role="status">Consultando os horários…</p>:slotError?<p className="booking-error" role="alert">{slotError}</p>:<div className="booking-slots">{slotList.map(t=><button key={t} className={time===t?'selected':''} onClick={()=>setTime(t)}>{t}{time===t&&<Check size={14}/>}</button>)}</div>}{!slotsLoading&&!slotError&&slotList.length===0&&<div className="empty-state"><CalendarDays/><h3>Uma pausa na agenda</h3><p>Não há horários livres nesta data. Experimente outro dia.</p></div>}<div className="booking-note"><ShieldCheck size={17}/><span>Seu horário é reservado somente ao confirmar o agendamento.</span></div></>}
        {step===3&&(!isDemo&&!user?<div className="booking-auth card"><ShieldCheck size={27}/><h3>Seu horário, na sua conta.</h3><p className="muted">Entre ou crie uma conta de cliente para confirmar sua reserva. Seus dados ficam protegidos e você acompanha tudo em um só lugar.</p><Link className="btn primary" to={loginPath}>Entrar ou criar minha conta<ArrowRight size={16}/></Link><small>Sua escolha de serviço e horário será mantida.</small></div>:<form id="booking-details" onSubmit={e=>{e.preventDefault();next();}} className="booking-details"><label className="field">Nome completo<input className="input" autoComplete="name" placeholder="Como podemos chamar você?" value={name} maxLength={100} onChange={e=>setName(e.target.value)} required minLength={3}/></label><label className="field">E-mail<input className="input" autoComplete="email" type="email" placeholder="voce@exemplo.com" value={email} readOnly={!isDemo&&!!user} onChange={e=>setEmail(e.target.value)} required/></label><label className="field">Celular com DDD<input className="input" type="tel" autoComplete="tel" placeholder="(85) 99999-9999" value={phone} maxLength={20} onChange={e=>setPhone(e.target.value)} required/></label><label className="booking-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Autorizo o uso dos meus dados para realizar e gerenciar este agendamento. Eles serão compartilhados com {data.settings.name}.</span></label></form>)}
        {step===4&&<><div className="booking-review"><div><span className="booking-review-icon"><Scissors size={20}/></span><span><small>SEU SERVIÇO</small><strong>{service?.name}</strong><p>com {professional?.name} · {service?.duration} min</p></span></div><div><span className="booking-review-icon"><CalendarDays size={20}/></span><span><small>SEU MOMENTO</small><strong>{dateLabel(date)}, às {time}</strong><p>{data.settings.address}</p></span></div><div><span className="booking-review-icon"><UserRound size={20}/></span><span><small>SEUS DADOS</small><strong>{name}</strong><p>{email} · {phone}</p></span></div><div className="booking-review-total"><span>Total do atendimento</span><strong>{money(service?.price||0)}</strong></div></div><div className="booking-note"><ShieldCheck size={19}/><span>Pagamento no estabelecimento. Cancele ou reagende com pelo menos {data.settings.cancellationHours}h de antecedência.</span></div></>}
        {error&&<p role="alert" className="booking-error">{error}</p>}
        <div className="booking-navigation">{step>(canReschedule?2:0)?<button className="btn ghost" onClick={()=>{setStep(s=>s-1);setError('');}} disabled={busy}><ArrowLeft size={16}/>Voltar</button>:<span className="booking-secure"><ShieldCheck size={14}/>Simples e seguro</span>}{step===4?<button className="btn primary" disabled={busy} onClick={()=>void confirm()}>{busy?'Reservando…':canReschedule?'Confirmar novo horário':'Confirmar agendamento'}{!busy&&<Check size={17}/>}</button>:<button className="btn primary" type={step===3?'submit':'button'} form={step===3?'booking-details':undefined} disabled={(step===0&&!serviceId)||(step===1&&!professionalId)||(step===2&&!time)||(step===3&&!isDemo&&!user)} onClick={step===3?undefined:next}>Continuar<ArrowRight size={16}/></button>}</div>
      </div></section><aside className="booking-summary"><div className="eyebrow">SEU MOMENTO DE CUIDADO</div><h3>Um espaço na agenda.<br/>Um cuidado com você.</h3><div className="booking-summary-art"><div/><Scissors size={44} strokeWidth={1}/><span>Reserve.<br/>Relaxe.<br/><i>Renove.</i></span></div><div className="booking-summary-items">{service?<><div><span>Serviço</span><strong>{service.name}</strong></div><div><span>Duração</span><strong>{service.duration} min</strong></div>{professional&&<div><span>Profissional</span><strong>{professional.name}</strong></div>}{time&&<div><span>Quando</span><strong>{format(parseISO(date),'dd/MM')} às {time}</strong></div>}<div className="booking-summary-total"><span>Total</span><strong>{money(service.price)}</strong></div></>:<p>Escolha um serviço para começar. Os detalhes do seu agendamento aparecerão aqui.</p>}</div><p className="booking-summary-footer"><CheckCircle2 size={15}/>Sem pagamento antecipado</p></aside></div>}
    </main><footer className="booking-footer"><span>Feito para cuidar do seu tempo.</span><span>Agendamento por <Link to="/" className="booking-wordmark">agenda<span>Já</span></Link></span></footer>
  </div>;
}
