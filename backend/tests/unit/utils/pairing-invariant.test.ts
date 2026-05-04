import {
  buildActiveNormalPairingWhere,
  buildSessionBoundQuickPairingWhere,
} from '../../../src/utils/pairing-invariant';

describe('pairing-invariant', () => {
  it('active normal pairing where 應只覆蓋正式 pending/active pairing', () => {
    expect(buildActiveNormalPairingWhere('u1')).toEqual({
      pairing_type: 'normal',
      status: { in: ['pending', 'active'] },
      OR: [
        { user1_id: 'u1' },
        { user2_id: 'u1' },
      ],
    });
  });

  it('active normal pairing where 可排除指定 pairing', () => {
    expect(buildActiveNormalPairingWhere('u1', 'pair-1')).toEqual({
      pairing_type: 'normal',
      status: { in: ['pending', 'active'] },
      OR: [
        { user1_id: 'u1' },
        { user2_id: 'u1' },
      ],
      id: { not: 'pair-1' },
    });
  });

  it('session-bound quick pairing where 應限制 quick temp pairing', () => {
    expect(buildSessionBoundQuickPairingWhere('s1')).toEqual({
      session_id: 's1',
      pairing_type: 'quick',
      status: 'temp',
    });
  });

  it('session-bound quick pairing where 可限制指定 pairing id', () => {
    expect(buildSessionBoundQuickPairingWhere('s1', 'pair-1')).toEqual({
      session_id: 's1',
      pairing_type: 'quick',
      status: 'temp',
      id: 'pair-1',
    });
  });
});
