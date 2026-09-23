(() => {
  'use strict';
  const key = 'darbgoDemoAccounts';
  const loginUrl = typeof document === 'undefined'
    ? 'login.html'
    : new URL('../../login.html', document.currentScript.src).href;
  const normalizePhone = value => value.replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    .replace(/[\s()-]/g, '').replace(/^00964/, '+964').replace(/^0(?=7)/, '+964');
  const encode = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  const decode = hex => new Uint8Array(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));

  function readAccounts() {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(value)) throw new Error('Saved demo accounts could not be read. Try another browser profile.');
    return value;
  }

  async function hashPassword(password, salt) {
    if (!window.crypto?.subtle) throw new Error('Open this demo using localhost or HTTPS to create an account.');
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return encode(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: decode(salt), iterations: 210000, hash: 'SHA-256' }, material, 256));
  }

  const profileOnly = ({ password, passwordHash, passwordSalt, ...profile }) => profile;

  window.DarbAccounts = {
    loginUrl,
    normalizePhone,
    async create(profile, password) {
      const accounts = readAccounts();
      const email = profile.email.trim().toLowerCase();
      const phone = normalizePhone(profile.phone);
      let legacy;
      try { legacy = JSON.parse(localStorage.getItem('darbgoUser') || 'null'); } catch { legacy = null; }
      const existing = legacy ? [...accounts, legacy] : accounts;
      if (existing.some(account => account.email?.toLowerCase() === email || normalizePhone(account.phone || '') === phone)) {
        throw new Error('An account with this email or mobile number already exists. Please log in.');
      }
      const passwordSalt = encode(crypto.getRandomValues(new Uint8Array(16)));
      const account = { ...profile, email, phone, id: crypto.randomUUID(), passwordSalt, passwordHash: await hashPassword(password, passwordSalt) };
      // Re-read after hashing so another tab's registration is not overwritten.
      const latest = readAccounts();
      if (latest.some(user => user.email === email || user.phone === phone)) throw new Error('This account already exists. Please log in.');
      localStorage.setItem(key, JSON.stringify([...latest, account]));
      return profileOnly(account);
    },
    async login(identifier, password) {
      const email = identifier.trim().toLowerCase();
      const phone = normalizePhone(identifier);
      let account = readAccounts().find(user => user.email === email || user.phone === phone);
      let valid = false;
      if (account) valid = account.passwordHash === await hashPassword(password, account.passwordSalt);
      else {
        // Preserve accounts created by the original prototype, migrating on successful login.
        let legacy;
        try { legacy = JSON.parse(localStorage.getItem('darbgoUser') || 'null'); } catch { legacy = null; }
        if (legacy && (legacy.email?.toLowerCase() === email || normalizePhone(legacy.phone || '') === phone) && legacy.password === password) {
          account = legacy;
          valid = true;
        }
      }
      if (!valid) throw new Error('Email, mobile number or password is incorrect.');
      if (account.status === 'pending') throw new Error('Your driver account is still pending review.');
      if (account.status === 'rejected') throw new Error('Your driver account has not been approved.');
      if (account.password) {
        const passwordSalt = encode(crypto.getRandomValues(new Uint8Array(16)));
        const migrated = { ...profileOnly(account), email: account.email.toLowerCase(), phone: normalizePhone(account.phone), passwordSalt, passwordHash: await hashPassword(password, passwordSalt) };
        localStorage.setItem(key, JSON.stringify([...readAccounts(), migrated]));
        localStorage.setItem('darbgoUser', JSON.stringify(profileOnly(migrated)));
      }
      const profile = profileOnly(account);
      sessionStorage.setItem('loggedInUser', JSON.stringify(profile));
      return profile;
    },
    logout() {
      sessionStorage.removeItem('loggedInUser');
      window.location.href = loginUrl;
    }
  };
})();
