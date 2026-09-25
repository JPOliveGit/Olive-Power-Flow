import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try {
  const page=await browser.newPage({viewport:{width:1200,height:1100}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>body{margin:20px;background:#111;color:#eee;font-family:Arial;--ha-card-background:#202020;--primary-text-color:#eee;--secondary-text-color:#aaa}ha-card{background:#202020;border-radius:20px}</style>');
  // Use a fixed glyph to exercise icon sizing without importing Home Assistant internals.
  await page.evaluate(()=>customElements.define('ha-icon',class extends HTMLElement{connectedCallback(){this.textContent='◆';}}));
  await page.addScriptTag({path:fileURLToPath(new URL('../dist/olive-power-flow.js',import.meta.url)),type:'module'});
  await page.waitForFunction(()=>customElements.get('olive-power-flow'));
  await page.evaluate(()=>{
    window.cfg={production:[{entity:'sensor.solar'}],grid:{entity:'sensor.grid'},battery:{entity:'sensor.battery'},devices:['Ar condicionado','Escritório','IKEA','Secador','Servidor','Máquina de lavar'].map((name,i)=>({name,entity:'sensor.d'+i}))};
    window.hass={locale:{language:'pt-PT'},states:Object.fromEntries([['solar',2500],['grid',-800],['battery',-500],...Array.from({length:6},(_,i)=>['d'+i,i*10])].map(([id,value])=>['sensor.'+id,{entity_id:'sensor.'+id,state:String(value),attributes:{unit_of_measurement:'W',friendly_name:id}}]))};
    window.card=document.createElement('olive-power-flow');document.body.append(card);card.setConfig(cfg);card.hass=hass;
  });
  for(const [width,expected] of [[400,3],[600,2],[1000,1],[400,3]]) {
    await page.evaluate(w=>card.style.width=w+'px',width);
    await page.waitForFunction(w=>card._width===w,width);
    const actual=await page.evaluate(()=>({rows:new Set([...card.shadowRoot.querySelectorAll('.node')].slice(4).map(n=>n.getBoundingClientRect().top)).size,rings:[...card.shadowRoot.querySelectorAll('.ring')].map(n=>n.getBoundingClientRect().width),icons:[...card.shadowRoot.querySelectorAll('ha-icon')].map(n=>n.getBoundingClientRect().width),home:card.shadowRoot.querySelectorAll('.value')[3].textContent}));
    assert.equal(actual.rows,expected);assert.ok(actual.rings.every(n=>n===96));assert.ok(actual.icons.every(n=>n===28));assert.match(actual.home,/1.?200 W/);
  }
  assert.equal(await page.evaluate(()=>card.getGridOptions().columns),'full');
  assert.equal(await page.evaluate(()=>customElements.get('olive-power-flow').getStubConfig().grid_options.columns),'full');
  // Model Sections sizing: 12 cells only cover one third of a widened 36-cell section.
  await page.evaluate(()=>{
    window.section=document.createElement('div');
    section.style.cssText='display:grid;grid-template-columns:repeat(36,minmax(0,1fr));width:1080px';
    document.body.append(section);section.append(card);card.style.width='';
    card.style.gridColumn=card.getGridOptions().columns==='full'?'1 / -1':`span ${card.getGridOptions().columns}`;
  });
  await page.waitForFunction(()=>card._width===1080);
  assert.equal(await page.evaluate(()=>new Set([...card.shadowRoot.querySelectorAll('.node')].slice(4).map(n=>n.getBoundingClientRect().top)).size),1);
  await page.evaluate(()=>section.style.width='600px');
  await page.waitForFunction(()=>card._width===600);
  assert.equal(await page.evaluate(()=>new Set([...card.shadowRoot.querySelectorAll('.node')].slice(4).map(n=>n.getBoundingClientRect().top)).size),2);
  assert.equal(await page.evaluate(()=>card.shadowRoot.querySelector('.ring').getBoundingClientRect().width),96);
  await page.evaluate(()=>{document.body.append(card);section.remove();});
  await page.evaluate(()=>{window.info=null;card.addEventListener('hass-more-info',e=>window.info=e.detail.entityId);});
  await page.locator('olive-power-flow .node').first().click();
  assert.equal(await page.evaluate(()=>window.info),'sensor.solar');
  await page.evaluate(()=>{window.editor=document.createElement('olive-power-flow-editor');document.body.append(editor);editor.setConfig(cfg);editor.hass=hass;window.changes=[];editor.addEventListener('config-changed',e=>changes.push(e.detail.config));});
  await page.evaluate(()=>editor.setConfig({...cfg,grid_options:{columns:12,rows:9}}));
  await page.locator('olive-power-flow-editor input[data-key="full_width"]').check();
  assert.deepEqual(await page.evaluate(()=>changes.at(-1).grid_options),{columns:'full',rows:'auto'});
  const count=page.locator('olive-power-flow-editor input[data-key="device_count"]');
  await count.fill('7');await count.dispatchEvent('change');
  assert.equal(await page.evaluate(()=>changes.at(-1).devices.length),7);
  assert.equal(await page.locator('olive-power-flow-editor input[data-key="devices.6.entity"]').count(),1);
  assert.equal(await page.evaluate(()=>changes.at(-1).devices[0].entity),'sensor.d0');
  await page.locator('olive-power-flow-editor input[data-key="grid.invert"]').check();
  assert.equal(await page.evaluate(()=>changes.at(-1).grid.invert),true);
  await page.locator('olive-power-flow-editor input[data-key="has_battery"]').uncheck();
  assert.equal(await page.evaluate(()=>changes.at(-1).battery),undefined);
  await page.evaluate(()=>{card.setConfig(changes.at(-1));card.hass=hass;editor.remove();card.style.width='1100px';});
  await page.waitForFunction(()=>card._width===1100);
  assert.equal(await page.evaluate(()=>new Set([...card.shadowRoot.querySelectorAll('.node')].slice(3).map(n=>n.getBoundingClientRect().top)).size),1);
  if (process.env.PREVIEW_PATH) await page.screenshot({path:process.env.PREVIEW_PATH});
  // Names are text, not HTML; source updates recompute the total.
  await page.evaluate(()=>{const next={...cfg,title:'<img src=x onerror=alert(1)>'};card.setConfig(next);card.hass={...hass,states:{...hass.states,'sensor.solar':{...hass.states['sensor.solar'],state:'unknown'}}};});
  assert.equal(await page.locator('olive-power-flow img').count(),0);
  assert.equal(await page.locator('olive-power-flow .value').nth(3).textContent(),'—');
  assert.deepEqual(errors,[]);
  console.log('PASS: responsive 6/7 consumers, fixed circle/icon sizes, battery accounting, more-info, editor changes, unavailable and escaping.');
} finally {await browser.close();}
