import React from 'react';
import { Progress, Typography } from 'antd';
import { t } from '@/utils/i18n';
import './index.less';

const { Text } = Typography;

interface RichnessRingProps {
  score: number; // 0-1
  size?: number;
  showLabel?: boolean;
}

function getRichnessLabel(score: number): string {
  if (score < 0.05) return t('psychProfile.richnessNotStarted');
  if (score < 0.3) return t('psychProfile.richnessGettingToKnow');
  if (score < 0.6) return t('psychProfile.richnessGoodUnderstanding');
  return t('psychProfile.richnessDeepUnderstanding');
}

function getRichnessColor(score: number): string {
  if (score < 0.05) return '#d9d9d9';
  if (score < 0.3) return '#faad14';
  if (score < 0.6) return '#1890ff';
  return '#52c41a';
}

const RichnessRing: React.FC<RichnessRingProps> = ({ score, size = 80, showLabel = true }) => {
  const percent = Math.round(score * 100);
  const color = getRichnessColor(score);
  const label = getRichnessLabel(score);

  return (
    <div className="richness-ring">
      <Progress
        type="circle"
        percent={percent}
        size={size}
        strokeColor={color}
        format={() => (showLabel ? '' : label)}
      />
      {showLabel && (
        <Text type="secondary" className="richness-ring__label">{label}</Text>
      )}
    </div>
  );
};

export default RichnessRing;
