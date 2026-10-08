import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Company, Member, Permission, RoleDefinition, User } from '../../models';
import { ApiCollection } from '../api-collection';

@Injectable({ providedIn: 'root' })
export class MemberService extends ApiCollection<Member> {
  constructor() {
    super('Member', 'MEM', (m) => m.locationId);
  }

  fullName(id: string | undefined): string {
    const m = this.find(id);
    return m ? `${m.firstName} ${m.lastName}` : '—';
  }
}

@Injectable({ providedIn: 'root' })
export class CompanyService extends ApiCollection<Company> {
  constructor() {
    super('Company', 'COM', (c) => c.locationId);
  }

  name(id: string | undefined): string {
    return this.find(id)?.name ?? '—';
  }
}

@Injectable({ providedIn: 'root' })
export class UserService extends ApiCollection<User> {
  constructor() {
    super('User', 'USR');
  }

  name(id: string | undefined): string {
    return this.find(id)?.name ?? 'Unassigned';
  }
}

@Injectable({ providedIn: 'root' })
export class RoleService extends ApiCollection<RoleDefinition> {
  private readonly permissionCatalog = signal<Permission[]>([]);

  constructor() {
    super('Role', 'ROL');
  }

  /** Loads the roles and the permission catalogue (POST /api/Role/GetPermissions). */
  override async load(): Promise<void> {
    await super.load();
    try {
      this.permissionCatalog.set(await firstValueFrom(this.api.post<Permission[]>('Role/GetPermissions', {}, { spinner: 'background' })));
    } catch {
      this.permissionCatalog.set([]);
    }
  }

  override reset(): void {
    super.reset();
    this.permissionCatalog.set([]);
  }

  /** Catalogue of every permission. */
  catalog(): Permission[] {
    return this.permissionCatalog();
  }

  permissionsFor(roleKey: string): string[] {
    return this.items().find((r) => r.key === roleKey)?.permissions ?? [];
  }
}
