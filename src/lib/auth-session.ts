import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Role, SessionUser } from './types';

async function loadIdentity(account:User):Promise<SessionUser>{
 const [{data:profile,error:profileError},{data:members,error:memberError}]=await Promise.all([
  supabase!.from('profiles').select('name').eq('id',account.id).maybeSingle(),
  supabase!.from('organization_members').select('tenant_id,role').eq('user_id',account.id).limit(1),
 ]);
 if(profileError)throw profileError;
 if(memberError)throw memberError;
 const member=members?.[0];let professionalId:string|undefined;
 if(member?.role==='professional'){
  const {data,error}=await supabase!.from('professionals').select('id').eq('tenant_id',member.tenant_id).eq('user_id',account.id).maybeSingle();
  if(error)throw error;professionalId=data?.id;
 }
 return {id:account.id,email:account.email??'',name:profile?.name||account.email?.split('@')[0]||'Usuário',role:(member?.role??'customer') as Role,tenantId:member?.tenant_id,professionalId};
}

export function useAuthSession(){
 // undefined means restoration is still pending; it must never be interpreted as signed out.
 const [session,setSession]=useState<Session|null|undefined>(supabase?undefined:null);
 const [readError,setReadError]=useState<string|null>(null);
 const events=useRef(0);const mounted=useRef(false);const qc=useQueryClient();
 const restore=useCallback(async()=>{
  if(!supabase)return;
  const version=events.current;setReadError(null);setSession(previous=>previous===null?undefined:previous);
  try{
   const {data,error}=await supabase.auth.getSession();
   if(!mounted.current||version!==events.current)return;
   if(error)throw error;
   setSession(data.session);
  }catch{if(mounted.current&&version===events.current){setReadError('Não foi possível verificar sua sessão. Tente novamente.');setSession(previous=>previous??null);}}
 },[]);
 useEffect(()=>{
  if(!supabase)return;
  mounted.current=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{
   // getSession owns the initial restore. Later authoritative events supersede its result.
   if(event==='INITIAL_SESSION')return;
   if(event==='SIGNED_OUT'){
    events.current++;setSession(null);setReadError(null);qc.clear();return;
   }
   if(next){events.current++;setSession(next);setReadError(null);}
   if(event==='USER_UPDATED')setTimeout(()=>{if(mounted.current)void qc.invalidateQueries({queryKey:['identity',next?.user.id]});},0);
  });
  void restore();
  return()=>{mounted.current=false;events.current++;subscription.unsubscribe();};
 },[qc,restore]);
 const identity=useQuery({queryKey:['identity',session?.user.id],queryFn:()=>loadIdentity(session!.user),enabled:!!session,staleTime:30000,refetchOnWindowFocus:false,retry:1});
 const retry=useCallback(()=>{void restore().then(()=>{void qc.invalidateQueries({queryKey:['identity']});});},[restore,qc]);
 return {
  user:session?identity.data??null:null,
  loading:session===undefined||(!!session&&identity.isPending),
  error:readError||(session&&identity.isError&&!identity.data?'Não foi possível verificar seu acesso. Sua sessão não foi encerrada.':null),
  retry,
 };
}
