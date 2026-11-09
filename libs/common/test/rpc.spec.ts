import { RpcException } from '@nestjs/microservices';
import { z } from 'zod';
import {
  asRecord,
  optionalString,
  parseWith,
  requiredString,
  toPage,
} from '../src/rpc';

describe('rpc zod helpers', () => {
  it('requiredString trims and rejects blanks', () => {
    expect(requiredString('  hi  ', 'name')).toBe('hi');
    expect(() => requiredString('  ', 'name')).toThrow(RpcException);
    expect(() => requiredString(1, 'name')).toThrow(/name 必填/);
  });

  it('optionalString only keeps non-empty strings', () => {
    expect(optionalString(' a ')).toBe('a');
    expect(optionalString('')).toBeUndefined();
    expect(optionalString(null)).toBeUndefined();
  });

  it('asRecord tolerates non-objects', () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(asRecord(null)).toEqual({});
    expect(asRecord([])).toEqual({});
  });

  it('toPage clamps page size', () => {
    expect(toPage('2', '1000')).toEqual({ page: 2, pageSize: 100, skip: 100 });
    expect(toPage(undefined, undefined)).toEqual({ page: 1, pageSize: 20, skip: 0 });
  });

  it('parseWith maps zod errors to RpcException', () => {
    const schema = z.object({
      id: z.string().uuid('id 无效'),
    });
    expect(parseWith(schema, { id: '550e8400-e29b-41d4-a716-446655440000' })).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(() => parseWith(schema, { id: 'bad' })).toThrow(/id 无效/);
    expect(() => parseWith(schema, { id: 'bad' }, '自定义')).toThrow(/自定义/);
  });
});
