import { THREE, OrbitControls } from "./three.loader";
import TweenUtils from './tween.util';
import ThreeUtils, { IViewSize, IVector3, TIntersects } from "./three.util";
import { deterShakeHandler, generateIncrementId } from "./methods";
import MathUtils from "./math.util";

/**
 * 天空盒附加标识模型名称
 */
const SKY_BOX_MARK_LABEL = "SKY_BOX_MARK";

/**
 * 生成天空盒自增ID
 */
const generateSkyBoxId = generateIncrementId('sky-box-');
/**
 * 天空盒附加标识事件类型
 */
export type TSkyBoxMarkEventType = 'click' | 'mouseover' | 'mouseleave';

/**
 * 天空盒附加标识配置
 */
export interface ISkyBoxMarkConfig {
    position: {
        // 半径百分比
        ratioR: number; // 0-1
        angleY: number; // 0-360
        angleZ: number;// 0-360
    };
    eventsHanlders: {
        type: TSkyBoxMarkEventType,
        handler: (e: {type: TSkyBoxMarkEventType; source: ISkyBoxMark}) => void;
    }[],
}

/**
 * 天空盒附加标识
 */
export interface ISkyBoxMark {
    uuid: string;
    mesh: THREE.Mesh;
    events: ISkyBoxMarkConfig['eventsHanlders']
}

/**
 * 天空盒配置
 */
export interface ISkyBoxConfig {
    imgUrl: string;
    alias?: string; // 可自定义别名
    marks: ISkyBoxMarkConfig[];
}

/**
 * 天空盒实例
 */
