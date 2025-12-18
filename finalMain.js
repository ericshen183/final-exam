'use strict';

let gl;
var myCone = null;
let program;
let sphereTextureProgram;

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
let shadingEnabled = false;
let perVertexProgram;
let perFragmentProgram;

// Texture loading function
function doLoad(theTexture, theImage) {
    gl.bindTexture(gl.TEXTURE_2D, theTexture);
    
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, theImage);
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D); 
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.bindTexture(gl.TEXTURE_2D, null);
    
    texturesLoaded++;
    if (texturesLoaded === NUM_TEXTURES) {
        draw();
    }
}

// Function to set up texture objects and initiate loading
function setUpTextures() {
    // 1. Plywood Texture for Base
    woodTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, woodTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([100, 50, 0])); 
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    const woodImg = new Image();
    woodImg.onload = () => doLoad(woodTexture, woodImg);
    woodImg.src = './plywood.jpg';

    // 2. Luxo Texture for Sphere
    luxoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, luxoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 0])); 
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    const luxoImg = new Image();
    luxoImg.onload = () => doLoad(luxoTexture, luxoImg);
    luxoImg.src = './luxo_jr.jpg';
}

function luxoJr() {
    console.log('luxoJr called, shadingEnabled:', shadingEnabled, 'nowShowing:', nowShowing);
    
    // Determine which program to use
    let currentProgram;
    if (shadingEnabled) {
        currentProgram = (nowShowing === 'Vertex') ? perVertexProgram : perFragmentProgram;
        console.log('Using shading program:', currentProgram === perVertexProgram ? 'Vertex' : 'Fragment');
    } else {
        currentProgram = program;
        console.log('Using texture program');
    }
    
    gl.useProgram(currentProgram);
    
    // Set up camera for this program
    setUpCamera(currentProgram);
    
    // Get model matrix uniform location
    const uModelT = gl.getUniformLocation(currentProgram, 'modelT');
    console.log('uModelT location:', uModelT);
    
    // Set up lighting for shading programs
    if (shadingEnabled) {
        console.log('Setting up lighting for shading...');
        
        // Set light position (same as shadeMain.js)
        const lightPos = [-2.0, -4.5, 1.0];
        const lightPosLoc = gl.getUniformLocation(currentProgram, 'lightPosition');
        console.log('lightPosition location:', lightPosLoc);
        if (lightPosLoc !== null && lightPosLoc !== -1) {
            gl.uniform3fv(lightPosLoc, lightPos);
            console.log('Set lightPosition to:', lightPos);
        }
        
        // Set light color (same as shadeMain.js)
        const lightColor = [1.2, 1.0, 1.0];
        const lightColorLoc = gl.getUniformLocation(currentProgram, 'lightColor');
        console.log('lightColor location:', lightColorLoc);
        if (lightColorLoc !== null && lightColorLoc !== -1) {
            gl.uniform3fv(lightColorLoc, lightColor);
            console.log('Set lightColor to:', lightColor);
        }
        
        // Set ambient light (same as shadeMain.js)
        const ambientLight = [0.5, 0.5, 0.5];
        const ambientLightLoc = gl.getUniformLocation(currentProgram, 'ambientLight');
        console.log('ambientLight location:', ambientLightLoc);
        if (ambientLightLoc !== null && ambientLightLoc !== -1) {
            gl.uniform3fv(ambientLightLoc, ambientLight);
            console.log('Set ambientLight to:', ambientLight);
        }
        
        // Set Phong coefficients (same as shadeMain.js)
        const kaLoc = gl.getUniformLocation(currentProgram, 'ka');
        const kdLoc = gl.getUniformLocation(currentProgram, 'kd');
        const ksLoc = gl.getUniformLocation(currentProgram, 'ks');
        const keLoc = gl.getUniformLocation(currentProgram, 'ke');
        
        if (kaLoc !== null && kaLoc !== -1) gl.uniform1f(kaLoc, 0.45);
        if (kdLoc !== null && kdLoc !== -1) gl.uniform1f(kdLoc, 0.9);
        if (ksLoc !== null && ksLoc !== -1) gl.uniform1f(ksLoc, 0.9);
        if (keLoc !== null && keLoc !== -1) gl.uniform1f(keLoc, 10.0);
        
        console.log('Set Phong coefficients: ka=0.45, kd=0.9, ks=0.9, ke=10.0');
    }
    
    const drawPart = (shape, matrix, color, isBulb = false) => {
        if (!uModelT) {
            console.error('modelT uniform not found');
            return;
        }
        
        gl.uniformMatrix4fv(uModelT, false, matrix);
        console.log('Set model matrix for part');
        
        if (shadingEnabled) {
            // Set base color for all parts
            const baseColorLoc = gl.getUniformLocation(currentProgram, 'baseColor');
            if (baseColorLoc !== null && baseColorLoc !== -1) {
                gl.uniform3fv(baseColorLoc, color);
                console.log('Set baseColor to:', color, isBulb ? '(bulb)' : '');
            }
            
            // Set specular color
            const specColorLoc = gl.getUniformLocation(currentProgram, 'specHighlightColor');
            if (specColorLoc !== null && specColorLoc !== -1) {
                if (isBulb) {
                    // Bulb - no specular
                    gl.uniform3fv(specColorLoc, [0.0, 0.0, 0.0]);
                    console.log('Set specHighlightColor to [0,0,0] for bulb');
                } else {
                    // Other parts - white specular
                    gl.uniform3fv(specColorLoc, [1.0, 1.0, 1.0]);
                    console.log('Set specHighlightColor to [1,1,1]');
                }
            }
            
            if (isBulb) {
                // For bulb, override lighting to make it emissive
                const ambientLightLoc = gl.getUniformLocation(currentProgram, 'ambientLight');
                if (ambientLightLoc !== null && ambientLightLoc !== -1) {
                    gl.uniform3fv(ambientLightLoc, [1.0, 1.0, 1.0]); // Full white ambient
                    console.log('Override ambientLight to [1,1,1] for bulb');
                }
                
                const lightColorLoc = gl.getUniformLocation(currentProgram, 'lightColor');
                if (lightColorLoc !== null && lightColorLoc !== -1) {
                    gl.uniform3fv(lightColorLoc, [0.0, 0.0, 0.0]); // No external light
                    console.log('Override lightColor to [0,0,0] for bulb');
                }
                
                const kaLoc = gl.getUniformLocation(currentProgram, 'ka');
                const kdLoc = gl.getUniformLocation(currentProgram, 'kd');
                const ksLoc = gl.getUniformLocation(currentProgram, 'ks');
                
                if (kaLoc !== null && kaLoc !== -1) gl.uniform1f(kaLoc, 1.0); // Full ambient
                if (kdLoc !== null && kdLoc !== -1) gl.uniform1f(kdLoc, 0.0); // No diffuse
                if (ksLoc !== null && ksLoc !== -1) gl.uniform1f(ksLoc, 0.0); // No specular
                
                console.log('Override coefficients for bulb: ka=1.0, kd=0.0, ks=0.0');
            }
        } else {
            // Texture mode - use solid color
            gl.activeTexture(gl.TEXTURE1);
            let colorTex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, colorTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, 
                new Uint8Array([color[0]*255, color[1]*255, color[2]*255]));
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            
            const uTheTexture = gl.getUniformLocation(currentProgram, 'uTheTexture');
            if (uTheTexture) {
                gl.uniform1i(uTheTexture, 1);
            }
        }

        // Select appropriate VAO
        let vao;
        if (shadingEnabled) {
            vao = (nowShowing === 'Vertex') ? shape.vertexVAO : shape.fragmentVAO;
        } else {
            vao = shape.VAO;
        }
        
        if (!vao) {
            console.error('VAO not found for shape');
            return;
        }
        
        console.log('Drawing shape with', shape.indices.length, 'indices');
        gl.bindVertexArray(vao);
        gl.drawElements(gl.TRIANGLES, shape.indices.length, gl.UNSIGNED_SHORT, 0);
        
        // Reset texture unit for texture mode
        if (!shadingEnabled) {
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
        
        // Reset lighting for bulb after drawing
        if (shadingEnabled && isBulb) {
            console.log('Resetting lighting after bulb...');
            // Reset to normal lighting values
            const ambientLightLoc = gl.getUniformLocation(currentProgram, 'ambientLight');
            if (ambientLightLoc !== null && ambientLightLoc !== -1) {
                gl.uniform3fv(ambientLightLoc, [0.5, 0.5, 0.5]);
            }
            
            const lightColorLoc = gl.getUniformLocation(currentProgram, 'lightColor');
            if (lightColorLoc !== null && lightColorLoc !== -1) {
                gl.uniform3fv(lightColorLoc, [1.2, 1.0, 1.0]);
            }
            
            const kaLoc = gl.getUniformLocation(currentProgram, 'ka');
            const kdLoc = gl.getUniformLocation(currentProgram, 'kd');
            const ksLoc = gl.getUniformLocation(currentProgram, 'ks');
            
            if (kaLoc !== null && kaLoc !== -1) gl.uniform1f(kaLoc, 0.45);
            if (kdLoc !== null && kdLoc !== -1) gl.uniform1f(kdLoc, 0.9);
            if (ksLoc !== null && ksLoc !== -1) gl.uniform1f(ksLoc, 0.9);
        }
    };

    let modelMatrix = glMatrix.mat4.create();
    glMatrix.mat4.translate(modelMatrix, modelMatrix, [-2.5, 0.4, 0.0]);
    glMatrix.mat4.rotateY(modelMatrix, modelMatrix, glMatrix.glMatrix.toRadian(180));

    const grey = [0.6, 0.6, 0.6];
    const lightYellow = [1.0, 1.0, 0.7];

    console.log('Drawing Luxo Jr. parts...');

    // 1. THE BASE (Cone)
    let baseMatrix = glMatrix.mat4.create();
    glMatrix.mat4.copy(baseMatrix, modelMatrix);
    glMatrix.mat4.scale(baseMatrix, baseMatrix, [1.8, 0.4, 1.8]); 
    if (myCone) {
        console.log('Drawing cone base...');
        drawPart(myCone, baseMatrix, grey);
    }

    // 2. LOWER ARM (Cube)
    glMatrix.mat4.translate(modelMatrix, modelMatrix, [0.0, 0.2, 0.0]);
    glMatrix.mat4.rotateZ(modelMatrix, modelMatrix, glMatrix.glMatrix.toRadian(-20));
    let lowerArmMatrix = glMatrix.mat4.create();
    glMatrix.mat4.copy(lowerArmMatrix, modelMatrix);
    glMatrix.mat4.translate(lowerArmMatrix, lowerArmMatrix, [0.0, 0.75, 0.0]);
    glMatrix.mat4.scale(lowerArmMatrix, lowerArmMatrix, [0.15, 1.5, 0.15]);
    console.log('Drawing lower arm...');
    drawPart(myBase, lowerArmMatrix, grey);

    // 3. UPPER ARM (Cube)
    glMatrix.mat4.translate(modelMatrix, modelMatrix, [0.0, 1.5, 0.0]);
    glMatrix.mat4.rotateZ(modelMatrix, modelMatrix, glMatrix.glMatrix.toRadian(45));
    let upperArmMatrix = glMatrix.mat4.create();
    glMatrix.mat4.copy(upperArmMatrix, modelMatrix);
    glMatrix.mat4.translate(upperArmMatrix, upperArmMatrix, [0.0, 0.6, 0.0]);
    glMatrix.mat4.scale(upperArmMatrix, upperArmMatrix, [0.12, 1.2, 0.12]);
    console.log('Drawing upper arm...');
    drawPart(myBase, upperArmMatrix, grey);

    // 4. THE SHADE (Cone)
    glMatrix.mat4.translate(modelMatrix, modelMatrix, [0.0, 1.2, 0.0]);
    glMatrix.mat4.rotateZ(modelMatrix, modelMatrix, glMatrix.glMatrix.toRadian(-100));
    
    let shadeMatrix = glMatrix.mat4.create();
    glMatrix.mat4.copy(shadeMatrix, modelMatrix);
    glMatrix.mat4.scale(shadeMatrix, shadeMatrix, [1.2, 0.8, 1.2]); 
    if (myCone) {
        console.log('Drawing shade...');
        drawPart(myCone, shadeMatrix, grey);
    }

    // 5. THE BULB (Sphere) - only this part emits light
    let bulbMatrix = glMatrix.mat4.create();
    glMatrix.mat4.copy(bulbMatrix, modelMatrix);
    
    glMatrix.mat4.translate(bulbMatrix, bulbMatrix, [-0.3, -0.53, 0.0]); 
    glMatrix.mat4.scale(bulbMatrix, bulbMatrix, [0.4, 0.4, 0.4]);
    
    console.log('Drawing bulb (emissive)...');
    drawPart(mySphere, bulbMatrix, lightYellow, true);
}

