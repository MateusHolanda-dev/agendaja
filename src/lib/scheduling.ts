import type { AppData, Appointment } from './types';
export const today = (timezone = 'America/Fortaleza', now = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const money = (n:number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
export const dateLabel = (d:string) => new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'});
export const minutes = (t:string) => Number(t.slice(0,2))*60+Number(t.slice(3,5));
export const timeString = (m:number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
export function overlaps(a:number,b:number,c:number,d:number) { return a<d && c<b; }
export function businessNow(timezone:string, now = new Date()) { return new Intl.DateTimeFormat('sv-SE',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(now).replace(' ','T'); }
const validTime = (value:string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export function validateAppointment(data:AppData,input:Pick<Appointment,'date'|'time'|'duration'|'professionalId'|'serviceId'>,ignoreId?:string,now = new Date()):string|null {
 const pro=data.professionals.find(p=>p.id===input.professionalId&&p.active); const service=data.services.find(s=>s.id===input.serviceId&&s.active);
 if(!pro||!service||!pro.serviceIds.includes(service.id))return 'Escolha um profissional habilitado para este serviço.';
 const calendarDate=new Date(`${input.date}T12:00:00Z`);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isFinite(calendarDate.getTime())||calendarDate.toISOString().slice(0,10)!==input.date||!validTime(input.time))return 'Informe uma data e um horário válidos.';
 if(!Number.isInteger(service.duration)||service.duration<5||service.duration>480)return 'O serviço deve ter duração entre 5 e 480 minutos.';
 if(!validTime(data.settings.opening)||!validTime(data.settings.closing)||data.settings.opening>=data.settings.closing)return 'Confira o horário de funcionamento do estabelecimento.';
 try {if(`${input.date}T${input.time}` < businessNow(data.settings.timezone,now))return 'Escolha um horário futuro.';}catch{return 'Confira o fuso horário do estabelecimento.';}
 const start=minutes(input.time),end=start+service.duration;
 if(![5,10,15,20,30,60].includes(data.settings.interval)||start%data.settings.interval!==0)return 'Escolha um dos horários disponíveis na agenda.';
 if(!data.settings.weekdays.includes(calendarDate.getUTCDay()))return 'O estabelecimento não abre neste dia.';
 if(start<minutes(data.settings.opening)||end>minutes(data.settings.closing))return 'O atendimento deve estar dentro do expediente.';
 if(pro.availability?.length&&!pro.availability.some(a=>a.weekday===calendarDate.getUTCDay()&&start>=minutes(a.start)&&end<=minutes(a.end)))return 'O profissional não atende neste período.';
 if(data.timeOff.some(t=>t.professionalId===pro.id&&t.date===input.date&&overlaps(start,end,minutes(t.start),minutes(t.end))))return 'O profissional está indisponível neste horário.';
 if(data.appointments.some(a=>a.id!==ignoreId&&a.status!=='cancelled'&&a.professionalId===pro.id&&a.date===input.date&&overlaps(start,end,minutes(a.time),minutes(a.time)+a.duration)))return 'Este horário já está ocupado. Escolha outro.';
 return null;
}
export function availableSlots(data:AppData,date:string,professionalId:string,serviceId:string,ignoreId?:string) { const duration=data.services.find(s=>s.id===serviceId)?.duration??0; const interval=data.settings.interval;const slots:string[]=[];if(![5,10,15,20,30,60].includes(interval)||!Number.isInteger(duration)||duration<5||duration>480||!validTime(data.settings.opening)||!validTime(data.settings.closing))return slots;for(let m=Math.ceil(minutes(data.settings.opening)/interval)*interval;m+duration<=minutes(data.settings.closing);m+=interval) {const time=timeString(m);if(!validateAppointment(data,{date,time,professionalId,serviceId,duration},ignoreId))slots.push(time);}return slots; }
