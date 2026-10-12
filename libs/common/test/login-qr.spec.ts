import {
  isLoginQrScene,
  loginQrMqttTopic,
  newLoginQrScene,
} from '../src/login-qr';

describe('login-qr', () => {
  it('builds login scenes that are not bind hex', () => {
    const scene = newLoginQrScene();
    expect(isLoginQrScene(scene)).toBe(true);
    expect(scene.startsWith('l')).toBe(true);
    expect(scene).toHaveLength(25);
    expect(isLoginQrScene(scene.slice(1))).toBe(false);
  });

  it('maps ticket to mqtt topic', () => {
    expect(loginQrMqttTopic('labc')).toBe('auth/login/qr/labc');
  });
});
