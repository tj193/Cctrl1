(() => {
  'use strict';

  window.createGovernorateMap = function (container, onSelect) {
    container.innerHTML = window.IraqMapMarkup;
    const svg = container.querySelector('svg');

    svg.addEventListener('click', event => {
      const target = event.target.closest('[data-governorate]');
      if (target) onSelect(target.dataset.governorate);
    });
    svg.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target.closest('[data-governorate]');
      if (!target) return;
      event.preventDefault();
      onSelect(target.dataset.governorate);
    });
    return {
      select(id) {
        for (const element of svg.querySelectorAll('[data-governorate]')) {
          const selected = element.dataset.governorate === id;
          element.classList.toggle('selected', selected);
          if (element.hasAttribute('aria-pressed')) element.setAttribute('aria-pressed', String(selected));
        }
      }
    };
  };
})();
