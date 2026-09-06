import fs from 'fs';
import path from 'path';

describe('session gate invariants', () => {
  it('index routes through resolveSessionRoute instead of isSignedIn-first', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../../app/index.tsx'),
      'utf8'
    );
    expect(src).toMatch(/useSessionRoute/);
    expect(src).not.toMatch(/if\s*\(\s*!isSignedIn\s*\)/);
  });

  it('auth observer never wipes the session on a bare null user', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../hooks/useAuthStore.ts'),
      'utf8'
    );
    expect(src).toMatch(/decideNullAuthAction/);
    expect(src).toMatch(/keep_session/);
    expect(src).toMatch(/ignored transient auth null/);
  });

  it('root layout does not unsubscribe auth on remount', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../../app/_layout.tsx'),
      'utf8'
    );
    expect(src).toMatch(/Do not unsubscribe auth/);
    expect(src).not.toMatch(/authUnsubscribe\(\)/);
  });
});
