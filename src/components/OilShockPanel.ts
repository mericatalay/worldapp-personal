// OilShockPanel.ts – Oil Supply Shock Simulator
// Einbinden in App.ts: import { OilShockPanel } from './components/OilShockPanel';

export class OilShockPanel {
  private container: HTMLElement;
  private eiaApiKey: string;

  // Basisdaten
  private basePrice = 82;
  private supplyDrop = 20;
  private duration = 3;
  private opecCompensation = 30;
  private sprRelease = 20;

  constructor(container: HTMLElement) {
    this.container = container;
    this.eiaApiKey = (import.meta as any).env?.EIA_API_KEY || '';
    this.render();
    this.fetchEIAData();
  }

  // EIA Echtzeit-Öldaten laden
  private async fetchEIAData() {
    try {
      const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${this.eiaApiKey}&frequency=weekly&data[0]=value&facets[series][]=RBRTE&sort[0][column]=period&sort[0][direction]=desc&length=4`;
      const res = await fetch(url);
      const json = await res.json();
      const latest = json?.response?.data?.[0];
      if (latest?.value) {
        this.basePrice = Math.round(parseFloat(latest.value));
        this.updateMetrics();
      }
    } catch (e) {
      console.warn('EIA Daten nicht verfügbar, nutze Standardwert $82');
    }
  }

  private calcNetShock(): number {
    return this.supplyDrop * (1 - this.opecCompensation / 100) * (1 - (this.sprRelease / 100) * 0.5);
  }

  private calcPeakPrice(): number {
    const netShock = this.calcNetShock();
    return Math.round(this.basePrice * (1 + (netShock / 100) * 5.2));
  }

  private getSeverity(netShock: number): { label: string; color: string } {
    if (netShock < 5)  return { label: 'Gering',   color: '#1D9E75' };
    if (netShock < 15) return { label: 'Moderat',  color: '#BA7517' };
    if (netShock < 30) return { label: 'Schwer',   color: '#E24B4A' };
    return               { label: 'Kritisch', color: '#A32D2D' };
  }

  private getCountryRisk(netShock: number): Array<{ name: string; dep: number; score: number }> {
    const countries = [
      { name: 'Deutschland', dep: 94, sens: 0.9 },
      { name: 'USA',         dep: 18, sens: 0.4 },
      { name: 'China',       dep: 72, sens: 0.7 },
      { name: 'Japan',       dep: 99, sens: 1.1 },
      { name: 'Indien',      dep: 85, sens: 0.8 },
      { name: 'Frankreich',  dep: 98, sens: 0.85 },
    ];
    return countries.map(c => ({
      name: c.name,
      dep: c.dep,
      score: Math.min(100, Math.round((c.dep / 100) * netShock * c.sens * 3.5)),
    })).sort((a, b) => b.score - a.score);
  }

  private render() {
    this.container.innerHTML = `
      <div style="padding:16px;font-family:sans-serif;color:var(--text,#222)">
        <div style="font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:#888;margin-bottom:12px">
          Oil Supply Shock Simulator
          <span id="eia-badge" style="font-size:10px;background:#e1f5ee;color:#0f6e56;border-radius:99px;padding:2px 8px;margin-left:8px;font-weight:400">
            Lädt EIA-Daten...
          </span>
        </div>

        <!-- Basispreis -->
        <div style="background:#f5f5f3;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px">
          Aktueller Brent-Preis (EIA): <strong id="base-price-display">$${this.basePrice}</strong>
        </div>

        <!-- Schieberegler -->
        ${this.renderSlider('supply',  'Angebotsausfall',       this.supplyDrop,        0, 60,  '%')}
        ${this.renderSlider('dur',     'Schockdauer',           this.duration,          1, 24,  'Mo.')}
        ${this.renderSlider('opec',    'OPEC-Kompensation',     this.opecCompensation,  0, 100, '%')}
        ${this.renderSlider('spr',     'SPR-Freigabe',          this.sprRelease,        0, 100, '%')}

        <!-- Metriken -->
        <div id="metrics" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0"></div>

        <!-- Ländertabelle -->
        <div style="font-size:12px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">
          Länder-Risikomatrix
        </div>
        <table id="risk-table" style="width:100%;border-collapse:collapse;font-size:13px"></table>
      </div>
    `;

    // Event Listener für alle Slider
    ['supply', 'dur', 'opec', 'spr'].forEach(id => {
      const slider = this.container.querySelector(`#s-${id}`) as HTMLInputElement;
      const valueEl = this.container.querySelector(`#v-${id}`) as HTMLElement;
      if (slider && valueEl) {
        slider.addEventListener('input', () => {
          const unit = slider.dataset.unit || '';
          valueEl.textContent = slider.value + ' ' + unit;
          this.supplyDrop          = parseInt((this.container.querySelector('#s-supply') as HTMLInputElement).value);
          this.duration            = parseInt((this.container.querySelector('#s-dur')    as HTMLInputElement).value);
          this.opecCompensation    = parseInt((this.container.querySelector('#s-opec')   as HTMLInputElement).value);
          this.sprRelease          = parseInt((this.container.querySelector('#s-spr')    as HTMLInputElement).value);
          this.updateMetrics();
        });
      }
    });

