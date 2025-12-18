'use strict';

let gl;
let program;
let sphereTextureProgram; // NEW: Separate program for sphere with spherical mapping

// View rotation angles (in radians)
let viewRotX = 0.0;
let viewRotY = 0.0;
let viewRotZ = 0.0;
const ROT_STEP = glMatrix.glMatrix.toRadian(5);

// Texture globals
let woodTexture;
let luxoTexture;
let texturesLoaded = 0;
const NUM_TEXTURES = 2;

var myBase = null;
var mySphere = null;

let nowShowing = 'Fragment';

// Shading globals
let shadingEnabled = false; // Toggle between texture and shading
let perVertexProgram;
let perFragmentProgram;

// Texture loading function from textureMain2.js
function doLoad(theTexture, theImage) {
    gl.bindTexture(gl.TEXTURE_2D, theTexture);
    
    // Critical: flip Y to match WebGL coordinates
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    
    // Upload image data
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, theImage);
    
    // Set wrapping and filtering parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); // CHANGED: Use REPEAT for sphere
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); // CHANGED: Use REPEAT for sphere
    gl.generateMipmap(gl.TEXTURE_2D); 
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.bindTexture(gl.TEXTURE_2D, null);
    
    texturesLoaded++;
    if (texturesLoaded === NUM_TEXTURES) {
        draw(); // Redraw once all high-res textures are ready
    }
}

// Function to set up texture objects and initiate loading
function setUpTextures() {
    // 1. Plywood Texture for Base
    woodTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, woodTexture);
    // Placeholder (Brown)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([100, 50, 0])); 
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    const woodImg = new Image();
    woodImg.onload = () => doLoad(woodTexture, woodImg);
    woodImg.src = './plywood.jpg';

    // 2. Luxo Texture for Sphere
    luxoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, luxoTexture);
    // Placeholder (Red)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 0])); 
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); // CHANGED: Use REPEAT
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); // CHANGED: Use REPEAT

    const luxoImg = new Image();
    luxoImg.onload = () => doLoad(luxoTexture, luxoImg);
    luxoImg.src = './luxo_jr.jpg';
}

function createShapes() {
    myBase = new Cube(1);
    mySphere = new Sphere(16, 16);
    
    // IMPORTANT: Create VAOs with appropriate programs
    // Base uses regular texture program
    myBase.VAO = bindVAO(myBase, program, false);
    
    // Sphere uses spherical mapping program (don't need UVs from shape)
    mySphere.VAO = bindVAO(mySphere, sphereTextureProgram, false, true); // true = skip UV binding
    
    // Then create shading VAOs if shading programs exist
    if (perVertexProgram) {
        myBase.vertexVAO = bindVAO(myBase, perVertexProgram, true);
        mySphere.vertexVAO = bindVAO(mySphere, perVertexProgram, true);
    }
    
    if (perFragmentProgram) {
        myBase.fragmentVAO = bindVAO(myBase, perFragmentProgram, true);
        mySphere.fragmentVAO = bindVAO(mySphere, perFragmentProgram, true);
    }
}

// Add constants for vertical rotation limits
const MIN_VERTICAL_ANGLE = glMatrix.glMatrix.toRadian(-85);
const MAX_VERTICAL_ANGLE = glMatrix.glMatrix.toRadian(85);

function setUpCamera(currentProgram) {
    gl.useProgram(currentProgram);

    // Projection matrix
    let projMatrix = glMatrix.mat4.create();
    glMatrix.mat4.perspective(projMatrix, glMatrix.glMatrix.toRadian(45), gl.canvas.width/gl.canvas.height, 1.0, 300.0);
    
    // Get uniform location for current program
    const uProjT = gl.getUniformLocation(currentProgram, 'uProjT') || 
                   gl.getUniformLocation(currentProgram, 'projT');
    if (uProjT) {
        gl.uniformMatrix4fv(uProjT, false, projMatrix);
    }

    // Orbit camera around target
    let radius = 8.0;
    let target = [0, 1, 0];

    // Clamp vertical rotation to prevent flipping
    viewRotX = Math.max(MIN_VERTICAL_ANGLE, Math.min(MAX_VERTICAL_ANGLE, viewRotX));

    // Convert spherical coordinates to Cartesian
    let horizontalDistance = radius * Math.cos(viewRotX);
    let camX = horizontalDistance * Math.sin(viewRotY);
    let camZ = horizontalDistance * Math.cos(viewRotY);
    let camY = radius * Math.sin(viewRotX) + 1.5; // 1.5 is initial height offset

    let cameraPos = [camX, camY, camZ];
    let up = [0, 1, 0];

    // View matrix
    let viewMatrix = glMatrix.mat4.create();
    glMatrix.mat4.lookAt(viewMatrix, cameraPos, target, up);
    
    // Get uniform location for current program
    const uViewT = gl.getUniformLocation(currentProgram, 'uViewT') || 
                   gl.getUniformLocation(currentProgram, 'viewT');
    if (uViewT) {
        gl.uniformMatrix4fv(uViewT, false, viewMatrix);
    }
}

