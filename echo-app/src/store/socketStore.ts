import { create } from "zustand";
import { Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "../types/socketEvents";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketState {
  socket: AppSocket | null;
  isConnected: boolean;
  setSocket: (socket: AppSocket | null) => void;
  setIsConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  setSocket: (socket) => set({ socket }),
  setIsConnected: (isConnected) => set({ isConnected }),
  reset: () => {
    const current = get().socket;
    if (current) {
      current.disconnect();
    }
    set({ socket: null, isConnected: false });
  },
}));
