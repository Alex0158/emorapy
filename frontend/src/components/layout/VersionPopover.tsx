import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Popover, Space, Spin, Typography } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { getVersionSnapshot, type VersionRow } from '@/utils/versionInfo';

const { Text } = Typography;

function VersionRowItem({ row }: { row: VersionRow }) {
  return (
    <div className="version-row">
      <Text type="secondary">{row.name}</Text>
      <Space size={6}>
        <Text strong={row.status === 'ok'} type={row.status === 'error' ? 'danger' : undefined}>
          {row.version}
        </Text>
      </Space>
    </div>
  );
}

export default function VersionPopover() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<VersionRow[]>([]);

  const loadVersions = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const snapshot = await getVersionSnapshot();
      setRows(snapshot.rows);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const content = useMemo(() => {
    if (loading && rows.length === 0) {
      return (
        <div className="version-popover-content loading">
          <Spin size="small" />
        </div>
      );
    }

    return (
      <div className="version-popover-content">
        {rows.map((row) => (
          <div key={row.name}>
            <VersionRowItem row={row} />
            {row.message ? (
              <Text type="secondary" className="version-row-message">
                {row.message}
              </Text>
            ) : null}
          </div>
        ))}
      </div>
    );
  }, [loading, rows]);

  return (
    <Popover
      trigger="hover"
      placement="bottomRight"
      content={content}
      title="版本資訊"
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          void loadVersions();
        }
      }}
    >
      <Button type="text" size="small" icon={<InfoCircleOutlined />} className="version-trigger">
        版本
      </Button>
    </Popover>
  );
}
