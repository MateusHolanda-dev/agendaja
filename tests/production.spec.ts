import { test, expect } from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:4175'});
test('publicação apresenta vários segmentos e não oferece acesso fictício',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/A agenda acompanha/})).toBeVisible();
 for(const name of ['Salões e barbearias','Consultórios e profissionais','Aulas e consultorias','Serviços para pets','Oficinas e outros negócios'])await expect(page.getByRole('heading',{name})).toBeVisible();
 await page.getByRole('link',{name:'Organizar meu negócio'}).click();
 const inactive=await page.getByText('Acesso ainda não ativado',{exact:true}).count();
 if(inactive)await expect(page.getByRole('button',{name:'Criar minha conta'})).toBeDisabled();
 else await expect(page.getByRole('button',{name:'Criar minha conta'})).toBeEnabled();
 await expect(page.getByRole('button',{name:'Explorar demonstração'})).toHaveCount(0);
 await page.evaluate(()=>sessionStorage.setItem('agendaja-demo-user',JSON.stringify({id:'demo-owner',name:'Rafael Costa',role:'owner',tenantId:'demo'})));
 await page.goto('/app');
 await expect(page).toHaveURL(/\/login\/profissional/);
 await expect(page.getByRole('heading',{name:/Olá, Rafael/})).toHaveCount(0);
});
test('página inicial cabe no celular',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:'test-results/home-mobile.png',fullPage:true});
});