    this.updateMetrics();
  }

  private renderSlider(id: string, label: string, value: number, min: number, max: number, unit: string): string {
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-size:13px;color:#666;min-width:170px">${label}</span>
        <input type="range" id="s-${id}" min="${min}" max="${max}" step="1" value="${value}"
          data-unit="${unit}"
          style="flex:1;accent-color:#1D9E75">
        <span id="v-${id}" style="font-size:13px;font-weight:500;min-width:44px;text-align:right">
          ${value} ${unit}
        </span>
      </div>
    `;
  }

  public updateMetrics() {
    const netShock  = this.calcNetShock();
    const peak      = this.calcPeakPrice();
    const inflation = (netShock * 0.08).toFixed(1);
    const gdpHit    = (netShock * 0.05).toFixed(2);
    const sev       = this.getSeverity(netShock);
    const pct       = Math.round(((peak - this.basePrice) / this.basePrice) * 100);

    // Badge aktualisieren
    const badge = this.container.querySelector('#eia-badge') as HTMLElement;
    if (badge) {
      badge.textContent = this.eiaApiKey ? 'EIA Live' : 'Schätzwert';
      badge.style.background = this.eiaApiKey ? '#e1f5ee' : '#faeeda';
      badge.style.color      = this.eiaApiKey ? '#0f6e56' : '#854f0b';
    }

    // Basispreis-Anzeige
    const basePriceEl = this.container.querySelector('#base-price-display') as HTMLElement;
    if (basePriceEl) basePriceEl.textContent = `$${this.basePrice}`;

    // Metrikkarten
    const metricsEl = this.container.querySelector('#metrics') as HTMLElement;
    if (metricsEl) {
      metricsEl.innerHTML = [
        { label: 'Ölpreis Peak',   value: `$${peak}`,       sub: `+${pct}% vs. heute`, color: '#E24B4A' },
        { label: 'Inflation (EU)', value: `+${inflation}%`, sub: 'Zusatzinflation',     color: '#BA7517' },
        { label: 'BIP-Effekt',     value: `-${gdpHit}%`,    sub: 'Wachstumsverlust',    color: '#BA7517' },
        { label: 'Schweregrad',    value: sev.label,         sub: `Nettoshock ${Math.round(netShock)}%`, color: sev.color },
      ].map(m => `
        <div style="background:#f5f5f3;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:11px;color:#888;margin-bottom:4px">${m.label}</div>
          <div style="font-size:18px;font-weight:500;color:${m.color}">${m.value}</div>
          <div style="font-size:11px;color:#aaa;margin-top:2px">${m.sub}</div>
        </div>
      `).join('');
    }

    // Ländertabelle
    const tableEl = this.container.querySelector('#risk-table') as HTMLTableElement;
    if (tableEl) {
      const countries = this.getCountryRisk(netShock);
      tableEl.innerHTML = `
        <thead>
          <tr style="border-bottom:1px solid #eee">
            <th style="text-align:left;padding:6px 8px;font-weight:400;color:#888;font-size:12px">Land</th>
            <th style="text-align:left;padding:6px 8px;font-weight:400;color:#888;font-size:12px">Import-Abhängigkeit</th>
            <th style="text-align:left;padding:6px 8px;font-weight:400;color:#888;font-size:12px">Risiko</th>
            <th style="text-align:left;padding:6px 8px;font-weight:400;color:#888;font-size:12px">Status</th>
          </tr>
        </thead>
        <tbody>
          ${countries.map(c => {
            const barColor  = c.score > 65 ? '#E24B4A' : c.score > 35 ? '#EF9F27' : '#1D9E75';
            const badgeText = c.score > 65 ? 'Hoch' : c.score > 35 ? 'Mittel' : 'Gering';
            const badgeBg   = c.score > 65 ? '#fcebeb' : c.score > 35 ? '#faeeda' : '#eaf3de';
            const badgeClr  = c.score > 65 ? '#a32d2d' : c.score > 35 ? '#633806' : '#27500a';
            return `
              <tr style="border-bottom:0.5px solid #f0f0ee">
                <td style="padding:7px 8px;font-weight:500">${c.name}</td>
                <td style="padding:7px 8px">${c.dep}%</td>
                <td style="padding:7px 8px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="background:#eee;border-radius:4px;height:6px;width:80px;overflow:hidden">
                      <div style="background:${barColor};height:6px;width:${c.score}%;border-radius:4px"></div>
                    </div>
                    <span style="font-size:11px;color:#aaa">${c.score}</span>
                  </div>
                </td>
                <td style="padding:7px 8px">
                  <span style="background:${badgeBg};color:${badgeClr};border-radius:99px;padding:2px 10px;font-size:11px;font-weight:500">
                    ${badgeText}
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      `;
    }
  }
}
