import {test,expect,type Page} from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:4175'});
const uid='10000000-0000-4000-8000-000000000001';
const tenant='20000000-0000-4000-8000-000000000001';
const authUser={id:uid,email:'owner@test.local',user_metadata:{name:'Matheus'},app_metadata:{provider:'email'},aud:'authenticated',created_at:'2026-11-01T12:00:00Z'};
const storageKey='sb-rwjbrlgadfwdpskmlvoy-auth-token';
function makeSession(expired=false){return {access_token:'test-access-token',refresh_token:'test-refresh-token',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+(expired?-60:3600),token_type:'bearer',user:authUser};}
async function backend(page:Page,options:{signedIn?:boolean;expired?:boolean;failIdentity?:boolean}={}){
 const state={failIdentity:options.failIdentity??false,profileCalls:0,refreshes:0,passwordLogins:0,signouts:0};
 if(options.signedIn)await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:storageKey,session:makeSession(options.expired)});
 await page.route('https://rwjbrlgadfwdpskmlvoy.supabase.co/**',async route=>{
  const url=new URL(route.request().url());let data:unknown=[];
  if(url.pathname==='/auth/v1/token'){
   if(url.searchParams.get('grant_type')==='refresh_token')state.refreshes++;else state.passwordLogins++;
   data=makeSession();
  }else if(url.pathname==='/auth/v1/logout'){state.signouts++;await route.fulfill({status:204});return;}
  else if(url.pathname==='/auth/v1/user')data=authUser;
  else if(url.pathname.endsWith('/profiles')){
   state.profileCalls++;await new Promise(resolve=>setTimeout(resolve,350));
   if(state.failIdentity){await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'PGRST000',message:'Conexão temporariamente indisponível'})});return;}
   data={id:uid,name:'Matheus',email:authUser.email,phone:''};
  }else if(url.pathname.endsWith('/organization_members'))data=[{tenant_id:tenant,role:'owner'}];
  else if(url.pathname.endsWith('/organizations'))data=[{id:tenant,name:'Meu Negócio',slug:'meu-negocio',industry:'other',timezone:'America/Fortaleza',phone:'',email:'',address:'',slot_interval:30,cancellation_hours:2}];
  else if(url.pathname.endsWith('/business_hours'))data=[{weekday:1,starts_at:'09:00',ends_at:'18:00'}];
  else if(url.pathname.endsWith('/rpc/is_platform_admin'))data=false;
  else if(url.pathname.endsWith('/rpc/get_public_business'))data={organization:{id:tenant,name:'Meu Negócio',slug:'meu-negocio',timezone:'America/Fortaleza',cancellation_hours:2,slot_interval:30},services:[],professionals:[]};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 return state;
}

test('login aguarda os dados da conta e retorna à página solicitada',async({page})=>{
 const state=await backend(page);await page.goto('/app/servicos?origem=atalho');
 await expect(page).toHaveURL(/\/login\/profissional\?redirect=/);
 await page.getByLabel('E-mail',{exact:true}).fill('owner@test.local');await page.getByLabel('Senha',{exact:true}).fill('senha-de-teste');
 const locations:string[]=[];page.on('framenavigated',frame=>{if(frame===page.mainFrame())locations.push(frame.url());});
 await page.getByRole('button',{name:'Entrar no meu negócio'}).click();
 await expect(page).toHaveURL(/\/app\/servicos\?origem=atalho$/);await expect(page.getByRole('heading',{name:'Seus serviços',exact:true})).toBeVisible();
 expect(locations.filter(url=>url.includes('/login/'))).toEqual([]);expect(state.passwordLogins).toBe(1);
 await page.reload();await expect(page.getByRole('heading',{name:'Seus serviços',exact:true})).toBeVisible();expect(state.passwordLogins).toBe(1);
});

test('sessão acompanha a navegação, recarga e volta de outra aba',async({page,context})=>{
 const state=await backend(page,{signedIn:true});const locations:string[]=[];page.on('framenavigated',f=>{if(f===page.mainFrame())locations.push(f.url());});
 await page.goto('/app/clientes?origem=teste');await expect(page.getByRole('heading',{name:'Seus clientes',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Serviços',exact:true}).click();await expect(page.getByRole('heading',{name:'Seus serviços',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Profissionais',exact:true}).click();await expect(page.getByRole('heading',{name:'Sua equipe',exact:true})).toBeVisible();
 await page.goBack();await expect(page.getByRole('heading',{name:'Seus serviços',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Seus serviços',exact:true})).toBeVisible();
 const other=await context.newPage();await other.goto('about:blank');await page.bringToFront();await other.close();
 await page.getByRole('link',{name:'Clientes',exact:true}).click();await expect(page.getByRole('heading',{name:'Seus clientes',exact:true})).toBeVisible();
 await page.goto('/');await page.getByRole('link',{name:'Meu painel',exact:true}).click();await expect(page).toHaveURL(/\/app$/);
 await page.goto('/agendar/meu-negocio');await page.getByRole('link',{name:'Meus agendamentos',exact:true}).click();await expect(page).toHaveURL(/\/cliente$/);
 expect(locations.filter(url=>url.includes('/login/'))).toEqual([]);expect(state.signouts).toBe(0);
 await page.goto('/app');await page.getByRole('button',{name:'Menu da conta'}).click();await page.getByRole('button',{name:'Sair da conta',exact:true}).last().click();
 await expect(page).toHaveURL(/\/login\/profissional/);expect(state.signouts).toBe(1);
});

test('falha temporária ao consultar permissões oferece nova tentativa sem deslogar',async({page})=>{
 const state=await backend(page,{signedIn:true,failIdentity:true});await page.goto('/app/agenda');
 await expect(page.getByRole('alert')).toContainText('Sua sessão não foi encerrada');await expect(page).toHaveURL(/\/app\/agenda$/);
 expect(await page.evaluate(key=>!!localStorage.getItem(key),storageKey)).toBe(true);
 state.failIdentity=false;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Sua agenda/})).toBeVisible();await expect(page).toHaveURL(/\/app\/agenda/);expect(state.signouts).toBe(0);
});

test('token renovado restaura a página sem pedir novo login',async({page})=>{
 const state=await backend(page,{signedIn:true,expired:true});await page.goto('/app/clientes');
 await expect(page.getByRole('heading',{name:'Seus clientes',exact:true})).toBeVisible();expect(state.refreshes).toBeGreaterThan(0);expect(state.passwordLogins).toBe(0);
});
