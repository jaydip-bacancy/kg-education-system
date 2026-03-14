import { supabaseAdmin } from "@/supabaseAdmin";
import { TABLES } from "@/lib/supabase/tables";

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function buildDisplayName(user) {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return fullName || user?.email || "User";
}

function mapBy(items, keyFn, valueFn = (item) => item) {
  return (items || []).reduce((acc, item) => {
    acc[keyFn(item)] = valueFn(item);
    return acc;
  }, {});
}

async function upsertUserFromAuth(userId) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;

  const meta = data.user.user_metadata || {};
  const userRow = {
    id: data.user.id,
    email: data.user.email,
    first_name: meta.firstName ?? meta.first_name ?? null,
    last_name: meta.lastName ?? meta.last_name ?? null,
    phone: meta.phone ?? null,
    role: meta.role ?? "PARENT",
  };

  await supabaseAdmin.from(TABLES.users).upsert(userRow, { onConflict: "id" });
  return userRow;
}

export async function getUserRecord(userId) {
  const { data: userRow, error } = await supabaseAdmin
    .from(TABLES.users)
    .select("id, email, first_name, last_name, phone, role")
    .eq("id", userId)
    .maybeSingle();

  if (!error && userRow) return userRow;
  return upsertUserFromAuth(userId);
}

async function loadUsersWithRoles(userIds) {
  const ids = unique(userIds);
  if (!ids.length) return {};

  const { data: users } = await supabaseAdmin
    .from(TABLES.users)
    .select("id, email, first_name, last_name, phone, role")
    .in("id", ids);

  const { data: staffProfiles } = await supabaseAdmin
    .from(TABLES.staffProfiles)
    .select("user_id, role_title, status")
    .in("user_id", ids);

  const staffByUserId = mapBy(staffProfiles || [], (profile) => profile.user_id);

  return (users || []).reduce((acc, user) => {
    const staffProfile = staffByUserId[user.id];
    acc[user.id] = {
      ...user,
      displayName: buildDisplayName(user),
      roleLabel:
        user.role === "STAFF"
          ? staffProfile?.role_title || "Teacher"
          : user.role === "ADMIN"
            ? "Admin"
            : "Parent",
      roleTitle: staffProfile?.role_title || null,
      staffStatus: staffProfile?.status || null,
    };
    return acc;
  }, {});
}

async function loadCentersById(centerIds) {
  const ids = unique(centerIds);
  if (!ids.length) return {};

  const { data: centers } = await supabaseAdmin
    .from(TABLES.centers)
    .select("id, name")
    .in("id", ids);

  return mapBy(centers || [], (center) => center.id);
}

async function getParentContext(userId) {
  const { data: parentProfile } = await supabaseAdmin
    .from(TABLES.parentProfiles)
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!parentProfile?.id) {
    return { parentProfile: null, children: [], centerIds: [] };
  }

  const { data: children } = await supabaseAdmin
    .from(TABLES.children)
    .select("id, center_id, first_name, last_name")
    .eq("parent_profile_id", parentProfile.id)
    .order("first_name");

  return {
    parentProfile,
    children: children || [],
    centerIds: unique((children || []).map((child) => child.center_id)),
  };
}

async function getStaffContext(userId) {
  const { data: staffProfile } = await supabaseAdmin
    .from(TABLES.staffProfiles)
    .select("id, role_title, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!staffProfile?.id) {
    return { staffProfile: null, centerIds: [] };
  }

  const { data: staffCenters } = await supabaseAdmin
    .from(TABLES.staffCenters)
    .select("center_id")
    .eq("staff_profile_id", staffProfile.id);

  return {
    staffProfile,
    centerIds: unique((staffCenters || []).map((row) => row.center_id)),
  };
}

