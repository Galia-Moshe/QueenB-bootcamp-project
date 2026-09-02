import axios from "axios";

export const TOKEN_STORAGE_KEY = "queenb_token";

export const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || "משהו השתבש. נסי שוב.";
  }

  return "משהו השתבש. נסי שוב.";
}
