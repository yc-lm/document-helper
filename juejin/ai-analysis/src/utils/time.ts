/**
 * @name: time.ts
 * @author: yangcongcong
 * @date: 2025/5/15
 * @description: 描述
 */
// 将视频时间戳转时分秒函数
export const formatVideoTime =   (timestamp: number): string => {
    const hours = Math.floor(timestamp / 3600);
    const minutes = Math.floor((timestamp % 3600) / 60);
    const seconds = Math.floor(timestamp % 60);

    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');

    if (hours > 0) {
        return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
    }
    return `${paddedMinutes}:${paddedSeconds}`;
};

