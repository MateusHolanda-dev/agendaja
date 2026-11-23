import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useApp } from '../lib/store';
import { catalogReadiness } from '../lib/catalog';
import { ServicesPage, ProfessionalsPage, SettingsPage } from './Management';
import './catalog.css';

export function CatalogNotice(){
 const {data}=useApp();const state=catalogReadiness(data);
 return <section className="card catalog-notice"><div><span className="eyebrow">AGENDAMENTO PELO CLIENTE</span><h2>{state.ready?'Seu catálogo está pronto para receber reservas':'Prepare seu catálogo para receber reservas'}</h2><p className="muted">Você define serviços, profissionais e horários. O cliente escolhe e agenda pelo seu link.</p></div><Link className="btn primary" to="/app/catalogo">Catálogo e horários</Link></section>;
}

export default function Catalog(){
 const {data,notify}=useApp();const [tab,setTab]=useState<'services'|'team'|'hours'>('services');const state=catalogReadiness(data);
 const steps=[{id:'services' as const,label:'Serviços do catálogo',done:state.services>0,detail:`${state.services} serviços ativos`},{id:'team' as const,label:'Equipe e serviços',done:state.professionals>0,detail:`${state.professionals} profissionais com serviços vinculados`},{id:'hours' as const,label:'Horários disponíveis',done:state.hours,detail:'Dias, expediente e intervalo das reservas'}];
 const url=location.origin+'/agendar/'+data.settings.slug;
 async function copy(){try{await navigator.clipboard.writeText(url);notify('Link copiado. Envie para seus clientes fazerem a reserva.');}catch{notify('Seu link: '+url);}}
 return <><div className="page-heading"><div><span className="eyebrow">SEU ESTABELECIMENTO ONLINE</span><h1>Catálogo e horários</h1><p className="muted">Configure o que oferece e quando atende. Seus clientes fazem os agendamentos.</p></div></div><section className="card catalog-share"><div><strong>{state.ready?'Pronto para receber reservas':'Há configurações pendentes'}</strong><p className="muted">{state.ready?'Confira a página pública e compartilhe com seus clientes.':'Cadastre um serviço ativo, vincule um profissional e defina os horários abaixo.'}</p><p className="catalog-url">{url}</p></div><div className="catalog-actions"><button className="btn secondary" onClick={()=>void copy()}><Copy size={16}/>Copiar link do cliente</button><Link className="btn secondary" to={'/agendar/'+data.settings.slug} target="_blank" rel="noreferrer">Ver como cliente<ExternalLink size={16}/></Link></div></section><nav className="catalog-tabs" aria-label="Configurar catálogo">{steps.map(step=><button key={step.id} className={'card catalog-step '+(tab===step.id?'selected':'')} aria-pressed={tab===step.id} onClick={()=>setTab(step.id)}><span>{step.done?<Check size={18}/>:steps.indexOf(step)+1}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div></button>)}</nav><div className="catalog-editor">{tab==='services'?<ServicesPage/>:tab==='team'?<><p className="notice">Mesmo trabalhando sozinho, cadastre seu nome como profissional e marque os serviços que você atende. No cadastro você também pode definir a disponibilidade individual.</p><ProfessionalsPage/></>:<><p className="notice">Os horários livres são calculados pelo expediente, duração do serviço, disponibilidade do profissional, pausas e reservas existentes. Configure pausas e folgas na aba Equipe e serviços, no botão Bloqueios de cada profissional.</p><SettingsPage initialTab="hours"/></>}</div></>;
}
