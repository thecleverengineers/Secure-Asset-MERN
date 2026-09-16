const KIB = 1024;

/**
 * Keep multipart parsing deliberately bounded before a request reaches an
 * upload controller. File-size validation alone is not sufficient: field
 * names, text fields, headers and part counts can otherwise consume memory
 * or parser work independently of the uploaded file bytes.
 */
export function secureMultipartLimits({
  fileSize,
  files = 1,
  fields = 12,
  fieldSize = 32 * KIB,
  fieldNameSize = 128,
  headerPairs = 100,
} = {}) {
  if (!Number.isSafeInteger(fileSize) || fileSize < 1) throw new Error('secureMultipartLimits requires a positive fileSize.');
  if (!Number.isSafeInteger(files) || files < 1) throw new Error('secureMultipartLimits requires at least one file slot.');
  if (!Number.isSafeInteger(fields) || fields < 0) throw new Error('secureMultipartLimits requires a non-negative field limit.');

  return Object.freeze({
    fileSize,
    files,
    fields,
    fieldSize,
    fieldNameSize,
    headerPairs,
    // A small allowance covers multipart framing while remaining bounded.
    parts: files + fields + 2,
  });
}
