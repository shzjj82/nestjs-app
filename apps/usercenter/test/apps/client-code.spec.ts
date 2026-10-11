import { clientCodeOf } from '../../src/rpc';

/**
 * 接入端的 code 在 HTTP 契约里叫 `clientCode`，不叫 `appCode`：
 * 网关 `buildProxyPayload` 会把请求体里的 `appCode` 一律丢弃（保留给调用方身份），
 * 所以 `appCode` 只作为非 HTTP 调用方（MQTT 直连）的兼容回落。
 */
describe('clientCodeOf', () => {
  it('以 clientCode 优先，其次回落到 appCode', () => {
    expect(clientCodeOf({ clientCode: 'a', appCode: 'b', appId: 'c' })).toBe('a');
    expect(clientCodeOf({ appCode: 'b', appId: 'c' })).toBe('b');
  });

  it('绝不回落到 appId —— 那会用调用方自己的 code 静默造出错误接入端', () => {
    expect(clientCodeOf({ appId: 'c' })).toBeUndefined();
    expect(() => clientCodeOf({ appId: 'c' }, true)).toThrow('clientCode 必填');
  });

  it('空白值视作未提供', () => {
    expect(clientCodeOf({ clientCode: '   ', appCode: 'b' })).toBe('b');
    expect(clientCodeOf({})).toBeUndefined();
  });

  it('必填缺失时报 clientCode 必填', () => {
    expect(() => clientCodeOf({}, true)).toThrow('clientCode 必填');
    expect(() => clientCodeOf({ clientCode: '  ' }, true)).toThrow('clientCode 必填');
  });

  it('错误信封带 status=400，网关据此映射成 HTTP 400', () => {
    let captured: unknown;
    try {
      clientCodeOf({}, true);
    } catch (err) {
      captured = err;
    }
    expect(captured).toBeDefined();
    expect((captured as { getError: () => unknown }).getError()).toEqual({
      status: 400,
      message: 'clientCode 必填',
    });
  });
});
