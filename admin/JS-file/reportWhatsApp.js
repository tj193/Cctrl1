(() => {
  'use strict';
  const normalize = value => {
    const digits = String(value || '')
      .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
      .replace(/[^\d+]/g, '').replace(/^\+|^00/, '').replace(/^0(?=7)/, '964');
    return /^9647\d{9}$/.test(digits) ? digits : '';
  };
  const message = report => {
    const status = String(report.status || '').toLowerCase();
    const phrase = { pending: 'pending review', investigating: 'under investigation', resolved: 'resolved', dismissed: 'dismissed' }[status] || 'available for review';
    return `Hello, your DarbGo report #${report.id} is ${phrase}. Please contact DarbGo support if you need further assistance.`;
  };
  const url = (phone, text) => {
    const number = normalize(phone);
    return number && String(text || '').trim() ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : '';
  };
  window.DarbReportWhatsApp = { normalize, message, url };
})();
