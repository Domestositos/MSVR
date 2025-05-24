'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let shProgramWebCam;            // A shader program for webcam
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let stereoCam;                  // Object holding stereo camera and its parameters

let iTextureWebCam = -1;

let video;

let websocket;
let usePhoneSensor = false;
let orientationMatrix = m4.identity();

function connectToSensorServer() {
    const serverUrl = document.getElementById('serverUrl').value;
    
    if (!serverUrl) {
        alert('Please enter the Sensor Server WebSocket URL');
        return;
    }
    
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
    }
    
    websocket = new WebSocket(serverUrl);
    
    websocket.onopen = function() {
        console.log('Connected to Sensor Server');
        usePhoneSensor = true;
        document.getElementById('connectionStatus').textContent = 'Connected';
        document.getElementById('connectionStatus').style.color = 'green';
    };
    
    websocket.onmessage = handleSensorData;
    
    websocket.onclose = function() {
        console.log('Disconnected from Sensor Server');
        usePhoneSensor = false;
        document.getElementById('connectionStatus').textContent = 'Disconnected';
        document.getElementById('connectionStatus').style.color = 'red';
    };
    
    websocket.onerror = function(error) {
        console.error('WebSocket error:', error);
        usePhoneSensor = false;
        document.getElementById('connectionStatus').textContent = 'Error';
        document.getElementById('connectionStatus').style.color = 'red';
    };
}

function disconnectFromSensorServer() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
    }
    usePhoneSensor = false;
    document.getElementById('connectionStatus').textContent = 'Disconnected';
    document.getElementById('connectionStatus').style.color = 'red';
}

let sp = 0, sr = 0;
const ALPHA = 0.15;
let calibration = null;

function handleSensorData(evt) {
    let msg;
    try {
        msg = JSON.parse(evt.data);
    } catch {
        return;
    }

    const v = Array.isArray(msg) ? msg :
        (Array.isArray(msg.values) ? msg.values : null);
    if (!v || v.length < 3) return;

    const [ax, ay, az] = v;

    const pitch = Math.atan2(-ax, Math.sqrt(ay*ay + az*az));
    const roll  = Math.atan2(ay,  az);

    sp = ALPHA * pitch + (1 - ALPHA) * sp;
    sr = ALPHA * roll  + (1 - ALPHA) * sr;

    if (calibration === null) calibration = { pitch: sp, roll: sr };

    const dPitch = sp - calibration.pitch;
    const dRoll  = sr - calibration.roll;

    const rotX = m4.xRotation(-dRoll);
    const rotY = m4.yRotation( dPitch);
    orientationMatrix = m4.multiply(rotY, rotX);
}

// Constructor
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    this.iAttribTexCoord = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewMatrix = -1;
    this.iProjectionMatrix = -1;
    this.iSampler = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // PATH ZERO: DRAW ZERO PARALLAX WEBCAM
    gl.bindTexture(gl.TEXTURE_2D, iTextureWebCam);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);

    shProgramWebCam.Use();
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(shProgramWebCam.iSampler, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    
    // Switch to main shader for 3D model
    shProgram.Use();
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView;
    if (usePhoneSensor) {
        modelView = orientationMatrix;
    } else {
        modelView = spaceball.getViewMatrix();
    }

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    const colorPolygon = new Float32Array([0.5, 0.5, 0.5, 1]);
    const colorEdge    = new Float32Array([1, 1, 1, 1]);

    // The FIRST PASS (for the left eye)
    let matrLeftFrustum = stereoCam.calcLeftFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrLeftFrustum);

    let translateLeftEye = m4.translation(stereoCam.eyeSeparation/2, 0, 0);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateLeftEye, matAccum0);
    let matAccum2 = m4.multiply(translateToPointZero, matAccum1);
        
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2);

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 0);
    
    gl.colorMask(true, false, false, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon);
    surface.Draw();
    gl.uniform4fv(shProgram.iColor, colorEdge);
    surface.DrawWireframe();

    // The SECOND PASS (for the right eye)
    gl.clear(gl.DEPTH_BUFFER_BIT);

    let matrRightFrustum = stereoCam.calcRightFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrRightFrustum);

    let translateRightEye = m4.translation(-stereoCam.eyeSeparation/2, 0, 0);

    matAccum0 = m4.multiply(rotateToPointZero, modelView);
    matAccum1 = m4.multiply(translateRightEye, matAccum0);
    matAccum2 = m4.multiply(translateToPointZero, matAccum1);

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2);

    gl.colorMask(false, true, true, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon);
    surface.Draw();
    gl.uniform4fv(shProgram.iColor, colorEdge);
    surface.DrawWireframe();

    // RESET specific params to their default state
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    // Create main shader program
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iColor = gl.getUniformLocation(prog, "color");

    // Create webcam shader program
    let progWebCam = createProgram(gl, vertexShaderWebCamSource, fragmentShaderWebCamSource);
    shProgramWebCam = new ShaderProgram('WebCam', progWebCam);
    shProgramWebCam.Use();

    shProgramWebCam.iSampler = gl.getUniformLocation(progWebCam, "video");

    // Create the sinusoid surface
    surface = new Model();
    surface.CreateSurfaceData();
    
    // Initialize stereo camera
    stereoCam = new StereoCamera(
        0.7,     // eyeSeparation (decimeters)
        14.0,    // convergence (decimeters)
        1.3,     // aspectRatio of canvas
        0.4,     // FOV (radians)
        8.0,     // nearClippingDistance (decimeters)
        20.0     // farClippingDistance (decimeters)
    );

    gl.enable(gl.DEPTH_TEST);
}

/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

function updateParameters() {
    const eyeSep = parseFloat(document.getElementById('eyeSeparation').value);
    const fov = parseFloat(document.getElementById('fov').value);
    const near = parseFloat(document.getElementById('nearClipping').value);
    const conv = parseFloat(document.getElementById('convergence').value);
    
    stereoCam.eyeSeparation = eyeSep;
    stereoCam.FOV = fov;
    stereoCam.nearClippingDistance = near;
    stereoCam.convergence = conv;
    
    draw();
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl2");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    video = document.createElement('video');
    video.autoplay = true;

    // Connect to video stream
    let constraints = {video: true};
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;

        let track = stream.getVideoTracks()[0];
        let settings = track.getSettings();

        iTextureWebCam = CreateWebCamTexture(settings.width, settings.height);

        video.play();
    })
    .catch(function(err) {
        console.log(err.name + ": " + err.message);
    });

    // Set up the rendering loop
    setInterval(draw, 1/20 * 1000);

    spaceball = new TrackballRotator(canvas, draw, 0);

    document.getElementById('connectButton').addEventListener('click', connectToSensorServer);
    document.getElementById('disconnectSensorButton').addEventListener('click', disconnectFromSensorServer);

    // Initial draw
    draw();
}