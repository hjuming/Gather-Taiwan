function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });
}

function getEmailJsConfig(env) {
  return {
    serviceId: env.EMAILJS_SERVICE_ID || env.VITE_EMAILJS_SERVICE_ID,
    templateId: env.EMAILJS_TEMPLATE_ID || env.VITE_EMAILJS_TEMPLATE_ID,
    publicKey: env.EMAILJS_PUBLIC_KEY || env.VITE_EMAILJS_PUBLIC_KEY,
  };
}

function cleanText(value, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 1800) || fallback : fallback;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export async function onRequestPost({ request, env }) {
  const { serviceId, templateId, publicKey } = getEmailJsConfig(env);
  if (!serviceId || !templateId || !publicKey) {
    return json({ error: "信件系統正在設定中，請稍後再試。" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name, "聚場台灣網站訪客");
  const email = cleanText(body.email);
  const phone = cleanText(body.phone);
  const role = cleanText(body.role, "尚未選擇");
  const page = cleanText(body.page, "Gather Taiwan");
  const message = cleanText(body.message);

  if (!email || !isValidEmail(email)) {
    return json({ error: "請留下有效的 Email，方便我們回覆。" }, { status: 400 });
  }
  if (!message) {
    return json({ error: "請簡單告訴我們你想一起做什麼。" }, { status: 400 });
  }

  const submittedAt = new Date();
  const subject = `Gather Taiwan｜${role}｜${name}`;
  const params = {
    name,
    email,
    phone,
    role,
    page,
    title: subject,
    subject,
    topic: role,
    from_name: name,
    from_email: email,
    from_phone: phone,
    reply_to: email,
    message,
    source: "Gather Taiwan public website",
    website_url: "https://gather.wedopr.com/",
    submitted_at: submittedAt.toISOString(),
    submitted_at_taipei: submittedAt.toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      hour12: false,
    }),
  };

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://gather.wedopr.com",
    },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: params,
    }),
  });

  if (!response.ok) {
    return json({ error: "訊息暫時送不出去，請稍後再試。" }, { status: 502 });
  }

  return json({ ok: true });
}
