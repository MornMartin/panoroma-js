import { ISceneConfig } from './../Equirectangular';
import Events from "../Events";
import MathUtils from "./math.util";
import { decodeColor } from "./methods";
import {
    THREE,
    OrbitControls,
    DragControls,
    TransformControls,
    LineSegments2,
    LineGeometry,
    LineMaterial,
    Stats,
    GPUStatsPanel
} from "./three.loader";

/**
 * three.js默认Y轴为向上方向
 */
export interface IVector3 {
    x: number; // 屏幕从右到左
    y: number; // 屏幕从下到上
    z: number; // 屏幕从近到远
}
export interface IViewSize {
    width: number;
    height: number;
}
/**
 * 定义视频播放器类型
 */
export interface IVideoPlayer {
    play(): void;
    pause(): void;
    stop(): void;
    destroy(): void;
    set src(s: string);
    get src(): string;
    get el(): HTMLVideoElement;
}

/**
 * 鼠标投影监听
 */
export type TRaycasterListener = (type: 'mousemove' | 'click' | 'mousedown', intersects: TIntersects, e?: MouseEvent) => void;
export type TIntersects = {distance: number, object: THREE.Object}[];
export default class ThreeUtils {
    /**
     * 创建正交相机
     * @param fov 焦距
     * @param near 近端
     * @param far 远端
     * @returns 
     */
    static createCamera(size: IViewSize, fov = 75, near = 1, far = 1100):THREE.Camera {
        const camera = new THREE.PerspectiveCamera( fov, size.width / size.height, near, far );
        return camera;
    }
    /**
     * 创建场景
     * @returns 
     */
    static createScene(maskColor: string):THREE.Scene {
        const scene = new THREE.Scene();
        scene.fog = ThreeUtils.createFog(maskColor);
        return scene;
    }
    /**
     * 创建渲染器
     * @returns 
     */
    static createRenderer(container: HTMLElement):THREE.WebGLRenderer {
        const renderer = new THREE.WebGLRenderer();
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( container.offsetWidth, container.offsetHeight );
        container.appendChild( renderer.domElement );
        return renderer;
    }
    /**
     * 创建雾化效果
     * @returns 
     */
    static createFog(c: string) {
        const { color } = decodeColor(c)
        return new THREE.FogExp2(color, 0)
    }
    /**
     * 创建播放器
     * @param container 
     * @returns 
     */
    static createVideoPlayer(container: HTMLElement): IVideoPlayer {
        const wrap = document.createElement('div');
        // 用createElement创建的video标签无法实现自动播放
        wrap.innerHTML = `<video loop muted crossOrigin="anonymous" playsinline></video>`
        wrap.style.display = 'none';
        container.appendChild(wrap);
        return {
            play() {
                this.el.play();
            },
            pause() {
                this.el.pause();
            },
            stop() {
                this.pause();
                this.el.currentTime = 0;
            },
            destroy() {
                this.stop();
                container.removeChild(wrap);
            },
            get el() {
                return wrap.querySelector('video')
            },
            set src(s: string) {
                this.stop();
                this.el.removeAttribute('src');
                s && this.el.setAttribute('src', s);
            },
            get src() {
                return this.el.getAttribute('src');
            }
        }
    }
    /**
     * 添加轨道控制器
     * @returns 
     */
    static addControls(camera: THREE.Camera, scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
        let animationId;
        const controls = new OrbitControls( camera, renderer.domElement );
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.enableDamping = true;
        controls.rotateSpeed = - 0.25;
        const event = new Events()
        const animate = () => {
            animationId = requestAnimationFrame( animate );
            event.emit('renderHead')
            controls.update(); // required when damping is enabled
            event.emit('renderStart')
            renderer.render( scene, camera );
            event.emit('renderEnd')
        }
        animate();
        return {
            controls,
            destroy: () => {
                controls.dispose();
                event.off('renderHead');
                event.off('renderStart');
                event.off('renderEnd');
                cancelAnimationFrame(animationId);
            },
            probe: {
                renderHead: (handler: () => void) => {
                    event.on('renderHead', handler)
                },
                renderStart: (handler: () => void) => {
                    event.on('renderStart', handler)
                },
                renderEnd: (hander: () => void) => {
                    event.on('renderEnd', hander)
                }
            }
        }
    }
    /**
     * 添加拖拽控制器
     * @returns 
     */
    static addDragable(object: THREE.object | THREE.object[], camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
        const objects = Array.isArray(object) ? object : [object];
        const controls = new DragControls( objects, camera, renderer.domElement );
        controls.addEventListener( 'dragstart', function ( event ) {
            // event.object.material.emissive.set( 0xaaaaaa );

        } );
        controls.addEventListener( 'dragend', function ( event ) {
            // event.object.material.emissive.set( 0x000000 );

        } );
        return {
            controls,
            destroy: () => {
                controls.dispose();
            }
        }
    }
    /**
     * 添加变换控制器
     * @returns 
     */
    static addTransform(camera: THREE.Camera, scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
        const controls = new TransformControls(camera, renderer.domElement)
        scene.add(controls);
        return {
            controls,
            destroy: () => {
                controls.dispose();
                scene.remove(controls);
            }
        }
    }
    /**
     * 添加鼠标投影
     * @param callback 
     * @returns 
     */
    static addRaycaster(camera: THREE.Camera, scene: THREE.Scene, renderer: THREE.WebGLRenderer, callback: TRaycasterListener) {
        const raycaster = new THREE.Raycaster();
        const trans2Pointer = (e) => {
            const {left, top, width, height} = renderer.domElement.getBoundingClientRect();
            const x = ( (e.clientX - left) / width ) * 2 - 1;
            const y = - ( (e.clientY - top) / height ) * 2 + 1;
            return new THREE.Vector2(x, y)
        }
        const getObjects = (pointer: THREE.Vector2) => {
            raycaster.setFromCamera( pointer, camera );
            const intersects = raycaster.intersectObjects( scene.children );
            return intersects;
        }
        const onPointerMove = ( e ) => {
            const pointer = trans2Pointer(e)
            const intersects = getObjects(pointer);
            typeof callback === "function" && callback('mousemove', intersects, e);
        }
        const onClick = (e) => {
            const pointer = trans2Pointer(e)
            const intersects = getObjects(pointer);
            typeof callback === "function" && callback('click', intersects, e);
        }
        const onMousedown = (e) => {
            const pointer = trans2Pointer(e)
            const intersects = getObjects(pointer);
            typeof callback === "function" && callback('mousedown', intersects, e);
        }
        renderer.domElement.addEventListener( 'pointermove', onPointerMove );
        renderer.domElement.addEventListener('click', onClick);
        renderer.domElement.addEventListener('mousedown', onMousedown)
        return {
            controls: raycaster,
            destroy: () => {
                renderer.domElement.removeEventListener( 'pointermove', onPointerMove );
                renderer.domElement.removeEventListener('click', onClick)
            }
        }
    }
    /**
     * 添加坐标轴
     * @returns 
     */
    static addAxesHelper(scene: THREE.Scene) {
        const axesHelper = new THREE.AxesHelper( 5 );
        scene.add( axesHelper );
        return axesHelper;
    }
    /**
     * 添加FPS统计
     * @param container 
     * @param renderer 
     */
    static addFps(container: HTMLElement, renderer: THREE.WebGLRenderer) {
        const stats = new Stats();
        container.appendChild( stats.dom );
        const gpuPanel = new GPUStatsPanel( renderer.getContext() );
        stats.addPanel( gpuPanel );
        stats.showPanel( 0 );
        return {
            controls: {
                update: () => {
                    stats.update();
                },
                start: () => {
                    gpuPanel.startQuery();
                },
                end: () => {
                    gpuPanel.endQuery();
                }
            },
            destroy: () => {
                container.removeChild(stats.dom);
            }
        }
    }
    /**
     * 创建烘焙模型
     * @param geometry 
     * @param material 
     * @returns 
     */
    static createMesh(geometry: THREE.Geometry, material: THREE.Material, position: IVector3 = {x: 0, y: 0, z: 0}):THREE.Mesh {
        const mesh = new THREE.Mesh( geometry, material );
        mesh.position.set(position.x, position.y, position.z);
        return mesh;
    }
    /**
     * 创建点光源
     * @param color 
     * @param position 
     * @returns 
     */
    static createPointLight(c = '#ffffff', position: IVector3 = {x: 0, y: 0, z: 0}) {
        const { color } = decodeColor(c)
        const light = new THREE.PointLight( color );
        light.position.set( position.x, position.y, position.z );
        return light;
    }
    /**
     * 创建场景
     */
    static createSceneGeometry(radius = 500):THREE.SphereGeometry {
        const geometry = new THREE.SphereGeometry( radius);
        geometry.scale( -1, 1, 1 );
        return geometry;
    }
    static createMarkPointSprite(src: string) {
        if(!src) return new THREE.Object3D();
        const texture = new THREE.TextureLoader().load(src);
        const material = new THREE.SpriteMaterial( { map: texture, side: THREE.DoubleSide, transparent: true } )
        const sprite = new THREE.Sprite( material );
        sprite.scale.set(45, 45, 1);
        return sprite;
    }
    /**
     * 创建热点
     */
    static createMarkPointMesh(position: IVector3, src: string, radius = 15):THREE.Group {
        const { color, opacity } = decodeColor("#ffffff4d");
        const boxGeometry = new THREE.SphereGeometry(radius);
        const boxMaterial = new THREE.MeshLambertMaterial( { color, transparent: true, opacity });
        const boxMesh = ThreeUtils.createMesh(boxGeometry, boxMaterial);
        const sprite = ThreeUtils.createMarkPointSprite(src);
        const grp = new THREE.Group();
        boxMesh.visible = !src;
        grp.position.set(position.x, position.y, position.z);
        grp.add(boxMesh);
        grp.add(sprite);
        return grp;
    }
    /**
     * 创建热区材质
     * @param color 
     * @returns 
     */
    static createMarkZoonMaterial(c = '#ffffff4d') {
        const { color, opacity } = decodeColor(c);
        return new THREE.MeshBasicMaterial( { color, side: THREE.DoubleSide, transparent: true, opacity } )
    }
    /**
     * 创建热区边框材质
     * @param color 
     * @returns 
     */
    static createMarkZoonEdgeMaterial(c = '#cccccc4d') {
        const { color, opacity } = decodeColor(c);
        return new LineMaterial( { color, linewidth: 3, worldUnits: true, transparent: true, opacity, depthTest: false } )
    }
    /**
     * 创建热区
     * @returns 
     */
    static createMarkZoonMesh(position: IVector3, points: IVector3[] = [], colors = {border: '#cccccc4d', fill: '#ffffff4d'}):THREE.Group {
        if(points.length > 2) {
            // 面
            const zoonVertices = new Float32Array(ThreeUtils.encodeTrianglesByPoints(points));
            const zoonGeometry = new THREE.BufferGeometry().setAttribute( 'position', new THREE.BufferAttribute( zoonVertices, 3 ) );
            const zoonMaterial = ThreeUtils.createMarkZoonMaterial(colors.fill);
            const zoonMesh = ThreeUtils.createMesh(zoonGeometry, zoonMaterial);
            const edgeGeometry = new LineGeometry().setPositions( ThreeUtils.transVectorPoints2ArrPoints([...points, points[0]]) );
            const edgeMaterial = ThreeUtils.createMarkZoonEdgeMaterial(colors.border);
            const edgeMesh = new LineSegments2( edgeGeometry, edgeMaterial );
            const grp = new THREE.Group();
            grp.position.set(position.x, position.y, position.z);
            grp.add(zoonMesh);
            grp.add(edgeMesh);
            return grp;
        }
        if(points.length > 1) {
            // 线
            const geometry = new LineGeometry().setPositions( ThreeUtils.transVectorPoints2ArrPoints(points));
            const material = ThreeUtils.createMarkZoonEdgeMaterial(colors.border);
            const mesh = new LineSegments2( geometry, material );
            mesh.position.set(position.x, position.y, position.z);
            return mesh;
        }
        if(points.length > 0) {
            // 点
            return ThreeUtils.createMarkPointMesh(position, '', 2);
        }
        return new THREE.Object3D();
    }
    /**
     * 将热区绝对点转为整体偏移相对点
     * @param points 
     * @returns 
     */
    static transMarkZoonPoints(points: IVector3[]): {center: IVector3, points: IVector3[]} {
        const center = MathUtils.getStereoscopicCenter(points);
        const transedPoints: IVector3[] = points.map(item => {
            return {
                x: item.x - center.x,
                y: item.y - center.y,
                z: item.z - center.z,
            }
        });
        return {center, points: transedPoints};
    }
    static transVectorPoints2ArrPoints(points: IVector3[]) {
        const temp = [];
        points.forEach(item => {
            for(const v in item) {
                temp.push(item[v])
            }
        });
        return temp;
    }
    /**
     * 重置视图
     * @param camera 
     * @param scene 
     * @param renderer 
     * @param size 
     */
    static setViewSize(camera: THREE.Camera, renderer: THREE.WebGLRenderer, size: IViewSize) {
        camera.aspect = size.width / size.height;
        camera.updateProjectionMatrix();
        renderer.setSize( size.width, size.height );
    }
    /**
     * 创建场景材质
     * @param src 
     * @returns 
     */
    static createSceneMaterial(video: IVideoPlayer, source?: ISceneConfig['source']): THREE.MeshBasicMaterial {
        const material = new THREE.MeshBasicMaterial( { color: 0xcccccc, side: THREE.DoubleSide, wireframe: true, opacity: 0.3} )
        video.src = '';
        if(source?.type === 'image' && source?.url) {
            new THREE.TextureLoader().load(
                source.url,
                texture => {
                    material.map = texture;
                    material.wireframe = false;
                    material.needsUpdate = true;
                },
            );
        }
        if(source?.type === 'video' && source.url) {
            // 加载全景视频
            video.src = source.url;
            video.play();
            material.map = new THREE.VideoTexture( video.el );
            material.wireframe = false;
            material.needsUpdate = true;
        }
        return material;
    }
    /**
     * 将一组点转为圈出该区域的三角面
     * @param points 
     * @returns 
     */
    static encodeTrianglesByPoints(points: IVector3[]) {
        if(points.length < 3) throw Error('端点数量不足3');
        let v = [];
        const sunVector = points.reduce((a, b) => {
            return {
                x: a.x + b.x,
                y: a.y + b.y,
                z: a.z + b.z
            }
        });
        const centerPoint = {
            x: sunVector.x / points.length,
            y: sunVector.y / points.length,
            z: sunVector.z / points.length,
        };
        for(let i = 0; i < points.length; i++) {
            const currentPoint = points[i];
            const beforePoint = points[i - 1] || points[points.length - 1];
            v = v.concat([
                centerPoint.x, centerPoint.y, centerPoint.z,
                beforePoint.x, beforePoint.y, beforePoint.z,
                currentPoint.x, currentPoint.y, currentPoint.z,
            ])
        }
        return v;
    }
    /**
     * 取两点间距离
     * @param a 
     * @param b 
     * @returns 
     */
    static getDistance(a: IVector3, b?: IVector3) {
        return Math.sqrt(Math.pow(a.x - b?.x || 0, 2) + Math.pow(a.y - b?.y || 0, 2) + Math.pow(a.z - b?.z || 0, 2))
    }
    /**
     * 加载图片
     * @param src 
     * @returns 
     */
    static loadImageTexture(src: string): Promise<any> {
        return new Promise((resove, reject) => {
            new THREE.ImageLoader().load(src, img => {
                const canvas = document.createElement( 'canvas' );
                const context = canvas.getContext( '2d' );
                context.drawImage(img, 0, 0)
                resove(canvas)
            })
        })
    }
}