function createShapes() {
    myBase = new Cube(1);
    mySphere = new Sphere(16, 16);
    myCone = new Cone(16, 16);
    
    // Debug: Check if shapes have UVs
    console.log('Base has UVs?', myBase.uv && myBase.uv.length > 0, 'Length:', myBase.uv ? myBase.uv.length : 0);
    console.log('Sphere has UVs?', mySphere.uv && mySphere.uv.length > 0, 'Length:', mySphere.uv ? mySphere.uv.length : 0);
    
    // Bind VAOs for the Cone
    myCone.VAO = bindVAO(myCone, program, false);
    if (perVertexProgram) myCone.vertexVAO = bindVAO(myCone, perVertexProgram, true);
    if (perFragmentProgram) myCone.fragmentVAO = bindVAO(myCone, perFragmentProgram, true);
    
    // Base uses regular texture program
    myBase.VAO = bindVAO(myBase, program, false);
    
    // Sphere uses spherical mapping program
    mySphere.VAO = bindVAO(mySphere, sphereTextureProgram, false);
    
    // Create shading VAOs
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
    if (!currentProgram) return;
    
    gl.useProgram(currentProgram);

    // Projection matrix
    let projMatrix = glMatrix.mat4.create();
    glMatrix.mat4.perspective(projMatrix, glMatrix.glMatrix.toRadian(45), 
        gl.canvas.width/gl.canvas.height, 1.0, 300.0);
    
    if (currentProgram.uProjT) {
        gl.uniformMatrix4fv(currentProgram.uProjT, false, projMatrix);
    }

    // Clamp vertical rotation
    viewRotX = Math.max(MIN_VERTICAL_ANGLE, Math.min(MAX_VERTICAL_ANGLE, viewRotX));

    // Orbit camera around target
    let radius = 8.0;
    let target = [0, 1, 0];
    
    // Convert spherical coordinates to Cartesian
    let horizontalDistance = radius * Math.cos(viewRotX);
    let camX = horizontalDistance * Math.sin(viewRotY);
    let camZ = horizontalDistance * Math.cos(viewRotY);
    let camY = radius * Math.sin(viewRotX) + 1.5;

    let cameraPos = [camX, camY, camZ];

    // View matrix
    let viewMatrix = glMatrix.mat4.create();
    glMatrix.mat4.lookAt(viewMatrix, cameraPos, target, [0, 1, 0]);
    
    if (currentProgram.uViewT) {
        gl.uniformMatrix4fv(currentProgram.uViewT, false, viewMatrix);
    }
}

