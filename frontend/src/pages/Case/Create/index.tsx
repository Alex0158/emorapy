/**
 * 完整模式案件創建頁面
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Form,
  Input,
  Select,
  Space,
  Typography,
  message,
  Alert,
  Radio,
} from 'antd';
import {
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useCaseStore } from '@/store/caseStore';
import { getPairingStatus } from '@/services/api/pairing';
import { createCase } from '@/services/api/case';
import { validateStatement } from '@/utils/validate';
import BearJudge from '@/components/business/BearJudge';
import StatementInput from '@/components/business/StatementInput';
import FileUpload from '@/components/business/FileUpload';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import './Create.less';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const CaseCreate = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { isLoading } = useCaseStore();
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [pairingStatus, setPairingStatus] = useState<'pending' | 'active' | null>(null);
  const [plaintiffStatement, setPlaintiffStatement] = useState('');
  const [defendantStatement, setDefendantStatement] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<any[]>([]);
  const [mode, setMode] = useState<'remote' | 'collaborative'>('remote');

  // 檢查配對狀態
  useEffect(() => {
    const checkPairing = async () => {
      try {
        const pairing = await getPairingStatus();
        if (pairing && pairing.status === 'active') {
          setPairingId(pairing.id);
          setPairingStatus('active');
        } else {
          setPairingStatus('pending');
        }
      } catch (error) {
        setPairingStatus('pending');
      }
    };
    checkPairing();
  }, []);

  // 驗證陳述
  const plaintiffValid = validateStatement(plaintiffStatement).valid;
  const defendantValid = validateStatement(defendantStatement).valid;
  const canSubmit = plaintiffValid && defendantValid && pairingStatus === 'active';

  const handleSubmit = async (values: any) => {
    if (!pairingId) {
      message.error('請先完成配對');
      navigate('/profile/pairing');
      return;
    }

    if (!canSubmit) {
      message.warning('請完成雙方陳述後再提交');
      return;
    }

    try {
      const caseData = {
        pairing_id: pairingId,
        title: values.title || '未命名案件',
        type: values.type || '其他',
        sub_type: values.sub_type,
        plaintiff_statement: plaintiffStatement,
        defendant_statement: defendantStatement,
        evidence_urls: [], // 證據將在案件創建後上傳
      };

      const newCase = await createCase(caseData);
      message.success('案件創建成功！');

      // 如果有證據文件，上傳證據
      const filesToUpload = evidenceFiles
        .filter((f: any) => f.originFileObj)
        .map((f: any) => f.originFileObj as File);

      if (filesToUpload.length > 0) {
        try {
          const { uploadEvidence } = await import('@/services/api/case');
          await uploadEvidence(newCase.id, filesToUpload);
          message.success('證據上傳成功');
        } catch (uploadError: any) {
          // 證據上傳失敗不阻止流程，只提示
          message.warning(uploadError.message || '證據上傳失敗，但案件已創建');
        }
      }

      navigate(`/case/${newCase.id}`);
    } catch (error: any) {
      message.error(error.message || '創建案件失敗');
    }
  };

  if (pairingStatus === 'pending') {
    return (
      <ProtectedRoute>
        <div className="case-create-page">
          <Card>
            <Alert
              message="需要配對"
              description="創建案件需要先完成配對。請先與您的伴侶完成配對。"
              type="warning"
              showIcon
              action={
                <Button type="primary" onClick={() => navigate('/profile/pairing')}>
                  前往配對
                </Button>
              }
            />
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title="創建案件 - 熊媽媽法庭"
        description="創建新案件，開始您的審理流程"
        keywords="創建案件,案件提交"
      />
      <div className="case-create-page" role="main" aria-label="創建案件頁面">
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" aria-labelledby="create-title">
            <BearJudge size="medium" animated />
            <Title level={2} id="create-title">創建新案件</Title>
            <Paragraph type="secondary">請詳細填寫案件信息，我們會公正、溫暖地幫助你們解決問題。</Paragraph>
          </div>
        </AnimatedWrapper>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="case-create-form"
          aria-label="創建案件表單"
        >
          <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
            <Card title="基本信息" className="form-section">
            <Form.Item
              name="title"
              label="案件標題"
              rules={[{ required: true, message: '請輸入案件標題' }]}
            >
              <Input placeholder="請簡要描述案件（如：關於家務分工的爭議）" maxLength={200} />
            </Form.Item>

            <Form.Item
              name="type"
              label="案件類型"
              rules={[{ required: true, message: '請選擇案件類型' }]}
            >
              <Select placeholder="請選擇案件類型（AI也會自動識別）">
                <Option value="生活習慣">生活習慣</Option>
                <Option value="消費決策">消費決策</Option>
                <Option value="社交關係">社交關係</Option>
                <Option value="價值觀">價值觀</Option>
                <Option value="情感需求">情感需求</Option>
                <Option value="其他">其他</Option>
              </Select>
            </Form.Item>

            <Form.Item name="sub_type" label="子類型（可選）">
              <Input placeholder="如：家務分工、作息時間等" />
            </Form.Item>

            <Form.Item
              name="mode"
              label="審理模式"
              initialValue="remote"
            >
              <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
                <Radio value="remote">遠程審理模式（異地戀模式）</Radio>
                <Radio value="collaborative">協同審理模式（面對面模式）</Radio>
              </Radio.Group>
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                <InfoCircleOutlined /> 遠程模式：各自獨立操作；協同模式：同一介面實時同步
              </Text>
            </Form.Item>
            </Card>
          </AnimatedWrapper>

          <AnimatedWrapper animation="slide" direction="up" delay={250} trigger="intersection">
            <Card title="雙方陳述" className="form-section">
            <div className="statements-section">
              <div className="statement-item">
                <Title level={4}>原告陳述</Title>
                <StatementInput
                  value={plaintiffStatement}
                  onChange={setPlaintiffStatement}
                  placeholder="請詳細描述發生了什麼事，你的感受，以及你希望對方怎麼做..."
                />
              </div>

              <div className="statement-item">
                <Title level={4}>被告陳述</Title>
                <StatementInput
                  value={defendantStatement}
                  onChange={setDefendantStatement}
                  placeholder="請詳細描述你的觀點和感受..."
                />
              </div>
            </div>
            </Card>
          </AnimatedWrapper>

          <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
            <Card
              title="證據上傳（可選）"
              className="form-section"
              extra={<Text type="secondary">最多3張圖片或1個視頻，單個文件不超過5MB</Text>}
            >
            <FileUpload
              value={evidenceFiles}
              onChange={setEvidenceFiles}
              maxCount={3}
            />
            </Card>
          </AnimatedWrapper>

          <AnimatedWrapper animation="slide" direction="up" delay={350} trigger="intersection">
            <div className="submit-section">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={isLoading}
                disabled={!canSubmit}
              >
                {isLoading ? '創建中...' : '創建案件'}
              </Button>
              <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
                創建後，您可以選擇提交案件開始審理流程
              </Text>
            </Space>
            </div>
          </AnimatedWrapper>
        </Form>
      </div>
    </ProtectedRoute>
  );
};

export default CaseCreate;

