import {
  buildGatherTaiwanContactEmail,
  getEmailJsConfig,
  json,
  sendEmailJs,
} from "../_shared/gather-email.js";

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export async function onRequestPost({ request, env }) {
  const config = getEmailJsConfig(env);
  if (!config.serviceId || !config.templateId || !config.publicKey) {
    return json({ error: "信件系統正在設定中，請稍後再試。" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const emailPayload = buildGatherTaiwanContactEmail(body);

  if (emailPayload.error) {
    return json({ error: emailPayload.error }, { status: emailPayload.status });
  }

  const response = await sendEmailJs({ config, params: emailPayload.params });

  if (!response.ok) {
    return json({ error: "訊息暫時送不出去，請稍後再試。" }, { status: 502 });
  }

  return json({ ok: true });
}
