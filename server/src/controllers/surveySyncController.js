import { Survey } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

export const syncSurveys = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) throw new ApiError(422, 'No offline surveys supplied');
  const results = [];
  for (const item of items.slice(0, 100)) {
    if (!item.offlineId) { results.push({ offlineId: null, success: false, message: 'offlineId required' }); continue; }
    try {
      const survey = await Survey.findOneAndUpdate(
        { offlineId: item.offlineId, surveyor: req.user._id },
        { $set: { ...item, surveyor: req.user._id, syncStatus: 'synced', updatedBy: req.user._id }, $setOnInsert: { createdBy: req.user._id } },
        { new: true, upsert: true, runValidators: true },
      );
      results.push({ offlineId: item.offlineId, success: true, id: survey._id });
    } catch (error) { results.push({ offlineId: item.offlineId, success: false, message: error.message }); }
  }
  res.json({ success: true, data: results });
});
