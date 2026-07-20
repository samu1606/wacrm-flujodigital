import { NextRequest, NextResponse } from 'next/server';

const VALID_LOCALES = ['es', 'en'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const locale = body.locale;

    if (!locale || !VALID_LOCALES.includes(locale)) {
      return NextResponse.json(
        { error: `Invalid locale. Use: ${VALID_LOCALES.join(', ')}` },
        { status: 400 }
      );
    }

    const response = NextResponse.json({ locale, ok: true });
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
