import {test,expect} from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:4175'});
test('prévia permite escolher sem criar reservas reais',async({page})=>{
 const bookings:string[]=[];page.on('request',r=>{if(r.url().includes('/rpc/book_public_appointment'))bookings.push(r.url());});
 await page.goto('/');await expect(page.getByText('Cadastre serviços, profissionais e horários.',{exact:true})).toBeHidden();await page.locator('summary').filter({hasText:'Seu negócio'}).click();await expect(page.getByText('Cadastre serviços, profissionais e horários.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Consultas',exact:true}).click();await expect(page.getByRole('heading',{name:'Consulta individual'})).toBeVisible();const day=page.locator('.future-dates button').nth(1);await day.click();await expect(day).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'14:30',exact:true}).click();await page.getByRole('button',{name:'Experimentar agendamento'}).click();await expect(page.getByRole('status')).toContainText('É simples assim.');await expect(page.getByRole('status')).toContainText('14:30');await expect(page.getByRole('status')).toContainText('Nenhuma reserva foi criada.');expect(bookings).toHaveLength(0);
 await page.getByRole('button',{name:'Experimentar de novo'}).click();await page.getByRole('button',{name:'Aulas',exact:true}).click();await expect(page.getByRole('heading',{name:'Aula particular'})).toBeVisible();
});
test('início é responsivo e respeita movimento reduzido',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.goto('/');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await expect(page.getByRole('link',{name:'Organizar meu negócio'})).toBeVisible();}
 expect(await page.locator('.future-copy').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await page.screenshot({path:'test-results/future-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/future-mobile.png',fullPage:true});
});