async function getAdminContext(userId) {
  const { data: adminProfile } = await supabaseAdmin
    .from(TABLES.adminProfiles)
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!adminProfile?.id) {
    return { adminProfile: null, centerIds: [] };
  }

  const { data: adminCenters } = await supabaseAdmin
    .from(TABLES.adminCenters)
    .select("center_id")
    .eq("admin_profile_id", adminProfile.id);

  return {
    adminProfile,
    centerIds: unique((adminCenters || []).map((row) => row.center_id)),
  };
}

function sortContacts(contacts) {
  return [...contacts].sort((left, right) => {
    return (left.displayName || left.email || "").localeCompare(
      right.displayName || right.email || ""
    );
  });
}

function sortByDisplayName(items) {
  return [...items].sort((left, right) =>
    (left.displayName || "").localeCompare(right.displayName || "")
  );
}

export async function getChatContacts(userId) {
  const currentUser = await getUserRecord(userId);
  if (!currentUser) {
    return { currentUser: null, contacts: [], availableChildren: [] };
  }

  if (currentUser.role === "PARENT") {
    const { children, centerIds } = await getParentContext(userId);
    const centersById = await loadCentersById(centerIds);

    const availableChildren = (children || []).map((child) => ({
      id: child.id,
      firstName: child.first_name,
      lastName: child.last_name,
      displayName: [child.first_name, child.last_name].filter(Boolean).join(" ").trim(),
      centerId: child.center_id,
      centerName: centersById[child.center_id]?.name || "Center",
    }));

    const contactsByUserId = {};

    if (centerIds.length) {
      const { data: staffCenters } = await supabaseAdmin
        .from(TABLES.staffCenters)
        .select("staff_profile_id, center_id")
        .in("center_id", centerIds);

      const staffProfileIds = unique((staffCenters || []).map((row) => row.staff_profile_id));
      const { data: staffProfiles } = staffProfileIds.length
        ? await supabaseAdmin
            .from(TABLES.staffProfiles)
            .select("id, user_id, role_title, status")
            .in("id", staffProfileIds)
            .eq("status", "ACTIVE")
        : { data: [] };

      const staffUsers = await loadUsersWithRoles(
        (staffProfiles || []).map((profile) => profile.user_id)
      );

      (staffProfiles || []).forEach((profile) => {
        const user = staffUsers[profile.user_id];
        if (!user || user.id === userId) return;

        const matchingCenters = (staffCenters || [])
          .filter((row) => row.staff_profile_id === profile.id)
          .map((row) => row.center_id);

        const current = contactsByUserId[user.id] || {
          userId: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          displayName: user.displayName,
          role: user.role,
          roleLabel: profile.role_title || user.roleLabel || "Teacher",
          centerIds: [],
          centerNames: [],
          children: [],
        };

        current.centerIds = unique([...current.centerIds, ...matchingCenters]);
        current.centerNames = current.centerIds.map(
          (centerId) => centersById[centerId]?.name || "Center"
        );
        contactsByUserId[user.id] = current;
      });

      const { data: adminCenters } = await supabaseAdmin
        .from(TABLES.adminCenters)
        .select("admin_profile_id, center_id")
        .in("center_id", centerIds);

      const adminProfileIds = unique((adminCenters || []).map((row) => row.admin_profile_id));
      const { data: adminProfiles } = adminProfileIds.length
        ? await supabaseAdmin
            .from(TABLES.adminProfiles)
            .select("id, user_id")
            .in("id", adminProfileIds)
        : { data: [] };

      const adminUsers = await loadUsersWithRoles(
        (adminProfiles || []).map((profile) => profile.user_id)
      );

      (adminProfiles || []).forEach((profile) => {
        const user = adminUsers[profile.user_id];
        if (!user || user.id === userId) return;

        const matchingCenters = (adminCenters || [])
          .filter((row) => row.admin_profile_id === profile.id)
          .map((row) => row.center_id);

        const current = contactsByUserId[user.id] || {
          userId: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          displayName: user.displayName,
          role: user.role,
          roleLabel: "Admin",
          centerIds: [],
          centerNames: [],
          children: [],
        };

        current.centerIds = unique([...current.centerIds, ...matchingCenters]);
        current.centerNames = current.centerIds.map(
          (centerId) => centersById[centerId]?.name || "Center"
        );
        contactsByUserId[user.id] = current;
      });
    }

    return {
      currentUser,
      contacts: sortContacts(Object.values(contactsByUserId)),
      availableChildren,
    };
  }

  if (currentUser.role === "STAFF" || currentUser.role === "ADMIN") {
    const context =
      currentUser.role === "STAFF"
        ? await getStaffContext(userId)
        : await getAdminContext(userId);
    const centerIds = context.centerIds || [];
    const centersById = await loadCentersById(centerIds);

    if (!centerIds.length) {
      return { currentUser, contacts: [], availableChildren: [] };
    }

    const { data: children } = await supabaseAdmin
      .from(TABLES.children)
      .select("id, parent_profile_id, center_id, first_name, last_name")
      .in("center_id", centerIds)
      .order("first_name");

    const parentProfileIds = unique((children || []).map((child) => child.parent_profile_id));
    const { data: parentProfiles } = parentProfileIds.length
      ? await supabaseAdmin
          .from(TABLES.parentProfiles)
          .select("id, user_id")
          .in("id", parentProfileIds)
      : { data: [] };

    const parentUsers = await loadUsersWithRoles(
      (parentProfiles || []).map((profile) => profile.user_id)
    );
    const parentByProfileId = mapBy(parentProfiles || [], (profile) => profile.id);

    const contactsByUserId = {};

    (children || []).forEach((child) => {
      const parentProfile = parentByProfileId[child.parent_profile_id];
      if (!parentProfile) return;
      const user = parentUsers[parentProfile.user_id];
      if (!user || user.id === userId) return;

      const current = contactsByUserId[user.id] || {
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: user.displayName,
        role: user.role,
        roleLabel: "Parent",
        centerIds: [],
        centerNames: [],
        children: [],
      };

      current.centerIds = unique([...current.centerIds, child.center_id]);
      current.centerNames = current.centerIds.map(
        (centerId) => centersById[centerId]?.name || "Center"
      );
      current.children = [
        ...current.children,
        {
          id: child.id,
          firstName: child.first_name,
          lastName: child.last_name,
          displayName: [child.first_name, child.last_name].filter(Boolean).join(" ").trim(),
          centerId: child.center_id,
          centerName: centersById[child.center_id]?.name || "Center",
        },
      ];
      contactsByUserId[user.id] = current;
    });

    Object.values(contactsByUserId).forEach((contact) => {
      contact.children = sortByDisplayName(contact.children);
    });

    return {
      currentUser,
      contacts: sortContacts(Object.values(contactsByUserId)),
      availableChildren: [],
    };
  }

  return { currentUser, contacts: [], availableChildren: [] };
}

