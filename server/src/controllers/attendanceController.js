import { Attendance } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

function todayIndia() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()); }

export const checkIn = asyncHandler(async (req, res) => {
  const date = todayIndia();
  let record = await Attendance.findOne({ user: req.user._id, date });
  if (record?.checkInAt) throw new ApiError(409, 'You have already checked in today');
  record ||= new Attendance({ user: req.user._id, date });
  record.checkInAt = new Date(); record.checkInGps = req.body.gps; record.status = 'field'; await record.save();
  res.json({ success: true, data: record });
});

export const checkOut = asyncHandler(async (req, res) => {
  const record = await Attendance.findOne({ user: req.user._id, date: todayIndia() });
  if (!record?.checkInAt) throw new ApiError(409, 'Check in before checking out');
  if (record.checkOutAt) throw new ApiError(409, 'You have already checked out today');
  record.checkOutAt = new Date(); record.checkOutGps = req.body.gps; await record.save();
  res.json({ success: true, data: record });
});
