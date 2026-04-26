import type { FirebaseError } from 'firebase/app';
import type { StringKey } from '../i18n';

export function mapAuthErrorToStringKey(error: unknown): StringKey {
  const code = (error as FirebaseError | undefined)?.code;
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'auth_error_invalid_credentials';
    case 'auth/user-not-found':
      return 'auth_error_user_not_found';
    case 'auth/invalid-email':
      return 'auth_error_invalid_email';
    case 'auth/email-already-in-use':
      return 'auth_error_email_in_use';
    case 'auth/weak-password':
      return 'auth_error_weak_password';
    case 'auth/too-many-requests':
      return 'auth_error_too_many_requests';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'auth_error_google_cancelled';
    case 'auth/popup-blocked':
    case 'auth/network-request-failed':
      return 'auth_error_google_failed';
    default:
      return 'auth_error_generic';
  }
}
