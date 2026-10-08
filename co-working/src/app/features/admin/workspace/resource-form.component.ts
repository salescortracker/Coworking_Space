import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED } from '../../../shared';
import { AMENITIES, Attachment, Resource, SPACE_TYPE_LABELS } from '../../../core/models';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { AuditService, ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-resource-form',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <app-page-header
        [title]="isEdit() ? 'Edit resource' : 'Add resource'"
        [subtitle]="isEdit() ? existing()?.name ?? '' : 'Create a bookable desk, office or meeting room.'"
        [breadcrumbs]="[{ label: 'Resources', link: '/admin/resources' }, { label: isEdit() ? 'Edit' : 'New' }]"
      />
      @if (isEdit() && !existing()) {
        <div class="card"><app-empty-state icon="layers" title="Resource not found"><a routerLink="/admin/resources" class="btn btn-secondary">Back to resources</a></app-empty-state></div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" novalidate class="stack">
          <section class="card card-body">
            <h2 class="form-section-title mb-4">Resource details</h2>
            <div class="form-grid">
              <div class="field">
                <label class="label" for="rn">Resource name <span class="req">*</span></label>
                <input id="rn" class="input" formControlName="name" placeholder="Boardroom" />
                <app-field-error [control]="form.controls.name" label="Resource name" />
              </div>
              <div class="field">
                <label class="label" for="rc">Code <span class="req">*</span></label>
                <input id="rc" class="input" formControlName="code" placeholder="HIT-MR-4" style="text-transform: uppercase" />
                <app-field-error [control]="form.controls.code" label="Code" />
              </div>
              <div class="field">
                <label class="label" for="rt">Type <span class="req">*</span></label>
                <select id="rt" class="select" formControlName="type">
                  @for (t of types; track t) {
                    <option [value]="t">{{ labels[t] }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label class="label" for="rl">Location <span class="req">*</span></label>
                <select id="rl" class="select" formControlName="locationId">
                  <option value="" disabled>Select location</option>
                  @for (l of locations.scoped(); track l.id) {
                    <option [value]="l.id">{{ l.name }}</option>
                  }
                </select>
                <app-field-error [control]="form.controls.locationId" label="Location" />
              </div>
              <div class="field">
                <label class="label" for="rf">Floor / zone</label>
                <input id="rf" class="input" formControlName="floor" />
              </div>
              <div class="field">
                <label class="label" for="rcap">Capacity <span class="req">*</span></label>
                <input id="rcap" class="input" type="number" min="1" formControlName="capacity" />
                <app-field-error [control]="form.controls.capacity" label="Capacity" />
              </div>
              <div class="field">
                <label class="label" for="rp">Price (₹, excl. GST) <span class="req">*</span></label>
                <input id="rp" class="input" type="number" min="0" formControlName="price" />
                <app-field-error [control]="form.controls.price" label="Price" />
              </div>
              <div class="field">
                <label class="label" for="ru">Price unit <span class="req">*</span></label>
                <select id="ru" class="select" formControlName="priceUnit">
                  <option value="hour">Per hour</option>
                  <option value="day">Per day</option>
                  <option value="month">Per month</option>
                </select>
              </div>
              <div class="field">
                <label class="label" for="rs">Status <span class="req">*</span></label>
                <select id="rs" class="select" formControlName="status">
                  <option value="ACTIVE">Active</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div class="field">
                <label class="label" for="ra">Availability <span class="req">*</span></label>
                <input id="ra" class="input" formControlName="availability" placeholder="Mon–Sat, 8 AM – 9 PM" />
                <app-field-error [control]="form.controls.availability" label="Availability" />
              </div>
              <div class="field span-2">
                <label class="label" for="rcr">Cancellation rules <span class="req">*</span></label>
                <textarea id="rcr" class="textarea" rows="2" formControlName="cancellationRule"></textarea>
                <app-field-error [control]="form.controls.cancellationRule" label="Cancellation rules" />
              </div>
              <div class="field span-2">
                <label class="check"><input type="checkbox" formControlName="blocked" /> Block on floor map (not bookable by members)</label>
              </div>
            </div>
          </section>
          <section class="card card-body">
            <h2 class="form-section-title mb-3">Amenities</h2>
            <div class="chip-select">
              @for (a of amenityOptions; track a) {
                <label><input type="checkbox" [checked]="amenities().includes(a)" (change)="toggle(a)" />{{ a }}</label>
              }
            </div>
          </section>
          <section class="card card-body">
            <h2 class="form-section-title mb-3">Images</h2>
            <app-file-upload accept="image/*" hint="Upload resource photos" (filesChange)="uploaded.set($event)" />
          </section>
          <div class="form-actions">
            <a class="btn btn-secondary" [routerLink]="isEdit() ? ['/admin/resources', id()] : '/admin/resources'">Cancel</a>
            <button type="submit" class="btn btn-primary" [disabled]="form.invalid || saving()" [appBusy]="saving()" busyText="Saving…">
            {{ isEdit() ? 'Save changes' : 'Create resource' }}
          </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class ResourceFormComponent implements OnInit {
  readonly id = input<string>();
  readonly locationId = input<string>();
  private readonly fb = inject(FormBuilder);
  private readonly resources = inject(ResourceService);
  protected readonly locations = inject(LocationService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);

  protected readonly types = ['HOT_DESK', 'DEDICATED_DESK', 'PRIVATE_OFFICE', 'MEETING_ROOM'] as const;
  protected readonly labels = SPACE_TYPE_LABELS;
  protected readonly amenityOptions = [...AMENITIES, 'Ergonomic Chair'];
  protected readonly isEdit = computed(() => !!this.id());
  protected readonly existing = computed(() => this.resources.find(this.id()));
  protected readonly saving = signal(false);
  protected readonly amenities = signal<string[]>(['High-speed Wi-Fi', 'Power Backup']);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]+$/)]],
    type: ['MEETING_ROOM' as Resource['type'], Validators.required],
    locationId: ['', Validators.required],
    floor: ['4th Floor'],
    capacity: [4, [Validators.required, Validators.min(1), Validators.max(200)]],
    price: [499, [Validators.required, Validators.min(0)]],
    priceUnit: ['hour' as Resource['priceUnit'], Validators.required],
    status: ['ACTIVE' as Resource['status'], Validators.required],
    availability: ['Mon–Sat, 8 AM – 9 PM', Validators.required],
    cancellationRule: ['Free cancellation up to 2 hours before start.', Validators.required],
    blocked: [false],
  });

  ngOnInit(): void {
    const r = this.existing();
    if (r) {
      this.form.patchValue({ ...r, blocked: !!r.blocked });
      this.amenities.set([...r.amenities]);
    } else if (this.locationId()) {
      this.form.patchValue({ locationId: this.locationId() });
    }
  }

  /** Images stored by the API for this resource (POST /api/File/Upload). */
  protected readonly uploaded = signal<Attachment[]>([]);

  protected toggle(a: string): void {
    this.amenities.update((l) => (l.includes(a) ? l.filter((x) => x !== a) : [...l, a]));
  }

  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    if (this.saving()) return; // ignore repeat clicks while running
    this.saving.set(true);
    const v = this.form.getRawValue();
    const urls = this.uploaded().map((f) => f.url).filter((u): u is string => !!u);
    const existingPhotos = this.isEdit() ? (this.resources.find(this.id()!)?.photos ?? []) : [];
    const data = { ...v, code: v.code.toUpperCase(), amenities: this.amenities(), ...(urls.length ? { photos: [...urls, ...existingPhotos.filter((p) => !urls.includes(String(p)))] } : {}) };
    if (this.isEdit()) {
      this.resources.update(this.id()!, data).subscribe((r) => {
        this.audit.record('UPDATE', 'Resources', 'Resource', r.id, `Updated ${r.name}`);
        this.toast.success('Resource saved', r.name);
        this.router.navigate(['/admin/resources', r.id]);
      });
    } else {
      // Place new resources in a free spot on the map (bottom strip).
      const count = this.resources.byLocation(v.locationId).length;
      this.resources
        .create({ photos: [count + 20], ...data, map: { x: 4 + ((count * 9) % 48), y: 88, w: 8, h: 9 } })
        .subscribe((r) => {
          this.audit.record('CREATE', 'Resources', 'Resource', r.id, `Created ${r.name}`);
          this.toast.success('Resource created', `${r.name} is now listed under ${this.locations.name(r.locationId)}.`);
          this.router.navigate(['/admin/resources', r.id]);
        });
    }
  }
}
