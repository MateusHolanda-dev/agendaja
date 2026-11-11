import * as Dialog from '@radix-ui/react-dialog';
import { Check, X, CalendarDays, Search } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn=(...v:Parameters<typeof clsx>)=>twMerge(clsx(...v));
export function Button({className,variant='primary',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:string}){return <button className={cn('btn',variant,className)} {...props}/>;}
export function Input(props:InputHTMLAttributes<HTMLInputElement>){return <input {...props} className={cn('input',props.className)}/>;}
export function Select(props:SelectHTMLAttributes<HTMLSelectElement>){return <select {...props} className={cn('input',props.className)}/>;}
export function Field({label,children,error}:{label:string;children:ReactNode;error?:string}){return <label className="field"><span>{label}</span>{children}{error&&<small className="error-text">{error}</small>}</label>;}
export function Modal({open,onClose,title,children}:{open:boolean;onClose:()=>void;title:string;children:ReactNode}){return <Dialog.Root open={open} onOpenChange={v=>!v&&onClose()}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className="modal-content"><div className="modal-header"><Dialog.Title>{title}</Dialog.Title><Dialog.Close asChild><button className="icon-btn" aria-label="Fechar"><X size={20}/></button></Dialog.Close></div><Dialog.Description className="sr-only">Preencha os campos e confirme para salvar as alterações.</Dialog.Description>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;}
export function Avatar({name,color,size=38}:{name:string;color?:string;size?:number}){return <span className="avatar" style={{background:color,width:size,height:size,minWidth:size}} aria-hidden="true">{name.split(' ').slice(0,2).map(n=>n[0]).join('')}</span>;}
export function Badge({children,className}:{children:ReactNode;className?:string}){return <span className={cn('badge',className)}>{children}</span>;}
export function EmptyState({title='Nada por aqui ainda',description,action}:{title?:string;description?:string;action?:ReactNode}){return <div className="empty-state"><CalendarDays size={30}/><h3>{title}</h3>{description&&<p>{description}</p>}{action}</div>;}
export function Logo({light=false}:{light?:boolean}){return <span className={cn('brand',light&&'light')}><span className="brand-mark"><Check size={21} strokeWidth={3}/></span><span>agenda<span className="brand-accent">Já</span><span className="brand-dot">.</span></span></span>;}
export function SearchInput({value,onChange,placeholder='Buscar...'}:{value:string;onChange:(s:string)=>void;placeholder?:string}){return <div className="search-input"><Search size={17}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}/>{value&&<button className="icon-btn" aria-label="Limpar busca" onClick={()=>onChange('')}><X size={14}/></button>}</div>;}
