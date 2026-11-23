import type { AppData } from './types';

export function catalogReadiness(data:AppData){
 const services=data.services.filter(s=>s.active);
 const professionals=data.professionals.filter(p=>p.active&&p.serviceIds.some(id=>services.some(s=>s.id===id)));
 const hours=data.settings.weekdays.length>0&&data.settings.opening<data.settings.closing;
 return {services:services.length,professionals:professionals.length,hours,ready:services.length>0&&professionals.length>0&&hours};
}
