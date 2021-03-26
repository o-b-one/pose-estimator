/* eslint-disable */
import colorConvert from 'color-convert';

export function heatMapColorForValue(value, opacity = 1){
  const rgbColors = colorConvert.hsl.rgb(((1.0 - value) * 240), 100, 70);
  return `rgba(${rgbColors[0]},${rgbColors[1]},${rgbColors[2]},${opacity})`;
};
export function drawConfidencePointOnCanvas({
  x, y, confidenceScore, ctx,angle,part
}){
  let pointSize = 8;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - pointSize / 2, y - pointSize / 2, pointSize, pointSize);
  // if(angle){
  //   ctx.fillStyle = "red";
  //   ctx.font = "16px Arial";
  //   ctx.fillText(angle+`(${part})`,x, y);
  // }
  pointSize -= 4;
  ctx.fillStyle = heatMapColorForValue(confidenceScore);
  ctx.fillRect(x - pointSize / 2, y - pointSize / 2, pointSize, pointSize);
};
export function drawLineFromKeyPoints({ ctx, fromPoint, toPoint }){
  const boneGradient = ctx.createLinearGradient(fromPoint.position.x, fromPoint.position.y, toPoint.position.x, toPoint.position.y);
  boneGradient.addColorStop(0, heatMapColorForValue(fromPoint.score));
  boneGradient.addColorStop(1, heatMapColorForValue(toPoint.score));
  ctx.beginPath();
  ctx.moveTo(fromPoint.position.x, fromPoint.position.y);
  ctx.lineTo(toPoint.position.x, toPoint.position.y);

  ctx.strokeStyle = 'black';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = boneGradient;
  ctx.lineWidth = 4;
  ctx.stroke();
};
export function clearCanvasWithWhiteTransparency({ canvas, transparency }){
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `rgba(225,225,225,${transparency})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};
export class Visualizer {
  pose: any;
  minScoreToDraw: number;
  bodyParts: { nose: string; eye: string; ear: string; shoulder: string; elbow: string; wrist: string; hip: string; knee: string; ankle: string; };
  poseSides: { left: string; right: string; };
  ctx: any;
  canvas: any;
  poseByPart: any;
  latestPosition: { top: number; left: number; width: number; height: number;frameWidth?:number; frameHeight?: number } = {} as any;
  image: any;
  cropMemo: { x: number; y: number; width: number; height: number; };

  constructor({ canvas }) {
    this.loadCanvas(canvas);
    this.pose = null;
    this.minScoreToDraw = 0;
    this.bodyParts = {
      nose: 'nose', eye: 'Eye', ear: 'Ear', shoulder: 'Shoulder', elbow: 'Elbow', wrist: 'Wrist', hip: 'Hip', knee: 'Knee', ankle: 'Ankle'
    };
    this.poseSides = { left: 'left', right: 'right' };
    }

  drawLine = ({ fromPoint, toPoint }) => {
    if (fromPoint.score > this.minScoreToDraw && toPoint.score > this.minScoreToDraw) { drawLineFromKeyPoints({ ctx: this.ctx, fromPoint, toPoint }); }
  }

  drawPosePoints() {
    this.pose.keypoints.forEach((point) => this.drawPosePoint(point));
  }

  drawPosePoint(point) {
    if (point.score > this.minScoreToDraw) { drawConfidencePointOnCanvas({ ...point.position, confidenceScore: point.score, ctx: this.ctx, angle: point.angle,part: point.part }); }
  }

  drawArm(side) {
    this.drawLine({ fromPoint: this.poseByPart[`${side}${this.bodyParts.elbow}`], toPoint: this.poseByPart[`${side}${this.bodyParts.wrist}`] });
    this.drawLine({ fromPoint: this.poseByPart[`${side}${this.bodyParts.shoulder}`], toPoint: this.poseByPart[`${side}${this.bodyParts.elbow}`] });
  }

  drawLeg(side) {
    this.drawLine({ fromPoint: this.poseByPart[`${side}${this.bodyParts.knee}`], toPoint: this.poseByPart[`${side}${this.bodyParts.ankle}`] });
    this.drawLine({ fromPoint: this.poseByPart[`${side}${this.bodyParts.hip}`], toPoint: this.poseByPart[`${side}${this.bodyParts.knee}`] });
  }

  drawCore() {
    this.drawLine({
      fromPoint: this.poseByPart[`${this.poseSides.left}${this.bodyParts.hip}`],
      toPoint: this.poseByPart[`${this.poseSides.right}${this.bodyParts.hip}`]
    });
    this.drawLine({
      fromPoint: this.poseByPart[`${this.poseSides.left}${this.bodyParts.shoulder}`],
      toPoint: this.poseByPart[`${this.poseSides.right}${this.bodyParts.shoulder}`]
    });
    this.drawLine({
      fromPoint: this.poseByPart[`${this.poseSides.left}${this.bodyParts.shoulder}`],
      toPoint: this.poseByPart[`${this.poseSides.left}${this.bodyParts.hip}`]
    });
    this.drawLine({
      fromPoint: this.poseByPart[`${this.poseSides.right}${this.bodyParts.shoulder}`],
      toPoint: this.poseByPart[`${this.poseSides.right}${this.bodyParts.hip}`]
    });
  }

  drawSkeleton() {
    this.drawArm(this.poseSides.left);
    this.drawArm(this.poseSides.right);
    this.drawLeg(this.poseSides.left);
    this.drawLeg(this.poseSides.right);
    this.drawCore();
  }

  loadPose(pose) {
    this.pose = pose;
    this.poseByPart = {};
    this.pose.keypoints.forEach((point) => {
      this.poseByPart[point.part] = point;
    });
  }

  loadCanvas(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  getSmartMinScore() {
    return Math.max(0.3, this.pose.score - (this.pose.score / 5));
  }

  drawOverlayOnCanvas({ transparency, minScoreToDraw = 0, autoMinScore = false }) {
    if (transparency) { clearCanvasWithWhiteTransparency({ canvas: this.canvas, transparency }); }
    this.minScoreToDraw = autoMinScore ? this.getSmartMinScore() : minScoreToDraw;
    this.drawSkeleton();
    this.drawPosePoints();
  }

  drawBox(prediction){
    const {top,
      left,
      bottom,
      right,
      height,
      width,
      score
    } = prediction;
    const className = prediction.class;
    this.ctx.beginPath();
    this.ctx.rect(left, top, width, height);
    this.ctx.stroke(); 
    this.ctx.font = "30px Arial";
    this.ctx.fillText(className, left, bottom);
  }


  cloneCanvas(): HTMLCanvasElement{
     const newCanvas = window.document.createElement('canvas');
     const context = newCanvas.getContext('2d');
     newCanvas.width = this.canvas.width;
     newCanvas.height = this.canvas.height;
     context.drawImage(this.canvas, 0, 0);
     return newCanvas;
  }

  clearCanvas(){
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.beginPath();
  }

  normalizePosition(pos: number, factor: number = -10){
    return Math.max(0, pos + factor)
  }

  cropImage()
  cropImage(x: number, y: number, width: number, height: number)
  cropImage(x?: number,y?: number, width?: number, height?: number){
    if(x && y && width && height){
      const frame = this.normalizePosition(Math.max(width,height), 23)
      this.cropMemo = {
        x: this.normalizePosition(x), 
        y: this.normalizePosition(y), 
        width: frame, 
        height: frame
      };
    }
    else if(!this.cropMemo){
      return;
    }
    
    const image = this.ctx.getImageData(this.cropMemo.x,this.cropMemo.y, this.cropMemo.width, this.cropMemo.height)
    this.clearCanvas();

    // B&W filter
    for(let i=0;i<image.length; i+=4){
      image[i+0]=image[i+1]=image[i+2]=(image[i]+image[i+1]+image[i+2])/3;
    }

    this.ctx.putImageData(image, this.cropMemo.x, this.cropMemo.y, 0, 0, this.latestPosition.frameWidth, this.latestPosition.frameHeight)
    
  }


  drawImage(positions, image){
    this.latestPosition = {...this.latestPosition, ...positions};
    this.drawByMemo(image);
  }


  drawByMemo(image?, originalWidth = 200, originalHeight = 200){
    let {left, top, width, height, frameWidth, frameHeight} = this.latestPosition;
    if(image)
      this.image = image
    this.clearCanvas()
    this.ctx.drawImage(this.image,left, top, frameWidth, frameHeight,left, top, width || originalWidth, height || originalHeight);
  }
}