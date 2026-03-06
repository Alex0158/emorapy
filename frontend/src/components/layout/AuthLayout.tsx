/**
 * 認證布局（居中卡片式）
 */

import { GlobalOutlined } from '@ant-design/icons';
import { Select } from 'antd';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { getLocale, onLocaleChange, setLocale, t, type Locale } from '@/utils/i18n';
import './AuthLayout.less';

const AuthLayout = () => {
  const [locale, setLocalLocale] = useState<Locale>(getLocale());

  useEffect(() => {
    const unsubscribe = onLocaleChange(() => setLocalLocale(getLocale()));
    return unsubscribe;
  }, []);

  const handleLocaleChange = useCallback((value: Locale) => {
    setLocalLocale(value);
    setLocale(value);
  }, []);

  return (
    <div className="auth-layout">
      {/* Immersive Ambient Background */}
      <div className="ambient-background">
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
        <div className="ambient-orb orb-3"></div>
        <div className="ambient-vignette" aria-hidden />
      </div>

      {/* Main Glass Container */}
      <motion.div 
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="auth-glass-panel"
      >
        <div className="auth-locale-switch">
          <Select
            value={locale}
            onChange={handleLocaleChange}
            size="small"
            className="auth-locale-select"
            suffixIcon={<GlobalOutlined />}
            aria-label={t('auth.locale.ariaLabel')}
            getPopupContainer={(triggerNode) => triggerNode.parentElement ?? document.body}
            options={[
              { value: 'zh-TW', label: t('auth.locale.zhTW') },
              { value: 'en-US', label: t('auth.locale.enUS') },
            ]}
          />
        </div>

        {/* Brand Side (Left) */}
        <div className="auth-brand-side">
          <div className="relative z-10">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="logo-wrapper"
            >
              <span className="text-3xl">✨</span>
              <span className="text-2xl font-bold ml-2 tracking-wide font-heading" style={{ color: '#ffffff' }}>{t('nav.logo')}</span>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="brand-text-content"
            >
              <h1 className="text-4xl lg:text-5xl font-bold leading-[1.15] tracking-tight font-heading" style={{ color: '#ffffff', marginBottom: '24px' }}>
                {t('auth.brand.taglineLine1')} <br/>
                <span className="italic font-serif" style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 'normal' }}>{t('auth.brand.taglineLine2')}</span>
              </h1>
              <p className="text-lg leading-relaxed font-light" style={{ color: 'rgba(255,255,255,0.9)', maxWidth: '320px', margin: 0 }}>
                {t('auth.brand.descriptionLine1')}<br/>
                {t('auth.brand.descriptionLine2')}
              </p>
            </motion.div>
          </div>
          
          {/* Decorative elements inside brand side */}
          <div className="brand-decorative-blur"></div>
        </div>
        
        {/* Form Side (Right) */}
        <div className="auth-form-side">
          <div className="form-container">
            <Outlet />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthLayout;

