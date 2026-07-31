import * as stylex from "@stylexjs/stylex";
import { prisma } from "@/src/lib/prisma";
import { base_styles } from "@/src/lib/styles";
import { formatNotificationStatus, formatNotificationType } from "@/src/types/domain";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [notifications, chats] = await Promise.all([
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.telegramChat.findMany({ orderBy: { updatedAt: "desc" } }),
  ]);

  return (
    <main {...stylex.props(base_styles.page)}>
      <div {...stylex.props(base_styles.page_header)}>
        <div>
          <h1 {...stylex.props(base_styles.title)}>Settings</h1>
          <p {...stylex.props(base_styles.muted)}>Integration status, Telegram chats, and notification history.</p>
        </div>
      </div>

      <section {...stylex.props(base_styles.grid)}>
        <div {...stylex.props(base_styles.panel)}>
          <h2 {...stylex.props(base_styles.heading)}>Telegram chats</h2>
          {chats.map((chat) => (
            <div {...stylex.props(base_styles.timeline_item)} key={chat.id}>
              <strong>{chat.chatId}</strong>
              <p {...stylex.props(base_styles.muted)}>{chat.approved ? "approved" : "not approved"} {chat.label ? `· ${chat.label}` : ""}</p>
            </div>
          ))}
          {!chats.length && <p {...stylex.props(base_styles.muted)}>No Telegram chats seen yet.</p>}
        </div>

        <div {...stylex.props(base_styles.panel)}>
          <h2 {...stylex.props(base_styles.heading)}>Recent notifications</h2>
          {notifications.map((notification) => (
            <div {...stylex.props(base_styles.timeline_item)} key={notification.id}>
              <strong>{formatNotificationType(notification.type)}</strong>
              <p {...stylex.props(base_styles.muted)}>{formatNotificationStatus(notification.status)} · {notification.createdAt.toISOString()}</p>
              <p>{notification.message}</p>
            </div>
          ))}
          {!notifications.length && <p {...stylex.props(base_styles.muted)}>No notifications yet.</p>}
        </div>
      </section>
    </main>
  );
}