// bindVAO function
function bindVAO(shape, currentProgram, isShading, skipUVs = false) {
    let vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Positions
    let vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    
    let vertexSize;
    let pointsArray;
    
    if (isShading) {
        vertexSize = 3;
        
        if (shape.points.length % 3 === 0) {
            pointsArray = new Float32Array(shape.points);
        } else {
            const numVertices = shape.points.length / 4;
            pointsArray = new Float32Array(numVertices * 3);
            for (let i = 0; i < numVertices; i++) {
                pointsArray[i*3] = shape.points[i*4];
                pointsArray[i*3 + 1] = shape.points[i*4 + 1];
                pointsArray[i*3 + 2] = shape.points[i*4 + 2];
            }
        }
    } else {
        vertexSize = 4;
        
        if (shape.points.length % 4 === 0) {
            pointsArray = new Float32Array(shape.points);
        } else {
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
    
    const aVertexPosition = gl.getAttribLocation(currentProgram, 'aVertexPosition');
    if (aVertexPosition !== -1) {
        gl.enableVertexAttribArray(aVertexPosition);
        gl.vertexAttribPointer(aVertexPosition, vertexSize, gl.FLOAT, false, 0, 0);
    }

    if (isShading) {
        // Normals for shading
        if (shape.normals && shape.normals.length > 0) {
            let normalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
            
            let normalsArray;
            if (shape.normals.length % 3 === 0) {
                normalsArray = new Float32Array(shape.normals);
            } else {
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
            }
        }
    } else {
        // UVs for textures - for ALL non-shading programs
        if (shape.uv && shape.uv.length > 0) {
            let uvbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, uvbo);
            
            let uvArray;
            if (shape.uv.length % 2 === 0) {
                uvArray = new Float32Array(shape.uv);
            } else {
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
            } else {
                console.log('Warning: Program does not have aUV attribute:', currentProgram);
            }
        } else {
            console.log('Warning: Shape does not have UV coordinates:', shape);
        }
    }

    // Indices
    let ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    
    let indicesArray;
    if (shape.indices instanceof Uint16Array) {
        indicesArray = shape.indices;
    } else if (Array.isArray(shape.indices)) {
        indicesArray = new Uint16Array(shape.indices);
    } else {
        indicesArray = new Uint16Array(0);
    }
    
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesArray, gl.STATIC_DRAW);

    // Clean up
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    
    return vao;
}

