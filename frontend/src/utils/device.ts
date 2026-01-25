/**
 * 設備檢測工具
 */

/**
 * 檢測設備類型
 */
export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

/**
 * 檢測操作系統
 */
export const getOS = (): 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown' => {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  if (/android/.test(userAgent)) return 'android';
  if (/win/.test(userAgent)) return 'windows';
  if (/mac/.test(userAgent)) return 'macos';
  if (/linux/.test(userAgent)) return 'linux';
  return 'unknown';
};

/**
 * 檢測瀏覽器
 */
export const getBrowser = (): 'chrome' | 'firefox' | 'safari' | 'edge' | 'ie' | 'unknown' => {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/chrome/.test(userAgent) && !/edge/.test(userAgent)) return 'chrome';
  if (/firefox/.test(userAgent)) return 'firefox';
  if (/safari/.test(userAgent) && !/chrome/.test(userAgent)) return 'safari';
  if (/edge/.test(userAgent)) return 'edge';
  if (/msie|trident/.test(userAgent)) return 'ie';
  return 'unknown';
};

/**
 * 檢測是否支持觸摸
 */
export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

/**
 * 檢測是否支持本地存儲
 */
export const isLocalStorageSupported = (): boolean => {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

/**
 * 檢測是否支持Session存儲
 */
export const isSessionStorageSupported = (): boolean => {
  try {
    const test = '__sessionStorage_test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

