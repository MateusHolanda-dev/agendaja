import { test, expect, type Page } from '@playwright/test';

function futureDate(offset=14) {
  const date=new Date(); date.setDate(date.getDate()+offset);
  while(date.getDay()===0)date.setDate(date.getDate()+1);
  return date.toISOString().slice(0,10);
}

async function chooseSlot(page:Page,date=futureDate()) {
  await page.getByLabel('Escolher data do agendamento').fill(date);
  await expect(page.locator('.booking-slots button').first()).toBeVisible();
  await page.locator('.booking-slots button').first().click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
}

async function fillDetails(page:Page,name='Pedro Henrique',email='pedro@example.com') {
  await page.getByLabel('Nome completo',{exact:true}).fill(name);
  await page.getByLabel('E-mail',{exact:true}).fill(email);
  await page.getByLabel('Celular com DDD',{exact:true}).fill('85999990001');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
}

test('cliente reserva, reagenda e cancela o próprio atendimento, com persistência',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/login/cliente');
  await page.getByRole('button',{name:'Explorar demonstração'}).click();
  await expect(page).toHaveURL(/\/cliente$/);
  await expect(page.getByRole('heading',{name:/Olá, Pedro/})).toBeVisible();
  await page.getByRole('button',{name:'Novo agendamento'}).click();
  await page.locator('.booking-service').filter({hasText:'Corte masculino'}).click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.locator('.booking-person').filter({hasText:'Rafael Costa'}).click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  const date=futureDate();
  await chooseSlot(page,date);
  await fillDetails(page);
  await page.getByRole('button',{name:'Confirmar agendamento',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Seu próximo cuidado já tem hora.'})).toBeVisible();
  const saved=await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('agendaja-demo-v1')!);
    return data.appointments.at(-1) as {id:string;date:string;status:string};
  });
  expect(saved.date).toBe(date);
  await page.getByRole('link',{name:'Meus agendamentos'}).click();
  await expect(page).toHaveURL(/\/cliente$/);
  await page.reload();
  const article=page.locator('.customer-appointment').filter({hasText:'Corte masculino'}).last();
  await article.getByRole('button',{name:'Ver detalhes de Corte masculino'}).click();
  await article.getByRole('link',{name:'Reagendar',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`reschedule=${saved.id}`));
  await expect(page.getByRole('heading',{name:'Encontre seu melhor horário.'})).toBeVisible();
  await chooseSlot(page,futureDate(15));
  await fillDetails(page);
  await page.getByRole('button',{name:'Confirmar novo horário',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Seu novo horário está reservado.'})).toBeVisible();
  await page.getByRole('link',{name:'Meus agendamentos'}).click();
  const movedArticle=page.locator('.customer-appointment').filter({hasText:'Corte masculino'}).last();
  await movedArticle.getByRole('button',{name:'Ver detalhes de Corte masculino'}).click();
  await movedArticle.getByRole('button',{name:'Cancelar agendamento',exact:true}).click();
  await page.getByRole('button',{name:'Sim, cancelar',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  const state=await page.evaluate((id:string)=>JSON.parse(localStorage.getItem('agendaja-demo-v1')!).appointments.find((a:{id:string})=>a.id===id).status,saved.id);
  expect(state).toBe('cancelled');
  await page.getByRole('tab',{name:/Histórico/}).click();
  await expect(page.locator('.customer-appointment').filter({hasText:'Cancelado'}).filter({hasText:'Corte masculino'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('página pública permite demonstração como visitante e valida os dados',async({page})=>{
  await page.goto('/agendar/studio-aurora');
  await expect(page.getByText('Experiência de demonstração',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Continuar',exact:true})).toBeDisabled();
  await page.locator('.booking-service').filter({hasText:'Barba & acabamento'}).click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.locator('.booking-person').first().click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await chooseSlot(page);
  await expect(page.getByLabel('Nome completo',{exact:true})).toHaveValue('');
  await page.getByLabel('Nome completo',{exact:true}).fill('Visitante Teste');
  await page.getByLabel('E-mail',{exact:true}).fill('visitante@example.com');
  await page.getByLabel('Celular com DDD',{exact:true}).fill('85999999999');
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Confirme a autorização');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar agendamento',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Seu próximo cuidado já tem hora.'})).toBeVisible();
});

test('agendamento público cabe na tela de celular',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/agendar/studio-aurora');
  await expect(page.getByRole('heading',{name:'O que vamos cuidar hoje?'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({path:'test-results/booking-mobile.png',fullPage:true});
});
