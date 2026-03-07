import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE_NAME, readAdminSession } from '@/lib/admin-auth';

export const runtime = 'nodejs';

function getAppBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  const { protocol, host } = request.nextUrl;
  return `${protocol}//${host}`;
}

export async function GET(request: NextRequest) {
  const adminCookie = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const isAdmin = await readAdminSession(adminCookie);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = request.nextUrl.searchParams.get('token')?.trim() ?? '';
  if (!token) {
    return NextResponse.json({ error: 'token is required.' }, { status: 400 });
  }

  const baseUrl = getAppBaseUrl(request);
  const rsvpUrl = `${baseUrl}/rsvp/${encodeURIComponent(token)}`;

  try {
    const pngBuffer = await QRCode.toBuffer(rsvpUrl, {
      errorCorrectionLevel: 'M',
      width: 400,
      margin: 2,
    });

    const safeFilename = token.replace(/[^a-zA-Z0-9._-]/g, '_');
    return new NextResponse(pngBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="qr-${safeFilename}.png"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[admin/qr] Failed to generate QR code:', error);
    return NextResponse.json({ error: 'Failed to generate QR code.' }, { status: 500 });
  }
}
