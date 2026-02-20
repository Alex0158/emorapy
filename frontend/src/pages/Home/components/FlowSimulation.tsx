import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useSpring, useTransform, MotionValue } from 'framer-motion';
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
import './FlowSimulation.less';

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
  ['rgba(59, 130, 246, 0.15)', 'rgba(255, 140, 66, 0.1)', 'rgba(16, 185, 129, 0.1)'], // Step 0
  ['rgba(16, 185, 129, 0.15)', 'rgba(59, 130, 246, 0.1)', 'rgba(255, 140, 66, 0.1)'], // Step 1
  ['rgba(139, 92, 246, 0.2)', 'rgba(6, 182, 212, 0.15)', 'rgba(236, 72, 153, 0.15)'], // Step 2 (Tech)
  ['rgba(245, 158, 11, 0.15)', 'rgba(252, 211, 77, 0.15)', 'rgba(251, 113, 133, 0.1)'], // Step 3 (Warm)
  ['rgba(16, 185, 129, 0.2)', 'rgba(52, 211, 153, 0.15)', 'rgba(110, 231, 183, 0.15)'], // Step 4 (Success)
];

const getTimeForStep = (step: number) => {
  return ['09:41', '09:43', '09:48', '09:55', '10:02'][step] || '09:41';
};

const TypingIndicator = () => (
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
);

const DecryptedText = ({ text, delay = 0 }: { text: string, delay?: number }) => {
  const [displayText, setDisplayedText] = useState('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
  
  useEffect(() => {
    let timeout: any;
    let animationFrame: number;
    let isCancelled = false;
    
    timeout = setTimeout(() => {
      if (isCancelled) return;
      let currentArr = Array(text.length).fill('');
      let settled = Array(text.length).fill(false);
      
      let frameCount = 0;
      const update = () => {
        if (isCancelled) return;
        frameCount++;
        let allSettled = true;
        
        for (let i=0; i<text.length; i++) {
          if (!settled[i]) {
            allSettled = false;
            if (frameCount % 3 === 0 && Math.random() < 0.15) {
              settled[i] = true;
            }
            currentArr[i] = settled[i] ? text[i] : chars[Math.floor(Math.random() * chars.length)];
          }
        }
        setDisplayedText(currentArr.join(''));
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
  
  return <span>{displayText || '...'}</span>;
};

const AudioVisualizer = () => {
  return (
    <div className="audio-visualizer">
      {[...Array(36)].map((_, i) => (
        <motion.div
          key={i}
          className="bar"
          animate={{ height: ['10px', `${20 + Math.random() * 40}px`, '10px'] }}
          transition={{ repeat: Infinity, duration: 0.5 + Math.random() * 0.5 }}
          style={{ transform: `rotate(${i * 10}deg) translateY(-40px)` }}
        />
      ))}
    </div>
  );
};

const TypewriterText = ({ 
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
          currentChars = currentChars.slice(0, -1);
          setDisplayedChars([...currentChars]);
          await new Promise(r => setTimeout(r, speed * 1000 * 4));
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
    <span className={className}>
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
      )})}
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 0.8 }}
        className="typing-cursor"
      >
        |
      </motion.span>
    </span>
  );
};

const FloatingParticles = () => (
  <div className="particles-container">
    {[...Array(15)].map((_, i) => (
      <motion.div 
        key={i} 
        className="particle"
        initial={{ 
          y: '100%', 
          x: `${Math.random() * 100}%`,
          opacity: 0,
          scale: Math.random() * 0.5 + 0.5
        }}
        animate={{ 
          y: '-20%', 
          opacity: [0, 1, 0] 
        }}
        transition={{ 
          duration: Math.random() * 2 + 2, 
          repeat: Infinity, 
          delay: Math.random() * 2,
          ease: "linear"
        }}
      />
    ))}
  </div>
);

const FloatingEmojis = () => (
  <div className="floating-emojis">
    {['🎉', '✨', '❤️', '🤝', '🙌'].map((emoji, i) => (
      <motion.div
        key={i}
        className="floating-emoji"
        initial={{ y: 0, opacity: 0, x: 0 }}
        animate={{ 
          y: -100 - Math.random() * 60, 
          opacity: [0, 1, 0],
          x: Math.random() * 60 - 30,
          rotate: Math.random() * 90 - 45,
          scale: Math.random() * 0.5 + 0.8
        }}
        transition={{ 
          duration: 2.5 + Math.random(), 
          repeat: Infinity, 
          delay: i * 0.4 
        }}
      >
        {emoji}
      </motion.div>
    ))}
  </div>
);

