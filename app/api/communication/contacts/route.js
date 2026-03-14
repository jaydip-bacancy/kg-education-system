import { errorResponse } from "@/lib/auth/api";
import { getChatContacts } from "@/lib/communication";
import { z } from "zod";

const ContactsQuerySchema = z.object({
  userId: z.string().uuid(),
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const parseResult = ContactsQuerySchema.safeParse({
    userId: searchParams.get("userId"),
  });

  if (!parseResult.success) {
    return errorResponse("VALIDATION_ERROR", parseResult.error.message, 400);
  }

  const { userId } = parseResult.data;
  const data = await getChatContacts(userId);

  if (!data.currentUser) {
    return errorResponse("NOT_FOUND", "User not found.", 404);
  }

  return Response.json({
    currentUser: {
      id: data.currentUser.id,
      email: data.currentUser.email,
      role: data.currentUser.role,
      firstName: data.currentUser.first_name,
      lastName: data.currentUser.last_name,
    },
    contacts: data.contacts,
    availableChildren: data.availableChildren,
  });
}
