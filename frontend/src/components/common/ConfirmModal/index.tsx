/**
 * 確認彈窗組件
 */

import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import type { ModalProps } from 'antd/es/modal';

interface ConfirmModalProps extends Omit<ModalProps, 'onOk'> {
  onConfirm: () => void | Promise<void>;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

const ConfirmModal = ({
  onConfirm,
  confirmText = '確認',
  cancelText = '取消',
  type = 'warning',
  ...props
}: ConfirmModalProps) => {
  const handleConfirm = async () => {
    await onConfirm();
    props.onCancel?.(undefined as any);
  };

  return (
    <Modal
      {...props}
      onOk={handleConfirm}
      okText={confirmText}
      cancelText={cancelText}
      okButtonProps={{
        danger: type === 'danger',
        ...props.okButtonProps,
      }}
    >
      {type === 'warning' || type === 'danger' ? (
        <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
          <ExclamationCircleOutlined style={{ color: type === 'danger' ? '#ff4d4f' : '#faad14', fontSize: 20 }} />
          <div>{props.children}</div>
        </div>
      ) : (
        props.children
      )}
    </Modal>
  );
};

export default ConfirmModal;

