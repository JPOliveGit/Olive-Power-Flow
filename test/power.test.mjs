import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
globalThis.HTMLElement=class {};
globalThis.customElements={get:()=>true};
globalThis.window={};
const {readWatts,signedWatts,calculatePower,normalizeConfig}=await import('../src/olive-power-flow.js');
const state=(value,unit='W')=>({state:String(value),attributes:{unit_of_measurement:unit}});
const config=normalizeConfig({production:[{entity:'solar'}],grid:{entity:'grid'},devices:[]});
test('W and kW input, including zero and export',()=>{
  assert.equal(readWatts(state(1.2,'kW')),1200);
  assert.equal(readWatts(state(0)),0);
  assert.equal(readWatts(state(-800)),-800);
  assert.equal(signedWatts(state(-800),true),800);
});
test('unavailable, empty and wrong units remain unknown',()=>{
  for(const s of [undefined,state('unknown'),state('unavailable'),state(''),state(' '),state('NaN'),state('Infinity'),state(20,'kWh')]) assert.equal(readWatts(s),null);
  assert.equal(signedWatts(state('unknown'),true),null);
});
test('solar and signed grid produce home consumption',()=>{
  assert.equal(calculatePower(config,{solar:state(2500),grid:state(-800)}).home,1700);
});
test('charging subtracts and discharging adds',()=>{
  const c=normalizeConfig({...config,battery:{entity:'battery'}});
  assert.equal(calculatePower(c,{solar:state(2500),grid:state(-800),battery:state(-500)}).home,1200);
  assert.equal(calculatePower(c,{solar:state(0),grid:state(100),battery:state(500)}).home,600);
});
test('inverted grid and battery signs',()=>{
  const c=normalizeConfig({...config,grid:{entity:'grid',invert:true},battery:{entity:'battery',invert:true}});
  assert.equal(calculatePower(c,{solar:state(2500),grid:state(800),battery:state(500)}).home,1200);
});
test('multiple production sources, no production and no battery',()=>{
  const c=normalizeConfig({...config,production:[{entity:'solar'},{entity:'solar2'}]});
  assert.equal(calculatePower(c,{solar:state(1,'kW'),solar2:state(1000),grid:state(500)}).home,2500);
  assert.equal(calculatePower(normalizeConfig({grid:{entity:'grid'}}),{grid:state(600)}).home,600);
});
test('unknown source propagates; unknown consumption is independent',()=>{
  assert.equal(calculatePower(config,{grid:state(100)}).home,null);
  const c=normalizeConfig({...config,devices:[{entity:'missing'}]});
  assert.equal(calculatePower(c,{solar:state(500),grid:state(200)}).home,700);
  assert.equal(calculatePower({...c,battery:{entity:'missing'}},{solar:state(500),grid:state(200)}).home,null);
});
test('negative totals are not silently clamped',()=>{
  assert.equal(calculatePower(config,{solar:state(100),grid:state(-200)}).home,-100);
});
test('config validation and cloning',()=>{
  assert.throws(()=>normalizeConfig({devices:'bad'}));
  assert.throws(()=>normalizeConfig({grid:'sensor.grid'}));
  assert.throws(()=>normalizeConfig({production:[null]}));
  const source={devices:[{entity:'first'}],grid:{entity:'grid'}};
  const copy=normalizeConfig(source);copy.devices[0].entity='second';copy.grid.entity='other';
  assert.equal(source.devices[0].entity,'first');assert.equal(source.grid.entity,'grid');
});
test('built file is identical to source and HACS filename matches',async()=>{
  const src=await readFile(new URL('../src/olive-power-flow.js',import.meta.url),'utf8');
  assert.equal(await readFile(new URL('../dist/olive-power-flow.js',import.meta.url),'utf8'),src);
  const manifest=JSON.parse(await readFile(new URL('../hacs.json',import.meta.url),'utf8'));
  assert.equal(manifest.filename,'olive-power-flow.js');assert.equal(manifest.render_readme,true);
});