const FloatingKeywords = () => {
  const words = ['家務', '委屈', '期待', '壓力', '溝通', '理解'];
  return (
    <div className="floating-keywords">
      {words.map((word, i) => {
        const angle = (i / words.length) * Math.PI * 2;
        const radius = 90;
        const startX = Math.cos(angle) * radius;
        const startY = Math.sin(angle) * radius;
        
        return (
          <motion.div
            key={i}
            className="keyword-bubble"
            initial={{ x: startX, y: startY, opacity: 0, scale: 0 }}
            animate={{ 
              x: [startX, startX * 0.4, 0], 
              y: [startY, startY * 0.4, 0], 
              opacity: [0, 1, 0],
              scale: [0, 1, 0.5]
            }}
            transition={{ 
              duration: 2.5, 
              repeat: Infinity, 
              delay: i * 0.7,
              ease: "easeInOut"
            }}
          >
            {word}
          </motion.div>
        );
      })}
    </div>
  );
};

const GhostFinger = ({ progress, triggerProgress, theme = 'orange' }: { progress: number, triggerProgress: number, theme?: 'orange' | 'blue' }) => {
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
    const duration = 1200;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const p = Math.min(elapsed / duration, 1);
      
      const easeProgress = 1 - Math.pow(1 - p, 4);
      const currentVal = Math.floor(easeProgress * value);
      
      setCount(currentVal);

      if (p < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{count}%</span>;
};

const PhoneSimulator = ({ 
  role, 
  activeStep, 
  mouseX, 
  mouseY,
  progress
}: { 
  role: 'A' | 'B'; 
  activeStep: number;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  progress: number;
}) => {
  const isA = role === 'A';
  const roleName = isA ? '用戶 A' : '用戶 B';
  
  const isActiveRole = 
    (activeStep === 0 && isA) || 
    (activeStep === 1 && !isA) || 
    (activeStep >= 2);

  const defaultRotateX = isA ? 4 : 2;
  const defaultRotateY = isA ? 6 : -6;

  const dynamicRotateX = useTransform(mouseY, [-0.5, 0.5], [12 + defaultRotateX, -12 + defaultRotateX]);
  const dynamicRotateY = useTransform(mouseX, [-0.5, 0.5], [-12 + defaultRotateY, 12 + defaultRotateY]);

  const [isTypingPhase, setIsTypingPhase] = useState(true);
  useEffect(() => {
    setIsTypingPhase(true);
    const timer = setTimeout(() => setIsTypingPhase(false), 2500); 
    return () => clearTimeout(timer);
  }, [activeStep]);

  const buttonState = progress < 75 ? 'idle' : progress < 92 ? 'loading' : 'success';

  const isShaking = activeStep === 0 && !isA && progress > 64 && progress < 66;

  return (
    <motion.div 
      className={`phone-mockup role-${role.toLowerCase()} ${isActiveRole ? 'is-active-phone' : ''}`}
      style={{ rotateX: dynamicRotateX, rotateY: dynamicRotateY }}
      animate={{ 
        scale: isActiveRole ? 1 : 0.94,
        opacity: isActiveRole ? 1 : 0.7,
        filter: isActiveRole ? 'grayscale(0%)' : 'grayscale(20%)',
        x: isShaking ? [-4, 4, -4, 4, 0] : 0
      }}
      transition={{ 
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
                        發起溝通案件
                      </div>
                      <div className="form-scroll-area">
                        <div className="form-group">
                          <label>事件主題 <span className="label-tag">僅對方可見</span></label>
                          <div className={`fake-input ${isTypingPhase ? 'is-typing' : ''}`}>
                            <TypewriterText text="家務分配不均" typingDelay={0.5} speed={0.06} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>我的感受與觀點 <span className="label-tag secret">AI 將保密處理</span></label>
                          <div className={`fake-textarea ${isTypingPhase ? 'is-typing' : ''}`}>
                            <TypewriterText 
                              text="我覺得家務分配不鈞\b均，累積很多委屈，你總是忽視我的付出。" 
                              typingDelay={1.5} 
                              speed={0.05}
                              className="multiline"
                              highlightWords={['委屈', '總是', '忽視']}
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
                                發送溝通邀請 <SendOutlined />
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
                        首頁
                      </div>
                      <div className="home-empty-state glass-card">
                        <div className="empty-icon">☕️</div>
                        <p>目前沒有進行中的溝通</p>
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
                            <span>Mother Bear</span>
                          </div>
                          <span className="notif-time">剛剛</span>
                        </div>
                        <div className="notif-body">
                          <strong>用戶 A 發起了溝通邀請</strong>
                          <p>關於「家務分配不均」，請前往回覆你的視角。</p>
                        </div>
                        <div className="notif-action">點擊查看詳情</div>
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
                        案件狀態
                      </div>
                      <div className="waiting-content">
                        <motion.div
                          className="radar-animation mini"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        >
                          <div className="radar-scanner"></div>
                        </motion.div>
                        <h4 className="waiting-title">等待對方回覆</h4>
                        
                        <motion.div 
                          className="skeleton-box glass-card"
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.5 }}
                        >
                          <div className="skel-header">
                            <span className="pulse-dot-blue"></span> 對方正在輸入視角...
                          </div>
                          <div className="skel-body">
                            <motion.div className="skel-line" style={{ width: '90%' }} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} />
                            <motion.div className="skel-line" style={{ width: '75%' }} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} />
                            <motion.div className="skel-line" style={{ width: '85%' }} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} />
                          </div>
                          <div className="skel-lock">
                            <LockOutlined /> 內容已加密，雙方提交後解鎖
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  ) : (
                    <div className="scene-form">
                      <div className="app-header glass">
                        <div className="header-avatar b angry-pulse-blue">B</div>
                        回覆案件
                      </div>
                      <div className="form-scroll-area">
                        <motion.div 
                          className="info-box glass-card theme-blue"
                          initial={{ x: 20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                        >
                          <div className="info-header">
                            <span className="dot"></span> 主題：家務分配不均
                          </div>
                          <p className="text-muted">盲寫模式：在雙方皆提交前，彼此無法看到對方的內容。請安心寫下真實感受。</p>
                        </motion.div>
                        <div className="form-group mt-4">
                          <label>我的感受與觀點 <span className="label-tag secret">AI 將保密處理</span></label>
                          <div className={`fake-textarea theme-blue ${isTypingPhase ? 'is-typing' : ''}`}>
                            <TypewriterText 
                              text="我以為你只是在發牢騷\b\b\b偶爾抱怨，沒意識到你真的很在意，我工作也很累。" 
                              typingDelay={1.5} 
                              speed={0.05}
                              className="multiline"
                              highlightWords={['牢騷', '抱怨', '在意', '累']}
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
                                提交我的視角 <SendOutlined />
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
                    AI 心理師分析中
                  </div>
                  <div className="analyzing-content">
                    <div className="ai-brain-container">
                      <FloatingKeywords />
                      <AudioVisualizer />
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
                        <SyncOutlined spin className="spin-icon" /> <DecryptedText text="正在匯整雙方私密陳述..." delay={0.5} />
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 2.5 }}
                        className="analyzing-row dark-glass-card"
                      >
                        <SyncOutlined spin className="spin-icon" /> <DecryptedText text="交叉比對認知落差與盲點..." delay={2.5} />
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 4.5 }}
                        className="analyzing-row dark-glass-card"
                      >
                        <SyncOutlined spin className="spin-icon" /> <DecryptedText text="正在生成雙方專屬開解方案..." delay={4.5} />
                      </motion.div>
                    </div>
                    
                    <motion.div 
                      className="ai-safety-badge glow"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 5.5 }}
                    >
                      <CheckCircleFilled /> AI 僅提取觀點，保護雙方隱私
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
                    個別開解
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
                      <h3>心理師的反饋</h3>
                      <div className="counseling-text">
                        {isA ? (
                          <TypewriterText 
                            text="我理解你的委屈，你確實承擔了許多日常家務。但對方可能並非故意忽視，而是雙方對於『整潔標準』與『分工默契』的期待沒有對齊。"
                            typingDelay={0.8}
                            speed={0.03}
                          />
                        ) : (
                          <TypewriterText 
                            text="對方比你想像中更需要支持。當 A 開始抱怨時，往往是因為家務壓力已經累積到了臨界點，而非針對你個人的指責。"
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
                      <h4 className="ratio-title">責任與認知比例</h4>
                      <div className="ratio-row">
                        <span>你</span>
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
                        <span>對方</span>
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
                    和好方案
                  </div>
                  <div className="plan-scroll-area">
                    <motion.div 
                      className="plan-card glass-card"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", bounce: 0.4 }}
                    >
                      <div className="plan-header">
                        <h3>專屬修復任務</h3>
                        <span className="badge bounce">7 天挑戰</span>
                      </div>
                      <ul className="task-list">
                        {isA ? (
                          <>
                            <motion.li
                              className="task-item"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.8, type: "spring" }}
                            >
                              <div className="task-checkbox"><CheckCircleFilled /></div>
                              <div className="task-content">
                                <strong>溝通句型轉換</strong>
                                <span>嘗試將「你總是」改為「我希望」</span>
                              </div>
                            </motion.li>
                            <motion.li
                              className="task-item"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 1.5, type: "spring" }}
                            >
                              <div className="task-checkbox"><CheckCircleFilled /></div>
                              <div className="task-content">
                                <strong>明確需求</strong>
                                <span>具體列出最需要對方協助的 3 項家務</span>
                              </div>
                            </motion.li>
                          </>
                        ) : (
                          <>
                            <motion.li
                              className="task-item"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.8, type: "spring" }}
                            >
                              <div className="task-checkbox"><CheckCircleFilled /></div>
                              <div className="task-content">
                                <strong>主動關心</strong>
                                <span>每天主動詢問「今天有什麼我可以幫忙的嗎？」</span>
                              </div>
                            </motion.li>
                            <motion.li
                              className="task-item"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 1.5, type: "spring" }}
                            >
                              <div className="task-checkbox"><CheckCircleFilled /></div>
                              <div className="task-content">
                                <strong>分擔責任</strong>
                                <span>主惹認領並固定負責至少一項家務</span>
                              </div>
                            </motion.li>
                          </>
                        )}
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
                        <strong>對方也已收到專屬任務！</strong>
                        <span>系統將協助你們打卡追蹤，一起變好！</span>
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
        {roleName}的設備
      </div>
    </motion.div>
  );
};

