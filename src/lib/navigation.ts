export function safeReturnPath(value:string|null):string|null{
 if(!value||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f]/.test(value))return null;
 try{
  if(/[\\\u0000-\u001f]/.test(decodeURIComponent(value)))return null;
  const url=new URL(value,'https://agendaja.invalid');
  if(url.origin!=='https://agendaja.invalid')return null;
  if(!/^\/(?:app(?:\/|$)|cliente$|gestao$|onboarding$|agendar\/)/.test(url.pathname))return null;
  return url.pathname+url.search+url.hash;
 }catch{return null;}
}
export function loginFor(area:'cliente'|'profissional',path:string){
 const target=safeReturnPath(path);return '/login/'+area+(target?'?redirect='+encodeURIComponent(target):'');
}
