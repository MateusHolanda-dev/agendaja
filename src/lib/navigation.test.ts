import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeReturnPath,loginFor} from './navigation';
test('login retains the intended internal page, filters and anchor',()=>{
 for(const path of ['/app/clientes?busca=ana#dados','/app/agenda?data=2026-11-12','/cliente','/gestao','/onboarding','/agendar/meu-negocio?reschedule=123'])assert.equal(safeReturnPath(path),path);
 assert.equal(loginFor('profissional','/app/servicos'),'/login/profissional?redirect=%2Fapp%2Fservicos');
});
test('return targets cannot redirect to another origin or arbitrary URL',()=>{
 for(const path of [null,'https://evil.example','//evil.example','/\\evil.example','/app/%5cevil','/app/%0aevil','/app/../../evil','javascript:alert(1)','/login/profissional','/invalid'])assert.equal(safeReturnPath(path),null);
 assert.equal(loginFor('cliente','https://evil.example'),'/login/cliente');
});
