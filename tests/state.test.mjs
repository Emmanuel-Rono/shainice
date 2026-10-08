import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState,writeValue,getValue,mergeStates,sameEntries,validState,monthProgress,reviewComplete,weekKey,safeUrl } from '../public/state.js';

test('a month needs practical work and an actual review',()=>{
  const s=emptyState();for(let i=0;i<4;i++)writeValue(s,`m1:week:${i}`,true);
  writeValue(s,'m1:resource',true);writeValue(s,'m1:result',true);
  assert.equal(monthProgress(s,'m1').count,6);assert.equal(monthProgress(s,'m1').complete,false);
  writeValue(s,'m1:review:complete',true);assert.equal(reviewComplete(s,'m1'),false);
  for(const [field,val] of [['date','2026-10-25'],['understanding','Explained in her own words'],['action','Check one claim']])writeValue(s,`m1:review:${field}`,val);
  assert.equal(monthProgress(s,'m1').complete,true);
  writeValue(s,'m1:week:0',false);assert.equal(monthProgress(s,'m1').complete,false);
});
test('two devices merge separate edits, newer values and deletion tombstones',()=>{
  const a=emptyState(),b=emptyState();writeValue(a,'m1:week:0',true,100);writeValue(b,'m1:review:action','Discuss work',101);
  const merged=mergeStates(a,b);assert.equal(getValue(merged,'m1:week:0'),true);assert.equal(getValue(merged,'m1:review:action'),'Discuss work');
  writeValue(a,'evidence:abc',{title:'First work'},110);writeValue(b,'evidence:abc',null,111);
  assert.equal(mergeStates(a,b).entries['evidence:abc'].value,null);
  assert.ok(sameEntries(mergeStates(a,b),mergeStates(b,a)));
});
test('clock moves backwards without losing a later local edit',()=>{
  const s=emptyState();writeValue(s,'profile:name','A',100);writeValue(s,'profile:name','B',90);
  assert.equal(s.entries['profile:name'].updatedAt,101);assert.equal(getValue(s,'profile:name'),'B');
});
test('backup validation rejects bad versions, timestamps and unsafe keys',()=>{
  assert.equal(validState(emptyState()),true);assert.equal(validState({schemaVersion:2,entries:{}}),false);
  assert.equal(validState({schemaVersion:1,entries:{bad:{value:true,updatedAt:'x'}}}),false);
  assert.equal(validState(JSON.parse('{"schemaVersion":1,"entries":{"__proto__":{"value":true,"updatedAt":1}}}')),false);
});
test('calendar week uses Nairobi date at the UTC day boundary',()=>{
  assert.equal(weekKey(new Date('2026-10-04T22:30:00Z')),'2026-10-05');
  assert.equal(weekKey(new Date('2026-10-04T20:30:00Z')),'2026-09-28');
});
test('evidence links exclude executable protocols',()=>{
  assert.equal(safeUrl('javascript:alert(1)'),'');assert.equal(safeUrl('data:text/html,x'),'');assert.equal(safeUrl('https://example.com'),'https://example.com/');
});