function drawShapes() {
    if (shadingEnabled) {
        drawShapesWithShading();
    } else {
        drawShapesWithTextures();
    }
    luxoJr();
}

function drawShapesWithTextures() {
    console.log('drawShapesWithTextures called');
    
    // Draw Base (Wood)
    gl.useProgram(program);
    
    // Set up camera for this program
    setUpCamera(program);
    
    // Bind the wood texture to texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, woodTexture);
    
    // Set the texture uniform
    const uTheTexture = gl.getUniformLocation(program, 'uTheTexture');
    if (uTheTexture) {
        gl.uniform1i(uTheTexture, 0);
        console.log('Set uTheTexture to texture unit 0 for base');
    }
    
    // Create transformation matrix for the base
    let baseMatrix = glMatrix.mat4.create();
    glMatrix.mat4.scale(baseMatrix, baseMatrix, [7.0, 0.4, 7.0]);
    
    // Set the model matrix uniform
    const uModelT = gl.getUniformLocation(program, 'modelT');
    if (uModelT) {
        gl.uniformMatrix4fv(uModelT, false, baseMatrix);
        console.log('Set model matrix for base');
    }
    
    // Draw the base
    if (myBase && myBase.VAO) {
        gl.bindVertexArray(myBase.VAO);
        gl.drawElements(gl.TRIANGLES, myBase.indices.length, gl.UNSIGNED_SHORT, 0);
        console.log('Drew base with', myBase.indices.length, 'indices');
    } else {
        console.error('Base or its VAO not found');
    }

    // Draw Sphere (Luxo) with spherical mapping
    gl.useProgram(sphereTextureProgram);
    
    // Set up camera for this program
    setUpCamera(sphereTextureProgram);
    
    // Bind the luxo texture to texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, luxoTexture);
    
    // Set the texture uniform for sphere program
    const uTheTextureSphere = gl.getUniformLocation(sphereTextureProgram, 'uTheTexture');
    if (uTheTextureSphere) {
        gl.uniform1i(uTheTextureSphere, 0);
        console.log('Set uTheTexture to texture unit 0 for sphere');
    }
    
    // Create transformation matrix for the sphere
    let sphereMatrix = glMatrix.mat4.create();
    glMatrix.mat4.translate(sphereMatrix, sphereMatrix, [0.0, 0.7, 0.0]);
    
    // Set the model matrix uniform for sphere
    const uModelTSphere = gl.getUniformLocation(sphereTextureProgram, 'modelT');
    if (uModelTSphere) {
        gl.uniformMatrix4fv(uModelTSphere, false, sphereMatrix);
        console.log('Set model matrix for sphere');
    }
    
    // Draw the sphere
    if (mySphere && mySphere.VAO) {
        gl.bindVertexArray(mySphere.VAO);
        gl.drawElements(gl.TRIANGLES, mySphere.indices.length, gl.UNSIGNED_SHORT, 0);
        console.log('Drew sphere with', mySphere.indices.length, 'indices');
    } else {
        console.error('Sphere or its VAO not found');
    }
    
    // Clean up
    gl.bindVertexArray(null);
}

