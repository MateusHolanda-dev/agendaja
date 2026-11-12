import { Logo } from './ui';
import { useApp } from '../lib/store';
export default function SessionRecovery(){const {authError,retrySession,logout}=useApp();return <div className="standalone"><Logo/><div className="card onboarding"><h1>Vamos tentar novamente?</h1><p className="muted" role="alert" style={{margin:'18px 0 24px'}}>{authError}</p><div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button className="btn primary" onClick={retrySession}>Tentar novamente</button><button className="btn secondary" onClick={()=>void logout()}>Sair da conta</button></div></div></div>;}
