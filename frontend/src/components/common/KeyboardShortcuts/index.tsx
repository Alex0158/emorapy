/**
 * 鍵盤快捷鍵組件
 */

import { useEffect } from 'react';
import { Modal, Typography, Tag, Space } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useState } from 'react';
import './KeyboardShortcuts.less';

const { Title, Text } = Typography;

interface Shortcut {
  key: string;
  description: string;
  action: () => void;
}

interface KeyboardShortcutsProps {
  shortcuts: Shortcut[];
  showHelp?: boolean;
}

const KeyboardShortcuts = ({ shortcuts, showHelp = true }: KeyboardShortcutsProps) => {
  const [helpVisible, setHelpVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K 顯示幫助
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (showHelp) {
          setHelpVisible(true);
        }
      }

      // 處理其他快捷鍵
      shortcuts.forEach((shortcut) => {
        const keys = shortcut.key.toLowerCase().split('+');
        const ctrl = keys.includes('ctrl') || keys.includes('cmd');
        const shift = keys.includes('shift');
        const alt = keys.includes('alt');
        const key = keys[keys.length - 1];

        if (
          (ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey) &&
          (shift ? e.shiftKey : !e.shiftKey) &&
          (alt ? e.altKey : !e.altKey) &&
          e.key.toLowerCase() === key
        ) {
          e.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, showHelp]);

  const formatKey = (key: string): string => {
    return key
      .split('+')
      .map((k) => {
        if (k === 'ctrl' || k === 'cmd') return '⌘';
        if (k === 'shift') return '⇧';
        if (k === 'alt') return '⌥';
        return k.toUpperCase();
      })
      .join(' + ');
  };

  return (
    <>
      {showHelp && (
        <Modal
          title={
            <Space>
              <QuestionCircleOutlined />
              <span>鍵盤快捷鍵</span>
            </Space>
          }
          open={helpVisible}
          onCancel={() => setHelpVisible(false)}
          footer={null}
          width={600}
        >
          <div className="keyboard-shortcuts-help">
            <Title level={4}>通用快捷鍵</Title>
            <div className="shortcut-list">
              {shortcuts.map((shortcut, index) => (
                <div key={index} className="shortcut-item">
                  <Tag className="shortcut-key">{formatKey(shortcut.key)}</Tag>
                  <Text>{shortcut.description}</Text>
                </div>
              ))}
            </div>
            <div className="shortcut-hint">
              <Text type="secondary">按 ⌘ + K 可隨時查看此幫助</Text>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default KeyboardShortcuts;

