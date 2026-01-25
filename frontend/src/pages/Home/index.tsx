/**
 * 首頁 - 優化版
 */

import { useMemo } from 'react';
import { Button, Card, Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import { RocketOutlined, HeartOutlined, BulbOutlined, CheckCircleOutlined } from '@ant-design/icons';
import BearJudge from '@/components/business/BearJudge';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import './Home.less';

const Home = () => {
  const navigate = useNavigate();

  const handleQuickStart = () => {
    navigate('/quick-experience/create');
  };

  // 功能卡片數據
  const features = useMemo(
    () => [
      {
        icon: <RocketOutlined />,
        title: '快速體驗',
        description: '無需註冊，立即獲得判決',
        ariaLabel: '快速體驗功能，無需註冊即可使用',
      },
      {
        icon: <BulbOutlined />,
        title: 'AI智能判決',
        description: '公正、溫暖的第三方判決',
        ariaLabel: 'AI智能判決功能，提供公正溫暖的判決',
      },
      {
        icon: <HeartOutlined />,
        title: '和好方案',
        description: '促進關係修復的互動建議',
        ariaLabel: '和好方案功能，提供關係修復建議',
      },
      {
        icon: <CheckCircleOutlined />,
        title: '執行追蹤',
        description: '追蹤和好方案執行情況',
        ariaLabel: '執行追蹤功能，追蹤和好方案執行進度',
      },
    ],
    []
  );

  // 流程步驟數據
  const processSteps = useMemo(
    () => [
      { number: 1, title: '填寫雙方陳述', description: '詳細描述衝突情況' },
      { number: 2, title: 'AI自動分析', description: '智能識別案件類型' },
      { number: 3, title: '獲得判決結果', description: '公正的責任分比例' },
      { number: 4, title: '生成和好方案', description: '個性化的修復建議' },
    ],
    []
  );

  return (
    <>
      <SEO
        title="首頁"
        description="熊媽媽法庭 - 大愛、包容、保護、呵護，為您的關係提供公正溫暖的判決。"
        keywords="情侶衝突,關係修復,AI判決,和好方案"
      />
      <div className="home-page">
        {/* 跳過鏈接（可訪問性） */}
        <a href="#main-content" className="skip-link">
          跳過到主要內容
        </a>

        {/* Hero區域 */}
        <section className="hero-section" aria-label="歡迎區域">
          <div className="hero-content">
            <AnimatedWrapper animation="fade" delay={100} className="hero-image">
              <BearJudge size="large" animated />
            </AnimatedWrapper>
            <AnimatedWrapper animation="slide" direction="right" delay={200} className="hero-text">
              <h1 className="hero-title">即使在法庭，我也會保護和呵護你們兩位</h1>
              <p className="hero-subtitle">溫暖、公正、專業的情侶衝突解決平台</p>
              <div className="hero-actions" role="group" aria-label="主要操作按鈕">
                <Button
                  type="primary"
                  size="large"
                  icon={<RocketOutlined />}
                  onClick={handleQuickStart}
                  className="primary-button"
                  aria-label="立即開始快速體驗"
                >
                  立即開始
                </Button>
                <Button
                  size="large"
                  onClick={() => navigate('/auth/register')}
                  aria-label="了解更多關於熊媽媽法庭"
                >
                  了解更多
                </Button>
              </div>
            </AnimatedWrapper>
          </div>
        </section>

        {/* 核心功能展示區 */}
        <section id="main-content" className="features-section" aria-labelledby="features-title">
          <div className="container">
            <AnimatedWrapper animation="fade" trigger="intersection">
              <h2 id="features-title" className="section-title">
                核心功能
              </h2>
            </AnimatedWrapper>
            <Row gutter={[24, 24]}>
              {features.map((feature, index) => (
                <Col xs={24} sm={12} md={6} key={index}>
                  <AnimatedWrapper
                    animation="slide"
                    direction="up"
                    delay={index * 100}
                    trigger="intersection"
                  >
                    <Card
                      className="feature-card"
                      aria-label={feature.ariaLabel}
                      tabIndex={0}
                      role="article"
                    >
                      <div className="feature-icon" aria-hidden="true">
                        {feature.icon}
                      </div>
                      <h3>{feature.title}</h3>
                      <p>{feature.description}</p>
                    </Card>
                  </AnimatedWrapper>
                </Col>
              ))}
            </Row>
          </div>
        </section>

        {/* 使用流程展示 */}
        <section className="process-section" aria-labelledby="process-title">
          <div className="container">
            <AnimatedWrapper animation="fade" trigger="intersection">
              <h2 id="process-title" className="section-title">
                使用流程
              </h2>
            </AnimatedWrapper>
            <Row gutter={[24, 24]}>
              {processSteps.map((step, index) => (
                <Col xs={24} sm={12} md={6} key={step.number}>
                  <AnimatedWrapper
                    animation="slide"
                    direction="up"
                    delay={index * 100}
                    trigger="intersection"
                  >
                    <div className="process-step" role="article" aria-label={`步驟${step.number}: ${step.title}`}>
                      <div className="step-number" aria-hidden="true">
                        {step.number}
                      </div>
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                    </div>
                  </AnimatedWrapper>
                </Col>
              ))}
            </Row>
          </div>
        </section>
      </div>
    </>
  );
};

export default Home;