function drawShapesWithShading() {
    console.log('drawShapesWithShading called');
    const currentProgram = (nowShowing === 'Vertex') ? perVertexProgram : perFragmentProgram;
    
    // Set up camera
    setUpCamera(currentProgram);
    
    gl.useProgram(currentProgram);
    
    // Set up lighting (same as shadeMain.js)
    const ambientLight = [0.5, 0.5, 0.5];
    const lightPos = [-2.0, -4.5, 1.0];
    const lightColor = [1.2, 1.0, 1.0];
    const baseColor = [0.6, 0.6, 0.6];
    const specColor = [1.0, 1.0, 1.0];
    
    // Debug log all uniform locations
    console.log('Setting up ground base lighting...');
    console.log('ambientLight location:', gl.getUniformLocation(currentProgram, 'ambientLight'));
    console.log('lightPosition location:', gl.getUniformLocation(currentProgram, 'lightPosition'));
    console.log('lightColor location:', gl.getUniformLocation(currentProgram, 'lightColor'));
    console.log('baseColor location:', gl.getUniformLocation(currentProgram, 'baseColor'));
    console.log('specHighlightColor location:', gl.getUniformLocation(currentProgram, 'specHighlightColor'));
    
    if (currentProgram.ambientLight) gl.uniform3fv(currentProgram.ambientLight, ambientLight);
    if (currentProgram.lightPosition) gl.uniform3fv(currentProgram.lightPosition, lightPos);
    if (currentProgram.lightColor) gl.uniform3fv(currentProgram.lightColor, lightColor);
    if (currentProgram.baseColor) gl.uniform3fv(currentProgram.baseColor, baseColor);
    if (currentProgram.specHighlightColor) gl.uniform3fv(currentProgram.specHighlightColor, specColor);
    
    // Phong coefficients
    if (currentProgram.ka) gl.uniform1f(currentProgram.ka, 0.45);
    if (currentProgram.kd) gl.uniform1f(currentProgram.kd, 0.9);
    if (currentProgram.ks) gl.uniform1f(currentProgram.ks, 0.9);
    if (currentProgram.ke) gl.uniform1f(currentProgram.ke, 10.0);
    
    // Draw ground base
    let baseMatrix = glMatrix.mat4.create();
    glMatrix.mat4.scale(baseMatrix, baseMatrix, [7.0, 0.4, 7.0]);
    
    if (currentProgram.uModelT) {
        gl.uniformMatrix4fv(currentProgram.uModelT, false, baseMatrix);
    }
    
    const vaoToUse = (nowShowing === 'Vertex') ? myBase.vertexVAO : myBase.fragmentVAO;
    console.log('Using VAO:', vaoToUse ? 'found' : 'not found');
    
    if (vaoToUse) {
        gl.bindVertexArray(vaoToUse);
        gl.drawElements(gl.TRIANGLES, myBase.indices.length, gl.UNSIGNED_SHORT, 0);
        console.log('Drew ground base with', myBase.indices.length, 'indices');
    } else {
        console.error('VAO not found for ground base');
    }
}