// UPDATED: bindVAO function with skipUVs parameter
function bindVAO(shape, currentProgram, isShading, skipUVs = false) {
    let vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Positions - always needed
    let vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    
    // Determine vertex size based on program type
    let vertexSize;
    let pointsArray;
    
    // For shading programs, always use 3 components (x, y, z)
    if (isShading) {
        vertexSize = 3;
        
        // Check if shape.points is already 3 components
        if (shape.points.length % 3 === 0) {
            pointsArray = new Float32Array(shape.points);
        } else {
            // Convert from 4 to 3 components if needed
            const numVertices = shape.points.length / 4;
            pointsArray = new Float32Array(numVertices * 3);
            for (let i = 0; i < numVertices; i++) {
                pointsArray[i*3] = shape.points[i*4];
                pointsArray[i*3 + 1] = shape.points[i*4 + 1];
                pointsArray[i*3 + 2] = shape.points[i*4 + 2];
            }
        }
    } else {
        // For texture programs, use 4 components (x, y, z, w)
        vertexSize = 4;
        
        // Check if shape.points is already 4 components
        if (shape.points.length % 4 === 0) {
            pointsArray = new Float32Array(shape.points);
        } else {
            // Convert from 3 to 4 components
            const numVertices = shape.points.length / 3;
            pointsArray = new Float32Array(numVertices * 4);
            for (let i = 0; i < numVertices; i++) {
                pointsArray[i*4] = shape.points[i*3];
                pointsArray[i*4 + 1] = shape.points[i*3 + 1];
                pointsArray[i*4 + 2] = shape.points[i*3 + 2];
                pointsArray[i*4 + 3] = 1.0;
            }
        }
    }
    
    gl.bufferData(gl.ARRAY_BUFFER, pointsArray, gl.STATIC_DRAW);
    
    // Get position attribute location
    const aVertexPosition = gl.getAttribLocation(currentProgram, 'aVertexPosition');
    if (aVertexPosition !== -1) {
        gl.enableVertexAttribArray(aVertexPosition);
        gl.vertexAttribPointer(aVertexPosition, vertexSize, gl.FLOAT, false, 0, 0);
        console.log(`Set vertex attrib for ${isShading ? 'shading' : 'texture'} program with size ${vertexSize}`);
    }

    if (isShading) {
        // Normals for shading
        if (shape.normals && shape.normals.length > 0) {
            let normalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
            
            // Check if normals are in the right format
            let normalsArray;
            if (shape.normals.length % 3 === 0) {
                normalsArray = new Float32Array(shape.normals);
            } else {
                // Try to extract 3-component normals from 4-component array
                const numNormals = shape.normals.length / 4;
                normalsArray = new Float32Array(numNormals * 3);
                for (let i = 0; i < numNormals; i++) {
                    normalsArray[i*3] = shape.normals[i*4];
                    normalsArray[i*3 + 1] = shape.normals[i*4 + 1];
                    normalsArray[i*3 + 2] = shape.normals[i*4 + 2];
                }
            }
            
            gl.bufferData(gl.ARRAY_BUFFER, normalsArray, gl.STATIC_DRAW);
            
            const aNormal = gl.getAttribLocation(currentProgram, 'aNormal');
            if (aNormal !== -1) {
                gl.enableVertexAttribArray(aNormal);
                gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
                console.log('Set normal attrib for shading');
            }
        } else {
            console.warn('Shape has no normals for shading');
        }
    } else if (!skipUVs) {
        // UVs for textures (only for cube/base, not for sphere with spherical mapping)
        if (shape.uv && shape.uv.length > 0) {
            let uvbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, uvbo);
            
            // Check UV format
            let uvArray;
            if (shape.uv.length % 2 === 0) {
                uvArray = new Float32Array(shape.uv);
            } else {
                // Handle potential 3-component UVs
                const numUVs = shape.uv.length / 3;
                uvArray = new Float32Array(numUVs * 2);
                for (let i = 0; i < numUVs; i++) {
                    uvArray[i*2] = shape.uv[i*3];
                    uvArray[i*2 + 1] = shape.uv[i*3 + 1];
                }
            }
            
            gl.bufferData(gl.ARRAY_BUFFER, uvArray, gl.STATIC_DRAW);
            
            const aUV = gl.getAttribLocation(currentProgram, 'aUV');
            if (aUV !== -1) {
                gl.enableVertexAttribArray(aUV);
                gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
            }
        } else {
            console.warn('Shape has no UVs for texturing');
        }
    }

    // Indices - always needed
    let ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    
    // Ensure indices are in Uint16 format
    let indicesArray;
    if (shape.indices instanceof Uint16Array) {
        indicesArray = shape.indices;
    } else if (Array.isArray(shape.indices)) {
        indicesArray = new Uint16Array(shape.indices);
    } else {
        console.error('Invalid indices format');
        indicesArray = new Uint16Array(0);
    }
    
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesArray, gl.STATIC_DRAW);

    // Clean up
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
    return vao;
}

