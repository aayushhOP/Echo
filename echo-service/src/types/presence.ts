import { z } from "zod";

export const typingEventSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
});

export type TypingEventDTO = z.infer<typeof typingEventSchema>;

export const presenceSyncRequestSchema = z.array(z.string().min(1));
export type PresenceSyncRequestDTO = z.infer<typeof presenceSyncRequestSchema>;

