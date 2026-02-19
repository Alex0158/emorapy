import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleFilled,
  FileTextOutlined,
  HeartOutlined,
  MessageOutlined,
  SolutionOutlined,
  SyncOutlined,
  SendOutlined,
} from '@ant-design/icons';
import './FlowSimulation.less';

type Step = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
};

// 放慢播放速度，讓用戶有足夠時間閱讀與欣賞打字特效
const AUTO_PLAY_MS = 8000;

const TypewriterText = ({ 
  text, 
  delay = 0, 
  speed = 0.04, 
  className = '' 
}: { 
  text: string; 
  delay?: number; 
  speed?: number; 
  className?: string 
}) => {
  const characters = text.split('');
  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: { staggerChildren: speed, delayChildren: delay }
        }
      }}
    >
      {characters.map((char, index) => (
        <motion.span
          key={index}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1 }
          }}
        >
          {char}
        </motion.span>
      ))}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: delay + characters.length * speed }}
        className="typing-cursor"
      >
        |
      </motion.span>
    </motion.span>
  );
};

const PhoneSimulator = ({ role, activeStep }: { role: 'A' | 'B'; activeStep: number }) => {
  const isA = role === 'A';
  const roleName = isA ? '用戶 A' : '用戶 B';

  return (
    <div className={`phone-mockup role-${role.toLowerCase()}`}>
      <div className="phone-frame">
        <div className="phone-notch">
          <div className="camera-lens"></div>
          <div className="speaker"></div>
        </div>
        <div className="phone-screen">
          <div className="screen-topbar">
            <span className="time">9:41</span>
            <div className="right-icons">
              <div className="signal-icon"></div>
              <div className="wifi-icon"></div>
              <div className="battery-icon"></div>
            </div>
          </div>

          <div className="screen-content">
            <AnimatePresence mode="wait">
              {activeStep === 0 && (
                <motion.div
                  key="step0"
                  className="scene"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {isA ? (
                    <div className="scene-form">
                      <div className="app-header glass">發起溝通案件</div>
                      <div className="form-scroll-area">
                        <div className="form-group">
                          <label>事件主題 <span className="label-tag">僅對方可見</span></label>
                          <div className="fake-input">
                            <TypewriterText text="家務分配不均" delay={0.5} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>我的感受與觀點 <span className="label-tag secret">AI 將保密處理</span></label>
                          <div className="fake-textarea">
                            <TypewriterText 
                              text="我覺得家務分配不平衡，累積很多委屈，你總是忽視我的付出。" 
                              delay={1.5} 
                              speed={0.05}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="scene-actions glass-bottom">
                        <motion.button 
                          className="btn-primary"
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 4.5, type: 'spring' }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          發送溝通邀請 <SendOutlined />
                        </motion.button>
                      </div>
                    </div>
                  ) : (
                    <div className="scene-home wallpaper-bg">
                      <div className="app-header glass">首頁</div>
                      <div className="home-empty-state glass-card">
                        <div className="empty-icon">☕️</div>
                        <p>目前沒有進行中的溝通</p>
                      </div>
                      <motion.div 
                        className="notification-card glass-card pop-in"
                        initial={{ y: -60, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        transition={{ delay: 5.0, type: 'spring', bounce: 0.6 }}
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {isA ? (
                    <div className="scene-waiting gradient-bg">
                      <div className="app-header glass">案件狀態</div>
                      <div className="waiting-content">
                        <motion.div
                          className="radar-animation"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        >
                          <div className="radar-scanner"></div>
                        </motion.div>
                        <h4 className="waiting-title">已發送邀請</h4>
                        <p className="waiting-subtitle">正在等待 用戶 B 填寫他的視角與感受...</p>
                        <motion.div 
                          className="waiting-hint glass-card"
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.5 }}
                        >
                          <div className="hint-icon">🔒</div>
                          <div>這段時間，對方只能看到事件主題，無法看到你的具體陳述。</div>
                        </motion.div>
                      </div>
                    </div>
                  ) : (
                    <div className="scene-form">
                      <div className="app-header glass">回覆案件</div>
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
                          <div className="fake-textarea">
                            <TypewriterText 
                              text="我以為你只是偶爾抱怨，沒意識到你真的很在意，我工作也很累。" 
                              delay={1.0} 
                              speed={0.05}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="scene-actions glass-bottom">
                        <motion.button 
                          className="btn-primary"
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 3.5, type: 'spring' }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          提交我的視角 <SendOutlined />
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="app-header dark-glass">AI 心理師分析中</div>
                  <div className="analyzing-content">
                    <div className="ai-brain-container">
                      <motion.div 
                        className="ai-brain-core"
                        animate={{ 
                          scale: [1, 1.2, 1],
                          boxShadow: [
                            "0 0 20px rgba(255,140,66,0.3)",
                            "0 0 60px rgba(255,140,66,0.6)",
                            "0 0 20px rgba(255,140,66,0.3)"
                          ]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
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
                        <SyncOutlined spin className="spin-icon" /> 正在匯整雙方私密陳述...
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 2.0 }}
                        className="analyzing-row dark-glass-card"
                      >
                        <SyncOutlined spin className="spin-icon" /> 交叉比對認知落差與盲點...
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 3.5 }}
                        className="analyzing-row dark-glass-card"
                      >
                        <SyncOutlined spin className="spin-icon" /> 正在生成雙方專屬開解方案...
                      </motion.div>
                    </div>
                    
                    <motion.div 
                      className="ai-safety-badge glow"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 4.5 }}
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
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="app-header glass">個別開解</div>
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
                            delay={0.8}
                            speed={0.03}
                          />
                        ) : (
                          <TypewriterText 
                            text="對方比你想像中更需要支持。當 A 開始抱怨時，往往是因為家務壓力已經累積到了臨界點，而非針對你個人的指責。"
                            delay={0.8}
                            speed={0.03}
                          />
                        )}
                      </div>
                    </motion.div>

                    <motion.div 
                      className="ratio-container glass-card"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 3.5 }}
                    >
                      <h4 className="ratio-title">責任與認知比例</h4>
                      <div className="ratio-row">
                        <span>你</span>
                        <div className="ratio-bar-bg">
                          <motion.div
                            className="ratio-bar-fill fill-me gradient-bar"
                            initial={{ width: 0 }}
                            animate={{ width: isA ? '40%' : '60%' }}
                            transition={{ delay: 4.0, duration: 1.2, type: "spring", bounce: 0.3 }}
                          >
                            <span className="ratio-value">{isA ? '40%' : '60%'}</span>
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
                            transition={{ delay: 4.2, duration: 1.2, type: "spring", bounce: 0.3 }}
                          >
                            <span className="ratio-value">{isA ? '60%' : '40%'}</span>
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="app-header glass">和好方案</div>
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
                              transition={{ delay: 0.6, type: "spring" }}
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
                              transition={{ delay: 1.2, type: "spring" }}
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
                              transition={{ delay: 0.6, type: "spring" }}
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
                              transition={{ delay: 1.2, type: "spring" }}
                            >
                              <div className="task-checkbox"><CheckCircleFilled /></div>
                              <div className="task-content">
                                <strong>分擔責任</strong>
                                <span>主動認領並固定負責至少一項家務</span>
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
                      transition={{ delay: 2.5, type: "spring" }}
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
    </div>
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let mounted = true;
    let startTime = Date.now();
    let animationFrameId: number;
    
    if (isHovered) {
      setProgress(0);
      return;
    }

    const animateProgress = () => {
      if (!mounted) return;
      
      const now = Date.now();
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
  }, [steps.length, isHovered, activeStep]);

  return (
    <section 
      id="main-content" 
      className="flow-demo-section-v3" 
      aria-labelledby="flow-demo-title"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 科技感背景網格 */}
      <div className="bg-grid"></div>
      
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
              {steps.map((step, index) => {
                const isActive = index === activeStep;
                const isCompleted = index < activeStep;
                return (
                  <motion.li
                    key={step.title}
                    className={`flow-demo-step ${isActive ? 'is-active' : ''} ${isCompleted ? 'is-completed' : ''}`}
                    animate={{
                      x: isActive ? 10 : 0,
                      opacity: isActive || isCompleted ? 1 : 0.5,
                    }}
                    transition={{ duration: 0.4, type: "spring" }}
                    onClick={() => {
                      setActiveStep(index);
                      setProgress(0);
                    }}
                  >
                    <div className="step-content">
                      <div className="step-icon-wrapper">
                        {isActive && (
                          <motion.div
                            layoutId="active-step-glow"
                            className="step-active-glow"
                            initial={false}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          />
                        )}
                        <span className="step-icon" aria-hidden="true">
                          {isCompleted ? <CheckCircleFilled /> : step.icon}
                        </span>
                      </div>
                      <div className="step-text">
                        <strong>{step.title}</strong>
                        <span>{step.subtitle}</span>
                      </div>
                    </div>
                    {/* 活躍狀態的進度條 */}
                    {isActive && !isHovered && (
                      <div className="step-progress-bar">
                        <motion.div 
                          className="progress-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </motion.li>
                );
              })}
            </ol>
            <div className="interactive-hint">
              <span className="pulse-dot"></span>
              您可以點擊步驟自由切換，或懸停暫停播放
            </div>
          </div>

          {/* 右側雙手機模擬器 */}
          <div className="flow-demo-devices-wrapper">
            <PhoneSimulator role="A" activeStep={activeStep} />
            <div className="devices-divider">
              <div className="divider-line"></div>
              <div className="divider-icon"><SyncOutlined /></div>
              <div className="divider-line"></div>
            </div>
            <PhoneSimulator role="B" activeStep={activeStep} />

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