// Support Functions
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
    
    // Store uniform locations
    prog.uModelT = gl.getUniformLocation(prog, 'modelT');
    prog.uViewT = gl.getUniformLocation(prog, 'viewT');
    prog.uProjT = gl.getUniformLocation(prog, 'projT');
    
    // Store attribute locations
    prog.aVertexPosition = gl.getAttribLocation(prog, 'aVertexPosition');
    prog.aNormal = gl.getAttribLocation(prog, 'aNormal');
    
    // Store texture attribute if it exists
    prog.aUV = gl.getAttribLocation(prog, 'aUV');
    
    // Store texture uniform if it exists
    prog.uTheTexture = gl.getUniformLocation(prog, 'uTheTexture');
    
    // Store Phong lighting uniforms if they exist
    prog.ambientLight = gl.getUniformLocation(prog, 'ambientLight');
    prog.lightPosition = gl.getUniformLocation(prog, 'lightPosition');
    prog.lightColor = gl.getUniformLocation(prog, 'lightColor');
    prog.baseColor = gl.getUniformLocation(prog, 'baseColor');
    prog.specHighlightColor = gl.getUniformLocation(prog, 'specHighlightColor');
    prog.ka = gl.getUniformLocation(prog, 'ka');
    prog.kd = gl.getUniformLocation(prog, 'kd');
    prog.ks = gl.getUniformLocation(prog, 'ks');
    prog.ke = gl.getUniformLocation(prog, 'ke');
    
    return prog;
}

