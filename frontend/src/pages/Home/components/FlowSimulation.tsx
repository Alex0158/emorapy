import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleFilled,
  FileTextOutlined,
  HeartOutlined,
  MessageOutlined,
  SolutionOutlined,
  SyncOutlined,
  SendOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { getLocale, type Locale } from '@/utils/i18n';
import './FlowSimulation.less';

/* ─── Locale-aware content ─── */

type PhoneContent = {
  roleNames: Record<'A' | 'B', string>;
  deviceSuffix: string;
  s0a: { header: string; topicLabel: string; topicTag: string; topicText: string; feelLabel: string; feelTag: string; feelText: string; feelHighlights: string[]; button: string };
  s0b: { header: string; empty: string; notifTitle: string; notifBody: string; notifTime: string; notifAction: string };
  s1a: { header: string; waitTitle: string; skelHeader: string; skelLock: string };
  s1b: { header: string; infoTitle: string; infoDesc: string; feelLabel: string; feelTag: string; feelText: string; feelHighlights: string[]; button: string };
  s2: { header: string; rows: string[]; badge: string };
  s3: { header: string; feedbackTitle: string; feedbackA: string; feedbackB: string; ratioTitle: string; you: string; other: string };
  s4: { header: string; taskTitle: string; badge: string; tasksA: { title: string; desc: string }[]; tasksB: { title: string; desc: string }[]; footerTitle: string; footerDesc: string };
};

type FlowContent = {
  badge: string;
  title: string;
  subtitle: string;
  steps: { title: string; subtitle: string }[];
  hintPaused: string;
  hintActive: string;
  keywords: string[];
  phone: PhoneContent;
};

