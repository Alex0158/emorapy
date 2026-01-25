/**
 * SEO組件
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initSEO } from '@/utils/seo';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
}

const SEO = ({ title, description, keywords, image }: SEOProps) => {
  const location = useLocation();

  useEffect(() => {
    initSEO({
      title,
      description,
      keywords,
      image,
      url: window.location.origin + location.pathname,
    });
  }, [title, description, keywords, image, location.pathname]);

  return null;
};

export default SEO;

