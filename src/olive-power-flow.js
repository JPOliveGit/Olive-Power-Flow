/** Olive Power Flow v0.1.0 | MIT License */
export function readWatts(state) {
  if (!state || typeof state.state !== 'string' || !state.state.trim()) return null;
  const value = Number(state.state), unit = state.attributes?.unit_of_measurement;
  return Number.isFinite(value) && ['W','kW'].includes(unit) ? value * (unit === 'kW' ? 1000 : 1) : null;
}
export function signedWatts(state, invert = false) {
  const value = readWatts(state);
  return value === null ? null : value * (invert ? -1 : 1);
}
export function normalizeConfig(config) {
  const result = { ...config, production: config.production || [], grid: config.grid || { entity: '' }, devices: config.devices || [] };
  for (const key of ['production','devices']) {
    if (!Array.isArray(result[key]) || result[key].some(n => !n || typeof n !== 'object' || Array.isArray(n) || (n.entity !== undefined && typeof n.entity !== 'string'))) throw new Error(`${key}: expected a list of sensor objects`);
    result[key] = result[key].map(n => ({...n}));
  }
  for (const key of ['grid','battery']) {
    if (result[key] != null && (typeof result[key] !== 'object' || Array.isArray(result[key]))) throw new Error(`${key}: expected a sensor object`);
    if (result[key]) result[key] = {...result[key]};
  }
  return result;
}
export function calculatePower(config, states) {
  const sources = [...config.production, config.grid, ...(config.battery ? [config.battery] : [])];
  const values = sources.map(n => signedWatts(states[n.entity], n.invert));
  return { home: values.some(n => n === null) ? null : values.reduce((a,b) => a+b,0) };
}
/* Home Assistant custom card. No external dependencies. */
class OlivePowerFlow extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  static getConfigElement() { return document.createElement('olive-power-flow-editor'); }
  static getStubConfig() { return { production: [{ entity: '' }], grid: { entity: '' }, devices: [] }; }
  setConfig(config) {
    this.config = normalizeConfig(config);
    this._signature = null;
    this.render();
  }
  set hass(value) {
    this._hass = value;
    if (!this.config) return;
    const entities = [...this.config.production, this.config.grid, this.config.battery, ...this.config.devices].filter(Boolean);
    const signature = JSON.stringify([value.locale?.language, ...entities.map(n => value.states[n.entity])]);
    if (signature !== this._signature) { this._signature = signature; this.render(); }
  }
  connectedCallback() {
    this._observer?.disconnect();
    this._observer = new ResizeObserver(entries => {
      const width = Math.round(entries[0].contentRect.width);
      if (width > 0 && width !== this._width) { this._width = width; this.render(); }
    });
    this._observer.observe(this);
  }
  disconnectedCallback() { this._observer?.disconnect(); }
  getGridOptions() { return { columns: 12, min_columns: 6, rows: 'auto' }; }
  getCardSize() { return Math.ceil((this._height || 700) / 50); }
  watts(entity) { return readWatts(this._hass?.states[entity]); }
  escape(value) {
    return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  render() {
    if (!this.config || !this._hass) return;
    const c = this.config, e = value => this.escape(value);
    const format = new Intl.NumberFormat(this._hass.locale?.language || 'pt-PT', { maximumFractionDigits: 0 });
    const palette = ['#e76798', '#8c69c9', '#20a19c', '#d59a35', '#5785ca', '#9aab48', '#bb7b56'];
    const width = Math.max(240, (this._width || 600) - 24);
    const sources = [
      ...c.production.map((n, i) => ({ ...n, name: n.name || (c.production.length > 1 ? `Solar ${i+1}` : 'Solar'), icon: 'mdi:solar-power', color: '#f5a018' })),
      { ...c.grid, name: c.grid.name || 'Rede', icon: 'mdi:transmission-tower', color: '#5197c2' },
      ...(c.battery ? [{ ...c.battery, name: c.battery.name || 'Bateria', icon: 'mdi:battery', color: '#20a19c' }] : [])
    ];
    const columns = Math.max(1, Math.floor(width / 145));
    const sourceColumns = Math.min(columns, sources.length);
    const sourceRows = Math.ceil(sources.length / sourceColumns);
    const deviceColumns = Math.min(columns, c.devices.length || 1);
    const rows = Math.ceil(c.devices.length / deviceColumns);
    const center = width / 2;
    const homeY = 65 + sourceRows * 174;
    const firstDeviceY = homeY + 174;
    const height = rows ? firstDeviceY + (rows-1)*174 + 90 : homeY + 90;
    this._height = height + 84;
    const values = calculatePower(c, this._hass.states);
    const position = (i, count, cols, firstY) => {
      const row = Math.floor(i / cols);
      const rowCount = Math.min(cols, count - row * cols);
      return { x: width / rowCount * ((i % cols) + 0.5), y: firstY + row * 174 };
    };
    const nodes = [
      ...sources.map((n, i) => ({ ...n, ...position(i, sources.length, sourceColumns, 65), value: signedWatts(this._hass.states[n.entity], n.invert) })),
      { name: c.home_name || 'Casa', icon: 'mdi:home', color: '#20a064', x: center, y: homeY, value: values.home },
      ...c.devices.map((n, i) => ({ ...n, ...position(i, c.devices.length, deviceColumns, firstDeviceY), name: n.name || this._hass.states[n.entity]?.attributes?.friendly_name || n.entity || `Consumo ${i+1}`, icon: n.icon || 'mdi:power-plug', color: palette[i % palette.length], value: this.watts(n.entity) }))
    ];
    const flow = (path, color, value) => `<path d="${path}" stroke="${color}" class="wire"/>${value !== null && Math.abs(value) > 0.5 ? `<circle r="3.5" fill="${color}" class="dot"><animateMotion dur="3s" repeatCount="indefinite" path="${path}" ${value < 0 ? 'keyPoints="1;0" keyTimes="0;1" calcMode="linear"' : ''}/></circle>` : ''}`;
    let wires = '';
    // Route multiple source rows along the outside, never through a source circle.
    nodes.slice(0, sources.length).forEach((n, i) => {
      const lastRow = Math.floor(i / sourceColumns) === sourceRows - 1;
      const endX = center + (i - (sources.length - 1)/2) * Math.min(10, 60/sources.length);
      const path = lastRow
        ? `M${n.x} ${n.y+48} V${n.y+100} Q${n.x} ${homeY-70} ${endX} ${homeY-70} V${homeY-48}`
        : `M${n.x} ${n.y+48} V${n.y+100} H8 V${homeY-70} H${endX} V${homeY-48}`;
      wires += flow(path, n.color, n.value);
    });
    if (rows) {
      const busY = homeY + 104;
      wires += `<path class="wire bus" d="M${center} ${homeY+48} V${busY}"/>`;
      if (rows > 1) wires += `<path class="wire bus" d="M${center} ${busY} H8 V${busY+(rows-1)*174}"/>`;
      for (let row = 0; row < rows; row++) {
        const members = nodes.slice(sources.length+1+row*deviceColumns, sources.length+1+(row+1)*deviceColumns);
        const start = rows > 1 ? 8 : Math.min(center,members[0].x);
        wires += `<path class="wire bus" d="M${start} ${busY+row*174} H${Math.max(center,members[members.length-1].x)}"/>`;
      }
      nodes.slice(sources.length+1).forEach(n => { wires += flow(`M${n.x} ${n.y-70} V${n.y-48}`,n.color,n.value); });
    }
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;min-width:0;width:100%}ha-card{display:block;box-sizing:border-box;width:100%;padding:20px 12px 12px;overflow:hidden;color:var(--primary-text-color)}
      h2{font:500 20px var(--paper-font-body1_-_font-family,sans-serif);margin:0 8px 6px}
      .subtitle{margin:0 8px 4px;color:var(--secondary-text-color);font-size:12px}
      .diagram{position:relative;width:100%;height:${height}px}
      svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
      .wire{fill:none;stroke-width:2;opacity:.7}.bus{stroke:var(--secondary-text-color,#aaa);opacity:.35}
      .node{position:absolute;transform:translateX(-50%);width:132px;padding:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer;text-align:center}
      .ring{box-sizing:border-box;width:96px;height:96px;margin:auto;border:3px solid var(--node-color);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;background:var(--ha-card-background,var(--card-background-color,#fff))}
      .node:disabled{cursor:default;opacity:1}.node:focus-visible{outline:2px solid var(--primary-color);outline-offset:4px;border-radius:8px}
      ha-icon{display:block;width:28px;height:28px;--mdc-icon-size:28px;color:var(--node-color)}
      .value{font-size:17px;white-space:nowrap;font-variant-numeric:tabular-nums}.label{display:block;font-size:13px;line-height:18px;margin-top:8px;color:var(--secondary-text-color);overflow-wrap:anywhere}
      .missing .ring{border-style:dashed;opacity:.55}
      @media(prefers-reduced-motion:reduce){.dot{display:none}}
    </style><ha-card><h2>${e(c.title || 'Distribuição de potência')}</h2><p class="subtitle">Potência instantânea · W</p>
    <div class="diagram"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${wires}</svg>${nodes.map((n, i) => {
      const value = n.value;
      const display = value === null ? '—' : format.format(value) + ' W';
      return `<button ${n.entity ? '' : 'disabled'} class="node ${value === null ? 'missing' : ''}" data-index="${i}" style="left:${n.x / width * 100}%;top:${n.y-48}px;--node-color:${n.color}" aria-label="${e(n.name)}: ${value === null ? 'indisponível' : e(display)}" title="${e(n.entity || 'Produção + rede + bateria')}${value === null ? ' — indisponível ou unidade diferente de W/kW' : ''}"><span class="ring"><ha-icon icon="${e(n.icon)}"></ha-icon><span class="value">${e(display)}</span></span><span class="label">${e(n.name)}</span></button>`;
    }).join('')}</div></ha-card>`;
    this.shadowRoot.querySelectorAll('.node').forEach(node => {
      const open = () => this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: nodes[Number(node.dataset.index)].entity }, bubbles: true, composed: true }));
      if (nodes[Number(node.dataset.index)].entity) node.addEventListener('click', open);

    });
  }
}
class OlivePowerFlowEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:'open'}); }
  setConfig(config) { this.config = normalizeConfig(config); this.render(); }
  set hass(value) { this._hass = value; if (!this.shadowRoot.querySelector('form')) this.render(); }
  emit() { this.dispatchEvent(new CustomEvent('config-changed', {detail:{config:this.config},bubbles:true,composed:true})); }
  render() {
    if (!this.config || !this._hass) return;
    const c=this.config, escape=value=>String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const sensors=Object.values(this._hass.states).filter(s=>s.entity_id?.startsWith('sensor.') && ['W','kW'].includes(s.attributes?.unit_of_measurement));
    const field=(label,key,value,type='text',extra='')=>`<label>${label}<input type="${type}" data-key="${key}" ${type==='checkbox' ? (value?'checked':'') : `value="${escape(value)}"`} ${extra}></label>`;
    const sensor=(n,key,label)=>`<fieldset><legend>${escape(label)}</legend>${field('Sensor (W/kW)',key+'.entity',n.entity,'text','list="power-sensors" placeholder="sensor.…"')}${field('Nome',key+'.name',n.name)}${key.startsWith('devices')?field('Ícone (opcional)',key+'.icon',n.icon,'text','placeholder="mdi:power-plug"'):field('Inverter sinal',key+'.invert',n.invert,'checkbox')}</fieldset>`;
    this.shadowRoot.innerHTML=`<style>:host{display:block}form{display:grid;gap:14px;font-family:inherit}label{display:grid;gap:6px;font-size:14px}input,button{font:inherit;color:var(--primary-text-color);background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#888);border-radius:6px;padding:10px;box-sizing:border-box;width:100%}input[type=checkbox]{width:20px;height:20px}fieldset{border:1px solid var(--divider-color,#888);border-radius:8px;display:grid;gap:12px;min-width:0}p{margin:0;color:var(--secondary-text-color);line-height:1.5}.counts{display:grid;grid-template-columns:1fr 1fr;gap:12px}</style>
    <form><p>Casa = produção + rede + bateria. Rede: positivo ao importar; bateria: positivo ao descarregar. Inverte o sinal se o teu sensor usar a convenção oposta.</p>
    ${field('Título','title',c.title || 'Distribuição de potência')}
    <div class="counts">${field('Sensores de produção','production_count',c.production.length,'number','min="0" max="50" step="1"')}${field('Sensores de consumo','device_count',c.devices.length,'number','min="0" max="100" step="1"')}</div>
    ${c.production.map((n,i)=>sensor(n,`production.${i}`,`Produção ${i+1}`)).join('')}
    ${sensor(c.grid,'grid','Ligação à rede')}
    ${field('Tenho bateria','has_battery',!!c.battery,'checkbox')}
    ${c.battery?sensor(c.battery,'battery','Bateria'):''}
    ${c.devices.map((n,i)=>sensor(n,`devices.${i}`,`Consumo ${i+1}`)).join('')}
    <datalist id="power-sensors">${sensors.map(s=>`<option value="${escape(s.entity_id)}">${escape(s.attributes.friendly_name || s.entity_id)}</option>`).join('')}</datalist></form>`;
    this.shadowRoot.querySelector('form').addEventListener('submit',event=>event.preventDefault());
    this.shadowRoot.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{
      const key=input.dataset.key;
      const next=normalizeConfig(this.config);
      let structural=false;
      if (key==='production_count' || key==='device_count') {
        const count=Number(input.value),max=key==='production_count'?50:100;
        if (!Number.isInteger(count)||count<0||count>max||input.value==='') { this.render(); return; }
        const list=key==='production_count'?'production':'devices';
        next[list]=Array.from({length:count},(_,i)=>next[list][i] || {entity:''});structural=true;
      } else if (key==='has_battery') {
        if (input.checked) next.battery={entity:''}; else delete next.battery;
        structural=true;
      } else {
        const parts=key.split('.');let target=next;
        for(const part of parts.slice(0,-1)) target=target[part];
        target[parts.at(-1)]=input.type==='checkbox'?input.checked:input.value.trim();
      }
      this.config=next;this.emit();if(structural)this.render();
    }));
  }
}
if (!customElements.get('olive-power-flow-editor')) customElements.define('olive-power-flow-editor',OlivePowerFlowEditor);
if (!customElements.get('olive-power-flow')) customElements.define('olive-power-flow', OlivePowerFlow);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'olive-power-flow', name: 'Olive Power Flow', description: 'Solar e rede → casa → medidores, em W.' });
