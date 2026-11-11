export type Role = 'owner' | 'admin' | 'professional' | 'receptionist' | 'customer';
export type Status = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export interface SessionUser { id:string; name:string; email:string; role:Role; tenantId?:string; professionalId?:string }
export interface Service { id:string; name:string; description:string; category:string; price:number; duration:number; active:boolean }
export interface Professional { id:string; name:string; title:string; email:string; color:string; serviceIds:string[]; active:boolean; availability?:{weekday:number;start:string;end:string}[] }
export interface Customer { id:string; name:string; email:string; phone:string; notes:string; userId?:string }
export interface Appointment { id:string; customerId:string; professionalId:string; serviceId:string; date:string; time:string; duration:number; price:number; status:Status; paid:boolean; notes:string; createdAt:string; businessName?:string; businessSlug?:string; timezone?:string; cancellationHours?:number }
export interface BusinessSettings { name:string; slug:string; phone:string; email:string; address:string; timezone:string; opening:string; closing:string; weekdays:number[]; cancellationHours:number; interval:number; logoUrl?:string }
export interface TimeOff { id:string; professionalId:string; date:string; start:string; end:string; reason:string }
export interface AppointmentEvent { id:string; appointmentId:string; action:string; createdAt:string; actor:string }
export interface AppData { services:Service[]; professionals:Professional[]; customers:Customer[]; appointments:Appointment[]; settings:BusinessSettings; timeOff:TimeOff[]; events:AppointmentEvent[] }
export const statusLabels:Record<Status,string> = {pending:'Pendente',confirmed:'Confirmado',completed:'Concluído',cancelled:'Cancelado'};
