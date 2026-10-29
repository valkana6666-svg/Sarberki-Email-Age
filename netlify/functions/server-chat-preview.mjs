// The direct function URL is deliberately disabled; the protected preview
// runs only through the shared edge-limited /api/server-chat-preview path.
export default () => Response.json({error:'PREVIEW_DISABLED'},{status:503,headers:{'cache-control':'no-store'}});
