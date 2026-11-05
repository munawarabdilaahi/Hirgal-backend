export type TokenClearReason = 'logout' | 'unauthorized' | 'account_inactive';

let accessToken: string | null = null;
let tokenClearReason: TokenClearReason | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToAccessToken(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getTokenClearReason(): TokenClearReason | null {
  return tokenClearReason;
}

export function setAccessToken(token: string): void {
  tokenClearReason = null;
  accessToken = token;
  notifyListeners();
}

export function clearAccessToken(reason: TokenClearReason = 'logout'): void {
  if (accessToken === null && tokenClearReason === reason) {
    return;
  }

  accessToken = null;
  tokenClearReason = reason;
  notifyListeners();
}
