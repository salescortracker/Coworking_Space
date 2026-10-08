import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChildren,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import { StatusBadgeComponent } from '../basics/basics.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingStateComponent } from '../states/states.component';
import { formatInr } from '../../pipes/format.pipes';
import { LoadStatus } from '../../utils/loader';

export interface Column<T> {
  key: string;
  label: string;
  value?: (row: T) => string | number | null | undefined;
  sortValue?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  type?: 'text' | 'currency' | 'number' | 'date' | 'datetime' | 'status';
  align?: 'left' | 'right';
  hideMobile?: boolean;
  width?: string;
  /** Rendered bold as the row's main identifier. */
  primary?: boolean;
}

/** Custom cell template: <ng-template appCell="status" let-row>…</ng-template> */
@Directive({ selector: 'ng-template[appCell]' })
export class CellDefDirective {
  readonly appCell = input.required<string>();
  readonly template = inject(TemplateRef<{ $implicit: unknown }>);
}

@Component({
  selector: 'app-pagination',
  imports: [IconComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pagination">
      <div class="row-sm text-muted text-sm">
        <span class="hide-mobile">Rows per page</span>
        <label class="sr-only" for="page-size-{{ uid }}">Rows per page</label>
        <select id="page-size-{{ uid }}" class="select select-sm" [ngModel]="pageSize()" (ngModelChange)="pageSizeChange.emit(+$event)">
          @for (s of sizes(); track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        <span>{{ start() }}–{{ end() }} of {{ total() }}</span>
      </div>
      <div class="row-sm">
        <button type="button" class="btn btn-secondary btn-icon btn-sm" [disabled]="page() <= 1" (click)="pageChange.emit(1)" aria-label="First page">
          <app-icon name="chevrons-left" [size]="16" />
        </button>
        <button type="button" class="btn btn-secondary btn-icon btn-sm" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)" aria-label="Previous page">
          <app-icon name="chevron-left" [size]="16" />
        </button>
        <span class="text-sm tabular" aria-live="polite">Page {{ page() }} of {{ pages() }}</span>
        <button type="button" class="btn btn-secondary btn-icon btn-sm" [disabled]="page() >= pages()" (click)="pageChange.emit(page() + 1)" aria-label="Next page">
          <app-icon name="chevron-right" [size]="16" />
        </button>
      </div>
    </div>
  `,
})
export class PaginationComponent {
  private static seq = 0;
  protected readonly uid = ++PaginationComponent.seq;
  readonly page = input(1);
  readonly pageSize = input(10);
  readonly total = input(0);
  readonly sizes = input([10, 25, 50]);
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly start = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1));
  protected readonly end = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
}

/**
 * Reusable data table with search, sorting, pagination, page size, responsive
 * card layout on mobile and built-in loading / empty / error states.
 * Filtering is done by the parent (pass already-filtered rows) so filters stay page-specific.
 */
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet, DatePipe, FormsModule, IconComponent, StatusBadgeComponent, PaginationComponent, LoadingStateComponent, EmptyStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card table-card">
      @if (searchable() || hasFilters()) {
        <div class="toolbar">
          @if (searchable()) {
            <div class="input-icon search">
              <app-icon name="search" [size]="16" />
              <label class="sr-only" [for]="'tbl-search-' + uid">Search</label>
              <input
                [id]="'tbl-search-' + uid"
                class="input"
                type="search"
                [placeholder]="searchPlaceholder()"
                [ngModel]="query()"
                (ngModelChange)="onSearch($event)"
              />
            </div>
          }
          <ng-content select="[filters]" />
          <span class="spacer"></span>
          @if (query() || filtersActive()) {
            <button type="button" class="btn btn-ghost btn-sm" (click)="clearAll()">
              <app-icon name="x" [size]="14" /> Clear filters
            </button>
          }
          <ng-content select="[toolbar-actions]" />
        </div>
      }

      @switch (status()) {
        @case ('loading') {
          <app-loading-state [rows]="6" />
        }
        @case ('error') {
          <app-error-state (retry)="retry.emit()" />
        }
        @default {
          @if (sorted().length === 0) {
            <app-empty-state
              [icon]="emptyIcon()"
              [title]="query() || filtersActive() ? 'No results match your filters' : emptyTitle()"
              [message]="query() || filtersActive() ? 'Try adjusting your search or clearing filters.' : emptyMessage()"
            >
              @if (query() || filtersActive()) {
                <button type="button" class="btn btn-secondary btn-sm" (click)="clearAll()">Clear filters</button>
              } @else {
                <ng-content select="[empty-action]" />
              }
            </app-empty-state>
          } @else {
            <div class="table-wrap">
              <table class="table responsive" [class.table-compact]="compact()">
                <caption class="sr-only">{{ caption() }}</caption>
                <thead>
                  <tr>
                    @for (col of columns(); track col.key) {
                      <th
                        scope="col"
                        [class.sortable]="col.sortable !== false"
                        [class.sorted]="sortKey() === col.key"
                        [class.num]="col.align === 'right' || col.type === 'currency' || col.type === 'number'"
                        [class.hide-mobile]="col.hideMobile"
                        [style.width]="col.width"
                        [attr.aria-sort]="sortKey() === col.key ? (sortDir() === 'asc' ? 'ascending' : 'descending') : null"
                        (click)="col.sortable !== false && toggleSort(col.key)"
                        (keydown.enter)="col.sortable !== false && toggleSort(col.key)"
                        [attr.tabindex]="col.sortable !== false ? 0 : null"
                      >
                        {{ col.label }}
                        @if (col.sortable !== false) {
                          <span class="sort-ind"><app-icon [name]="sortKey() === col.key ? (sortDir() === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort'" [size]="12" /></span>
                        }
                      </th>
                    }
                    @if (actionsTpl()) {
                      <th scope="col" class="num">Actions</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of paged(); track trackKey(row, $index)) {
                    <tr [class.clickable]="rowClickable()" (click)="rowClickable() && rowClick.emit(row)">
                      @for (col of columns(); track col.key) {
                        <td
                          [attr.data-label]="col.label"
                          [class.num]="col.align === 'right' || col.type === 'currency' || col.type === 'number'"
                          [class.hide-mobile]="col.hideMobile"
                          [class.cell-primary]="col.primary"
                        >
                          @if (cellTpl(col.key); as tpl) {
                            <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: row }" />
                          } @else {
                            @switch (col.type) {
                              @case ('status') {
                                <app-status-badge [status]="$any(raw(col, row))" />
                              }
                              @case ('currency') {
                                <span class="tabular">{{ money(raw(col, row)) }}</span>
                              }
                              @case ('date') {
                                {{ raw(col, row) ? ($any(raw(col, row)) | date: 'd MMM y') : '—' }}
                              }
                              @case ('datetime') {
                                {{ raw(col, row) ? ($any(raw(col, row)) | date: 'd MMM y, h:mm a') : '—' }}
                              }
                              @default {
                                {{ raw(col, row) ?? '—' }}
                              }
                            }
                          }
                        </td>
                      }
                      @if (actionsTpl(); as tpl) {
                        <td data-label="" class="num actions-cell" (click)="$event.stopPropagation()">
                          <div class="row-actions"><ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: row }" /></div>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (paginate()) {
              <app-pagination
                [page]="page()"
                [pageSize]="pageSize()"
                [total]="sorted().length"
                (pageChange)="page.set($event)"
                (pageSizeChange)="pageSize.set($event); page.set(1)"
              />
            }
          }
        }
      }
    </div>
  `,
})
export class DataTableComponent<T extends object> {
  private static seq = 0;
  protected readonly uid = ++DataTableComponent.seq;

  readonly rows = input.required<T[]>();
  readonly columns = input.required<Column<T>[]>();
  readonly status = input<LoadStatus>('ready');
  readonly searchable = input(true);
  readonly searchPlaceholder = input('Search…');
  readonly searchFn = input<((row: T) => string) | null>(null);
  readonly hasFilters = input(false);
  readonly filtersActive = input(false);
  readonly paginate = input(true);
  readonly initialPageSize = input(10);
  readonly defaultSort = input<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  readonly emptyTitle = input('No records found');
  readonly emptyMessage = input('');
  readonly emptyIcon = input('inbox');
  readonly rowClickable = input(false);
  readonly compact = input(false);
  readonly caption = input('Data table');
  readonly trackBy = input<keyof T | null>('id' as keyof T);

  readonly rowClick = output<T>();
  readonly retry = output<void>();
  readonly clearFilters = output<void>();

  private readonly cells = contentChildren(CellDefDirective);
  readonly actionsTpl = computed(() => this.cells().find((c) => c.appCell() === 'actions')?.template ?? null);

  protected readonly query = signal('');
  protected readonly sortKey = signal<string | null>(null);
  protected readonly sortDir = signal<'asc' | 'desc'>('asc');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);

  constructor() {
    effect(() => {
      const ds = this.defaultSort();
      const ps = this.initialPageSize();
      untracked(() => {
        if (ds && this.sortKey() === null) {
          this.sortKey.set(ds.key);
          this.sortDir.set(ds.dir);
        }
        this.pageSize.set(ps);
      });
    });
    // Reset to the first page whenever the incoming rows change (filters, location switch).
    effect(() => {
      this.rows();
      untracked(() => this.page.set(1));
    });
  }

  protected readonly searched = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.rows();
    if (!q) return rows;
    const fn = this.searchFn() ?? ((r: T) => this.columns().map((c) => this.raw(c, r) ?? '').join(' '));
    return rows.filter((r) => fn(r).toString().toLowerCase().includes(q));
  });

  protected readonly sorted = computed(() => {
    const key = this.sortKey();
    const rows = this.searched();
    if (!key) return rows;
    const col = this.columns().find((c) => c.key === key);
    if (!col) return rows;
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    const get = col.sortValue ?? ((r: T) => this.raw(col, r));
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'en', { numeric: true })) * dir;
    });
  });

  protected readonly paged = computed(() => {
    if (!this.paginate()) return this.sorted();
    const size = this.pageSize();
    const maxPage = Math.max(1, Math.ceil(this.sorted().length / size));
    const p = Math.min(this.page(), maxPage);
    return this.sorted().slice((p - 1) * size, p * size);
  });

  protected cellTpl(key: string): TemplateRef<unknown> | null {
    return this.cells().find((c) => c.appCell() === key)?.template ?? null;
  }

  protected raw(col: Column<T>, row: T): string | number | null | undefined {
    if (col.value) return col.value(row);
    return (row as Record<string, unknown>)[col.key] as string | number | null | undefined;
  }

  protected money(v: unknown): string {
    return formatInr(typeof v === 'number' ? v : Number(v));
  }

  protected trackKey(row: T, i: number): unknown {
    const k = this.trackBy();
    return k ? (row[k] ?? i) : i;
  }

  protected toggleSort(key: string): void {
    if (this.sortKey() === key) this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  protected onSearch(v: string): void {
    this.query.set(v);
    this.page.set(1);
  }

  protected clearAll(): void {
    this.query.set('');
    this.page.set(1);
    this.clearFilters.emit();
  }
}
