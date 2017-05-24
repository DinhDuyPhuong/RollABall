
var SHADOW_VSHADER_SOURCE =
'attribute vec4 aPosition;\n' +
'uniform mat4 uMVPMatrix;\n' +
'void main() {\n' +
'  gl_Position = uMVPMatrix * aPosition;\n' +
'}\n';

var SHADOW_FSHADER_SOURCE =
'precision mediump float;\n' +
'void main() {\n' +
'  const vec4 bitShift = vec4(1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0);\n' +
'  const vec4 bitMask = vec4(1.0/256.0, 1.0/256.0, 1.0/256.0, 0.0);\n' +
'  vec4 rgbaDepth = fract(gl_FragCoord.z * bitShift);\n' + // Calculate the value stored into each byte
'  rgbaDepth -= rgbaDepth.gbaa * bitMask;\n' + // Cut off the value which do not fit in 8 bits
'  gl_FragColor = rgbaDepth;\n' +
'}\n';

var VSHADER_SOURCE =
'attribute vec4 aPosition;\n' +
'attribute vec2 aTextureCoord;\n' +
'attribute vec4 aNormal;\n' +

'uniform mat4 uMMatrix;\n' +
'uniform mat4 uVMatrix;\n' +
'uniform mat4 uPMatrix;\n' +
'uniform mat4 uNMatrix;\n' +
'uniform mat4 uMVPMatrixFromLight;\n' +

'varying vec4 vPositionFromLight;\n' +
'varying vec2 vTextureCoord;\n'+
'varying vec3 vPosition;\n' +
'varying vec3 vNormal;\n' +

'void main(){\n' +
' gl_Position = uPMatrix * uVMatrix * uMMatrix * aPosition;\n' +
' vPosition = vec3(uMMatrix * aPosition);\n' +
' vec3 normal = normalize(vec3(uNMatrix * aNormal));\n' +
' vNormal = normalize(vec3(uNMatrix * aNormal));\n' +
' vTextureCoord = aTextureCoord;\n' +
' vPositionFromLight = uMVPMatrixFromLight * aPosition;\n' +
'}\n';

var FSHADER_SOURCE = 
'precision mediump float;\n' +

'uniform sampler2D uSampler;\n' +
'uniform sampler2D uShadowMap;\n' +

'uniform vec3 uLightColor;\n' + //color of the light
'uniform vec3 uLightPosition;\n' +
'uniform vec3 uAmbientColor;\n' +

'varying vec2 vTextureCoord;\n' +
'varying vec3 vNormal;\n' +
'varying vec3 vPosition;\n' +
'varying vec4 vPositionFromLight;\n' +

'float unpackDepth(const in vec4 rgbaDepth) {\n' +
'  const vec4 bitShift = vec4(1.0, 1.0/256.0, 1.0/(256.0*256.0), 1.0/(256.0*256.0*256.0));\n' +
'  float depth = dot(rgbaDepth, bitShift);\n' + // Use dot() since the calculations is same
'  return depth;\n' +
'}\n' +

'void main(){\n' +
' vec3 normal = normalize(vNormal);\n' +
' vec3 lightDirection = normalize(uLightPosition - vPosition);\n'+
' float nDotL = max(dot(lightDirection, normal), 0.0);\n' +
' vec3 diffuse = uLightColor * nDotL;\n' +
' vec3 ambient = uAmbientColor;\n' +
' vec3 lightWeighting = diffuse + ambient;\n' +
' vec4 fragmentColor = texture2D(uSampler, vTextureCoord);\n' +
' vec4 color = vec4(fragmentColor.rgb * lightWeighting, fragmentColor.a);\n' + 

' vec3 shadowCoord = (vPositionFromLight.xyz/vPositionFromLight.w)/2.0 + 0.5;\n' +
' vec4 rgbaDepth = texture2D(uShadowMap, shadowCoord.xy);\n' +
' float depth = unpackDepth(rgbaDepth);\n' + // Retrieve the z-value from G
' float visibility = (shadowCoord.z > depth + 0.0015) ? 0.7 : 1.0;\n' +
' gl_FragColor = vec4(color.rgb * visibility, color.a);\n' +
'}\n';


