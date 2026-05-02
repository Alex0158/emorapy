export type MessageLayerAnalysis = {
  emotionHighlights: string[];
  factHighlights: string[];
  interactionHints: string[];
  informationGaps: string[];
  confidence: 'low' | 'medium' | 'high';
  layerUsability: {
    emotion: {
      level: 'insufficient' | 'partial' | 'usable' | 'rich';
      emotionSignalCount: number;
      needSignalCount: number;
      monoEmotionRisk: boolean;
    };
    fact: {
      level: 'insufficient' | 'partial' | 'usable' | 'rich';
      timeSignalCount: number;
      eventSignalCount: number;
      causalSignalCount: number;
    };
    interaction: {
      level: 'insufficient' | 'partial' | 'usable' | 'rich';
      roleATurns: number;
      roleBTurns: number;
      loopSignalCount: number;
    };
  };
  gapDetails: Array<{
    layer: 'emotion' | 'fact' | 'interaction';
    code: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
  signalStats: {
    totalUserMessages: number;
    roleAMessages: number;
    roleBMessages: number;
    emotionSignalCount: number;
    needSignalCount: number;
    timeSignalCount: number;
    eventSignalCount: number;
    causalSignalCount: number;
    loopSignalCount: number;
  };
};

const emotionRegex =
  /難過|傷心|委屈|生氣|憤怒|焦慮|害怕|痛苦|失望|絕望|崩潰|窒息|\bsad\b|\bhurt\b|\bupset\b|\bangry\b|\banxious\b|\bscared\b|\bdisappointed\b|\bhopeless\b|\boverwhelmed\b|\bdevastated\b/i;
const factRegex =
  /昨天|今天|上週|上個月|當時|那天|[0-9]{1,2}點|次|每次|從來|已經|因為|所以|說了|做了|發生|\byesterday\b|\btoday\b|\blast week\b|\blast month\b|\bthat day\b|\b[0-9]{1,2}\s?(am|pm)\b|\bbecause\b|\bso\b|\bsaid\b|\bdid\b|\bhappened\b/i;
const needRegex =
  /需要|希望|想要|渴望|期待|在乎|安全感|被理解|被看見|想被|擔心|\bneed\b|\bneeds\b|\bhope\b|\bwant\b|\bexpect\b|\bcare\b|\bsafety\b|\bunderstood\b|\bseen\b|\bworried\b/i;
const timeRegex =
  /昨天|今天|上週|上個月|那天|昨晚|早上|下午|晚上|[0-9]{1,2}點|\byesterday\b|\btoday\b|\blast week\b|\blast month\b|\bthat day\b|\blast night\b|\bmorning\b|\bafternoon\b|\bevening\b|\b[0-9]{1,2}\s?(am|pm)\b/i;
const eventRegex =
  /說了|做了|發生|吵|提到|回覆|沒回|遲到|取消|忽略|拒絕|\bsaid\b|\bdid\b|\bhappened\b|\bargued\b|\bmentioned\b|\breplied\b|\bno reply\b|\blate\b|\bcancel(?:ed|led)?\b|\bignored\b|\brejected\b/i;
const causalRegex =
  /因為|所以|導致|結果|因此|讓我|使得|\bbecause\b|\bso\b|\bled to\b|\bresult(?:ed)?\b|\btherefore\b|\bmade me\b|\bcaused\b/i;
const loopRegex =
  /每次|又|一直|總是|反覆|循環|再一次|都會|\bevery time\b|\bagain\b|\balways\b|\brepeatedly\b|\bcycle\b|\bover and over\b/i;
const negativeEmotionRegex =
  /難過|傷心|委屈|生氣|憤怒|焦慮|害怕|痛苦|失望|絕望|崩潰|窒息|\bsad\b|\bhurt\b|\bupset\b|\bangry\b|\banxious\b|\bscared\b|\bdisappointed\b|\bhopeless\b|\bdevastated\b/i;
const positiveEmotionRegex =
  /安心|感謝|放心|喜歡|開心|平靜|被支持|被理解|\bgrateful\b|\bcalm\b|\brelief\b|\brelieved\b|\bappreciate\b|\bsupported\b|\bunderstood\b|\bhopeful\b/i;

function clip(items: string[], max: number): string[] {
  return items.slice(0, max).map((x) => x.slice(0, 140));
}

export function analyzeMessageLayers(
  roleAMessages: string[],
  roleBMessages: string[]
): MessageLayerAnalysis {
  const allA = roleAMessages.map((m) => m.trim()).filter(Boolean);
  const allB = roleBMessages.map((m) => m.trim()).filter(Boolean);
  const all = [...allA, ...allB];

  const emotionHighlights = clip(all.filter((m) => emotionRegex.test(m)), 8);
  const factHighlights = clip(all.filter((m) => factRegex.test(m)), 10);
  const emotionSignalCount = all.filter((m) => emotionRegex.test(m)).length;
  const needSignalCount = all.filter((m) => needRegex.test(m)).length;
  const timeSignalCount = all.filter((m) => timeRegex.test(m)).length;
  const eventSignalCount = all.filter((m) => eventRegex.test(m)).length;
  const causalSignalCount = all.filter((m) => causalRegex.test(m)).length;
  const loopSignalCount = all.filter((m) => loopRegex.test(m)).length;
  const negativeEmotionCount = all.filter((m) => negativeEmotionRegex.test(m)).length;
  const positiveEmotionCount = all.filter((m) => positiveEmotionRegex.test(m)).length;
  const monoEmotionRisk =
    emotionSignalCount >= 2 &&
    (
      (negativeEmotionCount > 0 && positiveEmotionCount === 0) ||
      (positiveEmotionCount > 0 && negativeEmotionCount === 0)
    );

  const interactionHints: string[] = [];
  if (allA.length > 0 && allB.length > 0) {
    interactionHints.push('雙方皆有陳述，可做互動循環分析');
  } else if (allA.length > 0) {
    interactionHints.push('目前主要為 A 方單邊陳述');
  }
  if (emotionHighlights.length > factHighlights.length) {
    interactionHints.push('情緒訊號密度高於事實訊號，判決語氣應提高不確定性');
  }

  const emotionLevel: MessageLayerAnalysis['layerUsability']['emotion']['level'] =
    emotionSignalCount >= 3 && needSignalCount >= 2 && !monoEmotionRisk
      ? 'rich'
      : emotionSignalCount >= 2 && needSignalCount >= 1
        ? 'usable'
        : emotionSignalCount >= 1
          ? 'partial'
          : 'insufficient';
  const factLevel: MessageLayerAnalysis['layerUsability']['fact']['level'] =
    timeSignalCount >= 2 && eventSignalCount >= 3 && causalSignalCount >= 1
      ? 'rich'
      : timeSignalCount >= 1 && eventSignalCount >= 2 && causalSignalCount >= 1
        ? 'usable'
        : timeSignalCount >= 1 || eventSignalCount >= 2
          ? 'partial'
          : 'insufficient';
  const interactionLevel: MessageLayerAnalysis['layerUsability']['interaction']['level'] =
    allB.length >= 2 && loopSignalCount >= 2
      ? 'rich'
      : allB.length >= 1 && loopSignalCount >= 1
        ? 'usable'
        : allB.length >= 1
          ? 'partial'
          : 'insufficient';

  const gapDetails: MessageLayerAnalysis['gapDetails'] = [];
  if (allB.length === 0) {
    gapDetails.push({
      layer: 'interaction',
      code: 'MISSING_ROLE_B_STATEMENT',
      severity: 'high',
      message: '缺少 B 方完整陳述',
    });
  }
  if (timeSignalCount === 0) {
    gapDetails.push({
      layer: 'fact',
      code: 'MISSING_TIME_ANCHOR',
      severity: 'medium',
      message: '缺少可定位的時間錨點',
    });
  }
  if (eventSignalCount < 2) {
    gapDetails.push({
      layer: 'fact',
      code: 'INSUFFICIENT_EVENT_CHAIN',
      severity: 'high',
      message: '事件經過與行為鏈條不足，難以重建衝突場景',
    });
  }
  if (causalSignalCount === 0) {
    gapDetails.push({
      layer: 'fact',
      code: 'MISSING_CAUSAL_LINK',
      severity: 'medium',
      message: '因果描述不足，責任判斷不確定性偏高',
    });
  }
  if (emotionSignalCount === 0) {
    gapDetails.push({
      layer: 'emotion',
      code: 'MISSING_EMOTION_SIGNAL',
      severity: 'medium',
      message: '情緒訊號不足，建議補充主觀感受',
    });
  }
  if (needSignalCount === 0) {
    gapDetails.push({
      layer: 'emotion',
      code: 'MISSING_NEED_SIGNAL',
      severity: 'medium',
      message: '需求/期待描述不足，難以生成可行修復建議',
    });
  }
  if (monoEmotionRisk) {
    gapDetails.push({
      layer: 'emotion',
      code: 'MONO_EMOTION_RISK',
      severity: 'low',
      message: '情緒表達偏單一，可能放大單側詮釋偏差',
    });
  }
  if (allB.length > 0 && loopSignalCount === 0) {
    gapDetails.push({
      layer: 'interaction',
      code: 'LOOP_RECONSTRUCTION_WEAK',
      severity: 'low',
      message: '互動循環線索不足，建議補充「觸發-反應-升級」描述',
    });
  }

  const informationGaps = gapDetails.map((x) => x.message);
  const highGapCount = gapDetails.filter((x) => x.severity === 'high').length;
  const mediumGapCount = gapDetails.filter((x) => x.severity === 'medium').length;

  const confidence: MessageLayerAnalysis['confidence'] =
    highGapCount >= 1 || mediumGapCount >= 3
      ? 'low'
      : mediumGapCount >= 1 || gapDetails.length >= 2
        ? 'medium'
        : 'high';

  return {
    emotionHighlights,
    factHighlights,
    interactionHints,
    informationGaps,
    confidence,
    layerUsability: {
      emotion: {
        level: emotionLevel,
        emotionSignalCount,
        needSignalCount,
        monoEmotionRisk,
      },
      fact: {
        level: factLevel,
        timeSignalCount,
        eventSignalCount,
        causalSignalCount,
      },
      interaction: {
        level: interactionLevel,
        roleATurns: allA.length,
        roleBTurns: allB.length,
        loopSignalCount,
      },
    },
    gapDetails,
    signalStats: {
      totalUserMessages: all.length,
      roleAMessages: allA.length,
      roleBMessages: allB.length,
      emotionSignalCount,
      needSignalCount,
      timeSignalCount,
      eventSignalCount,
      causalSignalCount,
      loopSignalCount,
    },
  };
}

export function buildChatJudgmentStatement(
  messages: string[],
  minLength: number
): string {
  const merged = messages
    .map((x) => x.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 5000);

  if (merged.length >= minLength) {
    return merged;
  }

  const fallback = `以下為聊天室轉換陳述：\n${merged || '目前可用訊息不足，但當事人已要求進入判決流程。'}`;
  if (fallback.length >= minLength) {
    return fallback;
  }

  return fallback.padEnd(minLength, '。');
}
