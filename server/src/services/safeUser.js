/**
 * The profile embedded in the initial HTML and returned by authentication
 * endpoints is deliberately a projection.  Keep this in one place so a new
 * secret field cannot accidentally leak through one of the session paths.
 */
export function safeUser(user) {
  const value = user?.toJSON ? user.toJSON() : { ...(user || {}) };
  value.twoFactorEnabled = Boolean(value.twoFactor?.enabled ?? value.twoFactorEnabled);
  delete value.refreshTokens;
  delete value.password;
  delete value.emailNormalized;
  delete value.phoneNormalized;
  delete value.otpHash;
  delete value.otpExpiresAt;
  delete value.otpPurpose;
  delete value.otpAttempts;
  delete value.otpLastSentAt;
  delete value.passwordResetTokenHash;
  if (value.twoFactor) {
    delete value.twoFactor.secretEncrypted;
    delete value.twoFactor.pendingSecretEncrypted;
    delete value.twoFactor.backupCodeHashes;
  }
  if (value.deviceUnlock) {
    value.deviceUnlockEnabled = Boolean(value.deviceUnlock.enabled);
    delete value.deviceUnlock;
  }
  if (value.vaultPin) {
    value.vaultPinEnabled = Boolean(value.vaultPin.enabled);
    delete value.vaultPin;
  }
  delete value.vaultPin;
  delete value.pendingContactChange;
  return value;
}
