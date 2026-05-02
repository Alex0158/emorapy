import React from 'react';
import { Progress, Typography } from 'antd';
import { t } from '@/utils/i18n';
import './index.less';

const { Text } = Typography;

interface RichnessRingProps {
  score: number; // 0-1
  size?: number;
  showLabel?: boolean;
  /** 已有至少一則面向敘事（完整度>0）時，豐富度仍可能 &lt; 0.05，不應顯示「尚未開始」 */
  hasDomainProgress?: boolean;
}

function getRichnessLabel(score: number, hasDomainProgress = false): string {
  if (score < 0.05) {
    return hasDomainProgress ? t('psychProfile.richnessEarlyStage') : t('psychProfile.richnessNotStarted');
  }
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

const RichnessRing: React.FC<RichnessRingProps> = ({
  score,
  size = 80,
  showLabel = true,
  hasDomainProgress = false,
}) => {
  const percent = Math.round(score * 100);
  const color = getRichnessColor(score);
  const label = getRichnessLabel(score, hasDomainProgress);

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
