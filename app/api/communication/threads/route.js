import { z } from "zod";

import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import {
  appendMessageToThread,
  createDirectThread,
  findExistingDirectThread,
  getChatContacts,
  getThreadDetail,
  getThreadList,
} from "@/lib/communication";

const ThreadsQuerySchema = z.object({
  userId: z.string().uuid(),
});

const CreateThreadSchema = z.object({
  userId: z.string().uuid(),
  contactUserId: z.string().uuid(),
  childId: z.string().uuid().optional().nullable(),
  subject: z.string().optional().nullable(),
  content: z.string().trim().min(1).optional().nullable(),
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const parseResult = ThreadsQuerySchema.safeParse({
    userId: searchParams.get("userId"),
  });

  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const threads = await getThreadList(parseResult.data.userId);
  return Response.json(threads);
}

export async function POST(request) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parseResult = CreateThreadSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const { userId, contactUserId, childId, subject, content } = parseResult.data;
  const trimmedContent = content?.trim() || "";
  const chatContext = await getChatContacts(userId);
  if (!chatContext.currentUser) {
    return errorResponse("NOT_FOUND", "User not found.", 404);
  }

  const contact = (chatContext.contacts || []).find((item) => item.userId === contactUserId);
  if (!contact) {
    return errorResponse("CONTACT_NOT_ALLOWED", "You cannot start a chat with this contact.", 403);
  }

  let resolvedChildId = childId || null;

  if (chatContext.currentUser.role === "PARENT") {
    if (resolvedChildId) {
      const selectedChild = (chatContext.availableChildren || []).find(
        (item) => item.id === resolvedChildId
      );
      if (!selectedChild) {
        return errorResponse("CHILD_NOT_ALLOWED", "Choose one of your children for this chat.", 400);
      }
      if (!contact.centerIds?.includes(selectedChild.centerId)) {
        return errorResponse("CENTER_MISMATCH", "This contact is not linked to the selected child's center.", 400);
      }
    }
  } else if (resolvedChildId) {
    const selectedChild = (contact.children || []).find((item) => item.id === resolvedChildId);
    if (!selectedChild) {
      return errorResponse("CHILD_NOT_ALLOWED", "Choose one of this parent's children for the chat.", 400);
    }
  }

  const centerId = resolvedChildId
    ? chatContext.currentUser.role === "PARENT"
      ? (chatContext.availableChildren || []).find((item) => item.id === resolvedChildId)?.centerId
      : (contact.children || []).find((item) => item.id === resolvedChildId)?.centerId
    : contact.centerIds?.[0];

  if (!centerId) {
    return errorResponse("CENTER_REQUIRED", "Unable to determine the center for this conversation.", 400);
  }

  const existingThread = await findExistingDirectThread(userId, contactUserId, resolvedChildId);
  const thread = existingThread
    ? { id: existingThread.id }
    : await createDirectThread({
        userId,
        contactUserId,
        childId: resolvedChildId,
        centerId,
        subject,
        content: trimmedContent || null,
      });

  if (existingThread && trimmedContent) {
    await appendMessageToThread(existingThread.id, userId, trimmedContent);
  }

  const detail = await getThreadDetail(thread.id, userId);
  return Response.json(detail, { status: existingThread ? 200 : 201 });
}
