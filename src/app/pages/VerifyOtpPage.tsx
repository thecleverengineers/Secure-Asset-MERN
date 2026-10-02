import LoginPage from './LoginPage';

/** The public verification route keeps the same OTP form and shared shell. */
export default function VerifyOtpPage() {
  return <LoginPage pageMode="otp" />;
}
