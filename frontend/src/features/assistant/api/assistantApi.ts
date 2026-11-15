import { http } from '@/shared/api/httpClient';
import type { AssistantStatus, ChatMessage, ChatReply, MissionSnapshot } from '../types';

export const assistantApi = {
  status: () => http.get<AssistantStatus>('/assistant/status'),

  /** El servidor no guarda la conversación: se envía el historial y el estado de pantalla. */
  chat: (messages: ChatMessage[], mission: MissionSnapshot) =>
    http.post<ChatReply>('/assistant/chat', { messages, mission }),
};
