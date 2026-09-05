import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result=await build({entryPoints:['src/lib/register-state.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {registerSchema,registerQuery}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
test('register defaults and URL selection preserve filter and pagination state',()=>{
  assert.equal(registerSchema.parse({}).page,1);
  assert.equal(registerQuery('q=seal%25&location=North&page=3&sort=material_number&part=123'),'q=seal%25&location=North&page=3&sort=material_number');
});
test('reject invalid dates, quantity ranges, tenant identifiers and sort injection',()=>{
  for(const value of [{from:'2026-02-30'},{from:'2026-09-06',to:'2026-09-05'},{min:'9',max:'2'},{min:'-1'},{page:'0'},{page:'1.5'},{sort:'id; drop table items'},{creator:'not-a-uuid'},{direction:'sideways'},{condition:'Unknown'}])assert.equal(registerSchema.safeParse(value).success,false,JSON.stringify(value));
});
test('literal search punctuation passes intact to parameterized database query',()=>{
  const q='100%_ (test), \\ " apostrophe\'';assert.equal(registerSchema.parse({q}).q,q);
});
test('blank quantity remains unquantified; zero remains zero; invalid quantities fail',async()=>{
  const bundle=await build({entryPoints:['src/lib/validation.ts'],bundle:true,write:false,platform:'node',format:'esm'});
  const {itemSchema}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  assert.equal(itemSchema.parse({condition:'Good',quantity:''}).quantity,null);
  assert.equal(itemSchema.parse({condition:'Good',quantity:'0'}).quantity,0);
  for(const quantity of ['-1','1.5','2147483648'])assert.equal(itemSchema.safeParse({condition:'Good',quantity}).success,false);
});