var gl;
var canvas;
var ctx;
var normalProgram;
var shadowProgram;
var mMatrix_sphere = new Matrix4();
var vMatrix_sphere = new Matrix4();
var mMatrix_cube = new Matrix4();
var vMatrix = new Matrix4();
var pMatrix = new Matrix4();
var mMatrix_plane = new Matrix4();
var nMatrix = new Matrix4();
var xMoon = 0, yMoon = 0, zMoon = 0;
var Xeye = 0, Yeye = 5, Zeye = 5;
var OFFSCREEN_WIDTH = 2048;
var OFFSCREEN_HEIGHT = 2048;
var SunRadius = 20;
var xPointlight = 0; yPointlight = SunRadius, zPointlight = -2;

function initProgram(){
  canvas = document.getElementById("webgl");
  gl = canvas.getContext("experimental-webgl");

  shadowProgram = createProgram(gl, SHADOW_VSHADER_SOURCE, SHADOW_FSHADER_SOURCE);
  shadowProgram.aPosition = gl.getAttribLocation(shadowProgram, 'aPosition');
  gl.enableVertexAttribArray(shadowProgram.aPosition);

  shadowProgram.uMVPMatrix = gl.getUniformLocation(shadowProgram, 'uMVPMatrix');

  normalProgram = createProgram(gl, VSHADER_SOURCE, FSHADER_SOURCE);

  normalProgram.aPosition = gl.getAttribLocation(normalProgram, 'aPosition');
  normalProgram.aTextureCoord = gl.getAttribLocation(normalProgram, 'aTextureCoord');
  normalProgram.aNormal = gl.getAttribLocation(normalProgram, 'aNormal');
  gl.enableVertexAttribArray(normalProgram.aPosition);
  gl.enableVertexAttribArray(normalProgram.aTextureCoord);
  gl.enableVertexAttribArray(normalProgram.aNormal);  

  normalProgram.uPMatrix = gl.getUniformLocation(normalProgram, 'uPMatrix');
  normalProgram.uVMatrix = gl.getUniformLocation(normalProgram, 'uVMatrix');
  normalProgram.uMMatrix = gl.getUniformLocation(normalProgram, 'uMMatrix');
  normalProgram.uNMatrix = gl.getUniformLocation(normalProgram, 'uNMatrix');
  normalProgram.uMVPMatrixFromLight = gl.getUniformLocation(normalProgram, 'uMVPMatrixFromLight');  
  
  normalProgram.uSampler = gl.getUniformLocation(normalProgram, 'uSampler');  
  normalProgram.uShadowMap = gl.getUniformLocation(normalProgram, 'uShadowMap');
  normalProgram.uLightColor = gl.getUniformLocation(normalProgram, 'uLightColor');
  normalProgram.uLightPosition = gl.getUniformLocation(normalProgram, 'uLightPosition');
  normalProgram.uAmbientColor = gl.getUniformLocation(normalProgram, 'uAmbientColor');

  var hud = document.getElementById("hud");
  ctx = hud.getContext("2d");
}

var moonVertexPositionBuffer;
var moonVertexTextureCoordBuffer;
var moonVertexIndexBuffer;
var moonVertexNormalBuffer;

var cubeVertexPositionBuffer;
var cubeVertexTextureCoordBuffer;
var cubeVertexIndexBuffer;
var cubeVertexNormalBuffer;

var planeVertexPositionBuffer;
var planeVertexTextureCoordBuffer;
var planeWidth = 30, planeHeight = 30;


