import { THREE, OrbitControls } from "./three.loader";

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
    static createScene():THREE.Scene {
        const scene = new THREE.Scene();
        scene.fog = ThreeUtils.createFog();
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
    static createFog() {
        return new THREE.FogExp2(0xffffff, 0)
    }
    /**
     * 添加轨道控制器
     * @param camera 
     * @param scene 
     * @param renderer 
     * @returns 
     */
    static addControls(camera: THREE.Camera, scene: THREE.Scene, renderer: THREE.WebGLRenderer):{controls: OrbitControls, destroy: () => void} {
        let animationId;
        const controls = new OrbitControls( camera, renderer.domElement );
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.enableDamping = true;
        controls.rotateSpeed = - 0.25;
        const animate = () => {
            animationId = requestAnimationFrame( animate );
            controls.update(); // required when damping is enabled
            renderer.render( scene, camera );
        }
        animate();
        return {controls, destroy: () => {
            cancelAnimationFrame(animationId);
        }}
    }
    /**
     * 添加坐标轴
     * @param scene 
     * @returns 
     */
    static addAxesHelper(scene: THREE.Scene) {
        const axesHelper = new THREE.AxesHelper( 5 );
        scene.add( axesHelper );
        return axesHelper;
    }
    /**
     * 创建烘焙模型
     * @param geometry 
     * @param material 
     * @returns 
     */
    static createMesh(geometry: THREE.Geometry, material: THREE.Material, position: IVector3):THREE.Mesh {
        const mesh = new THREE.Mesh( geometry, material );
        mesh.position.set(position.x, position.y, position.z);
        return mesh;
    }
    /**
     * 创建模型
     */
    static createSphereGeometry(radius = 500):THREE.SphereGeometry {
        const geometry = new THREE.SphereGeometry( radius);
        geometry.scale( -1, 1, 1 );
        return geometry;
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
     * 创建材质
     * @param src 
     * @returns 
     */
    static createMaterial(src?: string): THREE.MeshBasicMaterial {
        if(src) {
            const texture = new THREE.TextureLoader().load(src);
            return new THREE.MeshBasicMaterial( { map: texture, side: THREE.DoubleSide } )
        }else {
            return new THREE.MeshBasicMaterial( { color: 0x156289, side: THREE.DoubleSide, wireframe: true } )
        }
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