# SecureAsset Application Design Studio

Administrators can open **Design Studio** directly from the admin sidebar at `/app/design-studio`, or use the legacy **Site, Design & Homepage** tab. The editor stores a safe, MongoDB-backed visual system in `SiteSetting.design`; no raw CSS is accepted.

The independent studio provides an **all-application page catalog**. It combines the public route set, authentication and reset-password routes, route-pattern pages such as property/surveyor details, every configured authenticated module returned by the server, and MongoDB-backed custom content pages. Each route has its own page settings and layers; creating or editing one page never overwrites another. Pages can be edited in **Live page** mode: select any visible header, footer, section, card, modal, navigation, tab, button, or data-bound component and choose its **Redesign** controls. Route patterns are matched at runtime so a design for `/marketplace/:id` also styles every property-detail URL.

Published page tokens are applied by the active public or authenticated shell on every route change. Background, surface, max width, responsive padding, card radius and button radius are scoped to the matched page, so homepage, login, dashboard, admin, module and custom-page changes remain independent while global design tokens continue to supply safe fallbacks.

Live layer controls include background and overlay colours, uploaded/local or HTTPS image assets, erase/restore and crop controls, opacity, border style/colour/width, square or rounded radius, five shadow depths, padding, margin, z-index, font family/size/weight/alignment, display and auto-layout direction, justify/align/gap, fixed/auto/fill sizing, min/max dimensions, position, overflow and object fit/position. Layers can be dragged, snapped to grid, multi-selected, duplicated, grouped, reordered, locked/hidden, and searched. Undo/redo, zoom, viewport switching, rulers/guides, preview, draft save and publish are available from the studio toolbar.

It provides presets plus individual controls for:

- Header, modal-header, primary, secondary, submit, edit, danger, icon, surface, text and border colours.
- Font family, base size, heading weight, line height and content density.
- Header height, sidebar width, collapsed sidebar width, page padding and content width.
- Card, input, button, navigation/menu and modal radii, along with border width and style.
- Card, navigation, modal and button shadows; icon sizes; button height; hover lift and glass navigation.

The default preset preserves the requested production visual language: `#0B5270` headers and modal headers, square headers and modals, orange edit actions, olive-green submit actions, green acceptance actions, and red cancel/reject actions.

Existing MongoDB installations are upgraded automatically at startup by `ensurePlatformConfiguration()`. The migration adds the default `design` object only when it is missing, so custom site settings are preserved.

For the supported production runtime, install and deploy with Node `24.18.0`, npm `11.16.0`, and MongoDB `8.0.26`:

```bash
npm ci
bash deploy.sh
```

The source package deliberately does not contain `node_modules`, generated frontend releases, or environment files.
