export function initRealEstatePlan(): void {
  (function () {
    'use strict';

    var FHA_RATE = 0.061;
    var LLC_RATE = 0.07;
    var FHA_DOWN_PCT = 0.035;
    var LLC_DOWN_PCT = 0.2;
    var UPFRONT_MIP_PCT = 0.0175;
    var ANNUAL_MIP_PCT = 0.0055;
    var CLOSING_PCT = 0.03;
    var MONTHS = 360;
    var HYSA_TARGET = 50000;
    var PM_PCT = 0.08;
    var CAPEX_PCT = 0.05;

    var RECENT_KEY = 'real-estate-plan.recentMarkets';
    var API_BASE_KEY = 'real-estate-plan.apiBase';
    var MAX_RECENT = 15;
    var searchTimer: any = null;
    var selectedPlace: any = null;
    /** Full display name from geocode / AI (drives location-specific copy). */
    var currentMarketLabel = '';
    var nominatimResults: any[] = [];

    function apiOrigin() {
      if (
        typeof window !== 'undefined' &&
        (window as any).PennypathApiOrigin &&
        typeof (window as any).PennypathApiOrigin.getSafeApiBase === 'function'
      ) {
        return (window as any).PennypathApiOrigin.getSafeApiBase(API_BASE_KEY);
      }
      try {
        if (typeof window !== 'undefined' && window.location && window.location.protocol === 'http:') {
          return window.location.origin.replace(/\/$/, '');
        }
      } catch (e) {}
      return 'http://127.0.0.1:8787';
    }

    function loadRecent() {
      try {
        var raw = localStorage.getItem(RECENT_KEY);
        if (!raw) return [];
        var a = JSON.parse(raw);
        return Array.isArray(a) ? a : [];
      } catch (e) {
        return [];
      }
    }

    function saveRecent(arr: any[]) {
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, MAX_RECENT)));
      } catch (e) {}
    }

    function placeIdFromHit(hit: any) {
      if (!hit) return '';
      if (hit.place_id != null) return 'p_' + String(hit.place_id);
      if (hit.osm_type && hit.osm_id != null) return hit.osm_type + '_' + String(hit.osm_id);
      return 'll_' + String(hit.lat) + '_' + String(hit.lon);
    }

    function upsertRecent(entry: any) {
      var list = loadRecent().filter(function (x: any) {
        return x && x.id !== entry.id;
      });
      list.unshift(entry);
      saveRecent(list);
    }

    function applyCalculatorInputs(o: any) {
      function set(id: string, v: any) {
        var el = document.getElementById(id) as HTMLInputElement | null;
        if (el && v != null && Number.isFinite(Number(v))) el.value = String(v);
      }
      set('re-price', o.price);
      set('re-rent', o.rent);
      set('re-hoa', o.hoa);
      set('re-tax', o.taxRate);
      set('re-ins', o.ins);
      set('re-vac', o.vacancy);
    }

    function renderRecentList() {
      var ul = document.getElementById('re-recent-list');
      if (!ul) return;
      var list = loadRecent();
      if (!list.length) {
        ul.innerHTML = '<li class="re-recent-meta">No saved markets yet. Search a city and run AI research.</li>';
        return;
      }
      ul.innerHTML = list
        .map(function (r: any) {
          var when = r.researchedAt ? new Date(r.researchedAt).toLocaleString() : '';
          return (
            '<li data-place-id="' +
            String(r.id).replace(/"/g, '&quot;') +
            '">' +
            '<span style="flex:1; min-width:140px;"><strong>' +
            escapeHtml(r.label || 'Unknown') +
            '</strong>' +
            ' <span class="re-recent-meta">' +
            escapeHtml(when) +
            '</span></span>' +
            '<button type="button" class="linkish" data-action="load">Load</button>' +
            '<button type="button" class="linkish" data-action="refresh" style="color:var(--sage);">Refresh AI</button>' +
            '</li>'
          );
        })
        .join('');
    }

    function escapeHtml(s: any) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    /** "City, ST" from Nominatim-style labels; falls back to first segment. */
    function shortPlaceName(full: any) {
      var s = String(full || '').trim();
      if (!s) return '';
      var parts = s.split(',').map(function (p) {
        return p.trim();
      });
      if (parts.length >= 2) return parts[0] + ', ' + parts[1];
      return parts[0];
    }

    function shortCityOnly(full: any) {
      var s = String(full || '').trim();
      if (!s) return '';
      return s.split(',')[0].trim();
    }

    function refreshLocationCopy() {
      var lbl = currentMarketLabel;
      var short = shortPlaceName(lbl);
      var city = shortCityOnly(lbl);
      var has = !!lbl;

      var coverE = document.getElementById('re-cover-eyebrow');
      if (coverE) coverE.textContent = has ? short + ' · Investment planning' : 'Real estate · Investment planning';

      var heroTitle = document.getElementById('re-hero-title');
      if (heroTitle) {
        heroTitle.textContent = has ? 'Buying in ' + short + ' — Two Paths, One Goal.' : 'Buying rental property — Two Paths, One Goal.';
      }

      if (typeof document !== 'undefined' && (document as any).title !== undefined) {
        document.title = has ? 'Real Estate — ' + short : 'Real Estate — Investment Planner';
      }

      var verdictTitle = document.getElementById('re-verdict-title');
      if (verdictTitle) {
        verdictTitle.textContent = has ? 'Start with FHA in ' + (city || 'this market') + ' — LLC comes later.' : 'Start with FHA in your market — LLC comes later.';
      }

      var verdictBody = document.getElementById('re-verdict-body');
      if (verdictBody) {
        if (has) {
          verdictBody.innerHTML =
            'FHA keeps the entry ticket small enough to match a realistic HYSA timeline, while <strong>' +
            escapeHtml(city || short) +
            '</strong> is the market you’re modeling. Use the calculator to test rent-to-price math. An LLC + investment loan is often the right tool for <strong>property #2</strong>, once you have equity, documented rental history on taxes, and more dry powder for 20% down and reserves.';
        } else {
          verdictBody.innerHTML =
            'FHA keeps the entry ticket small enough to match a realistic HYSA timeline. Choose a city above to tie numbers to a real market. An LLC + investment loan is often the right tool for <strong>property #2</strong>, once you have equity, documented rental history on taxes, and more dry powder for 20% down and reserves.';
        }
      }

      var timelineFirst = document.getElementById('re-timeline-research-body');
      if (timelineFirst) {
        timelineFirst.textContent = has
          ? 'Study the ' + (city || 'local') + ' market, follow listings, and line up a local agent who knows condos/HOAs.'
          : 'Study your target market, follow listings, and line up a local agent who knows condos/HOAs.';
      }

      var sub = document.getElementById('re-market-snapshot-sub');
      if (sub) {
        sub.innerHTML = has
          ? '<strong>' + escapeHtml(short) + '</strong> — values reflect the calculator below.'
          : 'Select a city in <strong>Market &amp; location</strong> above; numbers update from your calculator inputs.';
      }
    }

    function updateMarketSnapshotFromCompute(c: any) {
      var lbl = currentMarketLabel;
      var short = shortPlaceName(lbl);
      var rent = parseNum(document.getElementById('re-rent') as any);
      var hoa = parseNum(document.getElementById('re-hoa') as any);
      var price = parseNum(document.getElementById('re-price') as any);

      var nameEl = document.getElementById('re-market-name');
      if (nameEl) {
        if (lbl) {
          nameEl.innerHTML = '<span class="re-star">★</span> ' + escapeHtml(short);
        } else {
          nameEl.innerHTML = '<span class="re-recent-meta">Search &amp; select a city</span>';
        }
      }

      function fmtCell(n: any) {
        return Number.isFinite(n) ? fmtMoney(n) : '—';
      }
      var rentEl = document.getElementById('re-market-rent');
      var hoaEl = document.getElementById('re-market-hoa');
      var priceEl = document.getElementById('re-market-price');
      var outEl = document.getElementById('re-market-outlook');
      if (rentEl) (rentEl as any).textContent = fmtCell(rent);
      if (hoaEl) (hoaEl as any).textContent = fmtCell(hoa);
      if (priceEl) (priceEl as any).textContent = fmtCell(price);

      if (outEl && c) {
        var posFha = c.fhaNet > 0;
        var posLlc = c.llcNet > 0;
        if (!lbl) {
          (outEl as any).textContent = '—';
        } else if (posFha && posLlc) {
          (outEl as any).textContent = 'Both paths positive (on these assumptions)';
        } else if (posFha && !posLlc) {
          (outEl as any).textContent = 'FHA positive on these numbers';
        } else if (!posFha && posLlc) {
          (outEl as any).textContent = 'LLC positive on these numbers';
        } else {
          (outEl as any).textContent = 'Neither path positive — revisit inputs';
        }
      }
    }

    function setSearchStatus(msg: any) {
      var el = document.getElementById('re-search-status');
      if (el) (el as any).textContent = msg || '';
    }

    function setAiNotes(html: any, show: any) {
      var el = document.getElementById('re-ai-notes');
      if (!el) return;
      (el as any).innerHTML = html || '';
      (el as any).hidden = !show;
    }

    function setCurrentLabel(text: any) {
      currentMarketLabel = String(text || '').trim();
      var el = document.getElementById('re-current-label');
      if (el) (el as any).textContent = currentMarketLabel || '—';
      refreshLocationCopy();
    }

    function setButtonsState() {
      var ai = document.getElementById('re-ai-btn') as HTMLButtonElement | null;
      var ref = document.getElementById('re-refresh-btn') as HTMLButtonElement | null;
      if (ai) ai.disabled = !selectedPlace;
      if (ref) ref.disabled = !selectedPlace;
    }

    async function fetchGeocode(q: any) {
      var base = apiOrigin();
      var url = base + '/api/geocode?q=' + encodeURIComponent(q);
      var res = await fetch(url);
      if (!res.ok) throw new Error('Geocode failed');
      return res.json();
    }

    function formatResearchError(j: any, resStatus: any) {
      var parts: any[] = [];
      var prov = j && (j.gemini || j.openai);
      if (j && typeof j.error === 'string') parts.push(j.error);
      if (prov && prov.message) parts.push(prov.message);
      if (prov && prov.type) parts.push('Type: ' + prov.type);
      if (prov && prov.status) parts.push('Status: ' + prov.status);
      if (prov && prov.code != null && prov.code !== '') parts.push('Code: ' + prov.code);
      if (prov && prov.param) parts.push('Param: ' + prov.param);
      if (prov && prov.httpStatus != null) parts.push('API HTTP: ' + prov.httpStatus);
      if (j && j.detail) parts.push(String(j.detail));
      if (j && j.keySent) {
        var ks = j.keySent;
        if (ks.full) parts.push('Key sent (full, DEBUG_API_KEY_IN_ERRORS): ' + ks.full);
        else parts.push('Key sent: len ' + ks.length + ' · ' + ks.prefix + '…' + ks.suffix);
      }
      return parts.filter(Boolean).join(' — ') || 'Request failed (HTTP ' + resStatus + ')';
    }

    async function fetchAiResearch(place: any) {
      var base = apiOrigin();
      var res = await fetch(base + '/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeLabel: place.display_name || place.label,
          lat: place.lat != null ? Number(place.lat) : null,
          lon: place.lon != null ? Number(place.lon) : null,
        }),
      });
      var text = await res.text();
      var j: any;
      try {
        j = JSON.parse(text);
      } catch (e) {
        var bad: any = new Error('Server returned invalid JSON (HTTP ' + res.status + '): ' + text.slice(0, 280));
        bad.researchPayload = { rawBody: text };
        throw bad;
      }
      if (res.ok && j.ok) return j.data;
      var err: any = new Error(formatResearchError(j, res.status));
      err.researchPayload = j;
      throw err;
    }

    function mapAiToInputs(data: any) {
      function n(x: any) {
        var v = Number(x);
        return Number.isFinite(v) ? v : NaN;
      }
      return {
        price: n(data.purchasePrice),
        rent: n(data.monthlyRent),
        hoa: n(data.monthlyHoa),
        taxRate: n(data.propertyTaxRatePercent),
        ins: n(data.insuranceMonthly),
        vacancy: n(data.vacancyPercent),
      };
    }

    function runAiForPlace(place: any, isRefresh: any) {
      setSearchStatus(isRefresh ? 'Refreshing AI estimates…' : 'Researching market with AI…');
      setAiNotes('', false);
      return fetchAiResearch(place)
        .then(function (data) {
          var inputs = mapAiToInputs(data);
          if (![inputs.price, inputs.rent, inputs.hoa, inputs.taxRate, inputs.ins, inputs.vacancy].every(function (x) { return Number.isFinite(x); })) {
            throw new Error('Invalid numbers from AI');
          }
          applyCalculatorInputs(inputs);
          var notes = data.notes ? String(data.notes) : '';
          setAiNotes('<strong>AI assumptions</strong> ' + escapeHtml(notes), true);
          var pid = placeIdFromHit(place);
          var label = place.display_name || place.label || 'Unknown';
          setCurrentLabel(label);
          var entry: any = {
            id: pid,
            label: label,
            lat: place.lat != null ? Number(place.lat) : null,
            lon: place.lon != null ? Number(place.lon) : null,
            display_name: label,
            inputs: inputs,
            aiNotes: notes,
            researchedAt: new Date().toISOString(),
          };
          selectedPlace = { place_id: place.place_id, osm_type: place.osm_type, osm_id: place.osm_id, lat: place.lat, lon: place.lon, display_name: label };
          upsertRecent(entry);
          renderRecentList();
          setSearchStatus(isRefresh ? 'Refreshed.' : 'Estimates applied. Review and edit as needed.');
          render();
        })
        .catch(function (err: any) {
          var msg = err && err.message ? err.message : String(err);
          setSearchStatus('Error: ' + msg);
          var pay = err.researchPayload;
          var html =
            '<strong>Could not load AI estimates.</strong><p style="margin-top:8px;line-height:1.45;">' +
            escapeHtml(msg) +
            '</p>';
          var geminiInvalid =
            pay &&
            pay.gemini &&
            (pay.gemini.status === 'PERMISSION_DENIED' ||
              (pay.gemini.message && /API key|api key|API_KEY|PERMISSION_DENIED/i.test(pay.gemini.message)));
          var openaiInvalid = pay && pay.openai && pay.openai.code === 'invalid_api_key';
          if (geminiInvalid || openaiInvalid) {
            html +=
              '<p class="balance-field-hint" style="margin-top:10px;">Put your real <code>GEMINI_API_KEY</code> in <code>.env</code> next to <code>package.json</code> (get a key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>), then restart <code>npm run research-server</code>. The server log should say the key is <strong>from .env file</strong>.</p>';
          }
          var rawSnip = pay && ((pay.gemini && pay.gemini.rawSnippet) || (pay.openai && pay.openai.rawSnippet));
          if (rawSnip) {
            html +=
              '<details style="margin-top:10px;"><summary style="cursor:pointer;font-weight:700;">Raw API response (debug)</summary>' +
              '<pre style="margin-top:8px;white-space:pre-wrap;font-size:11px;overflow:auto;max-height:180px;background:rgba(60,68,82,0.06);padding:10px;border-radius:8px;">' +
              escapeHtml(String(rawSnip).slice(0, 4000)) +
              '</pre></details>';
          } else if (pay && pay.rawBody) {
            html += '<pre style="margin-top:8px;white-space:pre-wrap;font-size:11px;">' + escapeHtml(String(pay.rawBody).slice(0, 800)) + '</pre>';
          } else {
            html +=
              '<p class="balance-field-hint" style="margin-top:10px;">If the key is set, check <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener">Gemini API billing / quota</a>. Run <code>npm run research-server</code> and open <code>http://127.0.0.1:8787/real-estate-plan.html</code>.</p>';
          }
          setAiNotes(html, true);
        });
    }

    function wireMarketSearch() {
      var input = document.getElementById('re-search-input') as HTMLInputElement | null;
      var drop = document.getElementById('re-search-dropdown') as HTMLElement | null;
      var aiBtn = document.getElementById('re-ai-btn') as HTMLButtonElement | null;
      var refBtn = document.getElementById('re-refresh-btn') as HTMLButtonElement | null;
      var recent = document.getElementById('re-recent-list') as HTMLElement | null;

      if (input) {
        const inputEl = input;
        input.addEventListener('input', function () {
          clearTimeout(searchTimer);
          var q = String(inputEl.value || '').trim();
          if (q.length < 2) {
            if (drop) {
              drop.hidden = true;
              drop.innerHTML = '';
            }
            nominatimResults = [];
            return;
          }
          searchTimer = setTimeout(function () {
            fetchGeocode(q)
              .then(function (hits) {
                nominatimResults = Array.isArray(hits) ? hits : [];
                if (!drop) return;
                if (!nominatimResults.length) {
                  drop.innerHTML = '';
                  drop.hidden = true;
                  return;
                }
                drop.innerHTML = nominatimResults
                  .map(function (h: any, i: number) {
                    var label = h.display_name || '';
                    return '<button type="button" role="option" data-idx="' + i + '">' + escapeHtml(label) + '</button>';
                  })
                  .join('');
                drop.hidden = false;
              })
              .catch(function () {
                setSearchStatus('Place search unavailable. Use the local server (see instructions above).');
                if (drop) {
                  drop.hidden = true;
                }
              });
          }, 380);
        });
      }

      if (drop) {
        const dropEl = drop;
        drop.addEventListener('click', function (e: any) {
          var btn = e.target.closest('button[data-idx]');
          if (!btn) return;
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          var hit = nominatimResults[idx];
          if (!hit) return;
          selectedPlace = hit;
          setCurrentLabel(hit.display_name || '');
          if (input) input.value = hit.display_name || '';
          dropEl.hidden = true;
          setButtonsState();
          setSearchStatus('Place selected. Click “Research with AI” to fill numbers.');
        });
      }

      if (aiBtn) {
        aiBtn.addEventListener('click', function () {
          if (!selectedPlace) return;
          runAiForPlace(selectedPlace, false);
        });
      }
      if (refBtn) {
        refBtn.addEventListener('click', function () {
          if (!selectedPlace) return;
          runAiForPlace(selectedPlace, true);
        });
      }

      if (recent) {
        recent.addEventListener('click', function (e: any) {
          var btn = e.target.closest('button[data-action]');
          if (!btn) return;
          var li = btn.closest('li');
          var id = li && li.getAttribute('data-place-id');
          var list = loadRecent();
          var entry = list.find(function (x: any) {
            return x && String(x.id) === String(id);
          });
          if (!entry) return;
          if (btn.getAttribute('data-action') === 'load') {
            selectedPlace = {
              place_id: entry.id,
              lat: entry.lat,
              lon: entry.lon,
              display_name: entry.label,
            };
            applyCalculatorInputs(entry.inputs);
            setCurrentLabel(entry.label);
            setAiNotes(entry.aiNotes ? '<strong>Saved notes</strong> ' + escapeHtml(entry.aiNotes) : '', !!entry.aiNotes);
            setSearchStatus('Loaded from history (no new AI call).');
            setButtonsState();
            render();
          } else if (btn.getAttribute('data-action') === 'refresh') {
            selectedPlace = {
              lat: entry.lat,
              lon: entry.lon,
              display_name: entry.label,
            };
            runAiForPlace(selectedPlace, true);
          }
        });
      }

      document.addEventListener('click', function (e: any) {
        if (!drop || drop.hidden) return;
        if (e.target === input || (drop && drop.contains(e.target))) return;
        if (input && input.contains(e.target)) return;
        drop.hidden = true;
      });

      renderRecentList();
      setButtonsState();
      if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
        setSearchStatus('Tip: run npm run research-server and open http://127.0.0.1:8787/real-estate-plan.html for search + AI.');
      }
    }

    function parseNum(el: any) {
      if (!el) return NaN;
      var s = String(el.value || '').replace(/,/g, '').trim();
      if (s === '') return NaN;
      var n = parseFloat(s);
      return Number.isFinite(n) ? n : NaN;
    }

    function piPayment(principal: any, annualRate: any, n: any) {
      if (principal <= 0) return 0;
      var r = annualRate / 12;
      if (r === 0) return principal / n;
      return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
    }

    function fmtMoney(n: any) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
    }

    function fmtMoneyAcct(n: any) {
      var abs = Math.abs(n);
      var s = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(abs);
      if (n > 0) return '<span class="acct-pos">' + s + '</span>';
      if (n < 0) return '<span class="acct-neg">(' + s + ')</span>';
      return '<span>' + s + '</span>';
    }

    function line(label: any, fhaHtml: any, llcHtml: any) {
      return '<tr><td>' + label + '</td><td>' + fhaHtml + '</td><td>' + llcHtml + '</td></tr>';
    }

    function kvRow(label: any, value: any) {
      return '<div class="re-kv"><span>' + label + '</span><span>' + value + '</span></div>';
    }

    function compute(inputs: any) {
      var price = inputs.price;
      var rent = inputs.rent;
      var hoa = inputs.hoa;
      var taxRate = inputs.taxRate;
      var ins = inputs.ins;
      var vacPct = inputs.vacancy;

      var fhaDown = price * FHA_DOWN_PCT;
      var fhaBaseLoan = price - fhaDown;
      var upfrontMIP = fhaBaseLoan * UPFRONT_MIP_PCT;
      var fhaLoan = fhaBaseLoan + upfrontMIP;
      var fhaPI = piPayment(fhaLoan, FHA_RATE, MONTHS);
      var fhaMonthlyMIP = fhaLoan * (ANNUAL_MIP_PCT / 12);
      var fhaClosing = price * CLOSING_PCT;
      var fhaCash = fhaDown + fhaClosing;

      var llcDown = price * LLC_DOWN_PCT;
      var llcLoan = price - llcDown;
      var llcPI = piPayment(llcLoan, LLC_RATE, MONTHS);
      var llcClosing = price * CLOSING_PCT;
      var llcCash = llcDown + llcClosing;

      var vacancyAmt = rent * (vacPct / 100);
      var egi = rent - vacancyAmt;
      var taxMo = (price * (taxRate / 100)) / 12;
      var capex = egi * CAPEX_PCT;
      var includePM = inputs.includePM !== false;
      var pm = includePM ? egi * PM_PCT : 0;

      var fhaNet = egi - fhaPI - taxMo - ins - hoa - fhaMonthlyMIP - capex - pm;
      var llcNet = egi - llcPI - taxMo - ins - hoa - capex - pm;

      var fhaAnnual = fhaNet * 12;
      var llcAnnual = llcNet * 12;
      var fhaCoc = fhaCash > 0 ? (fhaAnnual / fhaCash) * 100 : 0;
      var llcCoc = llcCash > 0 ? (llcAnnual / llcCash) * 100 : 0;

      return {
        fhaDown: fhaDown,
        fhaLoan: fhaLoan,
        fhaPI: fhaPI,
        fhaMonthlyMIP: fhaMonthlyMIP,
        fhaClosing: fhaClosing,
        fhaCash: fhaCash,
        llcDown: llcDown,
        llcLoan: llcLoan,
        llcPI: llcPI,
        llcClosing: llcClosing,
        llcCash: llcCash,
        rent: rent,
        vacancyAmt: vacancyAmt,
        egi: egi,
        taxMo: taxMo,
        ins: ins,
        hoa: hoa,
        capex: capex,
        pm: pm,
        fhaNet: fhaNet,
        llcNet: llcNet,
        fhaAnnual: fhaAnnual,
        llcAnnual: llcAnnual,
        fhaCoc: fhaCoc,
        llcCoc: llcCoc,
        includePM: includePM,
      };
    }

    function render() {
      var price = parseNum(document.getElementById('re-price') as any);
      var rent = parseNum(document.getElementById('re-rent') as any);
      var hoa = parseNum(document.getElementById('re-hoa') as any);
      var taxRate = parseNum(document.getElementById('re-tax') as any);
      var ins = parseNum(document.getElementById('re-ins') as any);
      var vac = parseNum(document.getElementById('re-vac') as any);
      var includePmEl = document.getElementById('re-include-pm') as HTMLInputElement | null;
      var includePM = includePmEl ? includePmEl.checked : true;

      if ([price, rent, hoa, taxRate, ins, vac].some(function (x) { return !Number.isFinite(x); })) {
        return;
      }

      var c = compute({
        price: price,
        rent: rent,
        hoa: hoa,
        taxRate: taxRate,
        ins: ins,
        vacancy: vac,
        includePM: includePM,
      });

      var fhaKv = document.getElementById('re-fha-kv') as HTMLElement | null;
      var llcKv = document.getElementById('re-llc-kv') as HTMLElement | null;
      if (fhaKv) {
        fhaKv.innerHTML =
          kvRow('Down payment', fmtMoney(c.fhaDown)) +
          kvRow('Loan amount', fmtMoney(c.fhaLoan)) +
          kvRow('Interest rate', (FHA_RATE * 100).toFixed(1) + '%') +
          kvRow('P&amp;I payment', fmtMoney(c.fhaPI)) +
          kvRow('MIP (monthly)', fmtMoney(c.fhaMonthlyMIP)) +
          kvRow('Closing costs (~3%)', fmtMoney(c.fhaClosing)) +
          kvRow('Total cash needed', fmtMoney(c.fhaCash));
      }
      if (llcKv) {
        llcKv.innerHTML =
          kvRow('Down payment', fmtMoney(c.llcDown)) +
          kvRow('Loan amount', fmtMoney(c.llcLoan)) +
          kvRow('Interest rate', (LLC_RATE * 100).toFixed(1) + '%') +
          kvRow('P&amp;I payment', fmtMoney(c.llcPI)) +
          kvRow('MIP', '—') +
          kvRow('Closing costs (~3%)', fmtMoney(c.llcClosing)) +
          kvRow('Total cash needed', fmtMoney(c.llcCash));
      }

      var tbody = document.getElementById('re-cf-tbody') as HTMLElement | null;
      if (tbody) {
        tbody.innerHTML =
          line('Gross rent', fmtMoneyAcct(c.rent), fmtMoneyAcct(c.rent)) +
          line('Vacancy deduction', fmtMoneyAcct(-c.vacancyAmt), fmtMoneyAcct(-c.vacancyAmt)) +
          line('Effective gross income', fmtMoneyAcct(c.egi), fmtMoneyAcct(c.egi)) +
          line('P&amp;I', fmtMoneyAcct(-c.fhaPI), fmtMoneyAcct(-c.llcPI)) +
          line('Property tax', fmtMoneyAcct(-c.taxMo), fmtMoneyAcct(-c.taxMo)) +
          line('Insurance', fmtMoneyAcct(-c.ins), fmtMoneyAcct(-c.ins)) +
          line('HOA', fmtMoneyAcct(-c.hoa), fmtMoneyAcct(-c.hoa)) +
          line('FHA MIP', fmtMoneyAcct(-c.fhaMonthlyMIP), '—') +
          line('CapEx reserve (5% of EGI)', fmtMoneyAcct(-c.capex), fmtMoneyAcct(-c.capex)) +
          line(c.includePM ? 'Property management (8% of EGI)' : 'Property management (self-managed)', fmtMoneyAcct(-c.pm), fmtMoneyAcct(-c.pm)) +
          line('<strong>Net monthly cash flow</strong>', fmtMoneyAcct(c.fhaNet), fmtMoneyAcct(c.llcNet)) +
          line('<strong>Annual cash flow</strong>', fmtMoneyAcct(c.fhaAnnual), fmtMoneyAcct(c.llcAnnual)) +
          line(
            '<strong>Cash-on-cash return</strong>',
            '<span class="acct-pos">' + c.fhaCoc.toFixed(1) + '%</span>',
            '<span class="acct-pos">' + c.llcCoc.toFixed(1) + '%</span>'
          );
      }

      var scenario = document.getElementById('re-cf-scenario') as HTMLElement | null;
      if (scenario) {
        var posFha = c.fhaNet > 0;
        var posLlc = c.llcNet > 0;
        scenario.className = 'callout';
        (scenario as any).style.borderLeftColor = '';
        (scenario as any).style.background = '';
        if (posFha && posLlc) {
          scenario.classList.add('sage');
          scenario.innerHTML =
            '<strong>Both paths positive (on these assumptions)</strong> Keep reserves for vacancy, HOA spikes, and insurance renewals. Re-run when you have a real insurance quote and HOA budget.';
        } else if (posFha && !posLlc) {
          scenario.classList.add('blue');
          scenario.innerHTML =
            '<strong>Only FHA is positive on these numbers</strong> Lower monthly carry (vs LLC here) often comes from smaller down + lower rate, net of MIP. Validate owner-occupancy plans; LLC may still win on other deals.';
        } else if (!posFha && posLlc) {
          scenario.classList.add('sage');
          scenario.innerHTML =
            '<strong>Only the LLC path is positive here</strong> Usually driven by avoiding FHA MIP — but it needs much more cash up front. Re-check rent, HOA, and insurance; FHA can still win on total dollars in other scenarios.';
        } else {
          scenario.classList.add('red');
          scenario.innerHTML =
            '<strong>Neither path is positive at these inputs</strong> Raise rent, lower price, reduce HOA, or increase down payment before shopping — or treat as a long-term appreciation play only with eyes open.';
        }
      }

      var fhaCashEl = document.getElementById('re-stat-fha-cash');
      var llcCashEl = document.getElementById('re-stat-llc-cash');
      if (fhaCashEl) (fhaCashEl as any).textContent = fmtMoney(c.fhaCash);
      if (llcCashEl) (llcCashEl as any).textContent = fmtMoney(c.llcCash);

      var leftFha = HYSA_TARGET - c.fhaCash;
      var leftLlc = HYSA_TARGET - c.llcCash;
      var hysaBody = document.getElementById('re-hysa-tbody') as HTMLElement | null;
      function rowClass(left: any) {
        return left >= 10000 ? 'acct-pos' : 'acct-neg';
      }
      if (hysaBody) {
        hysaBody.innerHTML =
          '<tr><td>FHA</td><td>' +
          fmtMoney(c.fhaCash) +
          '</td><td class="' +
          rowClass(leftFha) +
          '">' +
          fmtMoney(leftFha) +
          '</td></tr>' +
          '<tr><td>LLC</td><td>' +
          fmtMoney(c.llcCash) +
          '</td><td class="' +
          rowClass(leftLlc) +
          '">' +
          fmtMoney(leftLlc) +
          '</td></tr>';
      }

      var hysaCall = document.getElementById('re-hysa-callout') as HTMLElement | null;
      if (hysaCall) {
        hysaCall.innerHTML =
          '<strong>Why FHA can feel “sooner”</strong> Total cash to close is about <strong>' +
          fmtMoney(c.fhaCash) +
          '</strong> vs <strong>' +
          fmtMoney(c.llcCash) +
          '</strong> for LLC at this price — so your HYSA can cover the down + closing costs with more left for reserves, assuming a ~' +
          fmtMoney(HYSA_TARGET) +
          ' target.';
      }

      updateMarketSnapshotFromCompute(c);
    }

    function wire() {
      var btn = document.getElementById('re-recalc');
      var panel = document.getElementById('re-calculator-panel');
      var includePm = document.getElementById('re-include-pm');
      if (btn) btn.addEventListener('click', render);
      if (includePm) includePm.addEventListener('change', render);
      if (panel) {
        panel.addEventListener('keydown', function (e: any) {
          if (e.key === 'Enter') {
            e.preventDefault();
            render();
          }
        });
      }
      wireMarketSearch();
    }

    wire();
    refreshLocationCopy();
    render();
  })();
}

