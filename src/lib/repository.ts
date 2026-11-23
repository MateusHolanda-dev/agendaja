import { supabase } from './supabase';
import type { AppData, Appointment, BusinessSettings, Customer, Professional, Service, SessionUser, TimeOff } from './types';
type Row=Record<string,any>;
function check(error:{message:string}|null){if(error)throw new Error(error.message);}
export function localParts(iso:string,tz:string){const str=new Intl.DateTimeFormat('sv-SE',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso));return {date:str.slice(0,10),time:str.slice(11,16)};}
export function zonedISO(date:string,time:string,tz:string){const desired=Date.parse(`${date}T${time}:00Z`);if(!Number.isFinite(desired))throw new Error('Data ou horário inválido.');let t=desired;for(let i=0;i<3;i++){const p=localParts(new Date(t).toISOString(),tz);t+=desired-Date.parse(`${p.date}T${p.time}:00Z`);}const iso=new Date(t).toISOString(),roundTrip=localParts(iso,tz);if(roundTrip.date!==date||roundTrip.time!==time)throw new Error('Esse horário não existe no fuso do estabelecimento. Escolha outro horário.');return iso;}
function mapAppointment(a:Row,tz:string):Appointment{return {id:a.id,customerId:a.customer_id,professionalId:a.professional_id,serviceId:a.service_id,...localParts(a.starts_at,tz),duration:a.duration,price:Number(a.price),status:a.status,paid:a.paid,notes:a.notes??'',createdAt:a.created_at,businessName:a.business_name,businessSlug:a.business_slug,timezone:tz,cancellationHours:a.cancellation_hours};}
export async function loadRemote(user:SessionUser):Promise<AppData>{
 if(!supabase)throw new Error('Supabase não configurado.');
 const defaults:BusinessSettings={name:'Seus estabelecimentos',slug:'',phone:'',email:'',address:'',timezone:'America/Fortaleza',opening:'09:00',closing:'18:00',weekdays:[1,2,3,4,5,6],cancellationHours:2,interval:30};
 if(user.role==='customer'){
  const {data:rows,error}=await supabase.rpc('get_my_appointments');check(error);const records=(rows??[]) as Row[];
  const {data:profile,error:pe}=await supabase.from('profiles').select('name,email,phone').eq('id',user.id).single();check(pe);
  const appointments=records.map(a=>mapAppointment(a,a.timezone));const ids=[...new Set(records.map(a=>a.customer_id))];
  return {settings:{...defaults,name:records[0]?.business_name??'Seus estabelecimentos',slug:records[0]?.business_slug??'',timezone:records[0]?.timezone??defaults.timezone,cancellationHours:records[0]?.cancellation_hours??2},appointments,customers:(ids.length?ids:[user.id]).map(id=>({id,name:profile?.name??user.name,email:user.email,phone:profile?.phone??'',notes:'',userId:user.id})),services:[...new Map(records.map(a=>[a.service_id,{id:a.service_id,name:a.service_name,description:'',category:'',duration:a.duration,price:Number(a.price),active:true}])).values()],professionals:[...new Map(records.map(a=>[a.professional_id,{id:a.professional_id,name:a.professional_name,title:'',email:'',color:'#d8e9df',serviceIds:records.filter(x=>x.professional_id===a.professional_id).map(x=>x.service_id),active:true}])).values()],timeOff:[],events:[]};
 }
 if(!user.tenantId)throw new Error('Sua conta ainda não está vinculada a um estabelecimento.');
 const tables=['organizations','services','professionals','professional_services','customers','appointments','business_hours','time_off','appointment_events','professional_availability'];
 const result=await Promise.all(tables.map(t=>supabase!.from(t).select('*').eq(t==='organizations'?'id':'tenant_id',user.tenantId!)));result.forEach(r=>check(r.error));
 const [org,services,professionals,links,customers,appointments,hours,off,events,availability]=result.map(r=>(r.data??[]) as Row[]);const o=org[0];if(!o)throw new Error('Estabelecimento não encontrado.');
 return {settings:{name:o.name,slug:o.slug,phone:o.phone,email:o.email,address:o.address,timezone:o.timezone,industry:o.industry,logoUrl:o.logo_url??undefined,opening:hours[0]?.starts_at?.slice(0,5)??'09:00',closing:hours[0]?.ends_at?.slice(0,5)??'18:00',weekdays:[...new Set(hours.map(h=>h.weekday))],cancellationHours:o.cancellation_hours,interval:o.slot_interval},services:services.map(s=>({...s,price:Number(s.price)} as Service)),professionals:professionals.map(p=>({...p,availability:availability.filter(a=>a.professional_id===p.id).map(a=>({weekday:a.weekday,start:a.starts_at.slice(0,5),end:a.ends_at.slice(0,5)})),serviceIds:links.filter(l=>l.professional_id===p.id).map(l=>l.service_id)} as Professional)),customers:customers.map(c=>({...c,userId:c.user_id} as Customer)),appointments:appointments.map(a=>mapAppointment(a,o.timezone)),timeOff:off.map(t=>({id:t.id,professionalId:t.professional_id,...localParts(t.starts_at,o.timezone),start:localParts(t.starts_at,o.timezone).time,end:localParts(t.ends_at,o.timezone).time,reason:t.reason})),events:events.map(e=>({id:e.id,appointmentId:e.appointment_id,action:e.action,actor:e.actor_id,createdAt:e.created_at}))};
}
export async function persistRemote(user:SessionUser,kind:string,value:unknown,remove=false){
 if(!supabase)throw new Error('Supabase não configurado.');const tenant_id=user.tenantId;
 if(kind==='customers'&&user.role==='customer'){const c=value as Customer;const {error}=await supabase.from('profiles').update({name:c.name,phone:c.phone}).eq('id',user.id);check(error);return;}
 if(!tenant_id)throw new Error('Estabelecimento não selecionado.');
 if(kind==='settings'){const s=value as BusinessSettings;const {error}=await supabase.rpc('save_business_profile',{p_tenant_id:tenant_id,p_settings:{name:s.name,slug:s.slug,phone:s.phone,email:s.email,address:s.address,timezone:s.timezone,industry:s.industry??'other',logo_url:s.logoUrl??null,cancellation_hours:s.cancellationHours,slot_interval:s.interval,opening:s.opening,closing:s.closing,weekdays:s.weekdays}});check(error);return;}
 if(kind==='professionals'){const p=value as Professional;const {error}=await supabase.rpc('save_professional',{p_tenant_id:tenant_id,p_professional:{id:p.id,name:p.name,title:p.title,email:p.email,color:p.color,active:p.active,availability:p.availability??[]},p_service_ids:p.serviceIds});check(error);return;}
 let table=kind;let row:Row={};
 if(kind==='services'){const s=value as Service;row={id:s.id,tenant_id,name:s.name,description:s.description,category:s.category,price:s.price,duration:s.duration,active:s.active};}
 if(kind==='customers'){const c=value as Customer;row={id:c.id,tenant_id,name:c.name,email:c.email,phone:c.phone,notes:c.notes};}
 if(kind==='timeOff'){table='time_off';const t=value as TimeOff;if(remove){const {error}=await supabase.from(table).delete().eq('id',t.id).eq('tenant_id',tenant_id);check(error);return;}const {data:o,error}=await supabase.from('organizations').select('timezone').eq('id',tenant_id).single();check(error);row={id:t.id,tenant_id,professional_id:t.professionalId,starts_at:zonedISO(t.date,t.start,o!.timezone),ends_at:zonedISO(t.date,t.end,o!.timezone),reason:t.reason};}
 const {error}=await supabase.from(table).upsert(row);check(error);
}
export async function updateRemoteAppointment(id:string,patch:Partial<Appointment>,data:AppData,user:SessionUser){
 if(!supabase)return;const a=data.appointments.find(a=>a.id===id)!;const tz=a.timezone??data.settings.timezone;
 if(user.role==='customer'){const {error}=patch.status==='cancelled'?await supabase.rpc('cancel_my_appointment',{p_appointment_id:id}):await supabase.rpc('reschedule_my_appointment',{p_appointment_id:id,p_starts_at:zonedISO(patch.date??a.date,patch.time??a.time,tz)});check(error);return;}
 if(patch.status!==undefined||patch.paid!==undefined){const {error}=await supabase.rpc('set_appointment_status',{p_appointment_id:id,p_status:patch.status??a.status,p_paid:patch.paid??null});check(error);return;}
 const row:Row={};if(patch.date||patch.time)row.starts_at=zonedISO(patch.date??a.date,patch.time??a.time,tz);if(patch.professionalId)row.professional_id=patch.professionalId;if(patch.serviceId)row.service_id=patch.serviceId;if(patch.notes!==undefined)row.notes=patch.notes;
 const {error}=await supabase.from('appointments').update(row).eq('id',id).eq('tenant_id',user.tenantId!);check(error);
}
