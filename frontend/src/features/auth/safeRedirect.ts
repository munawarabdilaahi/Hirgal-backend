interface RedirectLocation {
  pathname?: unknown;
  search?: unknown;
  hash?: unknown;
}

export function getSafeRedirectPath(value: unknown): string | null {
  let destination: string;

  if (typeof value === 'string') {
    destination = value;
  } else if (typeof value === 'object' && value !== null) {
    const location = value as RedirectLocation;

    if (typeof location.pathname !== 'string') {
      return null;
    }

    destination = location.pathname;

    if (typeof location.search === 'string') {
      destination += location.search;
    }

    if (typeof location.hash === 'string') {
      destination += location.hash;
    }
  } else {
    return null;
  }

  if (!destination.startsWith('/') || destination.startsWith('//') || destination.includes('\\')) {
    return null;
  }

  try {
    const parsedDestination = new URL(destination, 'https://hirgal.invalid');

    if (parsedDestination.origin !== 'https://hirgal.invalid') {
      return null;
    }

    return `${parsedDestination.pathname}${parsedDestination.search}${parsedDestination.hash}`;
  } catch {
    return null;
  }
}
