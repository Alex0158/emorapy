import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Popover, Spin, Typography } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { getVersionSnapshot, type VersionRow } from '@/utils/versionInfo';

const { Text } = Typography;

function VersionRowItem({ row }: { row: VersionRow }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <Text type="secondary">{row.name}</Text>
      <Text strong={row.status === 'ok'} type={row.status === 'error' ? 'danger' : undefined}>
        {row.version}
      </Text>
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
        <div style={{ minWidth: 240, minHeight: 32, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="small" />
        </div>
      );
    }

    return (
      <div style={{ minWidth: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row) => (
          <div key={row.name}>
            <VersionRowItem row={row} />
            {row.message ? (
              <Text type="secondary" style={{ display: 'block', marginTop: 2, fontSize: 12 }}>
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
      placement="rightTop"
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
      <Button type="text" size="small" icon={<InfoCircleOutlined />}>
        版本
      </Button>
    </Popover>
  );
}
