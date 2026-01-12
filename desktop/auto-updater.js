/**
 * Auto-Updater Module for Banana Slides Desktop
 * 
 * Checks GitHub Releases API for new versions and provides update info.
 * Since the app is not code-signed, we can only guide users to download
 * and manually install updates.
 */

const { shell } = require('electron');
const log = require('electron-log');

// GitHub repository info
const GITHUB_OWNER = 'zhizinan1997';
const GITHUB_REPO = 'banana-slides';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

/**
 * Compare two version strings (semver-like)
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
    const parts1 = v1.replace(/^v/, '').split('.').map(Number);
    const parts2 = v2.replace(/^v/, '').split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

/**
 * Get download URL for current platform from release assets
 */
function getDownloadUrl(assets, platform) {
    if (!assets || assets.length === 0) return null;

    const patterns = {
        darwin: [/\.dmg$/i, /mac.*\.zip$/i],
        win32: [/\.exe$/i, /Setup.*\.exe$/i],
        linux: [/\.AppImage$/i, /\.deb$/i]
    };

    const platformPatterns = patterns[platform] || patterns.win32;

    for (const pattern of platformPatterns) {
        const asset = assets.find(a => pattern.test(a.name));
        if (asset) return asset.browser_download_url;
    }

    // Fallback to first asset
    return assets[0]?.browser_download_url || null;
}

/**
 * Check for updates from GitHub Releases
 * @param {string} currentVersion - Current app version (e.g., "1.0.0")
 * @returns {Promise<Object>} Update info or null if no update
 */
async function checkForUpdates(currentVersion) {
    try {
        log.info(`[AutoUpdater] Checking for updates... Current version: ${currentVersion}`);

        const response = await fetch(GITHUB_API_URL, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Banana-Slides-Desktop'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                log.info('[AutoUpdater] No releases found');
                return { hasUpdate: false };
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const release = await response.json();
        const latestVersion = release.tag_name.replace(/^v/, '');

        log.info(`[AutoUpdater] Latest version: ${latestVersion}`);

        if (compareVersions(latestVersion, currentVersion) > 0) {
            const platform = process.platform;
            const downloadUrl = getDownloadUrl(release.assets, platform);

            log.info(`[AutoUpdater] New version available: ${latestVersion}`);

            return {
                hasUpdate: true,
                currentVersion: currentVersion,
                latestVersion: latestVersion,
                releaseNotes: release.body || '暂无更新说明',
                releaseName: release.name || `v${latestVersion}`,
                publishedAt: release.published_at,
                downloadUrl: downloadUrl,
                releasePageUrl: release.html_url
            };
        }

        log.info('[AutoUpdater] Already up to date');
        return { hasUpdate: false, currentVersion, latestVersion };

    } catch (error) {
        log.error('[AutoUpdater] Check failed:', error.message);
        return {
            hasUpdate: false,
            error: error.message,
            currentVersion
        };
    }
}

/**
 * Open the release download page in default browser
 */
function openDownloadPage(url) {
    if (url) {
        shell.openExternal(url);
        return true;
    }
    return false;
}

/**
 * Open the GitHub releases page
 */
function openReleasesPage() {
    shell.openExternal(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`);
}

module.exports = {
    checkForUpdates,
    openDownloadPage,
    openReleasesPage,
    compareVersions,
    GITHUB_API_URL
};
