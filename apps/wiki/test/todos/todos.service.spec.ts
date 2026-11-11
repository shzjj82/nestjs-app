jest.mock('../../src/documents/documents.service', () => ({
  DocumentsService: class DocumentsService {},
}));
jest.mock('../../src/documents/team-access', () => ({
  TeamAccess: class TeamAccess {},
}));

import { MQTT_PATTERNS, WIKI_BIZ_CODE } from '@app/common';
import { of } from 'rxjs';
import { TodosService } from '../../src/todos/todos.service';

describe('wiki TodosService start/reopen', () => {
  const page = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    slug: 'week-report',
    title: '周报',
    appCode: 'wiki',
    kind: 'article',
  };

  function setup() {
    const send = jest.fn();
    const notify = {
      connect: jest.fn().mockResolvedValue(undefined),
      send: (...args: unknown[]) => {
        send(...args);
        return of({
          id: 'todo-1',
          status: 'in_progress',
          data: { pageId: page.id, page },
        });
      },
    };
    const service = new TodosService({} as never, {} as never, notify as never);
    return { service, send };
  }

  it('forwards start to notify TODO_START and enriches page', async () => {
    const { service, send } = setup();
    const result = await service.start({
      id: 'todo-1',
      _session: { userId: 'u1', accountId: 'a1' },
    });
    expect(send).toHaveBeenCalledWith(
      MQTT_PATTERNS.TODO_START,
      expect.objectContaining({ id: 'todo-1', _bizCode: WIKI_BIZ_CODE }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'todo-1',
        page,
      }),
    );
  });

  it('forwards reopen to notify TODO_REOPEN and enriches page', async () => {
    const { service, send } = setup();
    await service.reopen({
      id: 'todo-1',
      _session: { userId: 'u1', accountId: 'a1' },
    });
    expect(send).toHaveBeenCalledWith(
      MQTT_PATTERNS.TODO_REOPEN,
      expect.objectContaining({ id: 'todo-1', _bizCode: WIKI_BIZ_CODE }),
    );
  });
});
