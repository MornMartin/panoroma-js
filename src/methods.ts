/**
 * 防抖
 * @param handler 操作函数
 * @param delay 间隔时间
 * @param doFirst 是否先执行
 * @param latestParam 是否已最新函数执行
 * @returns 防抖函数
 */
 export const deterShakeHandler = (handler, delay = 500, doFirst = false, latestParam = true) => {
    let isCountingdown;
    let argus;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return function (...param: any[]) {
        // eslint-disable-next-line prefer-rest-params
        argus = latestParam ? arguments : (argus || arguments);
        if (isCountingdown) return;
        if (doFirst) {
            handler(...argus);
        }
        isCountingdown = true;
        setTimeout(() => {
            if (!doFirst) {
                handler(...argus);
            }
            isCountingdown = false;
        }, delay);
    };
};
/**
 * 生成自增ID
 */
export const generateIncrementId = (prefix?: string) => {
    let index = 0;
    return () => {
        return `${prefix || ''}${index++}`
    }
}