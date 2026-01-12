import { useState, useEffect, useCallback } from 'react';
import { X, Download, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { Markdown } from './Markdown';

interface UpdateInfo {
    hasUpdate: boolean;
    currentVersion?: string;
    latestVersion?: string;
    releaseNotes?: string;
    releaseName?: string;
    publishedAt?: string;
    downloadUrl?: string;
    releasePageUrl?: string;
    error?: string;
}

interface UpdateCheckerProps {
    /** 是否自动检查更新（默认 true） */
    autoCheck?: boolean;
    /** 检查间隔（毫秒），默认 1 小时 */
    checkInterval?: number;
}

// Electron API 类型扩展
declare global {
    interface Window {
        electronAPI?: {
            isElectron: boolean;
            checkForUpdates: () => Promise<UpdateInfo>;
            openDownloadPage: (url: string) => Promise<boolean>;
            openReleasesPage: () => Promise<boolean>;
            getAppVersion: () => Promise<string>;
        };
    }
}

export function UpdateChecker({ autoCheck = true, checkInterval = 3600000 }: UpdateCheckerProps) {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    const checkForUpdates = useCallback(async () => {
        // 只在 Electron 环境中检查
        if (!window.electronAPI?.isElectron) {
            return;
        }

        setIsChecking(true);
        try {
            const result = await window.electronAPI.checkForUpdates();
            setUpdateInfo(result);
            if (result.hasUpdate && !dismissed) {
                setIsVisible(true);
            }
        } catch (error) {
            console.error('[UpdateChecker] Check failed:', error);
        } finally {
            setIsChecking(false);
        }
    }, [dismissed]);

    // 自动检查更新
    useEffect(() => {
        if (!autoCheck || !window.electronAPI?.isElectron) return;

        // 启动时延迟 3 秒检查，避免影响启动速度
        const initialTimeout = setTimeout(() => {
            checkForUpdates();
        }, 3000);

        // 定期检查
        const interval = setInterval(checkForUpdates, checkInterval);

        return () => {
            clearTimeout(initialTimeout);
            clearInterval(interval);
        };
    }, [autoCheck, checkInterval, checkForUpdates]);

    const handleDownload = async () => {
        if (updateInfo?.downloadUrl) {
            await window.electronAPI?.openDownloadPage(updateInfo.downloadUrl);
        } else if (updateInfo?.releasePageUrl) {
            await window.electronAPI?.openDownloadPage(updateInfo.releasePageUrl);
        } else {
            await window.electronAPI?.openReleasesPage();
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        setDismissed(true);
    };

    const handleViewReleases = async () => {
        await window.electronAPI?.openReleasesPage();
    };

    // 不在 Electron 环境或没有更新时不显示
    if (!window.electronAPI?.isElectron || !isVisible || !updateInfo?.hasUpdate) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-md animate-slide-up">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* 头部 */}
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                        <Sparkles size={20} />
                        <span className="font-semibold">发现新版本 v{updateInfo.latestVersion}</span>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 内容区 */}
                <div className="p-4">
                    {/* 版本信息 */}
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
                        <span>当前版本: v{updateInfo.currentVersion}</span>
                        <span>→</span>
                        <span className="text-green-600 dark:text-green-400 font-medium">
                            v{updateInfo.latestVersion}
                        </span>
                    </div>

                    {/* 更新日志 */}
                    {updateInfo.releaseNotes && (
                        <div className="max-h-48 overflow-y-auto mb-4 pr-2">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                更新内容:
                            </h4>
                            <div className="text-sm text-gray-600 dark:text-gray-400 prose prose-sm dark:prose-invert max-w-none">
                                <Markdown content={updateInfo.releaseNotes} />
                            </div>
                        </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleViewReleases}
                            icon={<ExternalLink size={14} />}
                            className="flex-1"
                        >
                            查看详情
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleDownload}
                            icon={<Download size={14} />}
                            className="flex-1"
                        >
                            立即下载
                        </Button>
                    </div>
                </div>
            </div>

            {/* 动画样式 */}
            <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
        </div>
    );
}
