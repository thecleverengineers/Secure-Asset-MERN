# Fast2SMS upsert and active-index hotfix v10

This release fixes two production issues:

1. Fast2SMS settings no longer write `key` through both `$set` and `$setOnInsert` in the same MongoDB upsert. The provider identifier is supplied only by the equality filter, while a replacement authorization key is encrypted and written only to `secureConfig.authorizationEncrypted`.
2. aaPanel's root browser location is reconciled to the active Node release. This prevents `/login` from serving an old static `index.html` while `/assets/` is already serving the new build.

Blank authorization input preserves the current encrypted key. Supplying a new complete key rotates it atomically. Masked values are rejected.
