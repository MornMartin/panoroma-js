import { THREE, OrbitControls, TransformControls } from "./uitl/three.loader";
import TweenUtils from './uitl/tween.util';
import ThreeUtils, { IViewSize, IVector3, TIntersects, IVideoPlayer } from "./uitl/three.util";
import { deterShakeHandler, isEqualObject } from "./uitl/methods";
import MathUtils from "./uitl/math.util";
import Events from "./Events";
import nanoid from "./uitl/nanoid.util";
import { doFinalCbk } from "./uitl/methods";
/**
 * 通知热点/热区位置变化截流
 */
const emitMarkTranslated = doFinalCbk(100)
/**
 * 场景热点/热区模型名称
 */
const SKY_BOX_MARK_LABEL = "SKY_BOX_MARK";
/**
 * 场景模型名称
 */
const SKY_BOX_LABEL = 'SKY_BOX';

/**
 * 场景附加标识事件类型
 */
export type TSceneMarkEventType = 'click' | 'mouseover' | 'mouseleave' | 'rtmousedown';

/**
 * 场景事件类型
 */
export type TSceneEventType = 'click' | 'rtmousedown';

/**
 * 场景附加标识配置
 */
export interface ISceneMarkConfig {
    id: string;
    type: 'point' | 'zoon';
    scale: number;
    position: IVector3;
    points?: IVector3[]; // 热区点组
    markZoonBorderColor?: string;// 热区边缘色
    markZoonFillColor?: string; // 热区填充色
    markPointSprite?: string;// 热点精灵图
}

/**
 * 场景配置
 */
export interface ISceneConfig {
    id: string;
    source: {
        url: string;
        type: 'video' | 'image';
    };
    marks?: ISceneMarkConfig[];
}

export interface IGlobalConfig {
    isEditable?: boolean;// 是否编辑态
    isShowFps?: boolean; // 是否展示FPS
    maxMarkCount?: number; // 最大热点/热区数
    maxMarkZoonPointCount?: number; // 单个热区最大点数
    transferDuration?: number;// 转场动画持续时间
    transferMaskColor?: string;// 转场蒙版颜色
    markZoonHoverBgColor?: string;// 热区鼠标移入背景颜色
    markZoonHoverBdrColor?: string;// 热区鼠标移入边框颜色
    scaleRange?: { // 缩放区间
        max: number;
        min: number;
    }
}

/**
 * 场景实例
 */
export interface IScene {
    mesh: THREE.Mesh;
    marks: ISceneMark[];
    config: ISceneConfig;// 外部绑定数据
    toShow: () => IVector3;// 当要被切换显示时
    toHide: () => IVector3;// 当要被切换隐藏时
    toReset: () => IVector3;// 当切换显示完成时
};

/**
 * 场景热点/热区
 */
 export interface ISceneMark {
    mesh: THREE.Mesh;
    config: ISceneMarkConfig;// 外部绑定数据
    onMouseover: () => void;// 当鼠标移入时
    onMouseleave: () => void;// 当鼠标移出时
}

/**
 * 鼠标事件信息
 */
export interface IMouseEvent {
    e: MouseEvent;
    position: IVector3;
    target: THREE.Mesh;
}
/**
 * 输出事件
 */
type TOutputEvents = 'clickedMark' | 'addedMark' | 'addedScene' | 'editedMark' | 'changed' | 'inited' | 'alarmed' | 'switchedScene' | 'selectedMark';
/**
 * 输入事件
 */
type TInputEvents = 'addScene' | 'removeScene' | 'editScene' | 'removeMark'| 'editMark';

