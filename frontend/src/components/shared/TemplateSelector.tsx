import React, { useState, useEffect } from 'react';
import { Button, useToast } from '@/components/shared';
import { getImageUrl } from '@/api/client';
import { listUserTemplates, uploadUserTemplate, type UserTemplate } from '@/api/endpoints';

const presetTemplates = [
  { id: '1', name: '简约商务', preview: '/templates/template_s.png' },
  { id: '2', name: '活力色彩', preview: '/templates/template_g.png' },
  { id: '3', name: '科技蓝', preview: '/templates/template_b.png' },
  { id: '4', name: '复古卷轴', preview: '/templates/template_y.png' }
];

interface TemplateSelectorProps {
  onSelect: (templateFile: File | null, templateId?: string) => void;
  selectedTemplateId?: string | null;
  selectedPresetTemplateId?: string | null;
  showUpload?: boolean; // 是否显示上传到用户模板库的选项
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelect,
  selectedTemplateId,
  selectedPresetTemplateId,
  showUpload = true,
}) => {
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const { show, ToastContainer } = useToast();

  // 加载用户模板列表
  useEffect(() => {
    loadUserTemplates();
  }, []);

  const loadUserTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await listUserTemplates();
      if (response.data?.templates) {
        setUserTemplates(response.data.templates);
      }
    } catch (error: any) {
      console.error('加载用户模板失败:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        if (showUpload) {
          // 上传到用户模板库
          const response = await uploadUserTemplate(file);
          if (response.data) {
            const template = response.data;
            setUserTemplates(prev => [template, ...prev]);
            onSelect(null, template.template_id);
            show({ message: '模板上传成功', type: 'success' });
          }
        } else {
          // 直接选择文件，不上传到模板库，直接调用 onSelect
          onSelect(file);
        }
      } catch (error: any) {
        console.error('上传模板失败:', error);
        show({ message: '模板上传失败: ' + (error.message || '未知错误'), type: 'error' });
      }
    }
    // 清空 input，允许重复选择同一文件
    e.target.value = '';
  };

  const handleSelectUserTemplate = async (template: UserTemplate) => {
    try {
      // 从用户模板创建 File 对象
      const imageUrl = getImageUrl(template.template_image_url);
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'template.png', { type: blob.type });
      onSelect(file, template.template_id);
    } catch (error) {
      console.error('加载模板失败:', error);
      show({ message: '加载模板失败', type: 'error' });
    }
  };

  const handleSelectPresetTemplate = async (templateId: string, preview: string) => {
    if (!preview) return;
    
    try {
      // 从 public 文件夹加载图片并转换为 File 对象
      const response = await fetch(preview);
      const blob = await response.blob();
      const file = new File([blob], preview.split('/').pop() || 'template.png', { type: blob.type });
      onSelect(file, templateId);
    } catch (error) {
      console.error('加载预设模板失败:', error);
      show({ message: '加载模板失败', type: 'error' });
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* 用户已保存的模板 */}
        {userTemplates.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">我的模板</h4>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {userTemplates.map((template) => (
                <div
                  key={template.template_id}
                  onClick={() => handleSelectUserTemplate(template)}
                  className={`aspect-[4/3] rounded-lg border-2 cursor-pointer transition-all relative overflow-hidden ${
                    selectedTemplateId === template.template_id
                      ? 'border-banana-500 ring-2 ring-banana-200'
                      : 'border-gray-200 hover:border-banana-300'
                  }`}
                >
                  <img
                    src={getImageUrl(template.template_image_url)}
                    alt={template.name || 'Template'}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {selectedTemplateId === template.template_id && (
                    <div className="absolute inset-0 bg-banana-500 bg-opacity-20 flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">已选择</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">预设模板</h4>
          <div className="grid grid-cols-4 gap-4">
            {/* 预设模板 */}
            {presetTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => template.preview && handleSelectPresetTemplate(template.id, template.preview)}
                className={`aspect-[4/3] rounded-lg border-2 cursor-pointer transition-all bg-gray-100 flex items-center justify-center relative overflow-hidden ${
                  selectedPresetTemplateId === template.id
                    ? 'border-banana-500 ring-2 ring-banana-200'
                    : 'border-gray-200 hover:border-banana-500'
                }`}
              >
                {template.preview ? (
                  <>
                    <img
                      src={template.preview}
                      alt={template.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {selectedPresetTemplateId === template.id && (
                      <div className="absolute inset-0 bg-banana-500 bg-opacity-20 flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">已选择</span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-gray-500">{template.name}</span>
                )}
              </div>
            ))}

            {/* 上传新模板 */}
            <label className="aspect-[4/3] rounded-lg border-2 border-dashed border-gray-300 hover:border-banana-500 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden">
              <span className="text-2xl">+</span>
              <span className="text-sm text-gray-500">上传模板</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleTemplateUpload}
                className="hidden"
                disabled={isLoadingTemplates}
              />
            </label>
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  );
};

