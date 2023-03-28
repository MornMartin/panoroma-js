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
 * 对比两对象是否相等
 * @param source 
 * @param target 
 * @returns 
 */
export const isEqualObject = (source: any, target: any) => {
    if(source === target) return true;
    return JSON.stringify(source) === JSON.stringify(target);
}
/**
 * 判断是否16进制颜色
 * @param c 
 * @returns 
 */
export const isHexColor = (c: string) => {
    return /(^#[0-9A-F]{8}$)|(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(c);
}
/**
 * 判断是否rgba颜色
 * @param c 
 * @returns 
 */
export const isRgbaColor = (c: string) => {
    return /^rgb[a]?[\(]([\s]*(2[0-4][0-9]|25[0-5]|[01]?[0-9][0-9]?),){2}[\s]*(2[0-4][0-9]|25[0-5]|[01]?[0-9][0-9]?),?[\s]*(0\.\d{1,2}|1|0)?[\)]{1}$/i;
}
/**
 * 转换rgba颜色为hex颜色
 * @param c 
 * @returns 
 */
export const transRgba2Hex = (c: string) => {
    if(!isRgbaColor(c)) return '#ffffff';
    return `#${c
        .replace(/rgb\(|rgba\(|\)/g, '')
        .split(',')
        .map((item, index) => {
            if(index < 3) {
                return (Number(item) % 256).toString(16)
            }
            if(index === 3 && /^rgba\(/.test(c)) {
                return Math.ceil(Number(item) * 255).toString(16)
            }
            return ''
        })
        .join('')
    }`;
}

/**
 * 解析16进制色值
 * @param c 
 */
export const decodeHexColor = (c: string): {color: number, opacity: number} => {
    if(!isHexColor(c)) return {color: 0xffffff, opacity: 1};
    const colorPart = c.slice(1, 7);
    const opacity = eval(`0x${c.slice(7) || 'ff'}`) / 255;
    return {color: eval(`0x${colorPart}`), opacity: opacity};
}
/**
 * 解析颜色为色值和透明度
 * @param c 
 * @returns 
 */
export const decodeColor = (c: string): {color: number, opacity: number} => {
    if(isHexColor(c)) {
        return decodeHexColor(c)
    }
    if(isRgbaColor(c)) {
        return decodeHexColor(transRgba2Hex(c))
    }
    return {color: 0xffffff, opacity: 1}
}
/**
 * 阻止相同资源竞争
 * @returns 
 */
export const stopContendSameRes = () => {
    const waitList = {};
    const reqMap = {};
    const toOccupy = (src: string) => {
        if(reqMap[src]) return;
        const resolve = waitList[src].shift();
        typeof resolve === 'function' && resolve();
        reqMap[src] = !!resolve;
    };
    return {
        lock(src: string) {
            return new Promise(resolve => {
                waitList[src] = [...(waitList[src] || []), resolve];
                toOccupy(src);
            })
        },
        async unlock(src: string) {
            reqMap[src] = false;
            await wait();
            toOccupy(src);
        }
    }
}
/**
 * 自定义延迟
 * @param delay 
 * @returns 
 */
export const wait = (delay = 500) => {
    return new Promise((resolve) => {
        setTimeout(resolve, delay)
    })
}
/**
 * 截流
 * @param interval 
 * @returns 
 */
export const doFinalCbk = (interval = 500) => {
    let timer;
    return (cbk) => {
        clearTimeout(timer);
        timer = setTimeout(cbk, interval)
    }
}