export default class PanoromaEquirectangular extends Events<TOutputEvents | TInputEvents> {
    private video: IVideoPlayer;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private renderer: THREE.WebGLRenderer;
    private scenes: IScene[] = [];
    private orbitCtrls: OrbitControls;
    private transCtrls: TransformControls;
    private fpsCtrls: {update: () => void, start: () => void, end: () => void};
    private currentSceneId: string;
    // 记录当前mouseover的标识
    private activeMarkMesh: THREE.Object;
    // 全局配置
    private globalConfig: IGlobalConfig;
    // 是否转场中
    private isTransfering: boolean;
    // 是否在调整热点/热区中;
    private isMarkEditing: boolean;
    private markZoonMeshTemp: THREE.Object;
    private markZoonPointsTemp: IVector3[] = [];
    // 回退的点
    private markZoonFreePointsTemp: IVector3[] = [];
    private unobserveSzChng: () => void;
    private unregisterEventListener: () => void;
    private ctrlDestroyHandlers: (() => void)[] = [];
    constructor(container: HTMLElement, boxes: ISceneConfig|ISceneConfig[], config: IGlobalConfig) {
        super();
        this.globalConfig = config;
        this.video = ThreeUtils.createVideoPlayer(container);
        this.scene = ThreeUtils.createScene(config.transferMaskColor);
        this.camera = ThreeUtils.createCamera({width: container.offsetWidth, height: container.offsetHeight});
        this.renderer = ThreeUtils.createRenderer(container);
        this.scene.add(ThreeUtils.createPointLight())
        this.addScenees(boxes);
        const { controls: casterCtrls, destroy: destroyCaster } = ThreeUtils.addRaycaster(this.camera, this.scene, this.renderer, this.dispatchMouseEvent.bind(this))
        const { controls: orbitCtrls, destroy: destroyOribit, probe } = ThreeUtils.addControls(this.camera, this.scene, this.renderer);
        const { controls: transCtrls, destroy: destroyTrans } = ThreeUtils.addTransform(this.camera, this.scene, this.renderer);
        const { controls: fpsCtrls, destroy: destroyFps } = this.isShowFps && ThreeUtils.addFps(container, this.renderer) || {};
        this.fpsCtrls = fpsCtrls;
        this.orbitCtrls = orbitCtrls;
        this.transCtrls = transCtrls;
        fpsCtrls && probe.renderHead(() => fpsCtrls.update());
        fpsCtrls && probe.renderStart(() => fpsCtrls.start());
        fpsCtrls && probe.renderEnd(() => fpsCtrls.end());
        this.ctrlDestroyHandlers = [destroyCaster, destroyOribit, destroyTrans, destroyFps, this.video.destroy.bind(this.video)];
        this.unobserveSzChng = this.reactiCtnrSzChng(container);
        this.unregisterEventListener = this.registerEventListener();
        this.initView();
    }
    /**
     * 当前浏览场景
     */
    get currentScene () {
        return this.scenes.find(item => item.config.id === this.currentSceneId);
    }
    /**
     * 获取当前标识
     */
    get currentMark () {
        return (this.currentScene?.marks || []).find(item => item.mesh === this.transCtrls.object);
    }
    /**
     * 设置当前标识
     */
    set currentMark (mark: ISceneMark) {
        const currentMarkMesh = this.transCtrls.object;
        if(mark?.mesh?.isObject3D) {
            this.transCtrls.attach(mark.mesh)
        }else{
            this.transCtrls.detach();
        }
        if(currentMarkMesh != mark?.mesh?.isObject3D) {
            this.emit('selectedMark', mark);
        }
    }
    /**
     * 是否编辑态
     */
    get isEditable() {
        return this.globalConfig?.isEditable;
    }
    /**
     * 是否显示FPS
     */
    get isShowFps() {
        return this.globalConfig?.isShowFps;
    }
    /**
     * 最大热点/热区数目
     */
    get maxMarkCount() {
        return this.globalConfig?.maxMarkCount || Infinity;
    }
    /**
     * 最大热区点数目
     */
    get maxMarkZoonPointCount() {
        return this.globalConfig?.maxMarkZoonPointCount || Infinity;
    }
    /**
     * 转场过渡时间
     */
    get transferDuration() {
        return (this.globalConfig?.transferDuration || 1) * 1000;
    }
    /**
     * 响应容器大小变更
     * @param container 
     */
    private reactiCtnrSzChng(container: HTMLElement) {
        const dochangeViewSize = deterShakeHandler(() => {
            this.changeViewSize({width: container.offsetWidth, height: container.offsetHeight})
        })
        const callback = (e) => {
            dochangeViewSize();
        }
        const observer = new ResizeObserver(callback);
        observer.observe(container);
        return () => {
            observer.disconnect();
        };
    }
    /**
     * 注册全局事件监听
     * @returns 
     */
    private registerEventListener() {
        const keydown = (e: KeyboardEvent) => {
            if(e.key === 'z') {
                e.altKey && this.redrawMarkZoon('b');
            }
            if(e.key === 'a') {
                e.altKey && this.redrawMarkZoon('f');
            }
        }
        const keyup = (e) => {
            if(e.key === 'Alt') {
                this.saveMarkZoon();
            }
        }
        const wheel = (e) => {
            // 鼠标滚动
            if(this.currentMark) {
                this.emitMarkScaled(this.currentMark, e.deltaY)
            }
        }
        const draggingChange = (e) => {
            this.orbitCtrls.enabled = !e.value;
        }
        const positionChange = (e) => {
            this.emitMarkTranslated(this.currentMark);
        }
        const editMark = (e: ISceneMarkConfig) => {
            this.editMark(e)
        }
        const removeMark = (id: string) => {
            this.removeSceneMark(id);
        }
        const addScene = () => {
            const scene = this.addScene();
            this.emit('addedScene', scene.config);
        }
        const editScene = (e: {id: string; source: ISceneConfig['source']}) => {
            this.changeSceneMaterial(e.id, e.source);
        }
        const removeScene = (id: string) => {
            this.removeScene(id);
        }

        this.on('addScene', addScene);
        this.on('editMark', editMark);
        this.on('editScene', editScene);
        this.on('removeMark', removeMark);
        this.on('removeScene', removeScene);
        document.addEventListener('keyup', keyup);
        document.addEventListener('keydown', keydown);
        this.renderer.domElement.addEventListener('wheel', wheel);
        this.transCtrls.addEventListener('change', positionChange);
        this.transCtrls.addEventListener('dragging-changed', draggingChange);
        return () => {
            this.off('editMark', editMark);
            this.off('editScene', editScene);
            this.off('removeMark', removeMark);
            this.off('removeScene', removeScene);
            document.removeEventListener('keyup', keyup);
            document.removeEventListener('keydown', keydown);
            this.renderer?.domElement?.removeEventListener?.('wheel', wheel);
            this.transCtrls?.removeEventListener?.('changed', positionChange);
            this.transCtrls?.removeEventListener?.('dragging-changed', draggingChange);
        }
    }
    /**
     * 通知热点/热区点击事件
     * @param mark 
     */
    private emitMarkClicked(e: IMouseEvent) {
        const {config} = this.currentScene?.marks?.find?.(item => item.mesh === e.target) || {};
        if(!config) throw Error(`热点相关信息查询失败：${e.target.uuid}`);
        this.emit('clickedMark', config);
    }
    /**
     * 通知热点/热区添加事件
     * @param mark 
     */
    private emitMarkAdded(mark: ISceneMarkConfig) {
        if(!mark) return;
        this.emit('addedMark', {parentId: this.currentSceneId, payload: mark})
        this.emitAllChanges();
    }
    /**
     * 通知热点/热区位移
     * @param mark 
     */
    private emitMarkTranslated(mark: ISceneMark) {
        emitMarkTranslated(() => {
            if(!mark) return;
            const before = JSON.stringify(mark.config.position);
            const current = JSON.stringify(mark.mesh.position);
            const isChanged = before !== current;
            if(!isChanged) return;
            mark.config.position = JSON.parse(current);
            this.isMarkEditing = true;
            this.emit('editedMark', mark.config);
            this.emitAllChanges();
        })
    }
    /**
     * 通知热点/热区缩放
     * @param mark 
     */
    private emitMarkScaled(mark: ISceneMark, increase: number) {
        if(!mark) return;
        const inputMax = typeof this.globalConfig?.scaleRange?.max === "number" && this.globalConfig.scaleRange.max || Infinity;
        const inputMin = typeof this.globalConfig?.scaleRange?.min === "number" && this.globalConfig.scaleRange.min || 0;
        const max = Math.max(inputMax, inputMin);
        const min = Math.min(inputMax, inputMin);
        const before = mark.config.scale;
        const target = Number(Math.max(before + increase * 0.001, 0).toFixed(2));
        const validScale = Math.max(min, Math.min(target, max));
        if(before === validScale) return;
        mark.mesh.scale.set(validScale, validScale, validScale)
        mark.config.scale = validScale;
        this.emit('editedMark', mark.config);
        this.emitAllChanges();
    }
    /**
     * 通知修改
     * @returns 
     */
    private emitAllChanges() {
        const listeners = this.getListeners('changed');
        if(!listeners?.length) return;
        this.emit('changed', this.getAllConfigs());
    }
    /**
     * 通知初始化完成
     */
    private emitInited() {
        this.emit('inited', this.getAllConfigs())
    }
    /**
     * 获取所有更新
     * @returns 
     */
    public getAllConfigs(): ISceneConfig[] {
        return this.scenes.map(box => {
            const marks = box.marks.map(mark => {
                return mark.config;
            });
            return {...box.config, marks};
        })
    }
    /**
     * 改变材质
     * @param imgUrl 
     */
    public changeSceneMaterial(id: IScene['config']['id'], source: ISceneConfig['source']) {
        const scene = this.scenes.find(item => item.config.id === id);
        if(!scene) throw Error(`查询场景（${id}）：失败，未找到。`);
        scene.config.source = source && {...source} || null;
        scene.mesh.material.dispose();
        scene.mesh.material = ThreeUtils.createSceneMaterial(this.video, source);
    }
    /**
     * 改变渲染尺寸
     * @param size 
     */
    public changeViewSize(size: IViewSize) {
        ThreeUtils.setViewSize(this.camera, this.renderer, size);
    }
    /**
     * 分发标识鼠标事件
     * @param type 
     * @param objects 
     */
    private dispatchMouseEvent(type: 'mousemove' | 'click' | 'mousedown', intersects: TIntersects, e?: MouseEvent) {
        const eventSource = this.getEventSource(intersects);
        const sourceTarget = eventSource?.object;
        if(!sourceTarget) return;
        const activeMarkMeshBefore = this.activeMarkMesh;
        const activeMarkMeshTarget = sourceTarget.name === SKY_BOX_MARK_LABEL ? sourceTarget : null;
        // 分发鼠标右键按下
        if(type === 'mousedown' && e?.button === 2) {
            this.dispatchRtmousedown({e, position: eventSource.point, target: sourceTarget})
        }
        // 分发鼠标左键点击
        if(type === 'click') {
            !this.isMarkEditing && this.dispatchClick({e, position: eventSource.point, target: sourceTarget});
            this.isMarkEditing = false;
        }
        // 鼠标向标识移入
        if(!activeMarkMeshBefore && activeMarkMeshTarget) {
            this.activeMarkMesh = activeMarkMeshTarget;
            this.dispatchMouseover({e, position: eventSource.point, target: activeMarkMeshTarget});
        }
        // 鼠标从标识移出
        if(activeMarkMeshBefore && !activeMarkMeshTarget){
            this.activeMarkMesh = activeMarkMeshTarget;
            this.dispatchMouseleave({e, position: eventSource.point, target: activeMarkMeshBefore})
        }
        // 鼠标从一个标识移入到另一个标识
        if(activeMarkMeshBefore && activeMarkMeshTarget && activeMarkMeshBefore !== activeMarkMeshTarget) {
            this.activeMarkMesh = activeMarkMeshTarget;
            this.dispatchMouseleave({e, position: eventSource.point, target: activeMarkMeshBefore});
            this.dispatchMouseover({e, position: eventSource.point, target: activeMarkMeshTarget});
        }
    }
    /**
     * 鼠标右键按下
     * @param source 
     */
    private dispatchRtmousedown(e: IMouseEvent) {
        const { target } = e;
        if(target.name === SKY_BOX_MARK_LABEL) {
            this.reactMarkEvent('rtmousedown', e)
        }else if(target.name === SKY_BOX_LABEL) {
            this.reactBoxEvent('rtmousedown', e)
        }
    }
    /**
     * 鼠标左键点击
     * @param source 
     */
    private dispatchClick(e: IMouseEvent) {
        const { target } = e;
        if(target.name === SKY_BOX_MARK_LABEL) {
            this.reactMarkEvent('click', e)
        }else if(target.name === SKY_BOX_LABEL) {
            this.reactBoxEvent('click', e)
        }
    }
    /**
     * 标识鼠标移入
     * @param source 
     */
    private dispatchMouseover(e: IMouseEvent) {
        const { target } = e;
        if(target.name === SKY_BOX_MARK_LABEL) {
            this.reactMarkEvent('mouseover', e)
        }
    }
    /**
     * 标识鼠标移出
     * @param source 
     */
    private dispatchMouseleave(e: IMouseEvent) {
        const { target } = e;
        if(target.name === SKY_BOX_MARK_LABEL) {
            this.reactMarkEvent('mouseleave', e)
        }
    }
    /**
     * 响应标识鼠标事件
     * @param type 
     * @param source 
     */
    private reactMarkEvent(type: TSceneMarkEventType, e: IMouseEvent) {
        if(type === 'rtmousedown') {
            this.isEditable && this.startAdjustMark(e)
        }else if(type === 'click') {
            this.emitMarkClicked(e);
        }else if(type === 'mouseover') {
            const mark = this.currentScene?.marks?.find?.(item => item.mesh === e.target);
            mark?.onMouseover?.();
        }else if(type === 'mouseleave') {
            const mark = this.currentScene?.marks?.find?.(item => item.mesh === e.target);
            mark?.onMouseleave();
        }
    }
    /**
     * 响应场景鼠标事件
     * @param type 
     * @param source 
     */
    private reactBoxEvent(type: TSceneEventType, e: IMouseEvent) {
        if(type === 'rtmousedown' && e.e.altKey) {
            this.isEditable && this.drawingMarkZoon(e)
        }else if(type === 'rtmousedown' && !e.e.altKey) {
            this.isEditable && this.addMarkPoint(e)
        }else if(type === 'click') {
            this.isEditable && this.endAdjustMark()
        }
    }
    /**
     * 创建场景热点/热区配置
     * @param type 
     * @param position 
     * @param points 
     * @returns 
     */
    private createMarkConfig(type: ISceneMarkConfig['type'], position: IVector3,  points?: IVector3[]): ISceneMarkConfig {
        return {
            type,
            points,
            id: nanoid(),
            scale: 1,
            position,
            markPointSprite: '',
            markZoonBorderColor: '#cccccc4d',
            markZoonFillColor: '#ffffff4d'
        }
    }
    /**
     * 添加热点
     * @param e 
     * @returns 
     */
    private addMarkPoint(e: IMouseEvent) {
        if(!this.currentScene) return;
        if(this.currentScene.marks.length + 1 > this.maxMarkCount) {
            return this.emit('alarmed', '热点/热区已到达添加上限')
        }
        const basePoint = this.currentScene.mesh.position;
        const newPoint = {
            x: e.position.x - basePoint.x,
            y: e.position.y - basePoint.y,
            z: e.position.z - basePoint.z,
        };
        const config = this.createMarkConfig('point', newPoint);
        const mark = this.createMark(config);
        this.currentScene.mesh.add(mark.mesh);
        this.currentScene.config.marks.push(config);
        this.currentScene.marks.push(mark)
        this.currentMark = mark;
        this.emitMarkAdded(config);
    }
    /**
     * 添加热区点
     * @param source 
     * @returns 
     */
    private drawingMarkZoon(e: IMouseEvent) {
        if(!this.currentScene) return;
        if(this.currentScene.marks.length + 1 > this.maxMarkCount) {
            return this.emit('alarmed', '热点/热区已到达添加上限')
        }
        if(this.markZoonPointsTemp.length + 1 > this.maxMarkZoonPointCount) {
            return this.emit('alarmed', '当前热区点配置数目已达到上限')
        }
        this.currentScene.mesh.remove(this.markZoonMeshTemp);
        const basePoint = this.currentScene.mesh.position;
        const newPoint = {
            x: e.position.x - basePoint.x,
            y: e.position.y - basePoint.y,
            z: e.position.z - basePoint.z,
        };
        const points = [...this.markZoonPointsTemp, newPoint];
        const {center, points: transedPoints} = ThreeUtils.transMarkZoonPoints(points);
        const config = this.createMarkConfig('zoon', center, transedPoints);
        const mark = this.createMarkMesh(config);
        this.markZoonMeshTemp = mark;
        this.markZoonPointsTemp = points;
        this.markZoonFreePointsTemp = [];
        this.currentScene.mesh.add(mark);
    }
    /**
     * 回退热区点
     */
    private redrawMarkZoon(direction: 'b' | 'f') {
        if(!this.currentScene) return;
        this.currentScene.mesh.remove(this.markZoonMeshTemp);
        if(direction === 'b') {
            // 后退
            const current = this.markZoonPointsTemp.pop();
            current && this.markZoonFreePointsTemp.unshift(current)
        }else {
            // 前进
            const current = this.markZoonFreePointsTemp.shift();
            current && this.markZoonPointsTemp.push(current);
        }
        const {center, points: transedPoints} = ThreeUtils.transMarkZoonPoints(this.markZoonPointsTemp);
        const config = this.createMarkConfig('zoon', center, transedPoints);
        const mark = this.createMarkMesh(config);
        this.markZoonMeshTemp = mark;
        this.currentScene.mesh.add(mark);
    }
    /**
     * 保存热区
     * @returns 
     */
    private saveMarkZoon() {
        if(!this.currentScene) return;
        this.currentScene.mesh.remove(this.markZoonMeshTemp);
        if(this.markZoonPointsTemp.length >= 3) {// 保存绘制的热区
            const {center, points} = ThreeUtils.transMarkZoonPoints(this.markZoonPointsTemp);
            const config = this.createMarkConfig("zoon", center, points);
            const mark = this.createMark(config);
            this.currentMark = mark;
            this.currentScene.mesh.add(mark.mesh);
            this.currentScene.config.marks.push(config);
            this.currentScene.marks.push(mark)
            this.emitMarkAdded(config);
        }
        this.markZoonPointsTemp = [];
        this.markZoonMeshTemp = null;
    }
    /**
     * 选中调整热点/热区
     */
    private startAdjustMark(e: IMouseEvent) {
        if(!this.currentScene) return;
        const mark = this.currentScene.marks.find(item => item.mesh === e.target);
        this.currentMark = mark;
    }
    /**
     * 结束调整热点/热区
     */
    private endAdjustMark() {
        this.currentMark = null;
    }
    /**
     * 外部输入调整热点/热区
     * @param mark 
     */
    private editMark(mark: ISceneMarkConfig) {
        if(!mark?.id) throw Error(`查询热点/热区（${mark?.id}）：失败，未找到。`);
        for(const box of this.scenes) {
            for(let i = 0; i < box.marks.length; i++) {
                const current = box.marks[i];
                const isTarget = current.config.id === mark.id;
                if(isTarget && current.config.scale !== mark.scale) {
                    this.changeMarkScale(current.mesh, mark.scale);
                    current.config.scale = mark.scale;
                    box.config.marks[i].scale = mark.scale;
                }
                if(isTarget && current.config.type === 'point' && current.config.markPointSprite !== mark.markPointSprite) {
                    this.changeMarkSpriteImg(current.mesh, mark.markPointSprite);
                    current.config.markPointSprite = mark.markPointSprite;
                    box.config.marks[i].markPointSprite = mark.markPointSprite;
                }
                if(isTarget && current.config.type === 'zoon' && (current.config.markZoonFillColor !== mark.markZoonFillColor || current.config.markZoonBorderColor !== mark.markZoonBorderColor)) {
                    this.changeMarkColor(current.mesh, {border: mark.markZoonBorderColor, fill: mark.markZoonFillColor});
                    current.config.markZoonFillColor = mark.markZoonFillColor;
                    box.config.marks[i].markZoonFillColor = mark.markZoonFillColor;
                    current.config.markZoonBorderColor = mark.markZoonBorderColor;
                    box.config.marks[i].markZoonBorderColor = mark.markZoonBorderColor;
                }
                if(isTarget) return;
            }
        }
        throw Error(`查询热点/热区（${mark?.id}）：失败，未找到。`)
    }
    /**
     * 修改热点/热区缩放比例
     * @param scale 
     */
    private changeMarkScale(mesh: THREE.Mesh, scale: number) {
        mesh.scale.set(scale, scale, scale);
    }
    /**
     * 修改热点精灵图
     */
    private changeMarkSpriteImg(mesh: THREE.Mesh, imgUrl: string) {
        const [box, sprite] = mesh.children;
        box.visible = imgUrl ? false : true;
        mesh.remove(sprite);
        mesh.add(ThreeUtils.createMarkPointSprite(imgUrl));
    }
    /**
     * 修改热区颜色
     */
    private changeMarkColor(mesh: THREE.Mesh, colors: {border: string; fill: string}) {
        const [zoon, edge] = mesh.children;
        const zoonMaterial = ThreeUtils.createMarkZoonMaterial(colors.fill)
        zoon.material.dispose();
        zoon.material = zoonMaterial;
        const edgeMaterial = ThreeUtils.createMarkZoonEdgeMaterial(colors.border);
        edge.material.dispose();
        edge.material = edgeMaterial;
    }
    /**
     * 获取事件源
     * @param intersects 
     * @returns 
     */
    private getEventSource(intersects: TIntersects): THREE.Object{
        // 仅场景、热点、热区需要事件处理
        const validLabels = [SKY_BOX_MARK_LABEL, SKY_BOX_LABEL];
        const marks = intersects.filter(item => {
            return validLabels.includes(item.object.name) || validLabels.includes(item.object.parent?.name);
        }).sort((a, b) => {
            return a.distance - b.distance;
        }).map(item => {
            if(SKY_BOX_MARK_LABEL === item.object.parent?.name) {
                return {...item, object: item.object.parent}
            }
            return item;
        })
        // 取第一个对象作为事件源
        const [ mark ] = marks;
        return mark || null;
    }
    /**
     * 初始化
     */
    private initView() {
        this.emitInited();
    }
    /**
     * 默认浏览第一个场景
     */
    public async viewFirstScene() {
        const [first] = this.scenes;
        if(first) {
            await this.viewScene(first.config.id);
        }
    }
    /**
     * 浏览场景
     * @param id 
     */
    public async viewScene(id: IScene['config']['id'], duration?: number) {
        const scene = this.scenes.find(item => item.config.id === id);
        if(!scene) throw Error(`查询场景（${id}）：失败，未找到。`);
        if(this.isTransfering) return console.warn('镜头切换中');
        const sceneBefore = this.currentScene;
        const sceneIdBefore = this.currentSceneId;
        const transTargetPos = scene.toShow();
        const target = {x: transTargetPos.x, y: transTargetPos.y, z: transTargetPos.z}
        this.isTransfering = true;
        this.currentSceneId = id;
        await this.doSceneTransfer(target, target, duration);
        const resetPos = scene.toReset();
        this.camera.position.set(resetPos.x, resetPos.y, resetPos.z);
        this.orbitCtrls.target.set(resetPos.x, resetPos.y, resetPos.z + 1);
        this.isTransfering = false;
        if(scene.config.id !== sceneIdBefore) {
            sceneBefore?.toHide?.();
        };
        this.emit('switchedScene', this.currentScene);
    }
    /**
     * 查看热点/热区
     * @param id 
     */
    public async viewMark(id: ISceneMarkConfig['id'], duration = 500) {
        const mark: ISceneMark = this.currentScene?.marks?.find?.(item => item.config.id === id);
        if(!mark) throw Error(`查询场景热点/热区（${id}）：失败，未找到`);
        if(this.isTransfering) return console.warn('镜头切换中');
        const markPos: IVector3 = mark.config.position;
        const focusTarget: IVector3 = this.orbitCtrls.target;
        const camPos = this.camera.position;
        const dCT = MathUtils.vDist(focusTarget, camPos);
        const {a: intersectionA, b: intersectionB} = MathUtils.lineIntersectSphere(markPos, focusTarget, focusTarget, dCT);
        const DAMP = MathUtils.vDist(intersectionA, markPos);
        const DBMP = MathUtils.vDist(intersectionB, markPos);
        const targetCamPos = DAMP < DBMP ? intersectionB : intersectionA;
        this.isTransfering = true;
        await this.doMarkTransfer(targetCamPos, duration);
        this.isTransfering = false;
    }
    /**
     * 选中热点/热区
     * @param id 
     */
    public selectMark(id: ISceneMarkConfig['id']) {
        const mark: ISceneMark = this.currentScene?.marks?.find?.(item => item.config.id === id);
        if(!mark) throw Error(`查询场景热点/热区（${id}）：失败，未找到`);
        this.currentMark = mark;
    }
    /**
     * 执行场景切换转场
     * @param pos 位置
     * @param target 聚焦点
     * @param duration 转场时长
     * @returns 
     */
    private async doSceneTransfer(pos: IVector3, target: IVector3, duration = this.transferDuration) {
        const doCameraTrans = () => {
            const from = {
                camrPosX: this.camera.position.x,
                camrPosY: this.camera.position.y,
                camrPosZ: this.camera.position.z,
                targetX: this.orbitCtrls.target.x,
                targetY: this.orbitCtrls.target.y,
                targetZ: this.orbitCtrls.target.z,
            }
            const to = {
                camrPosX: pos.x,
                camrPosY: pos.y,
                camrPosZ: pos.z,
                targetX: target.x,
                targetY: target.y,
                // 避免相机不能转动
                targetZ: target.z + 1
            }
            return TweenUtils.createCameraTransfer(from, to, (e) => {
                this.camera.position.set(e.camrPosX, e.camrPosY, e.camrPosZ)
                this.orbitCtrls.target.set(e.targetX, e.targetY, e.targetZ)
            }, duration * 0.75)
        }
        const doFilterTrans = () => {
            const from = {blur: 0, density: 0};
            const to = {blur: 25, density: 0.0045}
            return TweenUtils.createTransferFilter(from, to, e => {
                this.scene.fog.density = e.density;
                this.renderer.domElement.style.filter = `blur(${e.blur}px)`;
            }, duration)
        }
        return await Promise.all([doCameraTrans(), doFilterTrans()])
    }
    /**
     * 执行热点/热区聚焦转场
     * @param target 
     * @param duration 
     * @returns 
     */
    private async doMarkTransfer(pos: IVector3, duration = this.transferDuration) {
        const doCameraTrans = () => {
            const from = {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z,
            }
            const to = {
                x: pos.x,
                y: pos.y,
                z: pos.z
            }
            return TweenUtils.createCameraTransfer(from, to, (e) => {
                this.camera.position.set(e.x, e.y, e.z)
            }, duration * 0.75)
        }
        return await Promise.all([doCameraTrans()])
    }
    /**
     * 创建场景
     * @param  
     * @returns 
     */
    private createScene(config?: ISceneConfig): IScene {
        const radius = 500;
        const skbId = config?.id || nanoid();
        const material = ThreeUtils.createSceneMaterial(this.video, null);
        const geometry = ThreeUtils.createSceneGeometry(radius);
        const mesh = ThreeUtils.createMesh(geometry, material);
        const marks = (config?.marks || []).map(item => {
            const mark = this.createMark(item);
            mesh.add(mark.mesh);
            return mark;
        });
        mesh.visible = false;
        mesh.name = SKY_BOX_LABEL;
        const toShowScene = (source): IVector3 => {
            const target = {x: 0, y: 0, z: 600}
            mesh.visible = true;
            mesh.position.set(target.x, target.y, target.z);
            mesh.material.dispose();
            mesh.material = ThreeUtils.createSceneMaterial(this.video, source);
            return target;
        }
        const toHideScene = (): IVector3 => {
            const target: IVector3 = {
                x: 999,
                y: 999,
                z: 999,
            };
            mesh.visible = false;
            mesh.position.set(target.x, target.y, target.z);
            mesh.material.dispose();
            return target;
        }
        const toResetScene = (): IVector3 => {
            const target = {x: 0, y: 0, z: 0};
            mesh.position.set(target.x, target.y, target.z);
            return target;
        }
        const toResetMarkZoon = () => {
            marks.forEach(item => {
                if(item.config.type === 'zoon') {
                    this.changeMarkColor(item.mesh, {border: item.config.markZoonBorderColor, fill: item.config.markZoonFillColor})
                }
            })
        }
        return {
            toShow(): IVector3 {
                // 当要被显示时
                toResetMarkZoon();
                return toShowScene(this.config.source);
            },
            toHide(): IVector3 {
                // 当要被隐藏时
                return toHideScene();
            },
            toReset(): IVector3 {
                // 当转场完成时
                return toResetScene();
            },
            mesh,
            marks,
            config: {...(config || {source: null}), id: skbId, marks: marks.map(i => i.config)}
        }
    }
    /**
     * 创建热点热区
     * @param config 
     * @returns 
     */
    private createMark(config: ISceneMarkConfig): ISceneMark {
        const markId = config.id || nanoid();
        const mesh = this.createMarkMesh(config);
        const onMouseover = () => {
            if(config.type === 'zoon') {
                const colors = {
                    border: this.globalConfig?.markZoonHoverBdrColor || '#ee00004d',
                    fill: this.globalConfig?.markZoonHoverBgColor || '#66ccff4d'
                }
                this.changeMarkColor(mesh, colors);
            }
        };
        const onMouseleave = () => {
            if(config.type === 'zoon') {
                const currentConfig = this.getMarkById(markId)?.config;
                const colors = {
                    border: currentConfig?.markZoonBorderColor || '#cccccc4d',
                    fill: currentConfig?.markZoonFillColor || '#ffffff4d'
                }
                this.changeMarkColor(mesh, colors)
            }
        };
        this.changeMarkScale(mesh, config.scale);
        return {
            onMouseover,
            onMouseleave,
            mesh,
            config: {...config, id: markId},
        };
    }
    /**
     * 获取热点/热区
     * @param id 
     * @returns 
     */
    private getMarkById(id: string): ISceneMark {
        for(const box of this.scenes) {
            const target = box.marks.find(item => item.config.id === id);
            if(target) {
                return target;
            }
        }
        return null;
    }
    /**
     * 创建热点/热区模型
     * @param config 
     * @returns 
     */
    private createMarkMesh(config: ISceneMarkConfig): THREE.Group {
        if(config.type === 'point') {
            const mesh = ThreeUtils.createMarkPointMesh(config.position, config.markPointSprite);
            mesh.name = SKY_BOX_MARK_LABEL;
            return mesh;
        }
        if(config.type === 'zoon') {
            const colors = {
                border: config.markZoonBorderColor,
                fill: config.markZoonFillColor,
            }
            const mesh = ThreeUtils.createMarkZoonMesh(config.position, config.points, colors);
            mesh.name = SKY_BOX_MARK_LABEL;
            return mesh;
        }
        return new THREE.Group();
    }
    /**
     * 添加场景子（支持多个）
     * @param imgUrl 
     */
    public addScenees(config: ISceneConfig|ISceneConfig[]) {
        const imgUrlList = Array.isArray(config) ? config : typeof config === "string" && [config] || [];
        const addedScenees = [];
        imgUrlList.forEach(item => {
            const scene = this.createScene(item);
            this.scene.add(scene.mesh);
            this.scenes.push(scene);
            addedScenees.push(scene);
        });
        return addedScenees;
    }
    /**
     * 添加场景子（单个）
     */
    public addScene(config?: ISceneConfig): IScene {
        const scene = this.createScene(config);
        this.scene.add(scene.mesh);
        this.scenes.push(scene);
        return scene;
    }
    /**
     * 移除场景子
     */
    public removeScene(id: string) {
        const index = this.scenes.findIndex(item => item.config.id === id);
        if(index < 0) throw Error(`查询场景（${id}）：失败，未找到。`);
        const [scene] = this.scenes.splice(index, 1);
        this.scene.remove(scene.mesh);
        if(id === this.currentSceneId) {
            this.viewFirstScene()
        }
    }
    /**
     * 移除热点/热区
     * @param id 
     */
    public removeSceneMark(id: string) {
        for(const box of this.scenes) {
            const target = box.marks.find(item => item.config.id === id);
            if(target) {
                box.marks = box.marks.filter(item => item.config.id !== id);
                box.config.marks = box.config.marks.filter(item => item.id !== id);
                box.mesh.remove(target.mesh);
                this.currentMark = this.currentMark?.config?.id === id ? null : this.currentMark;
                return
            }
        }
        throw Error(`查询热点/热区（${id}）：失败，未找到。`)
    }
    /**
     * 销毁实例
     */
    public destroy() {
        this.scene.clear();
        this.unobserveSzChng();
        this.unregisterEventListener();
        for(const destroyHandler of this.ctrlDestroyHandlers) {
            if(typeof destroyHandler === 'function') {
                destroyHandler()
            }
        }
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
}