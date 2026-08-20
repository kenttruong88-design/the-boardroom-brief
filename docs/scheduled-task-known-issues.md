# Scheduled Task Known Issues Log

Running log of issues discovered while executing the daily content scheduled tasks
(`out-of-office-weekly-batch`, `daily-work-culture-post`, and any future ones that
share the scratch-clone / Pexels+Cloudinary image pipeline).

**Process:** Before starting a run, read this file for known issues and workarounds.
After a run, if you hit something new (a failure, a workaround, a sandbox quirk),
append a dated entry below and commit it alongside that day's articles.

---

## 2026-08-20 — Cloudinary SDK silently fails behind sandbox proxy (RESOLVED, script patched)

**Symptom:** Every image upload fell through to the `pillar-default` fallback. The
script printed `[hero] pexels failed: ... MaxRetryError ... Failed to resolve
'api.cloudinary.com' ...`. Misleading label — Pexels itself was fine (verified with
a direct `requests.get` call, HTTP 200); it was the *Cloudinary* upload inside the
same `try` block that failed, and the exception message got attributed to the
wrong step.

**Root cause:** This sandbox routes all outbound traffic through an authenticated
HTTP proxy (`https_proxy`/`HTTPS_PROXY` env vars, with credentials embedded in the
URL). `requests` picks this up automatically and adds the `Proxy-Authorization`
header itself (`requests.adapters.HTTPAdapter.proxy_headers()` parses user:pass out
of the proxy URL). The `cloudinary` Python SDK does not use `requests` — it builds
its own `urllib3` `PoolManager`/`TCPKeepAliveProxyManager` at **module import time**
(see `cloudinary/uploader.py`: `_http = utils.get_http_connector(cloudinary.config(), ...)`
runs as soon as `import cloudinary.uploader` executes). Because the config call in
our script happens *after* that import, and even when reordered the SDK's
`ProxyManager` still doesn't attach `Proxy-Authorization` from the URL's
credentials the way `requests` does, every Cloudinary SDK upload attempt hits a
raw DNS resolution failure (no proxy) or a `407 Proxy Authentication Required`
(proxy set but unauthenticated).

**Fix applied:** Replaced the SDK-based `upload_to_cloudinary()` with a direct
signed upload via `requests.post()` to `https://api.cloudinary.com/v1_1/{cloud}/image/upload`,
computing the signature manually (sha1 of sorted `folder`/`public_id`/`timestamp`
params + `api_secret`, per Cloudinary's documented signing algorithm). This bypasses
the SDK's broken HTTP client entirely and reuses the exact same proxy-aware
`requests` path that already works for the Pexels calls. Verified end-to-end:
10/10 images in the 2026-08-20 Out of Office batch uploaded via Pexels (0 fell back
to pillar-default).

**Status:** The generator script embedded in both `out-of-office-weekly-batch` and
`daily-work-culture-post` SKILL.md files has been patched to use this direct-upload
approach. If a future run still sees Cloudinary failures, the proxy environment
itself may have changed — re-verify with:
```bash
python3 -c "import os,requests; print(requests.get('https://api.pexels.com/v1/search?query=test&per_page=1', headers={'Authorization': os.environ.get('PEXELS_API_KEY','')}).status_code)"
```
If that returns 200 but Cloudinary uploads still fail, the direct signed-upload
function is the one to debug first — not the SDK.

---
