import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useApp } from './store';
export function usePlatformAccess(){
 const {user,isDemo}=useApp();
 const query=useQuery({queryKey:['platform-access',user?.id],enabled:!!user&&!isDemo&&!!supabase,queryFn:async()=>{const {data,error}=await supabase!.rpc('is_platform_admin');if(error)return false;return data===true;},staleTime:0,refetchOnWindowFocus:true,retry:false});
 return {...query,checking:!!user&&!isDemo&&!!supabase&&query.isPending};
}
export async function platformRpc<T>(name:string,args?:Record<string,unknown>):Promise<T>{
 if(!supabase)throw new Error('Conexão indisponível.');
 const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.message);return data as T;
}