export interface ISkyBox {
    id: string;
    alias: string;
    imgUrl: string;
    index: number;
    mesh: THREE.Mesh;
    position: IVector3;
    marks: ISkyBoxMark[];
    material: THREE.Material;
    geometry: THREE.Geometry;
};
export default class PanoromaEquirectangular {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private renderer: THREE.WebGLRenderer;
    private skyBoxes: ISkyBox[] = [];
    private contorls: OrbitControls;
    private isTransfering: boolean;
    private currentSkyBoxId: string;
    // 记录当前mouseover的标识
    private activeMarkMesh: THREE.Object;
    constructor(container: HTMLElement, config: ISkyBoxConfig|ISkyBoxConfig[]) {
        this.scene = ThreeUtils.createScene();
        this.camera = ThreeUtils.createCamera({width: container.offsetWidth, height: container.offsetHeight});
        this.renderer = ThreeUtils.createRenderer(container);
        this.addSkyBoxes(config);
        this.reactiCtnrSzChng(container);
        ThreeUtils.addAxesHelper(this.scene);
        ThreeUtils.addRaycaster(this.camera, this.scene, this.renderer, this.dispatchMarkEvent.bind(this))
        const { controls } = ThreeUtils.addControls(this.camera, this.scene, this.renderer);
        this.contorls = controls;
        this.viewFirstSkyBox();
        window['THREE'] = THREE;
    }
    /**
     * 当前天空盒
     */
    get currentSkyBox () {
        return this.skyBoxes.find(item => item.id === this.currentSkyBoxId);
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
        return observer;
    }
    /**
     * 获取索引
     * @param test 
     * @returns 
     */
    private getSkyBoxIndex(test = 0) {
        const isExisted = this.skyBoxes.find(item => item.index === test);
        if(!isExisted) {
            return test;
        }
        return this.getSkyBoxIndex(test + 1);
    }
    /**
     * 改变材质
     * @param imgUrl 
     */
    public changeMaterial(id: ISkyBox['id'], imgUrl: string) {
        const skyBox = this.skyBoxes.find(item => item.id === id);
        if(!skyBox) throw Error(`查询天空盒（${id}）：失败，未找到。`)
        if(skyBox.material.map) {
            skyBox.material.map.image.imgUrl = imgUrl;
            skyBox.material.map.needsUpdate = true;
        }else {
            skyBox.material.dispose();
            skyBox.mesh.material = skyBox.material = ThreeUtils.createSkyBoxMaterial(imgUrl);
        }
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
    private dispatchMarkEvent(type: 'mousemove' | 'click', intersects: TIntersects) {
        const eventSource = this.getEventSoure(intersects);
        if(this.activeMarkMesh === eventSource && type === 'mousemove') {
            return this.activeMarkMesh;
        }
        if(this.activeMarkMesh === eventSource && type === 'click') {
            eventSource && this.reactMarkEvent('click', eventSource);
            return this.activeMarkMesh = eventSource;
        }
        if(this.activeMarkMesh !== eventSource && type === 'mousemove') {
            eventSource && this.reactMarkEvent('mouseover', eventSource);
            this.activeMarkMesh && this.reactMarkEvent('mouseleave', this.activeMarkMesh)
            return this.activeMarkMesh = eventSource;
        }
    }
    /**
     * 响应标识鼠标事件
     * @param type 
     * @param eventSource 
     */
    private reactMarkEvent(type: TSkyBoxMarkEventType, eventSource: THREE.Object) {
        const uuid = eventSource?.uuid;
        if(!uuid) return;
        for(const skb of this.skyBoxes) {
            const mark = skb.marks.find(item => item.uuid === uuid);
            if(!mark) continue;
            (mark.events || []).forEach(item => {
                if(item.type === type && typeof item.handler === "function") {
                    item.handler({type, source: eventSource})
                }
            })
            if(mark) return;
        }
    }
    /**
     * 获取事件源
     * @param intersects 
     * @returns 
     */
    private getEventSoure(intersects: TIntersects): THREE.Object{
        const marks = intersects.filter(item => {
            return item.object.name === SKY_BOX_MARK_LABEL;
        }).sort((a, b) => {
            return a.distance - b.distance;
        })
        // 取第一个对象作为事件源
        const [ mark ] = marks;
        return mark?.object || null;
    }
    /**
     * 浏览天空盒子
     * @param id 
     */
    public async viewSkyBox(id: ISkyBox['id']) {
        const skyBox = this.skyBoxes.find(item => item.id === id);
        if(!skyBox) throw Error(`查询天空盒（${id}）：失败，未找到。`);
        if(this.isTransfering) {
            return console.warn('场景切换中')
        }
        await this.doTransfer({x: skyBox.position.x, y: skyBox.position.y, z: skyBox.position.z});
        this.currentSkyBoxId = id;
        this.isTransfering = false;
    }
    /**
     * 执行相机转场
     * @param pos 
     * @returns 
     */
    private async doTransfer(pos: IVector3) {
        const doCameraTrans = () => {
            const from = {
                camrPosX: this.camera.position.x,
                camrPosY: this.camera.position.y,
                camrPosZ: this.camera.position.z,
                targetX: this.contorls.target.x,
                targetY: this.contorls.target.y,
                targetZ: this.contorls.target.z,
            }
            const to = {
                camrPosX: pos.x,
                camrPosY: pos.y,
                camrPosZ: pos.z,
                targetX: pos.x,
                targetY: pos.y,
                // 避免相机不能转动
                targetZ: pos.z + 1
            }
            return TweenUtils.createCameraTransfer(from, to, (e) => {
                this.camera.position.set(e.camrPosX, e.camrPosY, e.camrPosZ)
                this.contorls.target.set(e.targetX, e.targetY, e.targetZ)
            }, 750)
        }
        const doFilterTrans = () => {
            const from = {blur: 0, density: 0};
            const to = {blur: 25, density: 0.0045}
            return TweenUtils.createTransferFilter(from, to, e => {
                this.scene.fog.density = e.density;
                this.renderer.domElement.style.filter = `blur(${e.blur}px)`;
            }, 1000)
        }
        return await Promise.all([doCameraTrans(), doFilterTrans()])
        
    }
    /**
     * 默认浏览第一个天空盒子
     */
    private viewFirstSkyBox() {
        const [first] = this.skyBoxes;
        if(first) {
            this.viewSkyBox(first.id);
        }
    }
    /**
     * 生成天空盒子
     * @param imgUrl 
     * @returns 
     */
    public createSkyBox(config: ISkyBoxConfig, index: number): ISkyBox {
        const imgUrl = config.imgUrl || '';
        const radius = 500;
        const position: IVector3 = {
            x: 0,
            y: 0,
            z: radius * index * 2,
        };
        const material = ThreeUtils.createSkyBoxMaterial(config.imgUrl || '');
        const geometry = ThreeUtils.createSkyBoxGeometry(radius);
        const mesh = ThreeUtils.createMesh(geometry, material, position);
        const marks = config.marks.map(item => {
            const markMesh = this.createMark(item, radius);
            mesh.add(markMesh);
            return {uuid: markMesh.uuid, mesh: markMesh, events: item.eventsHanlders}
        });
        return {id: generateSkyBoxId(), index, imgUrl, material, geometry, mesh, position, marks, alias: config.alias}
    }
    public createMark(config: ISkyBoxMarkConfig, skyBoxRadius: number): THREE.Mesh {
        const material = ThreeUtils.createMarkMaterial();
        const geometry = ThreeUtils.createMarkGeometry();
        const position = MathUtils.transSphericalcoord2Cartesiancoord(
            config.position.ratioR * skyBoxRadius,
            config.position.angleY,
            config.position.angleZ
        );
        const mesh = ThreeUtils.createMesh(geometry, material, position);
        mesh.name = SKY_BOX_MARK_LABEL;
        return mesh;
    }
    /**
     * 添加天空盒子（支持多个）
     * @param imgUrl 
     */
    public addSkyBoxes(config: ISkyBoxConfig|ISkyBoxConfig[]) {
        const imgUrlList = Array.isArray(config) ? config : typeof config === "string" && [config] || [];
        const addedSkyBoxes = [];
        imgUrlList.forEach(item => {
            const skyBox = this.createSkyBox(item, this.getSkyBoxIndex());
            this.scene.add(skyBox.mesh);
            this.skyBoxes.push(skyBox);
            addedSkyBoxes.push(skyBox);
        })
        return addedSkyBoxes;
    }
    /**
     * 添加天空盒子（单个）
     */
    public addSkyBox(config: ISkyBoxConfig): ISkyBox {
        const index = this.getSkyBoxIndex();
        const skyBox = this.createSkyBox(config, index);
        this.scene.add(skyBox.mesh);
        this.skyBoxes.push(skyBox);
        return skyBox;
    }
    /**
     * 移除天空盒子
     */
    public removeSkyBox(id: string) {
        const index = this.skyBoxes.findIndex(item => item.id === id);
        if(index < 0) throw Error(`查询天空盒（${id}）：失败，未找到。`);
        const [skyBox] = this.skyBoxes.splice(index, 1);
        this.scene.remove(skyBox.mesh);
    }
}