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
    description?: React.ReactNode;
    content?: React.ReactNode;
    icon?: React.ReactNode;
  }>;
}

const ProgressSteps = ({ current, items, ...props }: ProgressStepsProps) => {
  const normalizedItems = items.map((item) => {
    if (item.content !== undefined) return item;
    const { description, ...rest } = item;
    return { ...rest, content: description };
  });
  return (
    <div className="progress-steps-wrapper">
      <Steps current={current} items={normalizedItems} {...props} />
    </div>
  );
};

export default ProgressSteps;
