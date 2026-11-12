import {
  applyStatusTransition,
  normalizeTodoStatus,
  parseStatusFilter,
  reopenTargetStatus,
  resolvePatchStatus,
} from './todo-status';

describe('todo-status', () => {
  it('normalizes legacy open to pending', () => {
    expect(normalizeTodoStatus('open')).toBe('pending');
    expect(normalizeTodoStatus('pending')).toBe('pending');
  });

  it('parses comma and array status filters; open means all active', () => {
    expect(parseStatusFilter('pending,in_progress')).toEqual(['pending', 'in_progress']);
    expect(parseStatusFilter(['pending', 'in_progress'])).toEqual(['pending', 'in_progress']);
    expect(parseStatusFilter(['pending,in_progress', 'done'])).toEqual([
      'pending',
      'in_progress',
      'done',
    ]);
    expect(parseStatusFilter('open')).toEqual(['pending', 'in_progress']);
    expect(parseStatusFilter('open,done')).toEqual(['pending', 'in_progress', 'done']);
  });

  it('allows pending → in_progress and active → done/cancelled', () => {
    expect(applyStatusTransition({ current: 'pending', next: 'in_progress', startsAt: null }).status).toBe(
      'in_progress',
    );
    expect(applyStatusTransition({ current: 'open', next: 'done', startsAt: null }).status).toBe('done');
    expect(applyStatusTransition({ current: 'in_progress', next: 'cancelled', startsAt: null }).status).toBe(
      'cancelled',
    );
  });

  it('rejects illegal jumps', () => {
    expect(() =>
      applyStatusTransition({ current: 'done', next: 'cancelled', startsAt: null }),
    ).toThrow(/活跃待办/);
    expect(() =>
      applyStatusTransition({ current: 'pending', next: 'pending', startsAt: null }),
    ).not.toThrow();
  });

  it('reopens by startsAt vs Shanghai today', () => {
    const now = new Date('2026-11-11T02:00:00.000Z'); // 上海 10:00
    expect(reopenTargetStatus('2026-11-12', now)).toBe('pending');
    expect(reopenTargetStatus('2026-11-11', now)).toBe('in_progress');
    expect(
      applyStatusTransition({
        current: 'done',
        next: reopenTargetStatus('2026-11-10', now),
        startsAt: '2026-11-10',
        now,
      }).status,
    ).toBe('in_progress');
  });

  it('allows in_progress → pending', () => {
    expect(
      applyStatusTransition({ current: 'in_progress', next: 'pending', startsAt: null }).status,
    ).toBe('pending');
  });

  it('resolves PATCH open via data.localStatus', () => {
    expect(resolvePatchStatus('open', { localStatus: 'in_progress' })).toBe('in_progress');
    expect(resolvePatchStatus('open', {})).toBeUndefined();
    expect(resolvePatchStatus('done', null)).toBe('done');
  });
});
