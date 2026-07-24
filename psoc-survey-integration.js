(() => {
  'use strict';

  const SPECIAL_TEMPLATES = {
    'survey-phishing': {
      label: 'Encuesta de Perfil — Survey Phishing',
      page: 'phishing-survey.html',
      campaign: 'PH-2026-SURVEY',
      menuText: '▤ ENCUESTA PHISHING',
      menuAttribute: 'data-survey-phishing-link'
    },
    'headhunter-demo': {
      label: 'Head Hunter Demo — Recursos Humanos',
      page: 'phishing-headhunter.html',
      campaign: 'PH-2026-HEADHUNTER',
      menuText: '▣ HEAD HUNTER DEMO',
      menuAttribute: 'data-headhunter-phishing-link'
    }
  };

  const $ = id => document.getElementById(id);

  function findTemplateSelect() {
    return Array.from(document.querySelectorAll('select')).find(select => {
      const context = `${select.id} ${select.name} ${select.closest('.field')?.textContent || ''}`.toLowerCase();
      const optionText = Array.from(select.options).map(o => `${o.value} ${o.textContent}`).join(' ').toLowerCase();
      return /template|plantilla|escenario|tipo de campaña/.test(context) || /password-reset|microsoft|phishing/.test(optionText);
    });
  }

  function addMenuButtons() {
    const nav = document.querySelector('.sidebar .nav, nav.nav');
    if (!nav) return;
    const attackerView = Array.from(nav.querySelectorAll('button')).find(b => /ATTACKER.?S VIEW/i.test(b.textContent));

    Object.entries(SPECIAL_TEMPLATES).forEach(([value, config]) => {
      if (nav.querySelector(`[${config.menuAttribute}]`)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute(config.menuAttribute, 'true');
      button.textContent = config.menuText;
      button.addEventListener('click', () => {
        location.href = `./${config.page}?campaign=${encodeURIComponent(config.campaign)}&template=${encodeURIComponent(value)}`;
      });
      if (attackerView) nav.insertBefore(button, attackerView); else nav.appendChild(button);
    });

    if (!nav.querySelector('[data-cyber-journey-link]')) {
      const journey = document.createElement('button');
      journey.type = 'button';
      journey.setAttribute('data-cyber-journey-link', 'true');
      journey.textContent = '🏅 CYBER JOURNEY';
      journey.addEventListener('click', () => { location.href = './cyber-journey.html'; });
      if (attackerView) nav.insertBefore(journey, attackerView); else nav.appendChild(journey);
    }
  }

  function addSpecialTemplates() {
    const select = findTemplateSelect();
    if (!select) return null;
    Object.entries(SPECIAL_TEMPLATES).forEach(([value, config]) => {
      if (Array.from(select.options).some(o => o.value === value)) return;
      const option = document.createElement('option');
      option.value = value;
      option.textContent = config.label;
      select.appendChild(option);
    });
    return select;
  }

  function field(label, controlHtml, full = false) {
    const wrap = document.createElement('div');
    wrap.className = `field${full ? ' full' : ''}`;
    wrap.innerHTML = `<label>${label}</label>${controlHtml}`;
    return wrap;
  }

  function addCampaignPlanningFields() {
    const builder = document.querySelector('#campaign-builder .builder, #campaign-builder form, .builder');
    if (!builder || builder.querySelector('[data-campaign-planning-fields]')) return;

    const marker = document.createElement('div');
    marker.dataset.campaignPlanningFields = 'true';
    marker.className = 'full';
    marker.style.cssText = 'margin-top:6px;padding-top:12px;border-top:1px solid rgba(168,85,247,.22);font:800 10px Courier New,monospace;color:#00d9ff;letter-spacing:1px';
    marker.textContent = 'DESTINATARIO Y PLAN DE REENTRENAMIENTO';

    const email = field('Correo electrónico del colaborador', '<input id="campaign-email" name="recipientEmail" type="email" autocomplete="email" placeholder="colaborador@empresa.com"><small id="campaign-email-status" style="min-height:14px;color:#7890aa"></small>');
    const frequency = field('Frecuencia de la campaña', '<select id="campaign-frequency" name="frequency"><option value="once">Una sola vez</option><option value="monthly">Mensual</option><option value="2-months">Cada 2 meses</option><option value="3-months">Cada 3 meses</option><option value="4-months">Cada 4 meses</option><option value="6-months">Cada 6 meses</option><option value="annual">Anual</option></select>');
    const target = field('Objetivo de aprobación', '<select id="campaign-target-score" name="targetScore"><option value="80">80%</option><option value="90">90%</option><option value="100" selected>100%</option></select>');
    const repeat = field('Política de repetición', '<select id="campaign-repeat-policy" name="repeatPolicy"><option value="until-target" selected>Repetir hasta alcanzar el objetivo</option><option value="fixed-schedule">Mantener periodicidad aunque apruebe</option><option value="manual-review">Revisión manual del administrador</option></select>');

    builder.append(marker, email, frequency, target, repeat);

    const input = $('campaign-email');
    const status = $('campaign-email-status');
    const validate = () => {
      const value = input.value.trim();
      if (!value) { status.textContent = 'Introduce el correo para personalizar la campaña.'; status.style.color = '#7890aa'; return false; }
      if (!input.checkValidity()) { status.textContent = '⚠ Formato de correo no válido.'; status.style.color = '#ff6375'; return false; }
      status.textContent = '✓ Formato válido'; status.style.color = '#14f195'; return true;
    };
    input.addEventListener('input', validate);
    ['campaign-frequency','campaign-target-score','campaign-repeat-policy'].forEach(id => $(id)?.addEventListener('change', () => setTimeout(rewriteGeneratedLink, 0)));
  }

  function campaignParameters() {
    return {
      email: $('campaign-email')?.value.trim() || '',
      frequency: $('campaign-frequency')?.value || 'once',
      targetScore: $('campaign-target-score')?.value || '100',
      repeatPolicy: $('campaign-repeat-policy')?.value || 'until-target'
    };
  }

  function rewriteGeneratedLink() {
    const select = findTemplateSelect();
    const config = select ? SPECIAL_TEMPLATES[select.value] : null;
    const params = campaignParameters();

    document.querySelectorAll('.generated, [id*="generated"], [class*="generated"]').forEach(box => {
      const raw = (box.textContent || '').trim();
      if (!raw || !/https?:\/\//i.test(raw)) return;
      try {
        const url = new URL(raw);
        if (config) {
          url.pathname = url.pathname.replace(/[^/]+$/, config.page);
          url.searchParams.set('template', select.value);
          if (!url.searchParams.get('campaign')) url.searchParams.set('campaign', config.campaign);
        }
        if (params.email) url.searchParams.set('email', params.email); else url.searchParams.delete('email');
        url.searchParams.set('frequency', params.frequency);
        url.searchParams.set('targetScore', params.targetScore);
        url.searchParams.set('repeatPolicy', params.repeatPolicy);
        box.textContent = url.toString();
      } catch (_) {}
    });
  }

  function bindBuilder() {
    const select = addSpecialTemplates();
    addCampaignPlanningFields();
    if (select && !select.dataset.specialTemplatesBound) {
      select.dataset.specialTemplatesBound = 'true';
      select.addEventListener('change', () => setTimeout(rewriteGeneratedLink, 0));
    }

    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const text = button.textContent.toLowerCase();
      if (/generar|crear campaña|crear enlace|copiar/.test(text)) {
        const email = $('campaign-email');
        if (email && email.value && !email.checkValidity()) {
          email.focus();
          event.preventDefault();
          return;
        }
        setTimeout(rewriteGeneratedLink, 40);
        setTimeout(rewriteGeneratedLink, 250);
      }
    }, true);
  }

  function init() {
    addMenuButtons();
    bindBuilder();
    rewriteGeneratedLink();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  setTimeout(init, 500);
  setTimeout(init, 1500);
})();
// PSOC Campaign Planning + Special Templates + Cyber Journey v1.3.0
