const TYPE_LABELS = {
  dev: 'システム開発・DX支援',
  ai: 'AI導入・研修',
  web: 'Web制作',
  other: 'その他',
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/contact') {
      if (request.method === 'POST') {
        return handleContact(request, env);
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleContact(request, env) {
  const origin = request.headers.get('Origin') ?? '';
  const allowedOrigins = ['https://vecton.jp', 'https://www.vecton.jp'];
  if (!allowedOrigins.includes(origin) && !origin.startsWith('http://localhost')) {
    return json({ ok: false, error: 'Forbidden' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'リクエストの形式が正しくありません。' }, 400);
  }

  if (body?.website) {
    return json({ ok: true });
  }

  const { name, email, company, type, message } = body ?? {};

  if (
    (typeof name === 'string' && name.length > 100) ||
    (typeof email === 'string' && email.length > 254) ||
    (typeof company === 'string' && company.length > 100) ||
    (typeof message === 'string' && message.length > 5000)
  ) {
    return json({ ok: false, error: '入力が長すぎます。' }, 400);
  }

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return json({ ok: false, error: '必須項目を入力してください。' }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'メールアドレスの形式が正しくありません。' }, 400);
  }

  const typeLabel = TYPE_LABELS[type] ?? '未選択';
  const toEmail = env.CONTACT_TO_EMAIL ?? 'contact@vecton.dev';

  const text = [
    `お名前: ${name}`,
    `会社名: ${company?.trim() || '（未入力）'}`,
    `メールアドレス: ${email}`,
    `お問い合わせ種別: ${typeLabel}`,
    '',
    'お問い合わせ内容:',
    message,
  ].join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'vecton お問い合わせフォーム <noreply@vecton.jp>',
      to: [toEmail],
      reply_to: email,
      subject: `【お問い合わせ】${name} 様より`,
      text,
    }),
  });

  if (!res.ok) {
    console.error('Resend error:', await res.text());
    return json({ ok: false, error: '送信に失敗しました。しばらく経ってから再度お試しください。' }, 500);
  }

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