function drawShapes() {
    if (shadingEnabled) {
        drawShapesWithShading();
    } else {
        drawShapesWithTextures();
    }
}

function drawShapesWithTextures() {
    // ---------- Draw Base (Wood) ----------
    gl.useProgram(program);
    
    // Set sampler to Texture Unit 0
    gl.activeTexture(gl.TEXTURE0);
    const uTheTexture = gl.getUniformLocation(program, 'uTheTexture');
    if (uTheTexture) {
        gl.uniform1i(uTheTexture, 0);
    }

    gl.bindTexture(gl.TEXTURE_2D, woodTexture);
    let baseMatrix = glMatrix.mat4.create();
    glMatrix.mat4.scale(baseMatrix, baseMatrix, [7.0, 0.4, 7.0]);
    
    const uModelT = gl.getUniformLocation(program, 'uModelT') || 
                    gl.getUniformLocation(program, 'modelT');
    if (uModelT) {
        gl.uniformMatrix4fv(uModelT, false, baseMatrix);
    }
    
    gl.bindVertexArray(myBase.VAO);
    gl.drawElements(gl.TRIANGLES, myBase.indices.length, gl.UNSIGNED_SHORT, 0);

    // ---------- Draw Sphere (Luxo) with spherical mapping ----------
    gl.useProgram(sphereTextureProgram); // Use spherical mapping shader
    
    // Set sampler to Texture Unit 0 for sphere too
    gl.activeTexture(gl.TEXTURE0);
    const uTheTextureSphere = gl.getUniformLocation(sphereTextureProgram, 'uTheTexture');
    if (uTheTextureSphere) {
        gl.uniform1i(uTheTextureSphere, 0);
    }

    gl.bindTexture(gl.TEXTURE_2D, luxoTexture);
    let sphereMatrix = glMatrix.mat4.create();
    glMatrix.mat4.translate(sphereMatrix, sphereMatrix, [0.0, 0.7, 0.0]);
    
    const uModelTSphere = gl.getUniformLocation(sphereTextureProgram, 'uModelT') || 
                          gl.getUniformLocation(sphereTextureProgram, 'modelT');
    if (uModelTSphere) {
        gl.uniformMatrix4fv(uModelTSphere, false, sphereMatrix);
    }
    
    gl.bindVertexArray(mySphere.VAO);
    gl.drawElements(gl.TRIANGLES, mySphere.indices.length, gl.UNSIGNED_SHORT, 0);
}

