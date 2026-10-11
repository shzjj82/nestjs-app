import { normalizeSubscribeTemplates } from './subscribe-templates';

/**
 * 只测纯函数，不引入 Nest / TypeORM：
 * 这段逻辑是订阅消息配置正确性的唯一防线，应当能在无容器、无数据库的情况下验证。
 */
describe('normalizeSubscribeTemplates', () => {
  it('未传值（undefined / null）归一成空配置', () => {
    expect(normalizeSubscribeTemplates(undefined)).toEqual({});
    expect(normalizeSubscribeTemplates(null)).toEqual({});
  });

  it('保留合法的场景与字段映射', () => {
    expect(
      normalizeSubscribeTemplates({
        PRICE_OFFERED: {
          templateId: 'TPL-1',
          fields: { thing1: 'orderCode', amount2: 'amount' },
        },
      }),
    ).toEqual({
      PRICE_OFFERED: {
        templateId: 'TPL-1',
        fields: { thing1: 'orderCode', amount2: 'amount' },
      },
    });
  });

  it('不做深合并：传进来是什么就是什么（由调用方决定整份替换）', () => {
    expect(
      normalizeSubscribeTemplates({ PAID: { templateId: 'NEW' } }),
    ).toEqual({ PAID: { templateId: 'NEW' } });
  });

  it('空对象等于清空配置', () => {
    expect(normalizeSubscribeTemplates({})).toEqual({});
  });

  it('fields 为空对象时视为没配字段', () => {
    expect(
      normalizeSubscribeTemplates({ PAID: { templateId: 'T', fields: {} } }),
    ).toEqual({ PAID: { templateId: 'T' } });
  });

  it('templateId 两端空白会被裁掉', () => {
    expect(
      normalizeSubscribeTemplates({ PAID: { templateId: '  T  ' } }),
    ).toEqual({ PAID: { templateId: 'T' } });
  });

  it('scene 名允许点、下划线、连字符', () => {
    expect(
      normalizeSubscribeTemplates({ 'order.paid_v2-x': { templateId: 'T' } }),
    ).toEqual({ 'order.paid_v2-x': { templateId: 'T' } });
  });

  describe('非法输入一律 400 且不静默放过', () => {
    const cases: { name: string; value: unknown; hint: string }[] = [
      { name: '不是对象', value: 'nope', hint: 'subscribeTemplates 需为' },
      { name: '是数组', value: [], hint: 'subscribeTemplates 需为' },
      {
        name: '场景名以非法字符开头',
        value: { '-BAD': { templateId: 'T' } },
        hint: '场景名 -BAD 非法',
      },
      {
        name: '场景名含空格',
        value: { 'BAD SCENE': { templateId: 'T' } },
        hint: '非法',
      },
      {
        name: '场景名超长',
        value: { ['A'.repeat(65)]: { templateId: 'T' } },
        hint: '非法',
      },
      {
        name: '场景配置不是对象',
        value: { PAID: 'T' },
        hint: '需为 { templateId, fields? }',
      },
      { name: '缺 templateId', value: { PAID: {} }, hint: '缺 templateId' },
      {
        name: 'templateId 是空串',
        value: { PAID: { templateId: '  ' } },
        hint: '缺 templateId',
      },
      {
        name: 'templateId 过长',
        value: { PAID: { templateId: 'x'.repeat(129) } },
        hint: 'templateId 过长',
      },
      {
        name: 'fields 不是对象',
        value: { PAID: { templateId: 'T', fields: [] } },
        hint: 'fields 需为',
      },
      {
        name: '模板字段名大写开头',
        value: { PAID: { templateId: 'T', fields: { Thing1: 'orderCode' } } },
        hint: '模板字段名 Thing1 非法',
      },
      {
        name: '映射到未知语义（拼错语义名）',
        value: { PAID: { templateId: 'T', fields: { thing1: 'orderNo' } } },
        hint: '未知语义 orderNo',
      },
      {
        name: '语义值为空',
        value: { PAID: { templateId: 'T', fields: { thing1: '' } } },
        hint: '未知语义',
      },
    ];

    it.each(cases)('$name → 400', ({ value, hint }) => {
      let thrown: { getError?: () => unknown } | undefined;
      try {
        normalizeSubscribeTemplates(value);
      } catch (err) {
        thrown = err as { getError?: () => unknown };
      }
      expect(thrown).toBeDefined();
      expect(thrown?.getError?.()).toMatchObject({
        status: 400,
        message: expect.stringContaining(hint),
      });
    });
  });
});
