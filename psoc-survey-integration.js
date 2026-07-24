(() => {
  'use strict';

  const SURVEY_VALUE = 'survey-phishing';
  const SURVEY_LABEL = 'Encuesta de Perfil — Survey Phishing';
  const SURVEY_PAGE = 'phishing-survey.html';

  function addMenuButton() {
    const nav = document.querySelector('.sidebar .nav, nav.nav');
    if (!nav || nav.querySelector('[data-survey-phishing-link]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.surveyPhishingLink = 'true';
    button.textContent = '▤ ENCUESTA PHISHING';
    button.addEventListener('click', () => {
      location.href = `./${SURVEY_PAGE}?campaign=PH-2026-SURVEY&template=${SURVEY_VALUE}`;
    });
    const attackerView = Array.from(nav.querySelectorAll('button')).find(b => /ATTACKER.?S VIEW/i.test(b.textContent));
    if (attackerView) nav.insertBefore(button, attackerView);
    else nav.appendChild(button);
  }

  function findTemplateSelect() {
    const selects = Array.from(document.querySelectorAll('select'));
    return selects.find(select => {
      const context = `${select.id} ${select.name} ${select.closest('.field')?.textContent || ''}`.toLowerCase();
      const optionText = Array.from(select.options).map(o => `${o.value} ${o.textContent}`).join(' ').toLowerCase();
      return /template|plantilla|escenario|tipo de campaña/.test(context) || /password-reset|microsoft|phishing/.test(optionText);
    });
  }

  function addSurveyTemplate() {
    const select = findTemplateSelect();
    if (!select || Array.from(select.options).some(o => o.value === SURVEY_VALUE)) return select;
    const option = document.createElement('option');
    option.value = SURVEY_VALUE;
    option.textContent = SURVEY_LABEL;
    select.appendChild(option);
    return select;
  }

  function rewriteGeneratedLink() {
    const select = findTemplateSelect();
    if (!select || select.value !== SURVEY_VALUE) return;
    document.querySelectorAll('.generated, [id*="generated"], [class*="generated"]').forEach(box => {
      const raw = (box.textContent || '').trim();
      if (!raw || !/https?:\/\//i.test(raw)) return;
      try {
        const url = new URL(raw);
        url.pathname = url.pathname.replace(/[^/]+$/, SURVEY_PAGE);
        url.searchParams.set('template', SURVEY_VALUE);
        box.textContent = url.toString();
      } catch (_) {
        box.textContent = raw.replace(/phishing(?:-headhunter)?\.html/i, SURVEY_PAGE)
          .replace(/([?&]template=)[^&]*/i, `$1${SURVEY_VALUE}`);
      }
    });
  }

  function bindBuilder() {
    const select = addSurveyTemplate();
    if (select && !select.dataset.surveyBound) {
      select.dataset.surveyBound = 'true';
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
    addMenuButton();
    bindBuilder();
    rewriteGeneratedLink();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setTimeout(init, 500);
  setTimeout(init, 1500);
})();