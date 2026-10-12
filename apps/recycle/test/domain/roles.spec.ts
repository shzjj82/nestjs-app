import {
  RECYCLE_IDENTITY,
  recycleMemberIdentities,
} from '../../src/domain/roles';

describe('recycleMemberIdentities', () => {
  it('defaults to customer when no recycle roles', () => {
    expect(recycleMemberIdentities([])).toEqual([RECYCLE_IDENTITY.CUSTOMER]);
    expect(recycleMemberIdentities(['platform-admin'])).toEqual([
      RECYCLE_IDENTITY.CUSTOMER,
    ]);
  });

  it('collapses agent/inspector/approver/finance to staff', () => {
    expect(recycleMemberIdentities(['agent', 'inspector', 'finance'])).toEqual([
      RECYCLE_IDENTITY.STAFF,
    ]);
    expect(recycleMemberIdentities(['approver'])).toEqual([
      RECYCLE_IDENTITY.STAFF,
    ]);
  });

  it('keeps customer + staff when both assigned', () => {
    expect(recycleMemberIdentities(['customer', 'inspector'])).toEqual([
      RECYCLE_IDENTITY.CUSTOMER,
      RECYCLE_IDENTITY.STAFF,
    ]);
  });

  it('includes admin separately', () => {
    expect(recycleMemberIdentities(['admin', 'agent'])).toEqual([
      RECYCLE_IDENTITY.STAFF,
      RECYCLE_IDENTITY.ADMIN,
    ]);
  });
});
