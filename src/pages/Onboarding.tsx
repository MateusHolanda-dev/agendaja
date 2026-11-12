import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Link2 } from 'lucide-react';
import { Logo } from '../components/ui';
import { useApp } from '../lib/store';
import { industries } from '../lib/industries';
import { supabase } from '../lib/supabase';
import { normalizeSlug, suggestSlug, slugError, businessError, SLUG_HTML_PATTERN } from '../lib/slug';
import SessionRecovery from '../components/SessionRecovery';
import { loginFor } from '../lib/navigation';
export default function Onboarding(){
 const {user,isDemo,authLoading,authError}=useApp();
 const [name,setName]=useState(''),[industry,setIndustry]=useState(''),[slug,setSlug]=useState(''),[slugEdited,setSlugEdited]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 if(authLoading)return <div className="page-loader">Carregando…</div>;
 if(authError)return <SessionRecovery/>;
 if(!user)return <Navigate to={loginFor('profissional','/onboarding')} replace/>;
 if(user.tenantId||isDemo)return <Navigate to="/app" replace/>;
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy)return;setError('');const cleanSlug=normalizeSlug(slug);setSlug(cleanSlug);
  if(name.trim().length<2||name.trim().length>100){setError('O nome do estabelecimento precisa ter entre 2 e 100 caracteres.');return;}
  if(!industries.some(i=>i.id===industry)){setError('Selecione o segmento do seu negócio.');return;}
  const invalidSlug=slugError(cleanSlug);if(invalidSlug){setError(invalidSlug);return;}
  if(!supabase){setError('O acesso ainda não foi ativado.');return;}
  setBusy(true);
  try{const {error}=await supabase.rpc('onboard_organization',{p_name:name.trim(),p_slug:cleanSlug,p_industry:industry});if(error)throw error;location.replace('/app');}
  catch(failure){setError(businessError(failure));}finally{setBusy(false);}
 }
 return <div className="standalone"><Logo/><div className="card onboarding"><span className="eyebrow">O COMEÇO DE UMA NOVA ROTINA</span><h1>Vamos conhecer seu negócio?</h1><p className="muted">Dê um nome ao seu espaço e escolha o link dos seus agendamentos.</p><form onSubmit={submit} noValidate>
 <label className="field">Nome do estabelecimento<input className="input" name="name" minLength={2} maxLength={100} required placeholder="Ex.: Salão da Maria" value={name} onChange={e=>{setName(e.target.value);if(!slugEdited)setSlug(suggestSlug(e.target.value));setError('');}} disabled={busy}/></label>
 <label className="field">Segmento do negócio<select className="input" name="industry" required value={industry} onChange={e=>{setIndustry(e.target.value);setError('');}} disabled={busy}><option value="" disabled>Selecione seu segmento</option>{industries.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
 <label className="field">Seu endereço de agendamento<input className="input" name="slug" pattern={SLUG_HTML_PATTERN} minLength={3} maxLength={61} required placeholder="salao-da-maria" value={slug} onChange={e=>{setSlugEdited(true);setSlug(e.target.value);setError('');}} onBlur={()=>setSlug(normalizeSlug(slug))} autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={busy}/><small>Comece com uma letra. Use de 3 a 61 caracteres. Espaços e acentos são ajustados automaticamente.</small></label>
 <div className="notice" style={{display:'flex',gap:8,alignItems:'center',marginBottom:20,overflowWrap:'anywhere'}}><Link2 size={15}/><span>/agendar/{normalizeSlug(slug)||'seu-negocio'}</span></div>
 {error&&<p className="form-error" role="alert">{error}</p>}
 <button className="btn primary auth-submit" disabled={busy}>{busy?'Criando…':'Criar meu estabelecimento'}<ArrowRight size={18}/></button></form><Link to="/cliente" className="text-link">Sou cliente, acessar meus agendamentos</Link></div></div>;
}
