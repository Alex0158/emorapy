import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
}

function upsertMeta(name: string, content: string): void {
  const selector = `meta[name="${name}"]`;
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('name', name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export default function SEO({ title, description, keywords }: SEOProps) {
  const location = useLocation();

  useEffect(() => {
    document.title = title;
    upsertMeta('description', description);
    if (keywords) {
      upsertMeta('keywords', keywords);
    }
    upsertMeta('og:url', window.location.origin + location.pathname);
  }, [title, description, keywords, location.pathname]);

  return null;
}
