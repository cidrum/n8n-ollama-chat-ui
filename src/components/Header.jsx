import { useSelector } from 'react-redux';
import { useState, useEffect } from 'react';
import { getUser } from '../api/authService';

function Header({ onLogout, onMenuClick, showMenuButton }) {
  const { user } = useSelector(state => state.auth);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect Android
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = userAgent.indexOf("android") > -1;
    setIsAndroid(isAndroid);
  }, []);

  return (
    <header className={`bg-background text-white p-4 border-b border-white/20 ${isAndroid ? 'android-header' : ''}`}>
      <div className="flex justify-between items-center max-w-[1200px] mx-auto">
        <div className={`flex items-center gap-4 ${showMenuButton ? 'pl-12' : 'pl-0'}`}>
          <span className="font-semibold flex items-center justify-center">
            Welcome, {user?.displayName || user?.username}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

Header.defaultProps = {
  showMenuButton: false,
  onMenuClick: () => {},
};

export default Header;