async function getThreadParticipantRows(threadIds) {
  const ids = unique(threadIds);
  if (!ids.length) return [];

  const { data } = await supabaseAdmin
    .from(TABLES.messageThreadParticipants)
    .select("thread_id, user_id")
    .in("thread_id", ids);

  return data || [];
}

export async function getThreadList(userId) {
  const { data: memberships } = await supabaseAdmin
    .from(TABLES.messageThreadParticipants)
    .select("thread_id")
    .eq("user_id", userId);

  const threadIds = unique((memberships || []).map((row) => row.thread_id));
  if (!threadIds.length) return [];

  const { data: threads } = await supabaseAdmin
    .from(TABLES.messageThreads)
    .select("id, child_id, center_id, subject, created_at, updated_at")
    .in("id", threadIds)
    .order("updated_at", { ascending: false });

  if (!threads?.length) return [];

  const participantRows = await getThreadParticipantRows(threadIds);
  const participantUserIds = unique(participantRows.map((row) => row.user_id));
  const usersById = await loadUsersWithRoles(participantUserIds);

  const childIds = unique((threads || []).map((thread) => thread.child_id));
  const { data: childRows } = childIds.length
    ? await supabaseAdmin
        .from(TABLES.children)
        .select("id, first_name, last_name")
        .in("id", childIds)
    : { data: [] };
  const childrenById = mapBy(childRows || [], (child) => child.id);

  const { data: messages } = await supabaseAdmin
    .from(TABLES.messages)
    .select("id, thread_id, sender_id, content, read_at, created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false });

  const lastMessageByThread = {};
  const unreadCountByThread = {};
  (messages || []).forEach((message) => {
    if (!lastMessageByThread[message.thread_id]) {
      lastMessageByThread[message.thread_id] = message;
    }
    if (message.sender_id !== userId && !message.read_at) {
      unreadCountByThread[message.thread_id] =
        (unreadCountByThread[message.thread_id] || 0) + 1;
    }
  });

  const participantsByThread = participantRows.reduce((acc, row) => {
    if (!acc[row.thread_id]) acc[row.thread_id] = [];
    acc[row.thread_id].push(row.user_id);
    return acc;
  }, {});

  return (threads || []).map((thread) => {
    const participantIds = participantsByThread[thread.id] || [];
    const otherUserId = participantIds.find((id) => id !== userId) || participantIds[0] || null;
    const child = childrenById[thread.child_id];
    const lastMessage = lastMessageByThread[thread.id] || null;

    return {
      id: thread.id,
      subject: thread.subject,
      centerId: thread.center_id,
      createdAt: thread.created_at,
      updatedAt: thread.updated_at,
      child: child
        ? {
            id: child.id,
            displayName: [child.first_name, child.last_name].filter(Boolean).join(" ").trim(),
          }
        : null,
      contact: otherUserId
        ? {
            userId: otherUserId,
            email: usersById[otherUserId]?.email,
            firstName: usersById[otherUserId]?.first_name,
            lastName: usersById[otherUserId]?.last_name,
            displayName: usersById[otherUserId]?.displayName || "Participant",
            role: usersById[otherUserId]?.role,
            roleLabel: usersById[otherUserId]?.roleLabel,
          }
        : null,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content,
            createdAt: lastMessage.created_at,
            senderId: lastMessage.sender_id,
          }
        : null,
      unreadCount: unreadCountByThread[thread.id] || 0,
    };
  });
}