const contentMap: Record<Locale, FlowContent> = {
  'zh-TW': {
    badge: 'HOW IT WORKS',
    title: '模擬實際使用流程',
    subtitle: '模擬雙方在各自設備上的真實互動，獨立輸入，專業分析',
    steps: [
      { title: '發起溝通', subtitle: 'A 發起案件，B 收到邀請' },
      { title: '雙向聆聽', subtitle: 'B 獨立回覆視角，雙方盲寫' },
      { title: '心理師分析', subtitle: 'AI 梳理觀點與認知落差' },
      { title: '個別開解', subtitle: '同理雙方並提供盲點引導' },
      { title: '和好行動', subtitle: '雙方獲得專屬修復任務' },
    ],
    hintPaused: '輪播已暫停，您可以安心閱讀',
    hintActive: '您可以點擊步驟自由切換',
    keywords: ['家務', '委屈', '期待', '壓力', '溝通', '理解'],
    phone: {
      roleNames: { A: '用戶 A', B: '用戶 B' },
      deviceSuffix: '的設備',
      s0a: {
        header: '發起溝通案件',
        topicLabel: '事件主題',
        topicTag: '僅對方可見',
        topicText: '家務分配不均',
        feelLabel: '我的感受與觀點',
        feelTag: 'AI 將保密處理',
        feelText: '我覺得家務分配不鈞\b均，累積很多委屈，你總是忽視我的付出。',
        feelHighlights: ['委屈', '總是', '忽視'],
        button: '發送溝通邀請',
      },
      s0b: {
        header: '首頁',
        empty: '目前沒有進行中的溝通',
        notifTitle: '用戶 A 發起了溝通邀請',
        notifBody: '關於「家務分配不均」，請前往回覆你的視角。',
        notifTime: '剛剛',
        notifAction: '點擊查看詳情',
      },
      s1a: {
        header: '案件狀態',
        waitTitle: '等待對方回覆',
        skelHeader: '對方正在輸入視角...',
        skelLock: '內容已加密，雙方提交後解鎖',
      },
      s1b: {
        header: '回覆案件',
        infoTitle: '主題：家務分配不均',
        infoDesc: '盲寫模式：在雙方皆提交前，彼此無法看到對方的內容。請安心寫下真實感受。',
        feelLabel: '我的感受與觀點',
        feelTag: 'AI 將保密處理',
        feelText: '我以為你只是在發牢騷\b\b\b偶爾抱怨，沒意識到你真的很在意，我工作也很累。',
        feelHighlights: ['牢騷', '抱怨', '在意', '累'],
        button: '提交我的視角',
      },
      s2: {
        header: 'AI 心理師分析中',
        rows: ['正在匯整雙方私密陳述...', '交叉比對認知落差與盲點...', '正在生成雙方專屬開解方案...'],
        badge: 'AI 僅提取觀點，保護雙方隱私',
      },
      s3: {
        header: '個別開解',
        feedbackTitle: '心理師的反饋',
        feedbackA: '我理解你的委屈，你確實承擔了許多日常家務。但對方可能並非故意忽視，而是雙方對於『整潔標準』與『分工默契』的期待沒有對齊。',
        feedbackB: '對方比你想像中更需要支持。當 A 開始抱怨時，往往是因為家務壓力已經累積到了臨界點，而非針對你個人的指責。',
        ratioTitle: '責任與認知比例',
        you: '你',
        other: '對方',
      },
      s4: {
        header: '和好方案',
        taskTitle: '專屬修復任務',
        badge: '7 天挑戰',
        tasksA: [
          { title: '溝通句型轉換', desc: '嘗試將「你總是」改為「我希望」' },
          { title: '明確需求', desc: '具體列出最需要對方協助的 3 項家務' },
        ],
        tasksB: [
          { title: '主動關心', desc: '每天主動詢問「今天有什麼我可以幫忙的嗎？」' },
          { title: '分擔責任', desc: '主動認領並固定負責至少一項家務' },
        ],
        footerTitle: '對方也已收到專屬任務！',
        footerDesc: '系統將協助你們打卡追蹤，一起變好！',
      },
    },
  },
  'en-US': {
    badge: 'HOW IT WORKS',
    title: 'See the Flow in Action',
    subtitle: 'Watch both sides interact on their own devices — independent input, professional analysis',
    steps: [
      { title: 'Start a Case', subtitle: 'A initiates, B receives an invite' },
      { title: 'Both Sides Speak', subtitle: 'B shares their view independently' },
      { title: 'AI Analysis', subtitle: 'AI identifies gaps & blind spots' },
      { title: 'Personal Insight', subtitle: 'Empathetic guidance for each side' },
      { title: 'Action Plan', subtitle: 'Both get personalized repair tasks' },
    ],
    hintPaused: 'Carousel paused — take your time',
    hintActive: 'Click any step to explore',
    keywords: ['Chores', 'Hurt', 'Hopes', 'Stress', 'Talk', 'Empathy'],
    phone: {
      roleNames: { A: 'User A', B: 'User B' },
      deviceSuffix: "'s Device",
      s0a: {
        header: 'Start a Case',
        topicLabel: 'Topic',
        topicTag: 'Only visible to partner',
        topicText: 'Unfair division of chores',
        feelLabel: 'My feelings & perspective',
        feelTag: 'AI keeps this private',
        feelText: "I feel the chores are unfari\b\b\bair, and I've built up resentment — you always overlook my effort.",
        feelHighlights: ['resentment', 'always', 'overlook'],
        button: 'Send Invitation',
      },
      s0b: {
        header: 'Home',
        empty: 'No active cases right now',
        notifTitle: 'User A started a case',
        notifBody: 'About "Unfair division of chores" — share your side now.',
        notifTime: 'Just now',
        notifAction: 'View Details',
      },
      s1a: {
        header: 'Case Status',
        waitTitle: 'Waiting for response',
        skelHeader: 'The other party is writing...',
        skelLock: 'Encrypted — unlocked after both submit',
      },
      s1b: {
        header: 'Reply to Case',
        infoTitle: 'Topic: Unfair division of chores',
        infoDesc: "Blind-write mode: Neither side can see the other's input until both submit. Write honestly.",
        feelLabel: 'My feelings & perspective',
        feelTag: 'AI keeps this private',
        feelText: "I thought you were just ranting\b\b\b\b\b\b\bventing. I didn't realize you truly cared. I'm exhausted from work too.",
        feelHighlights: ['venting', 'cared', 'exhausted'],
        button: 'Submit My View',
      },
      s2: {
        header: 'AI Therapist Analyzing',
        rows: [
          'Consolidating both private statements...',
          'Cross-referencing perception gaps...',
          'Generating personalized guidance...',
        ],
        badge: 'AI only extracts viewpoints — privacy protected',
      },
      s3: {
        header: 'Personal Insight',
        feedbackTitle: "Therapist's Feedback",
        feedbackA: "I understand your frustration — you've taken on so much of the daily chores. But your partner may not be ignoring you on purpose. It's more likely your expectations around \"clean enough\" and \"who does what\" were never aligned.",
        feedbackB: "Your partner needs more support than you realize. When A starts to complain, it's usually because chore pressure has hit a tipping point — it's not a personal attack on you.",
        ratioTitle: 'Responsibility & Perception',
        you: 'You',
        other: 'Other',
      },
      s4: {
        header: 'Action Plan',
        taskTitle: 'Your Repair Tasks',
        badge: '7-Day Challenge',
        tasksA: [
          { title: 'Reframe Your Words', desc: 'Try changing "You always..." to "I wish..."' },
          { title: 'Be Specific', desc: 'List the top 3 chores you need help with' },
        ],
        tasksB: [
          { title: 'Show Initiative', desc: 'Ask daily: "Is there anything I can help with?"' },
          { title: 'Share the Load', desc: 'Claim and own at least one regular chore' },
        ],
        footerTitle: 'Your partner also received their tasks!',
        footerDesc: 'The system will help you track progress together!',
      },
    },
  },
};

/* ─── Constants & animation config ─── */

type Step = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
};

const AUTO_PLAY_MS = 8500;

const sceneVariants = {
  initial: { opacity: 0, rotateX: 20, y: 20, scale: 0.95 },
  animate: { opacity: 1, rotateX: 0, y: 0, scale: 1 },
  exit: { opacity: 0, rotateX: -20, y: -20, scale: 0.95 }
};

