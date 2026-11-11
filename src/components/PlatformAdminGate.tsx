import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { usePlatformAccess } from '../lib/platform';
import { useApp } from '../lib/store';
import { Logo } from './ui';
export function PlatformAdminGate({children}:{children:ReactNode}){
 const {user,loading}=useApp();const access=usePlatformAccess();
 if(loading||(user&&access.isFetching&&!access.isFetched))return <div className="page-loader">Carregando…</div>;
 if(!user)return <Navigate to="/login/profissional?redirect=/gestao" replace/>;
 if(access.data!==true)return <div className="standalone"><Logo/><h1>Página não encontrada</h1><p className="muted">Esse endereço não está disponível.</p><Link className="btn primary" to="/">Ir para o início</Link></div>;
 return children;
}
export function PlatformAdminLink(){const access=usePlatformAccess();return access.data===true?<Link className="btn secondary" to="/gestao">Administração da plataforma</Link>:null;}
