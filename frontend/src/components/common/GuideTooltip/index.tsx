/**
 * 引導提示組件（首次使用時顯示）
 */

import { Tooltip, Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { localStore } from '@/utils/storage';
import './GuideTooltip.less';

interface GuideTooltipProps {
  children: React.ReactNode;
  content: string;
  storageKey: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  showOnce?: boolean;
}

const GuideTooltip = ({
  children,
  content,
  storageKey,
  placement = 'top',
  showOnce = true,
}: GuideTooltipProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (showOnce) {
      const hasSeen = localStore.get<boolean>(storageKey);
      if (!hasSeen) {
        setVisible(true);
      }
    } else {
      setVisible(true);
    }
  }, [storageKey, showOnce]);

  const handleClose = () => {
    setVisible(false);
    if (showOnce) {
      localStore.set(storageKey, true);
    }
  };

  if (!visible) {
    return <>{children}</>;
  }

  return (
    <Tooltip
      open={visible}
      title={
        <div className="guide-tooltip-content">
          <span>{content}</span>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={handleClose}
            className="guide-tooltip-close"
          />
        </div>
      }
      placement={placement}
      overlayClassName="guide-tooltip-overlay"
    >
      {children}
    </Tooltip>
  );
};

export default GuideTooltip;

