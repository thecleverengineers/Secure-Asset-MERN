# Mongoose authentication and aaPanel routing hotfix v4

This release fixes the production migration failure caused by global Mongoose
`sanitizeFilter` rewriting trusted application selectors such as `$gt`, `$in`
and `$or`. Those selectors are required by subscription expiry checks and by
email/mobile login lookup.

Security is retained at the HTTP boundary: request bodies and query objects are
rejected when they contain MongoDB operator keys, dotted keys, prototype keys,
null bytes, or excessive nesting.

The aaPanel managed include now proxies `/api/`, `/assets/`, `/index.html`,
Socket.IO, site assets and legacy uploads to the current Node process. Deployment
verifies the live login/register JSON routes and compares every public JS/CSS
asset byte-for-byte with the current `dist` build before reporting success.
