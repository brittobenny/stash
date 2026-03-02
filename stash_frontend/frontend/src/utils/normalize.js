const cleanup = (value) =>
  String(value || '')
    .replace(/\\+/g, '')
    .replace(/^["']+|["']+$/g, '')
    .trim();

export const normalizeName = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(' ').trim();
  }

  if (typeof value === 'string') {
    let trimmed = value.trim();
    if (!trimmed) return '';

    // Handle array-like strings: ["Britto Benny"] or ['Britto Benny']
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      let inner = trimmed.slice(1, -1).trim();
      inner = inner.replace(/\\+/g, '');
      if (!inner) return '';
      const matches = [];
      const regex = /"([^"]+)"|'([^']+)'/g;
      let match;
      while ((match = regex.exec(inner)) !== null) {
        matches.push(match[1] || match[2]);
      }
      if (matches.length) {
        return matches.map((m) => cleanup(m)).filter(Boolean).join(' ').trim();
      }
      return inner
        .split(',')
        .map((part) => cleanup(part))
        .filter(Boolean)
        .join(' ')
        .trim();
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).join(' ').trim();
      }
      if (typeof parsed === 'string') {
        return cleanup(parsed);
      }
    } catch {
      // Not JSON, fall through
    }

    return cleanup(trimmed);
  }

  return '';
};

export const normalizeImagePath = (value) => {
  if (Array.isArray(value)) {
    return cleanup(value[0] || '');
  }
  if (typeof value === 'string') {
    let trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      let inner = trimmed.slice(1, -1).trim();
      inner = inner.replace(/\\+/g, '');
      const match = inner.match(/"([^"]+)"|'([^']+)'/);
      return cleanup(match ? match[1] || match[2] : inner.split(',')[0]);
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return cleanup(parsed[0] || '');
      if (typeof parsed === 'string') return cleanup(parsed);
    } catch {
      // Not JSON, fall through
    }
    return cleanup(trimmed);
  }
  return '';
};
