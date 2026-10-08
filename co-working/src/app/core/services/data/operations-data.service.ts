import { Injectable } from '@angular/core';
import {
  AccessCredential,
  AccessLog,
  AppNotification,
  AuditLog,
  NotificationLog,
  NotificationTemplate,
  Ticket,
  Visitor,
} from '../../models';
import { ApiCollection } from '../api-collection';

@Injectable({ providedIn: 'root' })
export class VisitorService extends ApiCollection<Visitor> {
  constructor() {
    super('Visitor', 'VIS', (v) => v.locationId);
  }
}

@Injectable({ providedIn: 'root' })
export class AccessCredentialService extends ApiCollection<AccessCredential> {
  constructor() {
    super('AccessCredential', 'ACR', (c) => c.locationId);
  }
}

@Injectable({ providedIn: 'root' })
export class AccessLogService extends ApiCollection<AccessLog> {
  constructor() {
    super('AccessLog', 'LOG', (l) => l.locationId);
  }
}

@Injectable({ providedIn: 'root' })
export class TicketService extends ApiCollection<Ticket> {
  constructor() {
    super('Support', 'TKT', (t) => t.locationId);
  }
}

@Injectable({ providedIn: 'root' })
export class AuditLogService extends ApiCollection<AuditLog> {
  constructor() {
    super('AuditLog', 'AUD');
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationDataService extends ApiCollection<AppNotification> {
  constructor() {
    super('Notification', 'NTF');
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationTemplateService extends ApiCollection<NotificationTemplate> {
  constructor() {
    super('NotificationTemplate', 'TPL');
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationLogService extends ApiCollection<NotificationLog> {
  constructor() {
    super('NotificationLog', 'NLG', (l) => l.locationId);
  }
}
