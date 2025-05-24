function Model() {

    this.stepsU = 50
    this.stepsV = 40

    this.iVertexBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;
    this.type = gl.TRIANGLES;

    this.BufferData = function(vertices, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        if (indices) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STREAM_DRAW);
            this.count = indices.length;
        } else {
            this.count = vertices.length / 3;
        }
    }

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        
        if (this.type === gl.TRIANGLES && this.iIndexBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
            gl.drawElements(this.type, this.count, gl.UNSIGNED_SHORT, 0);
        } else {
            gl.drawArrays(this.type, 0, this.count);
        }
    }

    this.DrawWireframe = function() {
        if (this.iIndexBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
            for (let p=0; p<this.count; p+=3)
                gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, p*2);
        }
    }

    // Surface of Revolution of a General Sinusoid
    this. CalculateCoordinateVertex = function(u, v) {
        let x = (-3 * u - u ** 5 + 2 * u ** 3 * v ** 2 + 3 * u * v ** 4) / (6 * (u ** 2 + v ** 2));
        let y = (-3 * v - 3 * u ** 4 * v - 2 * u ** 2 * v ** 3 + v ** 5) / (6 * (u ** 2 + v ** 2));
        let z = u;

        return [x, y, z]
    }

    this.CreateSurfaceData = function() {
        const vertices = [];
        const indices = [];

        const uMin = -1, uMax = 1;
        const vMin = 0.2, vMax = 1;
        const stepU = (uMax - uMin) / this.stepsU;
        const stepV = (vMax - vMin) / this.stepsV;

        // Сетка вершин
        for (let i = 0; i <= this.stepsU; i++) {
            let u = uMin + i * stepU;
            for (let j = 0; j <= this.stepsV; j++) {
                let v = vMin + j * stepV;
                const [x, y, z] = this.CalculateCoordinateVertex(u, v);
                vertices.push(x, y, z);
            }
        }

        // Индексы треугольников
        for (let i = 0; i < this.stepsU; i++) {
            for (let j = 0; j < this.stepsV; j++) {
                let v0 = i * (this.stepsV + 1) + j;
                let v1 = v0 + 1;
                let v2 = v0 + (this.stepsV + 1);
                let v3 = v2 + 1;

                // Первый треугольник
                indices.push(v0, v1, v2);
                // Второй треугольник
                indices.push(v2, v1, v3);
            }
        }
        
        this.BufferData(new Float32Array(vertices), new Uint16Array(indices));
    }
}