const orbColors = [
  ['rgba(59, 130, 246, 0.15)', 'rgba(255, 140, 66, 0.1)', 'rgba(16, 185, 129, 0.1)'],
  ['rgba(16, 185, 129, 0.15)', 'rgba(59, 130, 246, 0.1)', 'rgba(255, 140, 66, 0.1)'],
  ['rgba(139, 92, 246, 0.2)', 'rgba(6, 182, 212, 0.15)', 'rgba(236, 72, 153, 0.15)'],
  ['rgba(245, 158, 11, 0.15)', 'rgba(252, 211, 77, 0.15)', 'rgba(251, 113, 133, 0.1)'],
  ['rgba(16, 185, 129, 0.2)', 'rgba(52, 211, 153, 0.15)', 'rgba(110, 231, 183, 0.15)'],
];

const getTimeForStep = (step: number) => {
  return ['09:41', '09:43', '09:48', '09:55', '10:02'][step] || '09:41';
};

/* ─── Shared animation sub-components (locale-independent) ─── */

const TypingIndicator = React.memo(() => (
  <motion.div
    className="typing-indicator"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="dot" />
    <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="dot" />
    <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="dot" />
  </motion.div>
));

const DecryptedText = React.memo(({ text, delay = 0 }: { text: string; delay?: number }) => {
  const [displayText, setDisplayedText] = useState('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';

  useEffect(() => {
    let animationFrame: number;
    let isCancelled = false;

    const timeout = setTimeout(() => {
      if (isCancelled) return;
      const currentArr = Array(text.length).fill('');
      const settled = Array(text.length).fill(false);

      let frameCount = 0;
      const update = () => {
        if (isCancelled) return;
        frameCount++;
        let allSettled = true;

        if (frameCount % 4 === 0) {
          for (let i = 0; i < text.length; i++) {
            if (!settled[i]) {
              allSettled = false;
              if (Math.random() < 0.2) {
                settled[i] = true;
              }
              currentArr[i] = settled[i] ? text[i] : chars[Math.floor(Math.random() * chars.length)];
            }
          }
          setDisplayedText(currentArr.join(''));
        } else {
          allSettled = settled.every(s => s);
        }

        if (!allSettled) {
          animationFrame = requestAnimationFrame(update);
        }
      };
      animationFrame = requestAnimationFrame(update);
    }, delay * 1000);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
      cancelAnimationFrame(animationFrame);
    };
  }, [text, delay]);

  return <span style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }}>{displayText || '...'}</span>;
});

const AudioVisualizer = React.memo(() => {
  const [bars] = useState(() => {
    return [...Array(36)].map((_, i) => ({
      rotate: i * 10,
      targetHeight: 15 + Math.random() * 30,
      duration: 0.5 + Math.random() * 0.5
    }));
  });

  return (
    <div className="audio-visualizer">
      {bars.map((bar, i) => (
        <div key={i} style={{ position: 'absolute', transform: `rotate(${bar.rotate}deg)` }}>
          <motion.div
            className="bar"
            style={{ y: -50, height: bar.targetHeight }}
            animate={{ scaleY: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: bar.duration, ease: "easeInOut" }}
          />
        </div>
      ))}
    </div>
  );
});

const TypewriterText = React.memo(({
  text,
  typingDelay = 1.0,
  speed = 0.04,
  className = '',
  highlightWords = []
}: {
  text: string;
  typingDelay?: number;
  speed?: number;
  className?: string;
  highlightWords?: string[];
}) => {
  const [displayedChars, setDisplayedChars] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    setIsTyping(true);
    setDisplayedChars([]);

    let isCancelled = false;

    const runTyping = async () => {
      await new Promise(r => setTimeout(r, typingDelay * 1000));
      if (isCancelled) return;
      setIsTyping(false);

      const chars = Array.from(text);
      let currentChars: string[] = [];

      for (let i = 0; i < chars.length; i++) {
        if (isCancelled) return;

        const char = chars[i];
        if (char === '\b') {
          await new Promise(r => setTimeout(r, speed * 1000 * 6));
          if (isCancelled) return;
          currentChars = currentChars.slice(0, -1);
          setDisplayedChars([...currentChars]);
          await new Promise(r => setTimeout(r, speed * 1000 * 4));
          if (isCancelled) return;
        } else {
          currentChars.push(char);
          setDisplayedChars([...currentChars]);
          const variableSpeed = speed * 1000 * (0.3 + Math.random() * 1.5);
          await new Promise(r => setTimeout(r, variableSpeed));
        }
      }
    };

    runTyping();
    return () => { isCancelled = true; };
  }, [typingDelay, text, speed]);

  if (isTyping) {
    return <TypingIndicator />;
  }

  const fullTextStr = displayedChars.join('');
  const getIsHighlighted = (index: number) => {
    if (!highlightWords.length) return false;
    let isHighlighted = false;
    highlightWords.forEach(word => {
      let startIndex = fullTextStr.indexOf(word);
      while (startIndex !== -1) {
        if (index >= startIndex && index < startIndex + word.length) {
          isHighlighted = true;
        }
        startIndex = fullTextStr.indexOf(word, startIndex + 1);
      }
    });
    return isHighlighted;
  };

  return (
    <span className={`typing-text ${className}`.trim()}>
      {displayedChars.map((char, index) => {
        const isHigh = getIsHighlighted(index);
        return (
          <motion.span
            key={`${index}-${char}`}
            initial={{ opacity: 0, filter: 'blur(2px)', color: '#ff8c42' }}
            animate={{
              opacity: 1,
              filter: 'blur(0px)',
              color: isHigh ? '#ef4444' : 'inherit',
              textShadow: isHigh ? '0 0 8px rgba(239,68,68,0.5)' : 'none',
              fontWeight: isHigh ? 800 : 'normal'
            }}
            transition={{ duration: 0.1 }}
          >
            {char}
          </motion.span>
        );
      })}
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 0.8 }}
        className="typing-cursor"
      >
        |
      </motion.span>
    </span>
  );
});

