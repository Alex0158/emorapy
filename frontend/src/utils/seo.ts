/**
 * SEO工具函數
 */

/**
 * 設置頁面標題
 */
export const setPageTitle = (title: string): void => {
  document.title = `${title} - 熊媽媽法庭`;
};

/**
 * 設置Meta標籤
 */
export const setMetaTag = (name: string, content: string): void => {
  let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
};

/**
 * 設置Open Graph標籤
 */
export const setOGTag = (property: string, content: string): void => {
  let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.content = content;
};

/**
 * 設置描述
 */
export const setDescription = (description: string): void => {
  setMetaTag('description', description);
  setOGTag('og:description', description);
};

/**
 * 設置關鍵詞
 */
export const setKeywords = (keywords: string): void => {
  setMetaTag('keywords', keywords);
};

/**
 * 設置圖片
 */
export const setImage = (imageUrl: string): void => {
  setOGTag('og:image', imageUrl);
};

/**
 * 設置URL
 */
export const setURL = (url: string): void => {
  setOGTag('og:url', url);
};

/**
 * 初始化SEO
 */
export const initSEO = (config: {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  url?: string;
}): void => {
  setPageTitle(config.title);
  setDescription(config.description);
  if (config.keywords) {
    setKeywords(config.keywords);
  }
  if (config.image) {
    setImage(config.image);
  }
  if (config.url) {
    setURL(config.url);
  }
  setOGTag('og:title', config.title);
  setOGTag('og:type', 'website');
};

