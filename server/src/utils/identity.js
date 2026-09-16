export function normalizeEmail(value) {
  return String(value || '').normalize('NFKC').trim().toLowerCase();
}

export function isPlausibleEmail(value) {
  const email = normalizeEmail(value);
  return Boolean(email && email.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

export function normalizeIndianMobile(value) {
  let digits = String(value || '').normalize('NFKC').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

export function mobileVariants(value) {
  const mobile = normalizeIndianMobile(value);
  if (!mobile) return [];
  return [mobile, `+91${mobile}`, `91${mobile}`, `0${mobile}`];
}

export function mobileLookup(value) {
  const variants = mobileVariants(value);
  return variants.length ? { $in: variants } : null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function identifierDescriptor(value) {
  const input = String(value || '').normalize('NFKC').trim();
  if (!input) return null;

  if (input.includes('@')) {
    const normalized = normalizeEmail(input);
    if (!isPlausibleEmail(normalized)) return null;
    return {
      type: 'email',
      normalized,
      query: {
        $or: [
          { emailNormalized: normalized },
          { email: normalized },
          { email: new RegExp(`^${escapeRegex(normalized)}$`, 'i') },
        ],
      },
    };
  }

  const normalized = normalizeIndianMobile(input);
  if (!normalized) return null;
  return {
    type: 'mobile',
    normalized,
    query: {
      $or: [
        { phoneNormalized: normalized },
        { phone: mobileLookup(normalized) },
      ],
    },
  };
}
