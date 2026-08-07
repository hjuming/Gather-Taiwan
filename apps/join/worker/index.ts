import { withSecurityHeaders } from "./response-security";
import { handleLineAuthCallback, handleLineAuthStart, type LineAuthEnv } from "./line-auth";

interface Env extends LineAuthEnv {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const LINE_AUTH_START_PATH = "/app/auth/line/start";
const LINE_AUTH_CALLBACK_PATH = "/app/auth/line/callback";
// The Workers Route matches the full "/app/*" path, but the Vite build
// output (dist/client) is flat — index.html and assets/ sit at its root,
// not under an "app/" subdirectory. The ASSETS binding matches requests
// against files in that directory literally, so the "/app" prefix has to
// be stripped before handing the request off, or every asset request
// (JS/CSS) 404s into the SPA fallback and comes back as text/html.
const ASSET_PATH_PREFIX = "/app";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === LINE_AUTH_START_PATH) {
      return withSecurityHeaders(await handleLineAuthStart(request, env));
    }
    if (url.pathname === LINE_AUTH_CALLBACK_PATH) {
      return withSecurityHeaders(await handleLineAuthCallback(request, env));
    }

    const assetUrl = new URL(request.url);
    if (assetUrl.pathname.startsWith(ASSET_PATH_PREFIX)) {
      assetUrl.pathname = assetUrl.pathname.slice(ASSET_PATH_PREFIX.length) || "/";
    }
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
    return withSecurityHeaders(assetResponse);
  },
};