export async function userIsThreadParticipant(threadId, userId) {
  const { data: participant } = await supabaseAdmin
    .from(TABLES.messageThreadParticipants)
    .select("id")
    .eq("thread_id", threadId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(participant?.id);
}

export async function getThreadDetail(threadId, userId) {
  const isParticipant = await userIsThreadParticipant(threadId, userId);
  if (!isParticipant) return null;

  const { data: thread } = await supabaseAdmin
    .from(TABLES.messageThreads)
    .select("id, child_id, center_id, subject, created_at, updated_at")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread) return null;

  const participantRows = await getThreadParticipantRows([threadId]);
  const participantUserIds = unique(participantRows.map((row) => row.user_id));
  const usersById = await loadUsersWithRoles(participantUserIds);

  const child = thread.child_id
    ? await supabaseAdmin
        .from(TABLES.children)
        .select("id, first_name, last_name")
        .eq("id", thread.child_id)
        .maybeSingle()
        .then((result) => result.data || null)
    : null;

  const { data: unreadMessages } = await supabaseAdmin
    .from(TABLES.messages)
    .select("id")
    .eq("thread_id", threadId)
    .neq("sender_id", userId)
    .is("read_at", null);

  const unreadMessageIds = (unreadMessages || []).map((message) => message.id);
  const readTimestamp = new Date().toISOString();

  if (unreadMessageIds.length) {
    await supabaseAdmin
      .from(TABLES.messages)
      .update({ read_at: readTimestamp })
      .in("id", unreadMessageIds);
  }

  const { data: messages } = await supabaseAdmin
    .from(TABLES.messages)
    .select("id, sender_id, content, read_at, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  return {
    id: thread.id,
    subject: thread.subject,
    centerId: thread.center_id,
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
    child: child
      ? {
          id: child.id,
          displayName: [child.first_name, child.last_name].filter(Boolean).join(" ").trim(),
        }
      : null,
    participants: participantRows.map((row) => ({
      userId: row.user_id,
      displayName: usersById[row.user_id]?.displayName || "Participant",
      email: usersById[row.user_id]?.email,
      role: usersById[row.user_id]?.role,
      roleLabel: usersById[row.user_id]?.roleLabel,
    })),
    messages: (messages || []).map((message) => ({
      id: message.id,
      senderId: message.sender_id,
      senderName: usersById[message.sender_id]?.displayName || "Participant",
      senderRole: usersById[message.sender_id]?.role,
      senderRoleLabel: usersById[message.sender_id]?.roleLabel,
      content: message.content,
      readAt:
        unreadMessageIds.includes(message.id) && message.sender_id !== userId
          ? readTimestamp
          : message.read_at,
      createdAt: message.created_at,
      isOwn: message.sender_id === userId,
    })),
  };
}

