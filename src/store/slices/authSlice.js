import { createSlice } from '@reduxjs/toolkit';
import { login as loginApi, getToken, logout as logoutApi } from '../../api/authService';

const initialState = {
  isAuthenticated: !!getToken(),
  user: JSON.parse(localStorage.getItem('user')) || null,
  loading: false,
  error: null,
  userInfo: {}, // Additional user information storage
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload;
      state.loading = false;
    },
    loginFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    logoutUser: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.userInfo = {};
    },
    updateUserInfo: (state, action) => {
      state.userInfo = { ...state.userInfo, ...action.payload };
    },
    setUserPreferences: (state, action) => {
      state.userInfo.preferences = { 
        ...state.userInfo.preferences, 
        ...action.payload 
      };
    },
    setUserSettings: (state, action) => {
      state.userInfo.settings = { 
        ...state.userInfo.settings, 
        ...action.payload 
      };
    },
    setUserProfile: (state, action) => {
      state.userInfo.profile = { 
        ...state.userInfo.profile, 
        ...action.payload 
      };
    },
    clearUserInfo: (state) => {
      state.userInfo = {};
    },
  },
});

export const { 
  loginStart, 
  loginSuccess, 
  loginFailure, 
  logoutUser,
  updateUserInfo,
  setUserPreferences,
  setUserSettings,
  setUserProfile,
  clearUserInfo
} = authSlice.actions;

// Thunk action for login
export const loginUser = (username, password) => async (dispatch) => {
  try {
    dispatch(loginStart());
    const response = await loginApi(username, password);
    const user = JSON.parse(localStorage.getItem('user'));
    dispatch(loginSuccess(user));
    
    // Store additional user info if needed
    if (response.additional_data) {
      dispatch(updateUserInfo(response.additional_data));
    }
    
    return response;
  } catch (error) {
    dispatch(loginFailure('Login failed. Please check your credentials.'));
    throw error;
  }
};

// Thunk action for logout
export const logout = () => (dispatch) => {
  logoutApi();
  dispatch(logoutUser());
};

// Thunk action to fetch user profile
export const fetchUserProfile = (userId) => async (dispatch) => {
  try {
    // You would implement an API call here to fetch user profile data
    // const response = await userProfileApi.getProfile(userId);
    // dispatch(setUserProfile(response.data));
    // return response;
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    throw error;
  }
};

// Thunk action to update user preferences
export const updatePreferences = (preferences) => async (dispatch, getState) => {
  try {
    const { user } = getState().auth;
    // You would implement an API call here to save preferences
    // const response = await userPreferencesApi.savePreferences(user.id, preferences);
    dispatch(setUserPreferences(preferences));
    // return response;
  } catch (error) {
    console.error('Failed to update preferences:', error);
    throw error;
  }
};

// Thunk action to save user settings
export const saveSettings = (settings) => async (dispatch, getState) => {
  try {
    const { user } = getState().auth;
    // You would implement an API call here to save settings
    // const response = await userSettingsApi.saveSettings(user.id, settings);
    dispatch(setUserSettings(settings));
    // return response;
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
};

export default authSlice.reducer;
