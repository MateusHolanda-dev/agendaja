import {test,expect,type Page} from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:4175'});
async function session(page:Page,fail=false){
 const user={id:'10000000-0000-4000-8000-000000000001',email:'owner@test.local',user_metadata:{name:'Matheus'},app_metadata:{provider:'email'},aud:'authenticated',created_at:'2026-11-01T12:00:00Z'};
 const calls:Record<string,unknown>[]=[];let created=false;
 await page.addInitScript(user=>localStorage.setItem('sb-rwjbrlgadfwdpskmlvoy-auth-token',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user})),user);
 await page.route('https://rwjbrlgadfwdpskmlvoy.supabase.co/**',async route=>{
  const path=new URL(route.request().url()).pathname;let data:unknown=[];
  if(path==='/auth/v1/user')data=user;
  else if(path.endsWith('/rpc/onboard_organization')){calls.push(route.request().postDataJSON());if(fail){await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'23505',message:'duplicate key value violates unique constraint "organizations_slug_key"'})});return;}created=true;data='20000000-0000-4000-8000-000000000001';}
  else if(path.endsWith('/profiles'))data={id:user.id,name:'Matheus',email:user.email,phone:''};
  else if(path.endsWith('/organization_members'))data=created?[{tenant_id:'20000000-0000-4000-8000-000000000001',role:'owner'}]:[];
  else if(path.endsWith('/organizations'))data=[{id:'20000000-0000-4000-8000-000000000001',name:'Meu Negócio',slug:'meu-negocio',timezone:'America/Fortaleza',industry:'salon',phone:'',email:'',address:'',slot_interval:30,cancellation_hours:2}];
  else if(path.endsWith('/rpc/is_platform_admin'))data=false;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 return calls;
}
test('cadastro normaliza o endereço e conclui criação do estabelecimento',async({page})=>{
 const calls=await session(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/onboarding');
 await page.getByLabel('Nome do estabelecimento').fill('Salão Áurea & Saúde 2026');
 await expect(page.getByLabel('Seu endereço de agendamento')).toHaveValue('salao-aurea-saude-2026');
 await page.getByLabel('Segmento do negócio').selectOption('salon');
 await page.getByLabel('Seu endereço de agendamento').fill('Meu Negócio Personalizado');
 await page.getByRole('button',{name:'Criar meu estabelecimento'}).click();
 await expect(page).toHaveURL(/\/app$/);
 expect(calls).toEqual([{p_name:'Salão Áurea & Saúde 2026',p_slug:'meu-negocio-personalizado',p_industry:'salon'}]);
 expect(errors).toEqual([]);
});
test('endereço curto ou iniciado por número é barrado antes da chamada ao banco',async({page})=>{
 const calls=await session(page);await page.goto('/onboarding');await page.getByLabel('Nome do estabelecimento').fill('Meu Negócio');await page.getByLabel('Segmento do negócio').selectOption('other');
 const input=page.getByLabel('Seu endereço de agendamento');
 await input.fill('ab');await page.getByRole('button',{name:'Criar meu estabelecimento'}).click();await expect(page.getByRole('alert')).toContainText('entre 3 e 61');
 await input.fill('123negocio');await page.getByRole('button',{name:'Criar meu estabelecimento'}).click();await expect(page.getByRole('alert')).toContainText('começar com uma letra');
 expect(calls).toHaveLength(0);
 await input.fill('ABC');expect(await input.evaluate((el:HTMLInputElement)=>el.validity.patternMismatch)).toBe(true);
 await input.fill('meu-negocio');expect(await input.evaluate((el:HTMLInputElement)=>el.validity.patternMismatch)).toBe(false);
});
test('endereço duplicado mantém os dados e apresenta orientação em português',async({page})=>{
 const calls=await session(page,true);await page.goto('/onboarding');await page.getByLabel('Nome do estabelecimento').fill('Meu Negócio');await page.getByLabel('Segmento do negócio').selectOption('other');await page.getByRole('button',{name:'Criar meu estabelecimento'}).click();
 await expect(page.getByRole('alert')).toContainText('já está em uso');await expect(page.getByLabel('Nome do estabelecimento')).toHaveValue('Meu Negócio');expect(calls).toHaveLength(1);
});
