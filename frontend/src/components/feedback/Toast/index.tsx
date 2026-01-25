/**
 * Toast提示組件（封裝Ant Design的message）
 */

import { message } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

export const toast: MessageInstance = {
  success: (content, duration) => {
    return message.success(content, duration);
  },
  error: (content, duration) => {
    return message.error(content, duration);
  },
  info: (content, duration) => {
    return message.info(content, duration);
  },
  warning: (content, duration) => {
    return message.warning(content, duration);
  },
  loading: (content, duration) => {
    return message.loading(content, duration);
  },
  open: (options) => {
    return message.open(options);
  },
  destroy: (key) => {
    return message.destroy(key);
  },
};

export default toast;

