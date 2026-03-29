/**
 * 責任分比例展示組件
 */

import { Typography } from 'antd';
import { COLORS } from '@/utils/constants';
import { t } from '@/utils/i18n';
import type { ResponsibilityRatio as ResponsibilityRatioType } from '@/types/common';
import './ResponsibilityRatio.less';

const { Text } = Typography;

interface ResponsibilityRatioProps {
  ratio: ResponsibilityRatioType;
  showLabels?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const ResponsibilityRatio = ({
  ratio,
  showLabels = true,
  size = 'medium',
}: ResponsibilityRatioProps) => {
  if (!ratio) return null;
  const p = Number(ratio.plaintiff);
  const d = Number(ratio.defendant);
  if (Number.isNaN(p) || Number.isNaN(d) || p < 0 || d < 0) return null;

  return (
    <div className={`responsibility-ratio ${size}`}>
      {/* 桌面端：圓餅圖 */}
      <div className="pie-chart desktop-only">
        <div
          className="pie-segment"
          style={{
            background: `conic-gradient(${COLORS.primary} 0% ${p}%, ${COLORS.secondary} ${p}% 100%)`,
          }}
        >
          <div className="pie-center">
            <div className="pie-label">
              <div className="label-item">
                <span className="label-dot" style={{ background: COLORS.primary }}></span>
                <span>{t('responsibility.roleA')}: {p}%</span>
              </div>
              <div className="label-item">
                <span className="label-dot" style={{ background: COLORS.secondary }}></span>
                <span>{t('responsibility.roleB')}: {d}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 移動端：進度條 */}
      <div className="progress-bar mobile-only">
        <div className="progress-container">
          <div
            className="progress-segment plaintiff-progress"
            style={{
              width: `${p}%`,
              background: COLORS.primary,
            }}
          >
            <span className="progress-label">{p}%</span>
          </div>
          <div
            className="progress-segment defendant-progress"
            style={{
              width: `${d}%`,
              background: COLORS.secondary,
            }}
          >
            <span className="progress-label">{d}%</span>
          </div>
        </div>
      </div>

      {/* 比例標註 */}
      {showLabels && (
        <div className="responsibility-labels">
          <div className="label-item">
            <span className="label-badge" style={{ background: COLORS.primary }}>
              {t('responsibility.roleA')}
            </span>
            <Text strong>{p}% {t('responsibility.liability')}</Text>
          </div>
          <div className="label-item">
            <span className="label-badge" style={{ background: COLORS.secondary }}>
              {t('responsibility.roleB')}
            </span>
            <Text strong>{d}% {t('responsibility.liability')}</Text>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponsibilityRatio;

