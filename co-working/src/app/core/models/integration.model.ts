import { ID, ISODateTime } from './common.model';

/** Every external service category Officera depends on. */
export type IntegrationCategory =
  | 'EMAIL'
  | 'SMS'
  | 'WHATSAPP'
  | 'PUSH'
  | 'PAYMENT'
  | 'GOOGLE_CALENDAR'
  | 'OUTLOOK_CALENDAR'
  | 'ACCESS_CONTROL'
  | 'STORAGE'
  | 'OAUTH'
  | 'ACCOUNTING'
  | 'MAPS'
  | 'GST_EINVOICE'
  | 'WEBHOOK';

export type FieldType = 'text' | 'url' | 'number' | 'email' | 'select' | 'secret' | 'textarea' | 'toggle';

/** Describes one configuration field of a provider. Schema only – never holds values. */
export interface ProviderField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: string[];
  /** Default value used when a new integration is added. */
  default?: string;
}

export interface ProviderDefinition {
  key: string;
  name: string;
  description: string;
  docsUrl?: string;
  fields: ProviderField[];
  /** Supports sandbox/test mode. */
  sandbox?: boolean;
}

export interface CategoryDefinition {
  key: IntegrationCategory;
  label: string;
  description: string;
  icon: string;
  group: 'Communication' | 'Payments & Finance' | 'Calendar' | 'Operations' | 'Identity & Storage' | 'Other';
  /** Officera features that depend on this category. */
  usedBy: string[];
  /** Whether Officera needs an active provider in this category to run end to end. */
  required: boolean;
  providers: ProviderDefinition[];
}

export type IntegrationStatus = 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR' | 'DISABLED' | 'UNTESTED';

/**
 * A secret is never stored in the browser. The frontend only keeps a reference to where the
 * backend vault holds it, plus a masked hint so admins can see that it has been set.
 */
export interface SecretRef {
  isSet: boolean;
  /** e.g. "••••3f9a" */
  hint?: string;
  /** e.g. "vault://officera/integrations/INT-0003/apiKey" */
  vaultRef?: string;
  updatedAt?: ISODateTime;
}

export interface ConnectionTest {
  at: ISODateTime;
  ok: boolean;
  latencyMs: number;
  message: string;
  by: string;
}

export interface Integration {
  id: ID;
  category: IntegrationCategory;
  providerKey: string;
  displayName: string;
  environment: 'SANDBOX' | 'LIVE';
  enabled: boolean;
  /** The provider Officera uses for this category (one per category). */
  active: boolean;
  status: IntegrationStatus;
  /** Non-secret settings (hosts, ports, IDs, URLs…). */
  config: Record<string, string>;
  /** Secret settings – references only. */
  secrets: Record<string, SecretRef>;
  tests: ConnectionTest[];
  updatedAt: ISODateTime;
  updatedBy: string;
}
