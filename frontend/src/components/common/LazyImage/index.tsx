/**
 * 懶加載圖片組件
 */

import { useState, useRef, useEffect } from 'react';
import { Spin } from 'antd';
import './LazyImage.less';

interface LazyImageProps {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

const LazyImage = ({
  src,
  alt,
  placeholder,
  className = '',
  onLoad,
  onError,
}: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <div ref={imgRef} className={`lazy-image-container ${className}`}>
      {!isLoaded && !hasError && (
        <div className="lazy-image-placeholder">
          {placeholder ? (
            <img src={placeholder} alt={alt} className="placeholder-image" />
          ) : (
            <Spin size="small" />
          )}
        </div>
      )}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`lazy-image ${isLoaded ? 'loaded' : ''}`}
          onLoad={handleLoad}
          onError={handleError}
          style={{ display: hasError ? 'none' : 'block' }}
        />
      )}
      {hasError && (
        <div className="lazy-image-error">
          <span>圖片加載失敗</span>
        </div>
      )}
    </div>
  );
};

export default LazyImage;

