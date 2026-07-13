const {
  getEligibleSharedAnalysisMessages,
  isExactAnalysisSourceSetComplete,
} = require('./chatAnalysisSelection');

function buildMessage(overrides = {}) {
  return {
    id: 'message-1',
    room_id: 'room-1',
    channel_id: 'shared-channel',
    sender_participant_id: 'participant-a',
    content: 'Shared source',
    message_type: 'user_text',
    visibility_scope: 'all',
    safety_flag: false,
    created_at: '2026-07-12T00:00:00.000Z',
    sender_participant: {
      participant_type: 'user',
      role_in_room: 'roleA',
    },
    ...overrides,
  };
}

function buildRequest() {
  return {
    selection_snapshot: {
      message_refs: [{
        kind: 'chat_message',
        id: 'message-1',
        content_hash: 'a'.repeat(64),
      }],
      capsule_refs: [{
        kind: 'context_capsule',
        id: 'capsule-1',
        version: 2,
        content_hash: 'b'.repeat(64),
      }],
    },
    source_previews: {
      messages: [{
        kind: 'chat_message',
        id: 'message-1',
        content_hash: 'a'.repeat(64),
      }],
      capsules: [{
        kind: 'context_capsule',
        id: 'capsule-1',
        version: 2,
        content_hash: 'b'.repeat(64),
      }],
    },
  };
}

describe('chat analysis selection guards', () => {
  it('only admits safe human user text from the exact shared channel', () => {
    const eligible = getEligibleSharedAnalysisMessages([
      buildMessage(),
      buildMessage({ id: 'private', channel_id: 'private-channel' }),
      buildMessage({ id: 'safety', safety_flag: true }),
      buildMessage({ id: 'ai', sender_participant: { participant_type: 'ai', role_in_room: 'aiMediator' } }),
      buildMessage({ id: 'reflection', message_type: 'ai_reflection' }),
    ], 'shared-channel');

    expect(eligible.map((message) => message.id)).toEqual(['message-1']);
  });

  it('requires an exact unique id/hash/version match between snapshot and previews', () => {
    expect(isExactAnalysisSourceSetComplete(buildRequest())).toBe(true);

    const wrongHash = buildRequest();
    wrongHash.source_previews.messages[0].content_hash = 'c'.repeat(64);
    expect(isExactAnalysisSourceSetComplete(wrongHash)).toBe(false);

    const wrongVersion = buildRequest();
    wrongVersion.source_previews.capsules[0].version = 3;
    expect(isExactAnalysisSourceSetComplete(wrongVersion)).toBe(false);

    const duplicate = buildRequest();
    duplicate.selection_snapshot.message_refs.push({
      ...duplicate.selection_snapshot.message_refs[0],
    });
    duplicate.source_previews.messages.push({
      ...duplicate.source_previews.messages[0],
    });
    expect(isExactAnalysisSourceSetComplete(duplicate)).toBe(false);
  });
});
