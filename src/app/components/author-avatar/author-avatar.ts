import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { AvatarService } from '../../services/avatar.service';

@Component({
  selector: 'app-author-avatar',
  imports: [AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (avatars.get(email()) | async; as image) {
    <img [src]="image" alt="" width="24" height="24" />
  } @else { <span aria-hidden="true">{{ initials() }}</span> }`,
  styles: `:host { display: inline-flex; width: 24px; height: 24px; flex: 0 0 24px;
    vertical-align: middle; border-radius: 50%; overflow: hidden; background: #36516b; }
    img { width: 100%; height: 100%; object-fit: cover; }
    span { margin: auto; color: white; font-size: 10px; line-height: 24px; }`,
})
export class AuthorAvatar {
  readonly name = input('');
  readonly email = input('');
  protected readonly avatars = inject(AvatarService);
  protected initials() {
    return this.name().trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
  }
}
