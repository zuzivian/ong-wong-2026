const GOOGLE_CALENDAR_BASE_URL = 'https://calendar.google.com/calendar/render';

export const WEDDING_EVENT_TITLE = "Samuel & Natasha's Wedding";
export const WEDDING_EVENT_LOCATION =
  'The Singapore Thomson Road Baptist Church, 45 Thomson Road, Singapore 307584';
export const WEDDING_EVENT_DESCRIPTION =
  'Wedding service at The Singapore Thomson Road Baptist Church, followed by a reception in the church hall.';
export const WEDDING_EVENT_TIMEZONE = 'Asia/Singapore';

function toUtcCalendarStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildGoogleCalendarUrl(options?: {
  title?: string;
  description?: string;
  location?: string;
  startAt?: Date;
  endAt?: Date;
  timezone?: string;
}): string {
  const startAt = options?.startAt ?? new Date(Date.UTC(2026, 7, 15, 2, 0, 0));
  const endAt = options?.endAt ?? new Date(Date.UTC(2026, 7, 15, 5, 0, 0));

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: options?.title ?? WEDDING_EVENT_TITLE,
    dates: `${toUtcCalendarStamp(startAt)}/${toUtcCalendarStamp(endAt)}`,
    details: options?.description ?? WEDDING_EVENT_DESCRIPTION,
    location: options?.location ?? WEDDING_EVENT_LOCATION,
    ctz: options?.timezone ?? WEDDING_EVENT_TIMEZONE,
  });

  return `${GOOGLE_CALENDAR_BASE_URL}?${params.toString()}`;
}

export function buildWeddingGoogleCalendarUrl(): string {
  return buildGoogleCalendarUrl();
}
