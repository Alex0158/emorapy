import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/utils/i18n';

type JsonValueKind = 'array' | 'object';

interface JsonConfigCardProps {
  title: string;
  subtitle: string;
  fieldName: string;
  requiredMessage: string;
  placeholder: string;
  loading: boolean;
  valueKind: JsonValueKind;
  saveLabel: string;
  onSave: (value: unknown) => void;
  initialValue?: string;
}

function parseJsonByKind(raw: string, kind: JsonValueKind): unknown {
  const parsed = JSON.parse(raw);
  if (kind === 'array') {
    if (!Array.isArray(parsed)) throw new Error('not-array');
    return parsed;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('not-object');
  }
  return parsed;
}

export default function JsonConfigCard({
  title,
  subtitle,
  fieldName,
  requiredMessage,
  placeholder,
  loading,
  valueKind,
  saveLabel,
  onSave,
  initialValue,
}: JsonConfigCardProps) {
  const [value, setValue] = useState(initialValue ?? '');

  // Allow parent to update value via initialValue prop
  const [prevInitial, setPrevInitial] = useState(initialValue);
  if (initialValue !== prevInitial) {
    setPrevInitial(initialValue);
    setValue(initialValue ?? '');
  }

  const handleSave = () => {
    if (!value.trim()) {
      toast.error(requiredMessage);
      return;
    }
    try {
      onSave(parseJsonByKind(value, valueKind));
    } catch {
      toast.error(requiredMessage);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        <div className="space-y-2">
          <Label htmlFor={fieldName}>{title}</Label>
          <Textarea
            id={fieldName}
            rows={8}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button
          disabled={loading}
          onClick={handleSave}
        >
          {loading ? `${saveLabel || t('common.save')}...` : saveLabel || t('common.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
