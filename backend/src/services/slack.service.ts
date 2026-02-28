type SlackField = {
  title: string;
  value: string;
  short?: boolean;
};

type SlackMessageInput = {
  webhookUrl: string;
  title: string;
  text: string;
  color?: 'good' | 'warning' | 'danger' | string;
  fields?: SlackField[];
};

export async function postSlackMessage(input: SlackMessageInput): Promise<void> {
  const payload = {
    text: input.title,
    attachments: [
      {
        color: input.color || 'warning',
        title: input.title,
        text: input.text,
        fields: input.fields || [],
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  const response = await fetch(input.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Slack webhook failed: ${response.status} ${body}`.trim());
  }
}

