// The UV grid stays fixed while its anchors and tangent vectors move. Expand the
// Coons patch once so each animation frame only evaluates its linear basis.
export function createSurfaceSampler(gridSize,uvs){
 const count=uvs.length/2,n=gridSize-1;
 const corners=new Uint32Array(count*4),weights=new Float64Array(count*13);
 for(let i=0,j=0,k=0;i<uvs.length;i+=2,j+=4,k+=13){
  // Keep the final UV row/column in the last patch, exactly as surface() does.
  const c=Math.min(n-1,Math.floor(uvs[i]*n)),r=Math.min(n-1,Math.floor(uvs[i+1]*n));
  const x=uvs[i]*n-c,y=uvs[i+1]*n-r,qx=1-x,qy=1-y;
  const x0=qx*qx*qx,x1=3*qx*qx*x,x2=3*qx*x*x,x3=x*x*x;
  const y0=qy*qy*qy,y1=3*qy*qy*y,y2=3*qy*y*y,y3=y*y*y;
  corners[j]=r*gridSize+c;corners[j+1]=r*gridSize+c+1;
  corners[j+2]=(r+1)*gridSize+c;corners[j+3]=(r+1)*gridSize+c+1;
  // Anchor contributions from the four cubic edges, minus the bilinear patch.
  weights[k]=qy*(x0+x1)+qx*(y0+y1)-qx*qy;
  weights[k+1]=qy*(x2+x3)+x*(y0+y1)-x*qy;
  weights[k+2]=y*(x0+x1)+qx*(y2+y3)-qx*y;
  weights[k+3]=y*(x2+x3)+x*(y2+y3)-x*y;
  // Tangents: top right/left, bottom right/left, left down/up, right down/up.
  weights[k+4]=qy*x1;weights[k+5]=qy*x2;
  weights[k+6]=y*x1;weights[k+7]=y*x2;
  weights[k+8]=qx*y1;weights[k+9]=qx*y2;
  weights[k+10]=x*y1;weights[k+11]=x*y2;
  weights[k+12]=3*x*qx+3*y*qy;
 }
 return function sample(points,spring,out){
  const sx=spring.x,sy=spring.y;
  for(let i=0,j=0,k=0;i<uvs.length;i+=2,j+=4,k+=13){
   const a=points[corners[j]],b=points[corners[j+1]],d=points[corners[j+2]],e=points[corners[j+3]];
   const ar=a.right,bl=b.left,dr=d.right,el=e.left,ad=a.down,du=d.up,bd=b.down,eu=e.up;
   const w0=weights[k],w1=weights[k+1],w2=weights[k+2],w3=weights[k+3];
   const w4=weights[k+4],w5=weights[k+5],w6=weights[k+6],w7=weights[k+7];
   const w8=weights[k+8],w9=weights[k+9],w10=weights[k+10],w11=weights[k+11],ws=weights[k+12];
   const x=w0*a.x+w1*b.x+w2*d.x+w3*e.x+w4*ar.x+w5*bl.x+w6*dr.x+w7*el.x+w8*ad.x+w9*du.x+w10*bd.x+w11*eu.x+ws*sx;
   const y=w0*a.y+w1*b.y+w2*d.y+w3*e.y+w4*ar.y+w5*bl.y+w6*dr.y+w7*el.y+w8*ad.y+w9*du.y+w10*bd.y+w11*eu.y+ws*sy;
   out[i]=(x-.5)/2;out[i+1]=(.5-y)/2;
  }
  return out;
 };
}
