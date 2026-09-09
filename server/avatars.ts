import { createHash } from 'node:crypto';

interface AvatarImage { data: Buffer; contentType: string }

export function avatarCache(fetchImage: typeof fetch = fetch) {
  const entries = new Map<string, { expires: number; image: Promise<AvatarImage | null> }>();
  return (email: string): Promise<AvatarImage | null> => {
    const hash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    const cached = entries.get(hash);
    if (cached && cached.expires > Date.now()) return cached.image;
    if (entries.size >= 500) entries.delete(entries.keys().next().value!);
    const entry = { expires: Date.now() + 86_400_000, image: Promise.resolve<AvatarImage | null>(null) };
    entry.image = (async () => {
      try {
        const response = await fetchImage(`https://www.gravatar.com/avatar/${hash}?s=64&d=404`, {
          signal: AbortSignal.timeout(5000),
        });
        if (response.status === 404) return null;
        if (!response.ok || !/^image\/(png|jpeg|gif|webp)/i.test(response.headers.get('content-type') ?? '')) {
          throw new Error('Avatar unavailable');
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > 256_000) throw new Error('Avatar too large');
        return { data: buffer, contentType: response.headers.get('content-type')!.split(';')[0] };
      } catch {
        entry.expires = Date.now() + 60_000;
        return null;
      }
    })();
    entries.set(hash, entry);
    return entry.image;
  };
}
