import { z } from "zod";

import { errorResponse, verifyCsrf } from "@/lib/auth/api";
import { appendMessageToThread, getThreadDetail, userIsThreadParticipant } from "@/lib/communication";

const ThreadQuerySchema = z.object({
  userId: z.string().uuid(),
});

const SendMessageSchema = z.object({
  userId: z.string().uuid(),
  content: z.string().min(1),
});

export async function GET(request, { params }) {
  const { id: threadId } = await params;
  if (!threadId) {
    return errorResponse("INVALID_ID", "Thread ID required.", 400);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = ThreadQuerySchema.safeParse({
    userId: searchParams.get("userId"),
  });

  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const detail = await getThreadDetail(threadId, parseResult.data.userId);
  if (!detail) {
    return errorResponse("NOT_FOUND", "Conversation not found.", 404);
  }

  return Response.json(detail);
}

export async function POST(request, { params }) {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const { id: threadId } = await params;
  if (!threadId) {
    return errorResponse("INVALID_ID", "Thread ID required.", 400);
  }

  const body = await request.json().catch(() => null);
  const parseResult = SendMessageSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const { userId, content } = parseResult.data;
  const isParticipant = await userIsThreadParticipant(threadId, userId);
  if (!isParticipant) {
    return errorResponse("FORBIDDEN", "You are not part of this conversation.", 403);
  }

  await appendMessageToThread(threadId, userId, content);
  const detail = await getThreadDetail(threadId, userId);
  return Response.json(detail, { status: 201 });
}
