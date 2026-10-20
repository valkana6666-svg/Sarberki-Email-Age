// Disabled: Supabase shared-domain HTML is served as plain text.
// A password reset must require verifiable project-owner authorization.
Deno.serve(() => new Response('Reader reset endpoint closed. No password changed.', { status: 410, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } }));
