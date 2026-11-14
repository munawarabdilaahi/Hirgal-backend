export function readEmailLink(url: URL) {
  const fragment = new URLSearchParams(url.hash.slice(1));
  return {
    token: fragment.get('token') || url.searchParams.get('token') || '',
    email: url.searchParams.get('email') ?? '',
  };
}
