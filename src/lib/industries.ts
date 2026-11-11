export const industries = [
 {id:'salon',name:'Salão de beleza'},
 {id:'barbershop',name:'Barbearia'},
 {id:'aesthetics',name:'Estética e bem-estar'},
 {id:'consultations',name:'Consultório e atendimentos'},
 {id:'fitness',name:'Esporte e atividade física'},
 {id:'education',name:'Aulas e cursos'},
 {id:'pet',name:'Serviços para pets'},
 {id:'automotive',name:'Serviços automotivos'},
 {id:'consulting',name:'Consultoria e serviços profissionais'},
 {id:'other',name:'Outro negócio com agendamento'},
] as const;
export const industryLabel=(id?:string)=>industries.find(i=>i.id===id)?.name??'Serviços com agendamento';