export async function findExistingDirectThread(userId, contactUserId, childId = null) {
  const [mineRes, theirsRes] = await Promise.all([
    supabaseAdmin
      .from(TABLES.messageThreadParticipants)
      .select("thread_id")
      .eq("user_id", userId),
    supabaseAdmin
      .from(TABLES.messageThreadParticipants)
      .select("thread_id")
      .eq("user_id", contactUserId),
  ]);

  const myThreadIds = new Set((mineRes.data || []).map((row) => row.thread_id));
  const sharedThreadIds = unique(
    (theirsRes.data || [])
      .map((row) => row.thread_id)
      .filter((threadId) => myThreadIds.has(threadId))
  );

  if (!sharedThreadIds.length) return null;

  let query = supabaseAdmin
    .from(TABLES.messageThreads)
    .select("id, child_id")
    .in("id", sharedThreadIds)
    .order("updated_at", { ascending: false })
    .limit(1);

  query = childId ? query.eq("child_id", childId) : query.is("child_id", null);

  const { data } = await query;
  return data?.[0] || null;
}

export async function appendMessageToThread(threadId, senderId, content) {
  const { data: message, error } = await supabaseAdmin
    .from(TABLES.messages)
    .insert({
      thread_id: threadId,
      sender_id: senderId,
      content: content.trim(),
    })
    .select("id, thread_id, sender_id, content, read_at, created_at")
    .single();

  if (error) {
    throw new Error(error.message || "Unable to send message.");
  }

  await supabaseAdmin
    .from(TABLES.messageThreads)
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  return message;
}

export async function createDirectThread({
  userId,
  contactUserId,
  childId = null,
  centerId,
  subject = null,
  content = null,
}) {
  const { data: thread, error } = await supabaseAdmin
    .from(TABLES.messageThreads)
    .insert({
      child_id: childId || null,
      center_id: centerId,
      subject: subject?.trim() || null,
    })
    .select("id, child_id, center_id, subject, created_at, updated_at")
    .single();

  if (error || !thread) {
    throw new Error(error?.message || "Unable to create thread.");
  }

  const { error: participantError } = await supabaseAdmin
    .from(TABLES.messageThreadParticipants)
    .insert([
      { thread_id: thread.id, user_id: userId },
      { thread_id: thread.id, user_id: contactUserId },
    ]);

  if (participantError) {
    throw new Error(participantError.message || "Unable to add participants.");
  }

  if (content?.trim()) {
    await appendMessageToThread(thread.id, userId, content);
  }

  return thread;
}



