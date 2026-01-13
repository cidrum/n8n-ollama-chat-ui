import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isSidebarOpen: window.innerWidth >= 1024,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state, action) => {
      state.isSidebarOpen = action.payload !== undefined ? action.payload : !state.isSidebarOpen;
    },
  },
});

export const { toggleSidebar } = uiSlice.actions;

export default uiSlice.reducer;