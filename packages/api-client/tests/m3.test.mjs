import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CHAT_JUDGMENT_REQUEST_TIMEOUT_MS,
  chatChannelPath,
  chatInvitePath,
  chatRoomPath,
  createM3ApiClient,
  getEligibleSharedAnalysisMessages,
  isExactAnalysisSourceSetComplete,
  normalizeListChatMessagesResponse,
} from "../dist/index.js";

function success(data) {
  return { data: { success: true, data } };
}

function fail(code, message) {
  return { data: { success: false, error: { code, message } } };
}

function createHttpMock() {
  const calls = [];
  const queue = [];
  const http = {
    calls,
    enqueue(response) {
      queue.push(response);
    },
    async get(url, config) {
      calls.push({ method: "get", url, config });
      return queue.shift();
    },
    async post(url, data, config) {
      calls.push({ method: "post", url, data, config });
      return queue.shift();
    },
    async put(url, data, config) {
      calls.push({ method: "put", url, data, config });
      return queue.shift();
    },
    async delete(url, config) {
      calls.push({ method: "delete", url, config });
      return queue.shift();
    },
  };
  return http;
}

describe("M3 Chat API client", () => {
  it("builds encoded chat room and invite paths", () => {
    assert.equal(
      chatRoomPath("room/a", "/messages"),
      "/chat/rooms/room%2Fa/messages",
    );
    assert.equal(
      chatInvitePath("CODE/01", "/accept"),
      "/chat/invites/CODE%2F01/accept",
    );
    assert.equal(
      chatChannelPath("channel/01", "/messages"),
      "/chat/channels/channel%2F01/messages",
    );
  });

  it("shares the exact safe-source eligibility contract across Web and App", () => {
    const human = {
      id: "message-1",
      channel_id: "shared-1",
      message_type: "user_text",
      visibility_scope: "all",
      safety_flag: false,
      sender_participant: { participant_type: "user", role_in_room: "roleA" },
    };
    assert.deepEqual(
      getEligibleSharedAnalysisMessages(
        [human, { ...human, id: "private-1", channel_id: "private-1" }],
        "shared-1",
      ).map((message) => message.id),
      ["message-1"],
    );

    const request = {
      selection_snapshot: {
        message_refs: [
          { kind: "chat_message", id: "message-1", content_hash: "a".repeat(64) },
        ],
        capsule_refs: [
          {
            kind: "context_capsule",
            id: "capsule-1",
            version: 2,
            content_hash: "b".repeat(64),
          },
        ],
      },
      source_previews: {
        messages: [
          { kind: "chat_message", id: "message-1", content_hash: "a".repeat(64) },
        ],
        capsules: [
          {
            kind: "context_capsule",
            id: "capsule-1",
            version: 2,
            content_hash: "b".repeat(64),
          },
        ],
      },
    };
    assert.equal(isExactAnalysisSourceSetComplete(request), true);
    request.source_previews.capsules[0].content_hash = "c".repeat(64);
    assert.equal(isExactAnalysisSourceSetComplete(request), false);
  });

  it("lists channels and uses channel-scoped message endpoints", async () => {
    const http = createHttpMock();
    const m3 = createM3ApiClient(http);
    http.enqueue(
      success({
        channels: [
          { id: "channel-shared", room_id: "room-1", kind: "shared" },
          { id: "channel-private", room_id: "room-1", kind: "private" },
        ],
      }),
    );
    http.enqueue(
      success({
        messages: [
          {
            id: "message-1",
            channel_id: "channel-private",
            content: "private",
          },
        ],
        nextCursor: null,
      }),
    );
    http.enqueue(
      success({
        message: {
          id: "message-2",
          channel_id: "channel-private",
          content: "reply",
        },
      }),
    );

    const channels = await m3.chat.listChannels("room-1");
    const messages = await m3.chat.listChannelMessages("channel-private", {
      limit: 15,
    });
    const sent = await m3.chat.sendChannelMessage("channel-private", {
      content: "reply",
      reply_to_message_id: "message-1",
    });

    assert.equal(channels.length, 2);
    assert.equal(messages.messages[0].channel_id, "channel-private");
    assert.equal(sent.id, "message-2");
    assert.deepEqual(http.calls, [
      {
        method: "get",
        url: "/chat/rooms/room-1/channels",
        config: undefined,
      },
      {
        method: "get",
        url: "/chat/channels/channel-private/messages",
        config: { params: { limit: 15 } },
      },
      {
        method: "post",
        url: "/chat/channels/channel-private/messages",
        data: { content: "reply", reply_to_message_id: "message-1" },
        config: undefined,
      },
    ]);
  });

  it("uses exact preference and capsule paths and request bodies", async () => {
    const http = createHttpMock();
    const m3 = createM3ApiClient(http);
    const capsuleInput = {
      source_channel_id: "channel-private",
      source_message_ids: ["message-1"],
      summary: "Approved summary",
      expires_at: "2026-08-01T00:00:00.000Z",
    };
    const authorizationInput = {
      capsule_content_hash: "capsule-hash-v1",
      purpose: "shared_mediation",
      audience: "room_participants",
      target_type: "chat_room",
      target_id: "room/1",
      policy_version: "chat-context-policy@v1",
    };

    http.enqueue(
      success({
        preference: { participant_id: "participant-a", mode: "private_only" },
      }),
    );
    http.enqueue(
      success({
        preference: {
          participant_id: "participant-a",
          mode: "shared_process_controls",
        },
      }),
    );
    http.enqueue(success({ capsule: { id: "capsule-1", version: 1 } }));
    http.enqueue(success({ capsule: { id: "capsule-2", version: 2 } }));
    http.enqueue(
      success({
        authorization: { id: "authorization-1", capsule_id: "capsule/1" },
      }),
    );
    http.enqueue(
      success({
        authorization: {
          id: "authorization-1",
          revoked_at: "2026-07-12T00:00:00.000Z",
        },
      }),
    );

    const preference = await m3.chat.getPrivateContextPreference("room/1");
    const updatedPreference = await m3.chat.updatePrivateContextPreference(
      "room/1",
      {
        mode: "shared_process_controls",
      },
    );
    const capsule = await m3.chat.createContextCapsule("room/1", capsuleInput);
    const revision = await m3.chat.reviseContextCapsule(
      "room/1",
      "capsule/1",
      capsuleInput,
    );
    const authorization = await m3.chat.grantContextAuthorization(
      "room/1",
      "capsule/1",
      authorizationInput,
    );
    const revoked = await m3.chat.revokeContextAuthorization(
      "room/1",
      "authorization/1",
      { reason_code: "user_revoked" },
    );

    assert.equal(preference.mode, "private_only");
    assert.equal(updatedPreference.mode, "shared_process_controls");
    assert.equal(capsule.id, "capsule-1");
    assert.equal(revision.version, 2);
    assert.equal(authorization.id, "authorization-1");
    assert.ok(revoked.revoked_at);
    assert.deepEqual(http.calls, [
      {
        method: "get",
        url: "/chat/rooms/room%2F1/context-preference",
        config: undefined,
      },
      {
        method: "put",
        url: "/chat/rooms/room%2F1/context-preference",
        data: { mode: "shared_process_controls" },
        config: undefined,
      },
      {
        method: "post",
        url: "/chat/rooms/room%2F1/context-capsules",
        data: capsuleInput,
        config: undefined,
      },
      {
        method: "post",
        url: "/chat/rooms/room%2F1/context-capsules/capsule%2F1/revisions",
        data: capsuleInput,
        config: undefined,
      },
      {
        method: "post",
        url: "/chat/rooms/room%2F1/context-capsules/capsule%2F1/authorizations",
        data: authorizationInput,
        config: undefined,
      },
      {
        method: "post",
        url: "/chat/rooms/room%2F1/context-authorizations/authorization%2F1/revoke",
        data: { reason_code: "user_revoked" },
        config: undefined,
      },
    ]);
  });

  it("lists actor-scoped capsules and analysis request read models", async () => {
    const http = createHttpMock();
    const m3 = createM3ApiClient(http);
    http.enqueue(
      success({
        capsules: [
          { id: "capsule-1", authorizations: [{ id: "authorization-1" }] },
        ],
      }),
    );
    http.enqueue(
      success({
        analysis_requests: [
          {
            id: "request-1",
            participant_approvals: [{ id: "approval-1" }],
            source_previews: {
              messages: [{ id: "message-1", content: "shared exact message" }],
              capsules: [{ id: "capsule-1", summary: "approved summary" }],
            },
          },
        ],
      }),
    );

    const capsules = await m3.chat.listContextCapsules("room/1");
    const analysisRequests = await m3.chat.listAnalysisRequests("room/1");

    assert.equal(capsules[0].authorizations[0].id, "authorization-1");
    assert.equal(
      analysisRequests[0].source_previews.capsules[0].summary,
      "approved summary",
    );
    assert.deepEqual(http.calls, [
      {
        method: "get",
        url: "/chat/rooms/room%2F1/context-capsules",
        config: undefined,
      },
      {
        method: "get",
        url: "/chat/rooms/room%2F1/analysis-requests",
        config: undefined,
      },
    ]);
  });

  it("uses exact analysis request, approval, revoke, and submit contracts", async () => {
    const http = createHttpMock();
    const m3 = createM3ApiClient(http);
    const selection = {
      selected_message_ids: ["message-1"],
      selected_capsule_ids: ["capsule-1"],
    };
    const decision = {
      selection_hash: "selection-hash-v1",
      decision: "approved",
      policy_version: "chat-analysis-policy@v1",
    };
    const revoke = {
      selection_hash: "selection-hash-v1",
      policy_version: "chat-analysis-policy@v1",
    };

    http.enqueue(
      success({
        analysis_request: { id: "request-1", status: "pending_approval" },
      }),
    );
    http.enqueue(
      success({ approval: { id: "approval-1", decision: "approved" } }),
    );
    http.enqueue(
      success({
        approval: { id: "approval-1", revoked_at: "2026-07-12T00:00:00.000Z" },
      }),
    );
    http.enqueue(
      success({ analysis_request: { id: "request-1", status: "submitted" } }),
    );

    const requestResult = await m3.chat.createAnalysisRequest(
      "room/1",
      selection,
    );
    const approval = await m3.chat.decideAnalysisRequest(
      "room/1",
      "request/1",
      decision,
    );
    const revoked = await m3.chat.revokeAnalysisApproval(
      "room/1",
      "request/1",
      revoke,
    );
    const submitted = await m3.chat.submitAnalysisRequest(
      "room/1",
      "request/1",
    );

    assert.equal(requestResult.status, "pending_approval");
    assert.equal(approval.decision, "approved");
    assert.ok(revoked.revoked_at);
    assert.equal(submitted.status, "submitted");
    assert.deepEqual(http.calls, [
      {
        method: "post",
        url: "/chat/rooms/room%2F1/analysis-requests",
        data: selection,
        config: undefined,
      },
      {
        method: "post",
        url: "/chat/rooms/room%2F1/analysis-requests/request%2F1/decision",
        data: decision,
        config: undefined,
      },
      {
        method: "post",
        url: "/chat/rooms/room%2F1/analysis-requests/request%2F1/approval/revoke",
        data: revoke,
        config: undefined,
      },
      {
        method: "post",
        url: "/chat/rooms/room%2F1/analysis-requests/request%2F1/submit",
        data: undefined,
        config: undefined,
      },
    ]);
  });

  it("creates rooms and invite handoff through chat endpoints", async () => {
    const http = createHttpMock();
    const m3 = createM3ApiClient(http);
    http.enqueue(
      success({
        room: { id: "room-1", history_visibility_mode: "share_summary_only" },
      }),
    );
    http.enqueue(
      success({
        invite: { id: "invite-1", invite_code: "ABC123", status: "pending" },
      }),
    );
    http.enqueue(success({ room: { id: "room-1", status: "group_active" } }));
    http.enqueue(success({ invite: { id: "invite-1", status: "declined" } }));

    const room = await m3.chat.createRoom();
    const invite = await m3.chat.createInvite(room.id, {
      expires_in_hours: 12,
    });
    const acceptedRoom = await m3.chat.acceptInvite("ABC123");
    const declinedInvite = await m3.chat.declineInvite("ABC123");

    assert.equal(room.id, "room-1");
    assert.equal(invite.invite_code, "ABC123");
    assert.equal(acceptedRoom.status, "group_active");
    assert.equal(declinedInvite.status, "declined");
    assert.deepEqual(
      http.calls.map((call) => [call.method, call.url]),
      [
        ["post", "/chat/rooms"],
        ["post", "/chat/rooms/room-1/invites"],
        ["post", "/chat/invites/ABC123/accept"],
        ["post", "/chat/invites/ABC123/decline"],
      ],
    );
  });

  it("lists, sends, leaves, kicks, and reads judgment status", async () => {
    const http = createHttpMock();
    const m3 = createM3ApiClient(http);
    http.enqueue(success({ room: { id: "room-1", status: "solo_active" } }));
    http.enqueue(
      success({
        messages: [{ id: "m1", content: "hello" }],
        nextCursor: undefined,
      }),
    );
    http.enqueue(
      success({
        message: { id: "m2", content: "reply", visibility_scope: "all" },
      }),
    );
    http.enqueue(success({ roomStatus: "judgment_requested" }));
    http.enqueue(success({ room: { id: "room-1", status: "archived" } }));
    http.enqueue(success({ room: { id: "room-1", status: "solo_active" } }));

    await m3.chat.getRoom("room-1");
    const list = await m3.chat.listMessages("room-1", { limit: 20 });
    const sent = await m3.chat.sendMessage("room-1", {
      content: "reply",
      visibility_scope: "all",
    });
    const status = await m3.chat.getJudgmentStatus("room-1");
    const left = await m3.chat.leaveRoom("room-1");
    const kicked = await m3.chat.kickParticipantB("room-1");

    assert.equal(list.nextCursor, null);
    assert.equal(list.messages.length, 1);
    assert.equal(sent.id, "m2");
    assert.equal(status.roomStatus, "judgment_requested");
    assert.equal(left.status, "archived");
    assert.equal(kicked.status, "solo_active");
    assert.deepEqual(
      http.calls.map((call) => [call.method, call.url]),
      [
        ["get", "/chat/rooms/room-1"],
        ["get", "/chat/rooms/room-1/messages"],
        ["post", "/chat/rooms/room-1/messages"],
        ["get", "/chat/rooms/room-1/judgment-status"],
        ["post", "/chat/rooms/room-1/leave"],
        ["post", "/chat/rooms/room-1/kick-b"],
      ],
    );
  });

  it("requests judgment with a server-verified exact analysis request", async () => {
    const http = createHttpMock();
    const m3 = createM3ApiClient(http);
    http.enqueue(
      success({
        roomId: "room-1",
        caseId: "case-1",
        status: "judgment_requested",
      }),
    );

    const result = await m3.chat.requestJudgment("room-1", {
      analysis_request_id: "analysis-1",
    });

    assert.equal(result.caseId, "case-1");
    assert.deepEqual(http.calls[0], {
      method: "post",
      url: "/chat/rooms/room-1/request-judgment",
      data: {
        analysis_request_id: "analysis-1",
      },
      config: { timeout: CHAT_JUDGMENT_REQUEST_TIMEOUT_MS },
    });
  });

  it("normalizes malformed list responses and failed envelopes", async () => {
    assert.deepEqual(
      normalizeListChatMessagesResponse({
        messages: { items: [] },
        nextCursor: undefined,
      }),
      { messages: [], nextCursor: null },
    );

    const http = createHttpMock();
    const m3 = createM3ApiClient(http);
    http.enqueue(fail("CASE_NOT_READY", "訊息不足"));

    await assert.rejects(
      () => m3.chat.requestJudgment("room-1"),
      (error) =>
        error.code === "CASE_NOT_READY" && error.message === "訊息不足",
    );
  });
});
