import { IVector3 } from './three.util';
export default class MathUtils {
    /**
     * 球坐标转为直角坐标（规定Y轴向上）
     * @param r 与原点距离
     * @param angleY 与原点连线Y轴夹角
     * @param angleZ 与原点连线Z轴夹角
     * @returns 
     */
    static transSphericalcoord2Cartesiancoord(r: number, angleY: number, angleZ: number) {
        const x = r * Math.sin(angleY) * Math.sin(angleZ);
        const y = r * Math.cos(angleY);
        const z = r * Math.sin(angleY) * Math.cos(angleZ);
        return {x, y, z}
    }
    /**
     * 获取立体几何中心
     * @param points 
     * @returns 
     */
    static getStereoscopicCenter(points: IVector3[]): IVector3 {
        if(points.length < 1) {
            return {x: 0, y: 0, z: 0};
        }
        if(points.length < 2 ) {
            return points[0];
        }
        const x = points.map(item => item.x).reduce((a, b) => a + b) / points.length;
        const y = points.map(item => item.y).reduce((a, b) => a + b) / points.length;
        const z = points.map(item => item.z).reduce((a, b) => a + b) / points.length;
        return {x, y, z}
    }
    /**
     * 向量差
     * @param v1 
     * @param v2 
     * @returns 
     */
    static vDiff(v1: IVector3, v2: IVector3): IVector3 {
        return {
            x: v1.x - v2.x,
            y: v1.y - v2.y,
            z: v1.z - v2.z,
        }
    }
    /**
     * 向量和
     * @param v1 
     * @param v2 
     * @returns 
     */
    static vSum(v1: IVector3, v2: IVector3): IVector3 {
        return {
            x: v1.x + v2.x,
            y: v1.y + v2.y,
            z: v1.z + v2.z,
        }
    }
    /**
     * 向量点积
     * @param v1 
     * @param v2 
     * @returns 
     */
    static vDotProduct(v1: IVector3, v2: IVector3): IVector3 {
        return {
            x: v1.x * v2.x,
            y: v1.y * v2.y,
            z: v1.z * v2.z,
        }
    }
    /**
     * 向量距离(欧几里得范数)
     * @param v1 
     * @param v2 
     * @returns 
     */
    static vDist(v1: IVector3, v2: IVector3 = {x: 0, y: 0, z: 0}): number {
        const {x, y, z} = MathUtils.vDiff(v1, v2);
        return Math.sqrt(x * x + y * y + z * z)
    }
    /**
     * 向量数乘
     * @param v 
     * @param n 
     * @returns 
     */
    static vMul(v: IVector3, n: number): IVector3 {
        return {
            x: v.x * n,
            y: v.y * n,
            z: v.z * n,
        }
    }
    /**
     * 向量数乘
     * @param v 
     * @param n 
     * @returns 
     */
    static vDiv(v: IVector3, n: number): IVector3 {
        return {
            x: v.x / n,
            y: v.y / n,
            z: v.z / n,
        }
    }
    /**
     * 向量叉积
     * @param v1 
     * @param v2 
     * @returns 
     */
    static vCrossProduct(v1: IVector3, v2: IVector3): IVector3{
        return {
            x: v1.y * v2.z - v1.z * v2.y,
            y: v1.z * v2.x - v1.x * v2.z,
            z: v1.x * v2.y - v1.y * v2.x,
        }
    }
    /**
     * 直线与球相交点
     * 
     * 源自：https://www.cnblogs.com/kljfdsa/p/9006708.html
     * @param lStart 直线起点
     * @param lEnd 直线终点
     * @param sCenter 球心坐标
     * @param r 球半径 
     * @returns
     */
    static lineIntersectSphere(lineStart: IVector3, lineEnd: IVector3, sphereCenter: IVector3, r: number):{a: IVector3, b: IVector3} {
        const {x: lsx, y: lsy, z: lsz} = lineStart;
        const {x: lex, y: ley, z: lez} = lineEnd;
        const {x: scx, y: scy, z: scz} = sphereCenter;
        if ( lsx != lex ) {
            const kxy = ( ley - lsy ) / ( lex - lsx );
            const bxy = lsy - kxy * lsx;
            const kzx = ( lez - lsz ) / ( lex - lsx );
            const bzx = lsz - kzx * lsx;

            const A = 1 + kxy * kxy + kzx * kzx;
            const B = 2 * kxy * ( bxy - scy ) + 2 * kzx * ( bzx - scz ) - 2 * scx;
            const C = scx * scx + ( bxy - scy ) * ( bxy - scy ) + ( bzx - scz ) * ( bzx - scz ) - r * r;
            
            const x1 = ( -B + Math.sqrt( B * B - 4 * A * C ) ) / ( 2 * A );
            const y1 = kxy * x1 + bxy;
            const z1 = kzx * x1 + bzx;

            const x2 = ( -B - Math.sqrt( B * B - 4 * A * C ) ) / ( 2 * A );
            const y2 = kxy * x2 + bxy;
            const z2 = kzx * x2 + bzx;

            const a = {x: x1, y: y1, z: z1}
            const b = {x: x2, y: y2, z: z2}
            return { a, b }
        }
        if ( lsy != ley ) {
            const kzy = ( lez - lsz ) / ( ley - lsy );
            const bzy = lez - kzy * ley;
            
            const A = 1 + kzy * kzy;
            const B = 2 * kzy * ( bzy - scz ) - 2 * scy;
            const C = scy * scy + ( bzy - scz ) * ( bzy - scz ) + ( lsx - scx ) * ( lsx - scx ) - r * r;
            
            const x1 = lsx;
            const y1 = ( -B + Math.sqrt( B * B - 4 * A * C ) ) / ( 2 * A );
            const z1 = kzy * y1 + bzy;

            const x2 = lsx;
            const y2 = ( -B - Math.sqrt( B * B - 4 * A * C ) ) / ( 2 * A );
            const z2 = kzy * y2 + bzy;

            const a = {x: x1, y: y1, z: z1}
            const b = {x: x2, y: y2, z: z2}
            return { a, b }
        }
        if ( lsz != lez ) {
            const x1 = lsx;
            const y1 = lsy;
            const z1 = scz + Math.sqrt( r * r - ( lsx - scx ) * ( lsx - scx ) - ( lsy - scy ) * ( lsy - scy ) );
            
            const x2 = lsx;
            const y2 = lsy;
            const z2 = scz - Math.sqrt( r * r - ( lsx - scx ) * ( lsx - scx ) - ( lsy - scy ) * ( lsy - scy ) );
            
            const a = {x: x1, y: y1, z: z1}
            const b = {x: x2, y: y2, z: z2}
            return { a, b }
        }
        return null;
    }
}