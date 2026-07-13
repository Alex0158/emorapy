import type {
  ChatAnalysisRequestListItem,
  ChatMessage,
} from "@emorapy/contracts/chat";

export function getEligibleSharedAnalysisMessages(
  messages: ChatMessage[],
  sharedChannelId: string | null,
): ChatMessage[] {
  if (!sharedChannelId) return [];
  return messages.filter(
    (message) =>
      message.channel_id === sharedChannelId &&
      message.message_type === "user_text" &&
      message.visibility_scope === "all" &&
      message.safety_flag === false &&
      message.sender_participant?.participant_type === "user" &&
      ["roleA", "roleB"].includes(message.sender_participant.role_in_room),
  );
}

function hasUniqueKeys(keys: string[]): boolean {
  return new Set(keys).size === keys.length;
}

export function isExactAnalysisSourceSetComplete(
  request: ChatAnalysisRequestListItem,
): boolean {
  const { message_refs: messageRefs, capsule_refs: capsuleRefs } =
    request.selection_snapshot;
  const { messages: messagePreviews, capsules: capsulePreviews } =
    request.source_previews;
  const expectedKeys = [
    ...messageRefs.map((ref) => `chat_message:${ref.id}`),
    ...capsuleRefs.map(
      (ref) => `context_capsule:${ref.id}:${ref.version ?? ""}`,
    ),
  ];
  const previewKeys = [
    ...messagePreviews.map((preview) => `chat_message:${preview.id}`),
    ...capsulePreviews.map(
      (preview) => `context_capsule:${preview.id}:${preview.version}`,
    ),
  ];
  if (
    expectedKeys.length === 0 ||
    expectedKeys.length !== previewKeys.length ||
    !hasUniqueKeys(expectedKeys) ||
    !hasUniqueKeys(previewKeys)
  ) {
    return false;
  }

  const messagePreviewById = new Map(
    messagePreviews.map((preview) => [preview.id, preview]),
  );
  const capsulePreviewById = new Map(
    capsulePreviews.map((preview) => [preview.id, preview]),
  );
  return (
    messageRefs.every((ref) => {
      const preview = messagePreviewById.get(ref.id);
      return Boolean(
        preview &&
          preview.kind === "chat_message" &&
          ref.kind === "chat_message" &&
          ref.content_hash &&
          preview.content_hash === ref.content_hash,
      );
    }) &&
    capsuleRefs.every((ref) => {
      const preview = capsulePreviewById.get(ref.id);
      return Boolean(
        preview &&
          preview.kind === "context_capsule" &&
          ref.kind === "context_capsule" &&
          ref.content_hash &&
          preview.content_hash === ref.content_hash &&
          preview.version === ref.version,
      );
    })
  );
}
