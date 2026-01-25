/**
 * 責任分比例展示組件
 */

import { Typography } from 'antd';
import { COLORS } from '@/utils/constants';
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
  const { plaintiff, defendant } = ratio;

  return (
    <div className={`responsibility-ratio ${size}`}>
      {/* 桌面端：圓餅圖 */}
      <div className="pie-chart desktop-only">
        <div
          className="pie-segment"
          style={{
            background: `conic-gradient(${COLORS.primary} 0% ${plaintiff}%, ${COLORS.secondary} ${plaintiff}% 100%)`,
          }}
        >
          <div className="pie-center">
            <div className="pie-label">
              <div className="label-item">
                <span className="label-dot" style={{ background: COLORS.primary }}></span>
                <span>角色A: {plaintiff}%</span>
              </div>
              <div className="label-item">
                <span className="label-dot" style={{ background: COLORS.secondary }}></span>
                <span>角色B: {defendant}%</span>
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
              width: `${plaintiff}%`,
              background: COLORS.primary,
            }}
          >
            <span className="progress-label">{plaintiff}%</span>
          </div>
          <div
            className="progress-segment defendant-progress"
            style={{
              width: `${defendant}%`,
              background: COLORS.secondary,
            }}
          >
            <span className="progress-label">{defendant}%</span>
          </div>
        </div>
      </div>

      {/* 比例標註 */}
      {showLabels && (
        <div className="responsibility-labels">
          <div className="label-item">
            <span className="label-badge" style={{ background: COLORS.primary }}>
              角色A
            </span>
            <Text strong>{plaintiff}% 責任</Text>
          </div>
          <div className="label-item">
            <span className="label-badge" style={{ background: COLORS.secondary }}>
              角色B
            </span>
            <Text strong>{defendant}% 責任</Text>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponsibilityRatio;

