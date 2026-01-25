/**
 * 返回頂部組件
 */

import { useState, useEffect } from 'react';
import { Button } from 'antd';
import { ArrowUpOutlined } from '@ant-design/icons';
import { throttle } from '@/utils/helpers';
import './BackToTop.less';

const BackToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = throttle(() => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setVisible(scrollTop > 300);
    }, 100);

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!visible) return null;

  return (
    <Button
      type="primary"
      shape="circle"
      icon={<ArrowUpOutlined />}
      className="back-to-top"
      onClick={scrollToTop}
      aria-label="返回頂部"
    />
  );
};

export default BackToTop;

