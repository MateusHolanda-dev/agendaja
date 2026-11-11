import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availableSlots, businessNow, overlaps, today, validateAppointment } from './scheduling';
import type { AppData, Appointment } from './types';

const now = new Date('2026-11-11T12:00:00Z');
const input = { date: '2026-11-12', time: '10:00', duration: 45, professionalId: 'p1', serviceId: 's1' };
function fixture():AppData {
 return {
  settings:{name:'Teste',slug:'teste',phone:'',email:'',address:'',timezone:'America/Fortaleza',opening:'09:00',closing:'18:00',weekdays:[1,2,3,4,5,6],cancellationHours:2,interval:15},
  services:[{id:'s1',name:'Corte',description:'',category:'Cabelo',duration:45,price:50,active:true}],
  professionals:[{id:'p1',name:'Profissional',title:'',email:'',color:'#123c32',serviceIds:['s1'],active:true},{id:'p2',name:'Outro profissional',title:'',email:'',color:'#123c32',serviceIds:['s1'],active:true}],
  customers:[],appointments:[],timeOff:[],events:[]
 };
}
function appointment(patch:Partial<Appointment> = {}):Appointment {
 return {...input,id:'a1',customerId:'c1',price:50,status:'confirmed',paid:false,notes:'',createdAt:now.toISOString(),...patch};
}
test('overlap is half-open: adjacent appointments do not conflict',()=>{
 assert.equal(overlaps(600,645,645,690),false);
 assert.equal(overlaps(600,645,644,690),true);
 const data=fixture();data.appointments.push(appointment());
 assert.match(validateAppointment(data,{...input,time:'10:30'},undefined,now)??'',/ocupado/);
 assert.equal(validateAppointment(data,{...input,time:'10:45'},undefined,now),null);
 assert.equal(validateAppointment(data,{...input,time:'09:15'},undefined,now),null);
});
test('cancelled bookings and other professionals do not occupy the slot; own edit can ignore its ID',()=>{
 const data=fixture();data.appointments.push(appointment());
 assert.equal(validateAppointment(data,input,'a1',now),null);
 assert.equal(validateAppointment(data,{...input,professionalId:'p2'},undefined,now),null);
 data.appointments[0].status='cancelled';
 assert.equal(validateAppointment(data,input,undefined,now),null);
});
test('time off prevents overlap and allows its exact end boundary',()=>{
 const data=fixture();data.timeOff.push({id:'t1',professionalId:'p1',date:input.date,start:'10:30',end:'12:00',reason:'Folga'});
 assert.match(validateAppointment(data,input,undefined,now)??'',/indisponível/);
 assert.equal(validateAppointment(data,{...input,time:'12:00'},undefined,now),null);
 assert.equal(validateAppointment(data,{...input,time:'09:45'},undefined,now),null);
});
test('business hours enforce start and complete service duration; closed weekdays reject bookings',()=>{
 const data=fixture();
 assert.match(validateAppointment(data,{...input,time:'08:45'},undefined,now)??'',/expediente/);
 assert.match(validateAppointment(data,{...input,time:'17:30'},undefined,now)??'',/expediente/);
 assert.equal(validateAppointment(data,{...input,time:'17:15'},undefined,now),null);
 data.settings.weekdays=[1];
 assert.match(validateAppointment(data,input,undefined,now)??'',/não abre/);
});
test('individual schedules restrict weekdays and require a service to fit entirely into its shift',()=>{
 const data=fixture();data.professionals[0].availability=[{weekday:4,start:'10:00',end:'13:00'},{weekday:4,start:'14:00',end:'17:00'}];
 assert.equal(validateAppointment(data,input,undefined,now),null);
 assert.match(validateAppointment(data,{...input,time:'09:00'},undefined,now)??'',/não atende/);
 assert.match(validateAppointment(data,{...input,time:'12:30'},undefined,now)??'',/não atende/);
 assert.match(validateAppointment(data,{...input,date:'2026-11-13'},undefined,now)??'',/não atende/);
 data.professionals[0].availability=[];
 assert.equal(validateAppointment(data,{...input,time:'09:00'},undefined,now),null);
});
test('canonical service duration prevents a caller from shortening a booking to bypass a conflict',()=>{
 const data=fixture();data.appointments.push(appointment({time:'10:30'}));
 assert.match(validateAppointment(data,{...input,duration:1},undefined,now)??'',/ocupado/);
 data.services[0].duration=0;
 assert.match(validateAppointment(data,input,undefined,now)??'',/duração/);
 data.services[0].duration=Number.NaN;
 assert.match(validateAppointment(data,input,undefined,now)??'',/duração/);
});
test('inactive services, inactive professionals and unsupported service assignments cannot book',()=>{
 const data=fixture();data.services[0].active=false;
 assert.match(validateAppointment(data,input,undefined,now)??'',/habilitado/);
 data.services[0].active=true;data.professionals[0].active=false;
 assert.match(validateAppointment(data,input,undefined,now)??'',/habilitado/);
 data.professionals[0].active=true;data.professionals[0].serviceIds=[];
 assert.match(validateAppointment(data,input,undefined,now)??'',/habilitado/);
});
test('calendar and clock values reject impossible dates and minutes',()=>{
 const data=fixture();
 for(const patch of [{date:'2027-02-30'},{date:'2027-13-01'},{date:'not-a-date'},{time:'09:99'},{time:'24:00'},{time:'9:30'}])assert.match(validateAppointment(data,{...input,...patch},undefined,now)??'',/válidos/);
});
test('business-local date and past validation use the organization timezone rather than host timezone',()=>{
 assert.equal(businessNow('America/Fortaleza',now),'2026-11-11T09:00');
 assert.equal(businessNow('Asia/Tokyo',now),'2026-11-11T21:00');
 assert.equal(today('America/Fortaleza',new Date('2026-11-12T01:00:00Z')),'2026-11-11');
 const data=fixture();
 assert.equal(validateAppointment(data,{...input,date:'2026-11-11',time:'10:00'},undefined,now),null);
 data.settings.timezone='Asia/Tokyo';
 assert.match(validateAppointment(data,{...input,date:'2026-11-11',time:'10:00'},undefined,now)??'',/futuro/);
 data.settings.timezone='invalid/timezone';
 assert.match(validateAppointment(data,input,undefined,now)??'',/fuso/);
});
test('available slots enforce time off, booking duration, and invalid interval guard',()=>{
 const data=fixture();const future='2099-11-12';data.settings.weekdays=[0,1,2,3,4,5,6];data.appointments.push(appointment({date:future}));
 data.timeOff.push({id:'t1',professionalId:'p1',date:future,start:'12:00',end:'13:00',reason:'Almoço'});
 const slots=availableSlots(data,future,'p1','s1');
 assert.ok(slots.includes('09:00'));assert.ok(slots.includes('10:45'));assert.ok(slots.includes('13:00'));assert.ok(slots.includes('17:15'));
 assert.ok(!slots.includes('10:00'));assert.ok(!slots.includes('10:30'));assert.ok(!slots.includes('11:30'));assert.ok(!slots.includes('17:30'));
 for(const interval of [0,-15,Number.NaN]){data.settings.interval=interval;assert.deepEqual(availableSlots(data,future,'p1','s1'),[]);}
});
test('slot alignment matches server even when the opening time is off the interval grid',()=>{
 const data=fixture();data.settings.opening='09:10';data.settings.weekdays=[0,1,2,3,4,5,6];
 assert.equal(availableSlots(data,'2099-11-12','p1','s1')[0],'09:15');
 assert.match(validateAppointment(data,{...input,time:'10:05'},undefined,now)??'',/disponíveis/);
});
