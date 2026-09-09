import { OWNER_EMAILS } from '@/types/auth';
import type { PageSource, StoredPagePayload } from '@/types/paging';

const PAGERDUTY_BASE_URL = 'https://api.pagerduty.com';
const HATOM_PAGING_SERVICE_NAME = 'Hatom Paging';

export interface CreatePageIncidentInput {
  emoji: string;
  message: string;
  callerEmail: string;
  source: PageSource;
  pageId: string;
}

export interface CreatePageIncidentResult {
  incidentId: string;
  pageId: string;
  status: 'accepted';
}

export class PagerDutyConfigurationError extends Error {}
export class PagerDutyUpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

let cachedServiceId: string | null = null;

function apiKey(): string {
  const key = process.env.PAGERDUTY_API_KEY;
  if (!key) {
    throw new PagerDutyConfigurationError('PAGERDUTY_API_KEY is not configured');
  }
  return key;
}

function fromEmail(): string {
  return process.env.PAGERDUTY_FROM_EMAIL ?? OWNER_EMAILS[0];
}

function pagerDutyHeaders(): Record<string, string> {
  return {
    Authorization: `Token token=${apiKey()}`,
    Accept: 'application/vnd.pagerduty+json;version=2',
  };
}

interface PagerDutyService {
  id: string;
  name: string;
}

interface ServicesListResponse {
  services: PagerDutyService[];
}

interface IncidentResponse {
  incident: {
    id: string;
    incident_key: string;
  };
}

async function resolveServiceId(): Promise<string> {
  const configured = process.env.PAGERDUTY_SERVICE_ID;
  if (configured) return configured;

  if (cachedServiceId) return cachedServiceId;

  const url = `${PAGERDUTY_BASE_URL}/services?query=Hatom%20Paging&limit=100`;
  const response = await fetch(url, {
    headers: pagerDutyHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new PagerDutyConfigurationError(
      `PagerDuty service discovery failed with HTTP ${response.status}`
    );
  }

  const body = (await response.json()) as ServicesListResponse;
  const matches = body.services.filter((s) => s.name === HATOM_PAGING_SERVICE_NAME);
  if (matches.length !== 1) {
    throw new PagerDutyConfigurationError(
      `Expected exactly one "${HATOM_PAGING_SERVICE_NAME}" service, found ${matches.length}`
    );
  }

  cachedServiceId = matches[0].id;
  return cachedServiceId;
}

function buildTitle(input: CreatePageIncidentInput): string {
  return input.message
    ? `${input.emoji} ${input.message}`
    : `${input.emoji} Page from ${input.callerEmail}`;
}

function buildStoredPayload(input: CreatePageIncidentInput): StoredPagePayload {
  return {
    schema_version: 1,
    emoji: input.emoji,
    message: input.message,
    caller_email: input.callerEmail,
    source: input.source,
    page_id: input.pageId,
  };
}

export async function createPageIncident(
  input: CreatePageIncidentInput
): Promise<CreatePageIncidentResult> {
  const serviceId = await resolveServiceId();
  const from = fromEmail();
  const storedPayload = buildStoredPayload(input);

  const response = await fetch(`${PAGERDUTY_BASE_URL}/incidents`, {
    method: 'POST',
    headers: {
      ...pagerDutyHeaders(),
      'Content-Type': 'application/json',
      From: from,
    },
    body: JSON.stringify({
      incident: {
        type: 'incident',
        title: buildTitle(input),
        service: {
          id: serviceId,
          type: 'service_reference',
        },
        urgency: 'high',
        incident_key: input.pageId,
        body: {
          type: 'incident_body',
          details: JSON.stringify(storedPayload),
        },
      },
    }),
    cache: 'no-store',
  });

  if (response.status !== 201) {
    throw new PagerDutyUpstreamError(
      `PagerDuty rejected the page with HTTP ${response.status}`,
      response.status
    );
  }

  const body = (await response.json()) as IncidentResponse;
  const incidentId = body.incident?.id;
  const incidentKey = body.incident?.incident_key;
  if (!incidentId || incidentKey !== input.pageId) {
    throw new PagerDutyUpstreamError('Unexpected PagerDuty response', 502);
  }

  return { incidentId, pageId: input.pageId, status: 'accepted' };
}