function initBuffers(){
  
    var latitudeBands = 30;
    var longitudeBands = 30;
    var radius = 2;

    var vertexPositionData = [];
    var normalData = [];
    var textureCoordData = [];
    for (var latNumber=0; latNumber <= latitudeBands; latNumber++) {
        var theta = latNumber * Math.PI / latitudeBands;
        var sinTheta = Math.sin(theta);
        var cosTheta = Math.cos(theta);

        for (var longNumber = 0; longNumber <= longitudeBands; longNumber++) {
            var phi = longNumber * 2 * Math.PI / longitudeBands;
            var sinPhi = Math.sin(phi);
            var cosPhi = Math.cos(phi);

            var x = cosPhi * sinTheta;
            var y = cosTheta;
            var z = sinPhi * sinTheta;
            var u = 1 - (longNumber / longitudeBands);
            var v = 1 - (latNumber / latitudeBands);

            normalData.push(x);
            normalData.push(y);
            normalData.push(z);
            textureCoordData.push(u);
            textureCoordData.push(v);
            vertexPositionData.push(radius * x);
            vertexPositionData.push(radius * y);
            vertexPositionData.push(radius * z);
        }
    }

    var indexData = [];
    for (var latNumber = 0; latNumber < latitudeBands; latNumber++) {
        for (var longNumber = 0; longNumber < longitudeBands; longNumber++) {
            var first = (latNumber * (longitudeBands + 1)) + longNumber;
            var second = first + longitudeBands + 1;
            indexData.push(first);
            indexData.push(second);
            indexData.push(first + 1);

            indexData.push(second);
            indexData.push(second + 1);
            indexData.push(first + 1);
        }
    }

    moonVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, moonVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalData), gl.STATIC_DRAW);
    moonVertexNormalBuffer.itemSize = 3;
    moonVertexNormalBuffer.numItems = normalData.length / 3;

    moonVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, moonVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordData), gl.STATIC_DRAW);
    moonVertexTextureCoordBuffer.itemSize = 2;
    moonVertexTextureCoordBuffer.numItems = textureCoordData.length / 2;

    moonVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, moonVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositionData), gl.STATIC_DRAW);
    moonVertexPositionBuffer.itemSize = 3;
    moonVertexPositionBuffer.numItems = vertexPositionData.length / 3;

    moonVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, moonVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexData), gl.STREAM_DRAW);
    moonVertexIndexBuffer.itemSize = 1;
    moonVertexIndexBuffer.numItems = indexData.length;

    cubeVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
    vertices = [
        // Front face
        -1.0, -1.0,  1.0,
         1.0, -1.0,  1.0,
         1.0,  1.0,  1.0,
        -1.0,  1.0,  1.0,

        // Back face
        -1.0, -1.0, -1.0,
        -1.0,  1.0, -1.0,
         1.0,  1.0, -1.0,
         1.0, -1.0, -1.0,

        // Top face
        -1.0,  1.0, -1.0,
        -1.0,  1.0,  1.0,
         1.0,  1.0,  1.0,
         1.0,  1.0, -1.0,

        // Bottom face
        -1.0, -1.0, -1.0,
         1.0, -1.0, -1.0,
         1.0, -1.0,  1.0,
        -1.0, -1.0,  1.0,

        // Right face
         1.0, -1.0, -1.0,
         1.0,  1.0, -1.0,
         1.0,  1.0,  1.0,
         1.0, -1.0,  1.0,

        // Left face
        -1.0, -1.0, -1.0,
        -1.0, -1.0,  1.0,
        -1.0,  1.0,  1.0,
        -1.0,  1.0, -1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    cubeVertexPositionBuffer.itemSize = 3;
    cubeVertexPositionBuffer.numItems = 24;

    cubeVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
    var textureCoords = [
        // Front face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,

        // Back face
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,

        // Top face
        0.0, 1.0,
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,

        // Bottom face
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,
        1.0, 0.0,

        // Right face
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,

        // Left face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
    cubeVertexTextureCoordBuffer.itemSize = 2;
    cubeVertexTextureCoordBuffer.numItems = 24;

    cubeVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexNormalBuffer);
    var vertexNormals = [
    // Front face
         0.0,  0.0,  1.0,
         0.0,  0.0,  1.0,
         0.0,  0.0,  1.0,
         0.0,  0.0,  1.0,

        // Back face
         0.0,  0.0, -1.0,
         0.0,  0.0, -1.0,
         0.0,  0.0, -1.0,
         0.0,  0.0, -1.0,

        // Top face
         0.0,  1.0,  0.0,
         0.0,  1.0,  0.0,
         0.0,  1.0,  0.0,
         0.0,  1.0,  0.0,

        // Bottom face
         0.0, -1.0,  0.0,
         0.0, -1.0,  0.0,
         0.0, -1.0,  0.0,
         0.0, -1.0,  0.0,

        // Right face
         1.0,  0.0,  0.0,
         1.0,  0.0,  0.0,
         1.0,  0.0,  0.0,
         1.0,  0.0,  0.0,

        // Left face
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals), gl.STATIC_DRAW);
    cubeVertexNormalBuffer.itemSize = 3;
    cubeVertexNormalBuffer.numItems = 24;

    cubeVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    var cubeVertexIndices = [
        0, 1, 2,      0, 2, 3,    // Front face
        4, 5, 6,      4, 6, 7,    // Back face
        8, 9, 10,     8, 10, 11,  // Top face
        12, 13, 14,   12, 14, 15, // Bottom face
        16, 17, 18,   16, 18, 19, // Right face
        20, 21, 22,   20, 22, 23  // Left face
    ];
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
    cubeVertexIndexBuffer.itemSize = 1;
    cubeVertexIndexBuffer.numItems = 36;

  vertices  = [
    -planeWidth, -2.0, -planeHeight,
     planeWidth, -2.0, -planeHeight,
    -planeWidth, -2.0,  planeHeight,
     planeWidth, -2.0,  planeHeight
  ];
  planeVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, planeVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  planeVertexPositionBuffer.itemSize = 3;
  planeVertexPositionBuffer.numItems = 4;

  vertices = [    
    0.0, 0.0,
    1.0, 0.0,    
    0.0, 1.0,
    1.0, 1.0
  ];
  planeVertexTextureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, planeVertexTextureCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  planeVertexTextureCoordBuffer.itemSize = 2;
  planeVertexTextureCoordBuffer.numItems = 4;

  vertices = [
    0.0,  1.0,  0.0,
    0.0,  1.0,  0.0,
    0.0,  1.0,  0.0,
    0.0,  1.0,  0.0,
  ];
  planeVertexNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, planeVertexNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  planeVertexNormalBuffer.itemSize = 3;
  planeVertexNormalBuffer.numItems = 4;

}


