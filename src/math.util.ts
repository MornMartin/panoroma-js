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
}