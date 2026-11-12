import {test,expect,type Page} from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:4175'});
async function account(page:Page,platformAdmin:boolean){
 const user={id:'10000000-0000-4000-8000-000000000001',email:'account@test.local',user_metadata:{name:'Usuário'},app_metadata:{provider:'email'},aud:'authenticated',created_at:'2026-11-01T12:00:00Z'};
 await page.addInitScript(user=>localStorage.setItem('sb-rwjbrlgadfwdpskmlvoy-auth-token',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user})),user);
 await page.route('https://rwjbrlgadfwdpskmlvoy.supabase.co/**',async route=>{
  const path=new URL(route.request().url()).pathname;let data:unknown=[];
  if(path==='/auth/v1/user')data=user;
  else if(path.endsWith('/profiles'))data={id:user.id,name:'Usuário',email:user.email,phone:''};
  else if(path.endsWith('/rpc/is_platform_admin')){await new Promise(resolve=>setTimeout(resolve,250));data=platformAdmin;}
  else if(path.endsWith('/rpc/platform_overview'))data={organizations:0,active_organizations:0,users:1,customers:0,professionals:0,appointments:0,pending:0,completed:0,received:0};
  else if(path.endsWith('/rpc/platform_list'))data={rows:[],total:0};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
}
test('administrador sem loja vai direto à gestão após entrar como profissional',async({page})=>{
 await account(page,true);const paths:string[]=[];page.on('framenavigated',f=>{if(f===page.mainFrame())paths.push(new URL(f.url()).pathname);});
 await page.goto('/login/profissional');await expect(page).toHaveURL(/\/gestao$/);await expect(page.getByRole('heading',{name:'Visão geral',exact:true})).toBeVisible();
 expect(paths).not.toContain('/onboarding');await expect(page.getByRole('heading',{name:'Vamos conhecer seu negócio?'})).toHaveCount(0);
 await page.getByRole('link',{name:'Página inicial',exact:true}).click();await page.getByRole('link',{name:'Meu painel',exact:true}).click();await expect(page).toHaveURL(/\/gestao$/);
});
test('atalhos de app e cadastro de negócio também respeitam o acesso administrativo',async({page})=>{
 await account(page,true);
 for(const path of ['/app','/onboarding','/login/profissional?redirect=%2Fonboarding']){
  await page.goto(path);await expect(page).toHaveURL(/\/gestao$/);await expect(page.getByRole('heading',{name:'Visão geral',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Vamos conhecer seu negócio?'})).toHaveCount(0);
 }
});
test('conta comum sem empresa continua no cadastro e não ganha administração',async({page})=>{
 await account(page,false);await page.goto('/login/profissional');await expect(page).toHaveURL(/\/onboarding$/);await expect(page.getByRole('heading',{name:'Vamos conhecer seu negócio?'})).toBeVisible();
 await page.goto('/gestao');await expect(page.getByRole('heading',{name:'Página não encontrada'})).toBeVisible();
});
