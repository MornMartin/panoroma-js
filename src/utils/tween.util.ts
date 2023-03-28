
import * as TWEEN from '@tweenjs/tween.js';
export default class TweenUtils {
    static createAnimationFrame() {
        let timer;
        const animate = (time) => {
            timer = requestAnimationFrame(animate)
            TWEEN.update(time)
        }
        return {
            start() {
                requestAnimationFrame(animate)
            },
            stop() {
                cancelAnimationFrame(timer)
            }
        }
    }
    static createCameraTransfer(from, to, callback, duration = 1000):Promise<void> {
        return new Promise(resolve => {
            const {start, stop} = TweenUtils.createAnimationFrame();
            start()
            new TWEEN.Tween(from)
            .to(to, duration)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate((e) => {
                typeof callback === 'function' && callback(e)
            })
            .onComplete(() => {
                resolve()
                stop()
            })
            .start()
        })
    }
    static createTransferFilter(from, to, callback, duration = 1000): Promise<void> {
        return new Promise(resolve => {
            const {start, stop} = TweenUtils.createAnimationFrame();
            start();
            new TWEEN.Tween(from)
            .delay(0)
            .repeat(1)
            .to(to, duration / 2)
            .yoyo(true)
            .easing(TWEEN.Easing.Cubic.Out)
            .onUpdate((e) => {
                typeof callback === 'function' && callback(e)
            })
            .onComplete(() => {
                resolve()
                stop()
            })
            .start()
        })
    }
}