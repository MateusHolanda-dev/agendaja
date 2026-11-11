import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from './lib/store';
import App from './App';
import './styles.css';
const client=new QueryClient({defaultOptions:{queries:{staleTime:30000,refetchOnWindowFocus:false}}});
class ErrorBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<div className="standalone"><h1>Vamos tentar de novo?</h1><p>Não foi possível exibir esta tela. Recarregue para continuar.</p><button className="btn primary" onClick={()=>location.reload()}>Recarregar</button></div>:this.props.children;}}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><QueryClientProvider client={client}><BrowserRouter><AppProvider><App/></AppProvider></BrowserRouter></QueryClientProvider></ErrorBoundary></React.StrictMode>);
