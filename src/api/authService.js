import axios from "axios";
import { store } from "../store";
import { loginSuccess, loginFailure, logoutUser } from "../store/slices/authSlice";

const AUTH_URL = "https://surgbay.com/wp-json/jwt-auth/v1/token";

export const login = async (username, password) => {
  try {
    const response = await axios.post(AUTH_URL, { username, password });
    const { token, user_email, user_nicename, user_display_name, user_roles, user_id, vendor_slug } = response.data;
    
    const rolesArray = user_roles ? Object.values(user_roles) : [];
    
    // Store token and user info
    localStorage.setItem("jwt", token);
    
    const userData = {
      email: user_email,
      username: user_nicename,
      displayName: user_display_name,
      roles: rolesArray,
      id: user_id,
      vendor_slug: vendor_slug
    };
    
    localStorage.setItem("user", JSON.stringify(userData));
    
    // Update Redux store
    store.dispatch(loginSuccess(userData));
    
    return response.data;
  } catch (error) {
    console.error("Login failed:", error);
    store.dispatch(loginFailure(error.response?.data?.message || "Login failed"));
    throw error;
  }
};

export const logout = () => {
  localStorage.removeItem("jwt");
  localStorage.removeItem("user");
  
  // Update Redux store
  store.dispatch(logoutUser());
};

export const getToken = () => localStorage.getItem("jwt");

export const getUser = () => JSON.parse(localStorage.getItem("user") || "null");

export const getUserRoles = () => {
  const user = getUser();
  return user?.roles || [];
};

export const hasRole = (roleToCheck) => {
  const roles = getUserRoles();
  return roles.includes(roleToCheck);
};
