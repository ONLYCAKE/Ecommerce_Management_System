import axios from "axios";

// ✅ Setup Axios instance
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true,
  timeout: 15000, // Prevents hanging requests
});

// ✅ Request Interceptor — attach JWT token
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ Response Interceptor — handle auth + detailed errors
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    // If unauthorized — auto logout + redirect
    if (error?.response?.status === 401) {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } catch (err) {
        console.error("Error clearing localStorage:", err);
      }

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    // For debugging backend errors clearly in console
    if (error.response) {
      console.error(
        `❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        "\nStatus:", error.response.status,
        "\nMessage:", error.response.data?.message || error.message
      );
    } else if (error.request) {
      console.error("❌ Network Error — No response received:", error.request);
    } else {
      console.error("❌ Error setting up request:", error.message);
    }

    return Promise.reject(error);
  }
);

export default instance;
