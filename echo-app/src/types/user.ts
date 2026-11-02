export interface User {
  id: string;
  _id?: string;
  clerkId?: string;
  username: string;
  email: string;
  avatarUrl?: string;
  status?: string;
  isOnline: boolean;
  blockedUsers?: string[];
  blockedBy?: string[];
  lastSeen?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSearchItem {
  id: string;
  _id?: string;
  clerkId?: string;
  username: string;
  avatarUrl?: string;
  status?: string;
  isOnline: boolean;
  lastSeen?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