function drawShapesWithShading() {
    const currentProgram = (nowShowing === 'Vertex') ? perVertexProgram : perFragmentProgram;
    gl.useProgram(currentProgram);
    
    // Ensure lights are set up (important!)
    setUpLights(currentProgram);

    // ---------- Draw Base with Shading ----------
    setMaterial(currentProgram, 'base');
    let baseMatrix = glMatrix.mat4.create();
    glMatrix.mat4.scale(baseMatrix, baseMatrix, [7.0, 0.4, 7.0]);
    
    const uModelT = gl.getUniformLocation(currentProgram, 'uModelT') || 
                    gl.getUniformLocation(currentProgram, 'modelT');
    if (uModelT) {
        gl.uniformMatrix4fv(uModelT, false, baseMatrix);
    }
    
    if (nowShowing === 'Vertex') {
        gl.bindVertexArray(myBase.vertexVAO);
    } else {
        gl.bindVertexArray(myBase.fragmentVAO);
    }
    gl.drawElements(gl.TRIANGLES, myBase.indices.length, gl.UNSIGNED_SHORT, 0);

    // ---------- Draw Sphere with Shading ----------
    setMaterial(currentProgram, 'sphere');
    let sphereMatrix = glMatrix.mat4.create();
    glMatrix.mat4.translate(sphereMatrix, sphereMatrix, [0.0, 0.7, 0.0]);
    
    if (uModelT) {
        gl.uniformMatrix4fv(uModelT, false, sphereMatrix);
    }
    
    if (nowShowing === 'Vertex') {
        gl.bindVertexArray(mySphere.vertexVAO);
    } else {
        gl.bindVertexArray(mySphere.fragmentVAO);
    }
    gl.drawElements(gl.TRIANGLES, mySphere.indices.length, gl.UNSIGNED_SHORT, 0);
}

// Support Functions (keep these the same)
function getShader(id) {
    const script = document.getElementById(id);
    const shaderString = script.text.trim();
    let shader = (script.type === 'x-shader/x-vertex') ? gl.createShader(gl.VERTEX_SHADER) : gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, shaderString);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function initProgram(v_id, f_id) {
    const vShader = getShader(v_id);
    const fShader = getShader(f_id);
    if (!vShader || !fShader) return null;
    
    let prog = gl.createProgram();
    gl.attachShader(prog, vShader);
    gl.attachShader(prog, fShader);
    gl.linkProgram(prog);
    
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(prog));
        return null;
    }
    
    return prog;
}

function initPrograms() {
    //
    // TEXTURE SHADER (for cube/base)
    //
    program = initProgram('tex-V', 'tex-F');
    gl.useProgram(program);
    program.aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
    program.aUV = gl.getAttribLocation(program, 'aUV');
    program.uModelT = gl.getUniformLocation(program, 'modelT');
    program.uViewT  = gl.getUniformLocation(program, 'viewT');
    program.uProjT  = gl.getUniformLocation(program, 'projT');
    program.uTheTexture = gl.getUniformLocation(program, 'uTheTexture');

    //
    // SPHERICAL MAPPING SHADER (for sphere)
    //
    sphereTextureProgram = initProgram('sphereMap-V', 'tex-F'); // Use same fragment shader
    gl.useProgram(sphereTextureProgram);
    sphereTextureProgram.aVertexPosition = gl.getAttribLocation(sphereTextureProgram, 'aVertexPosition');
    sphereTextureProgram.uModelT = gl.getUniformLocation(sphereTextureProgram, 'modelT');
    sphereTextureProgram.uViewT  = gl.getUniformLocation(sphereTextureProgram, 'viewT');
    sphereTextureProgram.uProjT  = gl.getUniformLocation(sphereTextureProgram, 'projT');
    sphereTextureProgram.uTheTexture = gl.getUniformLocation(sphereTextureProgram, 'uTheTexture');

    //
    // PER-VERTEX PHONG SHADER
    //
    perVertexProgram = initProgram('phong-per-vertex-V', 'phong-per-vertex-F');
    gl.useProgram(perVertexProgram);
    perVertexProgram.aVertexPosition = gl.getAttribLocation(perVertexProgram, 'aVertexPosition');
    perVertexProgram.aNormal = gl.getAttribLocation(perVertexProgram, 'aNormal');
    perVertexProgram.uModelT = gl.getUniformLocation(perVertexProgram, 'modelT');
    perVertexProgram.uViewT  = gl.getUniformLocation(perVertexProgram, 'viewT');
    perVertexProgram.uProjT  = gl.getUniformLocation(perVertexProgram, 'projT');
    perVertexProgram.lightPosition = gl.getUniformLocation(perVertexProgram, 'lightPosition');
    perVertexProgram.ambientLight = gl.getUniformLocation(perVertexProgram, 'ambientLight');
    perVertexProgram.lightColor = gl.getUniformLocation(perVertexProgram, 'lightColor');
    perVertexProgram.baseColor = gl.getAttribLocation(perVertexProgram, 'baseColor');
    perVertexProgram.specHighlightColor = gl.getUniformLocation(perVertexProgram, 'specHighlightColor');
    perVertexProgram.ka = gl.getUniformLocation(perVertexProgram, 'ka');
    perVertexProgram.kd = gl.getUniformLocation(perVertexProgram, 'kd');
    perVertexProgram.ks = gl.getUniformLocation(perVertexProgram, 'ks');
    perVertexProgram.ke = gl.getUniformLocation(perVertexProgram, 'ke');

    //
    // PER-FRAGMENT PHONG SHADER
    //
    perFragmentProgram = initProgram('phong-per-fragment-V', 'phong-per-fragment-F');
    gl.useProgram(perFragmentProgram);
    perFragmentProgram.aVertexPosition = gl.getAttribLocation(perFragmentProgram, 'aVertexPosition');
    perFragmentProgram.aNormal = gl.getAttribLocation(perFragmentProgram, 'aNormal');
    perFragmentProgram.uModelT = gl.getUniformLocation(perFragmentProgram, 'modelT');
    perFragmentProgram.uViewT  = gl.getUniformLocation(perFragmentProgram, 'viewT');
    perFragmentProgram.uProjT  = gl.getUniformLocation(perFragmentProgram, 'projT');
    perFragmentProgram.lightPosition = gl.getUniformLocation(perFragmentProgram, 'lightPosition');
    perFragmentProgram.ambientLight = gl.getUniformLocation(perFragmentProgram, 'ambientLight');
    perFragmentProgram.lightColor = gl.getUniformLocation(perFragmentProgram, 'lightColor');
    perFragmentProgram.baseColor = gl.getUniformLocation(perFragmentProgram, 'baseColor');
    perFragmentProgram.specHighlightColor = gl.getUniformLocation(perFragmentProgram, 'specHighlightColor');
    perFragmentProgram.ka = gl.getUniformLocation(perFragmentProgram, 'ka');
    perFragmentProgram.kd = gl.getUniformLocation(perFragmentProgram, 'kd');
    perFragmentProgram.ks = gl.getUniformLocation(perFragmentProgram, 'ks');
    perFragmentProgram.ke = gl.getUniformLocation(perFragmentProgram, 'ke');
}

