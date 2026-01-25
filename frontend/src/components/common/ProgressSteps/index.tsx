/**
 * 進度步驟組件
 */

import { Steps } from 'antd';
import type { StepsProps } from 'antd/es/steps';
import './ProgressSteps.less';

interface ProgressStepsProps extends StepsProps {
  current: number;
  items: Array<{
    title: string;
    description?: string;
    icon?: React.ReactNode;
  }>;
}

const ProgressSteps = ({ current, items, ...props }: ProgressStepsProps) => {
  return (
    <div className="progress-steps-wrapper">
      <Steps current={current} items={items} {...props} />
    </div>
  );
};

export default ProgressSteps;

