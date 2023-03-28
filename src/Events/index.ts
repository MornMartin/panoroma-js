export type TListener = (e?: any) => void;

/**
 * 需要事件继承该类
 */
export default class Events<TEventType> {
    private listeners: {[type: string]: TListener[]} = {};
    /**
     * 触发事件监听
     * @param event 
     * @param e 
     */
     public emit(event: TEventType, e?: any) {
        const handlers = this.listeners[event as any] || [];
        for(const handler of handlers) {
            try{
                handler && handler(e)
            }catch(err) {
                console.error(err);
            }
        }
    }
    /**
     * 注册事件监听
     * @param event 
     * @param handler 
     */
    public on(event: TEventType, handler: TListener) {
        if(typeof event !== 'string') {
            throw Error("无效的事件类型")
        }
        if(typeof handler !== 'function') {
            throw Error('无效监听函数类型')
        }
        const handlers = this.listeners[event] || [];
        this.listeners[event] = handlers.concat(handler);
        return this;
    }
    /**
     * 移除事件监听
     * @param event 
     * @param handler 
     * @returns 
     */
    public off(event: TEventType, handler?: TListener) {
        if(typeof event !== 'string') {
            throw Error("无效的事件类型")
        }
        if(this.listeners[event] && handler) {
            this.listeners[event] = this.listeners[event].filter(item => item !== handler);
        }
        if(this.listeners[event] && !handler) {
            this.listeners[event] = []
        }
        return this;
    }
    /**
     * 获取事件函数
     * @param event 
     * @returns 
     */
    public getListeners(event: TEventType) {
        if(typeof event !== "string") return [];
        return this.listeners[event];
    }
}