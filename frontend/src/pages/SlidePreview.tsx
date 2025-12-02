import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Home,
  ArrowLeft,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { Button, Loading, Modal, Textarea, useToast, useConfirm } from '@/components/shared';
import { TemplateSelector } from '@/components/shared/TemplateSelector';
import { SlideCard } from '@/components/preview/SlideCard';
import { useProjectStore } from '@/store/useProjectStore';
import { getImageUrl } from '@/api/client';
import { getPageImageVersions, setCurrentImageVersion, updateProject, uploadTemplate } from '@/api/endpoints';
import type { ImageVersion } from '@/types';

export const SlidePreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId: string }>();
  const fromHistory = (location.state as any)?.from === 'history';
  const {
    currentProject,
    syncProject,
    generateImages,
    generatePageImage,
    editPageImage,
    deletePageById,
    exportPPTX,
    exportPDF,
    isGlobalLoading,
    taskProgress,
    pageGeneratingTasks,
  } = useProjectStore();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isOutlineExpanded, setIsOutlineExpanded] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [imageVersions, setImageVersions] = useState<ImageVersion[]>([]);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedPresetTemplateId, setSelectedPresetTemplateId] = useState<string | null>(null);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [selectedContextImages, setSelectedContextImages] = useState<{
    useTemplate: boolean;
    descImageUrls: string[];
    uploadedFiles: File[];
  }>({
    useTemplate: false,
    descImageUrls: [],
    uploadedFiles: [],
  });
  const [extraRequirements, setExtraRequirements] = useState<string>('');
  const [isSavingRequirements, setIsSavingRequirements] = useState(false);
  const [isExtraRequirementsExpanded, setIsExtraRequirementsExpanded] = useState(false);
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  // 加载项目数据
  useEffect(() => {
    if (projectId && (!currentProject || currentProject.id !== projectId)) {
      // 直接使用 projectId 同步项目数据
      syncProject(projectId);
    }
  }, [projectId, currentProject, syncProject]);

  // 当项目加载后，初始化额外要求
  useEffect(() => {
    if (currentProject) {
      setExtraRequirements(currentProject.extra_requirements || '');
    }
  }, [currentProject]);

  // 加载当前页面的历史版本
  useEffect(() => {
    const loadVersions = async () => {
      if (!currentProject || !projectId || selectedIndex < 0 || selectedIndex >= currentProject.pages.length) {
        setImageVersions([]);
        setShowVersionMenu(false);
        return;
      }

      const page = currentProject.pages[selectedIndex];
      if (!page?.id) {
        setImageVersions([]);
        setShowVersionMenu(false);
        return;
      }

      try {
        const response = await getPageImageVersions(projectId, page.id);
        if (response.data?.versions) {
          setImageVersions(response.data.versions);
        }
      } catch (error) {
        console.error('Failed to load image versions:', error);
        setImageVersions([]);
      }
    };

    loadVersions();
  }, [currentProject, selectedIndex, projectId]);

  const handleGenerateAll = async () => {
    const hasImages = currentProject?.pages.some(
      (p) => p.generated_image_path
    );
    
    const executeGenerate = async () => {
      await generateImages();
    };
    
    if (hasImages) {
      confirm(
        '部分页面已有图片，重新生成将覆盖，确定继续吗？',
        executeGenerate,
        { title: '确认重新生成', variant: 'warning' }
      );
    } else {
      await executeGenerate();
    }
  };

  const handleRegeneratePage = async () => {
    if (!currentProject) return;
    const page = currentProject.pages[selectedIndex];
    if (!page.id) return;
    
    // 如果该页面正在生成，不重复提交
    if (pageGeneratingTasks[page.id]) {
      show({ message: '该页面正在生成中，请稍候...', type: 'info' });
      return;
    }
    
    // 如果已有图片，需要传递 force_regenerate=true
    const hasImage = !!page.generated_image_path;
    
    try {
      await generatePageImage(page.id, hasImage);
      show({ message: '已开始生成图片，请稍候...', type: 'success' });
    } catch (error: any) {
      // 提取后端返回的更具体错误信息
      let errorMessage = '生成失败';
      const respData = error?.response?.data;

      if (respData) {
        if (respData.error?.message) {
          errorMessage = respData.error.message;
        } else if (respData.message) {
          errorMessage = respData.message;
        } else if (respData.error) {
          errorMessage =
            typeof respData.error === 'string'
              ? respData.error
              : respData.error.message || errorMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      // 针对常见错误做更友好的提示
      if (errorMessage.includes('No template image found')) {
        errorMessage =
          '当前项目还没有模板，请先点击页面顶部的“更换模板”按钮，选择或上传一张模板图片后再生成。';
      } else if (errorMessage.includes('Page must have description content')) {
        errorMessage =
          '该页面还没有描述内容，请先在“编辑页面描述”步骤为此页生成或填写描述。';
      } else if (errorMessage.includes('Image already exists')) {
        errorMessage =
          '该页面已经有图片，如需重新生成，请在生成时选择“重新生成”或稍后重试。';
      }

      show({
        message: errorMessage,
        type: 'error',
      });
    }
  };

  const handleSwitchVersion = async (versionId: string) => {
    if (!currentProject || !selectedPage?.id || !projectId) return;
    
    try {
      await setCurrentImageVersion(projectId, selectedPage.id, versionId);
      await syncProject(projectId);
      setShowVersionMenu(false);
      show({ message: '已切换到该版本', type: 'success' });
    } catch (error: any) {
      show({ 
        message: `切换失败: ${error.message || '未知错误'}`, 
        type: 'error' 
      });
    }
  };

  // 从描述内容中提取图片URL
  const extractImageUrlsFromDescription = (descriptionContent: any): string[] => {
    if (!descriptionContent) return [];
    
    const text = descriptionContent.text || 
                 (descriptionContent.text_content?.join('\n') || '');
    
    if (!text) return [];
    
    // 匹配 markdown 图片语法: ![](url) 或 ![alt](url)
    const pattern = /!\[.*?\]\((.*?)\)/g;
    const matches = [];
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const url = match[1].trim();
      // 只保留有效的HTTP/HTTPS URL
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        matches.push(url);
      }
    }
    
    return matches;
  };

  const handleEditPage = () => {
    setEditPrompt('');
    setIsOutlineExpanded(false);
    setIsDescriptionExpanded(false);
    
    // 初始化上下文图片选择
    setSelectedContextImages({
      useTemplate: false,
      descImageUrls: [],
      uploadedFiles: [],
    });
    
    setIsEditModalOpen(true);
  };

  const handleSubmitEdit = async () => {
    if (!currentProject || !editPrompt.trim()) return;
    
    const page = currentProject.pages[selectedIndex];
    if (!page.id) return;
    
    await editPageImage(
      page.id,
      editPrompt,
      {
        useTemplate: selectedContextImages.useTemplate,
        descImageUrls: selectedContextImages.descImageUrls,
        uploadedFiles: selectedContextImages.uploadedFiles.length > 0 
          ? selectedContextImages.uploadedFiles 
          : undefined,
      }
    );
    setIsEditModalOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedContextImages((prev) => ({
      ...prev,
      uploadedFiles: [...prev.uploadedFiles, ...files],
    }));
  };

  const removeUploadedFile = (index: number) => {
    setSelectedContextImages((prev) => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles.filter((_, i) => i !== index),
    }));
  };

  const handleExport = async (type: 'pptx' | 'pdf') => {
    setShowExportMenu(false);
    if (type === 'pptx') {
      await exportPPTX();
    } else {
      await exportPDF();
    }
  };

  const handleRefresh = async () => {
    const targetProjectId = projectId || currentProject?.id;
    if (!targetProjectId) {
      show({ message: '无法刷新：缺少项目ID', type: 'error' });
      return;
    }

    setIsRefreshing(true);
    try {
      await syncProject(targetProjectId);
      show({ message: '刷新成功', type: 'success' });
    } catch (error: any) {
      show({ 
        message: error.message || '刷新失败，请稍后重试', 
        type: 'error' 
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveExtraRequirements = async () => {
    if (!currentProject || !projectId) return;
    
    setIsSavingRequirements(true);
    try {
      await updateProject(projectId, { extra_requirements: extraRequirements || '' });
      // 更新本地项目状态
      await syncProject(projectId);
      show({ message: '额外要求已保存', type: 'success' });
    } catch (error: any) {
      show({ 
        message: `保存失败: ${error.message || '未知错误'}`, 
        type: 'error' 
      });
    } finally {
      setIsSavingRequirements(false);
    }
  };

  const handleTemplateSelect = async (templateFile: File | null, templateId?: string) => {
    if (!projectId) return;
    
    // 如果传入了 templateId 但没有 templateFile，说明是用户模板，需要先获取文件
    if (templateId && !templateFile) {
      // 这种情况不应该发生，因为 handleSelectUserTemplate 会先获取文件
      return;
    }
    
    if (!templateFile) {
      // 如果没有文件也没有 ID，可能是取消选择
      return;
    }
    
    setIsUploadingTemplate(true);
    try {
      await uploadTemplate(projectId, templateFile);
      await syncProject(projectId);
      setIsTemplateModalOpen(false);
      show({ message: '模板更换成功', type: 'success' });
      
      // 更新选择状态
      if (templateId) {
        // 判断是用户模板还是预设模板
        if (templateId.startsWith('user-') || templateId.length > 10) {
          // 用户模板 ID 通常较长
          setSelectedTemplateId(templateId);
          setSelectedPresetTemplateId(null);
        } else {
          // 预设模板 ID 通常是 '1', '2', '3' 等
          setSelectedPresetTemplateId(templateId);
          setSelectedTemplateId(null);
        }
      }
    } catch (error: any) {
      show({ 
        message: `更换模板失败: ${error.message || '未知错误'}`, 
        type: 'error' 
      });
    } finally {
      setIsUploadingTemplate(false);
    }
  };

  if (!currentProject) {
    return <Loading fullscreen message="加载项目中..." />;
  }

  if (isGlobalLoading) {
    return (
      <Loading
        fullscreen
        message="生成图片中..."
        progress={taskProgress || undefined}
      />
    );
  }

  const selectedPage = currentProject.pages[selectedIndex];
  const imageUrl = selectedPage?.generated_image_path
    ? getImageUrl(selectedPage.generated_image_path, selectedPage.updated_at)
    : '';

  const hasAllImages = currentProject.pages.every(
    (p) => p.generated_image_path
  );

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* 顶栏 */}
      <header className="h-16 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            icon={<Home size={18} />}
            onClick={() => navigate('/')}
          >
            主页
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={18} />}
            onClick={() => {
              if (fromHistory) {
                navigate('/history');
              } else {
                navigate(`/project/${projectId}/detail`);
              }
            }}
          >
            返回
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍌</span>
            <span className="text-xl font-bold">蕉幻</span>
          </div>
          <span className="text-gray-400">|</span>
          <span className="text-lg font-semibold">预览</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            icon={<Upload size={18} />}
            onClick={() => setIsTemplateModalOpen(true)}
          >
            更换模板
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowLeft size={18} />}
            onClick={() => navigate(`/project/${projectId}/detail`)}
          >
            上一步
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            刷新
          </Button>
          <div className="relative">
            <Button
              variant="primary"
              size="sm"
              icon={<Download size={18} />}
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!hasAllImages}
            >
              导出
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                <button
                  onClick={() => handleExport('pptx')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  导出为 PPTX
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  导出为 PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden min-w-0 min-h-0">
        {/* 左侧：缩略图列表 */}
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-gray-200 flex-shrink-0 space-y-3">
            <Button
              variant="primary"
              icon={<Sparkles size={18} />}
              onClick={handleGenerateAll}
              className="w-full"
            >
              批量生成图片 ({currentProject.pages.length})
            </Button>
            
            {/* 额外要求 */}
            <div className="border-t border-gray-200 pt-3">
              <button
                onClick={() => setIsExtraRequirementsExpanded(!isExtraRequirementsExpanded)}
                className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                <span>额外要求</span>
                {isExtraRequirementsExpanded ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
              
              {isExtraRequirementsExpanded && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={extraRequirements}
                    onChange={(e) => setExtraRequirements(e.target.value)}
                    placeholder="例如：使用紧凑的布局，顶部展示一级大纲标题，加入更丰富的PPT插图..."
                    rows={3}
                    className="text-sm"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveExtraRequirements}
                    disabled={isSavingRequirements}
                    className="w-full"
                  >
                    {isSavingRequirements ? '保存中...' : '保存'}
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {currentProject.pages.map((page, index) => (
              <SlideCard
                key={page.id}
                page={page}
                index={index}
                isSelected={selectedIndex === index}
                onClick={() => setSelectedIndex(index)}
                onEdit={() => {
                  setSelectedIndex(index);
                  handleEditPage();
                }}
                onDelete={() => page.id && deletePageById(page.id)}
                isGenerating={page.id ? !!pageGeneratingTasks[page.id] : false}
              />
            ))}
          </div>
        </aside>

        {/* 右侧：大图预览 */}
        <main className="flex-1 flex flex-col bg-gradient-to-br from-banana-50 via-white to-gray-50 min-w-0 overflow-hidden">
          {currentProject.pages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center overflow-y-auto">
              <div className="text-center">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  还没有页面
                </h3>
                <p className="text-gray-500 mb-6">
                  请先返回编辑页面添加内容
                </p>
                <Button
                  variant="primary"
                  onClick={() => navigate(`/project/${projectId}/outline`)}
                >
                  返回编辑
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* 预览区 */}
              <div className="flex-1 overflow-y-auto min-h-0 flex items-center justify-center p-8">
                <div className="max-w-5xl w-full">
                  <div className="relative aspect-video bg-white rounded-lg shadow-xl overflow-hidden">
                    {selectedPage?.generated_image_path ? (
                      <img
                        src={imageUrl}
                        alt={`Slide ${selectedIndex + 1}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <div className="text-center">
                          <div className="text-6xl mb-4">🍌</div>
                          <p className="text-gray-500 mb-4">
                            {selectedPage?.id && pageGeneratingTasks[selectedPage.id]
                              ? '正在生成中...'
                              : selectedPage?.status === 'GENERATING'
                              ? '正在生成中...'
                              : '尚未生成图片'}
                          </p>
                          {(!selectedPage?.id || !pageGeneratingTasks[selectedPage.id]) && 
                           selectedPage?.status !== 'GENERATING' && (
                            <Button
                              variant="primary"
                              onClick={handleRegeneratePage}
                            >
                              生成此页
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 控制栏 */}
              <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                  {/* 导航 */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ChevronLeft size={18} />}
                      onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                      disabled={selectedIndex === 0}
                    >
                      上一页
                    </Button>
                    <span className="px-4 text-sm text-gray-600">
                      {selectedIndex + 1} / {currentProject.pages.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ChevronRight size={18} />}
                      onClick={() =>
                        setSelectedIndex(
                          Math.min(currentProject.pages.length - 1, selectedIndex + 1)
                        )
                      }
                      disabled={selectedIndex === currentProject.pages.length - 1}
                    >
                      下一页
                    </Button>
                  </div>

                  {/* 操作 */}
                  <div className="flex items-center gap-2">
                    {imageVersions.length > 1 && (
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowVersionMenu(!showVersionMenu)}
                        >
                          历史版本 ({imageVersions.length})
                        </Button>
                        {showVersionMenu && (
                          <div className="absolute right-0 bottom-full mb-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20 max-h-96 overflow-y-auto">
                            {imageVersions.map((version) => (
                              <button
                                key={version.version_id}
                                onClick={() => handleSwitchVersion(version.version_id)}
                                className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center justify-between ${
                                  version.is_current ? 'bg-banana-50' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">
                                    版本 {version.version_number}
                                  </span>
                                  {version.is_current && (
                                    <span className="text-xs text-banana-600 font-medium">
                                      (当前)
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400">
                                  {version.created_at
                                    ? new Date(version.created_at).toLocaleString('zh-CN', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : ''}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleEditPage}
                      disabled={!selectedPage?.generated_image_path}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRegeneratePage}
                      disabled={selectedPage?.id && pageGeneratingTasks[selectedPage.id] ? true : false}
                    >
                      {selectedPage?.id && pageGeneratingTasks[selectedPage.id]
                        ? '生成中...'
                        : '重新生成'}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* 编辑对话框 */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="编辑页面"
        size="lg"
      >
        <div className="space-y-4">
          {/* 图片 */}
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Current slide"
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* 大纲内容 - 可折叠 */}
          {selectedPage?.outline_content && (
            <div className="bg-gray-50 rounded-lg border border-gray-200">
              <button
                onClick={() => setIsOutlineExpanded(!isOutlineExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <h4 className="text-sm font-semibold text-gray-700">页面大纲</h4>
                {isOutlineExpanded ? (
                  <ChevronUp size={18} className="text-gray-500" />
                ) : (
                  <ChevronDown size={18} className="text-gray-500" />
                )}
              </button>
              {isOutlineExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  <div className="text-sm font-medium text-gray-900">
                    {selectedPage.outline_content.title}
                  </div>
                  {selectedPage.outline_content.points && selectedPage.outline_content.points.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                      {selectedPage.outline_content.points.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 描述内容 - 可折叠 */}
          {selectedPage?.description_content && (
            <div className="bg-blue-50 rounded-lg border border-blue-200">
              <button
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors"
              >
                <h4 className="text-sm font-semibold text-gray-700">页面描述</h4>
                {isDescriptionExpanded ? (
                  <ChevronUp size={18} className="text-gray-500" />
                ) : (
                  <ChevronDown size={18} className="text-gray-500" />
                )}
              </button>
              {isDescriptionExpanded && (
                <div className="px-4 pb-4">
                  <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {(selectedPage.description_content as any)?.text || 
                     (selectedPage.description_content as any)?.text_content?.join('\n') || 
                     '暂无描述'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 上下文图片选择 */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">选择上下文图片（可选）</h4>
            
            {/* Template图片选择 */}
            {currentProject?.template_image_path && (
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="use-template"
                  checked={selectedContextImages.useTemplate}
                  onChange={(e) =>
                    setSelectedContextImages((prev) => ({
                      ...prev,
                      useTemplate: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 text-banana-600 rounded focus:ring-banana-500"
                />
                <label htmlFor="use-template" className="flex items-center gap-2 cursor-pointer">
                  <ImageIcon size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-700">使用模板图片</span>
                  {currentProject.template_image_path && (
                    <img
                      src={getImageUrl(currentProject.template_image_path, currentProject.updated_at)}
                      alt="Template"
                      className="w-16 h-10 object-cover rounded border border-gray-300"
                    />
                  )}
                </label>
              </div>
            )}

            {/* Desc中的图片 */}
            {selectedPage?.description_content && (() => {
              const descImageUrls = extractImageUrlsFromDescription(selectedPage.description_content);
              return descImageUrls.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">描述中的图片：</label>
                  <div className="grid grid-cols-3 gap-2">
                    {descImageUrls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={url}
                          alt={`Desc image ${idx + 1}`}
                          className="w-full h-20 object-cover rounded border-2 border-gray-300 cursor-pointer transition-all"
                          style={{
                            borderColor: selectedContextImages.descImageUrls.includes(url)
                              ? '#f59e0b'
                              : '#d1d5db',
                          }}
                          onClick={() => {
                            setSelectedContextImages((prev) => {
                              const isSelected = prev.descImageUrls.includes(url);
                              return {
                                ...prev,
                                descImageUrls: isSelected
                                  ? prev.descImageUrls.filter((u) => u !== url)
                                  : [...prev.descImageUrls, url],
                              };
                            });
                          }}
                        />
                        {selectedContextImages.descImageUrls.includes(url) && (
                          <div className="absolute inset-0 bg-banana-500/20 border-2 border-banana-500 rounded flex items-center justify-center">
                            <div className="w-6 h-6 bg-banana-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">✓</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* 上传图片 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">上传图片：</label>
              <div className="flex flex-wrap gap-2">
                {selectedContextImages.uploadedFiles.map((file, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Uploaded ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded border border-gray-300"
                    />
                    <button
                      onClick={() => removeUploadedFile(idx)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:border-banana-500 transition-colors">
                  <Upload size={20} className="text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">上传</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* 编辑框 */}
          <Textarea
            label="输入修改指令(将自动添加页面描述)"
            placeholder="例如：把背景改成蓝色、增大标题字号、更改文本框样式为虚线..."
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            rows={4}
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitEdit}
              disabled={!editPrompt.trim()}
            >
              生成
            </Button>
          </div>
        </div>
      </Modal>
      <ToastContainer />
      {ConfirmDialog}
      
      {/* 模板选择 Modal */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="更换模板"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            选择一个新的模板将应用到所有页面的图片生成。你可以选择预设模板、已有模板或上传新模板。
          </p>
          <TemplateSelector
            onSelect={handleTemplateSelect}
            selectedTemplateId={selectedTemplateId}
            selectedPresetTemplateId={selectedPresetTemplateId}
            showUpload={false} // 在预览页面上传的模板直接应用到项目，不上传到用户模板库
          />
          {isUploadingTemplate && (
            <div className="text-center py-2 text-sm text-gray-500">
              正在上传模板...
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="ghost"
              onClick={() => setIsTemplateModalOpen(false)}
              disabled={isUploadingTemplate}
            >
              关闭
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