function handleLoadedTexture(texture){  
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

var moonTexture;
var cubeTexture;
var planeTexture;
function initTexture(){
  moonTexture = gl.createTexture();
  moonTexture.image = new Image();
  moonTexture.image.onload = function (){
    handleLoadedTexture(moonTexture);
  }
  moonTexture.image.src = "BongRo.gif";  

  cubeTexture = gl.createTexture();
  cubeTexture.image = new Image();
  cubeTexture.image.onload = function(){
    handleLoadedTexture(cubeTexture);
  }
  cubeTexture.image.src = "Ipod.gif";

  planeTexture = gl.createTexture();
  planeTexture.image = new Image();
  planeTexture.image.onload = function (){
    handleLoadedTexture(planeTexture);
  }
  planeTexture.image.src = "a.gif";

}

function setMatrixUniforms(program) { 
  gl.uniformMatrix4fv(normalProgram.uPMatrix, false, pMatrix.elements);
  gl.uniformMatrix4fv(normalProgram.uVMatrix, false, vMatrix.elements);
  gl.uniformMatrix4fv(normalProgram.uNMatrix, false, nMatrix.elements);

  gl.uniform3f(normalProgram.uLightColor, 0.9, 0.9, 0.9); 
  gl.uniform3f(normalProgram.uLightPosition, xPointlight, yPointlight, zPointlight);    
  gl.uniform3f(normalProgram.uAmbientColor, 0.2, 0.2, 0.0);
}

//view khong thay doi with everything
function drawSphere(){

  mMatrix_sphere.setTranslate(xMoon, yMoon, zMoon);
  mMatrix_sphere.rotate(angle, 0, 1, 0);

  nMatrix.setInverseOf(mMatrix_sphere);
  nMatrix.transpose();

  gl.uniformMatrix4fv(normalProgram.uMMatrix, false, mMatrix_sphere.elements);
  setMatrixUniforms(normalProgram);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, moonTexture);
  gl.uniform1i(normalProgram.uSampler, 1);


  gl.bindBuffer(gl.ARRAY_BUFFER, moonVertexPositionBuffer);
  gl.vertexAttribPointer(normalProgram.aPosition, moonVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, moonVertexTextureCoordBuffer);
  gl.vertexAttribPointer(normalProgram.aTextureCoord, moonVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, moonVertexNormalBuffer);
  gl.vertexAttribPointer(normalProgram.aNormal, moonVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, moonVertexIndexBuffer);
  gl.drawElements(gl.TRIANGLES, moonVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}

function drawCube(){
  for (var i=0; i<numCubes; i++)
    if (!Cubes[i].lock){
      mMatrix_cube.setTranslate(Cubes[i].x, Cubes[i].y, Cubes[i].z);
      mMatrix_cube.rotate(angle, 1, 0, 1);

      nMatrix.setInverseOf(mMatrix_cube);
      nMatrix.transpose();

      gl.uniformMatrix4fv(normalProgram.uMMatrix, false, mMatrix_cube.elements);
      setMatrixUniforms(normalProgram);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, cubeTexture);
      gl.uniform1i(normalProgram.uSampler, 1);    

      gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
      gl.vertexAttribPointer(normalProgram.aPosition, cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
      gl.vertexAttribPointer(normalProgram.aTextureCoord, cubeVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexNormalBuffer);
      gl.vertexAttribPointer(normalProgram.aNormal, cubeVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);
      
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
      gl.drawElements(gl.TRIANGLES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    }
}

function drawPlane(){
  mMatrix_plane.setRotate(0, 0, 1, 0);
  gl.uniformMatrix4fv(normalProgram.uMMatrix, false, mMatrix_plane.elements);
  nMatrix.setInverseOf(mMatrix_plane);
  nMatrix.transpose();  

  gl.uniformMatrix4fv(normalProgram.uNMatrix, false, nMatrix.elements);
  setMatrixUniforms();

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, planeTexture);
  gl.uniform1i(normalProgram.uSampler, 1);    

  gl.bindBuffer(gl.ARRAY_BUFFER, planeVertexPositionBuffer);
  gl.vertexAttribPointer(normalProgram.aPosition, planeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, planeVertexTextureCoordBuffer);
  gl.vertexAttribPointer(normalProgram.aTextureCoord, planeVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, planeVertexNormalBuffer);
  gl.vertexAttribPointer(normalProgram.aNormal, planeVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, planeVertexPositionBuffer.numItems);
}

function drawSphere1(){
  g_modelMatrix.setTranslate(xMoon, yMoon, zMoon);
  g_modelMatrix.rotate(angle, 0, 1, 0);
  g_mvpMatrix.set(viewProjMatrixFromLight); 
  g_mvpMatrix.multiply(g_modelMatrix);
  gl.uniformMatrix4fv(shadowProgram.uMVPMatrix, false, g_mvpMatrix.elements);

  gl.bindBuffer(gl.ARRAY_BUFFER, moonVertexPositionBuffer);
  gl.vertexAttribPointer(shadowProgram.aPosition, moonVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, moonVertexIndexBuffer);
  gl.drawElements(gl.TRIANGLES, moonVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}

function drawCube1(){
  for (var i=0; i<numCubes; i++)
    if (!Cubes[i].lock){
      g_modelMatrix.setTranslate(Cubes[i].x, Cubes[i].y, Cubes[i].z);
      g_modelMatrix.rotate(angle, 1, 0, 1);
      g_mvpMatrix.set(viewProjMatrixFromLight);
      g_mvpMatrix.multiply(g_modelMatrix);
      gl.uniformMatrix4fv(shadowProgram.uMVPMatrix, false, g_mvpMatrix.elements);
      gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
      gl.vertexAttribPointer(shadowProgram.aPosition, cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
      gl.drawElements(gl.TRIANGLES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    }
}

function drawPlane1(){
  g_modelMatrix.setRotate(0, 0, 1, 0);
  g_mvpMatrix.set(viewProjMatrixFromLight);
  g_mvpMatrix.multiply(g_modelMatrix);
  gl.uniformMatrix4fv(shadowProgram.uMVPMatrix, false, g_mvpMatrix.elements);

  gl.bindBuffer(gl.ARRAY_BUFFER, planeVertexPositionBuffer);
  gl.vertexAttribPointer(shadowProgram.aPosition, planeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
  
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, planeVertexPositionBuffer.numItems);  
}

function drawScene(){ 
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(shadowProgram); 
  drawCube1();
  drawSphere1();  
  mvpMatrixFromLight_everything.set(g_mvpMatrix);
  drawPlane1();
  mvpMatrixFromLight_p.set(g_mvpMatrix);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, 500, 500);  // maximum monitor
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(normalProgram);
  gl.uniform1i(normalProgram.uShadowMap, 0);
  gl.uniformMatrix4fv(normalProgram.uMVPMatrixFromLight, false, mvpMatrixFromLight_everything.elements);
  drawSphere();
  drawCube(); 
  gl.uniformMatrix4fv(normalProgram.uMVPMatrixFromLight, false, mvpMatrixFromLight_p.elements);
  drawPlane();

}


var g_modelMatrix = new Matrix4();
var g_mvpMatrix = new Matrix4();
var viewProjMatrix;
var viewProjMatrixFromLight;

function main(){
  initProgram();
  initBuffers();
  initCubes();
  initTexture();
  initFramebufferObject();    

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, fbo.texture);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);

  viewProjMatrixFromLight = new Matrix4();
  mvpMatrixFromLight_everything = new Matrix4();
  mvpMatrixFromLight_p = new Matrix4();

  tick = function (){     
    viewProjMatrixFromLight.setPerspective(120, 1, 1, 100);
    viewProjMatrixFromLight.lookAt(xPointlight, yPointlight, zPointlight, 0, 0, 0, 0, 1, 0);    
    pMatrix.setPerspective(90, 1, 1, 100);
    vMatrix.setLookAt(Xeye, Yeye, Zeye, xMoon, yMoon, zMoon, 0, 1, 0);

    drawScene();
    drawCtx();    
    animate();    
    check_interact();
    check_over();   
    if (delay == 0) checkWin();
    requestAnimationFrame(tick);
  };
  tick();

  document.onkeydown = function(ev) {
      handleKeyDown(ev);
  }  
}

var lastActionX = 0;
var lastActionZ = 0;
var vX = 0, vZ = 0;
var aMs = 0.05;
var angle = 0;
var lastTime = 0;
var delay = 0;
var Score = 0;
var winGame = false;

function drawCtx(){
  ctx.clearRect(0, 0, 500, 500);
  if (!winGame){
    ctx.font = '40px "Times New Roman"';    
    if (delay > 0){
      var r = Math.round(Math.random() * 250);
      var g = Math.round(Math.random() * 250);
      var b = Math.round(Math.random() * 250);    
      if (delay > 0) ctx.fillStyle = 'rgba(' + r.toString() + ',' + g.toString() + ',' + b.toString() +', 1)';
      ctx.fillText('+100', 248, 250 + delay);   
      delay--;    
    }
    ctx.fillStyle = 'rgba(255, 255, 0, 1)';
    ctx.fillText('Your score: ' + Score.toString(), 10, 30);
  }
  else{
    ctx.font = '40px "Times New Roman"';    
    ctx.fillText('You Win!!!', 163, 237);
  }
}

function animate(){
  var timeNow = new Date().getTime();
  if (lastTime !==0 ){    
    var elapsed = timeNow - lastTime;
    angle += (elapsed * 75) / 1000.0;    
//=========================================
    xMoon += (elapsed * vX) / 1000.0;
    zMoon += (elapsed * vZ) / 1000.0;
    Xeye += (elapsed * vX) / 1000.0;
    Zeye += (elapsed * vZ) / 1000.0;
// giam dan van toc theo thoi gian
    if (vX > 0) vX -= aMs;
    if (vX < 0) vX += aMs;
    if (vZ > 0) vZ -= aMs;
    if (vZ < 0) vZ += aMs;
// delay for check point
    delay -= 1;
  }
  lastTime = timeNow;
}

var Cubes = [];
var numCubes;
var Snows = [];
var numSnows;

function degToRad(Angle){
  var Pi = Math.PI;
  return (Angle * Pi) / 180.0;
}

function Cube(xCoord, yCoord, zCoord){
    this.x = xCoord;
    this.y = yCoord;
    this.z = zCoord;
    this.lock = false;
}

function initCubes(){
  numCubes = 22;  
  var Radius = 16;
  var Angle = 0;
  var x, z;
  for (var i=0; i<numCubes; i++){   
    x = Radius * Math.sin(degToRad(Angle));
    z = Radius * Math.cos(degToRad(Angle));
    Cubes.push(new Cube(x, 0, z));    
    Angle += 18;
  }
}

function checkWin(){
  winGame = (Score == 100 * numCubes);
}

function check_over(){
  // Check raiduse + 
  var u = xMoon + 2;
  var v = zMoon + 2;
  if (u > planeWidth){    
    xMoon -= 0.5;
    Xeye -= 0.5;

    vX = -vX;   
    lastActionX = -lastActionX;
  }
  if (v > planeHeight){
    zMoon -= 0.5;
    Zeye -= 0.5;

    vZ = -vZ;
    lastActionZ = -lastActionZ;
  }

  u = xMoon - 2;
  v = zMoon - 2;
  if (u < -planeWidth){ 
    xMoon += 0.5;
    Xeye += 0.5;
	// thiet lap huong van toc   
    vX = -vX;
    lastActionX = -lastActionX;
  }
  if (v < -planeHeight){    
    zMoon += 0.5;
    Zeye += 0.5;

    vZ = -vZ; 
    lastActionZ = -lastActionZ;
  }
}

function handleKeyDown(ev){
  if (ev.keyCode == 37){    
    if (lastActionX == 1) vX = -vX; 
	vX = -9;
    lastActionX = -1;
  }
  if (ev.keyCode == 38){    
    if (lastActionZ == 1) vZ = -vZ;  
	vZ = -9;
    lastActionZ = -1;
  }
  if (ev.keyCode == 39){
    if (lastActionX == -1) vX = -vX; 
	vX = 9;    
    lastActionX = +1;
  }
  if (ev.keyCode == 40){    
    if (lastActionZ == -1) vZ = -vZ;
	vZ = 9;
    lastActionZ = +1;
  }
  if (ev.keyCode == 107){
    Yeye += 1;
  } 
  if (ev.keyCode == 109){
    Yeye -= 1;
  }
}

function check_interact(){
  for (var i=0; i<numCubes; i++)
    if (!Cubes[i].lock){
      var sqr_distance = (xMoon - Cubes[i].x)*(xMoon - Cubes[i].x) + (zMoon - Cubes[i].z)*(zMoon - Cubes[i].z);
      var r1Plusr2 = 2 + Math.sqrt(2);
      if (sqr_distance <= r1Plusr2 * r1Plusr2){
        Cubes[i].lock = true;
        delay = 100;
        Score += 100;
      }
    }   
}

var fbo;
function initFramebufferObject(){
  var framebuffer, texture, depthBuffer;
  framebuffer = gl.createFramebuffer();
  // Create a texture object and set its size and parameters
  texture = gl.createTexture(); // Create a texture object
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Create a renderbuffer object and Set its size and parameters
  depthBuffer = gl.createRenderbuffer(); // Create a renderbuffer object
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT);
  // Attach the texture and the renderbuffer object to the FBO
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
  // Check if FBO is configured correctly
  framebuffer.texture = texture; // keep the required object
  // Unbind the buffer object
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);

  fbo = framebuffer;
}
