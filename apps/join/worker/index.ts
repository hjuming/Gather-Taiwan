import { withSecurityHeaders } from "./response-security";
import { handleLineAuthCallback, handleLineAuthStart, type LineAuthEnv } from "./line-auth";

interface Env extends LineAuthEnv {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const LINE_AUTH_START_PATH = "/app/auth/line/start";
const LINE_AUTH_CALLBACK_PATH = "/app/auth/line/callback";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === LINE_AUTH_START_PATH) {
      return withSecurityHeaders(await handleLineAuthStart(request, env));
    }
    if (url.pathname === LINE_AUTH_CALLBACK_PATH) {
      return withSecurityHeaders(await handleLineAuthCallback(request, env));
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetResponse);
  },
};
