import { CategoryDefinition, ProviderField } from '../models';

/**
 * Catalogue of the external services Officera can use and the configuration fields each provider needs.
 * This is a schema (field names, labels, types), not data: configured providers and their values are stored
 * in the database through POST /api/Integration/*, and secrets are encrypted by the API.
 */

/* ------------------------------------------------------------------
 * Provider catalogue: the schema of every external service Officera
 * needs. Contains field definitions only – no credentials.
 * ------------------------------------------------------------------ */

const secret = (key: string, label: string, hint?: string): ProviderField => ({ key, label, type: 'secret', required: true, hint });
const text = (key: string, label: string, required = true, placeholder?: string, def?: string): ProviderField => ({ key, label, type: 'text', required, placeholder, default: def });
const url = (key: string, label: string, required = true, placeholder?: string, def?: string): ProviderField => ({ key, label, type: 'url', required, placeholder, default: def });
const select = (key: string, label: string, options: string[], def?: string): ProviderField => ({ key, label, type: 'select', required: true, options, default: def ?? options[0] });
const webhookUrl = url('webhookUrl', 'Webhook URL (Officera endpoint)', false, 'https://api.officera.in/webhooks/…');

export function integrationCatalog(): CategoryDefinition[] {
  return [
    {
      key: 'EMAIL',
      label: 'Email / SMTP',
      description: 'Transactional email: booking confirmations, invoices, reminders, password resets.',
      icon: 'mail',
      group: 'Communication',
      usedBy: ['Booking confirmations', 'GST invoice emails', 'Renewal reminders', 'Password reset', 'Visitor passes'],
      required: true,
      providers: [
        { key: 'SMTP', name: 'Custom SMTP', description: 'Any SMTP server (Gmail Workspace, Microsoft 365, Zoho Mail…).', fields: [text('host', 'SMTP host', true, 'smtp.office365.com'), { key: 'port', label: 'Port', type: 'number', required: true, default: '587' }, select('encryption', 'Encryption', ['STARTTLS', 'SSL/TLS', 'None']), text('username', 'Username'), secret('password', 'Password'), text('fromName', 'From name', true, '', 'Officera'), { key: 'fromEmail', label: 'From email', type: 'email', required: true, default: 'no-reply@officera.in' }] },
        { key: 'SES', name: 'Amazon SES', description: 'AWS Simple Email Service.', sandbox: true, fields: [select('region', 'AWS region', ['ap-south-1', 'ap-southeast-1', 'us-east-1']), text('accessKeyId', 'Access key ID'), secret('secretAccessKey', 'Secret access key'), { key: 'fromEmail', label: 'Verified from email', type: 'email', required: true, default: 'no-reply@officera.in' }, text('configurationSet', 'Configuration set', false)] },
        { key: 'SENDGRID', name: 'SendGrid', description: 'Twilio SendGrid email API.', fields: [secret('apiKey', 'API key'), { key: 'fromEmail', label: 'From email', type: 'email', required: true, default: 'no-reply@officera.in' }, text('fromName', 'From name', true, '', 'Officera')] },
      ],
    },
    {
      key: 'SMS',
      label: 'SMS',
      description: 'OTP verification, booking reminders and payment alerts by SMS (DLT-registered).',
      icon: 'phone',
      group: 'Communication',
      usedBy: ['Login & registration OTP', 'Public enquiry OTP', 'Booking reminders (1 hour)', 'Payment failure alerts', 'Visitor passes'],
      required: true,
      providers: [
        { key: 'MSG91', name: 'MSG91', description: 'Indian SMS gateway with DLT templates.', fields: [secret('authKey', 'Auth key'), text('senderId', 'Sender ID', true, 'OFCERA'), text('dltEntityId', 'DLT entity ID'), text('otpTemplateId', 'OTP template ID'), select('route', 'Route', ['Transactional', 'OTP', 'Promotional'])] },
        { key: 'TWILIO', name: 'Twilio', description: 'Global SMS API.', sandbox: true, fields: [text('accountSid', 'Account SID'), secret('authToken', 'Auth token'), text('fromNumber', 'From number', true, '+1…'), text('messagingServiceSid', 'Messaging service SID', false)] },
        { key: 'GUPSHUP_SMS', name: 'Gupshup SMS', description: 'Enterprise SMS for India.', fields: [text('userId', 'User ID'), secret('password', 'Password'), text('senderId', 'Sender ID'), text('dltEntityId', 'DLT entity ID')] },
      ],
    },
    {
      key: 'WHATSAPP',
      label: 'WhatsApp',
      description: 'WhatsApp Business messages for passes, reminders and receipts.',
      icon: 'message',
      group: 'Communication',
      usedBy: ['Visitor passes', 'Booking confirmations', 'Payment receipts'],
      required: false,
      providers: [
        { key: 'META_CLOUD', name: 'Meta WhatsApp Cloud API', description: 'Official WhatsApp Business Platform.', fields: [text('phoneNumberId', 'Phone number ID'), text('businessAccountId', 'WhatsApp business account ID'), secret('accessToken', 'Permanent access token'), secret('appSecret', 'App secret', 'Used to verify webhook signatures'), text('verifyToken', 'Webhook verify token'), webhookUrl] },
        { key: 'GUPSHUP_WA', name: 'Gupshup WhatsApp', description: 'WhatsApp BSP for India.', fields: [text('appName', 'App name'), secret('apiKey', 'API key'), text('sourceNumber', 'Source number')] },
        { key: 'TWILIO_WA', name: 'Twilio WhatsApp', description: 'WhatsApp via Twilio.', sandbox: true, fields: [text('accountSid', 'Account SID'), secret('authToken', 'Auth token'), text('fromNumber', 'WhatsApp sender', true, 'whatsapp:+…')] },
      ],
    },
    {
      key: 'PUSH',
      label: 'Push notifications',
      description: 'Mobile and web push for visitor arrivals, bookings and announcements.',
      icon: 'bell',
      group: 'Communication',
      usedBy: ['Visitor arrival alerts', 'Booking confirmations', 'Community announcements', 'Ticket updates'],
      required: true,
      providers: [
        { key: 'FCM', name: 'Firebase Cloud Messaging', description: 'Android, iOS and web push via Firebase.', fields: [text('projectId', 'Firebase project ID'), text('senderId', 'Sender ID'), text('webVapidKey', 'Web push VAPID public key', false), secret('serviceAccountJson', 'Service account JSON', 'Stored in the backend vault only')] },
        { key: 'ONESIGNAL', name: 'OneSignal', description: 'Hosted push notifications.', fields: [text('appId', 'App ID'), secret('restApiKey', 'REST API key')] },
      ],
    },
    {
      key: 'PAYMENT',
      label: 'Payment gateway',
      description: 'Collect subscription, booking, deposit and dues payments by UPI, card and net banking.',
      icon: 'credit-card',
      group: 'Payments & Finance',
      usedBy: ['Membership checkout', 'Booking checkout', 'Outstanding dues', 'Recurring renewals (retries day 1/3/7)', 'Refunds'],
      required: true,
      providers: [
        { key: 'RAZORPAY', name: 'Razorpay', description: 'UPI, cards, net banking, subscriptions and refunds.', sandbox: true, fields: [text('keyId', 'Key ID', true, 'rzp_test_…'), secret('keySecret', 'Key secret'), secret('webhookSecret', 'Webhook secret'), select('currency', 'Currency', ['INR']), { key: 'autoCapture', label: 'Auto-capture payments', type: 'toggle', default: 'true' }, webhookUrl] },
        { key: 'CASHFREE', name: 'Cashfree Payments', description: 'Payment gateway and payouts.', sandbox: true, fields: [text('appId', 'App ID'), secret('secretKey', 'Secret key'), secret('webhookSecret', 'Webhook secret'), webhookUrl] },
        { key: 'PAYU', name: 'PayU', description: 'PayU India.', sandbox: true, fields: [text('merchantKey', 'Merchant key'), secret('merchantSalt', 'Merchant salt'), webhookUrl] },
        { key: 'STRIPE', name: 'Stripe', description: 'International cards.', sandbox: true, fields: [text('publishableKey', 'Publishable key', true, 'pk_test_…'), secret('secretKey', 'Secret key'), secret('webhookSecret', 'Webhook signing secret'), webhookUrl] },
      ],
    },
    {
      key: 'GOOGLE_CALENDAR',
      label: 'Google Calendar',
      description: 'Sync member bookings and events to Google Calendar.',
      icon: 'calendar',
      group: 'Calendar',
      usedBy: ['Booking “Add to Calendar”', 'Meeting-room sync', 'Community events'],
      required: false,
      providers: [
        { key: 'GOOGLE_CAL', name: 'Google Calendar API', description: 'OAuth 2.0 calendar sync.', fields: [text('clientId', 'OAuth client ID', true, '…apps.googleusercontent.com'), secret('clientSecret', 'OAuth client secret'), url('redirectUri', 'Redirect URI', true, '', 'https://app.officera.in/oauth/google/callback'), text('scopes', 'Scopes', true, '', 'https://www.googleapis.com/auth/calendar.events'), text('roomCalendarDomain', 'Room resource domain', false, 'resource.calendar.google.com')] },
      ],
    },
    {
      key: 'OUTLOOK_CALENDAR',
      label: 'Microsoft Outlook Calendar',
      description: 'Sync bookings to Outlook / Microsoft 365 calendars via Microsoft Graph.',
      icon: 'calendar',
      group: 'Calendar',
      usedBy: ['Booking “Add to Calendar”', 'Meeting-room sync'],
      required: false,
      providers: [
        { key: 'MS_GRAPH', name: 'Microsoft Graph', description: 'Azure AD app registration.', fields: [text('tenantId', 'Directory (tenant) ID'), text('clientId', 'Application (client) ID'), secret('clientSecret', 'Client secret'), url('redirectUri', 'Redirect URI', true, '', 'https://app.officera.in/oauth/microsoft/callback'), text('scopes', 'Scopes', true, '', 'Calendars.ReadWrite offline_access')] },
      ],
    },
    {
      key: 'ACCESS_CONTROL',
      label: 'Access control / Doors',
      description: 'Push QR credentials to door controllers and receive entry/exit events.',
      icon: 'door',
      group: 'Operations',
      usedBy: ['Member QR access', 'Visitor QR passes', 'Entry/exit logs', 'Revoke on suspension'],
      required: true,
      providers: [
        { key: 'MATRIX_COSEC', name: 'Matrix COSEC', description: 'Matrix COSEC access control (India).', fields: [url('baseUrl', 'COSEC server URL', true, 'https://cosec.officera.local'), text('username', 'API user'), secret('password', 'API password'), text('siteCode', 'Site code'), { key: 'doorMap', label: 'Door mapping (door → device ID)', type: 'textarea', required: false, placeholder: 'Main Entrance=101\nLobby Turnstile 1=102' }, webhookUrl] },
        { key: 'HID', name: 'HID Origo / Mobile Access', description: 'HID mobile credentials.', fields: [text('organizationId', 'Organization ID'), text('clientId', 'Client ID'), secret('clientSecret', 'Client secret'), url('baseUrl', 'API base URL', true, '', 'https://api.origo.hidglobal.com')] },
        { key: 'ZKTECO', name: 'ZKTeco ZKBio', description: 'ZKBio CVSecurity.', fields: [url('baseUrl', 'Server URL'), secret('accessToken', 'API token'), text('areaCode', 'Area code')] },
        { key: 'GENERIC_DOOR', name: 'Generic door API (webhook)', description: 'Any controller with a REST/webhook API.', fields: [url('baseUrl', 'Controller API URL'), secret('apiKey', 'API key'), { key: 'qrFormat', label: 'QR payload format', type: 'select', required: true, options: ['Officera code', 'JWT', 'Wiegand 26'], default: 'Officera code' }, webhookUrl] },
      ],
    },
    {
      key: 'STORAGE',
      label: 'Cloud storage / Files',
      description: 'Store invoice PDFs, visitor photos, ticket attachments and gallery images.',
      icon: 'upload',
      group: 'Identity & Storage',
      usedBy: ['GST invoice PDFs', 'Visitor photos', 'Ticket attachments', 'Location & gallery images', 'Profile photos'],
      required: true,
      providers: [
        { key: 'S3', name: 'Amazon S3', description: 'AWS object storage.', fields: [text('bucket', 'Bucket name'), select('region', 'Region', ['ap-south-1', 'ap-southeast-1', 'us-east-1']), text('accessKeyId', 'Access key ID'), secret('secretAccessKey', 'Secret access key'), url('cdnUrl', 'CDN base URL', false)] },
        { key: 'AZURE_BLOB', name: 'Azure Blob Storage', description: 'Microsoft Azure storage.', fields: [text('accountName', 'Storage account'), text('container', 'Container'), secret('connectionString', 'Connection string')] },
        { key: 'GCS', name: 'Google Cloud Storage', description: 'Google Cloud object storage.', fields: [text('bucket', 'Bucket'), text('projectId', 'Project ID'), secret('serviceAccountJson', 'Service account JSON')] },
      ],
    },
    {
      key: 'OAUTH',
      label: 'Google Sign-In / OAuth',
      description: 'Single sign-on for members and staff.',
      icon: 'key',
      group: 'Identity & Storage',
      usedBy: ['“Continue with Google” on login', 'Staff SSO'],
      required: false,
      providers: [
        { key: 'GOOGLE_OAUTH', name: 'Google Sign-In', description: 'Google Identity Services (OAuth 2.0 / OpenID Connect).', fields: [text('clientId', 'OAuth client ID', true, '…apps.googleusercontent.com'), secret('clientSecret', 'OAuth client secret'), url('redirectUri', 'Redirect URI', true, '', 'https://app.officera.in/auth/google/callback'), text('allowedDomains', 'Allowed staff domains', false, 'officera.in')] },
        { key: 'MS_OAUTH', name: 'Microsoft Sign-In', description: 'Microsoft Entra ID.', fields: [text('tenantId', 'Tenant ID'), text('clientId', 'Client ID'), secret('clientSecret', 'Client secret'), url('redirectUri', 'Redirect URI', true, '', 'https://app.officera.in/auth/microsoft/callback')] },
      ],
    },
    {
      key: 'ACCOUNTING',
      label: 'Accounting software',
      description: 'Post sales invoices, receipts, refunds and credit notes to your books.',
      icon: 'receipt',
      group: 'Payments & Finance',
      usedBy: ['Accounting export', 'Invoice sync', 'Receipt and refund vouchers'],
      required: false,
      providers: [
        { key: 'TALLY', name: 'Tally Prime', description: 'Tally Prime via XML over HTTP (Tally connector).', fields: [url('serverUrl', 'Tally server URL', true, 'http://tally.officera.local:9000'), text('companyName', 'Company name in Tally', true, '', 'Officera Workspaces Private Limited'), text('salesLedger', 'Sales ledger', true, '', 'Coworking Services (997212)'), select('syncMode', 'Sync mode', ['Daily batch', 'Real time', 'Manual export'])] },
        { key: 'ZOHO_BOOKS', name: 'Zoho Books', description: 'Zoho Books API.', fields: [text('organizationId', 'Organization ID'), text('clientId', 'Client ID'), secret('clientSecret', 'Client secret'), secret('refreshToken', 'Refresh token'), select('dataCenter', 'Data centre', ['.in', '.com'])] },
        { key: 'QUICKBOOKS', name: 'QuickBooks Online', description: 'Intuit QuickBooks.', sandbox: true, fields: [text('realmId', 'Company (realm) ID'), text('clientId', 'Client ID'), secret('clientSecret', 'Client secret')] },
      ],
    },
    {
      key: 'MAPS',
      label: 'Maps & location',
      description: 'Location maps, directions and distance sorting on the public website.',
      icon: 'map',
      group: 'Other',
      usedBy: ['Location details map', 'Search map view', 'Distance sorting'],
      required: false,
      providers: [
        { key: 'GOOGLE_MAPS', name: 'Google Maps Platform', description: 'Maps JavaScript, Places and Distance Matrix.', fields: [secret('browserKey', 'Browser API key', 'Restricted by HTTP referrer; still managed by the backend'), text('mapId', 'Map ID', false)] },
        { key: 'MAPMYINDIA', name: 'Mappls (MapmyIndia)', description: 'Indian maps provider.', fields: [text('clientId', 'Client ID'), secret('clientSecret', 'Client secret')] },
      ],
    },
    {
      key: 'GST_EINVOICE',
      label: 'GST e-invoicing / GSTIN',
      description: 'IRN generation through a GSP and GSTIN verification for B2B invoices.',
      icon: 'file-text',
      group: 'Payments & Finance',
      usedBy: ['GST invoices (IRN & QR)', 'GSTIN verification on member profiles'],
      required: false,
      providers: [
        { key: 'CLEARTAX', name: 'ClearTax GSP', description: 'e-Invoice IRN via ClearTax.', sandbox: true, fields: [text('gstin', 'Supplier GSTIN'), text('username', 'GSP username'), secret('authToken', 'Auth token'), url('baseUrl', 'API base URL', true, '', 'https://api.clear.in')] },
        { key: 'MASTERS_INDIA', name: 'Masters India GSP', description: 'e-Invoice and GSTIN lookup.', sandbox: true, fields: [text('gstin', 'Supplier GSTIN'), text('clientId', 'Client ID'), secret('clientSecret', 'Client secret')] },
      ],
    },
    {
      key: 'WEBHOOK',
      label: 'Other APIs & webhooks',
      description: 'Outbound webhooks to CRMs, Slack/Teams alerts, analytics and custom systems.',
      icon: 'zap',
      group: 'Other',
      usedBy: ['New lead alerts', 'Booking events', 'Payment events', 'Custom integrations'],
      required: false,
      providers: [
        { key: 'CUSTOM_WEBHOOK', name: 'Custom webhook', description: 'POST signed JSON events to any URL.', fields: [url('targetUrl', 'Target URL'), secret('signingSecret', 'Signing secret'), { key: 'events', label: 'Events', type: 'textarea', required: true, default: 'lead.created\nbooking.confirmed\npayment.succeeded' }] },
        { key: 'SLACK', name: 'Slack', description: 'Post alerts to a Slack channel.', fields: [secret('webhookUrl', 'Incoming webhook URL'), text('channel', 'Channel', false, '#ops-alerts')] },
        { key: 'TEAMS', name: 'Microsoft Teams', description: 'Post alerts to a Teams channel.', fields: [secret('webhookUrl', 'Incoming webhook URL')] },
      ],
    },
  ];
}

