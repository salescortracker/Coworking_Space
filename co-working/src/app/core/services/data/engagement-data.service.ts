import { Injectable, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { BlogPost, CommunityEvent, GalleryItem, HomepageContent, Lead, Perk, Post } from '../../models';
import { ApiCollection } from '../api-collection';
import { ApiService } from '../api.service';

@Injectable({ providedIn: 'root' })
export class LeadService extends ApiCollection<Lead> {
  constructor() {
    super('Lead', 'LEAD', (l) => l.locationId);
  }
}

@Injectable({ providedIn: 'root' })
export class PostService extends ApiCollection<Post> {
  constructor() {
    super('Post', 'PST');
  }
}

@Injectable({ providedIn: 'root' })
export class EventService extends ApiCollection<CommunityEvent> {
  constructor() {
    super('Event', 'EVT', (e) => e.locationId);
  }
}

@Injectable({ providedIn: 'root' })
export class PerkService extends ApiCollection<Perk> {
  constructor() {
    super('Perk', 'PRK');
  }
}

@Injectable({ providedIn: 'root' })
export class BlogService extends ApiCollection<BlogPost> {
  constructor() {
    super('BlogPost', 'BLG');
  }
}

@Injectable({ providedIn: 'root' })
export class GalleryService extends ApiCollection<GalleryItem> {
  constructor() {
    super('Gallery', 'GAL', (g) => g.locationId);
  }
}

const EMPTY_HOMEPAGE: HomepageContent = {
  heroTitle: '',
  heroSubtitle: '',
  stats: [],
  testimonials: [],
  features: [],
  announcement: '',
  showAnnouncement: false,
};

/** Single editable document for homepage marketing content (POST /api/Homepage/Get | Update). */
@Injectable({ providedIn: 'root' })
export class HomepageContentService {
  private readonly api = inject(ApiService);
  readonly content = signal<HomepageContent>(EMPTY_HOMEPAGE);

  async load(): Promise<void> {
    try {
      this.content.set(await firstValueFrom(this.api.post<HomepageContent>('Homepage/Get', {}, { spinner: 'background' })));
    } catch {
      /* keep the current content */
    }
  }

  get(): Observable<HomepageContent> {
    return this.api.post<HomepageContent>('Homepage/Get', {}, { spinner: 'background' }).pipe(tap((c) => this.content.set(c)));
  }

  save(value: HomepageContent): Observable<HomepageContent> {
    return this.api.post<HomepageContent>('Homepage/Update', value, { spinner: 'blocking', message: 'Saving…' }).pipe(tap((c) => this.content.set(c)));
  }
}