const FloatingParticles = React.memo(() => {
  const [particles] = useState(() => {
    return [...Array(15)].map(() => ({
      x: `${Math.random() * 100}%`,
      scale: Math.random() * 0.5 + 0.5,
      duration: Math.random() * 2 + 2,
      delay: Math.random() * 2
    }));
  });

  return (
    <div className="particles-container">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="particle"
          initial={{
            y: '100%',
            x: p.x,
            opacity: 0,
            scale: p.scale
          }}
          animate={{
            y: '-20%',
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
});

const FloatingEmojis = React.memo(() => {
  const [emojis] = useState(() => {
    return ['🎉', '✨', '❤️', '🤝', '🙌'].map((emoji, i) => ({
      emoji,
      targetY: -100 - Math.random() * 60,
      targetX: Math.random() * 60 - 30,
      rotate: Math.random() * 90 - 45,
      scale: Math.random() * 0.5 + 0.8,
      duration: 2.5 + Math.random(),
      delay: i * 0.4
    }));
  });

  return (
    <div className="floating-emojis">
      {emojis.map((item, i) => (
        <motion.div
          key={i}
          className="floating-emoji"
          initial={{ y: 0, opacity: 0, x: 0 }}
          animate={{
            y: item.targetY,
            opacity: [0, 1, 0],
            x: item.targetX,
            rotate: item.rotate,
            scale: item.scale
          }}
          transition={{
            duration: item.duration,
            repeat: Infinity,
            delay: item.delay
          }}
        >
          {item.emoji}
        </motion.div>
      ))}
    </div>
  );
});

const FloatingKeywords = React.memo(({ words }: { words: string[] }) => {
  const keywords = useMemo(() => {
    return words.map((word, i) => {
      const angle = (i / words.length) * Math.PI * 2;
      const radius = 90;
      const startX = Math.cos(angle) * radius;
      const startY = Math.sin(angle) * radius;
      return { word, startX, startY, delay: i * 0.7 };
    });
  }, [words]);

  return (
    <div className="floating-keywords">
      {keywords.map((kw) => (
        <motion.div
          key={kw.word}
          className="keyword-bubble"
          initial={{ x: kw.startX, y: kw.startY, opacity: 0, scale: 0 }}
          animate={{
            x: [kw.startX, kw.startX * 0.4, 0],
            y: [kw.startY, kw.startY * 0.4, 0],
            opacity: [0, 1, 0],
            scale: [0, 1, 0.5]
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            delay: kw.delay,
            ease: "easeInOut"
          }}
        >
          {kw.word}
        </motion.div>
      ))}
    </div>
  );
});

const GhostFinger = ({ progress, triggerProgress, theme = 'orange' }: { progress: number; triggerProgress: number; theme?: 'orange' | 'blue' }) => {
  const isActive = progress > triggerProgress - 10 && progress < triggerProgress + 3;
  const isPressing = progress >= triggerProgress - 1 && progress < triggerProgress + 2;

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className={`ghost-finger theme-${theme}`}
          initial={{ opacity: 0, x: 20, y: 30, scale: 1.2 }}
          animate={{
            opacity: isPressing ? 0.8 : 0.5,
            x: 0,
            y: 0,
            scale: isPressing ? 0.8 : 1
          }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="finger-ring" />
          <div className="finger-core" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const AnimatedNumber = ({ value }: { value: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    let isCancelled = false;
    const duration = 1200;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      if (isCancelled) return;
      const elapsed = currentTime - startTime;
      const p = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - p, 4);
      const currentVal = Math.floor(easeProgress * value);
      setCount(currentVal);

      if (p < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationFrameId);
    };
  }, [value]);

  return <span>{count}%</span>;
};

const AIBrainCore = React.memo(() => (
  <motion.div
    className="ai-brain-core"
    animate={{
      scale: [1, 1.15, 1],
      boxShadow: [
        "0 0 20px rgba(255,140,66,0.4)",
        "0 0 50px rgba(255,140,66,0.8)",
        "0 0 20px rgba(255,140,66,0.4)"
      ]
    }}
    transition={{ duration: 1.5, repeat: Infinity }}
  />
));

/* ─── Phone Simulator ─── */

const PhoneSimulator = ({
  role,
  activeStep,
  progress,
  content,
  keywords,
}: {
  role: 'A' | 'B';
  activeStep: number;
  progress: number;
  content: PhoneContent;
  keywords: string[];
}) => {
  const isA = role === 'A';
  const roleName = content.roleNames[role];

  const isActiveRole =
    (activeStep === 0 && isA) ||
    (activeStep === 1 && !isA) ||
    (activeStep >= 2);

  const [isTypingPhase, setIsTypingPhase] = useState(true);
  useEffect(() => {
    setIsTypingPhase(true);
    const timer = setTimeout(() => setIsTypingPhase(false), 4500);
    return () => clearTimeout(timer);
  }, [activeStep]);

  const buttonState = progress < 75 ? 'idle' : progress < 92 ? 'loading' : 'success';
  const isShaking = activeStep === 0 && !isA && progress > 64 && progress < 68;

  return (
    <motion.div
      className={`phone-mockup role-${role.toLowerCase()} ${isActiveRole ? 'is-active-phone' : ''}`}
      animate={{
        scale: isActiveRole ? 1 : 0.94,
        opacity: isActiveRole ? 1 : 0.7,
        filter: isActiveRole ? 'grayscale(0%)' : 'grayscale(20%)',
        x: isShaking ? [-4, 4, -4, 4, 0] : 0,
        y: isActiveRole ? [0, -5, 0] : 0
      }}
      transition={{
        y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
        duration: isShaking ? 0.3 : 0.5,
        type: isShaking ? 'tween' : 'spring',
        bounce: 0.3
      }}
    >
      <div className="phone-frame">
        <div className="glass-light-sweep" />
        <div className={`phone-notch ${activeStep === 2 || (activeStep === 0 && !isA) ? 'notch-expanded' : ''}`}>
          <div className="camera-lens"></div>
          <div className="speaker"></div>
        </div>
        <div className="phone-screen">
          <div className="screen-topbar">
            <span className="time">{getTimeForStep(activeStep)}</span>
            <div className="right-icons">
              <div className="signal-icon"></div>
              <div className="wifi-icon"></div>
              <div className="battery-icon"></div>
            </div>
          </div>

          <div className="screen-content">
            {activeStep === 2 && (
              <div className="screen-scanner-wrapper">
                <div className="screen-scanner"></div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {activeStep === 0 && (
                <motion.div
                  key="step0"
                  className="scene"
                  variants={sceneVariants}
                  initial="initial" animate="animate" exit="exit"
                  transition={{ duration: 0.4 }}
                >
                  {isA ? (
                    <div className="scene-form">
                      <div className="app-header glass">
                        <div className="header-avatar a angry-pulse">A</div>
                        {content.s0a.header}
                      </div>
                      <div className="form-scroll-area">
                        <div className="form-group">
                          <label>{content.s0a.topicLabel} <span className="label-tag">{content.s0a.topicTag}</span></label>
                          <div className={`fake-input ${isTypingPhase ? 'is-typing' : ''}`}>
                            <TypewriterText text={content.s0a.topicText} typingDelay={0.5} speed={0.06} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>{content.s0a.feelLabel} <span className="label-tag secret">{content.s0a.feelTag}</span></label>
                          <div className={`fake-textarea ${isTypingPhase ? 'is-typing' : ''}`}>
                            <TypewriterText
                              text={content.s0a.feelText}
                              typingDelay={1.5}
                              speed={0.05}
                              className="multiline"
                              highlightWords={content.s0a.feelHighlights}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="scene-actions glass-bottom">
                        <GhostFinger progress={progress} triggerProgress={75} />
                        <motion.button
                          layout
                          className={`btn-primary ${buttonState === 'success' ? 'is-success' : ''}`}
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{
                            scale: 1, opacity: 1,
                            width: buttonState === 'idle' ? '100%' : '48px',
                            borderRadius: buttonState === 'idle' ? '14px' : '24px',
                            padding: buttonState === 'idle' ? '14px' : '0',
                            margin: buttonState === 'idle' ? '0' : '0 auto',
                          }}
                          transition={{ layout: { type: 'spring', bounce: 0.3, duration: 0.6 } }}
                          whileHover={buttonState === 'idle' ? { scale: 1.02 } : {}}
                          whileTap={buttonState === 'idle' ? { scale: 0.98 } : {}}
                        >
                          <AnimatePresence mode="wait">
                            {buttonState === 'idle' && (
                              <motion.span key="idle" className="btn-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, display: 'none' }}>
                                {content.s0a.button} <SendOutlined />
                              </motion.span>
                            )}
                            {buttonState === 'loading' && (
                              <motion.span key="loading" className="btn-content" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0, display: 'none' }}>
                                <SyncOutlined spin />
                              </motion.span>
                            )}
                            {buttonState === 'success' && (
                              <motion.span key="success" className="btn-content" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                                <CheckCircleFilled />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      </div>
                    </div>
                  ) : (
                    <div className="scene-home wallpaper-bg">
                      <div className="app-header glass">
                        <div className="header-avatar b">B</div>
                        {content.s0b.header}
                      </div>
                      <div className="home-empty-state glass-card">
                        <div className="empty-icon">☕️</div>
                        <p>{content.s0b.empty}</p>
                      </div>
                      <motion.div
                        className="notification-card glass-card pop-in"
                        initial={{ y: -60, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        transition={{ delay: 5.5, type: 'spring', bounce: 0.6 }}
                      >
                        <div className="notif-header">
                          <div className="notif-brand">
                            <div className="brand-dot"></div>
                            <span>CJ Platform</span>
                          </div>
                          <span className="notif-time">{content.s0b.notifTime}</span>
                        </div>
                        <div className="notif-body">
                          <strong>{content.s0b.notifTitle}</strong>
                          <p>{content.s0b.notifBody}</p>
                        </div>
                        <div className="notif-action">{content.s0b.notifAction}</div>
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeStep === 1 && (
                <motion.div
                  key="step1"
                  className="scene"
                  variants={sceneVariants}
                  initial="initial" animate="animate" exit="exit"
                  transition={{ duration: 0.4 }}
                >
                  {isA ? (
                    <div className="scene-waiting gradient-bg">
                      <div className="app-header glass">
                        <div className="header-avatar a">A</div>
                        {content.s1a.header}
                      </div>
                      <div className="waiting-content">
                        <motion.div
                          className="radar-animation mini"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        >
                          <div className="radar-scanner"></div>
                        </motion.div>
                        <h4 className="waiting-title">{content.s1a.waitTitle}</h4>

                        <motion.div
                          className="skeleton-box glass-card"
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.5 }}
                        >
                          <div className="skel-header">
                            <span className="pulse-dot-blue"></span> {content.s1a.skelHeader}
                          </div>
                          <div className="skel-body">
                            <motion.div className="skel-line" style={{ width: '90%' }} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} />
                            <motion.div className="skel-line" style={{ width: '75%' }} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} />
                            <motion.div className="skel-line" style={{ width: '85%' }} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} />
                          </div>
                          <div className="skel-lock">
                            <LockOutlined /> {content.s1a.skelLock}
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  ) : (
                    <div className="scene-form">
                      <div className="app-header glass">
                        <div className="header-avatar b angry-pulse-blue">B</div>
                        {content.s1b.header}
                      </div>
                      <div className="form-scroll-area">
                        <motion.div
                          className="info-box glass-card theme-blue"
                          initial={{ x: 20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                        >
                          <div className="info-header">
                            <span className="dot"></span> {content.s1b.infoTitle}
                          </div>
                          <p className="text-muted">{content.s1b.infoDesc}</p>
                        </motion.div>
                        <div className="form-group mt-4">
                          <label>{content.s1b.feelLabel} <span className="label-tag secret">{content.s1b.feelTag}</span></label>
                          <div className={`fake-textarea theme-blue ${isTypingPhase ? 'is-typing' : ''}`}>
                            <TypewriterText
                              text={content.s1b.feelText}
                              typingDelay={1.5}
                              speed={0.05}
                              className="multiline"
                              highlightWords={content.s1b.feelHighlights}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="scene-actions glass-bottom">
                        <GhostFinger progress={progress} triggerProgress={75} theme="blue" />
                        <motion.button
                          layout
                          className={`btn-primary theme-blue ${buttonState === 'success' ? 'is-success' : ''}`}
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{
                            scale: 1, opacity: 1,
                            width: buttonState === 'idle' ? '100%' : '48px',
                            borderRadius: buttonState === 'idle' ? '14px' : '24px',
                            padding: buttonState === 'idle' ? '14px' : '0',
                            margin: buttonState === 'idle' ? '0' : '0 auto',
                          }}
                          transition={{ layout: { type: 'spring', bounce: 0.3, duration: 0.6 }, delay: 5.0 }}
                          whileHover={buttonState === 'idle' ? { scale: 1.02 } : {}}
                          whileTap={buttonState === 'idle' ? { scale: 0.98 } : {}}
                        >
                          <AnimatePresence mode="wait">
                            {buttonState === 'idle' && (
                              <motion.span key="idle" className="btn-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, display: 'none' }}>
                                {content.s1b.button} <SendOutlined />
                              </motion.span>
                            )}
                            {buttonState === 'loading' && (
                              <motion.span key="loading" className="btn-content" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0, display: 'none' }}>
                                <SyncOutlined spin />
                              </motion.span>
                            )}
                            {buttonState === 'success' && (
                              <motion.span key="success" className="btn-content" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                                <CheckCircleFilled />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeStep === 2 && (
                <motion.div
                  key="step2"
                  className="scene scene-analyzing deep-space-bg"
                  variants={sceneVariants}
                  initial="initial" animate="animate" exit="exit"
                  transition={{ duration: 0.4 }}
                >
                  <FloatingParticles />
                  <div className="app-header dark-glass">
                    <div className={`header-avatar ${isA ? 'a' : 'b'}`}>{role}</div>
                    {content.s2.header}
                  </div>
                  <div className="analyzing-content">
                    <div className="ai-brain-container">
                      <FloatingKeywords words={keywords} />
                      <AudioVisualizer />
                      <AIBrainCore />
                      <div className="orbit orbit-1"></div>
                      <div className="orbit orbit-2"></div>
                      <div className="orbit orbit-3"></div>
                    </div>

                    <div className="analyzing-steps">
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="analyzing-row dark-glass-card"
                      >
                        <SyncOutlined spin className="spin-icon" /> <DecryptedText text={content.s2.rows[0]} delay={0.5} />
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 2.5 }}
                        className="analyzing-row dark-glass-card"
                      >
                        <SyncOutlined spin className="spin-icon" /> <DecryptedText text={content.s2.rows[1]} delay={2.5} />
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 4.5 }}
                        className="analyzing-row dark-glass-card"
                      >
                        <SyncOutlined spin className="spin-icon" /> <DecryptedText text={content.s2.rows[2]} delay={4.5} />
                      </motion.div>
                    </div>

                    <motion.div
                      className="ai-safety-badge glow"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 5.5 }}
                    >
                      <CheckCircleFilled /> {content.s2.badge}
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {activeStep === 3 && (
                <motion.div
                  key="step3"
                  className="scene scene-counseling soft-bg"
                  variants={sceneVariants}
                  initial="initial" animate="animate" exit="exit"
                  transition={{ duration: 0.4 }}
                >
                  <div className="app-header glass">
                    <div className={`header-avatar ${isA ? 'a' : 'b'}`}>{role}</div>
                    {content.s3.header}
                  </div>
                  <div className="counseling-scroll-area">
                    <motion.div
                      className="counseling-card glass-card"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3, type: "spring" }}
                    >
                      <div className="ai-avatar-wrapper">
                        <div className="ai-avatar pulse-glow">
                          <HeartOutlined />
                        </div>
                      </div>
                      <h3>{content.s3.feedbackTitle}</h3>
                      <div className="counseling-text">
                        {isA ? (
                          <TypewriterText
                            text={content.s3.feedbackA}
                            typingDelay={0.8}
                            speed={0.03}
                          />
                        ) : (
                          <TypewriterText
                            text={content.s3.feedbackB}
                            typingDelay={0.8}
                            speed={0.03}
                          />
                        )}
                      </div>
                    </motion.div>

                    <motion.div
                      className="ratio-container glass-card"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 4.5 }}
                    >
                      <h4 className="ratio-title">{content.s3.ratioTitle}</h4>
                      <div className="ratio-row">
                        <span>{content.s3.you}</span>
                        <div className="ratio-bar-bg">
                          <motion.div
                            className="ratio-bar-fill fill-me gradient-bar"
                            initial={{ width: 0 }}
                            animate={{ width: isA ? '40%' : '60%' }}
                            transition={{ delay: 5.0, duration: 1.2, type: "spring", bounce: 0.3 }}
                          >
                            <span className="ratio-value"><AnimatedNumber value={isA ? 40 : 60} /></span>
                          </motion.div>
                        </div>
                      </div>
                      <div className="ratio-row">
                        <span>{content.s3.other}</span>
                        <div className="ratio-bar-bg">
                          <motion.div
                            className="ratio-bar-fill fill-other solid-bar"
                            initial={{ width: 0 }}
                            animate={{ width: isA ? '60%' : '40%' }}
                            transition={{ delay: 5.2, duration: 1.2, type: "spring", bounce: 0.3 }}
                          >
                            <span className="ratio-value"><AnimatedNumber value={isA ? 60 : 40} /></span>
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {activeStep === 4 && (
                <motion.div
                  key="step4"
                  className="scene scene-plan success-bg"
                  variants={sceneVariants}
                  initial="initial" animate="animate" exit="exit"
                  transition={{ duration: 0.4 }}
                >
                  <FloatingEmojis />
                  <div className="app-header glass">
                    <div className={`header-avatar ${isA ? 'a' : 'b'}`}>{role}</div>
                    {content.s4.header}
                  </div>
                  <div className="plan-scroll-area">
                    <motion.div
                      className="plan-card glass-card"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", bounce: 0.4 }}
                    >
                      <div className="plan-header">
                        <h3>{content.s4.taskTitle}</h3>
                        <span className="badge bounce">{content.s4.badge}</span>
                      </div>
                      <ul className="task-list">
                        {(isA ? content.s4.tasksA : content.s4.tasksB).map((task, idx) => (
                          <motion.li
                            key={task.title}
                            className="task-item"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.8 + idx * 0.7, type: "spring" }}
                          >
                            <div className="task-checkbox"><CheckCircleFilled /></div>
                            <div className="task-content">
                              <strong>{task.title}</strong>
                              <span>{task.desc}</span>
                            </div>
                          </motion.li>
                        ))}
                      </ul>
                    </motion.div>

                    <motion.div
                      className="plan-footer glass-card highlight"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 3.0, type: "spring" }}
                    >
                      <div className="footer-icon wave">🎉</div>
                      <div className="footer-text">
                        <strong>{content.s4.footerTitle}</strong>
                        <span>{content.s4.footerDesc}</span>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="device-label">
        <span className={`role-badge ${isA ? 'a' : 'b'}`}>{role}</span>
        {roleName}{content.deviceSuffix}
      </div>
    </motion.div>
  );
};

