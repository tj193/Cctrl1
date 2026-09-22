(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const form = byId('studentForm');
  const { governorates, universities } = window.IraqCatalogue;
  const steps = [...document.querySelectorAll('.form-step')];
  const provinceInput = byId('studentGovernorate');
  const area = byId('studentHomeArea');
  const university = byId('studentUniversity');
  const error = byId('formError');
  let step = 0;
  let saving = false;
  const normalize = text => text.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/[\u064B-\u065Fـ]/g, '').trim();
  const map = window.createGovernorateMap(byId('governorateMap'), selectGovernorate);

  function showError(message, field) {
    error.textContent = message;
    error.hidden = false;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }

  function renderGovernorates() {
    const query = normalize(byId('governorateSearch').value);
    const list = byId('governorateList');
    list.replaceChildren();
    for (const governorate of governorates.filter(item => normalize(`${item.name} ${item.arabic}`).includes(query))) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'governorate-option';
      button.dataset.id = governorate.id;
      button.setAttribute('aria-pressed', String(governorate.id === provinceInput.value));
      button.textContent = governorate.name;
      const arabic = document.createElement('span');
      arabic.lang = 'ar'; arabic.dir = 'rtl'; arabic.textContent = governorate.arabic;
      button.append(arabic);
      button.addEventListener('click', () => selectGovernorate(governorate.id));
      list.append(button);
    }
    byId('noGovernorates').hidden = list.childElementCount > 0;
  }

  function toggleOther(select, fieldId, inputId) {
    const other = select.value === '__other';
    byId(fieldId).hidden = !other;
    byId(inputId).disabled = !other;
    byId(inputId).required = other;
  }

  function renderUniversities() {
    const previous = university.value;
    const query = normalize(byId('universitySearch').value);
    const all = universities.filter(item => item.governorate === provinceInput.value);
    const filtered = all.filter(item => normalize(item.name).includes(query));
    university.replaceChildren(new Option('Choose your university', ''));
    for (const [type, title] of [['public', 'Public universities · حكومية'], ['private', 'Private universities & colleges · أهلية']]) {
      const group = document.createElement('optgroup');
      group.label = title;
      for (const item of filtered.filter(item => item.type === type)) group.append(new Option(item.name, item.name));
      if (group.childElementCount) university.append(group);
    }
    university.append(new Option('Other university / campus', '__other'));
    if ([...university.options].some(option => option.value === previous)) university.value = previous;
    byId('universityCount').textContent = `${filtered.length} of ${all.length} listed universities and colleges. Can’t find yours? Choose “Other university / campus”.`;
    toggleOther(university, 'customUniversityField', 'customUniversity');
    updateSummary();
  }

  function selectGovernorate(id) {
    const governorate = governorates.find(item => item.id === id);
    if (!governorate) return;
    const changed = provinceInput.value !== id;
    provinceInput.value = id;
    error.hidden = true;
    map.select(id);
    byId('mapSelection').textContent = `${governorate.name} · ${governorate.arabic}`;
    byId('selectedProvince').textContent = `${governorate.name} · ${governorate.arabic}`;
    if (changed) {
      area.replaceChildren(new Option('Choose your area', ''), ...governorate.areas.map(name => new Option(name, name)), new Option('Other area — enter it myself', '__other'));
      university.value = '';
      byId('universitySearch').value = '';
      byId('customArea').value = '';
      byId('customUniversity').value = '';
      toggleOther(area, 'customAreaField', 'customArea');
      renderUniversities();
    }
    renderGovernorates();
    updateSummary();
  }

  function updateSummary() {
    const province = governorates.find(item => item.id === provinceInput.value);
    const home = area.value === '__other' ? byId('customArea').value.trim() : area.value;
    const campus = university.value === '__other' ? byId('customUniversity').value.trim() : university.value;
    byId('summaryFrom').textContent = home || province?.name || 'Your neighborhood';
    byId('summaryTo').textContent = campus || 'Your university';
    const time = byId('studentArrivalTime').value;
    if (time) {
      const [hours, minutes] = time.split(':').map(Number);
      byId('summaryTime').textContent = `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
    } else byId('summaryTime').textContent = 'Your time';
    document.querySelectorAll('[data-time]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.time === time)));
  }

  function showStep(next) {
    step = next;
    steps.forEach((section, index) => { section.hidden = index !== step; });
    document.querySelectorAll('.step-list li').forEach((item, index) => {
      item.removeAttribute('aria-current');
      item.classList.toggle('complete', index < step);
      if (index === step) item.setAttribute('aria-current', 'step');
    });
    byId('stepCount').textContent = `STEP 0${step + 1} OF 03`;
    byId('stepCaption').textContent = ['A good journey starts here', 'Make it fit your day', 'Almost ready to go'][step];
    byId('progressFill').style.width = `${(step + 1) / 3 * 100}%`;
    document.querySelector('.progress-track').setAttribute('aria-valuenow', step + 1);
    byId('previousStep').hidden = step === 0;
    byId('stepHint').textContent = ['Start with your governorate', 'Your daily route, your way', 'One last step'][step];
    byId('nextStep').textContent = step === 2 ? 'Create demo account →' : 'Continue →';
    error.hidden = true;
    steps[step].querySelector('h2').focus();
  }

  function validate() {
    if (step === 0 && !provinceInput.value) {
      showError('Choose your governorate to continue.', byId('governorateSearch'));
      return false;
    }
    for (const input of steps[step].querySelectorAll('input, select')) {
      if (input.disabled || input.type === 'hidden') continue;
      input.removeAttribute('aria-invalid');
      if (!input.checkValidity() || (input.required && !input.value.trim())) {
        showError(input.validationMessage || 'Please complete this field.', input);
        return false;
      }
    }
    if (step === 2) {
      if (!/^\+9647\d{9}$/.test(window.DarbAccounts.normalizePhone(byId('studentPhone').value))) {
        showError('Enter a valid Iraqi mobile number, for example 0770 123 4567.', byId('studentPhone'));
        return false;
      }
      if (byId('studentPassword').value !== byId('studentConfirmPassword').value) {
        showError('The passwords don’t match yet. Please try again.', byId('studentConfirmPassword'));
        return false;
      }
    }
    return true;
  }

  byId('governorateSearch').addEventListener('input', renderGovernorates);
  byId('universitySearch').addEventListener('input', renderUniversities);
  area.addEventListener('change', () => { toggleOther(area, 'customAreaField', 'customArea'); updateSummary(); });
  university.addEventListener('change', () => { toggleOther(university, 'customUniversityField', 'customUniversity'); updateSummary(); });
  form.addEventListener('input', event => { event.target.removeAttribute('aria-invalid'); error.hidden = true; updateSummary(); });
  byId('previousStep').addEventListener('click', () => showStep(step - 1));
  byId('changeGovernorate').addEventListener('click', () => showStep(0));
  document.querySelectorAll('[data-time]').forEach(button => button.addEventListener('click', () => { byId('studentArrivalTime').value = button.dataset.time; updateSummary(); }));
  document.querySelectorAll('.password-toggle').forEach(button => button.addEventListener('click', () => {
    const input = byId(button.dataset.target);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Hide' : 'Show';
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} ${input.id.includes('Confirm') ? 'confirm password' : 'password'}`);
  }));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !validate()) return;
    if (step < 2) { showStep(step + 1); return; }
    saving = true;
    byId('nextStep').disabled = true;
    byId('nextStep').textContent = 'Creating your account…';
    try {
      await window.DarbAccounts.create({
        fullName: byId('studentName').value.trim(), email: byId('studentEmail').value.trim(), phone: byId('studentPhone').value,
        governorate: provinceInput.value, homeArea: area.value === '__other' ? byId('customArea').value.trim() : area.value,
        university: university.value === '__other' ? byId('customUniversity').value.trim() : university.value,
        arrivalTime: byId('studentArrivalTime').value, role: 'student', status: 'active'
      }, byId('studentPassword').value);
      byId('studentPassword').value = ''; byId('studentConfirmPassword').value = '';
      form.hidden = true;
      byId('registrationSuccess').hidden = false;
      byId('registrationSuccess').focus();
    } catch (failure) {
      showError(failure instanceof SyntaxError ? 'Saved demo data could not be read. Try a separate browser profile.' : failure.message || 'We couldn’t save this account. Check that browser storage is enabled.');
    } finally {
      saving = false; byId('nextStep').disabled = false; byId('nextStep').textContent = 'Create demo account →';
    }
  });
  renderGovernorates();
})();
