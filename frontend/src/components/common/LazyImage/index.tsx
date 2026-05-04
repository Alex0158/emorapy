/**
 * 懶加載圖片組件
 */

import { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { t } from '@/utils/i18n';
import { cn } from '@/lib/utils';

interface LazyImageProps {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

const LazyImage = ({ src, alt, placeholder, className = '', onLoad, onError }: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((entry) => { if (entry.isIntersecting) { setIsInView(true); observer.disconnect(); } }); },
      { rootMargin: '50px' },
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => { observer.disconnect(); };
  }, []);

  return (
    <div ref={imgRef} className={cn('relative overflow-hidden', className)}>
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          {placeholder ? <img src={placeholder} alt={alt} className="h-full w-full object-cover opacity-50" /> : <Loader2 className="size-5 animate-spin text-muted-foreground" />}
        </div>
      )}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={cn('w-full transition-opacity duration-300', isLoaded ? 'opacity-100' : 'opacity-0')}
          onLoad={() => { setIsLoaded(true); onLoad?.(); }}
          onError={() => { setHasError(true); onError?.(); }}
          style={{ display: hasError ? 'none' : 'block' }}
        />
      )}
      {hasError && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          {t('common.imageLoadFail')}
        </div>
      )}
    </div>
  );
};

export default LazyImage;
