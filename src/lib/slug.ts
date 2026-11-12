// Same length and first-character rule enforced by organizations_slug_check.
export const SLUG_HTML_PATTERN = '[a-z][a-z0-9\\-]{2,60}';
export function normalizeSlug(value:string):string {
 return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
  .replace(/[^a-z0-9-]+/g,'-').replace(/-+/g,'-').replace(/^-+|-+$/g,'');
}
export function suggestSlug(name:string):string {
 const normalized=normalizeSlug(name);
 const prefixed=/^[0-9]/.test(normalized)?'negocio-'+normalized:normalized;
 return prefixed.slice(0,61).replace(/-+$/,'');
}
export function slugError(value:string):string|null {
 if(value.length<3||value.length>61)return 'O endereço precisa ter entre 3 e 61 caracteres.';
 if(!/^[a-z]/.test(value))return 'O endereço precisa começar com uma letra. Exemplo: meu-negocio.';
 if(!/^[a-z][a-z0-9-]{2,60}$/.test(value))return 'Use somente letras minúsculas, números e hífens no endereço.';
 return null;
}
export function businessError(error:unknown):string {
 const detail=typeof error==='object'&&error!==null?error as {code?:string;message?:string}:{};
 const message=detail.message??'';
 if(detail.code==='23505'&&/slug|organizations/i.test(message))return 'Esse endereço já está em uso. Escolha outro para o seu negócio.';
 if(/organizations_slug_check/.test(message))return 'O endereço deve começar com uma letra e ter de 3 a 61 caracteres, usando letras minúsculas, números e hífens.';
 if(/organizations_name_check/.test(message))return 'O nome do estabelecimento precisa ter entre 2 e 100 caracteres.';
 if(detail.code==='23514')return 'Confira os dados do estabelecimento e tente novamente.';
 return message||'Não foi possível salvar o estabelecimento. Confira sua conexão e tente novamente.';
}
