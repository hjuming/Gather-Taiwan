const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";
const MAX_TEXT_LENGTH = 1800;

export function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });
}

export function getEmailJsConfig(env) {
  return {
    serviceId: env.EMAILJS_SERVICE_ID || env.VITE_EMAILJS_SERVICE_ID,
    templateId: env.EMAILJS_TEMPLATE_ID || env.VITE_EMAILJS_TEMPLATE_ID,
    publicKey: env.EMAILJS_PUBLIC_KEY || env.VITE_EMAILJS_PUBLIC_KEY,
    privateKey: env.EMAILJS_PRIVATE_KEY || env.EMAILJS_ACCESS_TOKEN || env.VITE_EMAILJS_PRIVATE_KEY,
    ccEmail: env.GATHER_CONTACT_CC_EMAIL || "gather@wedopr.com",
  };
}

export function cleanText(value, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT_LENGTH) || fallback : fallback;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function buildGatherTaiwanContactEmail(body) {
  const name = cleanText(body.name, "聚場台灣網站訪客");
  const email = cleanText(body.email);
  const phone = cleanText(body.phone);
  const role = cleanText(body.role, "尚未選擇");
  const page = cleanText(body.page, "Gather Taiwan");
  const message = cleanText(body.message);

  if (!email || !isValidEmail(email)) {
    return { error: "請留下有效的 Email，方便我們回覆。", status: 400 };
  }

  if (!message) {
    return { error: "請簡單告訴我們你想一起做什麼。", status: 400 };
  }

  const submittedAt = new Date();
  const subject = `Gather Taiwan｜${role}｜${name}`;

  return {
    params: {
      name,
      email,
      phone,
      role,
      page,
      title: subject,
      subject,
      topic: role,
      to_name: name,
      to_email: email,
      from_name: name,
      from_email: email,
      from_phone: phone,
      reply_to: email,
      auto_reply_subject: "我們收到你的聚場合作訊息了｜Gather Taiwan",
      brand_email: "gather@wedopr.com",
      message,
      source: "Gather Taiwan public website",
      website_url: "https://gather.wedopr.com/",
      submitted_at: submittedAt.toISOString(),
      submitted_at_taipei: submittedAt.toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        hour12: false,
      }),
    },
  };
}

export async function sendEmailJs({ config, params }) {
  const payload = {
    service_id: config.serviceId,
    template_id: config.templateId,
    user_id: config.publicKey,
    template_params: {
      ...params,
      cc_email: config.ccEmail,
    },
  };

  if (config.privateKey) {
    payload.accessToken = config.privateKey;
  }

  return fetch(EMAILJS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://gather.wedopr.com",
    },
    body: JSON.stringify(payload),
  });
}
