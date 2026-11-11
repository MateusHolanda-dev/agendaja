import {test,expect} from '@playwright/test';
test('proprietário de negócio não vê nem abre administração da plataforma',async({page})=>{
 await page.goto('/login/profissional');await page.getByRole('button',{name:'Explorar demonstração'}).click();
 await page.getByRole('button',{name:'Menu da conta'}).click();
 await expect(page.getByRole('link',{name:'Administração da plataforma'})).toHaveCount(0);
 await page.goto('/gestao');await expect(page.getByRole('heading',{name:'Página não encontrada'})).toBeVisible();
 await expect(page.getByText('CONTROLE DA PLATAFORMA')).toHaveCount(0);
});

test.describe('controle com servidor simulado para a conta liberada',()=>{
 test.use({baseURL:'http://127.0.0.1:4175'});
 test('administrador autorizado consulta empresas, edita e vê auditoria',async({page})=>{
  const id='10000000-0000-4000-8000-000000000001';
  const user={id,email:'owner@test.local',user_metadata:{name:'Administrador'},app_metadata:{provider:'email'},aud:'authenticated',created_at:'2026-11-01T12:00:00Z'};
  const company={id:'20000000-0000-4000-8000-000000000001',name:'Escola Teste',slug:'escola-teste',industry:'education',active:true,email:'escola@example.com',phone:'',address:'',slot_interval:30,cancellation_hours:2};
  const edits:unknown[]=[];
  await page.addInitScript(({user})=>{localStorage.setItem('sb-rwjbrlgadfwdpskmlvoy-auth-token',JSON.stringify({access_token:'test-access-token',refresh_token:'test-refresh-token',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}));},{user});
  await page.route('https://rwjbrlgadfwdpskmlvoy.supabase.co/**',async route=>{
   const url=new URL(route.request().url());const body=route.request().postDataJSON()??{};
   let result:unknown=[];
   if(url.pathname==='/auth/v1/user')result=user;
   else if(url.pathname.includes('/profiles'))result={id:user.id,name:'Administrador',email:user.email,phone:''};
   else if(url.pathname.endsWith('/rpc/get_my_appointments'))result=[];
   else if(url.pathname.endsWith('/rpc/is_platform_admin'))result=true;
   else if(url.pathname.endsWith('/rpc/platform_overview'))result={organizations:1,active_organizations:1,users:1,customers:0,professionals:0,appointments:0,pending:0,completed:0,received:0};
   else if(url.pathname.endsWith('/rpc/platform_list'))result=body.p_entity==='organizations'?{rows:[company],total:1}:body.p_entity==='audit'?{rows:edits.length?[{id:'audit1',actor_name:'Administrador',entity:'organizations',fields:['name'],record_id:company.id,created_at:'2026-11-11T12:00:00Z'}]:[],total:edits.length}:{rows:[],total:0};
   else if(url.pathname.endsWith('/rpc/platform_update')){edits.push(body);Object.assign(company,body.p_patch);result=null;}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/gestao');await expect(page.getByRole('heading',{name:'Visão geral'})).toBeVisible();
  await page.screenshot({path:'test-results/platform-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Empresas',exact:true}).click();
  await page.getByRole('button',{name:'Editar Escola Teste'}).click();
  await page.getByRole('dialog').getByLabel('Nome',{exact:true}).fill('Escola Atualizada');
  await page.getByRole('button',{name:'Salvar alterações'}).click();
  await expect(page.getByRole('cell',{name:'Escola Atualizada',exact:true})).toBeVisible();
  expect(edits).toEqual([{p_entity:'organizations',p_id:company.id,p_patch:{name:'Escola Atualizada'}}]);
  await page.getByRole('button',{name:'Auditoria da plataforma',exact:true}).click();
  await expect(page.getByRole('cell',{name:'Administrador',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:'test-results/platform-mobile.png',fullPage:true});
  expect(errors).toEqual([]);
 });
 test('conta autenticada sem liberação recebe página não encontrada',async({page})=>{
  const user={id:'10000000-0000-4000-8000-000000000003',email:'customer@test.local',user_metadata:{},app_metadata:{provider:'email'},aud:'authenticated',created_at:'2026-11-01T12:00:00Z'};
  await page.addInitScript(user=>localStorage.setItem('sb-rwjbrlgadfwdpskmlvoy-auth-token',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user})),user);
  await page.route('https://rwjbrlgadfwdpskmlvoy.supabase.co/**',async route=>{const path=new URL(route.request().url()).pathname;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(path.endsWith('/is_platform_admin')?false:path.includes('/profiles')?{id:user.id,name:'Cliente',email:user.email}:path==='/auth/v1/user'?user:[])});});
  await page.goto('/gestao');await expect(page.getByRole('heading',{name:'Página não encontrada'})).toBeVisible();
  await expect(page.getByText('CONTROLE DA PLATAFORMA')).toHaveCount(0);
 });
});
