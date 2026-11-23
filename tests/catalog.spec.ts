import {test,expect} from '@playwright/test';

test('estabelecimento configura catálogo e expediente e cliente usa as definições',async({page})=>{
 await page.goto('/login/profissional');await page.getByRole('button',{name:'Explorar demonstração'}).click();
 await expect(page.getByRole('button',{name:'Novo agendamento',exact:true})).toHaveCount(0);
 await page.getByRole('link',{name:'Catálogo e horários',exact:true}).first().click();
 await expect(page.getByRole('heading',{name:'Catálogo e horários',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Horários disponíveis/}).click();
 await page.getByLabel('Abertura',{exact:true}).fill('10:00');await page.getByLabel('Encerramento',{exact:true}).fill('16:00');
 await page.getByRole('button',{name:/Salvar alterações/}).click();
 await expect(page.getByRole('status')).toContainText('Configurações salvas');
 await page.getByRole('button',{name:/Serviços do catálogo/}).click();await page.getByRole('button',{name:/Novo serviço/}).click();
 await page.getByLabel('Nome do serviço').fill('Consulta pelo cliente');await page.getByRole('dialog').getByLabel('Categoria',{exact:true}).fill('Consultas');await page.getByLabel('Preço (R$)',{exact:true}).fill('80');await page.getByLabel('Duração em minutos').fill('30');await page.getByRole('button',{name:'Salvar serviço',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:/Equipe e serviços/}).click();await page.getByRole('button',{name:'Novo profissional',exact:true}).click();await page.getByRole('dialog').getByLabel('Nome completo',{exact:true}).fill('Profissional de consultas');await page.getByRole('dialog').getByLabel('Consulta pelo cliente',{exact:false}).check();await page.getByRole('button',{name:'Salvar profissional',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.goto('/app/agenda?novo=1');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:/Agendar com/})).toHaveCount(0);
 await page.goto('/login/cliente');await page.evaluate(()=>sessionStorage.removeItem('agendaja-demo-user'));await page.reload();await page.getByRole('button',{name:'Explorar demonstração'}).click();await page.getByRole('button',{name:'Novo agendamento',exact:true}).click();
 await page.locator('.booking-service').filter({hasText:'Consulta pelo cliente'}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.locator('.booking-person').filter({hasText:'Profissional de consultas'}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();
 const date=new Date();date.setDate(date.getDate()+21);while(date.getDay()===0)date.setDate(date.getDate()+1);await page.getByLabel('Escolher data do agendamento').fill(date.toISOString().slice(0,10));
 await expect(page.locator('.booking-slots button').first()).toBeVisible();
 const slots=await page.locator('.booking-slots button').allTextContents();expect(slots[0]).toBe('10:00');expect(slots.at(-1)).toBe('15:30');
});

test('catálogo vazio orienta proprietário e mostra pendências',async({page})=>{
 await page.goto('/login/profissional');await page.getByRole('button',{name:'Explorar demonstração'}).click();
 await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('agendaja-demo-v1')!);data.services=[];data.professionals=[];localStorage.setItem('agendaja-demo-v1',JSON.stringify(data));});
 await page.goto('/app/catalogo');await expect(page.getByText('Há configurações pendentes',{exact:true})).toBeVisible();await expect(page.getByText('0 serviços ativos',{exact:true})).toBeVisible();
 await page.goto('/agendar/studio-aurora');await expect(page.getByRole('heading',{name:'O catálogo está sendo preparado'})).toBeVisible();await page.getByRole('link',{name:'Configurar meu catálogo'}).click();await expect(page).toHaveURL(/\/app\/catalogo$/);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
