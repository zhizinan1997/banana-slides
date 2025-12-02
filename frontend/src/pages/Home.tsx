import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, FileText, FileEdit } from 'lucide-react';
import { Button, Textarea, Card, useToast } from '@/components/shared';
import { TemplateSelector } from '@/components/shared/TemplateSelector';
import { useProjectStore } from '@/store/useProjectStore';

type CreationType = 'idea' | 'outline' | 'description';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { initializeProject, isGlobalLoading } = useProjectStore();
  const { show, ToastContainer } = useToast();
  
  const [activeTab, setActiveTab] = useState<CreationType>('idea');
  const [content, setContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedPresetTemplateId, setSelectedPresetTemplateId] = useState<string | null>(null);

  const tabConfig = {
    idea: {
      icon: <Sparkles size={20} />,
      label: '一句话生成',
      placeholder: '例如：生成一份关于 AI 发展史的演讲 PPT',
      description: '输入你的想法，AI 将为你生成完整的 PPT',
    },
    outline: {
      icon: <FileText size={20} />,
      label: '从大纲生成',
      placeholder: '粘贴你的 PPT 大纲...\n\n例如：\n第一部分：AI 的起源\n- 1950 年代的开端\n- 达特茅斯会议\n\n第二部分：发展历程\n...',
      description: '已有大纲？直接粘贴即可快速生成，AI 将自动切分为结构化大纲',
    },
    description: {
      icon: <FileEdit size={20} />,
      label: '从描述生成',
      placeholder: '粘贴你的完整页面描述...\n\n例如：\n第 1 页\n标题：人工智能的诞生\n内容：1950 年，图灵提出"图灵测试"...\n\n第 2 页\n标题：AI 的发展历程\n内容：1950年代：符号主义...\n...',
      description: '已有完整描述？AI 将自动解析出大纲并切分为每页描述，直接生成图片',
    },
  };

  const handleTemplateSelect = async (templateFile: File | null, templateId?: string) => {
    // 总是设置文件（如果提供）
    if (templateFile) {
      setSelectedTemplate(templateFile);
    }
    
    // 处理模板 ID
    if (templateId) {
      // 判断是用户模板还是预设模板
      // 预设模板 ID 通常是 '1', '2', '3' 等短字符串
      // 用户模板 ID 通常较长（UUID 格式）
      if (templateId.length <= 3 && /^\d+$/.test(templateId)) {
        // 预设模板
        setSelectedPresetTemplateId(templateId);
        setSelectedTemplateId(null);
      } else {
        // 用户模板
        setSelectedTemplateId(templateId);
        setSelectedPresetTemplateId(null);
      }
    } else {
      // 如果没有 templateId，可能是直接上传的文件
      // 清空所有选择状态
      setSelectedTemplateId(null);
      setSelectedPresetTemplateId(null);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      show({ message: '请输入内容', type: 'error' });
      return;
    }

    try {
      // TemplateSelector 已经处理了模板选择，selectedTemplate 应该已经包含文件
      await initializeProject(activeTab, content, selectedTemplate || undefined);
      
      // 根据类型跳转到不同页面
      const projectId = localStorage.getItem('currentProjectId');
      if (!projectId) {
        show({ message: '项目创建失败', type: 'error' });
        return;
      }
      
      if (activeTab === 'idea' || activeTab === 'outline') {
        navigate(`/project/${projectId}/outline`);
      } else if (activeTab === 'description') {
        // 从描述生成：直接跳到描述生成页（因为已经自动生成了大纲和描述）
        navigate(`/project/${projectId}/detail`);
      }
    } catch (error: any) {
      console.error('创建项目失败:', error);
      // 错误已经在 store 中处理并显示
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-banana-50 via-white to-gray-50">
      {/* 导航栏 */}
      <nav className="h-16 bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/logo.jpg"
              alt="蕉幻 Banana Slides Logo"
              className="w-12 h-12 rounded-lg object-cover object-center"
            />
            <span className="text-xl font-bold text-gray-900">蕉幻</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
              历史项目
            </Button>
            <Button variant="ghost" size="sm">帮助</Button>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        {/* 标题区 */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            🍌 蕉幻 Banana Slides
          </h1>
          <p className="text-xl text-gray-600">
            AI 原生 PPT 生成器，一句话创造精彩
          </p>
        </div>

        {/* 创建卡片 */}
        <Card className="p-10">
          {/* 选项卡 */}
          <div className="flex gap-4 mb-8">
            {(Object.keys(tabConfig) as CreationType[]).map((type) => {
              const config = tabConfig[type];
              return (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                    activeTab === type
                      ? 'bg-gradient-to-r from-banana-500 to-banana-600 text-black shadow-yellow'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-banana-50'
                  }`}
                >
                  {config.icon}
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* 描述 */}
          <p className="text-gray-600 mb-6">
            {tabConfig[activeTab].description}
          </p>

          {/* 输入区 */}
          <Textarea
            placeholder={tabConfig[activeTab].placeholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={activeTab === 'idea' ? 4 : 10}
            className="mb-6"
          />

          {/* 模板选择 */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🎨 选择风格模板
            </h3>
            <TemplateSelector
              onSelect={handleTemplateSelect}
              selectedTemplateId={selectedTemplateId}
              selectedPresetTemplateId={selectedPresetTemplateId}
              showUpload={true} // 在主页上传的模板保存到用户模板库
            />
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleSubmit}
              loading={isGlobalLoading}
              className="w-64"
            >
              开始生成
            </Button>
          </div>
        </Card>
      </main>
      <ToastContainer />
    </div>
  );
};