function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    drawShapes();
}

// Mouse drag functions (keep these the same)
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

function startDrag(event) {
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
}

function drag(event) {
    if (!isDragging) return;
    
    let deltaX = event.clientX - lastMouseX;
    let deltaY = event.clientY - lastMouseY;
    
    // Scale rotation speed
    viewRotY += deltaX * 0.01;
    viewRotX += deltaY * 0.01;
    
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    
    // Update camera for all programs
    setUpCamera(program);
    setUpCamera(sphereTextureProgram);
    if (perVertexProgram) setUpCamera(perVertexProgram);
    if (perFragmentProgram) setUpCamera(perFragmentProgram);
    
    draw();
}

function endDrag() {
    isDragging = false;
}

// Keep the rest of the functions (setUpLights, setUpPhongUniforms, setMaterial, gotKey)
// These should remain the same as in your original file

// Update init function to include spherical mapping program
function init() {
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas) {
        console.error('Canvas not found');
        return;
    }
    
    window.addEventListener('keydown', gotKey, false);
    gl = canvas.getContext('webgl2');
    
    if (!gl) {
        console.error('WebGL2 not supported');
        return;
    }
    
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    
    // Initialize mouse drag
    canvas.addEventListener('mousedown', startDrag, false);
    canvas.addEventListener('mousemove', drag, false);
    canvas.addEventListener('mouseup', endDrag, false);
    
    // Initialize programs
    initPrograms();
    
    // Create shapes
    createShapes();
    
    // Set up textures
    setUpTextures();
    
    // Set up cameras for all programs
    setUpCamera(program);
    setUpCamera(sphereTextureProgram);
    
    // Set up cameras and uniforms for shading programs
    if (perVertexProgram) {
        setUpCamera(perVertexProgram);
        setUpLights(perVertexProgram);
        setUpPhongUniforms(perVertexProgram);
        setMaterial(perVertexProgram, 'sphere');
    }
    
    if (perFragmentProgram) {
        setUpCamera(perFragmentProgram);
        setUpLights(perFragmentProgram);
        setUpPhongUniforms(perFragmentProgram);
        setMaterial(perFragmentProgram, 'sphere');
    }
    
    // Initial draw
    draw();
}

