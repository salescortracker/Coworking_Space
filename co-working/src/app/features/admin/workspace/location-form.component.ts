import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED, emailValidator, pincodeValidator } from '../../../shared';
import { AMENITIES, Attachment, Location, SPACE_TYPE_LABELS, SpaceType } from '../../../core/models';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { LookupService } from '../../../core/services/lookup.service';
import { AuditService, ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-location-form',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <app-page-header
        [title]="isEdit() ? 'Edit location' : 'Add location'"
        [subtitle]="isEdit() ? existing()?.name ?? '' : 'Publish a new centre. You can add resources after saving.'"
        [breadcrumbs]="[{ label: 'Locations', link: '/admin/locations' }, { label: isEdit() ? 'Edit' : 'New' }]"
      />
      @if (isEdit() && !existing()) {
        <div class="card"><app-empty-state icon="building" title="Location not found" message="It may have been removed."><a routerLink="/admin/locations" class="btn btn-secondary">Back to locations</a></app-empty-state></div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          <section class="card card-body form-section">
            <h2 class="form-section-title">Basic details</h2>
            <p class="form-section-desc">Shown on the public website and member app.</p>
            <div class="form-grid">
              <div class="field span-2">
                <label class="label" for="name">Location name <span class="req">*</span></label>
                <input id="name" class="input" formControlName="name" placeholder="Officera Banjara Hills" />
                <app-field-error [control]="form.controls.name" label="Location name" />
              </div>
              <div class="field span-2">
                <label class="label" for="desc">Description</label>
                <textarea id="desc" class="textarea" formControlName="description" rows="3"></textarea>
              </div>
              <div class="field">
                <label class="label" for="phone">Phone</label>
                <input id="phone" class="input" formControlName="phone" />
              </div>
              <div class="field">
                <label class="label" for="email">Email</label>
                <input id="email" class="input" type="email" formControlName="email" />
                <app-field-error [control]="form.controls.email" label="Email" />
              </div>
              <div class="field">
                <label class="label" for="status">Status <span class="req">*</span></label>
                <select id="status" class="select" formControlName="status">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="COMING_SOON">Coming soon</option>
                </select>
              </div>
              <div class="field">
                <label class="label" for="seats">Total seats</label>
                <input id="seats" class="input" type="number" min="0" formControlName="totalSeats" />
                <app-field-error [control]="form.controls.totalSeats" label="Total seats" />
              </div>
            </div>
          </section>

          <section class="card card-body form-section">
            <h2 class="form-section-title">Address & map</h2>
            <p class="form-section-desc">Used for search, distance sorting and directions.</p>
            <div class="form-grid">
              <div class="field span-2">
                <label class="label" for="addr">Address <span class="req">*</span></label>
                <input id="addr" class="input" formControlName="address" />
                <app-field-error [control]="form.controls.address" label="Address" />
              </div>
              <div class="field">
                <label class="label" for="city">City <span class="req">*</span></label>
                <input id="city" class="input" formControlName="city" list="city-list" />
                <datalist id="city-list">
                  @for (c of locations.cities(); track c) {
                    <option [value]="c"></option>
                  }
                </datalist>
                <app-field-error [control]="form.controls.city" label="City" />
              </div>
              <div class="field">
                <label class="label" for="state">State <span class="req">*</span></label>
                <select id="state" class="select" formControlName="state">
                  @for (s of states; track s) {
                    <option [value]="s">{{ s }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label class="label" for="pin">Pincode <span class="req">*</span></label>
                <input id="pin" class="input" inputmode="numeric" maxlength="6" formControlName="pincode" />
                <app-field-error [control]="form.controls.pincode" label="Pincode" />
              </div>
              <div class="field">
                <label class="label" for="dist">Distance from city centre (km)</label>
                <input id="dist" class="input" type="number" step="0.1" min="0" formControlName="distanceKm" />
              </div>
              <div class="field">
                <label class="label" for="lat">Latitude <span class="req">*</span></label>
                <input id="lat" class="input" type="number" step="0.0001" formControlName="latitude" />
                <app-field-error [control]="form.controls.latitude" label="Latitude" />
              </div>
              <div class="field">
                <label class="label" for="lng">Longitude <span class="req">*</span></label>
                <input id="lng" class="input" type="number" step="0.0001" formControlName="longitude" />
                <app-field-error [control]="form.controls.longitude" label="Longitude" />
              </div>
            </div>
          </section>

          <section class="card card-body form-section" formGroupName="openingHours">
            <h2 class="form-section-title">Opening hours</h2>
            <p class="form-section-desc">Displayed to visitors and used for access-hour checks.</p>
            <div class="form-grid cols-3">
              <div class="field">
                <label class="label" for="wd">Monday – Friday <span class="req">*</span></label>
                <input id="wd" class="input" formControlName="weekdays" placeholder="8:00 AM – 9:00 PM" />
              </div>
              <div class="field">
                <label class="label" for="sat">Saturday <span class="req">*</span></label>
                <input id="sat" class="input" formControlName="saturday" />
              </div>
              <div class="field">
                <label class="label" for="sun">Sunday <span class="req">*</span></label>
                <input id="sun" class="input" formControlName="sunday" />
              </div>
            </div>
          </section>

          <section class="card card-body form-section">
            <h2 class="form-section-title">Workspace types & amenities</h2>
            <div class="field mb-4">
              <span class="label">Workspace types offered</span>
              <div class="chip-select">
                @for (t of spaceTypes; track t) {
                  <label><input type="checkbox" [checked]="spaceSel().includes(t)" (change)="toggleSpace(t)" />{{ spaceLabels[t] }}</label>
                }
              </div>
            </div>
            <div class="field">
              <span class="label">Amenities</span>
              <div class="chip-select">
                @for (a of amenityOptions; track a) {
                  <label><input type="checkbox" [checked]="amenities().includes(a)" (change)="toggleAmenity(a)" />{{ a }}</label>
                }
              </div>
            </div>
          </section>

          <section class="card card-body form-section">
            <h2 class="form-section-title">Photos</h2>
            <p class="form-section-desc">Upload photos for the gallery.</p>
            @if (photos().length) {
              <div class="grid grid-auto-sm mb-4">
                @for (p of photos(); track p; let i = $index) {
                  <div class="card" style="overflow: hidden; position: relative">
                    <app-workspace-image [seed]="p" style="height: 110px" />
                    <button type="button" class="btn btn-secondary btn-icon btn-sm" style="position: absolute; top: 6px; right: 6px" (click)="removePhoto(i)" aria-label="Remove photo"><app-icon name="trash" [size]="14" /></button>
                  </div>
                }
              </div>
            }
            <app-file-upload accept="image/*" hint="JPG or PNG, up to 5 MB each" (filesChange)="onUpload($event)" />
          </section>

          <div class="form-actions">
            <a class="btn btn-secondary" [routerLink]="isEdit() ? ['/admin/locations', id()] : '/admin/locations'">Cancel</a>
            <button type="submit" class="btn btn-primary" [disabled]="form.invalid || saving()" [appBusy]="saving()" busyText="Saving…">
            {{ isEdit() ? 'Save changes' : 'Create location' }}
          </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `.form-section { margin-bottom: 16px; }`,
})
export class LocationFormComponent implements OnInit {
  readonly id = input<string>();
  private readonly fb = inject(FormBuilder);
  protected readonly locations = inject(LocationService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);

  protected readonly isEdit = computed(() => !!this.id());
  protected readonly existing = computed(() => this.locations.find(this.id()));
  protected readonly saving = signal(false);
  protected readonly amenities = signal<string[]>([]);
  protected readonly spaceSel = signal<SpaceType[]>(['HOT_DESK', 'DEDICATED_DESK', 'PRIVATE_OFFICE', 'MEETING_ROOM']);
  protected readonly photos = signal<(number | string)[]>([]);
  protected readonly amenityOptions = AMENITIES;
  protected readonly spaceTypes = Object.keys(SPACE_TYPE_LABELS) as SpaceType[];
  protected readonly spaceLabels = SPACE_TYPE_LABELS;
  private readonly lookup = inject(LookupService);
  /** States from POST /api/Lookup/GetStates. */
  protected get states(): string[] {
    return this.lookup.stateNames();
  }

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    description: [''],
    phone: [''],
    email: ['', emailValidator],
    status: ['ACTIVE' as Location['status'], Validators.required],
    totalSeats: [100, [Validators.min(0)]],
    address: ['', Validators.required],
    city: ['', Validators.required],
    state: ['', Validators.required],
    pincode: ['', [Validators.required, pincodeValidator]],
    distanceKm: [5],
    latitude: [17.385, [Validators.required, Validators.min(-90), Validators.max(90)]],
    longitude: [78.4867, [Validators.required, Validators.min(-180), Validators.max(180)]],
    openingHours: this.fb.nonNullable.group({
      weekdays: ['8:00 AM – 9:00 PM', Validators.required],
      saturday: ['9:00 AM – 6:00 PM', Validators.required],
      sunday: ['Closed', Validators.required],
    }),
  });

  ngOnInit(): void {
    const l = this.existing();
    if (l) {
      this.form.patchValue(l);
      this.amenities.set([...l.amenities]);
      this.spaceSel.set([...l.spaceTypes]);
      this.photos.set([...l.photos]);
    } else {
      this.photos.set([1, 2]);
    }
  }

  protected toggleAmenity(a: string): void {
    this.amenities.update((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));
  }

  protected toggleSpace(t: SpaceType): void {
    this.spaceSel.update((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]));
  }

  protected removePhoto(i: number): void {
    this.photos.update((p) => p.filter((_, idx) => idx !== i));
  }

  /** Adds the URLs of images stored by the API (POST /api/File/Upload). */
  protected onUpload(files: Attachment[]): void {
    const urls = files.map((f) => f.url).filter((u): u is string => !!u);
    this.photos.update((p) => [...p, ...urls.filter((u) => !p.includes(u))]);
  }

  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    if (this.saving()) return; // ignore repeat clicks while running
    this.saving.set(true);
    const v = this.form.getRawValue();
    const data = { ...v, amenities: this.amenities(), spaceTypes: this.spaceSel(), photos: this.photos() };
    if (this.isEdit()) {
      this.locations.update(this.id()!, data).subscribe((l) => {
        this.audit.record('UPDATE', 'Locations', 'Location', l.id, `Updated ${l.name}`);
        this.toast.success('Location saved', l.name);
        this.router.navigate(['/admin/locations', l.id]);
      });
    } else {
      this.locations
        .create({
          ...data,
          rating: 0,
          reviewCount: 0,
          reviews: [],
          transport: [],
          startingPrice: 499,
        })
        .subscribe((l) => {
          this.audit.record('CREATE', 'Locations', 'Location', l.id, `Created ${l.name}`);
          this.toast.success('Location created', `${l.name} now appears in the list. Add resources next.`);
          this.router.navigate(['/admin/locations', l.id]);
        });
    }
  }
}
