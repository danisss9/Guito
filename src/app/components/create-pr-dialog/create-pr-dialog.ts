import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  WritableSignal,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { BranchInfo, CreatePrResult } from '../../models/git.models';
import { ChipInput, ChipSuggestion } from './chip-input';
import { GitService } from '../../services/git.service';

/** Sentinel source value meaning "create a new remote branch with a random name". */
const NEW_BRANCH = '__new__';

@Component({
  selector: 'app-create-pr-dialog',
  imports: [ChipInput],
  templateUrl: './create-pr-dialog.html',
  styleUrl: './create-pr-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatePrDialog implements OnInit {
  private readonly git = inject(GitService);

  readonly branches = input.required<BranchInfo[]>();
  readonly closed = output<void>();
  /** Emits after a pull request was created so the app can refresh. */
  readonly created = output<CreatePrResult>();

  protected readonly newBranchValue = NEW_BRANCH;
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly source = signal('');
  protected readonly target = signal('');
  protected readonly creating = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<CreatePrResult | null>(null);

  // Reviewers, work items and tags (chips with Azure DevOps autocomplete).
  protected readonly requiredReviewers = signal<ChipSuggestion[]>([]);
  protected readonly optionalReviewers = signal<ChipSuggestion[]>([]);
  protected readonly workItemChips = signal<ChipSuggestion[]>([]);
  protected readonly tagChips = signal<ChipSuggestion[]>([]);
  protected readonly requiredReviewerQuery = signal('');
  protected readonly optionalReviewerQuery = signal('');
  protected readonly workItemQuery = signal('');
  protected readonly tagQuery = signal('');
  protected readonly requiredReviewerSuggestions = signal<ChipSuggestion[]>([]);
  protected readonly optionalReviewerSuggestions = signal<ChipSuggestion[]>([]);
  protected readonly workItemSuggestions = signal<ChipSuggestion[]>([]);
  protected readonly tagSuggestions = signal<ChipSuggestion[]>([]);
  protected readonly reviewersLoading = signal(false);
  protected readonly workItemsLoading = signal(false);
  protected readonly tagsLoading = signal(false);

  protected readonly localBranches = computed(() =>
    this.branches().filter((branch) => !branch.remote),
  );

  protected readonly remoteBranches = computed(() =>
    this.branches().filter((branch) => branch.remote),
  );

  protected readonly canCreate = computed(
    () => !this.creating() && !!this.target() && !!this.source(),
  );

  /** Tag names are filtered locally; unmatched text can still be added via Enter. */
  protected readonly filteredTagSuggestions = computed(() => {
    const query = this.tagQuery().trim().toLowerCase();
    if (!query) {
      return this.tagSuggestions();
    }
    return this.tagSuggestions().filter((tag) => tag.label.toLowerCase().includes(query));
  });

  constructor() {
    // Debounced Azure DevOps lookups while typing (2+ characters).
    toObservable(this.requiredReviewerQuery)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((query) => this.lookupReviewers(query, this.requiredReviewerSuggestions));
    toObservable(this.optionalReviewerQuery)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((query) => this.lookupReviewers(query, this.optionalReviewerSuggestions));
    toObservable(this.workItemQuery)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((query) => this.lookupWorkItems(query));
  }

  ngOnInit(): void {
    const branches = this.branches();
    const current = branches.find((branch) => branch.current && !branch.remote);
    const firstLocal = branches.find((branch) => !branch.remote);
    this.source.set(current?.name ?? firstLocal?.name ?? '');
    if (!this.title()) {
      this.title.set(current?.name ?? '');
    }

    const remote = branches.filter((branch) => branch.remote);
    const preferred =
      remote.find((branch) => branch.name === 'origin/main') ??
      remote.find((branch) => branch.name === 'origin/master');
    this.target.set(preferred?.name ?? remote[0]?.name ?? '');

    // Tag names are a small fixed list; load them once for autocomplete.
    this.tagsLoading.set(true);
    this.git.getPrTags().subscribe({
      next: (tags) => {
        this.tagSuggestions.set(
          tags.map((tag) => ({ id: tag.name.toLowerCase(), label: tag.name })),
        );
        this.tagsLoading.set(false);
      },
      error: () => {
        this.tagSuggestions.set([]);
        this.tagsLoading.set(false);
      },
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.creating()) {
      this.closed.emit();
    }
  }

  protected onBackdropClick(): void {
    if (!this.creating()) {
      this.closed.emit();
    }
  }

  protected onTitleInput(event: Event): void {
    this.title.set((event.target as HTMLInputElement).value);
  }

  protected onDescriptionInput(event: Event): void {
    this.description.set((event.target as HTMLTextAreaElement).value);
  }

  protected onSourceChange(event: Event): void {
    this.source.set((event.target as HTMLSelectElement).value);
  }

  protected onTargetChange(event: Event): void {
    this.target.set((event.target as HTMLSelectElement).value);
  }

  private lookupReviewers(query: string, target: WritableSignal<ChipSuggestion[]>): void {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      target.set([]);
      this.reviewersLoading.set(false);
      return;
    }
    this.reviewersLoading.set(true);
    this.git.searchReviewers(trimmed).subscribe({
      next: (reviewers) => {
        target.set(
          reviewers.map((reviewer) => ({
            id: reviewer.id,
            label: reviewer.label,
            description: reviewer.description,
          })),
        );
        this.reviewersLoading.set(false);
      },
      error: () => {
        target.set([]);
        this.reviewersLoading.set(false);
      },
    });
  }

  private lookupWorkItems(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) {
      this.workItemSuggestions.set([]);
      this.workItemsLoading.set(false);
      return;
    }
    this.workItemsLoading.set(true);
    this.git.searchWorkItems(trimmed).subscribe({
      next: (items) => {
        this.workItemSuggestions.set(
          items.map((item) => ({
            id: String(item.id),
            label: `#${item.id} ${item.title}`,
            description: item.state,
          })),
        );
        this.workItemsLoading.set(false);
      },
      error: () => {
        this.workItemSuggestions.set([]);
        this.workItemsLoading.set(false);
      },
    });
  }

  private isReviewerSelected(id: string): boolean {
    return [...this.requiredReviewers(), ...this.optionalReviewers()].some(
      (chip) => chip.id === id,
    );
  }

  protected addRequiredReviewer(choice: ChipSuggestion): void {
    this.requiredReviewerQuery.set('');
    this.requiredReviewerSuggestions.set([]);
    if (!this.isReviewerSelected(choice.id)) {
      this.requiredReviewers.update((list) => [...list, choice]);
    }
  }

  protected addOptionalReviewer(choice: ChipSuggestion): void {
    this.optionalReviewerQuery.set('');
    this.optionalReviewerSuggestions.set([]);
    if (!this.isReviewerSelected(choice.id)) {
      this.optionalReviewers.update((list) => [...list, choice]);
    }
  }

  protected removeRequiredReviewer(chip: ChipSuggestion): void {
    this.requiredReviewers.update((list) => list.filter((entry) => entry.id !== chip.id));
  }

  protected removeOptionalReviewer(chip: ChipSuggestion): void {
    this.optionalReviewers.update((list) => list.filter((entry) => entry.id !== chip.id));
  }

  protected addWorkItem(choice: ChipSuggestion): void {
    this.workItemQuery.set('');
    this.workItemSuggestions.set([]);
    if (!this.workItemChips().some((chip) => chip.id === choice.id)) {
      this.workItemChips.update((list) => [...list, choice]);
    }
  }

  protected removeWorkItem(chip: ChipSuggestion): void {
    this.workItemChips.update((list) => list.filter((entry) => entry.id !== chip.id));
  }

  protected addTag(choice: ChipSuggestion): void {
    this.tagQuery.set('');
    if (!this.tagChips().some((chip) => chip.id === choice.id)) {
      this.tagChips.update((list) => [...list, choice]);
    }
  }

  protected removeTag(chip: ChipSuggestion): void {
    this.tagChips.update((list) => list.filter((entry) => entry.id !== chip.id));
  }

  protected create(): void {
    if (!this.canCreate()) return;
    const isNewBranch = this.source() === NEW_BRANCH;
    this.creating.set(true);
    this.error.set('');

    const reviewers = [
      ...this.requiredReviewers().map((chip) => ({ id: chip.id, required: true })),
      ...this.optionalReviewers().map((chip) => ({ id: chip.id, required: false })),
    ];
    const workItems = this.workItemChips()
      .map((chip) => Number(chip.id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const labels = this.tagChips().map((chip) => chip.label);

    this.git
      .createPr({
        sourceBranch: isNewBranch ? '' : this.source(),
        targetBranch: this.target(),
        title: this.title().trim() || undefined,
        description: this.description().trim() || undefined,
        newBranch: isNewBranch,
        reviewers: reviewers.length ? reviewers : undefined,
        workItems: workItems.length ? workItems : undefined,
        labels: labels.length ? labels : undefined,
      })
      .subscribe({
        next: (result) => {
          this.creating.set(false);
          this.result.set(result);
          this.created.emit(result);
        },
        error: (err) => {
          this.creating.set(false);
          this.error.set(this.errorMessage(err));
        },
      });
  }

  private errorMessage(err: unknown): string {
    const response = err as { status?: number; error?: { error?: string } };
    if (response?.status === 400 && response.error?.error) {
      return response.error.error;
    }
    return 'Failed to communicate with the Guito server.';
  }
}
