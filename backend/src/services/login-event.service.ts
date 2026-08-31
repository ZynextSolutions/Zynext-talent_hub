import { loginEventRepository } from '../repositories/login-event.repository';

class LoginEventService {
  recordLogin(input: {
    organizationId: string;
    userId: string;
    method: 'password' | 'mfa' | 'sso';
    ip?: string | null;
    userAgent?: string | null;
  }) {
    void loginEventRepository
      .record(input)
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn(JSON.stringify({ level: 'warn', msg: 'login_event_failed', error: String(err) }));
      });
  }
}

export const loginEventService = new LoginEventService();