const FlowSimulation = () => {
  const steps = useMemo<Step[]>(
    () => [
      {
        title: '發起溝通',
        subtitle: 'A 發起案件，B 收到邀請',
        icon: <FileTextOutlined />,
      },
      {
        title: '雙向聆聽',
        subtitle: 'B 獨立回覆視角，雙方盲寫',
        icon: <MessageOutlined />,
      },
      {
        title: '心理師分析',
        subtitle: 'AI 梳理觀點與認知落差',
        icon: <SyncOutlined />,
      },
      {
        title: '個別開解',
        subtitle: '同理雙方並提供盲點引導',
        icon: <HeartOutlined />,
      },
      {
        title: '和好行動',
        subtitle: '雙方獲得專屬修復任務',
        icon: <SolutionOutlined />,
      },
    ],
    []
  );

  const [activeStep, setActiveStep] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(0);

  // Mouse tracking for parallax
  const mouseX = useSpring(0, { stiffness: 70, damping: 20 });
  const mouseY = useSpring(0, { stiffness: 70, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let mounted = true;
    let startTime = Date.now();
    let idleStartTime = Date.now();
    let animationFrameId: number;
    
    if (isHovered) {
      setProgress(0);
      return;
    }

    const animateProgress = () => {
      if (!mounted) return;
      
      const now = Date.now();
      
      // Idle breathing for parallax
      const idleElapsed = now - idleStartTime;
      mouseX.set(Math.sin(idleElapsed / 2500) * 0.12);
      mouseY.set(Math.cos(idleElapsed / 2000) * 0.08);

      const elapsed = now - startTime;
      const currentProgress = Math.min((elapsed / AUTO_PLAY_MS) * 100, 100);
      
      setProgress(currentProgress);

      if (elapsed >= AUTO_PLAY_MS) {
        setActiveStep(prev => (prev + 1) % steps.length);
        startTime = Date.now();
        setProgress(0);
      }
      
      animationFrameId = requestAnimationFrame(animateProgress);
    };

    animationFrameId = requestAnimationFrame(animateProgress);

    return () => {
      mounted = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [steps.length, isHovered, activeStep, mouseX, mouseY]);

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
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* 科技感背景網格與漸層 SVG 定義 */}
      <svg width="0" height="0" className="svg-defs">
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff8c42" />
            <stop offset="100%" stopColor="#ff6b6b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="bg-grid"></div>
      
      {/* 裝飾性環境懸浮球, 動態顏色 */}
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
          <div className="badge-title">HOW IT WORKS</div>
          <h2 id="flow-demo-title" className="section-title">
            模擬實際使用流程
          </h2>
          <p className="flow-demo-subtitle">模擬雙方在各自設備上的真實互動，獨立輸入，專業分析</p>
        </motion.div>

        <div className="flow-demo-layout">
          {/* 左側步驟列表 */}
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
              <span className="pulse-dot"></span>
              您可以滑動滑鼠體驗3D視角，或點擊步驟自由切換
            </div>
          </div>

          {/* 右側雙手機模擬器 */}
          <div className="flow-demo-devices-wrapper">
            <PhoneSimulator role="A" activeStep={activeStep} mouseX={mouseX} mouseY={mouseY} progress={progress} />
            
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

            <PhoneSimulator role="B" activeStep={activeStep} mouseX={mouseX} mouseY={mouseY} progress={progress} />

            {/* 裝飾性背景光暈 */}
            <div className="device-glow-primary"></div>
            <div className="device-glow-secondary"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FlowSimulation;