function initPrograms() {
    console.log('Initializing programs...');
    
    // TEXTURE SHADER (for cube/base)
    program = initProgram('tex-V', 'tex-F');
    console.log('Texture program initialized:', program ? 'yes' : 'no');
    
    // SPHERICAL MAPPING SHADER (for sphere)
    sphereTextureProgram = initProgram('sphereMap-V', 'tex-F');
    console.log('Sphere texture program initialized:', sphereTextureProgram ? 'yes' : 'no');
    
    // PER-VERTEX PHONG SHADER
    perVertexProgram = initProgram('phong-per-vertex-V', 'phong-per-vertex-F');
    console.log('Per-vertex program initialized:', perVertexProgram ? 'yes' : 'no');
    
    // PER-FRAGMENT PHONG SHADER
    perFragmentProgram = initProgram('phong-per-fragment-V', 'phong-per-fragment-F');
    console.log('Per-fragment program initialized:', perFragmentProgram ? 'yes' : 'no');
    
    // Check if Phong shaders have the required uniforms
    if (perVertexProgram) {
        console.log('Per-vertex program uniforms:');
        console.log('  ambientLight:', perVertexProgram.ambientLight);
        console.log('  lightPosition:', perVertexProgram.lightPosition);
        console.log('  lightColor:', perVertexProgram.lightColor);
        console.log('  baseColor:', perVertexProgram.baseColor);
        console.log('  specHighlightColor:', perVertexProgram.specHighlightColor);
    }
}

function testShaders() {
    console.log('Testing shader compilation...');
    
    // Test vertex shader
    const vertexScript = document.getElementById('phong-per-vertex-V');
    if (vertexScript) {
        console.log('Vertex shader source length:', vertexScript.text.length);
    }
    
    // Test fragment shader
    const fragmentScript = document.getElementById('phong-per-vertex-F');
    if (fragmentScript) {
        console.log('Fragment shader source length:', fragmentScript.text.length);
    }
}

function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    drawShapes();
}

// Mouse drag functions
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

function startDrag(event) {
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    event.preventDefault();
}

function drag(event) {
    if (!isDragging) return;
    
    let deltaX = event.clientX - lastMouseX;
    let deltaY = event.clientY - lastMouseY;
    
    viewRotY += deltaX * 0.01;
    viewRotX += deltaY * 0.01;
    
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    
    // Clamp vertical rotation
    viewRotX = Math.max(MIN_VERTICAL_ANGLE, Math.min(MAX_VERTICAL_ANGLE, viewRotX));
    
    draw();
    event.preventDefault();
}

function endDrag() {
    isDragging = false;
}

// Keyboard input handling
function gotKey(event) {
    const handledKeys = ['t', 'v', 'f', 'r', 'x', 'y'];
    const keyLower = event.key.toLowerCase();
    
    if (handledKeys.includes(keyLower)) {
        event.preventDefault();
        event.stopPropagation();
        
        switch(keyLower) {
            case 't':
                shadingEnabled = !shadingEnabled;
                console.log('Shading enabled:', shadingEnabled);
                break;
                
            case 'v':
                if (shadingEnabled) {
                    nowShowing = 'Vertex';
                    console.log('Now showing per-vertex shading');
                }
                break;
                
            case 'f':
                if (shadingEnabled) {
                    nowShowing = 'Fragment';
                    console.log('Now showing per-fragment shading');
                }
                break;
                
            case 'r':
                viewRotX = 0.0;
                viewRotY = 0.0;
                console.log('View reset');
                break;
                
            case 'x':
                if (event.shiftKey) {
                    viewRotX -= ROT_STEP;
                } else {
                    viewRotX += ROT_STEP;
                }
                break;
                
            case 'y':
                if (event.shiftKey) {
                    viewRotY -= ROT_STEP;
                } else {
                    viewRotY += ROT_STEP;
                }
                break;
        }
        
        // Clamp vertical rotation
        viewRotX = Math.max(MIN_VERTICAL_ANGLE, Math.min(MAX_VERTICAL_ANGLE, viewRotX));
        
        draw();
    }
}

// Update init function
function init() {
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas) {
        console.error('Canvas not found');
        return;
    }
    
    // Make canvas focusable and give it focus
    canvas.setAttribute('tabindex', '0');
    canvas.style.outline = 'none';
    canvas.focus();
    
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
    canvas.addEventListener('mouseleave', endDrag, false);
    
    // Re-focus canvas when clicked
    canvas.addEventListener('click', function() {
        canvas.focus();
    });
    
    // Initialize programs
    initPrograms();
    
     // Test shaders
    testShaders();
    

    // Create shapes
    createShapes();
    
    // Set up textures
    setUpTextures();
    
    // Set up initial cameras
    setUpCamera(program);
    setUpCamera(sphereTextureProgram);
    
    // Initial draw
    draw();
}
