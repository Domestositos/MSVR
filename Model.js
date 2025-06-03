export class Model {

    constructor() {
        this.positions = [];
        this.uvs = [];
        this.indices = [];
        this.stepsU = 50;
        this.stepsV = 40;
    }

    CalculateCoordinateVertex = function(u, v) {
        let x = (-3 * u - u ** 5 + 2 * u ** 3 * v ** 2 + 3 * u * v ** 4) / (6 * (u ** 2 + v ** 2));
        let y = (-3 * v - 3 * u ** 4 * v - 2 * u ** 2 * v ** 3 + v ** 5) / (6 * (u ** 2 + v ** 2));
        let z = u;

        return [x, y, z]
    }

    CreateSurface = function () {
        const uMin = -1, uMax = 1;
        const vMin = 0.2, vMax = 1;
        const stepU = (uMax - uMin) / this.stepsU;
        const stepV = (vMax - vMin) / this.stepsV;

        const uCount = Math.floor((uMax - uMin) / stepU) + 1;
        const vCount = Math.floor((vMax - vMin) / stepV) + 1;

        for (let i = 0; i < uCount; i++) {
            const u = uMin + i * stepU;
            for (let j = 0; j < vCount; j++) {
                const v = vMin + j * stepV;

                const [x, y, z] = this.CalculateCoordinateVertex(u, v);

                this.positions.push(x, y, z);

                const uTex = (u - uMin) / (uMax - uMin);
                const vTex = (v - vMin) / (vMax - vMin);
                this.uvs.push(uTex, vTex);
            }
        }

        for (let i = 0; i < uCount - 1; i++) {
            for (let j = 0; j < vCount - 1; j++) {
                const idx = i * vCount + j;
                const idxNextU = (i + 1) * vCount + j;

                this.indices.push(idx, idxNextU, idx + 1);
                this.indices.push(idxNextU, idxNextU + 1, idx + 1);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
        geo.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
        geo.setIndex(this.indices);
        geo.computeVertexNormals();
        return geo;
    }

}
