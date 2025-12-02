import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, ArrowRight, Plus } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Loading, useConfirm } from '@/components/shared';
import { OutlineCard } from '@/components/outline/OutlineCard';
import { useProjectStore } from '@/store/useProjectStore';
import type { Page } from '@/types';

// 可排序的卡片包装器
const SortableCard: React.FC<{
  page: Page;
  index: number;
  onUpdate: (data: Partial<Page>) => void;
  onDelete: () => void;
  onClick: () => void;
  isSelected: boolean;
}> = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: props.page.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <OutlineCard {...props} dragHandleProps={listeners} />
    </div>
  );
};

export const OutlineEditor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId: string }>();
  const fromHistory = (location.state as any)?.from === 'history';
  const {
    currentProject,
    syncProject,
    updatePageLocal,
    saveAllPages,
    reorderPages,
    deletePageById,
    addNewPage,
    generateOutline,
    isGlobalLoading,
  } = useProjectStore();

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  // 加载项目数据
  useEffect(() => {
    if (projectId && (!currentProject || currentProject.id !== projectId)) {
      // 直接使用 projectId 同步项目数据
      syncProject(projectId);
    }
  }, [projectId, currentProject, syncProject]);

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && currentProject) {
      const oldIndex = currentProject.pages.findIndex((p) => p.id === active.id);
      const newIndex = currentProject.pages.findIndex((p) => p.id === over.id);

      const reorderedPages = arrayMove(currentProject.pages, oldIndex, newIndex);
      reorderPages(reorderedPages.map((p) => p.id));
    }
  };

  const handleGenerateOutline = async () => {
    if (!currentProject) return;
    
    if (currentProject.pages.length > 0) {
      confirm(
        '已有大纲内容，重新生成将覆盖现有内容，确定继续吗？',
        async () => {
          try {
            await generateOutline();
            // generateOutline 内部已经调用了 syncProject，这里不需要再次调用
          } catch (error) {
            console.error('生成大纲失败:', error);
          }
        },
        { title: '确认重新生成', variant: 'warning' }
      );
      return;
    }
    
    try {
      await generateOutline();
      // generateOutline 内部已经调用了 syncProject，这里不需要再次调用
    } catch (error) {
      console.error('生成大纲失败:', error);
    }
  };

  const selectedPage = currentProject?.pages.find((p) => p.id === selectedPageId);

  if (!currentProject) {
    return <Loading fullscreen message="加载项目中..." />;
  }

  if (isGlobalLoading) {
    return <Loading fullscreen message="生成大纲中..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶栏 */}
      <header className="h-16 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={18} />}
            onClick={() => {
              if (fromHistory) {
                navigate('/history');
              } else {
                navigate('/');
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
          <span className="text-lg font-semibold">编辑大纲</span>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            size="sm" 
            icon={<Save size={18} />}
            onClick={async () => {
              await saveAllPages();
              // 可以添加成功提示，但为了简洁暂时不添加
            }}
          >
            保存
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<ArrowRight size={18} />}
            onClick={() => navigate(`/project/${projectId}/detail`)}
          >
            下一步
          </Button>
        </div>
      </header>

      {/* 上下文栏 */}
      <div className="bg-banana-50 border-b border-banana-100 px-6 py-3 max-h-32 overflow-y-auto">
        <div className="flex items-start gap-2 text-sm">
          {currentProject.creation_type === 'idea' && (
            <>
              <span className="font-medium text-gray-700 flex-shrink-0">📊 PPT构想:</span>
              <span className="text-gray-900 break-words">{currentProject.idea_prompt}</span>
            </>
          )}
          {currentProject.creation_type === 'outline' && (
            <>
              <span className="font-medium text-gray-700 flex-shrink-0">📝 大纲:</span>
              <span className="text-gray-900 break-words whitespace-pre-wrap">{currentProject.outline_text || currentProject.idea_prompt}</span>
            </>
          )}
          {currentProject.creation_type === 'descriptions' && (
            <>
              <span className="font-medium text-gray-700 flex-shrink-0">📄 描述:</span>
              <span className="text-gray-900 break-words whitespace-pre-wrap">{currentProject.description_text || currentProject.idea_prompt}</span>
            </>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex">
        {/* 左侧：大纲列表 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* 操作按钮 */}
            <div className="flex gap-3 mb-6">
              <Button
                variant="primary"
                icon={<Plus size={18} />}
                onClick={addNewPage}
              >
                添加页面
              </Button>
              {currentProject.pages.length === 0 ? (
                <Button
                  variant="secondary"
                  onClick={handleGenerateOutline}
                >
                  {currentProject.creation_type === 'outline' ? '解析大纲' : '自动生成大纲'}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={handleGenerateOutline}
                >
                  {currentProject.creation_type === 'outline' ? '重新解析大纲' : '重新生成大纲'}
                </Button>
              )}
            </div>

            {/* 大纲卡片列表 */}
            {currentProject.pages.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  还没有页面
                </h3>
                <p className="text-gray-500 mb-6">
                  点击"添加页面"手动创建，或"自动生成大纲"让 AI 帮你完成
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={currentProject.pages.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {currentProject.pages.map((page, index) => (
                      <SortableCard
                        key={page.id}
                        page={page}
                        index={index}
                        onUpdate={(data) => updatePageLocal(page.id, data)}
                        onDelete={() => deletePageById(page.id)}
                        onClick={() => setSelectedPageId(page.id)}
                        isSelected={selectedPageId === page.id}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* 右侧：预览 */}
        <div className="w-96 bg-white border-l border-gray-200 p-6 overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">预览</h3>
          
          {selectedPage ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500 mb-1">标题</div>
                <div className="text-lg font-semibold text-gray-900">
                  {selectedPage.outline_content.title}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-2">要点</div>
                <ul className="space-y-2">
                  {selectedPage.outline_content.points.map((point, idx) => (
                    <li key={idx} className="flex items-start text-gray-700">
                      <span className="mr-2 text-banana-500">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <div className="text-4xl mb-2">👆</div>
              <p>点击左侧卡片查看详情</p>
            </div>
          )}
        </div>
      </div>
      {ConfirmDialog}
    </div>
  );
};