/* ─── Main FlowSimulation ─── */

const FlowSimulation = () => {
  const locale = getLocale();
  const c = contentMap[locale];

  const steps = useMemo<Step[]>(
    () => [
      { title: c.steps[0].title, subtitle: c.steps[0].subtitle, icon: <FileTextOutlined /> },
      { title: c.steps[1].title, subtitle: c.steps[1].subtitle, icon: <MessageOutlined /> },
      { title: c.steps[2].title, subtitle: c.steps[2].subtitle, icon: <SyncOutlined /> },
      { title: c.steps[3].title, subtitle: c.steps[3].subtitle, icon: <HeartOutlined /> },
      { title: c.steps[4].title, subtitle: c.steps[4].subtitle, icon: <SolutionOutlined /> },
    ],
    [c]
  );

  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const isHoveredRef = useRef(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    isHoveredRef.current = true;
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    isHoveredRef.current = false;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let mounted = true;
    let lastFrameTime = Date.now();
    let accumulatedTime = 0;
    let animationFrameId: number;

    const animateProgress = () => {
      if (!mounted) return;

      const now = Date.now();
      const delta = Math.min(now - lastFrameTime, 100);
      lastFrameTime = now;

      if (!isHoveredRef.current) {
        accumulatedTime += delta;
      }

      const currentProgress = Math.min((accumulatedTime / AUTO_PLAY_MS) * 100, 100);
      setProgress(currentProgress);

      if (accumulatedTime >= AUTO_PLAY_MS) {
        setActiveStep(prev => (prev + 1) % steps.length);
        accumulatedTime = 0;
      }

      animationFrameId = requestAnimationFrame(animateProgress);
    };

    animationFrameId = requestAnimationFrame(animateProgress);

    return () => {
      mounted = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [steps.length, activeStep]);

  const getStreamDirectionClass = (step: number) => {
    if (step === 0) return 'flow-a-to-b';
    if (step === 1) return 'flow-b-to-a';
    if (step === 2) return 'flow-both-to-center';
    return 'flow-center-to-both';
  };

  return (
    <section
      id="main-content"
      className="flow-demo-section-v3"
      aria-labelledby="flow-demo-title"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <svg width="0" height="0" className="svg-defs">
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff8c42" />
            <stop offset="100%" stopColor="#ff6b6b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="bg-grid"></div>

      <motion.div className="ambient-orb orb-1" animate={{ background: orbColors[activeStep][0] }} transition={{ duration: 2 }} />
      <motion.div className="ambient-orb orb-2" animate={{ background: orbColors[activeStep][1] }} transition={{ duration: 2 }} />
      <motion.div className="ambient-orb orb-3" animate={{ background: orbColors[activeStep][2] }} transition={{ duration: 2 }} />

      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="section-header"
        >
          <div className="badge-title">{c.badge}</div>
          <h2 id="flow-demo-title" className="section-title">
            {c.title}
          </h2>
          <p className="flow-demo-subtitle">{c.subtitle}</p>
        </motion.div>

        <div className="flow-demo-layout">
          <div className="flow-demo-steps-container">
            <ol className="flow-demo-steps">
              <div className="steps-progress-bg"></div>
              <div className="steps-progress-line">
                <motion.div
                  className="steps-progress-fill"
                  animate={{ height: `${(activeStep / (steps.length - 1)) * 100}%` }}
                  transition={{ duration: 0.8, type: 'spring' }}
                />
              </div>

              {steps.map((step, index) => {
                const isActive = index === activeStep;
                const isCompleted = index < activeStep;
                const circumference = 2 * Math.PI * 24;

                return (
                  <motion.li
                    key={step.title}
                    className={`flow-demo-step ${isActive ? 'is-active' : ''} ${isCompleted ? 'is-completed' : ''}`}
                    animate={{
                      x: isActive ? 10 : 0,
                      opacity: isActive || isCompleted ? 1 : 0.5,
                      scale: isActive ? 1.02 : 1
                    }}
                    transition={{ duration: 0.4, type: "spring" }}
                    onClick={() => {
                      setActiveStep(index);
                      setProgress(0);
                    }}
                  >
                    <div className="step-content">
                      <div className="step-icon-wrapper">
                        {isActive && !isHovered && (
                          <svg className="step-progress-ring" viewBox="0 0 52 52">
                            <circle className="ring-bg" cx="26" cy="26" r="24" />
                            <circle
                              className="ring-fill"
                              cx="26" cy="26" r="24"
                              style={{
                                strokeDasharray: circumference,
                                strokeDashoffset: circumference - (progress / 100) * circumference
                              }}
                            />
                          </svg>
                        )}
                        <span className={`step-icon ${isActive ? 'is-active' : ''}`} aria-hidden="true">
                          {isCompleted ? <CheckCircleFilled /> : step.icon}
                        </span>
                      </div>
                      <div className="step-text">
                        <strong>{step.title}</strong>
                        <span>{step.subtitle}</span>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
            <div className="interactive-hint">
              {isHovered ? (
                <><span className="pulse-dot"></span> {c.hintPaused}</>
              ) : (
                c.hintActive
              )}
            </div>
          </div>

          <div className="flow-demo-devices-wrapper">
            <PhoneSimulator role="A" activeStep={activeStep} progress={progress} content={c.phone} keywords={c.keywords} />

            <div className={`devices-divider ${getStreamDirectionClass(activeStep)}`}>
              <div className="stream-line left">
                <div className="stream-particle"></div>
              </div>
              <motion.div
                className="divider-icon"
                animate={{
                  scale: activeStep === 2 ? 1.2 : 1,
                  boxShadow: activeStep === 2 ? '0 0 20px rgba(255,140,66,0.6)' : '0 4px 10px rgba(0,0,0,0.05)'
                }}
              >
                {activeStep === 2 ? (
                  <motion.div
                    className="ai-core-mini"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                ) : (
                  <SyncOutlined />
                )}
              </motion.div>
              <div className="stream-line right">
                <div className="stream-particle"></div>
              </div>
            </div>

            <PhoneSimulator role="B" activeStep={activeStep} progress={progress} content={c.phone} keywords={c.keywords} />

            <div className="device-glow-primary"></div>
            <div className="device-glow-secondary"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FlowSimulation;
