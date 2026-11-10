// Utilidades HTTP compartidas por las Edge Functions de la tienda.

const siteUrl = () => (Deno.env.get('SITE_URL') || 'https://www.taploop.com.mx').replace(/\/$/, '');

const allowedOrigins = () => {
  const extra = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  return new Set([siteUrl(), 'https://www.taploop.com.mx', 'https://taploop.com.mx', ...extra]);
};

export const corsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get('origin') || '';
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const allowed = allowedOrigins().has(origin) || isLocal;
  return {
    'Access-Control-Allow-Origin': allowed ? origin : siteUrl(),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
};

export const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
});

export { siteUrl };
