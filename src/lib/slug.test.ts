import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSlug,suggestSlug,slugError,businessError} from './slug';
test('business names with accents and spaces become valid booking links',()=>{
 assert.equal(normalizeSlug('  Salão Áurea & Saúde 2026  '),'salao-aurea-saude-2026');
 assert.equal(suggestSlug('123 Serviços'),'negocio-123-servicos');
 assert.equal(slugError(suggestSlug('123 Serviços')),null);
 assert.equal(suggestSlug('Empresa '.repeat(20)).length<=61,true);
});
test('slug rules enforce database length and initial letter boundaries',()=>{
 for(const slug of ['a','ab','1ab','meu negócio','ABC','a'.repeat(62),''])assert.ok(slugError(slug));
 for(const slug of ['abc','meu-negocio-123','a'.repeat(61)])assert.equal(slugError(slug),null);
 assert.equal(normalizeSlug(' --- Minha___Empresa --- '),'minha-empresa');
});
test('database check and uniqueness errors are translated without exposing constraint names',()=>{
 assert.match(businessError({code:'23514',message:'new row violates check constraint "organizations_slug_check"'}),/começar com uma letra/);
 assert.match(businessError({code:'23505',message:'duplicate key violates unique constraint "organizations_slug_key"'}),/já está em uso/);
 assert.equal(businessError(new Error('Falha de rede')),'Falha de rede');
});
