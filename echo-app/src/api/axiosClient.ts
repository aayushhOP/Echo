import axios, { InternalAxiosRequestConfig } from "axios";

const baseURL =
  import.meta.env.VITE_API_URL || "https://echo-1aal.onrender.com/api";

export const axiosClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Dynamic token provider (e.g. from Clerk or AuthStore)
let tokenProvider: (() => Promise<string | null> | string | null) = () => null;

export const configureAxiosAuth = (
  getToken: () => Promise<string | null> | string | null
) => {
  tokenProvider = getToken;
};

// Request interceptor: attach Authorization header
axiosClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await tokenProvider();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.error("[AxiosClient] Failed to retrieve token for request:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: bubble error
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);
