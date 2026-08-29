export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export function normalizeVatId(value: string): string {
  return value.replace(/[\s._-]+/g, '').toUpperCase();
}

export function normalizeIdentifier(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeName(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function normalizeMoney(value: string | number): string {
  const raw = String(value).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) {
    throw new Error(`Invalid money value: ${raw}`);
  }

  const [, sign = '', whole = '', fraction = ''] = match;
  if (fraction.length > 2) {
    throw new Error(`Money value has more than two decimal places: ${raw}`);
  }

  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');
  const normalizedFraction = fraction.padEnd(2, '0');
  return `${sign}${normalizedWhole}.${normalizedFraction}`;
}
