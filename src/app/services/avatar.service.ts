import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay, switchMap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AvatarService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, { expires: number; image: Observable<string | null> }>();
  private readonly empty = of(null);

  get(email: string): Observable<string | null> {
    const key = email.trim().toLowerCase();
    if (!key) return this.empty;
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.image;
    if (this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value!);
    const image = this.http.get('/api/avatar', { params: { email: key }, responseType: 'blob' }).pipe(
      switchMap((blob) => blob.size ? new Observable<string>((subscriber) => {
        const reader = new FileReader();
        reader.onload = () => { subscriber.next(String(reader.result)); subscriber.complete(); };
        reader.onerror = () => subscriber.error(reader.error);
        reader.readAsDataURL(blob);
        return () => { if (reader.readyState === FileReader.LOADING) reader.abort(); };
      }) : this.empty),
      catchError(() => this.empty),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.cache.set(key, { expires: Date.now() + 3_600_000, image });
    return image;
  }
}
