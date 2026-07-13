import { ChatActorAccessService } from '../../../src/services/chat-actor-access.service';

type SqlToken = {
  strings: TemplateStringsArray;
  values: unknown[];
};

describe('ChatActorAccessService entitlement locks', () => {
  it.each([
    ['actor', (service: ChatActorAccessService, db: never) => (
      service.lockActiveParticipant(db, 'room-1', 'participant-a')
    ), ['participant-a', 'room-1']],
    ['roleB', (service: ChatActorAccessService, db: never) => (
      service.lockActiveRoleB(db, 'room-1')
    ), ['room-1']],
  ] as const)('%s lock is a parameterized active-user FOR UPDATE invariant', async (
    _label,
    invoke,
    expectedValues,
  ) => {
    const queryRaw = jest.fn().mockResolvedValue([{ id: 'locked' }]);
    const db = { $queryRaw: queryRaw };

    await invoke(new ChatActorAccessService(), db as never);

    const token = queryRaw.mock.calls[0][0] as SqlToken;
    const sql = token.strings.join('?').replace(/\s+/g, ' ');
    expect(sql).toContain('participant_type = \'user\'');
    expect(sql).toContain('is_active = true');
    expect(sql).toContain('left_at IS NULL');
    expect(sql).toContain('FOR UPDATE');
    expect(token.values).toEqual(expectedValues);
    if (_label === 'roleB') {
      expect(sql).toContain("role_in_room = 'roleB'");
    }
  });

  it.each(['actor', 'roleB'] as const)(
    '%s lock fails closed when leave/kick wins the row race',
    async kind => {
      const db = { $queryRaw: jest.fn().mockResolvedValue([]) };
      const service = new ChatActorAccessService();
      const operation = kind === 'actor'
        ? service.lockActiveParticipant(db as never, 'room-1', 'participant-a')
        : service.lockActiveRoleB(db as never, 'room-1');

      await expect(operation).rejects.toMatchObject({
        code: kind === 'actor' ? 'FORBIDDEN' : 'CASE_NOT_EDITABLE',
      });
    },
  );
});
