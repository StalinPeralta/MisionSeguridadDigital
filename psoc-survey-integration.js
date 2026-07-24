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

  function findTemplateSelect() {
    const selects = Array.from(document.querySelectorAll('select'));
    return selects.find(select => {
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
      if (attackerView) nav.insertBefore(button, attackerView);
      else nav.appendChild(button);
    });
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

  function rewriteGeneratedLink() {
    const select = findTemplateSelect();
    const config = select ? SPECIAL_TEMPLATES[select.value] : null;
    if (!config) return;

    document.querySelectorAll('.generated, [id*="generated"], [class*="generated"]').forEach(box => {
      const raw = (box.textContent || '').trim();
      if (!raw || !/https?:\/\//i.test(raw)) return;
      try {
        const url = new URL(raw);
        url.pathname = url.pathname.replace(/[^/]+$/, config.page);
        url.searchParams.set('template', select.value);
        if (!url.searchParams.get('campaign')) url.searchParams.set('campaign', config.campaign);
        box.textContent = url.toString();
      } catch (_) {
        box.textContent = raw
          .replace(/phishing(?:-headhunter|-survey)?\.html/i, config.page)
          .replace(/([?&]template=)[^&]*/i, `$1${select.value}`);
      }
    });
  }

  function bindBuilder() {
    const select = addSpecialTemplates();
    if (select && !select.dataset.specialTemplatesBound) {
      select.dataset.specialTemplatesBound = 'true';
      select.addEventListener('change', () => setTimeout(rewriteGeneratedLink, 0));
    }

    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const text = button.textContent.toLowerCase();
      if (/generar|crear campaña|crear enlace|copiar/.test(text)) {
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setTimeout(init, 500);
  setTimeout(init, 1500);
})();
// PSOC Special Campaign Templates v1.1.0