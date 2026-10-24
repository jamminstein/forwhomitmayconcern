// GPU resources can disappear after sleep or memory pressure. The mesh stays in app state.
export function createWarpRenderer(canvas,{uvs,indices,onFallback,onRestore}) {
  let gl=null;try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:false})}catch(error){console.warn('WebGL unavailable',error)}
  let program,positions,texCoords,elements,texture,locations,available=false;
  let fullWidth=2,fullHeight=2,lastVertices=null,bounds={left:-.5,right:.5,bottom:-.5,top:.5};
  function fitBounds(vertices,force=false){
    // The original clip-space envelope is four stage widths/heights. Keep its
    // pixel density, but allocate the middle half until the mesh needs more.
    // Grow in quarter-clip-space steps so morphing does not resize every frame.
    const previous={...bounds},padX=4/fullWidth,padY=4/fullHeight;
    if(vertices)for(let i=0;i<vertices.length;i+=2){
      const x=vertices[i],y=vertices[i+1];
      if(!Number.isFinite(x)||!Number.isFinite(y))continue;
      if(x-padX<bounds.left)bounds.left=Math.max(-1,Math.floor((x-padX)*4)/4);
      if(x+padX>bounds.right)bounds.right=Math.min(1,Math.ceil((x+padX)*4)/4);
      if(y-padY<bounds.bottom)bounds.bottom=Math.max(-1,Math.floor((y-padY)*4)/4);
      if(y+padY>bounds.top)bounds.top=Math.min(1,Math.ceil((y+padY)*4)/4);
    }
    if(!force&&Object.keys(bounds).every(key=>bounds[key]===previous[key]))return crop;
    // Align the crop to the virtual full-buffer pixel grid; this preserves the
    // sample positions and avoids subpixel shifts at fractional CSS sizes.
    const left=Math.max(0,Math.floor((bounds.left+1)*fullWidth/2)),right=Math.min(fullWidth,Math.ceil((bounds.right+1)*fullWidth/2));
    const bottom=Math.max(0,Math.floor((bounds.bottom+1)*fullHeight/2)),top=Math.min(fullHeight,Math.ceil((bounds.top+1)*fullHeight/2));
    const width=right-left,height=top-bottom;
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}
    canvas.style.inset='auto';canvas.style.left=`${left/fullWidth*400-150}%`;canvas.style.top=`${(1-top/fullHeight)*400-150}%`;
    canvas.style.width=`${width/fullWidth*400}%`;canvas.style.height=`${height/fullHeight*400}%`;
    return {x:(left+right)/fullWidth-1,y:(bottom+top)/fullHeight-1,sx:fullWidth/width,sy:fullHeight/height};
  }
  let crop={x:0,y:0,sx:2,sy:2};
  const reportFallback=()=>{available=false;onFallback(true)};
  function initialize(){
    if(!gl){reportFallback();return}
    try {
      const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader};
      const vertex=compile(gl.VERTEX_SHADER,'attribute vec2 aPosition;attribute vec2 aUv;uniform vec4 uCrop;varying vec2 vUv;void main(){gl_Position=vec4((aPosition-uCrop.xy)*uCrop.zw,0.0,1.0);vUv=aUv;}');
      const fragment=compile(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D uVideo;varying vec2 vUv;void main(){gl_FragColor=texture2D(uVideo,vec2(vUv.x,1.0-vUv.y));}');
      program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
      gl.deleteShader(vertex);gl.deleteShader(fragment);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      locations={position:gl.getAttribLocation(program,'aPosition'),uv:gl.getAttribLocation(program,'aUv'),crop:gl.getUniformLocation(program,'uCrop')};
      positions=gl.createBuffer();texCoords=gl.createBuffer();elements=gl.createBuffer();texture=gl.createTexture();
      gl.bindBuffer(gl.ARRAY_BUFFER,texCoords);gl.bufferData(gl.ARRAY_BUFFER,uvs,gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elements);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
      gl.bindTexture(gl.TEXTURE_2D,texture);
      for(const name of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,name,gl.LINEAR);
      for(const name of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,name,gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.uniform1i(gl.getUniformLocation(program,'uVideo'),0);gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
      available=true;
    } catch(error) {console.warn('Warp renderer unavailable; showing video',error);reportFallback()}
  }
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();reportFallback()});
  canvas.addEventListener('webglcontextrestored',()=>{initialize();if(available)onRestore()});
  initialize();
  return {
    get available(){return available},
    resize(width,height){
      const max=available?gl.getParameter(gl.MAX_RENDERBUFFER_SIZE):8192;
      const dpr=Math.min(devicePixelRatio||1,2,max/Math.max(2,width*4),max/Math.max(2,height*4),Math.sqrt(32000000/Math.max(1,width*height*16)));
      fullWidth=Math.max(2,Math.round(width*4*dpr));fullHeight=Math.max(2,Math.round(height*4*dpr));
      bounds={left:-.5,right:.5,bottom:-.5,top:.5};crop=fitBounds(lastVertices,true);
    },
    draw(source,upload,vertices){
      if(!available||gl.isContextLost())return false;
      try {
        if(vertices){lastVertices=vertices;crop=fitBounds(vertices)}
        gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);
        gl.uniform4f(locations.crop,crop.x,crop.y,crop.sx,crop.sy);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
        if(upload)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
        gl.bindBuffer(gl.ARRAY_BUFFER,positions);if(vertices)gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locations.position);gl.vertexAttribPointer(locations.position,2,gl.FLOAT,false,0,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,texCoords);gl.enableVertexAttribArray(locations.uv);gl.vertexAttribPointer(locations.uv,2,gl.FLOAT,false,0,0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elements);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
        onFallback(false);return true;
      } catch(error) {console.warn('Warp texture unavailable; showing video',error);reportFallback();return false}
    }
  };
}
