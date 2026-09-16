import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { SiteSetting } from '../server/src/models/index.js';

export const OPEN_SANS_FONT_NAME = 'Open Sans';

export function applyOpenSansToSiteSetting(setting) {
  let changed = false;
  let brandChanged = false;
  let designChanged = false;
  setting.brand ||= {};
  if (setting.brand.fontFamily !== OPEN_SANS_FONT_NAME) {
    setting.brand.fontFamily = OPEN_SANS_FONT_NAME;
    changed = true;
    brandChanged = true;
  }

  setting.design ||= {};
  setting.design.typography ||= {};
  if (setting.design.typography.fontFamily !== OPEN_SANS_FONT_NAME) {
    setting.design.typography.fontFamily = OPEN_SANS_FONT_NAME;
    changed = true;
    designChanged = true;
  }
  setting.design.branding ||= {};
  if (setting.design.branding.fontFamily !== OPEN_SANS_FONT_NAME) {
    setting.design.branding.fontFamily = OPEN_SANS_FONT_NAME;
    changed = true;
    designChanged = true;
  }

  const layers = Array.isArray(setting.design.canvas?.layers) ? setting.design.canvas.layers : [];
  for (const layer of layers) {
    layer.style ||= {};
    if (layer.style.fontFamily !== OPEN_SANS_FONT_NAME) {
      layer.style.fontFamily = OPEN_SANS_FONT_NAME;
      changed = true;
      designChanged = true;
    }
  }
  if (brandChanged) setting.markModified('brand');
  if (designChanged) setting.markModified('design');
  return changed;
}

export async function migrateOpenSansGlobal({ logger = console } = {}) {
  const settings = await SiteSetting.find({});
  let updated = 0;
  for (const setting of settings) {
    if (!applyOpenSansToSiteSetting(setting)) continue;
    await setting.save({ validateModifiedOnly: true });
    updated += 1;
  }
  logger.log(`Open Sans is now enforced for ${updated} site setting record(s).`);
  return { updated };
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  await connectDatabase();
  try {
    await migrateOpenSansGlobal();
  } finally {
    await disconnectDatabase();
  }
}
