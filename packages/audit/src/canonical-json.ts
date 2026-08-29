function serialize(value: unknown): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError('Canonical JSON does not support non-finite numbers');
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map((item) => serialize(item)).join(',')}]`;
      }

      const object = value as Record<string, unknown>;
      const entries = Object.keys(object)
        .filter((key) => object[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${serialize(object[key])}`);
      return `{${entries.join(',')}}`;
    }
    default:
      throw new TypeError(`Canonical JSON does not support ${typeof value}`);
  }
}

export function canonicalJson(value: unknown): string {
  return serialize(value);
}
